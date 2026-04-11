"""AutoFlow Real-Time WebSocket Server — Live data streaming."""
import json
import asyncio
from datetime import datetime
from fastapi import WebSocket, APIRouter
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Store connected clients
connected_clients = set()


@router.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket):
    """WebSocket endpoint for real-time system statistics."""
    await websocket.accept()
    connected_clients.add(websocket)

    try:
        while True:
            # Collect real-time data
            data = {
                "timestamp": datetime.utcnow().isoformat(),
                "status": "connected",
                "type": "stats"
            }

            # Send to client
            await websocket.send_json(data)

            # Wait for next update
            await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        connected_clients.discard(websocket)


@router.websocket("/ws/jobs")
async def websocket_jobs(websocket: WebSocket):
    """WebSocket endpoint for real-time job updates."""
    await websocket.accept()
    connected_clients.add(websocket)

    try:
        while True:
            # Get current jobs
            from .server import _jobs

            data = {
                "timestamp": datetime.utcnow().isoformat(),
                "jobs": list(_jobs.values()),
                "total": len(_jobs),
                "running": sum(1 for j in _jobs.values() if j["status"] == "running"),
                "completed": sum(1 for j in _jobs.values() if j["status"] == "completed"),
                "failed": sum(1 for j in _jobs.values() if j["status"] == "error"),
            }

            await websocket.send_json(data)
            await asyncio.sleep(0.5)

    except Exception as e:
        logger.error(f"WebSocket jobs error: {e}")
    finally:
        connected_clients.discard(websocket)


async def broadcast_update(message: dict):
    """Broadcast update to all connected clients."""
    disconnected = set()

    for client in connected_clients:
        try:
            await client.send_json(message)
        except Exception:
            disconnected.add(client)

    connected_clients.difference_update(disconnected)
