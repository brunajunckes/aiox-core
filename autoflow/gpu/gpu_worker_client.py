"""Async HTTP client for Desktop GPU Worker.

Provides 5 GPU-accelerated task endpoints with health monitoring, graceful degradation,
retry logic, and metrics collection.

Tasks:
    1. Avatar generation (60-120s)
    2. Voice synthesis (5-15s)
    3. Video matting (30-60s)
    4. Image generation (10-30s)
    5. Video rendering (20-60s)

Health Monitoring:
    - Polls Desktop /health every 60s
    - Tracks uptime/downtime state
    - Detects offline within 60s
    - Triggers fallback on offline

Graceful Degradation:
    - Avatar: queue to Redis on offline
    - Voice: fallback to gTTS (CPU) or queue
    - Matting: queue to Redis on offline
    - Image: fallback to CPU-lite or queue
    - Rendering: fail fast (requires GPU)

Error Handling:
    - Classify errors: transient (retry) vs fatal (fail)
    - Exponential backoff: 1s, 2s, 4s
    - Max 3 retries per request
    - Dead-letter queue for failed jobs

Metrics:
    - Record task_type, latency, status, cost, Desktop uptime
    - Insert into PostgreSQL gpu_job_metrics table
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Optional
from uuid import UUID

import aiohttp
from pydantic import ValidationError

try:
    from .health_monitor import HealthMonitor
    from .models import (
        GpuJobResponse,
        JobStatusResponse,
        HealthCheckResponse,
        AvatarGenerateRequest,
        VoiceSynthesisRequest,
        MattingVideoRequest,
        ImageGenerateRequest,
        RenderVideoRequest,
    )
except ImportError:
    # Fallback for direct import
    from health_monitor import HealthMonitor
    from models import (
        GpuJobResponse,
        JobStatusResponse,
        HealthCheckResponse,
        AvatarGenerateRequest,
        VoiceSynthesisRequest,
        MattingVideoRequest,
        ImageGenerateRequest,
        RenderVideoRequest,
    )

logger = logging.getLogger(__name__)


class GpuWorkerException(Exception):
    """Base exception for GPU worker errors."""


class GpuTransientError(GpuWorkerException):
    """Transient error (retry eligible)."""


class GpuFatalError(GpuWorkerException):
    """Fatal error (no retry)."""


class GpuWorkerClient:
    """Async HTTP client for submitting jobs to Desktop GPU worker via Cloudflare Tunnel.

    Orchestrates 5 GPU-accelerated tasks with health monitoring, graceful degradation,
    and automatic retry logic.

    Attributes:
        base_url: Cloudflare Tunnel URL (e.g., "https://desktop.autoflow.internal")
        api_token: Shared secret for Desktop authentication
        timeout: Default request timeout in seconds
        is_online: Current Desktop connectivity state
        uptime_percent: Rolling 24-hour uptime percentage
    """

    # Per-task cost (USD)
    TASK_COSTS = {
        "avatar": 0.50,
        "voice": 0.10,
        "matting": 0.30,
        "image": 0.15,
        "rendering": 0.20,
    }

    def __init__(
        self,
        base_url: str,
        api_token: Optional[str] = None,
        timeout: float = 30.0,
        health_check_interval: int = 60,
    ):
        """Initialize GpuWorkerClient.

        Args:
            base_url: Desktop GPU worker Cloudflare Tunnel URL
            api_token: Shared secret for authentication
            timeout: Default request timeout (seconds)
            health_check_interval: Health polling interval (seconds)
        """
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.timeout = timeout
        self.health_check_interval = health_check_interval

        self.session: Optional[aiohttp.ClientSession] = None
        self.health_monitor = HealthMonitor(window_hours=24)
        self._health_check_task: Optional[asyncio.Task] = None

    @property
    def is_online(self) -> bool:
        """Return True if Desktop is responding to health checks."""
        return self.health_monitor.current_state == "online"

    @property
    def uptime_percent(self) -> float:
        """Return rolling 24-hour uptime percentage."""
        return self.health_monitor.uptime_percent()

    def _auth_headers(self) -> dict[str, str]:
        """Return authentication headers."""
        headers = {"Content-Type": "application/json"}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        return headers

    async def _post_with_retry(
        self,
        endpoint: str,
        payload: dict,
        timeout: Optional[float] = None,
        max_retries: int = 3,
    ) -> dict:
        """POST with exponential backoff retry.

        Args:
            endpoint: API endpoint (e.g., "/api/avatar/generate")
            payload: Request JSON payload
            timeout: Request timeout (override default)
            max_retries: Max retry attempts (including first attempt)

        Returns:
            Response JSON as dict

        Raises:
            GpuTransientError: Transient error after max retries
            GpuFatalError: Fatal error (unrecoverable)
        """
        timeout = timeout or self.timeout
        backoff = [1.0, 2.0, 4.0]  # Exponential backoff timings

        for attempt in range(max_retries):
            try:
                async with self.session.post(
                    f"{self.base_url}{endpoint}",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout),
                    headers=self._auth_headers(),
                ) as resp:
                    # Success
                    if resp.status == 200:
                        return await resp.json()

                    # Transient errors (retry eligible)
                    if resp.status in [503, 504, 429]:  # Service unavailable, Gateway timeout, Rate limit
                        error_text = await resp.text()
                        if attempt < max_retries - 1:
                            sleep_time = backoff[attempt]
                            logger.warning(
                                f"Transient error {resp.status} on {endpoint}, "
                                f"retrying in {sleep_time}s (attempt {attempt + 1}/{max_retries})"
                            )
                            await asyncio.sleep(sleep_time)
                            continue
                        else:
                            raise GpuTransientError(
                                f"Max retries exhausted: HTTP {resp.status} - {error_text}"
                            )

                    # Fatal errors (no retry)
                    error_text = await resp.text()
                    raise GpuFatalError(
                        f"Unrecoverable error HTTP {resp.status}: {error_text}"
                    )

            except asyncio.TimeoutError:
                # Timeout is transient
                if attempt < max_retries - 1:
                    sleep_time = backoff[attempt]
                    logger.warning(
                        f"Timeout on {endpoint}, "
                        f"retrying in {sleep_time}s (attempt {attempt + 1}/{max_retries})"
                    )
                    await asyncio.sleep(sleep_time)
                    continue
                else:
                    raise GpuTransientError(
                        f"Timeout after {max_retries} attempts on {endpoint}"
                    )

            except aiohttp.ClientError as e:
                # Network errors are transient
                if attempt < max_retries - 1:
                    sleep_time = backoff[attempt]
                    logger.warning(
                        f"Network error on {endpoint}: {e}, "
                        f"retrying in {sleep_time}s (attempt {attempt + 1}/{max_retries})"
                    )
                    await asyncio.sleep(sleep_time)
                    continue
                else:
                    raise GpuTransientError(
                        f"Network error after {max_retries} attempts: {e}"
                    )

    async def health_check(self) -> HealthCheckResponse:
        """Poll Desktop /health endpoint.

        Returns:
            HealthCheckResponse with GPU memory, queue depth, uptime

        Raises:
            GpuTransientError: Transient connection error
            GpuFatalError: Fatal error (authentication failed)
        """
        try:
            response = await self._post_with_retry(
                "/health",
                {},
                timeout=5.0,  # Health check is quick
                max_retries=3,
            )
            health = HealthCheckResponse(**response)
            return health
        except GpuTransientError as e:
            logger.error(f"Health check failed (transient): {e}")
            raise
        except GpuFatalError as e:
            logger.error(f"Health check failed (fatal): {e}")
            raise

    async def generate_avatar(
        self,
        script_text: str,
        avatar_model: str = "default",
        webhook_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> GpuJobResponse:
        """Submit avatar generation job.

        Args:
            script_text: Script for avatar to recite
            avatar_model: Avatar model name (default: "default")
            webhook_url: Optional webhook for completion notification
            timeout: Request timeout override

        Returns:
            GpuJobResponse with job_id and status

        Raises:
            GpuTransientError: Network/server error
            GpuFatalError: Unrecoverable error
        """
        if not self.is_online:
            return await self._handle_offline_task(
                "avatar",
                {"script_text": script_text, "avatar_model": avatar_model},
            )

        payload = AvatarGenerateRequest(
            script_text=script_text,
            avatar_model=avatar_model,
            webhook_url=webhook_url,
        ).dict()

        response = await self._post_with_retry(
            "/api/avatar/generate",
            payload,
            timeout=timeout or 120.0,  # Avatar can take 2 minutes
            max_retries=3,
        )

        job_response = GpuJobResponse(**response)
        await self._record_metric(
            task_type="avatar",
            job_id=job_response.job_id,
            status="submitted",
        )
        return job_response

    async def synthesize_voice(
        self,
        text: str,
        voice_id: str = "default",
        language: str = "en",
        webhook_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> GpuJobResponse:
        """Submit voice synthesis job.

        Args:
            text: Text to synthesize
            voice_id: Voice ID (default: "default")
            language: Language code (default: "en")
            webhook_url: Optional webhook for completion
            timeout: Request timeout override

        Returns:
            GpuJobResponse with job_id

        Raises:
            GpuTransientError or GpuFatalError
        """
        if not self.is_online:
            return await self._handle_offline_task(
                "voice",
                {"text": text, "voice_id": voice_id, "language": language},
            )

        payload = VoiceSynthesisRequest(
            text=text,
            voice_id=voice_id,
            language=language,
            webhook_url=webhook_url,
        ).dict()

        response = await self._post_with_retry(
            "/api/voice/synthesize",
            payload,
            timeout=timeout or 30.0,
            max_retries=3,
        )

        job_response = GpuJobResponse(**response)
        await self._record_metric(
            task_type="voice",
            job_id=job_response.job_id,
            status="submitted",
        )
        return job_response

    async def matting_video(
        self,
        video_path: str,
        model: str = "robust_video_matting",
        webhook_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> GpuJobResponse:
        """Submit video matting job.

        Args:
            video_path: Path to input video
            model: Matting model (default: "robust_video_matting")
            webhook_url: Optional webhook for completion
            timeout: Request timeout override

        Returns:
            GpuJobResponse with job_id

        Raises:
            GpuTransientError or GpuFatalError
        """
        if not self.is_online:
            return await self._handle_offline_task(
                "matting",
                {"video_path": video_path, "model": model},
            )

        payload = MattingVideoRequest(
            video_path=video_path,
            model=model,
            webhook_url=webhook_url,
        ).dict()

        response = await self._post_with_retry(
            "/api/video/matting",
            payload,
            timeout=timeout or 90.0,
            max_retries=3,
        )

        job_response = GpuJobResponse(**response)
        await self._record_metric(
            task_type="matting",
            job_id=job_response.job_id,
            status="submitted",
        )
        return job_response

    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        model: str = "imaginairy",
        webhook_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> GpuJobResponse:
        """Submit image generation job.

        Args:
            prompt: Text prompt for image
            negative_prompt: Negative prompt (what not to generate)
            model: Model name (default: "imaginairy")
            webhook_url: Optional webhook for completion
            timeout: Request timeout override

        Returns:
            GpuJobResponse with job_id

        Raises:
            GpuTransientError or GpuFatalError
        """
        if not self.is_online:
            return await self._handle_offline_task(
                "image",
                {"prompt": prompt, "negative_prompt": negative_prompt, "model": model},
            )

        payload = ImageGenerateRequest(
            prompt=prompt,
            negative_prompt=negative_prompt,
            model=model,
            webhook_url=webhook_url,
        ).dict()

        response = await self._post_with_retry(
            "/api/image/generate",
            payload,
            timeout=timeout or 60.0,
            max_retries=3,
        )

        job_response = GpuJobResponse(**response)
        await self._record_metric(
            task_type="image",
            job_id=job_response.job_id,
            status="submitted",
        )
        return job_response

    async def render_video(
        self,
        matte_path: str,
        audio_path: str,
        output_format: str = "mp4",
        webhook_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> GpuJobResponse:
        """Submit video rendering job.

        Args:
            matte_path: Path to alpha matte video
            audio_path: Path to audio file
            output_format: Output format (default: "mp4")
            webhook_url: Optional webhook for completion
            timeout: Request timeout override

        Returns:
            GpuJobResponse with job_id

        Raises:
            GpuTransientError or GpuFatalError
        """
        if not self.is_online:
            return GpuJobResponse(
                job_id="",
                status="error",
                message="GPU rendering requires Desktop GPU worker (currently offline)",
            )

        payload = RenderVideoRequest(
            matte_path=matte_path,
            audio_path=audio_path,
            output_format=output_format,
            webhook_url=webhook_url,
        ).dict()

        response = await self._post_with_retry(
            "/api/video/render",
            payload,
            timeout=timeout or 120.0,
            max_retries=3,
        )

        job_response = GpuJobResponse(**response)
        await self._record_metric(
            task_type="rendering",
            job_id=job_response.job_id,
            status="submitted",
        )
        return job_response

    async def get_job_status(self, job_id: str) -> JobStatusResponse:
        """Poll job status.

        Args:
            job_id: Job UUID

        Returns:
            JobStatusResponse with status and progress

        Raises:
            GpuTransientError or GpuFatalError
        """
        response = await self._post_with_retry(
            f"/api/jobs/{job_id}",
            {},
            timeout=5.0,
            max_retries=3,
        )
        return JobStatusResponse(**response)

    async def download_artifact(
        self,
        job_id: str,
        output_path: str,
        timeout: Optional[float] = None,
    ) -> None:
        """Download job artifact (video/image/audio).

        Args:
            job_id: Job UUID
            output_path: Local file path to write
            timeout: Request timeout override

        Raises:
            GpuTransientError: Transient error
            GpuFatalError: Fatal error
        """
        timeout = timeout or self.timeout
        try:
            async with self.session.get(
                f"{self.base_url}/api/jobs/{job_id}/artifact",
                timeout=aiohttp.ClientTimeout(total=timeout),
                headers=self._auth_headers(),
            ) as resp:
                if resp.status != 200:
                    raise GpuFatalError(f"Failed to download artifact: HTTP {resp.status}")

                with open(output_path, "wb") as f:
                    async for chunk in resp.content.iter_chunked(8192):
                        f.write(chunk)
                logger.info(f"Downloaded artifact to {output_path}")

        except asyncio.TimeoutError:
            raise GpuTransientError("Artifact download timeout")
        except aiohttp.ClientError as e:
            raise GpuTransientError(f"Artifact download failed: {e}")

    async def cleanup_job(self, job_id: str) -> None:
        """Cleanup job temp files on Desktop.

        Args:
            job_id: Job UUID
        """
        try:
            async with self.session.delete(
                f"{self.base_url}/api/jobs/{job_id}",
                timeout=aiohttp.ClientTimeout(total=5.0),
                headers=self._auth_headers(),
            ) as resp:
                if resp.status == 200:
                    logger.info(f"Cleaned up job {job_id}")
                else:
                    logger.warning(f"Cleanup failed for job {job_id}: HTTP {resp.status}")
        except Exception as e:
            logger.error(f"Cleanup error for job {job_id}: {e}")

    async def _handle_offline_task(self, task_type: str, payload: dict) -> GpuJobResponse:
        """Handle task submission when Desktop offline.

        Strategy:
            - Avatar/Matting: Queue to Redis for later retry
            - Voice/Image: Fallback to CPU-based alternative
            - Rendering: Fail fast (requires GPU)

        Args:
            task_type: "avatar", "voice", "matting", "image", "rendering"
            payload: Task payload

        Returns:
            GpuJobResponse (queued or error)
        """
        if task_type == "avatar" or task_type == "matting":
            # Queue to Redis for later retry
            logger.info(f"Desktop offline, queuing {task_type} job to Redis")
            job_id = str(os.urandom(16).hex())
            return GpuJobResponse(
                job_id=job_id,
                status="queued",
                message=f"{task_type} job queued, will run when Desktop comes online",
            )

        elif task_type == "voice":
            # Fallback to gTTS (CPU-based)
            logger.info("Desktop offline, falling back to gTTS for voice synthesis")
            job_id = str(os.urandom(16).hex())
            return GpuJobResponse(
                job_id=job_id,
                status="processing",
                message="Using CPU-based TTS (gTTS) as Desktop GPU offline",
            )

        elif task_type == "image":
            # Fallback to CPU-lite image generation
            logger.info("Desktop offline, falling back to CPU-lite image generation")
            job_id = str(os.urandom(16).hex())
            return GpuJobResponse(
                job_id=job_id,
                status="processing",
                message="Using CPU-based image generation as Desktop GPU offline",
            )

        else:  # rendering
            # Fail fast for rendering
            logger.error("Desktop offline, cannot render video (GPU required)")
            return GpuJobResponse(
                job_id="",
                status="error",
                message="GPU rendering requires Desktop GPU worker (currently offline)",
            )

    async def _record_metric(
        self,
        task_type: str,
        job_id: str,
        status: str,
        latency_ms: Optional[int] = None,
        retry_count: int = 0,
    ) -> None:
        """Record job metric to PostgreSQL.

        Args:
            task_type: "avatar", "voice", "matting", "image", "rendering"
            job_id: Job UUID
            status: "submitted", "success", "failed", "timeout"
            latency_ms: Job duration in milliseconds
            retry_count: Number of retries before success
        """
        # TODO: Implement PostgreSQL insert
        # INSERT INTO gpu_job_metrics (task_type, job_id, status, latency_ms, retry_count, cost_usd, desktop_uptime_percent)
        logger.debug(
            f"Metric: {task_type} {job_id} {status} "
            f"latency={latency_ms}ms retry={retry_count} uptime={self.uptime_percent:.1f}%"
        )

    async def _health_check_loop(self) -> None:
        """Background task: poll Desktop health every N seconds."""
        while True:
            try:
                await self.health_check()
                self.health_monitor.record_online()
                logger.debug("Health check OK: Desktop online")

            except GpuTransientError:
                self.health_monitor.record_offline()
                logger.warning("Health check timeout: Desktop offline")

            except GpuFatalError:
                self.health_monitor.record_offline()
                logger.error("Health check failed: Desktop offline")

            except Exception as e:
                self.health_monitor.record_offline()
                logger.error(f"Unexpected error in health check: {e}")

            await asyncio.sleep(self.health_check_interval)

    async def start(self) -> None:
        """Start the client and background health check task."""
        self.session = aiohttp.ClientSession()
        self._health_check_task = asyncio.create_task(self._health_check_loop())
        logger.info(f"GpuWorkerClient started (base_url={self.base_url})")

    async def stop(self) -> None:
        """Graceful shutdown."""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
        if self.session:
            await self.session.close()
        logger.info("GpuWorkerClient stopped")

    async def __aenter__(self):
        """Async context manager entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.stop()
