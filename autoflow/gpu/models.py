"""Pydantic request/response models for GPU Worker API.

Defines request/response schemas for all 5 GPU task types and health checks.
Provides validation and serialization for HTTP communication.
"""

from typing import Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Request Models
# ─────────────────────────────────────────────────────────────────────────────


class AvatarGenerateRequest(BaseModel):
    """Request to generate avatar video from script."""

    script_text: str = Field(
        ..., description="Script text for avatar to recite", min_length=1, max_length=5000
    )
    avatar_model: str = Field(default="default", description="Avatar model name")
    webhook_url: Optional[str] = Field(
        None, description="Webhook URL for completion notification"
    )

    class Config:
        schema_extra = {
            "example": {
                "script_text": "Welcome to Igreja nas Casas!",
                "avatar_model": "default",
                "webhook_url": "https://autoflow.ampcast.site/api/webhooks/gpu",
            }
        }


class VoiceSynthesisRequest(BaseModel):
    """Request to synthesize voice audio."""

    text: str = Field(
        ..., description="Text to synthesize into speech", min_length=1, max_length=10000
    )
    voice_id: str = Field(default="default", description="Voice ID to use")
    language: str = Field(default="en", description="Language code (en, pt, es, etc.)")
    webhook_url: Optional[str] = Field(
        None, description="Webhook URL for completion notification"
    )

    class Config:
        schema_extra = {
            "example": {
                "text": "Hello, welcome to Igreja nas Casas",
                "voice_id": "default",
                "language": "pt",
                "webhook_url": "https://autoflow.ampcast.site/api/webhooks/gpu",
            }
        }


class MattingVideoRequest(BaseModel):
    """Request to extract alpha matte from video."""

    video_path: str = Field(
        ..., description="Path to input video file on Desktop", min_length=1
    )
    model: str = Field(
        default="robust_video_matting", description="Video matting model to use"
    )
    webhook_url: Optional[str] = Field(
        None, description="Webhook URL for completion notification"
    )

    class Config:
        schema_extra = {
            "example": {
                "video_path": "C:\\autoflow\\gpu_jobs\\input.mp4",
                "model": "robust_video_matting",
                "webhook_url": "https://autoflow.ampcast.site/api/webhooks/gpu",
            }
        }


class ImageGenerateRequest(BaseModel):
    """Request to generate image from text prompt."""

    prompt: str = Field(
        ...,
        description="Text prompt describing image to generate",
        min_length=1,
        max_length=1000,
    )
    negative_prompt: str = Field(
        default="", description="Negative prompt (what not to generate)"
    )
    model: str = Field(default="imaginairy", description="Image generation model to use")
    webhook_url: Optional[str] = Field(
        None, description="Webhook URL for completion notification"
    )

    class Config:
        schema_extra = {
            "example": {
                "prompt": "A beautiful church interior with stained glass windows",
                "negative_prompt": "blurry, low quality",
                "model": "imaginairy",
                "webhook_url": "https://autoflow.ampcast.site/api/webhooks/gpu",
            }
        }


class RenderVideoRequest(BaseModel):
    """Request to render final video (matte + audio)."""

    matte_path: str = Field(
        ..., description="Path to alpha matte video on Desktop", min_length=1
    )
    audio_path: str = Field(
        ..., description="Path to audio file on Desktop", min_length=1
    )
    output_format: str = Field(default="mp4", description="Output video format (mp4, webm, etc.)")
    webhook_url: Optional[str] = Field(
        None, description="Webhook URL for completion notification"
    )

    class Config:
        schema_extra = {
            "example": {
                "matte_path": "C:\\autoflow\\gpu_jobs\\matte.mp4",
                "audio_path": "C:\\autoflow\\gpu_jobs\\audio.wav",
                "output_format": "mp4",
                "webhook_url": "https://autoflow.ampcast.site/api/webhooks/gpu",
            }
        }


# ─────────────────────────────────────────────────────────────────────────────
# Response Models
# ─────────────────────────────────────────────────────────────────────────────


class GpuJobResponse(BaseModel):
    """Response after submitting a GPU job."""

    job_id: str = Field(
        ..., description="Unique job identifier (UUID)", min_length=1, max_length=100
    )
    status: str = Field(
        ..., description="Job status: queued, processing, done, error", min_length=1
    )
    message: Optional[str] = Field(None, description="Optional status message or error description")

    class Config:
        schema_extra = {
            "example": {
                "job_id": "abc123def456",
                "status": "queued",
                "message": None,
            }
        }


class JobStatusResponse(BaseModel):
    """Response from polling job status."""

    job_id: str = Field(..., description="Job UUID")
    status: str = Field(..., description="Job status: queued, processing, done, error")
    progress_percent: int = Field(
        default=0, description="Progress 0-100", ge=0, le=100
    )
    artifact_url: Optional[str] = Field(
        None, description="URL to download artifact (when done)"
    )
    error: Optional[str] = Field(None, description="Error message if status==error")

    class Config:
        schema_extra = {
            "example": {
                "job_id": "abc123def456",
                "status": "processing",
                "progress_percent": 45,
                "artifact_url": None,
                "error": None,
            }
        }


class HealthCheckResponse(BaseModel):
    """Response from Desktop health check endpoint."""

    status: str = Field(..., description="Health status: healthy, degraded, offline")
    gpu_memory_free_mb: int = Field(..., description="Free GPU memory in MB")
    queue_depth: int = Field(default=0, description="Number of pending jobs in queue")
    uptime_seconds: int = Field(default=0, description="Worker uptime in seconds")

    class Config:
        schema_extra = {
            "example": {
                "status": "healthy",
                "gpu_memory_free_mb": 8192,
                "queue_depth": 1,
                "uptime_seconds": 86400,
            }
        }


# ─────────────────────────────────────────────────────────────────────────────
# Metrics Models
# ─────────────────────────────────────────────────────────────────────────────


class GpuJobMetric(BaseModel):
    """Metric recorded after GPU job completion."""

    job_id: str = Field(..., description="Job UUID")
    task_type: str = Field(
        ...,
        description="Task type: avatar, voice, matting, image, rendering",
    )
    status: str = Field(
        ..., description="Outcome: success, failed, timeout"
    )
    latency_ms: int = Field(..., description="Job duration in milliseconds")
    retry_count: int = Field(default=0, description="Number of retries before success")
    cost_usd: float = Field(..., description="Cost in USD")
    desktop_uptime_percent: float = Field(
        ..., description="Desktop uptime % at time of job", ge=0, le=100
    )

    class Config:
        schema_extra = {
            "example": {
                "job_id": "abc123def456",
                "task_type": "avatar",
                "status": "success",
                "latency_ms": 95000,
                "retry_count": 0,
                "cost_usd": 0.50,
                "desktop_uptime_percent": 99.8,
            }
        }


class MetricsAggregation(BaseModel):
    """Aggregated metrics response."""

    avatar: Optional[dict] = Field(
        None,
        description="Avatar metrics (count, success_rate, avg_latency_ms)",
    )
    voice: Optional[dict] = Field(
        None,
        description="Voice metrics (count, success_rate, avg_latency_ms)",
    )
    matting: Optional[dict] = Field(
        None,
        description="Matting metrics (count, success_rate, avg_latency_ms)",
    )
    image: Optional[dict] = Field(
        None,
        description="Image metrics (count, success_rate, avg_latency_ms)",
    )
    rendering: Optional[dict] = Field(
        None,
        description="Rendering metrics (count, success_rate, avg_latency_ms)",
    )
    desktop_uptime_24h: float = Field(
        ..., description="Desktop uptime % over 24 hours", ge=0, le=100
    )

    class Config:
        schema_extra = {
            "example": {
                "avatar": {
                    "count": 145,
                    "success_rate": 98.6,
                    "avg_latency_ms": 95000,
                },
                "voice": {
                    "count": 3200,
                    "success_rate": 99.2,
                    "avg_latency_ms": 8500,
                },
                "desktop_uptime_24h": 99.8,
            }
        }
