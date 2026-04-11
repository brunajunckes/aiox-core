# AutoFlow Phase 2 — Sprint Cards & Execution Plan

**Phase Start:** April 14, 2026 (Week 14)  
**Phase End:** June 8, 2026 (Week 21)  
**Duration:** 8 weeks

---

## Sprint 1.1: BullMQ Queue Foundation (Week 1 of 8)

### Sprint Metadata
- **Duration:** April 14-20, 2026
- **Team:** Infrastructure Squad (1 @dev, 1 @data-engineer)
- **Effort:** 40 person-hours (1 person-week)
- **Dependency:** None (critical path start)
- **Blocks:** Epic 1.2, Epic 2.3, Epic 3.1

### Stories (3 Total)

#### Story 1.1.1: Job Queue Foundation
**Effort:** 34 hours  
**Acceptance Criteria:**
- [x] JobQueue class: `enqueue()`, `get_status()`, `retry()` methods
- [x] 5-stage pipeline schema defined + documented
- [x] Retry logic: exponential backoff (1s, 2s, 4s, 8s, 16s)
- [x] Job state machine: PENDING → QUEUED → EXECUTING → DONE / FAILED
- [x] 15+ unit tests (schema, lifecycle, retry)
- [x] Code review passed

**Key Milestones:**
- Day 1: Design + schema finalized
- Day 2: JobQueue class skeleton + serialization
- Day 3: Retry logic + tests
- Day 4: Integration with video.py + API endpoints

**Owner:** @dev  
**Reviewer:** @architect

#### Story 1.1.2: PostgreSQL Checkpoint Store
**Effort:** 8 hours  
**Acceptance Criteria:**
- [x] Schema created: `job_checkpoints` table
- [x] Methods: `save_checkpoint()`, `load_checkpoint()`, `list_checkpoints()`
- [x] Artifact path storage (S3/Supabase paths)
- [x] TTL cleanup: delete records > 30 days
- [x] 8+ tests (CRUD, TTL, edge cases)

**Key Milestones:**
- Day 1: Schema design + ERD
- Day 2: Store implementation
- Day 3: Cleanup + tests
- Day 4: Integration test with JobQueue

**Owner:** @data-engineer  
**Reviewer:** @architect

#### Story 1.1.3: Video Workflow Integration
**Effort:** 10 hours (parallel with 1.1.1-1.1.2)  
**Acceptance Criteria:**
- [x] Refactor `workflows/video.py` to use JobQueue
- [x] Create `video_pipeline_orchestrator()` function
- [x] Enqueue returns job_id
- [x] API endpoints: POST /api/video, GET /api/video/{id}/status
- [x] 8+ integration tests (happy path, error cases)

**Key Milestones:**
- Day 2: Orchestrator function drafted
- Day 3: API endpoints implemented
- Day 4: Integration tests + demo

**Owner:** @dev  
**Reviewer:** @qa

### Daily Standup Format
```
Monday (Day 1): Schema + architecture review
Tuesday (Day 2): JobQueue + Store implementations
Wednesday (Day 3): Retry logic + integration starts
Thursday (Day 4): API integration + full testing
Friday (Day 5): Code review + refinement
```

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Code reviewed (coderabbit) + approved
- [ ] 25+ tests passing (unit + integration)
- [ ] No regressions on Phase 1 code
- [ ] Documentation: `/docs/job-queue-design.md`
- [ ] Merged to main branch

### Risk Register
| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| BullMQ vs Celery choice delays | Medium | Medium | Do POC on Day 1 |
| PostgreSQL connection pool issues | Low | High | Test with 20 concurrent connections |
| Job serialization edge cases | Low | Medium | Test 50+ schema variants |

---

## Sprint 1.2: Persistence & Observability (Week 2 of 8)

### Sprint Metadata
- **Duration:** April 21-27, 2026
- **Team:** Infrastructure Squad + DevOps (1 @dev, 1 @devops)
- **Effort:** 35 person-hours
- **Dependency:** Sprint 1.1 (MUST complete first)
- **Blocks:** Epic 2.3, production deployment

### Stories (3 Total)

#### Story 1.2.1: Artifact Storage Layer
**Effort:** 15 hours  
**Acceptance Criteria:**
- [x] Artifact manager: `upload()`, `download()`, `delete()`
- [x] Support multiple backends (S3 / Supabase / Docker volume)
- [x] Garbage collection: delete after 7 days post-completion
- [x] Artifact paths in checkpoint table
- [x] 8+ tests (upload, download, GC, edge cases)
- [x] Support large files (1GB+ video)

**Key Milestones:**
- Day 1: Backend selection + POC
- Day 2: Manager implementation
- Day 3: GC + large file tests
- Day 4: Integration with checkpoint store

**Owner:** @dev  
**Reviewer:** @devops

#### Story 1.2.2: Job Monitoring & Metrics
**Effort:** 15 hours  
**Acceptance Criteria:**
- [x] Job monitor service (tracks queue depth, latency per stage)
- [x] Prometheus metrics: `autoflow_job_duration_seconds`, `autoflow_queue_depth`
- [x] Admin dashboard: `/api/admin/jobs` (list all + drill down)
- [x] Metrics scrape endpoint: `/metrics`
- [x] 8+ tests (metrics export, dashboard pagination)
- [x] Dashboard shows: job_id, stage, progress%, artifacts

**Key Milestones:**
- Day 1: Monitor service skeleton
- Day 2: Metrics implementation
- Day 3: Dashboard endpoint
- Day 4: Tests + Prometheus integration

**Owner:** @dev + @devops  
**Reviewer:** @qa

#### Story 1.2.3: Queue Health & Recovery
**Effort:** 10 hours  
**Acceptance Criteria:**
- [x] Health endpoint: `/queue/health` (returns status JSON)
- [x] Stuck-job detection: jobs in state > 60 min
- [x] Auto-escalation: stuck → dead-letter queue
- [x] Recovery task: runs every 5 min, retries dead-letter (max 5x)
- [x] 8+ tests (health, escalation, recovery)

**Key Milestones:**
- Day 1: Health endpoint + stuck detection
- Day 2: Escalation logic
- Day 3: Recovery task + tests
- Day 4: E2E scenario (stuck job → recovery)

**Owner:** @dev  
**Reviewer:** @devops

### Daily Standup Format
```
Monday (Day 1): Artifact backend POC + health endpoint
Tuesday (Day 2): Manager + metrics implementation
Wednesday (Day 3): GC + monitoring tests
Thursday (Day 4): Recovery task + integration
Friday (Day 5): Code review + refinement
```

### Definition of Done
- [ ] All 3 stories completed (acceptance criteria)
- [ ] 20+ integration tests passing
- [ ] Code review + approved
- [ ] Performance: artifact upload < 2s, download < 1s
- [ ] Metrics: latency tracking accurate
- [ ] Documentation: `/docs/monitoring-strategy.md`
- [ ] Merged to main

### Handoff to Sprint 2.1
- Pass: JobQueue + monitoring ready for GPU worker integration
- Deliverable: Epic 1 complete + staging deployment tested

---

## Sprint 2.1: GPU Worker API & Tunnel (Week 2-3 of 8)

### Sprint Metadata
- **Duration:** April 21-27, 2026 (start) → May 4 (polish)
- **Team:** GPU Squad (2 @dev, 1 @devops)
- **Effort:** 35 person-hours
- **Dependency:** Parallel with 1.2 (no hard dependency)
- **Blocks:** Epic 2.2, Epic 2.3

### Stories (3 Total)

#### Story 2.1.1: FastAPI GPU Worker on Desktop
**Effort:** 20 hours  
**Acceptance Criteria:**
- [x] Windows service executable: `gpu-worker-service.exe`
- [x] FastAPI server on port 8500
- [x] 5 API endpoints: `/api/avatar/generate`, `/api/voice/synthesize`, `/api/matting`, `/api/image/generate`, `/api/video/render`
- [x] Health endpoint: `/api/health` (returns GPU stats: temp, VRAM%, uptime)
- [x] Request validation: Pydantic models, max size/duration checks
- [x] Error responses: 400 (validation), 503 (GPU unavailable)
- [x] 10+ tests (all endpoints + health check)

**Key Milestones:**
- Day 1: Windows service + FastAPI scaffold
- Day 2: All 5 endpoint stubs
- Day 3: Health check + validation
- Day 4: Tests + error handling
- Day 5: Windows service integration

**Owner:** 1 @dev (Windows focus)  
**Reviewer:** @devops

#### Story 2.1.2: Cloudflare Tunnel Setup
**Effort:** 10 hours  
**Acceptance Criteria:**
- [x] Install cloudflared on Desktop + VPS
- [x] Tunnel configured: `gpu.autoflow.local` → Desktop:8500
- [x] VPS nginx reverse proxy: `/gpu/*` → tunnel endpoint
- [x] Token authentication: custom `X-GPU-Token` header
- [x] Tunnel survives 24h without restart (stability)
- [x] Latency test: < 500ms roundtrip
- [x] 5+ tests (connectivity, auth, latency)

**Key Milestones:**
- Day 1: Cloudflare setup + tunnel creation
- Day 2: VPS nginx config
- Day 3: Token auth + testing
- Day 4: Stability + latency benchmarks
- Day 5: Load test (100 concurrent)

**Owner:** @devops  
**Reviewer:** @dev

#### Story 2.1.3: GPU Worker Client Library
**Effort:** 15 hours  
**Acceptance Criteria:**
- [x] AutoFlow module: `core/gpu_worker_client.py`
- [x] Async methods: `avatar_generate()`, `voice_synthesize()`, `matting()`, `image_generate()`, `video_render()`
- [x] Retry logic: 3 attempts, exponential backoff
- [x] Fallback: Desktop offline → graceful error + log
- [x] Timeout: 30s per task, 5min for video render
- [x] Circuit breaker: skip GPU tasks if offline > 5 min
- [x] 10+ tests (all methods, offline, timeout, circuit breaker)

**Key Milestones:**
- Day 2: Async client skeleton + methods
- Day 3: Retry + timeout logic
- Day 4: Offline handling + circuit breaker
- Day 5: Integration tests

**Owner:** 1 @dev (Python)  
**Reviewer:** @architect

### Daily Standup Format
```
Monday (Day 1): GPU worker setup + Cloudflare init
Tuesday (Day 2): FastAPI endpoints + tunnel config
Wednesday (Day 3): Auth + client library
Thursday (Day 4): Tests + integration
Friday (Day 5): Code review + refinement
```

### Definition of Done
- [ ] FastAPI worker + endpoints + health check
- [ ] Tunnel: stable, auth working, latency < 500ms
- [ ] Client library: all 5 methods, fallback, circuit breaker
- [ ] 25+ tests (unit + integration)
- [ ] Code review + approved
- [ ] Documentation: `/docs/gpu-worker-setup.md`
- [ ] Staging test: full client-server roundtrip

---

## Sprint 2.2: GPU Component Integration (Week 3-4 of 8)

### Sprint Metadata
- **Duration:** April 28 - May 11, 2026
- **Team:** GPU Squad (2-3 @dev)
- **Effort:** 50 person-hours
- **Dependency:** Sprint 2.1 (client library ready)
- **Blocks:** Epic 2.3

### Stories (4 Total)

#### Story 2.2.1: Duix-Avatar Integration
**Effort:** 12 hours  
**Acceptance Criteria:**
- [x] Duix-Avatar model downloaded + verified locally
- [x] Bridge: `gpu-worker-bridges/duix_avatar.py`
- [x] Endpoint: POST `/api/avatar/generate` { prompt, style, duration }
- [x] Response: { video_path, duration, quality }
- [x] Caching: hash(prompt + style) → instant response
- [x] Quality: acceptable avatar for < 2 min per request
- [x] 6+ tests (generation, caching, edge cases)

**Key Milestones:**
- Day 1: Model setup + local test
- Day 2: Bridge implementation
- Day 3: Caching layer
- Day 4: Tests + quality validation

**Owner:** 1 @dev  
**Reviewer:** @qa

#### Story 2.2.2: VibeVoice Integration
**Effort:** 10 hours  
**Acceptance Criteria:**
- [x] VibeVoice model setup (speakers, sample rates)
- [x] Bridge: `gpu-worker-bridges/vibevice.py`
- [x] Endpoint: POST `/api/voice/synthesize` { text, speaker_id, speed }
- [x] Multi-speaker support: 3+ speakers available
- [x] Quality: clear speech, natural prosody
- [x] Latency: < 30s for 1-min text
- [x] 6+ tests (synthesis, speakers, formats)

**Key Milestones:**
- Day 1: Model setup + speaker config
- Day 2: Bridge implementation
- Day 3: Multi-speaker support
- Day 4: Tests + quality check

**Owner:** 1 @dev  
**Reviewer:** @qa

#### Story 2.2.3: RobustVideoMatting Integration
**Effort:** 12 hours  
**Acceptance Criteria:**
- [x] RobustVideoMatting model setup
- [x] Bridge: `gpu-worker-bridges/rvm.py`
- [x] Endpoint: POST `/api/matting` { video_file }
- [x] Response: { mask_path, matted_path, quality_score }
- [x] Batch processing: parallel frame processing (GPU cores)
- [x] Latency: < 5 min for 30s video
- [x] Segmentation accuracy: < 5% error
- [x] 8+ tests (matting, batch, quality)

**Key Milestones:**
- Day 1: Model setup + single frame test
- Day 2: Bridge + batch processing
- Day 3: Quality validation + benchmarks
- Day 4: Tests + optimization

**Owner:** 1 @dev (GPU-intensive)  
**Reviewer:** @qa

#### Story 2.2.4: Image & Video Rendering
**Effort:** 16 hours  
**Acceptance Criteria:**
- [x] imaginAIry model setup
- [x] Bridge: `gpu-worker-bridges/image_gen.py` + `video_render.py`
- [x] Endpoints: `/api/image/generate` + `/api/video/render`
- [x] Image generation: { prompt, style, resolution } → image in < 1 min
- [x] Video rendering: { frames, fps, resolution } → video in < 5 min
- [x] Resolution: 1080p 30fps supported
- [x] 10+ tests (image, video, resolutions, edge cases)

**Key Milestones:**
- Day 1-2: Models setup + local testing
- Day 3: Bridge implementation
- Day 4: Rendering optimization
- Day 5: Tests + quality

**Owner:** 1-2 @dev  
**Reviewer:** @qa

### Daily Standup Format
```
Week 1 (Apr 28 - May 4):
  Mon: Avatar + Voice setup
  Tue: Avatar bridge + Voice bridge
  Wed: Matting setup + Image/Video bridge start
  Thu: Matting bridge + caching
  Fri: Integration tests + code review

Week 2 (May 5-11):
  Mon: Image/Video bridge completion
  Tue: All components tested locally
  Wed: GPU worker endpoints integration
  Thu: E2E component testing
  Fri: Code review + refinement
```

### Definition of Done
- [ ] 4 stories completed (all acceptance criteria)
- [ ] 25+ component tests passing
- [ ] All components working on Desktop GPU worker
- [ ] Code review + approved
- [ ] Latency benchmarks met (avatar 2min, voice 30s, render 5min)
- [ ] Documentation: `/docs/gpu-components.md`
- [ ] Merged to main

---

## Sprint 2.3: Video Pipeline GPU Integration (Week 4-5 of 8)

### Sprint Metadata
- **Duration:** May 5-18, 2026
- **Team:** GPU Squad (1-2 @dev) + QA (1 @qa)
- **Effort:** 40 person-hours
- **Dependency:** Sprint 1.1, 2.1, 2.2 (all complete)
- **Blocks:** Integration testing, production deployment

### Stories (3 Total)

#### Story 2.3.1: Integrate GPU Tasks into Video Workflow
**Effort:** 18 hours  
**Acceptance Criteria:**
- [x] Modify `workflows/video.py`:
  - Stage 1: Script → Audio (call gpu_worker `/api/voice/synthesize`)
  - Stage 3: Video → Matting (call gpu_worker `/api/matting`)
  - Stage 4: Matting → Avatar (call gpu_worker `/api/avatar/generate`)
  - Stage 5: Render + output (call gpu_worker `/api/video/render`)
- [x] Update job orchestrator to route GPU tasks to Desktop
- [x] Full video pipeline: script → spec → audio → avatar → matting → render → output
- [x] E2E test: script → final video (should work in < 15 min)
- [x] 8+ integration tests (happy path, partial failure)

**Key Milestones:**
- Day 1-2: Integrate voice synthesis (Stage 1)
- Day 3: Integrate matting + avatar (Stages 3-4)
- Day 4: Integrate render (Stage 5)
- Day 5: E2E tests + validation

**Owner:** 1 @dev  
**Reviewer:** @architect

#### Story 2.3.2: GPU Task Failover & Metrics
**Effort:** 12 hours  
**Acceptance Criteria:**
- [x] GPU task retry: 3 attempts per task before skip
- [x] Fallback strategy: skip GPU task, use CPU placeholder or text error
- [x] Graceful degradation: video workflow continues even if GPU offline
- [x] GPU metrics: availability %, uptime, errors per component
- [x] Logging: all GPU failures logged + visible in admin dashboard
- [x] 6+ tests (retry, failover, graceful degradation)

**Key Milestones:**
- Day 1: Retry logic + fallback
- Day 2: Graceful degradation testing
- Day 3: Metrics implementation
- Day 4: Tests + logging validation

**Owner:** 1 @dev  
**Reviewer:** @devops

#### Story 2.3.3: E2E Testing & Stress Test
**Effort:** 10 hours  
**Acceptance Criteria:**
- [x] E2E test: complete script → video pipeline
- [x] GPU offline simulation: pipeline degrades gracefully
- [x] Concurrent stress test: 10 parallel video jobs
- [x] Resource monitoring: GPU temp, VRAM%, network during stress
- [x] Performance: single job < 15 min, 10 jobs < 60 min total
- [x] 10+ test scenarios (E2E, offline, concurrent, resource)

**Key Milestones:**
- Day 1: E2E test framework
- Day 2-3: E2E test implementation + GPU offline
- Day 4: Stress test setup (10 parallel)
- Day 5: Resource monitoring + validation

**Owner:** 1 @qa  
**Reviewer:** @architect

### Daily Standup Format
```
Week 1 (May 5-11):
  Mon: Integrate stages 1 + 3
  Tue: Integrate stages 4 + 5
  Wed: E2E test framework + first run
  Thu: Retry logic + fallback
  Fri: Code review + refinement

Week 2 (May 12-18):
  Mon: Metrics implementation
  Tue: E2E scenarios (happy + sad paths)
  Wed: GPU offline simulation
  Thu: Stress test (10 parallel)
  Fri: Results analysis + code review
```

### Definition of Done
- [ ] 3 stories completed (all acceptance criteria)
- [ ] Full video pipeline GPU-integrated
- [ ] 20+ integration tests passing
- [ ] E2E tests: single job works, 10 concurrent works
- [ ] GPU offline: graceful degradation verified
- [ ] Performance: < 15 min per job, < 60 min for 10
- [ ] Code review + approved
- [ ] Documentation: `/docs/video-pipeline-gpu.md`
- [ ] Staging deployment ready

---

## Sprint 3.1: LLM-Router-AIOX Integration (Week 4-5 of 8)

### Sprint Metadata
- **Duration:** May 5-18, 2026 (parallel with Sprint 2.3)
- **Team:** Routing Squad (1 @dev, 1 @architect, 1 @qa)
- **Effort:** 30 person-hours
- **Dependency:** Phase 1 (router.py exists)
- **Blocks:** Cost optimization, production deployment

### Stories (5 Total)

#### Story 3.1.1: LLM-Router API Analysis
**Effort:** 7 hours  
**Acceptance Criteria:**
- [x] Document LLM-Router-AIOX `/route` API
- [x] API spec: GET `/route?task_type=X&context_length=Y` → { model, complexity (1-15), cost }
- [x] Map 20+ AutoFlow tasks to complexity scores (1-15)
- [x] Task complexity matrix: document rationale for each score
- [x] Design document: `/docs/complexity-mapping.md`
- [x] Code review of analysis + approved

**Key Milestones:**
- Day 1: API reverse-engineering + documentation
- Day 2-3: Map AutoFlow tasks → complexity
- Day 4: Design document + review

**Owner:** @architect  
**Reviewer:** @pm

#### Story 3.1.2: Replace router.py with LLM-Router-AIOX
**Effort:** 12 hours  
**Acceptance Criteria:**
- [x] Refactor `core/router.py`:
  - Remove direct Ollama/Claude calls
  - Call LLM-Router: POST to `/route` endpoint
  - Use returned model + complexity score
  - Maintain backward-compatible `call_llm_sync()` API
- [x] Circuit breaker: if LLM-Router fails, fallback to cached routing
- [x] Cost tracking: log model + complexity + cost per call
- [x] 10+ tests (routing decisions, fallback, cost logging)

**Key Milestones:**
- Day 1: Refactor design + architecture
- Day 2: Replace direct calls with LLM-Router
- Day 3: Circuit breaker + fallback
- Day 4: Tests + cost logging

**Owner:** @dev  
**Reviewer:** @architect

#### Story 3.1.3: Cost Tracking & Budgeting
**Effort:** 10 hours  
**Acceptance Criteria:**
- [x] Create `core/cost_tracker.py`
- [x] Track per-model costs: Ollama=$0, Claude-3.5-Sonnet=$0.03/1K output
- [x] Budget ceiling: daily/monthly limits configurable
- [x] Budget alert: fire at 80% exhausted
- [x] Paperclip integration: register AutoFlow "Company", track executions as "tickets"
- [x] Paperclip budget gates: enforce spending limits
- [x] API: `/api/admin/cost-report` (daily + monthly totals)
- [x] 8+ tests (cost calculation, budget alerts, Paperclip integration)

**Key Milestones:**
- Day 1: Cost tracker + budget design
- Day 2: Implement cost calculation + alerts
- Day 3: Paperclip integration
- Day 4: Cost report API + tests

**Owner:** @dev  
**Reviewer:** @devops

#### Story 3.1.4: Complexity-Aware Retries
**Effort:** 5 hours  
**Acceptance Criteria:**
- [x] Implement retry strategy based on complexity:
  - Low (1-5): no retry, fail fast
  - Medium (6-10): 1 retry with different model
  - High (11-15): 2 retries, escalate to Opus if available
- [x] Update `core/validator.py` to use complexity scores
- [x] Log retry decisions + costs
- [x] 5+ tests (retry strategy, cost impact)

**Key Milestones:**
- Day 1-2: Retry strategy logic
- Day 3: Validator integration
- Day 4: Tests + logging

**Owner:** @dev  
**Reviewer:** @architect

#### Story 3.1.5: Testing & Validation
**Effort:** 6 hours  
**Acceptance Criteria:**
- [x] Unit tests: router API calls, circuit breaker, cost tracking, retry strategy
- [x] Integration tests: call LLM-Router → execute inference → log cost
- [x] Load test: 100 concurrent requests, verify routing + cost accuracy
- [x] Fallback test: disable LLM-Router, verify cached routing works
- [x] Cost accuracy: ±$0.01 accuracy (audit daily)
- [x] 20+ test scenarios (happy path, failures, edge cases)

**Key Milestones:**
- Day 1: Unit test framework
- Day 2: Integration tests
- Day 3: Load test (100 concurrent)
- Day 4: Fallback + accuracy tests

**Owner:** @qa  
**Reviewer:** @dev

### Daily Standup Format
```
Week 1 (May 5-11):
  Mon: API analysis + complexity mapping
  Tue: Map AutoFlow tasks + design doc
  Wed: Replace router.py + circuit breaker
  Thu: Cost tracker + Paperclip integration
  Fri: Code review + refinement

Week 2 (May 12-18):
  Mon: Cost report API + retry strategy
  Tue: Validator integration
  Wed: Unit tests + integration tests
  Thu: Load test (100 concurrent)
  Fri: Fallback + accuracy tests + code review
```

### Definition of Done
- [ ] 5 stories completed (all acceptance criteria)
- [ ] LLM-Router-AIOX fully integrated
- [ ] Cost tracking accurate + budget enforced
- [ ] Paperclip governance active
- [ ] 25+ tests passing (unit + integration + load)
- [ ] Code review + approved
- [ ] Documentation: `/docs/routing-strategy.md`
- [ ] Staging deployment ready

---

## Week-by-Week Execution Overview

| Week | Epics Active | Focus | Team Size | Deliverables |
|------|-------------|-------|-----------|-------------|
| **1** (Apr 14-20) | Epic 1.1 | Queue foundation | 2 | JobQueue + checkpoint schema |
| **2** (Apr 21-27) | 1.1→1.2, 2.1 | Persistence + GPU API | 3-4 | Artifact store, GPU worker, tunnel |
| **3** (Apr 28-May 4) | 1.2, 2.2 | Monitoring + GPU components | 3-4 | Job monitoring, avatar, voice, matting |
| **4** (May 5-11) | 2.2→2.3, 3.1 | GPU integration + routing | 4 | GPU pipeline integration, LLM-Router |
| **5** (May 12-18) | 2.3, 3.1 | Video E2E + cost tracking | 4 | Full video GPU workflow, cost tracking |
| **6** (May 19-25) | Integration | Testing + perf | 3 | Performance baselines, documentation |
| **7** (May 26-Jun 1) | Integration | Load + chaos testing | 2 | Stress test results, runbooks |
| **8** (Jun 2-8) | Final | Sign-off + knowledge transfer | 2 | Team trained, staging ready |

---

## Go/No-Go Criteria by Milestone

### EOW Sprint 1.1 (April 20)
- **GO if:** JobQueue working, 15+ tests passing, schema merged
- **NO-GO if:** Core JobQueue not functional, retry logic broken

### EOW Sprint 1.2 (April 27)
- **GO if:** Artifact store + monitoring ready, job can resume from checkpoint
- **NO-GO if:** Checkpoint restoration fails, metrics not accurate

### EOW Sprint 2.1 (May 4)
- **GO if:** GPU worker API running, tunnel stable, client library complete
- **NO-GO if:** Tunnel latency > 1s, GPU worker crashes on startup

### EOW Sprint 2.3 (May 18)
- **GO if:** Full video pipeline GPU-integrated, E2E test passing, 10 concurrent jobs work
- **NO-GO if:** Any GPU component integration fails, E2E test hangs

### EOW Sprint 3.1 (May 18)
- **GO if:** LLM-Router integrated, cost tracking accurate, 100 concurrent load test passes
- **NO-GO if:** Router integration causes 404/500 errors, cost discrepancy > $0.10

### End of Phase 2 (June 8)
- **GO if:** All epics complete, E2E tests passing, performance baselines met, team trained
- **NO-GO if:** Critical bugs remain, documentation incomplete, performance below targets

---

**Document Version:** 1.0  
**Generated:** April 11, 2026  
**Maintainer:** @pm (Morgan)  
**Review Cycle:** Weekly (every Friday)

