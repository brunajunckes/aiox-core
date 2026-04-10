"""
AutoFlow Desktop GPU Worker API
================================

FastAPI service that exposes local GPU-dependent pipelines to the AutoFlow VPS.

Runs on: Windows Desktop (the machine with the NVIDIA GPU + Ollama + heavy models)
Exposed on: 0.0.0.0:8500
Public access: Cloudflare Tunnel (preferred) or WireGuard (fallback)

Endpoints
---------
GET  /health                     - Liveness probe
GET  /status                     - Current GPU job + queue depth + VRAM
POST /api/avatar/generate        - Duix-Avatar (script -> avatar video)
POST /api/voice/synthesize       - VibeVoice (text -> audio)
POST /api/video/matting          - RobustVideoMatting (video -> matte + alpha)
POST /api/video/render           - Pixelle-Video (segments -> final video)
POST /api/image/generate         - imaginAIry (prompt -> image)
GET  /api/jobs/{job_id}          - Job status / progress
GET  /api/jobs/{job_id}/artifact - Download produced artifact (streaming)
DELETE /api/jobs/{job_id}        - Cleanup temp files after VPS pulled artifact

Job Lifecycle
-------------
1. VPS POSTs a job request -> Desktop returns {job_id, status: "queued"}
2. Worker picks up the job from an in-process FIFO queue (one GPU job at a time)
3. VPS polls GET /api/jobs/{job_id} or subscribes to webhook_url in payload
4. When status == "done", VPS calls GET /api/jobs/{job_id}/artifact to stream file
5. VPS calls DELETE /api/jobs/{job_id} to clean up temp files

Deployment
----------
Run on Windows Desktop:
    python gpu_worker_api.py
Or via the scripts/start_gpu_worker.bat helper.

Dependencies (install once on Desktop):
    pip install fastapi uvicorn[standard] pydantic python-multipart

Each pipeline (duix, vibevoice, rvm, pixelle, imaginairy) is invoked as a
subprocess. Adapt the COMMAND templates in PIPELINE_CONFIG to match your actual
installation paths on the Desktop.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

API_HOST = os.getenv("GPU_WORKER_HOST", "0.0.0.0")
API_PORT = int(os.getenv("GPU_WORKER_PORT", "8500"))
API_TOKEN = os.getenv("GPU_WORKER_TOKEN", "")  # shared secret w/ VPS, empty = open

# Where to store inputs + outputs on Desktop. Use a fast local SSD path.
WORK_ROOT = Path(os.getenv("GPU_WORKER_WORKDIR", r"C:\autoflow\gpu_jobs"))
WORK_ROOT.mkdir(parents=True, exist_ok=True)

# Single-slot GPU queue (process one job at a time to avoid VRAM thrash).
MAX_CONCURRENT_GPU_JOBS = int(os.getenv("GPU_WORKER_CONCURRENCY", "1"))

# Max wall-clock per job (seconds). Safety net against hung subprocesses.
JOB_TIMEOUT_SECONDS = int(os.getenv("GPU_WORKER_TIMEOUT", "1800"))  # 30 min

# Logging
LOG_FILE = Path(os.getenv("GPU_WORKER_LOG", str(WORK_ROOT / "gpu_worker.log")))
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"), logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("gpu_worker")


# Pipeline invocation templates. Edit these to match actual Desktop installs.
# Each template receives: workdir (str), input_file (str), output_file (str), plus a
# dict of pipeline-specific params via **params.
PIPELINE_CONFIG: dict[str, dict[str, Any]] = {
    "avatar": {
        # Duix-Avatar
        "output_ext": "mp4",
        "command": [
            "python", r"C:\autoflow\pipelines\duix-avatar\run.py",
            "--script", "{input_file}",
            "--output", "{output_file}",
            "--voice", "{voice}",
            "--style", "{style}",
        ],
    },
    "voice": {
        # VibeVoice
        "output_ext": "wav",
        "command": [
            "python", r"C:\autoflow\pipelines\vibevoice\synthesize.py",
            "--text", "{input_file}",
            "--output", "{output_file}",
            "--voice", "{voice}",
        ],
    },
    "matting": {
        # RobustVideoMatting
        "output_ext": "mp4",
        "command": [
            "python", r"C:\autoflow\pipelines\RobustVideoMatting\inference.py",
            "--input-source", "{input_file}",
            "--output-composition", "{output_file}",
            "--output-alpha", "{output_file}.alpha.mp4",
            "--model", "mobilenetv3",
        ],
    },
    "render": {
        # Pixelle-Video
        "output_ext": "mp4",
        "command": [
            "python", r"C:\autoflow\pipelines\pixelle-video\render.py",
            "--segments", "{input_file}",
            "--output", "{output_file}",
        ],
    },
    "image": {
        # imaginAIry
        "output_ext": "png",
        "command": [
            "imagine",
            "--outdir", "{workdir}",
            "--steps", "30",
            "{prompt}",
        ],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Job state
# ─────────────────────────────────────────────────────────────────────────────

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


@dataclass
class Job:
    id: str
    pipeline: str
    params: dict[str, Any]
    status: JobStatus = JobStatus.QUEUED
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    workdir: Optional[str] = None
    input_file: Optional[str] = None
    output_file: Optional[str] = None
    extra_outputs: list[str] = field(default_factory=list)
    error: Optional[str] = None
    returncode: Optional[int] = None
    webhook_url: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        return d


JOBS: dict[str, Job] = {}
JOB_QUEUE: asyncio.Queue[str] = asyncio.Queue()
WORKER_TASKS: list[asyncio.Task] = []


# ─────────────────────────────────────────────────────────────────────────────
# Request schemas
# ─────────────────────────────────────────────────────────────────────────────

class AvatarRequest(BaseModel):
    script: str = Field(min_length=1, description="The narration script text")
    voice: str = Field(default="pt-BR-female")
    style: str = Field(default="realistic")
    webhook_url: Optional[str] = None


class VoiceRequest(BaseModel):
    text: str = Field(min_length=1)
    voice: str = Field(default="pt-BR-female")
    webhook_url: Optional[str] = None


class MattingRequest(BaseModel):
    video_url: str = Field(description="HTTP(S) URL the worker can download the input from")
    webhook_url: Optional[str] = None


class RenderRequest(BaseModel):
    segments: list[dict[str, Any]] = Field(min_length=1)
    webhook_url: Optional[str] = None


class ImageRequest(BaseModel):
    prompt: str = Field(min_length=1)
    webhook_url: Optional[str] = None


class JobAccepted(BaseModel):
    job_id: str
    status: str
    pipeline: str
    queue_depth: int


# ─────────────────────────────────────────────────────────────────────────────
# Auth middleware (optional shared token)
# ─────────────────────────────────────────────────────────────────────────────

async def check_auth(authorization: Optional[str]) -> None:
    if not API_TOKEN:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if authorization.split(" ", 1)[1] != API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")


# ─────────────────────────────────────────────────────────────────────────────
# Worker loop — consumes JOB_QUEUE sequentially
# ─────────────────────────────────────────────────────────────────────────────

async def run_pipeline(job: Job) -> None:
    """Execute the subprocess for the given job, stream logs, update state."""
    cfg = PIPELINE_CONFIG.get(job.pipeline)
    if not cfg:
        job.status = JobStatus.FAILED
        job.error = f"Unknown pipeline: {job.pipeline}"
        return

    workdir = WORK_ROOT / job.id
    workdir.mkdir(parents=True, exist_ok=True)
    job.workdir = str(workdir)

    # Materialize the input payload to a file (most pipelines want a file path).
    input_file = workdir / "input.json"
    input_file.write_text(json.dumps(job.params, ensure_ascii=False), encoding="utf-8")
    job.input_file = str(input_file)

    output_file = workdir / f"output.{cfg['output_ext']}"
    job.output_file = str(output_file)

    # Render the command template.
    ctx = {
        "workdir": str(workdir),
        "input_file": str(input_file),
        "output_file": str(output_file),
        **job.params,
    }
    try:
        cmd = [part.format(**ctx) for part in cfg["command"]]
    except KeyError as e:
        job.status = JobStatus.FAILED
        job.error = f"Missing pipeline param: {e}"
        return

    log.info("[%s] starting pipeline=%s cmd=%s", job.id, job.pipeline, " ".join(cmd))
    job.status = JobStatus.RUNNING
    job.started_at = time.time()

    stdout_log = workdir / "stdout.log"
    stderr_log = workdir / "stderr.log"

    try:
        with stdout_log.open("wb") as out_f, stderr_log.open("wb") as err_f:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=out_f, stderr=err_f, cwd=str(workdir)
            )
            try:
                job.returncode = await asyncio.wait_for(proc.wait(), timeout=JOB_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                job.status = JobStatus.TIMEOUT
                job.error = f"Pipeline exceeded {JOB_TIMEOUT_SECONDS}s timeout"
                log.error("[%s] TIMEOUT", job.id)
                return

        if job.returncode != 0:
            job.status = JobStatus.FAILED
            tail = stderr_log.read_bytes()[-2000:].decode("utf-8", errors="replace")
            job.error = f"rc={job.returncode} stderr_tail={tail}"
            log.error("[%s] FAILED rc=%s", job.id, job.returncode)
            return

        if not Path(output_file).exists():
            job.status = JobStatus.FAILED
            job.error = f"Pipeline exited 0 but output file missing: {output_file}"
            log.error("[%s] MISSING OUTPUT", job.id)
            return

        # Collect extra outputs (e.g. RVM alpha track)
        extra = list(workdir.glob(f"output.{cfg['output_ext']}.*"))
        job.extra_outputs = [str(p) for p in extra]

        job.status = JobStatus.DONE
        log.info("[%s] DONE output=%s", job.id, output_file)

    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = f"{type(e).__name__}: {e}"
        log.exception("[%s] unhandled exception", job.id)

    finally:
        job.finished_at = time.time()
        # Fire webhook if configured
        if job.webhook_url:
            await _fire_webhook(job)


async def _fire_webhook(job: Job) -> None:
    """Notify VPS that the job finished. Best-effort; errors are swallowed."""
    try:
        import httpx  # local import keeps startup fast if not installed
        async with httpx.AsyncClient(timeout=15.0) as client:
            await client.post(job.webhook_url, json=job.to_dict())
    except Exception as e:
        log.warning("[%s] webhook failed: %s", job.id, e)


async def worker_loop(worker_id: int) -> None:
    log.info("worker-%d started", worker_id)
    while True:
        job_id = await JOB_QUEUE.get()
        job = JOBS.get(job_id)
        if not job:
            JOB_QUEUE.task_done()
            continue
        try:
            await run_pipeline(job)
        finally:
            JOB_QUEUE.task_done()


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="AutoFlow GPU Worker", version="1.0.0")


@app.on_event("startup")
async def _startup() -> None:
    for i in range(MAX_CONCURRENT_GPU_JOBS):
        WORKER_TASKS.append(asyncio.create_task(worker_loop(i)))
    log.info("GPU worker started on %s:%d workdir=%s", API_HOST, API_PORT, WORK_ROOT)


@app.on_event("shutdown")
async def _shutdown() -> None:
    for t in WORKER_TASKS:
        t.cancel()


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "workdir": str(WORK_ROOT),
        "pipelines": list(PIPELINE_CONFIG.keys()),
        "queue_depth": JOB_QUEUE.qsize(),
        "jobs_total": len(JOBS),
    }


@app.get("/status")
async def status() -> dict[str, Any]:
    running = [j.to_dict() for j in JOBS.values() if j.status == JobStatus.RUNNING]
    queued = [j.to_dict() for j in JOBS.values() if j.status == JobStatus.QUEUED]
    gpu_info = _nvidia_smi_snapshot()
    return {
        "running": running,
        "queued_count": len(queued),
        "queue_depth": JOB_QUEUE.qsize(),
        "gpu": gpu_info,
    }


def _nvidia_smi_snapshot() -> dict[str, Any]:
    """Best-effort VRAM snapshot. Returns {} if nvidia-smi unavailable."""
    if not shutil.which("nvidia-smi"):
        return {}
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.used,memory.total,utilization.gpu",
             "--format=csv,noheader,nounits"],
            text=True, timeout=3,
        ).strip()
        name, used, total, util = [p.strip() for p in out.splitlines()[0].split(",")]
        return {"name": name, "vram_used_mb": int(used), "vram_total_mb": int(total),
                "util_percent": int(util)}
    except Exception:
        return {}


def _enqueue(pipeline: str, params: dict[str, Any], webhook_url: Optional[str]) -> JobAccepted:
    job = Job(id=uuid.uuid4().hex, pipeline=pipeline, params=params, webhook_url=webhook_url)
    JOBS[job.id] = job
    JOB_QUEUE.put_nowait(job.id)
    log.info("[%s] queued pipeline=%s", job.id, pipeline)
    return JobAccepted(job_id=job.id, status=job.status.value, pipeline=pipeline,
                       queue_depth=JOB_QUEUE.qsize())


@app.post("/api/avatar/generate", response_model=JobAccepted)
async def avatar_generate(req: AvatarRequest) -> JobAccepted:
    return _enqueue("avatar", req.model_dump(exclude={"webhook_url"}), req.webhook_url)


@app.post("/api/voice/synthesize", response_model=JobAccepted)
async def voice_synthesize(req: VoiceRequest) -> JobAccepted:
    return _enqueue("voice", req.model_dump(exclude={"webhook_url"}), req.webhook_url)


@app.post("/api/video/matting", response_model=JobAccepted)
async def video_matting(req: MattingRequest) -> JobAccepted:
    return _enqueue("matting", req.model_dump(exclude={"webhook_url"}), req.webhook_url)


@app.post("/api/video/render", response_model=JobAccepted)
async def video_render(req: RenderRequest) -> JobAccepted:
    return _enqueue("render", req.model_dump(exclude={"webhook_url"}), req.webhook_url)


@app.post("/api/image/generate", response_model=JobAccepted)
async def image_generate(req: ImageRequest) -> JobAccepted:
    return _enqueue("image", req.model_dump(exclude={"webhook_url"}), req.webhook_url)


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return job.to_dict()


@app.get("/api/jobs/{job_id}/artifact")
async def get_artifact(job_id: str) -> FileResponse:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status != JobStatus.DONE:
        raise HTTPException(status_code=409, detail=f"job not done (status={job.status.value})")
    if not job.output_file or not Path(job.output_file).exists():
        raise HTTPException(status_code=410, detail="artifact missing on disk")
    return FileResponse(job.output_file, filename=Path(job.output_file).name)


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str) -> dict[str, str]:
    job = JOBS.pop(job_id, None)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.workdir and Path(job.workdir).exists():
        shutil.rmtree(job.workdir, ignore_errors=True)
    return {"status": "deleted", "job_id": job_id}


# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "gpu_worker_api:app",
        host=API_HOST,
        port=API_PORT,
        log_level="info",
        reload=False,
    )
