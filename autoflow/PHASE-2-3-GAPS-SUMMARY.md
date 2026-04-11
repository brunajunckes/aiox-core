# AutoFlow Phase 2-3 Gap Analysis Summary

**Generated:** 2026-04-11  
**Model:** qwen2.5:3b (Ollama — cost-optimized analysis)  
**Status:** Ready for implementation  

---

## Executive Summary

**3 gaps identified. No critical blockers. Sequencing is critical.**

| Gap | Title | Severity | Hours | Sequence |
|-----|-------|----------|-------|----------|
| **1** | BullMQ Job Queue + Checkpointing | HIGH | 8 | Foundation (must be first) |
| **2** | Desktop GPU Worker Integration | CRITICAL | 12 | After Gap 1 |
| **3** | LLM-Router-AIOX Alignment | MEDIUM | 6 | After Gap 1 (can parallel with Gap 2) |

**Total Effort:** 26 hours (3.25 sprints)  
**Critical Path:** Gap 1 → (Gap 2 + Gap 3 in parallel)  

---

## Gap 1: BullMQ Job Queue for Video Pipeline Checkpointing

**Category:** Resilience & Error Handling (E4)

### Problem
Video workflows have 5 stages. If any stage fails after 10 minutes, the entire pipeline restarts from scratch. Wasted GPU time, zero recovery.

### Impact
- **Severity:** HIGH  
- **Cost:** 2-hour video job + failure = 2h wasted GPU cycles  
- **User Experience:** Users lose work on transient failures  
- **Technical Debt:** E4 error handling missing from taxonomy  

### Root Cause
LangGraph StateGraph persists execution graph in PostgreSQL, but there's no job-level queuing. If a worker process dies, in-flight jobs are lost.

### Solution Components
1. **Job Queue Library** (3h): Install RQ + Redis integration  
2. **5-Stage Job Classes** (3h): Define jobs for each video stage with retry logic  
3. **Checkpoint/Resume Handler** (4h): Resume from last successful stage  
4. **Artifact Storage** (2h): Supabase Storage for intermediate outputs  

### Implementation Approach
- Use RQ (lighter than Celery/Airflow)  
- Redis backend already running on VPS  
- Each job class extends `rq.job.Job`  
- StateGraph node outputs become job results for next stage  

### Acceptance Criteria
- [ ] Job queue library tested with Redis  
- [ ] 5 job classes with 3-retry defaults + 60s backoff  
- [ ] Checkpoint resume: stage 3 fails → stage 3 restarts with stage 2 outputs  
- [ ] Intermediate artifacts in Supabase Storage (24h TTL)  
- [ ] E2E test: crash during stage 3, verify auto-resume  
- [ ] Cost tracking: log stage execution time + model to `/var/log/autoflow-jobs.jsonl`  

### Blocks
- Gap 2 (GPU Worker) — can't handle long-running jobs without checkpoints  
- Gap 3 (LLM-Router) — needs stable job execution  

---

## Gap 2: Desktop GPU Worker Integration

**Category:** Distributed Architecture & Hardware Utilization

### Problem
`gpu_worker_api.py` exists (FastAPI server) but is NOT integrated into AutoFlow. Desktop GPU resources sit idle. Workflows can't execute avatar, matting, voice, or rendering tasks.

### Impact
- **Severity:** CRITICAL  
- **Cost:** GPU resources unused while Desktop is disconnected  
- **User Experience:** Video workflows fail with "GPU task not supported"  
- **Technical Debt:** Incomplete split-brain topology (VPS has LLM, Desktop has GPU, no bridge)  

### Root Cause
Split-brain architecture (VPS + Desktop) requires explicit job delegation. AutoFlow workflows are VPS-only; no mechanism to submit jobs to Desktop GPU worker. Cloudflare Tunnel + WireGuard not configured.

### Solution Components
1. **Network Bridge** (2h): Cloudflare Tunnel or WireGuard  
2. **GPU Worker Client** (3h): Python library to submit/poll/download  
3. **Workflow Integration** (4h): New nodes that delegate GPU tasks  
4. **Graceful Degradation** (2h): Fallback if Desktop offline  
5. **Health Check** (2h): Auto-detect Desktop availability + alerting  

### Implementation Approach
- Defer avatar/matting features until tunnel is stable  
- Start with health check + graceful fallback  
- Job flow: VPS workflow → GpuWorkerClient → POST /api/{task_type} → Desktop queues → VPS polls → download artifact  

### Acceptance Criteria
- [ ] Cloudflare Tunnel or WireGuard stable tunnel  
- [ ] GpuWorkerClient class with 30s timeout + 3 retries (exp backoff)  
- [ ] Video workflow node: `await_gpu_task('avatar', {...})`  
- [ ] Circuit breaker: Desktop offline → clear error, log to Paperclip  
- [ ] Health check: 60s polling; 5+ min down → Paperclip ticket  
- [ ] E2E test: avatar job VPS → Desktop → artifact download  
- [ ] Cost tracking: GPU job logs to `/var/log/autoflow-gpu.jsonl`  

### Dependencies
- Requires Gap 1 (BullMQ) — GPU jobs need checkpointing  

---

## Gap 3: LLM-Router-AIOX Integration

**Category:** Architecture Alignment & Cost Optimization

### Problem
`router.py` has LLM-Router-AIOX client stub but doesn't use it. Workflows use direct Ollama→Claude fallback, bypassing complexity scoring. LLM-Router-AIOX exists (/root/llm-router-aiox) with full feature set but is unused.

### Impact
- **Severity:** MEDIUM  
- **Cost:** Wrong model selection (simple queries → Claude instead of Ollama). No cost tracking.  
- **User Experience:** No visibility into model selection; unpredictable latency  
- **Technical Debt:** Two separate routing systems (inconsistent decisions)  

### Root Cause
Architecture memo says "API needs alignment." Likely API signature mismatch or missing documentation. Comment in router.py: "Replace direct router with LLM-Router-AIOX API calls" — never implemented.

### Solution Components
1. **API Documentation** (1h): Document /route endpoint contract  
2. **Request/Response Testing** (2h): Test calls with sample prompts  
3. **Fallback Chain Update** (2h): Replace direct calls with LLM-Router decision  
4. **Cost Tracking** (1h): Structured logging of model + complexity + cost  
5. **Circuit Breaker Sync** (2h): Integrate CB into call_llm_sync  

### Implementation Approach
- This is refactoring, not new code — pieces exist but disconnected  
- Trace flow: prompt → `/route` decision → model execution → cost log  
- Verify CircuitBreaker handles LLM-Router downtime gracefully  

### Acceptance Criteria
- [ ] API endpoint documented in `/root/llm-router-aiox/API.md`  
- [ ] _fetch_routing_decision() tested; returns {model, complexity_score, cost_estimate}  
- [ ] call_llm_sync() updated: (1) /route call, (2) model exec, (3) cost log  
- [ ] Structured logs: {workflow, complexity_score, model, latency, cost} to jsonl  
- [ ] Circuit breaker: /route fails → 5min backoff, direct fallback  
- [ ] Dashboard: `SELECT SUM(cost_usd) FROM logs WHERE workflow='video'`  
- [ ] E2E test: trace video call through routing → execution → log  

### Dependencies
- Requires Gap 1 (BullMQ) — provides job context for scoring  

---

## Dependency Graph

```
Gap 1 (BullMQ)
  ├── blocks Gap 2 (GPU Worker)
  └── blocks Gap 3 (LLM-Router)

Gap 2 (GPU Worker)
  ├── depends on Gap 1
  └── (independent once Gap 1 done)

Gap 3 (LLM-Router)
  ├── depends on Gap 1
  └── (independent once Gap 1 done)
```

**Critical Path:** Gap 1 → (Gap 2 + Gap 3 parallel)

---

## Sequencing & Timeline

### Sprint 1 (Days 1–5)
- **Days 1–3:** Gap 1 (BullMQ) — 8 hours
  - Install RQ + Redis tuning  
  - Define 5 job classes  
  - Implement checkpoint resume  
  - E2E testing  

- **Days 4–5:** Gap 3 (LLM-Router) — 6 hours
  - API documentation  
  - Integration testing  
  - Cost tracking setup  

### Sprint 2 (Days 1–5)
- **Days 1–5:** Gap 2 (GPU Worker) — 12 hours
  - Tunnel setup (Cloudflare/WireGuard)  
  - GpuWorkerClient library  
  - Workflow integration  
  - Health check + testing  

**Total:** 26 hours (~3.25 sprints, 5–6 working days full team)

---

## Risks & Mitigations

### Risk 1: Desktop Availability Variance (Gap 2)
- **Likelihood:** HIGH  
- **Impact:** GPU tasks fail silently if Desktop offline  
- **Mitigation:** Health check + Paperclip alerting; fallback rendering on VPS (CPU, slower)  

### Risk 2: LLM-Router API Signature Drift (Gap 3)
- **Likelihood:** MEDIUM  
- **Impact:** Integration breaks if /route response changes  
- **Mitigation:** Document API contract; add integration tests; version API (/v1/route, /v2/route)  

---

## Success Metrics

| Gap | Success Metric |
|-----|-----------------|
| **1** | Video pipeline survives 5+ random crashes; <30s recovery per crash |
| **2** | Avatar requests succeed 99% of time; 1% fail = Desktop offline; graceful fallback |
| **3** | Cost tracking dashboard ±5% of actual spend; complexity distribution correct |

---

## Files Reference

- **Full Analysis:** `/root/autoflow/PHASE-2-3-GAP-ANALYSIS.json`  
- **This Summary:** `/root/autoflow/PHASE-2-3-GAPS-SUMMARY.md`  
- **Current Status:** `/root/.claude/projects/-root/memory/autoflow_execution_status.md`  

**Key Codebases:**
- AutoFlow Core: `/root/autoflow/autoflow/`  
- GPU Worker: `/root/autoflow/desktop_worker/gpu_worker_api.py`  
- LLM-Router: `/root/llm-router-aiox/`  
- Router Implementation: `/root/autoflow/autoflow/core/router.py`  

