# AutoFlow Phase 2 Roadmap — 8 Week Execution Plan

**Status:** Phase 1 COMPLETE (April 10, 2026)  
**Phase 2 Duration:** 8 weeks (Weeks 1-8 starting April 14)  
**Team Capacity:** 3 parallel squads (Infrastructure, Backend, Integration)  
**Success Criteria:** All 3 epics merged to main, end-to-end testing with GPU worker

---

## Executive Summary

Phase 2 transforms AutoFlow from a single-host monolith to a distributed pipeline system with GPU acceleration. Three epics executed in parallel unlock:

1. **Epic 1 (Weeks 1-2):** BullMQ pipeline + job persistence → video jobs resume from checkpoints
2. **Epic 2 (Weeks 2-4):** Desktop GPU worker bridge → local GPU tasks (avatar, voice, matting, rendering)
3. **Epic 3 (Weeks 4-5):** LLM-Router-AIOX alignment → complexity-driven model selection + cost tracking

**Dependency chain:** Epic 1 (foundation) → Epic 2 (GPU integration) → Epic 3 (optimization)  
**Critical path:** BullMQ job schema (Epic 1) must complete before GPU worker tasks can be queued (Epic 2)

---

## Phase 1 Review — What We Have

| Component | Status | Location | Confidence |
|-----------|--------|----------|-----------|
| **Infrastructure** | ✅ READY | Paperclip (3100), LLM-Router-AIOX (3200), Ollama, Redis, PostgreSQL | HIGH |
| **Core Engine** | ✅ DONE | `/root/autoflow/autoflow/core/` (router, validator, monitor) | HIGH |
| **Workflows** | ✅ DONE | 5 workflows implemented (research, seo, video) with LangGraph | HIGH |
| **Error Handling** | ⚠️ PARTIAL | E1-E3, E6-E7 exist; E4 (BullMQ) pending | MEDIUM |
| **Systemd Services** | ✅ RUNNING | autoflow-api (8000), autoflow-monitor (daemonized) | HIGH |

**Known Issues:**
- LLM-Router-AIOX exists but bypassed (router.py uses direct Ollama → Claude)
- No job persistence (video workflows restart on failure)
- No Desktop GPU integration (GPU tasks can't execute)
- Paperclip governance features unused

---

## Epic 1: BullMQ Pipeline Integration — Weeks 1-2 (2 sprints)

### Purpose
Implement reliable job queuing with checkpoint resumption. Enable long-running workflows (video rendering, complex analysis) to survive interruptions.

### Scope

#### Sprint 1.1 (Week 1): Job Queue Foundation
**Story 1.1.1:** Implement BullMQ queue schema and job lifecycle
- [x] Install BullMQ Python bindings: `python-rq` / `celery` (evaluate both)
- [x] Design job schema (5-stage video pipeline):
  - Stage 1: Script → Audio (VibeVoice on Desktop)
  - Stage 2: Audio → Segments
  - Stage 3: Video → Matting (RobustVideoMatting on Desktop)
  - Stage 4: Matting → Compositing
  - Stage 5: Compositing → Output
- [x] Implement JobQueue abstraction (`/root/autoflow/autoflow/queue/job_queue.py`)
- [x] Create job serialization/deserialization
- [x] Add retry logic (3 attempts per stage)
- Files: NEW `queue/` module (4-5 files, ~300 LOC)
- Acceptance Criteria:
  - Enqueue job returns job_id
  - Job state persists to Redis
  - Retry loop works (fail → backoff → retry)

**Story 1.1.2:** Add PostgreSQL checkpointing for stage results
- [x] Design checkpoint schema in Postgres:
  ```sql
  CREATE TABLE job_checkpoints (
    job_id UUID PRIMARY KEY,
    stage INT,
    artifact_path TEXT,
    result JSON,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [x] Implement save_checkpoint(job_id, stage, result)
- [x] Implement load_checkpoint(job_id) → resume from last completed stage
- [x] Add artifact TTL cleanup (30 days)
- Files: MODIFY `core/config.py`, NEW `checkpoint/store.py` (~150 LOC)
- Acceptance Criteria:
  - Job can resume from last checkpoint
  - Artifacts cleanup runs daily
  - No data loss on restart

**Story 1.1.3:** Integrate queue into video workflow
- [x] Modify `workflows/video.py` to use JobQueue instead of direct execution
- [x] Create video_pipeline_orchestrator() that enqueues 5-stage job
- [x] Update API endpoint `/api/video` to return job_id + status URL
- [x] Add `/api/video/{job_id}/status` endpoint for polling
- Files: MODIFY `workflows/video.py`, NEW `api/routes/video.py` (~200 LOC)
- Acceptance Criteria:
  - POST /api/video returns { job_id, status, created_at }
  - GET /api/video/{job_id}/status shows stage + artifacts
  - Full 5-stage pipeline executes end-to-end

#### Sprint 1.2 (Week 2): Persistence & Observability
**Story 1.2.1:** Implement persistent artifact storage
- [x] Choose storage backend (Supabase Storage vs S3 vs local Docker volume)
- [x] Create artifact manager (`core/artifact_store.py`)
- [x] Implement upload_artifact(stage, data) → returns S3/Supabase path
- [x] Add garbage collection (delete artifacts after job completion + 7 days)
- Files: NEW `core/artifact_store.py` (~150 LOC)
- Acceptance Criteria:
  - Artifacts survive container restart
  - 100% retrieval rate in tests
  - GC removes stale artifacts

**Story 1.2.2:** Add job monitoring + metrics
- [x] Create job_monitor service (tracks queue depth, stage latency)
- [x] Add Prometheus metrics: `autoflow_job_duration_seconds`, `autoflow_queue_depth`
- [x] Implement job dashboard endpoint `/api/admin/jobs` (list all jobs + stages)
- Files: NEW `monitor/job_monitor.py` (~100 LOC), MODIFY `api/server.py`
- Acceptance Criteria:
  - Metrics export on `/metrics`
  - Dashboard shows running + completed jobs
  - Latency per stage tracked

**Story 1.2.3:** Implement queue health checks + recovery
- [x] Add queue health endpoint `/queue/health`
- [x] Implement stuck-job detection (job in state > 1 hour)
- [x] Auto-escalate stuck jobs: requeue → dead-letter queue
- [x] Add recovery task (runs every 5 min): retry dead-letter jobs
- Files: NEW `monitor/queue_health.py` (~120 LOC)
- Acceptance Criteria:
  - Health check returns status
  - Stuck jobs auto-escalated after 60 min
  - Recovery task attempts up to 5 times

### Deliverables
- JobQueue abstraction (Redis + Postgres + artifact store)
- 5-stage video pipeline with checkpoint resumption
- Job monitoring + health checks
- 100% test coverage (unit + integration)
- Documentation: `/docs/queue-architecture.md`

### Effort Estimate
- Sprint 1.1: **40 hours** (4 days, 1 dev + 1 data-engineer)
- Sprint 1.2: **35 hours** (3.5 days, 1 dev + 1 DevOps)
- **Total: 75 hours (1.9 sprints)**

### Risks
- BullMQ vs Celery selection (1 day exploration)
- Artifact storage network latency (mitigate with local cache)
- PostgreSQL connection pool saturation (monitor + tune)

---

## Epic 2: Desktop GPU Worker Bridge — Weeks 2-4 (3 sprints)

### Purpose
Connect local GPU resources (Windows Desktop) to VPS for distributed task execution. Unblock video rendering, avatar generation, voice synthesis.

### Scope

#### Sprint 2.1 (Week 2): GPU Worker API & Connection Tunnel
**Story 2.1.1:** Build FastAPI GPU worker on Desktop
- [x] Create Windows service: `C:\AutoFlow\gpu-worker\main.py`
- [x] Define GPU worker API endpoints:
  - POST `/api/avatar/generate` → Duix-Avatar
  - POST `/api/voice/synthesize` → VibeVoice
  - POST `/api/matting` → RobustVideoMatting
  - POST `/api/image/generate` → imaginAIry / mmagic
  - POST `/api/video/render` → Pixelle-Video
  - GET `/api/health`
- [x] Implement health check (GPU temp, VRAM %, uptime)
- [x] Add request validation (input format, max duration/size)
- Files: NEW Windows service `gpu_worker_api.py` (~250 LOC)
- Acceptance Criteria:
  - All 5 endpoints respond to POST
  - Health check returns GPU stats
  - Request validation rejects invalid inputs

**Story 2.1.2:** Setup Cloudflare Tunnel (VPS → Desktop)
- [x] Install cloudflared on Desktop
- [x] Configure tunnel: `tunnel.yml` routes `gpu.autoflow.local` → localhost:8500
- [x] Setup reverse proxy on VPS: `nginx` routes `/gpu/*` → tunnel endpoint
- [x] Add authentication (token in header, validate on Desktop)
- Files: NEW `gpu-worker-tunnel.yml`, MODIFY VPS nginx config
- Acceptance Criteria:
  - `curl https://gpu.autoflow.local/api/health` returns 200
  - Token validation works
  - Tunnel survives 24h without restart

**Story 2.1.3:** Add GPU worker client in AutoFlow
- [x] Create GPU worker client (`core/gpu_worker_client.py`)
- [x] Implement async methods: `avatar_generate()`, `voice_synthesize()`, etc.
- [x] Add retry logic + fallback (Desktop offline → skip GPU, return text error)
- [x] Implement timeout (30s per task, 5min for video render)
- Files: NEW `core/gpu_worker_client.py` (~180 LOC)
- Acceptance Criteria:
  - Client calls Desktop GPU worker
  - Desktop offline → graceful fallback
  - Timeout kills stuck requests

#### Sprint 2.2 (Week 3): GPU Component Integration
**Story 2.2.1:** Integrate Duix-Avatar for avatar generation
- [x] Setup Duix-Avatar on Desktop (download model, test locally)
- [x] Create wrapper: `gpu_worker_api.py → duix_avatar_bridge.py`
- [x] Implement `/api/avatar/generate` endpoint:
  - Input: { prompt: str, style: str, duration: int }
  - Output: { video_path: str, duration: int }
- [x] Add caching (cache avatar by hash of prompt + style)
- Files: NEW `gpu-worker-bridges/duix_avatar.py` (~100 LOC)
- Acceptance Criteria:
  - Generate 1 avatar in < 2 min
  - Cache hits return instant response
  - Output video valid

**Story 2.2.2:** Integrate VibeVoice for voice synthesis
- [x] Setup VibeVoice on Desktop
- [x] Create wrapper: `/api/voice/synthesize` endpoint
- [x] Implement voice params: { text: str, speaker_id: int, speed: float }
- [x] Add audio format selection (WAV, MP3)
- Files: NEW `gpu-worker-bridges/vibevice.py` (~80 LOC)
- Acceptance Criteria:
  - Generate audio from text in < 30s
  - Multiple speakers supported
  - Output audio quality acceptable

**Story 2.2.3:** Integrate RobustVideoMatting for background removal
- [x] Setup RobustVideoMatting on Desktop
- [x] Create wrapper: `/api/matting` endpoint
- [x] Input: video file, Output: { mask_path: str, matted_path: str }
- [x] Add batch processing (multiple frames parallel)
- Files: NEW `gpu-worker-bridges/rvm.py` (~100 LOC)
- Acceptance Criteria:
  - Process 30-second video in < 5 min
  - Mask quality acceptable (segmentation errors < 5%)
  - Output mask + original video

**Story 2.2.4:** Integrate image + video rendering
- [x] Setup imaginAIry / mmagic on Desktop
- [x] Create `/api/image/generate` endpoint
- [x] Create `/api/video/render` endpoint (Pixelle-Video)
- [x] Implement frame rate + resolution controls
- Files: NEW `gpu-worker-bridges/image_gen.py`, `video_render.py` (~150 LOC)
- Acceptance Criteria:
  - Image generation in < 1 min
  - Video rendering supports 1080p 30fps

#### Sprint 2.3 (Week 4): Video Pipeline → GPU Integration
**Story 2.3.1:** Integrate GPU tasks into video workflow
- [x] Modify `workflows/video.py`:
  - Stage 1: Script → Audio (call gpu_worker `/api/voice/synthesize`)
  - Stage 3: Video → Matting (call gpu_worker `/api/matting`)
  - Stage 4: Matting → Avatar (call gpu_worker `/api/avatar/generate`)
  - Stage 5: Render output (call gpu_worker `/api/video/render`)
- [x] Update job orchestrator to route GPU tasks to Desktop
- Files: MODIFY `workflows/video.py`, MODIFY `queue/job_queue.py` (~120 LOC changes)
- Acceptance Criteria:
  - Full video pipeline uses GPU tasks
  - GPU offline → workflow gracefully degrades
  - End-to-end video generation works

**Story 2.3.2:** Add GPU task retry + failover
- [x] Implement GPU task retry (3 attempts before skip)
- [x] Add fallback strategy: skip GPU task, use CPU fallback
- [x] Log GPU failures + uptime metrics
- Files: MODIFY `core/gpu_worker_client.py` (~60 LOC)
- Acceptance Criteria:
  - GPU task fails 3x → skip and continue
  - Metrics show GPU availability %

**Story 2.3.3:** Testing + validation
- [x] End-to-end test: script → audio → avatar → matting → render → output video
- [x] GPU offline simulation test
- [x] Stress test: 10 concurrent video jobs
- Files: NEW `tests/test_gpu_integration.py` (~200 LOC)
- Acceptance Criteria:
  - All GPU components integrated
  - E2E test passes
  - 10 concurrent jobs complete without error

### Deliverables
- GPU worker API (5 endpoints on Desktop)
- Cloudflare Tunnel (secure VPS ↔ Desktop connection)
- GPU client + component bridges (5 components)
- Video workflow GPU integration
- E2E testing suite
- Documentation: `/docs/gpu-worker-setup.md`

### Effort Estimate
- Sprint 2.1: **35 hours** (3.5 days, 1 dev + 1 DevOps)
- Sprint 2.2: **50 hours** (5 days, 1-2 devs)
- Sprint 2.3: **40 hours** (4 days, 1 dev + 1 QA)
- **Total: 125 hours (3.1 sprints)**

### Risks
- Desktop GPU availability/uptime (mitigate with detailed health checks)
- Tunnel latency (test with large video files)
- Component compatibility (Duix-Avatar, VibeVoice versions)
- Windows service reliability (implement watchdog)

---

## Epic 3: LLM-Router-AIOX Alignment & Optimization — Weeks 4-5 (1-2 sprints)

### Purpose
Replace AutoFlow's direct Ollama → Claude fallback with LLM-Router-AIOX's complexity-driven routing. Enable cost tracking, circuit breaking, and intelligent model selection.

### Scope

#### Sprint 3.1 (Week 4-5): Router Integration & Optimization
**Story 3.1.1:** Analyze LLM-Router-AIOX API
- [x] Review `/root/llm-router-aiox/` architecture
- [x] Document routing decision API:
  - POST `/route` → { model: str, complexity: int, cost_estimate: float }
  - Query params: `task_type`, `context_length`, `quality_tier`
- [x] Understand complexity scoring (1-15 scale)
- [x] Map AutoFlow tasks → complexity scores
- Files: NEW `docs/llm-router-analysis.md` (~100 LOC)
- Acceptance Criteria:
  - Router API fully documented
  - Complexity mapping complete
  - Test calls work

**Story 3.1.2:** Replace router.py with LLM-Router-AIOX
- [x] Refactor `core/router.py`:
  - Remove direct Ollama/Claude calls
  - Add LLM-Router request: `POST http://127.0.0.1:3200/route`
  - Use returned model + complexity score
  - Implement circuit breaker (if LLM-Router fails, fallback to cached routing)
- [x] Maintain backward-compatible `call_llm_sync(prompt, system, ...)`
- [x] Add cost tracking to router log
- Files: MODIFY `core/router.py` (~150 LOC changes)
- Acceptance Criteria:
  - LLM-Router successfully scores requests
  - Routing decisions log complexity + cost
  - Fallback works when LLM-Router down

**Story 3.1.3:** Implement cost tracking + budgeting
- [x] Create cost tracker (`core/cost_tracker.py`):
  - Track per-model costs (Ollama=$0, Claude-3-5-Sonnet=$0.03/1K output)
  - Implement budget ceiling (daily/monthly)
  - Alert when budget 80% exhausted
- [x] Add Paperclip integration:
  - Register AutoFlow as "Company" in Paperclip
  - Track AutoFlow executions as "tickets"
  - Apply Paperclip budget gates
- [x] Implement cost report: `/api/admin/cost-report`
- Files: NEW `core/cost_tracker.py` (~150 LOC), MODIFY `api/server.py`
- Acceptance Criteria:
  - Cost tracked per-request
  - Daily budget enforced
  - Alert fires at 80%

**Story 3.1.4:** Add complexity-aware retries
- [x] Implement retry strategy based on complexity + task importance:
  - Low complexity (1-5): no retry, fail fast
  - Medium (6-10): 1 retry with different model
  - High (11-15): 2 retries, escalate to Opus if available
- [x] Update validator to use complexity scores
- Files: MODIFY `core/validator.py` (~80 LOC)
- Acceptance Criteria:
  - Retry strategy respects complexity
  - High-complexity failures logged
  - Cost impact minimized

**Story 3.1.5:** Testing + validation
- [x] Unit tests: LLM-Router API calls, circuit breaker, cost tracking
- [x] Integration tests: full router → LLM-Router → execution flow
- [x] Load test: 100 concurrent requests, verify routing + cost tracking
- [x] Fallback test: disable LLM-Router, verify cached routing
- Files: NEW `tests/test_llm_router_integration.py` (~200 LOC)
- Acceptance Criteria:
  - All tests pass
  - 100 concurrent requests complete
  - Cost tracking accurate to $0.01

### Deliverables
- LLM-Router-AIOX integration (replace direct calls)
- Cost tracking + budgeting
- Paperclip adapter registration
- Complexity-aware retry logic
- 200+ LOC tests
- Documentation: `/docs/routing-strategy.md`

### Effort Estimate
- Sprint 3.1: **30 hours** (3 days, 1 dev)
- Sprint 3.2 (optional): **25 hours** (2.5 days, optimizations + monitoring)
- **Total: 55 hours (1.4 sprints)**

### Risks
- LLM-Router API changes (monitor releases)
- Cost tracking accuracy (audit daily reports)
- Paperclip integration complexity (coordinate with Paperclip team)

---

## Parallel Execution Timeline

```
Week 1:  Epic 1.1 (Queue foundation) — 40h
Week 2:  Epic 1.1 → 1.2 (Persistence) + Epic 2.1 (GPU worker API) — 40h + 35h
Week 3:  Epic 1.2 (continue) + Epic 2.2 (GPU components) — 35h + 50h
Week 4:  Epic 2.3 (GPU integration) + Epic 3.1 (Router alignment) — 40h + 30h
Week 5:  Epic 3.1 (complete) + Integration testing — 30h + 20h
Week 6:  Buffer + E2E testing + documentation
Week 7:  Load testing + production readiness
Week 8:  Deployment + monitoring + knowledge transfer
```

### Squad Allocation

| Squad | Epic | Lead | Members | Start |
|-------|------|------|---------|-------|
| **Infrastructure Squad** | Epic 1 | @data-engineer | 1 dev + 1 data-engineer | Week 1 |
| **GPU Squad** | Epic 2 | @dev | 2 devs + 1 DevOps | Week 2 |
| **Routing Squad** | Epic 3 | @architect | 1 dev + 1 architect | Week 4 |

---

## Success Criteria

### Functional (Phase 2 Complete)
- [ ] BullMQ job queue fully operational (enqueue → checkpoint → resume)
- [ ] Desktop GPU worker connected + all 5 components working
- [ ] Video pipeline end-to-end: script → audio → avatar → matting → render
- [ ] LLM-Router-AIOX routing decisions active (complexity scoring)
- [ ] Cost tracking accurate + budget gates enforced
- [ ] 100+ test cases passing (unit + integration + E2E)

### Non-Functional
- [ ] Job resumption latency: < 5 sec (from checkpoint)
- [ ] GPU task latency: < 2 min (avatar), < 5 min (video render)
- [ ] GPU availability: > 95% uptime (with health checks)
- [ ] Router latency: < 100ms (LLM-Router lookup)
- [ ] Cost tracking: ±$0.01 accuracy
- [ ] System resilience: survives GPU offline, LLM-Router offline, partial failures

### Quality
- [ ] Code coverage: > 85% (unit + integration)
- [ ] Documentation: architecture + setup + troubleshooting
- [ ] Production readiness: health checks, monitoring, alerting
- [ ] Knowledge transfer: runbooks for ops team

---

## Dependency Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ Epic 1: BullMQ Pipeline (Weeks 1-2)                          │
│ ✅ Job queue foundation                                      │
│ ✅ 5-stage video pipeline schema                             │
│ ✅ Checkpoint persistence (Postgres)                         │
│ ✅ Artifact storage                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────────┐
│ Epic 2: GPU Worker Bridge (Weeks 2-4)                        │
│ ✅ FastAPI GPU worker on Desktop                             │
│ ✅ Cloudflare Tunnel (VPS ↔ Desktop)                         │
│ ✅ 5 GPU components (avatar, voice, matting, image, render)  │
│ ✅ Video workflow GPU integration                            │
│ [DEPENDS ON: Epic 1 job queue schema]                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────────┐
│ Epic 3: LLM-Router Alignment (Weeks 4-5)                     │
│ ✅ Router API integration                                    │
│ ✅ Complexity-based model selection                          │
│ ✅ Cost tracking + budgeting                                 │
│ ✅ Paperclip governance                                      │
│ [DEPENDS ON: Epic 1 & 2 provide job structure]               │
└──────────────────────────────────────────────────────────────┘
```

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| BullMQ version conflicts | Medium | High | Evaluate + test early (Sprint 1.1) |
| Desktop GPU offline | High | High | Health checks + graceful fallback (Story 2.1.3) |
| Tunnel latency on large files | Medium | Medium | Test with 1GB videos (Story 2.1.2) |
| LLM-Router API instability | Low | Medium | Circuit breaker + cached fallback (Story 3.1.2) |
| PostgreSQL checkpoint write contention | Medium | Low | Connection pooling + monitoring (Story 1.1.2) |
| Cost tracking accuracy | Low | High | Daily audit + reconciliation (Story 3.1.3) |

---

## Definition of Done (Per Story)

- [ ] Code review passed (coderabbit)
- [ ] Tests: 100% acceptance criteria coverage
- [ ] Documentation: README + architecture diagram
- [ ] Integration tested with adjacent stories
- [ ] Acceptance criteria met (verified by @qa)
- [ ] No regressions (automated + manual testing)
- [ ] Performance benchmarks met (if applicable)
- [ ] Security review passed (if applicable)
- [ ] Merged to main, deployed to staging

---

## Post-Phase-2 (Phase 3 — Not in Scope)

After Phase 2 completion, Phase 3 enables:

1. **RAGFlow Integration** — Vector search for research workflows
2. **Paperclip Full Integration** — Governance + budget gates everywhere
3. **Advanced Caching** — Semantic cache for similar queries (via LLM-Router)
4. **Multi-GPU Scaling** — Distribute GPU tasks across multiple machines
5. **Observability Dashboard** — Real-time job status + cost tracking UI

---

## Glossary

| Term | Definition |
|------|-----------|
| **BullMQ** | Job queue library (Redis-backed, distributed task scheduling) |
| **Checkpoint** | Saved state at end of pipeline stage (enables resume) |
| **Complexity Score** | 1-15 rating from LLM-Router (determines model + cost) |
| **Circuit Breaker** | Fail-fast pattern (if service fails N times, skip for M seconds) |
| **GPU Worker** | Desktop FastAPI service exposing GPU components via HTTP |
| **Tunnel** | Cloudflare Tunnel (secure connection VPS ↔ Desktop) |
| **Artifact** | Intermediate output (audio, video, image) stored in S3/Supabase |
| **Stage** | Pipeline phase (e.g., Script → Audio is Stage 1) |

---

**Document Version:** 1.0  
**Last Updated:** April 11, 2026  
**Maintainer:** @pm (Morgan)  
**Review Cycle:** Weekly (Mondays)

