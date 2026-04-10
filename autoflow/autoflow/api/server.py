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
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from typing import Optional

from ..core import config

app = FastAPI(
    title="AutoFlow API",
    description="God Mode Super Multi-Agent Platform — Cognitive Operating System",
    version="0.1.0",
)

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
    """Run workflow in background thread."""
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
        _jobs[job_id]["errors"] = [str(e), traceback.format_exc()[-500:]]
        _jobs[job_id]["completed_at"] = datetime.utcnow().isoformat()


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
