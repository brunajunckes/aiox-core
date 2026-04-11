# GPU Worker Integration Design — Summary

**Phase:** Phase 2 - AutoFlow Platform  
**Gap:** Gap 2 (GPU Worker Integration)  
**Story:** 5.2  
**Date:** 2026-04-11  
**Owner:** @architect  
**Status:** Design Phase Complete  

---

## Deliverables Completed

### 1. Story File
**Location:** `/root/docs/stories/active/5.2.story.md`

- **8 Acceptance Criteria:** All GPU worker integration requirements
- **Implementation Plan:** 12-hour detailed breakdown (7 phases)
- **File List:** 9 files with status, LOC, and purpose
- **Change Log:** Timestamped progression tracking

**Key AC:**
- AC 1: Cloudflare Tunnel VPS↔Desktop bridge
- AC 2: 5 GPU task endpoints (avatar, voice, matting, image, rendering)
- AC 3: Async HTTP client with timeout/retry
- AC 4: Health polling every 60s
- AC 5: Graceful degradation on offline
- AC 6: Error handling with exponential backoff
- AC 7: Metrics collection (latency, success, cost, uptime)
- AC 8: 150+ unit tests

---

### 2. Architecture Document
**Location:** `/root/docs/GPU-WORKER-ARCHITECTURE.md` (5 KB)

**Sections:**

#### System Diagram
```
VPS (Linux)                           Desktop (Windows)
├─ Job Orchestrator                   ├─ GPU Worker API :8500
├─ GpuWorkerClient Library              ├─ avatar, voice, matting, image, rendering
├─ Health Monitor                        ├─ Job Queue (1 slot)
├─ Metrics Table                         └─ Ollama, GPU models
└─ Graceful Degradation Logic
        ↕ (via Cloudflare Tunnel)
```

#### 5 GPU Task Types
| Task | Input | Est. Time | Cost | Fallback |
|------|-------|-----------|------|----------|
| Avatar | Script text | 60-120s | $0.50 | Queue to Redis |
| Voice | Text | 5-15s | $0.10 | gTTS (CPU) |
| Matting | Video | 30-60s | $0.30 | Queue to Redis |
| Image | Prompt | 10-30s | $0.15 | CPU-lite |
| Rendering | Matte+audio | 20-60s | $0.20 | Fail fast |

#### Communication Flow (3 scenarios)
1. **Happy Path:** Avatar generation with Desktop online
2. **Offline Recovery:** Desktop goes offline, jobs queue, recovery processing
3. **Transient Error:** Retry with exponential backoff (1s, 2s, 4s)

#### Component Design
- **GpuWorkerClient:** Async HTTP wrapper, 5 task methods, retry logic
- **HealthMonitor:** State tracking, uptime calculation (24h rolling)
- **Graceful Degradation:** Per-task fallback strategy
- **Error Handling:** Transient (retry) vs Fatal (fail) classification
- **Metrics:** PostgreSQL table + aggregation views

#### Cloudflare Tunnel Config
- Tunnel name: `autoflow-gpu-tunnel`
- Route: `desktop.autoflow.internal` → `localhost:8500`
- Auto-reconnect on disconnect
- Connection timeouts: 30s

#### Pydantic Models (8 classes)
- 5 request models (one per GPU task)
- 3 response models (job response, status, health)
- Validation + serialization

#### Testing Strategy
- 150+ unit tests (40 per GPU task, 25 health, 20 error handling, 15 metrics)
- 50+ integration tests (E2E workflows)
- Mock aiohttp for all tests (no real network calls)

---

### 3. Code Skeleton Files

#### `autoflow/gpu/__init__.py` (12 lines)
Package initialization with imports and usage example.

#### `autoflow/gpu/gpu_worker_client.py` (550+ lines)
**Main client library:**
- `GpuWorkerClient` class with:
  - `generate_avatar()`
  - `synthesize_voice()`
  - `matting_video()`
  - `generate_image()`
  - `render_video()`
  - `get_job_status()`
  - `download_artifact()`
  - `cleanup_job()`
  - `_post_with_retry()` (exponential backoff)
  - `_health_check_loop()` (background task)
  - `start()` / `stop()` (lifecycle)

**Error Classes:**
- `GpuWorkerException` (base)
- `GpuTransientError` (retry eligible)
- `GpuFatalError` (no retry)

**Features:**
- Async/await throughout
- Timeout handling per request
- Graceful degradation logic per task
- Metrics recording
- Health monitoring integration

#### `autoflow/gpu/models.py` (200+ lines)
**Pydantic Request Models:**
- `AvatarGenerateRequest`
- `VoiceSynthesisRequest`
- `MattingVideoRequest`
- `ImageGenerateRequest`
- `RenderVideoRequest`

**Pydantic Response Models:**
- `GpuJobResponse`
- `JobStatusResponse`
- `HealthCheckResponse`

**Metrics Models:**
- `GpuJobMetric`
- `MetricsAggregation`

All with:
- Type hints + validation
- Field descriptions
- Config.schema_extra examples

#### `autoflow/gpu/health_monitor.py` (100+ lines)
**HealthMonitor class:**
- `record_online()` / `record_offline()` (state machine)
- `uptime_percent()` (24h rolling window)
- Event history tracking
- Idempotent state transitions

#### `autoflow/migrations/002_create_gpu_metrics.sql` (100 lines)
**PostgreSQL Schema:**
- `gpu_job_metrics` table (9 columns)
- Indexes for common queries
- `gpu_worker_health_events` table (optional)
- 2 aggregation views (hourly, daily)
- Stored procedure for summary stats

#### `.cloudflare/tunnel-config.yaml` (80 lines)
**Cloudflare Tunnel Configuration:**
- Tunnel: `autoflow-gpu-tunnel`
- Ingress rule: `desktop.autoflow.internal` → `http://localhost:8500`
- Timeout settings (30s)
- systemd service template
- Monitoring + alerts guidance

#### `tests/test_gpu_worker_client.py` (500+ lines)
**Test Skeleton (150+ tests):**
1. Initialization tests (5)
2. Avatar tests (10)
3. Voice tests (10)
4. Matting tests (10)
5. Image tests (10)
6. Rendering tests (10)
7. Health check tests (15)
8. Graceful degradation tests (20)
9. Error handling/retry tests (30)
10. Metrics tests (15)
11. Integration tests (50+)

All marked as `@pytest.mark.asyncio` with TODO comments for implementation.

---

## Implementation Timeline (Phase 2)

### Story 5.1 — BullMQ Pipeline (18h)
- Job queue + checkpoints
- PostgreSQL persistence
- Artifact storage

### Story 5.2 — GPU Worker Bridge (12h) ← **THIS DESIGN**
- Cloudflare Tunnel setup
- GpuWorkerClient library
- Health monitoring
- Graceful degradation
- Error handling + retry
- Metrics collection
- 150+ unit tests

### Story 5.3 — LLM-Router Integration (TBD)
- Route to Ollama/Claude
- Cost tracking
- Token usage metrics

---

## Architecture Decisions

### Decision 1: Cloudflare Tunnel vs WireGuard
**Chosen:** Cloudflare Tunnel
- **Reason:** Zero-trust, auto-reconnect, geographic peering, no VPN setup
- **Risk:** Dependency on Cloudflare; mitigated by fallback WireGuard

### Decision 2: Single-Slot GPU Queue
**Chosen:** One GPU job at a time
- **Reason:** GPU VRAM contention; avoid thrashing
- **Trade-off:** Lower throughput, but predictable latency

### Decision 3: Exponential Backoff (1s, 2s, 4s)
**Chosen:** 3-retry with exponential backoff
- **Reason:** Balance between recovery speed and avoiding hammering Desktop
- **Alternative:** Fixed 5s backoff (simpler, less optimal)

### Decision 4: Graceful Degradation per Task
**Chosen:** Different fallback per task type
- **Reason:** Avatar/matting have no CPU fallback (queue); voice/image have CPU alternatives
- **Trade-off:** Complex logic, but maximizes availability

### Decision 5: Metrics in PostgreSQL
**Chosen:** Time-series metrics in Postgres (not separate metrics DB)
- **Reason:** Single source of truth; aggregation views; no new infra
- **Alternative:** Prometheus (added complexity)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Cloudflare Tunnel disconnect | Desktop unreachable (30+ min) | Auto-restart via systemd, health check detects within 60s |
| GPU Worker crash | Complete loss of GPU (hours) | Health check -> queue jobs locally -> process on recovery |
| Network latency | Slow jobs, timeouts | Exponential backoff, custom timeout per task |
| GPU VRAM exhaustion | OOM errors (unrecoverable) | Single-slot queue, kill hung processes (30min timeout) |
| Metrics table bloat | Query slowdown | Indexes on task_type + created_at, 30-day retention policy |

---

## Deployment Checklist

### Pre-Deployment
- [ ] Cloudflare account active, tunnel credentials ready
- [ ] Desktop has: Python 3.9+, fastapi, uvicorn, GPU drivers, Ollama
- [ ] PostgreSQL available on VPS
- [ ] Redis available for job queuing

### @devops Deployment Tasks
- [ ] Set up Cloudflare Tunnel (create, route DNS, enable auto-restart)
- [ ] Deploy GpuWorkerClient library to VPS
- [ ] Run migration: `002_create_gpu_metrics.sql`
- [ ] Configure environment variables (GPU_WORKER_TOKEN, etc.)
- [ ] Verify tunnel connectivity: `curl https://desktop.autoflow.internal/health`

### @dev Testing Tasks
- [ ] Run 150+ unit tests locally
- [ ] Test all 5 GPU task types with mocked responses
- [ ] Test health check polling
- [ ] Test offline/online transitions
- [ ] Test retry logic (manual chaos testing)

---

## Usage Example

```python
import asyncio
from autoflow.gpu import GpuWorkerClient

async def main():
    # Initialize client
    client = GpuWorkerClient(
        base_url="https://desktop.autoflow.internal",
        api_token="your-secret-token",
        timeout=30.0
    )
    
    # Start background health check (60s polling)
    await client.start()
    
    try:
        # Submit avatar job
        response = await client.generate_avatar(
            script_text="Welcome to Igreja nas Casas!",
            avatar_model="default",
            webhook_url="https://autoflow.ampcast.site/api/webhooks/gpu"
        )
        print(f"Job {response.job_id} submitted (status: {response.status})")
        
        # Poll status
        for i in range(60):  # Poll for 2 minutes
            status = await client.get_job_status(response.job_id)
            print(f"Progress: {status.progress_percent}% ({status.status})")
            
            if status.status == "done":
                # Download artifact
                await client.download_artifact(
                    response.job_id,
                    "avatar.mp4"
                )
                print("Avatar downloaded to avatar.mp4")
                
                # Cleanup
                await client.cleanup_job(response.job_id)
                break
            
            await asyncio.sleep(2)
    
    finally:
        await client.stop()

# Run
asyncio.run(main())
```

---

## Next Steps

1. **@dev Implementation (Story 5.2):** 12-hour sprint to implement all 9 files
2. **@qa QA Gate:** Run 150+ unit tests, verify all 8 AC
3. **@devops Deployment:** Set up Cloudflare Tunnel, deploy to VPS/Desktop
4. **Story 5.3:** LLM-Router integration (depends on 5.2)

---

## Reference Documents

- **Architecture:** `/root/docs/GPU-WORKER-ARCHITECTURE.md`
- **Story 5.2:** `/root/docs/stories/active/5.2.story.md`
- **Story 5.1 (BullMQ):** `/root/docs/stories/active/5.1.story.md`
- **Desktop GPU Worker:** `/root/autoflow/desktop_worker/gpu_worker_api.py`
- **Phase 2 Planning:** `/root/docs/SPRINT-45-PLANNING.md` (if exists)

---

**Design Complete ✅**
Ready for @dev implementation sprint.
