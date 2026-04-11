# AutoFlow Phase 2 — Executive Summary

**Status:** Ready for Execution  
**Start Date:** April 14, 2026 (Week 14)  
**End Date:** June 8, 2026 (Week 21)  
**Duration:** 8 weeks  
**Investment:** 320 person-hours / 5-6 people  
**Success Criteria:** All 3 epics merged, end-to-end video generation with GPU + routing

---

## The Vision

Transform AutoFlow from a single-host experimental platform to a **production-grade distributed AI pipeline engine** with:

1. **Reliable job processing** (BullMQ + Postgres checkpoints)
2. **GPU acceleration** (Desktop GPU → VPS connection)
3. **Intelligent routing** (LLM-Router-AIOX complexity scoring)

**Outcome:** Generate 30-minute videos in < 15 minutes, with cost tracking and budget gates, on commodity hardware.

---

## Phase 1 Status (Completed April 10)

| Component | Status | Impact |
|-----------|--------|--------|
| Core infrastructure | ✅ Ready | Paperclip, LLM-Router-AIOX, Ollama, Redis, PostgreSQL all verified |
| Router engine | ✅ Done | 80 LOC, Ollama → Claude fallback working |
| Validator (3-tier) | ✅ Done | Pydantic → Heuristic → LLM validation |
| Monitor | ✅ Done | Resource tracking, auto-eviction |
| Workflows (5 types) | ✅ Done | Research, SEO, video specs with LangGraph |
| Systemd services | ✅ Running | autoflow-api (8000), autoflow-monitor daemonized |

**Known Gaps:**
- No job persistence (video jobs restart on failure) ❌
- No GPU connection (GPU tasks can't run) ❌
- LLM-Router bypassed (using direct Ollama → Claude) ❌
- Paperclip governance unused ❌

---

## Phase 2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AutoFlow Phase 2 (Week 14-21)             │
│                                                                 │
│  ┌──────────────────┐   ┌──────────────────┐   ┌────────────┐ │
│  │ Epic 1: BullMQ   │   │ Epic 2: GPU      │   │ Epic 3:    │ │
│  │ Pipeline (2 wk)  │──▶│ Worker (3 wk)    │──▶│ LLM-Router │ │
│  │                  │   │                  │   │ (1 wk)     │ │
│  │ ✓ Job queue      │   │ ✓ FastAPI worker │   │ ✓ Integrate│ │
│  │ ✓ 5-stage schema │   │ ✓ Tunnel + bridge│   │ ✓ Cost     │ │
│  │ ✓ Checkpoint     │   │ ✓ 5 GPU comps    │   │ ✓ Budget   │ │
│  │ ✓ Artifact store │   │ ✓ GPU workflow   │   │ ✓ Paperclip│ │
│  │ ✓ Monitoring     │   │ ✓ Failover       │   │ ✓ Retry    │ │
│  └────────┬─────────┘   └────────┬─────────┘   └────────────┘ │
│           │                      │                   │         │
│           └──────────────────────┼───────────────────┘         │
│                                  │                             │
│            ┌──────────────────────┘                            │
│            ▼                                                   │
│  ┌──────────────────────────────────────┐                    │
│  │  Integration Testing (Week 5-7)      │                    │
│  │  ✓ E2E: script → video               │                    │
│  │  ✓ Performance: < 15 min per job     │                    │
│  │  ✓ Stress: 10 concurrent             │                    │
│  │  ✓ Chaos: GPU offline, Router down   │                    │
│  └──────────────────────────────────────┘                    │
│            │                                                  │
│            ▼                                                  │
│  ┌──────────────────────────────────────┐                    │
│  │  Production Readiness (Week 8)       │                    │
│  │  ✓ Monitoring + alerting              │                    │
│  │  ✓ Runbooks + troubleshooting         │                    │
│  │  ✓ Team trained                       │                    │
│  │  ✓ Staging deployment ready           │                    │
│  └──────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## The 3 Epics

### Epic 1: BullMQ Pipeline Integration (Weeks 1-2, 75 hours)

**Problem:** Long-running video workflows (30 min rendering) restart from beginning on interruption.

**Solution:** 
- Implement job queue with Redis + PostgreSQL checkpoints
- 5-stage pipeline: Script → Audio → Segments → Matting → Composition → Output
- Resume from last checkpoint on restart

**Impact:**
- Video jobs survive VM reboots, network failures
- Reduced latency: resume from stage 4 saves 12+ minutes
- Persistence layer enables scaling to multiple workers

**Key Stories:**
1. JobQueue abstraction (40h) — enqueue, status, retry logic
2. Checkpoint store (15h) — Postgres checkpoints + artifact storage
3. Video workflow integration (15h) — 5-stage pipeline + API

**Success Metric:** 100+ video jobs processed, 95% completion rate, < 5 min resume latency

---

### Epic 2: Desktop GPU Worker Bridge (Weeks 2-4, 125 hours)

**Problem:** GPU resources on Desktop isolated. Video rendering, avatar generation, voice synthesis can't run.

**Solution:**
- FastAPI server on Desktop exposing 5 GPU endpoints
- Cloudflare Tunnel for secure VPS ↔ Desktop connection
- Integrate 5 GPU components (Duix-Avatar, VibeVoice, RobustVideoMatting, imaginAIry, Pixelle-Video)
- Graceful fallback when GPU offline

**Impact:**
- Avatar generation: 2 min (vs 5+ min on CPU)
- Voice synthesis: 30 sec per minute of speech
- Video rendering: 5 min for 30-second video
- Full end-to-end pipeline now possible

**Key Stories:**
1. GPU worker API + Tunnel (35h) — FastAPI + Cloudflare + client library
2. GPU components (50h) — Avatar, voice, matting, image, video bridges
3. Pipeline integration (40h) — Integrate GPU tasks into video.py, failover, E2E testing

**Success Metric:** Full 30-second video generated in < 15 minutes, GPU offline doesn't crash workflow

---

### Epic 3: LLM-Router-AIOX Alignment (Weeks 4-5, 55 hours)

**Problem:** Router bypasses LLM-Router-AIOX. No complexity scoring, no cost tracking, no budget gates.

**Solution:**
- Replace direct Ollama → Claude calls with LLM-Router-AIOX API
- Route based on task complexity (1-15 scale)
- Track cost per request, enforce budget ceilings
- Integrate Paperclip governance

**Impact:**
- 30-50% cost reduction (low-complexity tasks use Ollama, not Claude)
- Budget enforcement (prevents overspending)
- Intelligent model selection (complexity → optimal model)
- Full cost visibility + audit trail

**Key Stories:**
1. LLM-Router API analysis (7h) — Document API, map complexity scores
2. Router integration (12h) — Replace direct calls, circuit breaker, cost logging
3. Cost tracking + Paperclip (15h) — Budget gates, alerts, governance
4. Complexity-aware retries (5h) — Retry strategy based on complexity
5. Testing (16h) — Unit + integration + load tests

**Success Metric:** Cost tracking accurate ±$0.01, 100 concurrent requests routed correctly, budget enforced

---

## Key Dependencies & Critical Path

```
Day 1 (Week 1, Apr 14):
  └─ Epic 1.1: Design JobQueue + Checkpoint schema
      └─ [CRITICAL] Must complete before Epic 2.3 can integrate GPU jobs

Week 2 (Apr 21):
  ├─ Epic 1.1: Finish JobQueue + schema
  ├─ Epic 1.2: Start artifact store
  └─ Epic 2.1: Start GPU worker API (parallel, no dependency)

Week 3 (Apr 28):
  ├─ Epic 1.2: Complete monitoring
  └─ Epic 2.2: GPU components (requires 2.1 client library)

Week 4-5 (May 5):
  ├─ Epic 2.3: Integrate GPU tasks into video.py [REQUIRES 1.1 + 2.2]
  ├─ Epic 3.1: LLM-Router integration [NO DEPENDENCY]
  └─ Integration testing starts (Week 5)

Week 6-8 (May 19):
  └─ E2E + load testing + sign-off
```

**Critical Path:** Epic 1.1 → Epic 1.2 → Epic 2.3  
**Safe to parallelize:** Epic 2.1, Epic 3.1 (independent)

---

## Resource Plan

### Team Composition
- **2 x Backend Engineers (@dev)** — Router, queue, GPU client, E2E testing
- **1 x Data Engineer** — PostgreSQL schema, checkpointing, migrations
- **1 x DevOps (@devops)** — GPU worker service, tunnel, monitoring setup
- **1 x QA** — Testing (unit, integration, E2E, load, chaos)
- **1 x Architect** — Design reviews, complexity mapping, tech decisions
- **0.3 x Analyst** — Documentation, cost analysis, research

**Total:** 5-6 people, 320 person-hours, 8 weeks

### Weekly Allocation
| Week | Dev | DevOps | QA | Architect | Data-Eng | Analyst | Total |
|------|-----|--------|----|-----------|---------|---------|----|
| 1 | 20 | — | 8 | 4 | 8 | — | 40h |
| 2 | 30 | 12 | 8 | — | 10 | 3 | 63h |
| 3 | 30 | 8 | 10 | 4 | 8 | 2 | 62h |
| 4 | 32 | 10 | 12 | 6 | — | 3 | 63h |
| 5 | 28 | 8 | 14 | 4 | — | 2 | 56h |
| 6 | 15 | 5 | 14 | 2 | — | 3 | 39h |
| 7 | 10 | 8 | 12 | — | — | 2 | 32h |
| 8 | 8 | 4 | 6 | 2 | — | 3 | 23h |

---

## Success Metrics & Acceptance Criteria

### Functional (Must Have)
- [ ] BullMQ queue operational: enqueue → checkpoint → resume
- [ ] GPU worker connected + all 5 components functional
- [ ] Video pipeline end-to-end: script → audio → avatar → matting → render
- [ ] LLM-Router-AIOX routing active with complexity scoring
- [ ] Cost tracking accurate (±$0.01) + budget gates enforced
- [ ] 100+ tests passing (unit + integration + E2E)

### Performance (Must Have)
- [ ] Single video job: < 15 min (vs 30 min CPU-only)
- [ ] Job resume latency: < 5 sec (from checkpoint)
- [ ] GPU uptime: > 95% (with health checks)
- [ ] Router latency: < 100ms per decision
- [ ] 10 concurrent videos: < 60 min (parallel GPU)

### Quality (Must Have)
- [ ] Code coverage: > 85%
- [ ] No regressions on Phase 1 code
- [ ] All acceptance criteria documented
- [ ] Production readiness: monitoring, alerting, runbooks
- [ ] Team trained + handoff complete

---

## Risk Register & Mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| BullMQ vs Celery choice paralysis | Med | Med | POC both on Day 1 of Sprint 1.1 |
| Desktop GPU offline frequently | High | High | Implement health checks + auto-fallback (Story 2.1.3) |
| PostgreSQL checkpoint write contention | Med | Low | Connection pooling (10 connections) + monitoring |
| Cloudflare Tunnel latency on 1GB files | Med | Med | Benchmark with actual video files (Day 2 Sprint 2.1) |
| Component version conflicts (Avatar, Voice) | Low | Med | Lock versions + virtual envs (Windows service isolation) |
| Cost tracking accuracy | Low | High | Daily reconciliation (audit trail in Postgres) |
| LLM-Router API changes | Low | Med | Monitor releases, version pin (requirements.txt) |

---

## Financial Impact

### Cost Reduction (Annual)
- **Phase 1 run-cost:** ~$400/month (all Claude calls, no routing)
- **Phase 2 savings:** 40% reduction (Ollama for low-complexity, route to Claude for high)
- **Estimated annual savings:** $1,920/year

### ROI Calculation
- **Phase 2 investment:** 320 hours × $150/hr (loaded cost) = **$48,000**
- **Payback period:** ~25 months
- **Break-even:** Dec 2028

### Strategic Value
- **Reduces vendor lock-in:** Can switch LLM providers (currently Claude-only)
- **Enables scaling:** GPU acceleration + job queue support 10x throughput
- **Improves reliability:** Checkpoints + failover reduce incident rate
- **Increases visibility:** Cost tracking + Paperclip governance

---

## Phase 3 Opportunities (Post-Phase 2)

After Phase 2 completion, Phase 3 unlocks:

1. **RAGFlow Integration** (2 weeks) — Vector search for research workflows
2. **Semantic Caching** (1 week) — Cache similar queries, reduce LLM calls by 30%
3. **Multi-GPU Scaling** (3 weeks) — Distribute jobs across multiple machines
4. **Advanced Observability** (2 weeks) — Real-time dashboard, cost forecasting
5. **API Marketplace** (4 weeks) — Expose AutoFlow workflows as APIs to external users

---

## Key Dates & Milestones

| Date | Milestone | Gate |
|------|-----------|------|
| Apr 14 | Phase 2 kicks off | Team onboarding complete |
| Apr 20 | Sprint 1.1 complete | JobQueue working, 15+ tests |
| Apr 27 | Sprint 1.2 complete | Checkpoint persistence verified |
| May 4 | Sprint 2.1 complete | GPU worker + tunnel operational |
| May 11 | Sprint 2.2 complete | 5 GPU components integrated |
| May 18 | Sprints 2.3 + 3.1 complete | Full pipeline GPU-ready, routing active |
| May 25 | Integration testing | E2E tests passing, performance baselines met |
| Jun 1 | Chaos + load testing | 10 concurrent jobs, GPU offline scenario passes |
| Jun 8 | Phase 2 complete | Team trained, staging deployment ready |

---

## Deliverables by Epic

### Epic 1: BullMQ Pipeline
- JobQueue class (production)
- PostgreSQL checkpoint schema + store
- Artifact manager (S3/Supabase)
- Job monitoring service + Prometheus metrics
- 25+ tests
- Documentation: job-queue-design.md, monitoring-strategy.md

### Epic 2: GPU Worker Bridge
- FastAPI GPU worker (Windows service)
- Cloudflare Tunnel + VPS reverse proxy
- GPU client library
- 5 GPU component bridges
- Video workflow GPU integration
- 25+ tests
- Documentation: gpu-worker-setup.md, gpu-components.md, video-pipeline-gpu.md

### Epic 3: LLM-Router-AIOX
- LLM-Router integration (router.py refactor)
- Cost tracking + budgeting module
- Paperclip governance adapter
- Complexity-aware retry strategy
- 25+ tests
- Documentation: complexity-mapping.md, routing-strategy.md

### Cross-Epic
- 100+ total tests (unit + integration + E2E)
- Architecture guide
- Setup guides (3x)
- Troubleshooting runbooks (10+)
- Video demo (5 min)
- Team training (2 hours)

---

## Recommendation

**Proceed with Phase 2 execution as planned.** The roadmap is:
- ✅ **Technically sound:** Built on existing infrastructure (Phase 1)
- ✅ **Risk mitigated:** Clear dependencies, fallback strategies
- ✅ **Resource realistic:** 320 hours / 5-6 people / 8 weeks
- ✅ **Value-driven:** $1.9K annual savings + 10x throughput + reliability

**Start:** Monday, April 14, 2026  
**Target:** Friday, June 8, 2026  

---

## Approval & Signatures

| Role | Name | Date | Status |
|------|------|------|--------|
| @pm | Morgan | Apr 11 | ✅ Ready |
| @architect | Aria | TBD | Pending |
| @devops | Gage | TBD | Pending |
| @dev | Dex | TBD | Pending |

---

**Document Version:** 1.0  
**Generated:** April 11, 2026  
**Next Review:** April 14, 2026 (kick-off)  
**Distribution:** All stakeholders + GitHub

