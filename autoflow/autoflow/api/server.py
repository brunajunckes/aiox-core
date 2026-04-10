"""AutoFlow API Gateway — FastAPI server on port 8080.

Endpoints:
  POST /workflow/{type}  — Start workflow (research, seo, video)
  GET  /workflow/{id}    — Get workflow status/result
  GET  /health           — Health check
  GET  /metrics          — Resource monitor metrics
  GET  /docs             — Swagger UI (auto)
"""
import json
import os
import uuid
import traceback
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from typing import Optional

from ..core import config
from ..core.prometheus_metrics import get_metrics_handler
from ..core.alerting import get_failure_tracker, should_alert_on_failure
from ..core.tracing import initialize_tracing, instrument_app, create_span
from ..middleware.tracing_middleware import TracingMiddleware
from . import experiments

logger = logging.getLogger(__name__)


app = FastAPI(
    title="AutoFlow API",
    description="God Mode Super Multi-Agent Platform — Cognitive Operating System",
    version="0.1.0",
)

# Initialize tracing
try:
    initialize_tracing()
    instrument_app(app)
    logger.info("OpenTelemetry tracing initialized")
except Exception as e:
    logger.warning(f"Failed to initialize tracing: {e}")

# Add tracing middleware
app.add_middleware(
    TracingMiddleware,
    skip_paths=["/health", "/metrics", "/docs", "/openapi.json"],
)

# Include experiments router
app.include_router(experiments.router)


# In-memory job tracker (workflows are checkpointed in Postgres)
_jobs: dict = {}
_executor = ThreadPoolExecutor(max_workers=2)


# ── Request/Response Models ──

class WorkflowRequest(BaseModel):
    topic: str
    url: Optional[str] = Field("", description="Target URL for SEO machine audit")
    duration: Optional[int] = Field(60, description="Video duration in seconds")
    style: Optional[str] = Field("educational", description="Video style")
    language: Optional[str] = Field("pt-BR", description="Language code")


class WorkflowResponse(BaseModel):
    job_id: str
    workflow_type: str
    status: str
    message: str


class JobStatus(BaseModel):
    job_id: str
    workflow_type: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    result: Optional[dict] = None
    errors: Optional[list] = None


# ── Background Workflow Runner ──

def _run_workflow_bg(job_id: str, wf_type: str, topic: str, **kwargs):
    """Run workflow in background thread with tracing."""
    span_attrs = {
        "job_id": job_id,
        "workflow_type": wf_type,
        "topic": topic,
    }

    with create_span("workflow_execution", span_attrs):
        try:
        _jobs[job_id]["status"] = "running"

        if wf_type == "research":
            from ..workflows.research import run_research
            result = run_research(topic)
        elif wf_type == "seo":
            from ..workflows.seo import run_seo
            result = run_seo(topic)
        elif wf_type == "seo-machine":
            from ..workflows.seo_machine import run_seo_machine
            url = kwargs.get("url", "")
            result = run_seo_machine(topic, url=url)
        elif wf_type == "video":
            from ..workflows.video import run_video
            result = run_video(topic, **kwargs)
        else:
            raise ValueError(f"Unknown workflow: {wf_type}")

        _jobs[job_id]["status"] = result.get("status", "completed")
        _jobs[job_id]["result"] = result
        _jobs[job_id]["completed_at"] = datetime.utcnow().isoformat()

        except Exception as e:
        _jobs[job_id]["status"] = "error"
        error_msg = str(e)
        _jobs[job_id]["errors"] = [error_msg, traceback.format_exc()[-500:]]
        _jobs[job_id]["completed_at"] = datetime.utcnow().isoformat()

        # Track failure
        failure_tracker = get_failure_tracker()
        severity = "ERROR" if should_alert_on_failure(error_msg) else "WARN"
        failure_tracker.record_failure(
            job_id=job_id,
            workflow_type=wf_type,
            topic=topic,
            error=error_msg,
            severity=severity
        )


# ── Endpoints ──

@app.get("/health")
def health():
        """Health check — returns system status."""
        import psutil
        ram = psutil.virtual_memory()
        return {
        "status": "ok",
        "service": "autoflow-api",
        "version": "0.1.0",
        "ram_percent": ram.percent,
        "ram_available_gb": round(ram.available / 1e9, 2),
        "active_jobs": sum(1 for j in _jobs.values() if j["status"] == "running"),
        "total_jobs": len(_jobs),
        }


@app.post("/workflow/{wf_type}", response_model=WorkflowResponse)
def start_workflow(wf_type: str, req: WorkflowRequest):
        """Start a new workflow. Returns job ID for tracking."""
        if wf_type not in ("research", "seo", "seo-machine", "video"):
        raise HTTPException(400, f"Unknown workflow type: {wf_type}. Use: research, seo, seo-machine, video")

        job_id = str(uuid.uuid4())[:8]
        _jobs[job_id] = {
        "job_id": job_id,
        "workflow_type": wf_type,
        "topic": req.topic,
        "status": "queued",
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
        "result": None,
        "errors": None,
        }

        kwargs = {}
        if wf_type == "seo-machine":
        kwargs = {"url": req.url}
        elif wf_type == "video":
        kwargs = {"duration": req.duration, "style": req.style, "language": req.language}

        _executor.submit(_run_workflow_bg, job_id, wf_type, req.topic, **kwargs)

        return WorkflowResponse(
        job_id=job_id,
        workflow_type=wf_type,
        status="queued",
        message=f"Workflow '{wf_type}' started for topic: {req.topic}",
        )


@app.get("/workflow/{job_id}", response_model=JobStatus)
def get_workflow_status(job_id: str):
        """Get workflow status and result."""
        if job_id not in _jobs:
        raise HTTPException(404, f"Job {job_id} not found")
        return JobStatus(**_jobs[job_id])


@app.get("/workflows")
def list_workflows():
        """List all workflows."""
        return {"jobs": list(_jobs.values()), "total": len(_jobs)}


@app.get("/metrics")
def metrics():
        """Get latest resource monitor metrics."""
        try:
        with open(config.MONITOR_LOG, "r") as f:
            lines = f.readlines()
        if lines:
            return json.loads(lines[-1])
        return {"error": "No metrics yet"}
        except FileNotFoundError:
        return {"error": "Monitor log not found"}


@app.get("/api/metrics/summary")
def metrics_summary():
        """Get workflow quality metrics summary."""
        from datetime import datetime, timedelta

        summary = {
        "timestamp": datetime.utcnow().isoformat(),
        "workflows_total": 0,
        "workflows_today": 0,
        "workflows_week": 0,
        "cost_total_usd": 0.0,
        "cost_today_usd": 0.0,
        "success_rate_percent": 0.0,
        "avg_duration_seconds": 0.0,
        "models_used": {},
        "recent_workflows": [],
        }

        # Try to read task router logs
        task_log = "/var/log/autoflow-tasks.jsonl"
        if os.path.exists(task_log):
        try:
            now = datetime.utcnow()
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_ago = now - timedelta(days=7)

            calls = []
            with open(task_log, "r") as f:
                for line in f:
                    try:
                        call = json.loads(line)
                        calls.append(call)
                    except json.JSONDecodeError:
                        pass

            summary["workflows_total"] = len(calls)

            # Parse timestamps from call_number or create_at if available
            for call in calls[-20:]:  # Last 20 calls
                summary["cost_total_usd"] += call.get("cost_usd", 0)
                model = call.get("model", "unknown")
                summary["models_used"][model] = summary["models_used"].get(model, 0) + 1
                summary["recent_workflows"].append({
                    "model": model,
                    "response_chars": call.get("response_chars", 0),
                    "cost_usd": call.get("cost_usd", 0),
                })

            summary["models_used"] = dict(sorted(summary["models_used"].items(),
                                               key=lambda x: x[1], reverse=True))

        except Exception as e:
            summary["error"] = f"Failed to read task log: {e}"

        # Try to read job status from in-memory tracker
        if _jobs:
        completed = [j for j in _jobs.values() if j["status"] in ("completed", "error")]
        if completed:
            summary["success_rate_percent"] = round(
                sum(1 for j in completed if j["status"] == "completed") / len(completed) * 100, 1
            )

        return summary


@app.get("/metrics/prometheus")
def prometheus_metrics():
        """Prometheus-format metrics for Grafana scraping."""
        from fastapi.responses import PlainTextResponse
        metrics_handler = get_metrics_handler()
        return PlainTextResponse(metrics_handler.generate_prometheus_output(), media_type="text/plain")


@app.get("/api/metrics/detailed")
def detailed_metrics():
        """Detailed metrics as JSON (for dashboards)."""
        metrics_handler = get_metrics_handler()
        return metrics_handler.get_metrics_dict()


@app.get("/api/alerts/summary")
def alerts_summary():
        """Get recent failure alerts and summary."""
        failure_tracker = get_failure_tracker()
        return failure_tracker.get_failure_summary()


@app.get("/api/alerts/recent")
def recent_alerts(minutes: int = 60):
        """Get recent alerts from last N minutes."""
        failure_tracker = get_failure_tracker()
        return {
        "timestamp": datetime.utcnow().isoformat(),
        "window_minutes": minutes,
        "alerts": failure_tracker.get_recent_failures(minutes=minutes),
        }


@app.get("/", response_class=HTMLResponse)
def dashboard():
        """Simple dashboard page."""
        return """<!DOCTYPE html>
<html><head><title>AutoFlow Dashboard</title>
<style>
body{font-family:monospace;background:#1a1a2e;color:#e0e0e0;padding:20px;max-width:900px;margin:0 auto}
h1{color:#00d4ff}h2{color:#7f5af0}
.card{background:#16213e;border-radius:8px;padding:15px;margin:10px 0;border-left:3px solid #00d4ff}
.ok{color:#2ecc71}.warn{color:#f39c12}.err{color:#e74c3c}
pre{background:#0a0a1a;padding:10px;border-radius:4px;overflow-x:auto}
button{background:#7f5af0;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;margin:5px}
button:hover{background:#6c4bd1}
input{background:#0a0a1a;color:#e0e0e0;border:1px solid #333;padding:8px;border-radius:4px;width:300px}
</style></head><body>
<h1>AutoFlow Dashboard</h1>
<p>God Mode Super Multi-Agent Platform</p>
<div class="card"><h2>System Health</h2><pre id="health">Loading...</pre></div>
<div class="card"><h2>Resource Metrics</h2><pre id="metrics">Loading...</pre></div>
<div class="card"><h2>Start Workflow</h2>
<input id="topic" placeholder="Enter topic..." value="AI agents in 2026">
<select id="wftype"><option>research</option><option>seo</option><option>seo-machine</option><option>video</option></select>
<button onclick="startWF()">Start</button>
<pre id="wfresult"></pre></div>
<div class="card"><h2>Active Workflows</h2><pre id="jobs">Loading...</pre></div>
<script>
async function load(){
  try{const h=await(await fetch('/health')).json();document.getElementById('health').textContent=JSON.stringify(h,null,2)}catch(e){}
  try{const m=await(await fetch('/metrics')).json();document.getElementById('metrics').textContent=JSON.stringify(m,null,2)}catch(e){}
  try{const j=await(await fetch('/workflows')).json();document.getElementById('jobs').textContent=JSON.stringify(j,null,2)}catch(e){}
}
async function startWF(){
  const t=document.getElementById('topic').value;
  const w=document.getElementById('wftype').value;
  const r=await(await fetch('/workflow/'+w,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:t})})).json();
  document.getElementById('wfresult').textContent=JSON.stringify(r,null,2);
  setTimeout(load,3000);
}
load();setInterval(load,10000);
</script></body></html>"""


# ── Paperclip DB Integration ──

PAPERCLIP_DSN = "postgresql://autoflow:autoflow_secure_2026@localhost:5432/paperclip_restored"


def _paperclip_query(sql: str, params: tuple = ()):
        """Execute a read-only query against paperclip_restored and return rows as dicts."""
        import psycopg
        with psycopg.connect(PAPERCLIP_DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


@app.get("/paperclip/agents")
def list_paperclip_agents():
        """List all 48 agents from restored Paperclip DB."""
        try:
        rows = _paperclip_query(
            "SELECT id, name, role, title, status, adapter_type, "
            "budget_monthly_cents, spent_monthly_cents, created_at::text "
            "FROM agents ORDER BY name"
        )
        return {"agents": rows, "total": len(rows)}
        except Exception as e:
        raise HTTPException(500, f"Paperclip DB error: {e}")


@app.get("/paperclip/skills")
def list_paperclip_skills():
        """List all 130 company skills."""
        try:
        rows = _paperclip_query(
            "SELECT id, name, slug, key, description, source_type, "
            "trust_level, compatibility, created_at::text "
            "FROM company_skills ORDER BY name"
        )
        return {"skills": rows, "total": len(rows)}
        except Exception as e:
        raise HTTPException(500, f"Paperclip DB error: {e}")


@app.get("/paperclip/issues")
def list_paperclip_issues():
        """List all 194 issues with status."""
        try:
        rows = _paperclip_query(
            "SELECT i.id, i.title, i.status, i.priority, i.identifier, "
            "i.issue_number, a.name as assignee, "
            "i.created_at::text, i.completed_at::text "
            "FROM issues i "
            "LEFT JOIN agents a ON i.assignee_agent_id = a.id "
            "ORDER BY i.created_at DESC"
        )
        return {"issues": rows, "total": len(rows)}
        except Exception as e:
        raise HTTPException(500, f"Paperclip DB error: {e}")


@app.get("/paperclip/stats")
def paperclip_stats():
        """Summary stats: agents, skills, issues, runs, costs."""
        try:
        rows = _paperclip_query("""
            SELECT
                (SELECT count(*) FROM agents) as agents,
                (SELECT count(*) FROM company_skills) as skills,
                (SELECT count(*) FROM issues) as issues,
                (SELECT count(*) FROM routine_runs) as runs,
                (SELECT coalesce(sum(cost_cents), 0) FROM cost_events) as total_cost_cents,
                (SELECT count(*) FROM cost_events) as cost_events,
                (SELECT count(DISTINCT status) FROM issues) as distinct_statuses
        """)
        stats = rows[0]
        status_rows = _paperclip_query(
            "SELECT status, count(*) as count FROM issues GROUP BY status ORDER BY count DESC"
        )
        stats["issue_breakdown"] = {r["status"]: r["count"] for r in status_rows}
        return stats
        except Exception as e:
        raise HTTPException(500, f"Paperclip DB error: {e}")


def start_server():
        """Start the API server."""
        import uvicorn
        uvicorn.run(app, host=config.API_HOST, port=config.API_PORT)


if __name__ == "__main__":
        start_server()
