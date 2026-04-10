"""
AutoFlow GPU Router — VPS-side bridge to the Desktop GPU Worker.

Responsibility
--------------
Route GPU-requiring tasks (avatar, voice, matting, render, image) from the VPS
to the Desktop GPU Worker API exposed via Cloudflare Tunnel.

If the Desktop is offline, jobs are parked in a local Redis queue
(`autoflow:gpu:pending`) and retried by a background poller until the Desktop
reappears.  Callers always get a consistent interface: `submit_gpu_job()`
returns an awaitable that resolves when the artifact is on local disk.

Design goals
------------
1. Graceful degradation — Desktop offline stalls the GPU stage only, not the
   whole workflow. Other stages keep running.
2. At-least-once delivery — every job is persisted in Redis BEFORE the HTTP
   call; on crash recovery the poller re-submits.
3. Observability — every attempt writes a JSONL event to
   ``/var/log/autoflow-gpu.jsonl`` with timing, retry count, and outcome.
4. No vendor lock-in — the only thing that changes if we move from Cloudflare
   Tunnel to WireGuard is the ``GPU_WORKER_URL`` env var.

Environment variables
---------------------
GPU_WORKER_URL          Base URL of the Desktop worker (via Cloudflare Tunnel).
                        Default: https://gpu.autoflow.example.com
GPU_WORKER_TOKEN        Shared secret Bearer token. Default: "" (disabled).
GPU_WORKER_TIMEOUT      HTTP timeout seconds for submit/poll. Default: 30.
GPU_POLL_INTERVAL       Seconds between status polls. Default: 5.
GPU_MAX_WAIT_SECONDS    Hard cap on how long to wait for a job. Default: 1800.
GPU_HEALTH_CACHE_TTL    Seconds to cache /health result. Default: 10.
GPU_ARTIFACT_DIR        Where to save downloaded artifacts on VPS.
                        Default: /var/lib/autoflow/gpu_artifacts
AUTOFLOW_REDIS_URL      redis://... for pending-job queue. Default:
                        redis://localhost:6379/2

Usage
-----
    from autoflow.core.gpu_router import submit_gpu_job, GPUJobError

    artifact_path = await submit_gpu_job(
        pipeline="avatar",
        params={"script": "hello world", "voice": "pt-BR-female"},
    )
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx

log = logging.getLogger("autoflow.gpu_router")

# ─── Config ─────────────────────────────────────────────────────────────────

GPU_WORKER_URL = os.getenv("GPU_WORKER_URL", "https://gpu.autoflow.example.com").rstrip("/")
GPU_WORKER_TOKEN = os.getenv("GPU_WORKER_TOKEN", "")
GPU_WORKER_TIMEOUT = float(os.getenv("GPU_WORKER_TIMEOUT", "30"))
GPU_POLL_INTERVAL = float(os.getenv("GPU_POLL_INTERVAL", "5"))
GPU_MAX_WAIT_SECONDS = float(os.getenv("GPU_MAX_WAIT_SECONDS", "1800"))
GPU_HEALTH_CACHE_TTL = float(os.getenv("GPU_HEALTH_CACHE_TTL", "10"))
GPU_ARTIFACT_DIR = Path(os.getenv("GPU_ARTIFACT_DIR", "/var/lib/autoflow/gpu_artifacts"))
GPU_ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

REDIS_URL = os.getenv("AUTOFLOW_REDIS_URL", "redis://localhost:6379/2")
PENDING_QUEUE_KEY = "autoflow:gpu:pending"
JOB_STATE_PREFIX = "autoflow:gpu:job:"

EVENT_LOG = Path(os.getenv("GPU_EVENT_LOG", "/var/log/autoflow-gpu.jsonl"))

VALID_PIPELINES = {"avatar", "voice", "matting", "render", "image"}


# ─── Errors ─────────────────────────────────────────────────────────────────

class GPUJobError(RuntimeError):
    """Raised when a GPU job fails permanently."""


class GPUWorkerUnreachable(RuntimeError):
    """Raised when Desktop worker cannot be contacted; caller may retry later."""


# ─── Event logging ──────────────────────────────────────────────────────────

def _log_event(event: str, **fields: Any) -> None:
    """Append a JSONL event for observability."""
    record = {"ts": time.time(), "event": event, **fields}
    try:
        with EVENT_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        log.warning("failed to write gpu event log", exc_info=True)
    log.info("gpu_event %s %s", event, fields)


# ─── Health check with short-lived cache ────────────────────────────────────

@dataclass
class _HealthCache:
    ok: bool = False
    checked_at: float = 0.0
    info: dict[str, Any] | None = None


_health_cache = _HealthCache()


async def check_worker_health(force: bool = False) -> bool:
    """Ping the Desktop worker /health. Caches the result for GPU_HEALTH_CACHE_TTL."""
    now = time.time()
    if not force and (now - _health_cache.checked_at) < GPU_HEALTH_CACHE_TTL:
        return _health_cache.ok

    headers = _auth_headers()
    try:
        async with httpx.AsyncClient(timeout=GPU_WORKER_TIMEOUT) as client:
            r = await client.get(f"{GPU_WORKER_URL}/health", headers=headers)
            r.raise_for_status()
            _health_cache.ok = True
            _health_cache.info = r.json()
    except Exception as e:
        _health_cache.ok = False
        _health_cache.info = {"error": str(e)}
    _health_cache.checked_at = now
    _log_event("health_check", ok=_health_cache.ok, info=_health_cache.info)
    return _health_cache.ok


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {GPU_WORKER_TOKEN}"} if GPU_WORKER_TOKEN else {}


# ─── Redis helpers (lazy; Redis is optional for dev) ────────────────────────

_redis_client = None


def _get_redis():
    """Lazy-initialize Redis client. Returns None if unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # type: ignore
        _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        _redis_client.ping()
    except Exception as e:
        log.warning("Redis unavailable (%s). GPU jobs will not survive restarts.", e)
        _redis_client = None
    return _redis_client


def _persist_pending(local_id: str, pipeline: str, params: dict[str, Any]) -> None:
    r = _get_redis()
    if not r:
        return
    try:
        r.hset(JOB_STATE_PREFIX + local_id, mapping={
            "pipeline": pipeline,
            "params": json.dumps(params),
            "status": "pending",
            "created_at": str(time.time()),
            "retry_count": "0",
        })
        r.lpush(PENDING_QUEUE_KEY, local_id)
    except Exception:
        log.exception("failed to persist pending job %s", local_id)


def _update_state(local_id: str, **fields: Any) -> None:
    r = _get_redis()
    if not r:
        return
    try:
        r.hset(JOB_STATE_PREFIX + local_id, mapping={k: str(v) for k, v in fields.items()})
    except Exception:
        log.exception("failed to update job state %s", local_id)


def _clear_state(local_id: str) -> None:
    r = _get_redis()
    if not r:
        return
    try:
        r.delete(JOB_STATE_PREFIX + local_id)
        r.lrem(PENDING_QUEUE_KEY, 0, local_id)
    except Exception:
        log.exception("failed to clear state %s", local_id)


# ─── Core submit / poll / download ──────────────────────────────────────────

async def _http_submit(pipeline: str, params: dict[str, Any]) -> str:
    """POST the job to the Desktop worker. Returns remote job_id."""
    endpoint_map = {
        "avatar": "/api/avatar/generate",
        "voice": "/api/voice/synthesize",
        "matting": "/api/video/matting",
        "render": "/api/video/render",
        "image": "/api/image/generate",
    }
    url = GPU_WORKER_URL + endpoint_map[pipeline]
    async with httpx.AsyncClient(timeout=GPU_WORKER_TIMEOUT) as client:
        r = await client.post(url, headers=_auth_headers(), json=params)
        r.raise_for_status()
        return r.json()["job_id"]


async def _http_poll(remote_job_id: str) -> dict[str, Any]:
    url = f"{GPU_WORKER_URL}/api/jobs/{remote_job_id}"
    async with httpx.AsyncClient(timeout=GPU_WORKER_TIMEOUT) as client:
        r = await client.get(url, headers=_auth_headers())
        r.raise_for_status()
        return r.json()


async def _http_download(remote_job_id: str, dest: Path) -> None:
    url = f"{GPU_WORKER_URL}/api/jobs/{remote_job_id}/artifact"
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("GET", url, headers=_auth_headers()) as r:
            r.raise_for_status()
            with dest.open("wb") as f:
                async for chunk in r.aiter_bytes(chunk_size=1024 * 1024):
                    f.write(chunk)


async def _http_delete(remote_job_id: str) -> None:
    url = f"{GPU_WORKER_URL}/api/jobs/{remote_job_id}"
    try:
        async with httpx.AsyncClient(timeout=GPU_WORKER_TIMEOUT) as client:
            await client.delete(url, headers=_auth_headers())
    except Exception:
        log.warning("failed to cleanup remote job %s", remote_job_id)


# ─── Public API ─────────────────────────────────────────────────────────────

async def submit_gpu_job(
    pipeline: str,
    params: dict[str, Any],
    *,
    wait: bool = True,
) -> Path | str:
    """Submit a GPU job to the Desktop worker.

    If ``wait=True`` (default), blocks until the artifact is downloaded to
    ``GPU_ARTIFACT_DIR`` and returns the local Path.
    If ``wait=False``, returns the local_id (str) immediately and the job is
    persisted in Redis for a background worker to process.

    Raises GPUJobError on permanent failure. Raises GPUWorkerUnreachable if the
    Desktop is offline AND ``wait=True``; in that case the job stays queued in
    Redis and the caller may retry via ``retry_pending_jobs()``.
    """
    if pipeline not in VALID_PIPELINES:
        raise ValueError(f"Unknown GPU pipeline '{pipeline}' (valid: {VALID_PIPELINES})")

    local_id = uuid.uuid4().hex
    _persist_pending(local_id, pipeline, params)
    _log_event("job_submit", local_id=local_id, pipeline=pipeline, wait=wait)

    if not wait:
        return local_id

    # Inline path: submit + poll + download
    return await _execute(local_id, pipeline, params)


async def _execute(local_id: str, pipeline: str, params: dict[str, Any]) -> Path:
    t0 = time.time()

    # 1. Health gate
    if not await check_worker_health():
        _update_state(local_id, status="unreachable")
        _log_event("worker_unreachable", local_id=local_id)
        raise GPUWorkerUnreachable(
            f"Desktop GPU worker at {GPU_WORKER_URL} is not reachable. "
            f"Job {local_id} parked in Redis queue."
        )

    # 2. Submit
    try:
        remote_id = await _http_submit(pipeline, params)
    except Exception as e:
        _update_state(local_id, status="submit_failed", error=str(e))
        _log_event("submit_failed", local_id=local_id, error=str(e))
        raise GPUWorkerUnreachable(f"submit to {GPU_WORKER_URL} failed: {e}") from e

    _update_state(local_id, status="running", remote_id=remote_id)
    _log_event("job_running", local_id=local_id, remote_id=remote_id)

    # 3. Poll until done / failed / timeout
    deadline = t0 + GPU_MAX_WAIT_SECONDS
    last_status = None
    while time.time() < deadline:
        try:
            job = await _http_poll(remote_id)
        except Exception as e:
            log.warning("poll error for %s: %s", remote_id, e)
            await asyncio.sleep(GPU_POLL_INTERVAL)
            continue

        status = job.get("status")
        if status != last_status:
            _log_event("job_status", local_id=local_id, remote_id=remote_id, status=status)
            last_status = status

        if status == "done":
            break
        if status in ("failed", "timeout", "cancelled"):
            err = job.get("error", "unknown")
            _update_state(local_id, status=status, error=err)
            _log_event("job_failed", local_id=local_id, remote_id=remote_id, status=status, error=err)
            raise GPUJobError(f"GPU job {remote_id} {status}: {err}")

        await asyncio.sleep(GPU_POLL_INTERVAL)
    else:
        _update_state(local_id, status="vps_timeout")
        raise GPUJobError(f"GPU job {remote_id} exceeded VPS wait cap {GPU_MAX_WAIT_SECONDS}s")

    # 4. Download artifact
    ext_guess = {
        "avatar": "mp4", "voice": "wav", "matting": "mp4",
        "render": "mp4", "image": "png",
    }[pipeline]
    dest = GPU_ARTIFACT_DIR / f"{local_id}.{ext_guess}"
    try:
        await _http_download(remote_id, dest)
    except Exception as e:
        _update_state(local_id, status="download_failed", error=str(e))
        _log_event("download_failed", local_id=local_id, remote_id=remote_id, error=str(e))
        raise GPUJobError(f"download artifact failed: {e}") from e

    # 5. Cleanup remote temp + local state
    await _http_delete(remote_id)
    _clear_state(local_id)
    _log_event("job_done", local_id=local_id, remote_id=remote_id,
               artifact=str(dest), duration_s=round(time.time() - t0, 2))
    return dest


# ─── Background poller for offline Desktop recovery ─────────────────────────

async def retry_pending_jobs(max_jobs: int = 10) -> int:
    """Drain the Redis pending queue, attempting each job once.

    Intended to run on a schedule (e.g. every minute) as an asyncio task.
    Returns the number of jobs successfully completed.
    """
    r = _get_redis()
    if not r:
        return 0
    if not await check_worker_health(force=True):
        log.debug("retry_pending_jobs: worker still unreachable")
        return 0

    completed = 0
    for _ in range(max_jobs):
        local_id = r.rpop(PENDING_QUEUE_KEY)
        if not local_id:
            break
        state = r.hgetall(JOB_STATE_PREFIX + local_id)
        if not state:
            continue
        pipeline = state.get("pipeline", "")
        try:
            params = json.loads(state.get("params", "{}"))
        except json.JSONDecodeError:
            _clear_state(local_id)
            continue
        retries = int(state.get("retry_count", "0")) + 1
        _update_state(local_id, retry_count=retries)
        try:
            await _execute(local_id, pipeline, params)
            completed += 1
        except GPUWorkerUnreachable:
            # worker went away mid-drain — requeue and stop
            r.lpush(PENDING_QUEUE_KEY, local_id)
            break
        except GPUJobError as e:
            log.error("pending job %s failed permanently: %s", local_id, e)
            _update_state(local_id, status="failed_permanent", error=str(e))
    return completed
