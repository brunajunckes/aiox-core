# AutoFlow Phase 2 — Detailed Effort Matrix & Sprint Planning

**Phase Duration:** 8 weeks (Weeks 14-21 starting April 14, 2026)  
**Total Effort Budget:** 255 person-hours  
**Team Size:** 5-6 people across 3 squads

---

## Summary by Epic

| Epic | Total Hours | Person-Days | Weeks | Team |
|------|-------------|------------|-------|------|
| **Epic 1: BullMQ Pipeline** | 75 | 9.4 | 2 | Infra Squad (2) |
| **Epic 2: GPU Worker Bridge** | 125 | 15.6 | 3 | GPU Squad (2-3) |
| **Epic 3: LLM-Router Alignment** | 55 | 6.9 | 1-2 | Routing Squad (1-2) |
| **Integration & Testing** | 40 | 5 | 1 | All |
| **Documentation & Knowledge Transfer** | 25 | 3.1 | 0.5 | All |
| **TOTAL** | **320 hours** | **39.6 days** | **8 weeks** | **5-6 people** |

---

## Epic 1: BullMQ Pipeline Integration (75 hours)

### Sprint 1.1: Job Queue Foundation (40 hours)

| Story | Task | Est. Hours | Role | Dependency | Notes |
|-------|------|-----------|------|-----------|-------|
| 1.1.1 | Design job schema + stages | 6 | @architect | None | Diagram 5-stage video pipeline |
| 1.1.1 | Install BullMQ / evaluate Celery | 4 | @dev | Design | Proof-of-concept both |
| 1.1.1 | Build JobQueue abstraction | 12 | @dev | Selection | `enqueue()`, `status()`, `retry()` |
| 1.1.1 | Job serialization + tests | 6 | @dev | JobQueue | Unit tests for schema |
| 1.1.1 | Retry logic implementation | 6 | @dev | Serialization | Exponential backoff |
| 1.1.2 | Postgres checkpoint schema design | 4 | @data-engineer | Schema ready | 3NF normalization |
| 1.1.2 | Implement checkpoint store | 8 | @data-engineer | Schema | `save()`, `load()`, `list()` |
| 1.1.2 | TTL cleanup + tests | 4 | @dev | Store | Cron job, 30-day retention |
| 1.1.3 | Integrate queue into video.py | 6 | @dev | JobQueue + Store | Refactor workflow |
| 1.1.3 | Create video orchestrator | 5 | @dev | Integration | Enqueue 5-stage job |
| 1.1.3 | Status API endpoints | 5 | @dev | Orchestrator | `/api/video/{job_id}/status` |
| 1.1.3 | API tests + validation | 4 | @qa | Endpoints | Functional tests |

**Sprint 1.1 Deliverables:**
- JobQueue class (production-ready)
- Checkpoint store (PostgreSQL)
- 5-stage video pipeline schema
- API: POST /api/video, GET /api/video/{id}/status
- 25+ unit + integration tests

**Team Capacity:** 1 @dev + 1 @data-engineer (4 days)

---

### Sprint 1.2: Persistence & Observability (35 hours)

| Story | Task | Est. Hours | Role | Dependency | Notes |
|-------|------|-----------|------|-----------|-------|
| 1.2.1 | Artifact storage backend selection | 3 | @architect | None | S3 vs Supabase vs Docker volume |
| 1.2.1 | Artifact manager implementation | 8 | @dev | Selection | Upload, download, delete |
| 1.2.1 | Garbage collection + tests | 4 | @dev | Manager | Cron cleanup, retention policy |
| 1.2.2 | Job monitor service | 5 | @dev | Queue ready | Track depth, latency, errors |
| 1.2.2 | Prometheus metrics | 6 | @devops | Monitor | Scrape endpoint, dashboard |
| 1.2.2 | Admin dashboard endpoint | 4 | @dev | Metrics | List jobs, stages, artifacts |
| 1.2.2 | Dashboard tests | 3 | @qa | Endpoints | Functional + load tests |
| 1.2.3 | Queue health checks | 5 | @dev | JobQueue | `/queue/health` endpoint |
| 1.2.3 | Stuck-job detection + escalation | 4 | @dev | Health | Auto-escalate > 60 min |
| 1.2.3 | Recovery task implementation | 4 | @dev | Escalation | Retry dead-letter jobs |
| 1.2.3 | Health + recovery tests | 3 | @qa | Recovery | Full lifecycle tests |

**Sprint 1.2 Deliverables:**
- Artifact storage layer (S3/Supabase)
- Job monitoring service + Prometheus metrics
- Admin dashboard (/api/admin/jobs)
- Queue health + auto-recovery
- 20+ integration tests

**Team Capacity:** 1 @dev + 1 @devops (3.5 days)

---

## Epic 2: Desktop GPU Worker Bridge (125 hours)

### Sprint 2.1: GPU Worker API & Connection Tunnel (35 hours)

| Story | Task | Est. Hours | Role | Dependency | Notes |
|-------|------|-----------|------|-----------|-------|
| 2.1.1 | Windows service setup | 4 | @devops | None | Create executable, SC config |
| 2.1.1 | FastAPI GPU worker skeleton | 5 | @dev | Setup | Async server, request routing |
| 2.1.1 | GPU API endpoints (5 endpoints) | 8 | @dev | Skeleton | Stubs for all 5 components |
| 2.1.1 | Health check endpoint | 4 | @dev | Endpoints | GPU temp, VRAM %, uptime |
| 2.1.1 | Request validation | 6 | @dev | Endpoints | Pydantic models, error handling |
| 2.1.1 | GPU worker tests | 4 | @qa | Validation | Unit + health check tests |
| 2.1.2 | Cloudflare Tunnel setup | 5 | @devops | None | Install, configure, test |
| 2.1.2 | VPS nginx reverse proxy | 4 | @devops | Tunnel | Route /gpu/* → tunnel |
| 2.1.2 | Token authentication | 4 | @dev | Reverse proxy | Custom header validation |
| 2.1.3 | GPU worker client library | 7 | @dev | GPU API ready | Async client, timeouts |
| 2.1.3 | Retry + fallback logic | 5 | @dev | Client | 3x retry, graceful degradation |
| 2.1.3 | Client tests + integration tests | 4 | @qa | Client + Logic | Mock Desktop, test offline mode |

**Sprint 2.1 Deliverables:**
- FastAPI GPU worker (Windows)
- Cloudflare Tunnel + VPS integration
- GPU worker client (AutoFlow)
- Auth, health checks, fallback logic
- 15+ integration tests

**Team Capacity:** 1-2 @dev + 1 @devops (3.5 days)

---

### Sprint 2.2: GPU Component Integration (50 hours)

| Story | Task | Est. Hours | Role | Dependency | Notes |
|-------|------|-----------|------|-----------|-------|
| 2.2.1 | Duix-Avatar setup + testing | 6 | @dev | GPU worker ready | Download model, verify locally |
| 2.2.1 | Avatar bridge implementation | 8 | @dev | Setup | `/api/avatar/generate` wrapper |
| 2.2.1 | Avatar caching layer | 5 | @dev | Bridge | Cache by hash(prompt + style) |
| 2.2.1 | Avatar tests | 4 | @qa | Caching | E2E avatar generation |
| 2.2.2 | VibeVoice setup + testing | 5 | @dev | GPU worker ready | Download model, test speakers |
| 2.2.2 | Voice synthesis bridge | 8 | @dev | Setup | `/api/voice/synthesize` wrapper |
| 2.2.2 | Multi-speaker support | 4 | @dev | Bridge | Speaker selection, quality tiers |
| 2.2.2 | Voice tests | 3 | @qa | Support | Text-to-speech quality check |
| 2.2.3 | RobustVideoMatting setup | 5 | @dev | GPU worker ready | Download model, video test |
| 2.2.3 | Matting bridge implementation | 8 | @dev | Setup | `/api/matting` wrapper |
| 2.2.3 | Batch processing for frames | 5 | @dev | Bridge | Parallel processing (GPU cores) |
| 2.2.3 | Matting tests | 4 | @qa | Batch processing | Segmentation quality check |
| 2.2.4 | Image generation setup (imaginAIry) | 4 | @dev | GPU worker ready | Download, test generations |
| 2.2.4 | Image generation bridge | 6 | @dev | Setup | `/api/image/generate` wrapper |
| 2.2.4 | Video rendering setup (Pixelle) | 4 | @dev | GPU worker ready | Download, fps/resolution config |
| 2.2.4 | Video render bridge | 6 | @dev | Setup | `/api/video/render` wrapper |

**Sprint 2.2 Deliverables:**
- 5 GPU component bridges (avatar, voice, matting, image, video)
- Caching for avatar + images
- Batch processing for video
- 20+ component tests
- Each component E2E tested

**Team Capacity:** 2-3 @dev (5 days)

---

### Sprint 2.3: Video Pipeline → GPU Integration (40 hours)

| Story | Task | Est. Hours | Role | Dependency | Notes |
|-------|------|-----------|------|-----------|-------|
| 2.3.1 | Integrate voice synthesis (Stage 1) | 6 | @dev | Voice bridge ready | Script → audio workflow step |
| 2.3.1 | Integrate matting (Stage 3) | 6 | @dev | Matting bridge ready | Video → mask workflow step |
| 2.3.1 | Integrate avatar (Stage 4) | 6 | @dev | Avatar bridge ready | Avatar generation in pipeline |
| 2.3.1 | Integrate render (Stage 5) | 6 | @dev | Video render ready | Final composition + output |
| 2.3.1 | E2E workflow test | 5 | @qa | All integration done | Full script → video pipeline |
| 2.3.2 | GPU task retry logic | 4 | @dev | All stages integrated | 3x retry, skip on failure |
| 2.3.2 | GPU failover strategy | 3 | @dev | Retry logic | Graceful degradation |
| 2.3.2 | GPU metrics + logging | 3 | @dev | Failover | Availability tracking |
| 2.3.3 | Concurrent job stress test | 5 | @qa | Metrics ready | 10 parallel videos |
| 2.3.3 | Load test + resource monitoring | 4 | @qa | Stress test | GPU + network bottlenecks |

**Sprint 2.3 Deliverables:**
- Full video pipeline GPU-integrated
- GPU failover + retry logic
- Metrics + availability tracking
- E2E + stress test suite
- Production-ready video workflow

**Team Capacity:** 2 @dev + 1 @qa (4 days)

---

## Epic 3: LLM-Router-AIOX Alignment (55 hours)

### Sprint 3.1: Router Integration & Optimization (30 hours)

| Story | Task | Est. Hours | Role | Dependency | Notes |
|-------|------|-----------|------|-----------|-------|
| 3.1.1 | LLM-Router API analysis | 5 | @architect | None | Document routing decision API |
| 3.1.1 | Complexity mapping (AutoFlow tasks) | 5 | @architect | API analyzed | Map 20+ tasks to 1-15 scores |
| 3.1.1 | Analysis document | 2 | @analyst | Mapping done | Write up findings |
| 3.1.2 | Replace router.py (core logic) | 8 | @dev | Analysis done | Remove direct calls, add LLM-Router |
| 3.1.2 | Circuit breaker implementation | 4 | @dev | Core replaced | Cache routing decisions |
| 3.1.2 | Router fallback tests | 3 | @qa | Circuit breaker | LLM-Router offline scenario |
| 3.1.3 | Cost tracking module | 6 | @dev | Router ready | Per-model costs, budget ceiling |
| 3.1.3 | Paperclip integration | 5 | @dev | Cost tracking | Register AutoFlow, track tickets |
| 3.1.3 | Cost report API | 4 | @dev | Paperclip done | `/api/admin/cost-report` |
| 3.1.3 | Budget alert system | 3 | @dev | Report ready | Alert at 80% monthly budget |
| 3.1.4 | Complexity-aware retries | 4 | @dev | Cost tracking done | Retry strategy per complexity |
| 3.1.5 | Unit + integration tests | 8 | @qa | All implementation done | Router, cost, Paperclip, retry |
| 3.1.5 | Load test (100 concurrent) | 5 | @qa | Unit tests pass | Routing + cost tracking at scale |

**Sprint 3.1 Deliverables:**
- LLM-Router-AIOX integration (production)
- Cost tracking + budgeting
- Paperclip governance integration
- Complexity-aware retry strategy
- 30+ tests (unit + integration + load)

**Team Capacity:** 1 @dev + 1 @architect + 1 @qa (3 days)

---

### Sprint 3.2 (Optional): Optimization & Monitoring (25 hours)

| Story | Task | Est. Hours | Role | Dependency | Notes |
|-------|------|-----------|------|-----------|-------|
| 3.2.1 | Caching layer (semantic) | 6 | @dev | LLM-Router integrated | Cache similar queries |
| 3.2.1 | Cache invalidation strategy | 3 | @dev | Caching done | TTL-based, event-driven |
| 3.2.2 | Monitoring dashboard | 5 | @dev | Cost tracking ready | Real-time routing decisions + costs |
| 3.2.2 | Alerting rules (Prometheus) | 4 | @devops | Dashboard done | Alert on budget, latency, failures |
| 3.2.3 | Documentation (routing strategy) | 4 | @analyst | All done | Write runbooks, troubleshooting |
| 3.2.3 | Knowledge transfer session | 3 | @pm | Documentation done | Team training |

**Sprint 3.2 Deliverables:**
- Semantic caching layer
- Monitoring dashboard + alerting
- Operational documentation
- Team knowledge transfer

**Team Capacity:** 1 @dev + 1 @devops + support (2.5 days, optional)

---

## Integration & Testing (40 hours)

| Task | Est. Hours | Role | Dependency | Notes |
|------|-----------|------|-----------|-------|
| End-to-end system test (all epics) | 8 | @qa | All epics done | Script → video with GPU + routing |
| Performance benchmarks | 6 | @qa | E2E test done | Latency, throughput, cost per job |
| Regression testing | 8 | @qa | Performance done | Ensure Phase 1 not broken |
| Chaos testing (failure scenarios) | 6 | @qa | Regression done | GPU offline, Router down, DB failure |
| Production readiness review | 6 | @architect | All testing done | Checklist: monitoring, alerting, runbooks |
| Load testing (sustained 50 jobs) | 6 | @qa | Readiness done | Stability over 24 hours |

**Deliverables:**
- Comprehensive test suite (100+ tests)
- Performance baselines
- Operational runbooks
- Production sign-off

**Team Capacity:** 1 @qa + @architect (1 week, parallel with final sprints)

---

## Documentation & Knowledge Transfer (25 hours)

| Task | Est. Hours | Role | Dependency | Notes |
|------|-----------|------|-----------|-------|
| Architecture documents (3 epics) | 6 | @analyst | All epics done | Overview + data flow diagrams |
| Setup guides (BullMQ, GPU worker, Router) | 6 | @pm | Implementation done | Step-by-step deployment |
| Troubleshooting runbooks | 5 | @devops | Testing done | Common issues + solutions |
| API documentation (OpenAPI/Swagger) | 4 | @dev | All APIs done | Auto-generated from code |
| Video tutorial (5-10 min) | 2 | @pm | Guides done | Screen recording of full workflow |
| Knowledge transfer session (team) | 2 | @pm | All docs done | 2-hour interactive session |

**Deliverables:**
- Architecture guide
- 3 setup guides + 10 runbooks
- OpenAPI spec
- Video demo
- Team trained

**Team Capacity:** 0.3 people (distributed across roles, ~1 person-week)

---

## Weekly Capacity & Timeline

### Week 1 (April 14-20)
- **Focus:** Epic 1.1 (queue foundation)
- **Team:** 2 people (1 @dev, 1 @data-engineer)
- **Hours:** 40
- **Deliverables:** JobQueue class, checkpoint schema, video.py integration

### Week 2 (April 21-27)
- **Focus:** Epic 1.1 → 1.2 (persistence) + Epic 2.1 start (GPU worker API)
- **Team:** 3 people (1 @dev from Epic 1, 2 @dev for Epic 2, 1 @devops)
- **Hours:** 35 + 35 = 70
- **Deliverables:** Artifact store, GPU worker skeleton + tunnel setup

### Week 3 (April 28 - May 4)
- **Focus:** Epic 1.2 (monitoring) + Epic 2.2 (GPU components)
- **Team:** 3 people (1 @dev Epic 1, 2 @dev Epic 2, 1 @qa)
- **Hours:** 15 + 50 = 65
- **Deliverables:** Job monitoring + 3 GPU components (avatar, voice, matting)

### Week 4 (May 5-11)
- **Focus:** Epic 2.2 (complete) + Epic 2.3 start (integration) + Epic 3.1 start (routing)
- **Team:** 4 people (2 @dev Epic 2, 1 @dev Epic 3, 1 @devops)
- **Hours:** 35 + 20 + 30 = 85
- **Deliverables:** 5 GPU components done, video workflow integration start, router analysis

### Week 5 (May 12-18)
- **Focus:** Epic 2.3 (complete) + Epic 3.1 (complete) + integration testing
- **Team:** 4 people (1 @dev Epic 2, 1 @dev Epic 3, 1 @qa, 1 @architect)
- **Hours:** 20 + 25 + 20 = 65
- **Deliverables:** Video pipeline GPU-ready, LLM-Router integrated, E2E tests passing

### Week 6 (May 19-25)
- **Focus:** Integration + performance testing + documentation
- **Team:** 3 people (1 @qa, 1 @analyst, 1 @devops)
- **Hours:** 20 + 8 + 5 = 33
- **Deliverables:** Performance baselines, documentation draft

### Week 7 (May 26 - June 1)
- **Focus:** Load testing + chaos testing + runbook finalization
- **Team:** 2 people (1 @qa, 1 @devops)
- **Hours:** 15 + 10 = 25
- **Deliverables:** Chaos test results, runbooks, alerts configured

### Week 8 (June 2-8)
- **Focus:** Final testing + knowledge transfer + deployment prep
- **Team:** 2 people (1 @qa, 1 @pm)
- **Hours:** 10 + 8 = 18
- **Deliverables:** Sign-off, team trained, staging deployment ready

---

## Resource Planning by Role

| Role | Total Hours | Weeks | Daily Avg | Notes |
|------|------------|-------|----------|-------|
| @dev (2 FTE) | 180 | 8 | 5.6h/day | Core implementation (router, workers, integration) |
| @data-engineer | 30 | 2-3 | 3.5h/day | Checkpoint schema, artifact store |
| @devops | 35 | 6 | 1.2h/day | GPU worker, tunnel, monitoring setup |
| @qa | 60 | 8 | 1.9h/day | Testing (unit, integration, E2E, load) |
| @architect | 20 | 4 | 1.2h/day | Design decisions, complexity mapping |
| @analyst | 15 | 3 | 1.3h/day | Documentation, cost analysis |
| @pm | 10 | 2 | 1.3h/day | Knowledge transfer, runbooks |

**Total:** 350 person-hours, 5-6 people, 8 weeks

---

## Critical Path & Sequencing

```
Week 1: Epic 1.1 (must complete before Epic 2.3)
  ↓
Week 2-3: Epic 1.2 + Epic 2.1 (parallel)
  ↓
Week 3-4: Epic 2.2 (must complete before 2.3)
  ↓
Week 4-5: Epic 2.3 (GPU integration into video.py)
  ↓
Week 4-5: Epic 3.1 (parallel, no dependency)
  ↓
Week 5-6: Integration testing (depends on all epics)
  ↓
Week 6-8: E2E + load testing + documentation + sign-off
```

---

## Sprint Boundaries & Handoffs

| Sprint | Duration | Stories | Handoff Ceremony |
|--------|----------|---------|-----------------|
| 1.1 | Week 1 | 3 | Friday EOD: JobQueue + schema delivered |
| 1.2 | Week 2 | 3 | Friday EOD: Artifact store + monitoring ready |
| 2.1 | Week 2 | 3 | Friday EOD: GPU worker + tunnel operational |
| 2.2 | Week 3-4 | 4 | Friday EOD: 5 components integrated |
| 2.3 | Week 4-5 | 3 | Friday EOD: Video workflow GPU-ready |
| 3.1 | Week 4-5 | 5 | Friday EOD: LLM-Router integrated, cost tracking |
| Integ | Week 5-7 | Various | Daily sync, weekly progress review |

---

**Document Version:** 1.0  
**Generated:** April 11, 2026  
**Maintainer:** @pm (Morgan)

