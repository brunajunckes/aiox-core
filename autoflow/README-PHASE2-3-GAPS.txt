================================================================================
  AutoFlow Phase 2-3 Gap Analysis
  Generated: 2026-04-11 | Model: qwen2.5:3b (Ollama)
================================================================================

QUICK REFERENCE
===============

3 GAPS IDENTIFIED:

1. BullMQ Job Queue (HIGH severity, 8h effort)
   - Problem: Video pipeline loses jobs on crash, restarts from scratch
   - Impact: 2-hour video job failure = 2h wasted GPU time
   - Sequence: MUST BE FIRST
   - Blocks: Gap 2, Gap 3

2. Desktop GPU Worker Integration (CRITICAL severity, 12h effort)
   - Problem: gpu_worker_api.py exists but not integrated into workflows
   - Impact: GPU resources on Desktop sit idle, avatar/voice tasks blocked
   - Sequence: After Gap 1
   - Dependencies: Requires Gap 1

3. LLM-Router-AIOX Alignment (MEDIUM severity, 6h effort)
   - Problem: Routing system bypasses existing LLM-Router, no cost tracking
   - Impact: Wrong model selection, untracked costs, no complexity scoring
   - Sequence: After Gap 1 (can parallel with Gap 2)
   - Dependencies: Requires Gap 1

CRITICAL PATH: Gap 1 → (Gap 2 + Gap 3 in parallel)
TOTAL EFFORT: 26 hours (3.25 sprints, 5-6 working days)
NO BLOCKERS: All gaps have clear implementation path

================================================================================

FILES
=====

📄 PHASE-2-3-GAPS-SUMMARY.md (8.8 KB)
   ↳ Executive summary with problem statements, solutions, acceptance criteria
   ↳ Risk analysis, timeline, success metrics
   ↳ START HERE for planning

📄 PHASE-2-3-GAP-ANALYSIS.json (16 KB)
   ↳ Structured data format for tool consumption
   ↳ Full gap components, implementation notes, dependency matrix
   ↳ Machine-parseable format for automation

================================================================================

KEY DECISION POINTS
===================

Gap 1 (BullMQ):
  - Use RQ (lighter than Celery) with existing Redis on VPS
  - Each job class extends rq.job.Job
  - StateGraph outputs become job results for next stage
  - Persistence: intermediate artifacts to Supabase Storage (24h TTL)

Gap 2 (GPU Worker):
  - Network bridge: Cloudflare Tunnel preferred (or WireGuard fallback)
  - Job submission: VPS → GpuWorkerClient → POST /api/{task} → Desktop
  - Graceful degradation: if Desktop offline, fail clear, fallback to CPU
  - Health check: 60s polling; 5+ min down → Paperclip ticket

Gap 3 (LLM-Router):
  - This is refactoring, not new code — pieces exist but disconnected
  - Flow: prompt → /route decision → model execution → cost log
  - Circuit breaker: 5min backoff if /route fails
  - Cost tracking: structured logs {workflow, complexity, model, cost}

================================================================================

IMPLEMENTATION CHECKLIST
========================

Sprint 1 (Days 1-5):
  [ ] Gap 1 (8h) — Days 1-3
      [ ] Install RQ + Redis tuning
      [ ] Define 5 job classes (script→audio, audio→segments, etc)
      [ ] Checkpoint/resume logic
      [ ] Artifact storage (Supabase)
      [ ] E2E testing (simulate crash during stage 3)

  [ ] Gap 3 (6h) — Days 4-5
      [ ] Document LLM-Router-AIOX /route API endpoint
      [ ] Test _fetch_routing_decision() with sample prompts
      [ ] Update call_llm_sync() flow
      [ ] Structured cost logging
      [ ] Circuit breaker integration

Sprint 2 (Days 1-5):
  [ ] Gap 2 (12h) — Days 1-5
      [ ] Cloudflare Tunnel or WireGuard setup
      [ ] GpuWorkerClient library (30s timeout, 3 retries)
      [ ] Workflow nodes: await_gpu_task() delegates to Desktop
      [ ] Circuit breaker + graceful fallback
      [ ] Health check + Paperclip alerting
      [ ] E2E test (avatar job submission → execution → artifact)

================================================================================

RISK & MITIGATION
=================

Risk 1: Desktop GPU Worker Offline (Gap 2)
  Likelihood: HIGH
  Mitigation: Health check + alerting; CPU fallback rendering (slower)

Risk 2: LLM-Router API Changes (Gap 3)
  Likelihood: MEDIUM
  Mitigation: Document API contract; integration tests; version API

================================================================================

SUCCESS METRICS
===============

Gap 1: Video pipeline survives 5+ random crashes; <30s recovery per crash
Gap 2: Avatar requests 99% success; graceful fallback when Desktop offline
Gap 3: Cost tracking ±5% accuracy; complexity scoring distribution correct

================================================================================

KEY FILES & CODEBASES
=====================

AutoFlow Core:         /root/autoflow/autoflow/
GPU Worker API:        /root/autoflow/desktop_worker/gpu_worker_api.py
Router Implementation: /root/autoflow/autoflow/core/router.py
LLM-Router:            /root/llm-router-aiox/
Memory (Status):       /root/.claude/projects/-root/memory/autoflow_execution_status.md

================================================================================

NEXT STEPS
==========

1. Review PHASE-2-3-GAPS-SUMMARY.md for full context
2. Create story/task items from acceptance criteria
3. Begin Gap 1 implementation (RQ + job queue)
4. Parallel Gap 3 during Days 4-5 of Sprint 1
5. Execute Gap 2 in Sprint 2

================================================================================
