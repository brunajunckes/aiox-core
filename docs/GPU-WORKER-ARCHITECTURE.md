# GPU Worker Architecture — Phase 2 Gap 2

**Version:** 1.0  
**Date:** 2026-04-11  
**Status:** Design Phase  
**Owner:** @architect  

---

## Executive Summary

AutoFlow Phase 2 requires GPU-accelerated video generation. This document defines the architecture for VPS↔Desktop GPU Worker integration via Cloudflare Tunnel. The design enables:

- **5 GPU task types:** Avatar generation, voice synthesis, video matting, image generation, final rendering
- **Resilient bridge:** Cloudflare Tunnel for VPS↔Desktop communication with auto-reconnect
- **Graceful degradation:** Automatic fallback when Desktop offline
- **Health monitoring:** 60s polling with uptime tracking
- **Cost tracking:** Per-task billing metrics
- **Error recovery:** Exponential backoff retry logic for transient failures

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────┐         ┌──────────────────────────┐
│         VPS (Linux)                 │         │   Desktop (Windows)      │
│     autoflow.ampcast.site           │         │   aigrejanascasas.com    │
│                                     │         │                          │
│  ┌────────────────────────────────┐ │         │  ┌────────────────────┐  │
│  │  Job Orchestrator              │ │         │  │  GPU Worker API    │  │
│  │  (BullMQ Pipeline)             │ │         │  │  :8500             │  │
│  │  - Stage 1-3: CPU only         │ │         │  │                    │  │
│  │  - Stage 4-5: GPU dependent    │ │         │  │  /avatar           │  │
│  └────────────────────────────────┘ │         │  │  /voice            │  │
│           │                          │         │  │  /matting          │  │
│           │ Submit GPU job           │         │  │  /image            │  │
│           ▼                          │         │  │  /video            │  │
│  ┌────────────────────────────────┐ │         │  │  /health           │  │
│  │  GpuWorkerClient Library       │ │         │  │  /status           │  │
│  │  (async HTTP wrapper)          │ │         │  │                    │  │
│  │                                │ │         │  └────────────────────┘  │
│  │  - 5 task methods              │ │                    ▲                │
│  │  - Health polling (60s)        │ │                    │                │
│  │  - Retry logic                 │ │         ┌──────────┴──────────┐    │
│  │  - Metrics recording           │ │         │ Cloudflare Tunnel  │    │
│  │  - Graceful degradation        │ │         │ cloudflared daemon │    │
│  └────────────────────────────────┘ │         └────────────────────┘    │
│           │                          │                                   │
│           │ HTTP GET /health ────────┼──────→ GET /health               │
│           │ POST /avatar ────────────┼──────→ POST /avatar              │
│           │ Poll status ─────────────┼──────→ GET /jobs/{id}            │
│           │ Download artifact ───────┼──────→ GET /artifact/{id}        │
│           │                          │                                   │
│  ┌────────────────────────────────┐ │         ┌──────────────────────┐  │
│  │  Metrics Table                 │ │         │  Job Queue           │  │
│  │  (PostgreSQL)                  │ │         │  (In-process FIFO)   │  │
│  │                                │ │         │  - Avatar (1 slot)   │  │
│  │  - task_type                   │ │         │  - Voice             │  │
│  │  - latency_ms                  │ │         │  - Matting           │  │
│  │  - success rate                │ │         │  - Image             │  │
│  │  - desktop_uptime_pct          │ │         │  - Rendering         │  │
│  │  - cost_usd                    │ │         └──────────────────────┘  │
│  └────────────────────────────────┘ │                                   │
│                                     │                                   │
└─────────────────────────────────────┘         └──────────────────────────┘

                        ┌─────────────────────┐
                        │ Cloudflare Network  │
                        │ (Secure Tunnel)     │
                        │ - Encryption (TLS)  │
                        │ - Auto-reconnect    │
                        │ - Geographic peering│
                        └─────────────────────┘
```

### Communication Flow

**Scenario 1: Avatar Generation (Happy Path)**

```
1. VPS: GpuWorkerClient.generate_avatar(script_data)
   ↓
2. Client: POST https://desktop.autoflow.internal/api/avatar/generate
   {
     "script_text": "...",
     "avatar_model": "default",
     "webhook_url": "https://autoflow.ampcast.site/api/webhooks/gpu"
   }
   ↓
3. Desktop: Accept job, return job_id + status
   {
     "job_id": "uuid-abc123",
     "status": "queued"
   }
   ↓
4. VPS: Poll GET /api/jobs/uuid-abc123 every 2s
   → status: "processing" (progress: 45%)
   → status: "done" (artifact_url: temporary path)
   ↓
5. VPS: GET /api/jobs/uuid-abc123/artifact (streaming download)
   → Receive video file
   ↓
6. VPS: DELETE /api/jobs/uuid-abc123
   → Desktop cleans up temp files
   ↓
7. VPS: Record metric
   {
     "task_type": "avatar",
     "latency_ms": 95000,
     "status": "success",
     "cost_usd": 0.50,
     "desktop_uptime": "100%"
   }
```

**Scenario 2: Desktop Offline (Graceful Degradation)**

```
1. VPS: Health check fires, GET /health times out (>5s, 3 retries)
   ↓
2. GpuWorkerClient: Set state = OFFLINE, alert monitoring
   ↓
3. User submits avatar job
   ↓
4. GpuWorkerClient: Check Desktop state
   → OFFLINE, avatar can't run on CPU
   → Fallback: Queue job locally (Redis), wait for Desktop recovery
   → Return to user: {status: "queued", message: "Desktop offline, queued for retry"}
   ↓
5. Health check recovers Desktop (5 min later)
   ↓
6. GpuWorkerClient: OFFLINE → ONLINE state transition
   → Process queued jobs from Redis
   → Avatar job submitted
   ↓
7. Continue as happy path above
```

**Scenario 3: Transient Error with Retry**

```
1. VPS: POST /avatar with script data
   ↓
2. Desktop: Begin processing, GPU OOM at minute 2
   → Return HTTP 503 (Service Unavailable)
   ↓
3. GpuWorkerClient: Classify error
   → 503 = transient (E4_GPU_UNAVAIL)
   → Exponential backoff: 1s
   ↓
4. Sleep 1s, retry POST /avatar
   ↓
5. Desktop: VRAM freed, process succeeds
   → Return 200 + job_id
   ↓
6. Continue as happy path
```

---

## Component Design

### 1. GpuWorkerClient Library

**Location:** `autoflow/gpu/gpu_worker_client.py`

**Responsibilities:**
- Async HTTP client (aiohttp-based)
- 5 task submission methods
- Health check polling
- Graceful degradation decision logic
- Metrics recording
- Retry logic (exponential backoff)

**Class Hierarchy:**

```python
class GpuWorkerClient:
    """Main client for submitting jobs to Desktop GPU worker."""
    
    # Constructor
    def __init__(self, base_url: str, api_token: str | None, timeout: float = 30.0):
        """
        Args:
            base_url: "https://desktop.autoflow.internal" (via Cloudflare Tunnel)
            api_token: Shared secret for Desktop authentication
            timeout: Default timeout per request (seconds)
        """
    
    # 5 GPU task methods
    async def generate_avatar(
        self,
        script_text: str,
        avatar_model: str = "default",
        webhook_url: str | None = None,
        timeout: float | None = None
    ) -> GpuJobResponse:
        """Generate avatar video from script. (Est. 60-120s)"""
    
    async def synthesize_voice(
        self,
        text: str,
        voice_id: str = "default",
        language: str = "en",
        webhook_url: str | None = None,
        timeout: float | None = None
    ) -> GpuJobResponse:
        """Synthesize voice audio from text. (Est. 5-15s)"""
    
    async def matting_video(
        self,
        video_path: str,
        model: str = "robust_video_matting",
        webhook_url: str | None = None,
        timeout: float | None = None
    ) -> GpuJobResponse:
        """Extract alpha matte from video. (Est. 30-60s)"""
    
    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        model: str = "imaginairy",
        webhook_url: str | None = None,
        timeout: float | None = None
    ) -> GpuJobResponse:
        """Generate image from text prompt. (Est. 10-30s)"""
    
    async def render_video(
        self,
        matte_path: str,
        audio_path: str,
        output_format: str = "mp4",
        webhook_url: str | None = None,
        timeout: float | None = None
    ) -> GpuJobResponse:
        """Final video rendering (matte + audio). (Est. 20-60s)"""
    
    # Health checks
    async def health_check(self) -> HealthCheckResponse:
        """Poll Desktop /health. Returns: uptime, gpu_memory, queue_depth."""
    
    async def get_job_status(self, job_id: str) -> JobStatusResponse:
        """Poll GET /api/jobs/{job_id}. Returns: status, progress%, artifact_url."""
    
    async def download_artifact(
        self,
        job_id: str,
        output_path: str,
        timeout: float | None = None
    ) -> None:
        """Stream download artifact to local file."""
    
    async def cleanup_job(self, job_id: str) -> None:
        """DELETE /api/jobs/{job_id}. Tell Desktop to clean temp files."""
    
    # State management
    @property
    def is_online(self) -> bool:
        """Returns True if Desktop is responding to health checks."""
    
    @property
    def uptime_percent(self) -> float:
        """Rolling 24-hour uptime as percentage."""
    
    # Lifecycle
    async def start(self) -> None:
        """Start background health check polling (60s interval)."""
    
    async def stop(self) -> None:
        """Stop health check polling and close HTTP session."""
```

**Implementation Pseudocode:**

```python
# Simplified implementation
class GpuWorkerClient:
    def __init__(self, base_url: str, api_token: str | None = None, timeout: float = 30.0):
        self.base_url = base_url
        self.api_token = api_token
        self.timeout = timeout
        self.session: aiohttp.ClientSession | None = None
        self._is_online = True
        self._uptime_tracker = UptimeTracker()
        self._health_check_task: asyncio.Task | None = None
    
    async def generate_avatar(self, script_text: str, **kwargs) -> GpuJobResponse:
        if not self.is_online:
            # Graceful degradation: queue locally or fail
            return await self._handle_offline_avatar(script_text, **kwargs)
        
        payload = {
            "script_text": script_text,
            "avatar_model": kwargs.get("avatar_model", "default"),
            "webhook_url": kwargs.get("webhook_url")
        }
        
        response = await self._post_with_retry(
            "/api/avatar/generate",
            payload,
            timeout=kwargs.get("timeout", self.timeout)
        )
        
        job_response = GpuJobResponse(**response)
        
        # Record metric
        await self._record_metric(
            task_type="avatar",
            status="submitted",
            job_id=job_response.job_id
        )
        
        return job_response
    
    async def _post_with_retry(
        self,
        endpoint: str,
        payload: dict,
        timeout: float = 30.0,
        max_retries: int = 3
    ) -> dict:
        """POST with exponential backoff retry."""
        backoff = [1.0, 2.0, 4.0]
        
        for attempt in range(max_retries):
            try:
                async with self.session.post(
                    f"{self.base_url}{endpoint}",
                    json=payload,
                    timeout=timeout,
                    headers=self._auth_headers()
                ) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    elif resp.status in [503, 504]:
                        # Transient error, retry
                        if attempt < max_retries - 1:
                            await asyncio.sleep(backoff[attempt])
                            continue
                        else:
                            raise GpuTransientError(f"Max retries exhausted: {resp.status}")
                    else:
                        # Fatal error
                        raise GpuFatalError(f"Unrecoverable error: {resp.status}")
            
            except asyncio.TimeoutError:
                if attempt < max_retries - 1:
                    await asyncio.sleep(backoff[attempt])
                    continue
                else:
                    raise GpuTransientError("Timeout after all retries")
    
    async def _health_check_loop(self, interval_seconds: int = 60) -> None:
        """Background task: poll health every N seconds."""
        while True:
            try:
                response = await self.health_check()
                self._is_online = True
                self._uptime_tracker.record_online()
                logger.info(f"Health check OK: GPU {response.gpu_memory}MB free")
            
            except asyncio.TimeoutError:
                self._is_online = False
                self._uptime_tracker.record_offline()
                logger.warning("Health check timeout: Desktop offline")
            
            except Exception as e:
                self._is_online = False
                self._uptime_tracker.record_offline()
                logger.error(f"Health check error: {e}")
            
            await asyncio.sleep(interval_seconds)
    
    async def start(self) -> None:
        """Start the health check background task."""
        self.session = aiohttp.ClientSession()
        self._health_check_task = asyncio.create_task(self._health_check_loop())
        logger.info("GpuWorkerClient started")
    
    async def stop(self) -> None:
        """Graceful shutdown."""
        if self._health_check_task:
            self._health_check_task.cancel()
        if self.session:
            await self.session.close()
        logger.info("GpuWorkerClient stopped")
```

### 2. Health Monitor

**Location:** `autoflow/gpu/health_monitor.py`

**Responsibilities:**
- Track Desktop online/offline state
- Calculate uptime percentage (24-hour rolling)
- Alert on state transitions

**Class:**

```python
class HealthMonitor:
    """Track Desktop GPU worker uptime and state transitions."""
    
    def __init__(self, window_hours: int = 24):
        """
        Args:
            window_hours: Uptime calculation window (default: 24 hours)
        """
        self.window_hours = window_hours
        self.events: list[tuple[datetime, str]] = []  # [(timestamp, "online"/"offline")]
        self.current_state = "online"
    
    def record_online(self) -> None:
        """Record Desktop came online."""
        if self.current_state != "online":
            self.events.append((datetime.utcnow(), "online"))
            self.current_state = "online"
            logger.info("GPU Worker: ONLINE")
    
    def record_offline(self) -> None:
        """Record Desktop went offline."""
        if self.current_state != "offline":
            self.events.append((datetime.utcnow(), "offline"))
            self.current_state = "offline"
            logger.warning("GPU Worker: OFFLINE")
    
    def uptime_percent(self) -> float:
        """Calculate uptime % in rolling window."""
        cutoff = datetime.utcnow() - timedelta(hours=self.window_hours)
        online_duration = timedelta()
        
        for i, (ts, state) in enumerate(self.events):
            if ts < cutoff:
                continue
            
            # Time from this event to next (or now)
            end_ts = self.events[i + 1][0] if i + 1 < len(self.events) else datetime.utcnow()
            duration = end_ts - max(ts, cutoff)
            
            if state == "online":
                online_duration += duration
        
        total_duration = datetime.utcnow() - max(self.events[0][0] if self.events else datetime.utcnow() - timedelta(hours=24), cutoff)
        
        return (online_duration / total_duration * 100) if total_duration > timedelta() else 100
```

### 3. Graceful Degradation

**Location:** Integrated into `GpuWorkerClient`

**Decision Logic:**

```
┌─ Desktop offline?
│  ├─ Avatar: Queue in Redis, return "queued_for_retry"
│  ├─ Voice: Use CPU-based fallback (gTTS) if available, else queue
│  ├─ Matting: Queue in Redis, return "queued_for_retry"
│  ├─ Image: Use CPU fallback (stable diffusion-lite) if available
│  └─ Rendering: Fail fast (requires GPU), return error
│
└─ Desktop online?
   ├─ Check job type + capacity
   ├─ If queue full: Fallback or queue
   └─ Otherwise: Submit job
```

### 4. Error Handling

**Error Classification (E4 Taxonomy):**

| Error | Category | Retry | Backoff |
|-------|----------|-------|---------|
| Timeout (>30s) | TRANSIENT | Yes | 1s, 2s, 4s |
| HTTP 503/504 | TRANSIENT | Yes | 1s, 2s, 4s |
| GPU Out of Memory | TRANSIENT | Yes | 1s, 2s, 4s |
| Network unreachable | TRANSIENT | Yes | 1s, 2s, 4s |
| HTTP 401/403 | FATAL | No | — |
| Invalid request (400) | FATAL | No | — |
| Job not found (404) | FATAL | No | — |
| GPU driver crash | FATAL | No | — |

### 5. Metrics Collection

**PostgreSQL Schema:**

```sql
CREATE TABLE gpu_job_metrics (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,  -- "success", "failed", "timeout"
    latency_ms INT NOT NULL,
    retry_count INT DEFAULT 0,
    cost_usd DECIMAL(7, 4) NOT NULL,
    desktop_uptime_percent DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_task_type (task_type),
    INDEX idx_created_at (created_at)
);
```

**Per-Task Cost:**

| Task | Cost |
|------|------|
| Avatar | $0.50 |
| Voice | $0.10 |
| Matting | $0.30 |
| Image | $0.15 |
| Rendering | $0.20 |

### 6. Cloudflare Tunnel Configuration

**Location:** `.cloudflare/tunnel-config.yaml`

```yaml
tunnel: autoflow-gpu-tunnel
credentials-file: /root/.cloudflare/autoflow-gpu-tunnel.json

ingress:
  # Desktop GPU Worker
  - hostname: desktop.autoflow.internal
    service: http://localhost:8500
    originRequest:
      connectTimeout: 30s
      tlsTimeout: 30s
      tcpKeepAlive: 30s
  
  # Default (catch-all)
  - service: http_status:404
```

**Setup Steps:**

```bash
# On VPS
cloudflared tunnel create autoflow-gpu-tunnel
cloudflared tunnel route dns autoflow-gpu-tunnel desktop.autoflow.internal

# On Desktop
cloudflared tunnel run autoflow-gpu-tunnel

# Verify
curl https://desktop.autoflow.internal/health
```

---

## Pydantic Models

**Location:** `autoflow/gpu/models.py`

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AvatarGenerateRequest(BaseModel):
    script_text: str
    avatar_model: str = "default"
    webhook_url: Optional[str] = None

class VoiceSynthesisRequest(BaseModel):
    text: str
    voice_id: str = "default"
    language: str = "en"
    webhook_url: Optional[str] = None

class MattingVideoRequest(BaseModel):
    video_path: str
    model: str = "robust_video_matting"
    webhook_url: Optional[str] = None

class ImageGenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    model: str = "imaginairy"
    webhook_url: Optional[str] = None

class RenderVideoRequest(BaseModel):
    matte_path: str
    audio_path: str
    output_format: str = "mp4"
    webhook_url: Optional[str] = None

class GpuJobResponse(BaseModel):
    job_id: str
    status: str  # "queued", "processing", "done", "error"
    message: Optional[str] = None

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress_percent: int = 0
    artifact_url: Optional[str] = None
    error: Optional[str] = None

class HealthCheckResponse(BaseModel):
    status: str  # "healthy", "degraded"
    gpu_memory_free_mb: int
    queue_depth: int
    uptime_seconds: int
```

---

## Testing Strategy

### Unit Tests (150+)

1. **GpuWorkerClient Tests (60)**
   - generate_avatar() with mocked response
   - synthesize_voice() happy path
   - matting_video() timeout scenario
   - generate_image() with retry
   - render_video() fatal error (no retry)
   - _post_with_retry() backoff timing
   - _auth_headers() token injection

2. **Health Monitor Tests (25)**
   - record_online() state transition
   - record_offline() state transition
   - uptime_percent() calculation (various windows)
   - State after multiple transitions

3. **Graceful Degradation Tests (20)**
   - Avatar offline → queue to Redis
   - Voice offline → fallback to gTTS
   - Matting offline → queue to Redis
   - Image offline → fallback to CPU
   - Rendering offline → fail fast

4. **Error Handling Tests (30)**
   - TRANSIENT error → retry 3x
   - FATAL error → fail immediately
   - Timeout → reclassify as transient
   - Max retries exhausted → give up
   - Dead-letter queue population

5. **Metrics Tests (15)**
   - Record metric after job success
   - Record metric after job failure
   - Cost calculation per task type
   - Desktop uptime tracked

### Integration Tests (50+)

- End-to-end avatar job submission (Desktop online)
- End-to-end avatar job (Desktop offline → recovery)
- Concurrent job submissions (5 jobs)
- Health check recovery after 5-min downtime
- Artifact download streaming
- Job cleanup confirmation

---

## Deployment & Operations

### On VPS

```bash
# 1. Install client library
pip install -e autoflow/

# 2. Configure Cloudflare Tunnel (done by @devops)
# 3. Verify tunnel connectivity
curl https://desktop.autoflow.internal/health

# 4. Initialize GpuWorkerClient in orchestrator
client = GpuWorkerClient(
    base_url="https://desktop.autoflow.internal",
    api_token=os.getenv("GPU_WORKER_TOKEN"),
    timeout=30.0
)
await client.start()  # Start health check polling
```

### On Desktop

```bash
# 1. Install dependencies
pip install fastapi uvicorn pydantic

# 2. Run GPU Worker API
python gpu_worker_api.py

# 3. Register cloudflared tunnel
cloudflared tunnel run autoflow-gpu-tunnel
```

### Monitoring & Alerts

```
# Metrics endpoint (VPS API)
GET /api/gpu/metrics
→ {
    "avatar": {"count": 145, "success_rate": 98.6, "avg_latency_ms": 95000},
    "voice": {"count": 3200, "success_rate": 99.2, "avg_latency_ms": 8500},
    "desktop_uptime_24h": 99.8
  }

# Alerts (to monitoring system)
- Desktop offline > 5 minutes → page on-call
- Success rate < 95% → alert @dev
- Avg latency > 150s (avatar) → investigate GPU
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Cloudflare Tunnel disconnect | Desktop unreachable | Auto-restart `cloudflared` via systemd + monitoring |
| GPU Worker crash | Complete loss of GPU capability | Health check detects within 60s, queue jobs locally |
| Network latency (VPS↔Desktop) | Slow jobs | Implement exponential backoff, increase timeout on retry |
| GPU VRAM exhaustion | OOM errors | Single-slot queue (one job at a time), kill hung processes |
| Cloudflare rate limits | API throttle | Implement client-side rate limiter, batch requests |

---

## Future Enhancements

1. **Job Priority Queue:** Avatar jobs queued ahead of voice (by revenue)
2. **GPU Acceleration Profiles:** Select GPU efficiency level (max quality, balanced, fast)
3. **Batch Job Submission:** Submit 10 avatar jobs, process serially
4. **Cost Optimization:** Cheaper CPU fallbacks for non-critical tasks
5. **Multi-Desktop Support:** Load balance across multiple Desktop GPU workers
6. **WebSocket Support:** Real-time progress via WebSocket (instead of polling)

---

## References

- **Story 5.2:** `docs/stories/active/5.2.story.md`
- **Desktop GPU Worker:** `autoflow/desktop_worker/gpu_worker_api.py`
- **Job Pipeline (Story 5.1):** `docs/stories/active/5.1.story.md`
- **BullMQ Reference:** `autoflow/docs/BULLMQ-QUICK-REFERENCE.md`
- **Cloudflare Tunnel Docs:** https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
