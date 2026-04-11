"""AutoFlow GPU Worker Integration — Phase 2 Gap 2.

This package provides async HTTP client library for submitting jobs to Desktop GPU worker
via Cloudflare Tunnel. Includes health monitoring, graceful degradation, error handling,
and metrics collection.

Modules:
    - gpu_worker_client: Main async HTTP client (5 GPU task endpoints)
    - health_monitor: Desktop uptime tracking and health checks
    - error_handler: Error classification and retry logic
    - metrics: Metrics collection and aggregation
    - models: Pydantic request/response schemas

Usage:
    from autoflow.gpu import GpuWorkerClient

    client = GpuWorkerClient(
        base_url="https://desktop.autoflow.internal",
        api_token=os.getenv("GPU_WORKER_TOKEN")
    )

    await client.start()

    # Submit avatar generation job
    response = await client.generate_avatar(
        script_text="Welcome to Igreja nas Casas...",
        avatar_model="default"
    )
    print(f"Job {response.job_id} queued")

    # Check status
    status = await client.get_job_status(response.job_id)
    print(f"Status: {status.status}, Progress: {status.progress_percent}%")

    await client.stop()
"""

from .gpu_worker_client import GpuWorkerClient
from .health_monitor import HealthMonitor
from .models import (
    AvatarGenerateRequest,
    VoiceSynthesisRequest,
    MattingVideoRequest,
    ImageGenerateRequest,
    RenderVideoRequest,
    GpuJobResponse,
    JobStatusResponse,
    HealthCheckResponse,
)

__all__ = [
    "GpuWorkerClient",
    "HealthMonitor",
    "AvatarGenerateRequest",
    "VoiceSynthesisRequest",
    "MattingVideoRequest",
    "ImageGenerateRequest",
    "RenderVideoRequest",
    "GpuJobResponse",
    "JobStatusResponse",
    "HealthCheckResponse",
]
