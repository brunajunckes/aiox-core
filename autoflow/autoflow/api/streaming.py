"""Real-time data streaming via Server-Sent Events (SSE)."""
import json
import asyncio
from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import psutil
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


async def stats_stream():
    """Stream real-time system statistics."""
    try:
        while True:
            ram = psutil.virtual_memory()
            cpu = psutil.cpu_percent(interval=0.1)
            disk = psutil.disk_usage('/')

            data = {
                "timestamp": datetime.utcnow().isoformat(),
                "ram": {
                    "percent": ram.percent,
                    "available_gb": round(ram.available / 1e9, 2),
                    "used_gb": round(ram.used / 1e9, 2),
                    "total_gb": round(ram.total / 1e9, 2),
                },
                "cpu": {"percent": cpu},
                "disk": {
                    "percent": disk.percent,
                    "free_gb": round(disk.free / 1e9, 2),
                    "used_gb": round(disk.used / 1e9, 2),
                },
            }

            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"Streaming error: {e}")


async def jobs_stream():
    """Stream real-time job updates."""
    from .server import _jobs

    try:
        while True:
            data = {
                "timestamp": datetime.utcnow().isoformat(),
                "jobs": list(_jobs.values())[-10:],  # Last 10 jobs
                "stats": {
                    "total": len(_jobs),
                    "running": sum(1 for j in _jobs.values() if j["status"] == "running"),
                    "completed": sum(1 for j in _jobs.values() if j["status"] == "completed"),
                    "failed": sum(1 for j in _jobs.values() if j["status"] == "error"),
                },
            }

            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(0.5)

    except Exception as e:
        logger.error(f"Jobs streaming error: {e}")


@router.get("/stream/stats")
async def stream_stats():
    """Server-Sent Events stream for system statistics."""
    return StreamingResponse(
        stats_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/stream/jobs")
async def stream_jobs():
    """Server-Sent Events stream for job updates."""
    return StreamingResponse(
        jobs_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )
