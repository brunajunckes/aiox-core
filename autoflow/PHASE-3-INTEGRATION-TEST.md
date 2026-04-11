# Phase 3 Integration Testing — Comprehensive E2E & Chaos Validation

**Document:** Phase 3 Integration Test Plan  
**Date:** 2026-04-11  
**Status:** Production Ready  
**Test Coverage:** 10 E2E scenarios + 4 chaos scenarios  
**Expected Pass Rate:** 100%  

---

## Executive Summary

Phase 3 integration testing validates the complete workflow from LLM-Router cost tracking → BullMQ job queue → GPU worker bridge across all 3 epics. This document defines:

1. **10 E2E Scenarios** — Real-world video processing workflows
2. **Load Test** — 100 concurrent jobs across 4 GPU workers
3. **4 Chaos Scenarios** — Failure modes and recovery validation
4. **Success Criteria** — Cost accuracy ±2%, performance SLAs, resilience targets

---

## Test Environment Setup

### Prerequisites
- PostgreSQL 14+ (cost tracking)
- Redis 7+ (BullMQ job queue)
- GPU worker API (port 5000)
- Ollama (local inference) + Claude API (remote fallback)
- Cloudflare Tunnel (if testing network resilience)
- OpenTelemetry exporter (observability)

### Configuration

```bash
# Environment variables for integration test
export AUTOFLOW_DB_URL=postgresql://test:test@localhost:5432/autoflow_test
export AUTOFLOW_REDIS_URL=redis://localhost:6379/0
export AUTOFLOW_GPU_WORKER_URL=http://localhost:5000
export AUTOFLOW_OLLAMA_URL=http://localhost:11434
export AUTOFLOW_OLLAMA_MODEL=qwen2.5:7b
export ANTHROPIC_API_KEY=sk-ant-... # For Claude fallback
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Test configuration
export AUTOFLOW_TEST_MODE=true
export AUTOFLOW_TEST_TIMEOUT=300  # 5 minutes per test
export AUTOFLOW_TEST_LOAD=100     # 100 concurrent jobs
```

### Database Setup

```bash
# Create test database
psql -U postgres -c "CREATE DATABASE autoflow_test;"

# Create cost events table
psql -U postgres autoflow_test < /root/autoflow/migrations/cost_events_schema.sql

# Create job queue tables
psql -U postgres autoflow_test < /root/autoflow/migrations/bullmq_schema.sql

# Create GPU worker tables
psql -U postgres autoflow_test < /root/autoflow/migrations/gpu_worker_schema.sql
```

---

## E2E Scenario Suite

### Scenario 1: Simple Video Processing (Ollama Path)

**Workflow:**
```
Input: 30s video
  ↓
LLM-Router (complexity: 2/10 = SIMPLE)
  ↓ Route to Ollama (cost optimized)
  ↓
BullMQ Job (type: transcribe, priority: medium)
  ↓
GPU Worker (OpenAI Whisper model)
  ↓
Output: Transcript + Cost event logged
```

**Test Steps:**
1. Invoke `router.call_llm_sync(prompt, complexity=2)`
2. Verify cost event logged: provider=ollama, cost=$0.00
3. Submit job to BullMQ queue
4. Wait for GPU worker completion (<2 seconds for simple task)
5. Verify output: transcript, metrics, cost tracking

**Expected Results:**
- **Cost:** $0.00 (Ollama free)
- **Latency:** P50 <500ms, P99 <2s
- **Success Rate:** 100%
- **Job Status:** completed, no retries

**Acceptance Criteria:**
- ✓ Cost event created (provider=ollama)
- ✓ Job completed successfully
- ✓ Output matches expected format
- ✓ No cost overcharge (actual = estimated)

---

### Scenario 2: Standard Video Processing (Claude Path with Fallback)

**Workflow:**
```
Input: 2min video
  ↓
LLM-Router (complexity: 6/10 = STANDARD)
  ↓ Route to Claude (contextual analysis)
  ↓
BullMQ Job (type: analyze, priority: high)
  ↓
GPU Worker (rendering, timeout 30s)
  ↓
Output: Analysis + Cost tracking
```

**Test Steps:**
1. Invoke router with complexity=6, expect Claude selection
2. Verify cost estimation: input tokens * $0.003 / 1K
3. Submit job with priority=high
4. Simulate network latency (+1s)
5. Verify cost accuracy ±2%

**Expected Results:**
- **Cost:** $0.05-0.15 (typical for standard task)
- **Latency:** P50 <1.5s, P99 <5s
- **Success Rate:** 99%+ (1 retry tolerance)
- **Cost Accuracy:** ±2% tolerance

**Acceptance Criteria:**
- ✓ Cost event logs input + output tokens
- ✓ Actual cost matches estimate ±2%
- ✓ Job priority respected (processed before low-priority)
- ✓ Metrics recorded (latency, tokens, cost)

---

### Scenario 3: Complex Multi-Modal Processing

**Workflow:**
```
Input: Video + audio streams
  ↓
LLM-Router (complexity: 8/10 = COMPLEX)
  ↓ Route to Claude (multi-modal)
  ↓
BullMQ Jobs (3 parallel: transcribe + analyze + generate)
  ↓
GPU Workers (speech recognition, avatar generation)
  ↓
Output: Composite result
```

**Test Steps:**
1. Create 3 interdependent jobs
2. Route to Claude (complexity=8)
3. Execute in parallel on GPU workers
4. Track costs for each branch
5. Aggregate final cost

**Expected Results:**
- **Cost:** $0.20-0.50 (complex multi-modal)
- **Latency:** P50 <10s, P99 <30s (parallel execution)
- **Success Rate:** 98%+ (may have 1-2 retries)
- **Parallel Efficiency:** 80%+ (near-linear speedup)

**Acceptance Criteria:**
- ✓ Cost breakdown tracks each parallel job
- ✓ Total cost = sum of branch costs
- ✓ Latency = max(branch latencies), not sum
- ✓ Job dependencies respected

---

### Scenario 4: Voice Synthesis with Avatar Generation

**Workflow:**
```
Input: Text prompt
  ↓
GPU Worker 1: TTS (text → audio)
  ↓
GPU Worker 2: Avatar generation (synchronized)
  ↓
GPU Worker 3: Video composition
  ↓
Output: Synchronized video with avatar + voice
```

**Test Steps:**
1. Submit voice synthesis job to GPU worker 1
2. Monitor: TTS generation (<5s)
3. Submit parallel avatar generation to GPU worker 2
4. Track resource utilization (GPU memory, CPU)
5. Monitor composition phase latency

**Expected Results:**
- **Total Latency:** <15s (TTS 5s + avatar 8s + composition 2s)
- **GPU Utilization:** 70-90% (efficient parallelism)
- **Cost:** GPU time * $0.10/hour = ~$0.04 for 15s
- **Quality Metrics:** Audio-video sync ±200ms

**Acceptance Criteria:**
- ✓ Audio-video sync within ±200ms
- ✓ GPU utilization >70% (efficient)
- ✓ Latency <15s target
- ✓ Cost tracking accurate per GPU job

---

### Scenario 5: Checkpoint & Resume (BullMQ Resilience)

**Workflow:**
```
Input: Long video (5min) for processing
  ↓
BullMQ Job: Checkpoint at 1min, 2min, 3min marks
  ↓ Simulate job failure at 2min 30s
  ↓
Resume from checkpoint (2min, not 0min)
  ↓
Output: Continue processing without re-computation
```

**Test Steps:**
1. Start long-running job
2. Verify checkpoints created at intervals
3. Force failure at 2:30 mark
4. Verify job moved to retry queue
5. Resume from checkpoint (2:00, not 0:00)
6. Verify total latency: 5min + 2:30min (resume), not 7:30min

**Expected Results:**
- **Checkpoint Overhead:** <100ms per checkpoint
- **Resume Time:** <30s (load from checkpoint)
- **Total Latency:** Original + partial re-computation only
- **Data Integrity:** No data loss or duplication

**Acceptance Criteria:**
- ✓ Checkpoints created automatically
- ✓ Resume loads from latest checkpoint, not start
- ✓ No checkpoint overhead on happy path
- ✓ Partial re-computation only (not full)

---

### Scenario 6: Cost Accuracy Under Load

**Workflow:**
```
100 parallel jobs with varying costs
  ↓
Route: 30% Ollama, 50% Claude, 20% Claude Opus
  ↓
Track costs in real-time
  ↓
Verify final bill accuracy ±2%
```

**Test Steps:**
1. Submit 100 jobs with mixed complexity (2, 6, 9)
2. Monitor cost collection in PostgreSQL
3. Record: estimated vs actual for each job
4. Calculate: total bill, average cost per job
5. Verify: final bill within ±2% of estimate

**Expected Results:**
- **Total Cost:** $2-5 (mixed load)
- **Cost Accuracy:** 99%+ (within ±1% in practice)
- **Database Throughput:** 1000+ cost events/sec
- **No Cost Loss:** 100% of events captured

**Acceptance Criteria:**
- ✓ All 100 jobs tracked in PostgreSQL
- ✓ Cost accuracy within ±2% tolerance
- ✓ No events lost (database resilience)
- ✓ Query latency <100ms for summary

---

### Scenario 7: Circuit Breaker Activation (LLM-Router Resilience)

**Workflow:**
```
LLM-Router healthy (3 consecutive failures threshold)
  ↓
Simulate 3 failures (timeout, 500 error, connection refused)
  ↓
Circuit breaker OPENS (block subsequent calls)
  ↓
Fallback to Ollama for 60s cooldown
  ↓
Circuit HALF-OPEN (test with single request)
  ↓
If success: Circuit CLOSED (resume normal operation)
```

**Test Steps:**
1. Start with circuit CLOSED, metrics cleared
2. Trigger 3 failures to LLM-Router endpoint
3. Verify circuit transitions to OPEN
4. Attempt 5 calls while OPEN → all routed to Ollama
5. Wait 60s cooldown
6. Make 1 call (HALF_OPEN state)
7. Verify circuit returns to CLOSED on success

**Expected Results:**
- **State Transitions:** CLOSED → OPEN (0.5s) → HALF_OPEN (60s) → CLOSED
- **Failover Success:** 100% calls routed to Ollama during OPEN
- **Recovery Time:** <5s after cooldown expires
- **No Data Loss:** Requests queued, not dropped

**Acceptance Criteria:**
- ✓ Circuit transitions recorded in metrics
- ✓ Fallback routing works (no failures during OPEN)
- ✓ Recovery automatic after cooldown
- ✓ Cost events track fallback usage

---

### Scenario 8: Multi-Tenant Isolation

**Workflow:**
```
Tenant A: 50 jobs
  ↓
Tenant B: 50 jobs (concurrent)
  ↓
Verify: Cost tracking, job queues, metrics isolated
```

**Test Steps:**
1. Create 2 tenants with different API keys
2. Submit 50 jobs per tenant (100 parallel)
3. Query cost for Tenant A → must not see Tenant B's costs
4. Query metrics → verify isolation
5. Verify: Each tenant sees only their jobs in queue

**Expected Results:**
- **Cost Isolation:** Tenant A sees only their costs
- **Job Queue Isolation:** Queues independent per tenant
- **Metrics Isolation:** No cross-tenant metrics visible
- **Total Latency:** Same as single-tenant (no isolation overhead)

**Acceptance Criteria:**
- ✓ Cost data isolated (SQL: WHERE tenant_id = ?)
- ✓ Job queues independent (Redis keys: tenant:queue)
- ✓ RLS policies enforced in PostgreSQL
- ✓ No information leakage between tenants

---

### Scenario 9: Graceful Degradation (GPU Worker Offline)

**Workflow:**
```
GPU Worker (avatar generation) goes OFFLINE
  ↓
Health check detects DOWN
  ↓
Queue fills with pending avatar jobs
  ↓
Circuit breaker limits backlog (drop oldest jobs)
  ↓
GPU Worker comes ONLINE
  ↓
Resume processing from checkpoint
```

**Test Steps:**
1. Start with all GPU workers online
2. Kill GPU worker (avatar generation)
3. Submit 50 avatar jobs → verify queued, not failed
4. Monitor: Queue grows, circuit breaker opens
5. Restart GPU worker
6. Verify: Jobs resume from checkpoints

**Expected Results:**
- **Detection Time:** <5s (health check interval)
- **Backlog Handling:** Queue fills without OOM
- **Recovery:** Oldest jobs dropped if queue > threshold
- **Resume Time:** <30s to full throughput

**Acceptance Criteria:**
- ✓ Health check detects offline within 5s
- ✓ New jobs queued, not immediately failed
- ✓ Backlog management prevents OOM
- ✓ Recovery automatic (no manual intervention)

---

### Scenario 10: End-to-End Video Rendering Pipeline

**Workflow (15-minute complete pipeline):**
```
Input: Raw footage + audio tracks
  ↓
Phase 1: Transcription (Ollama, 2min)
  ↓
Phase 2: Sentiment analysis (Claude, 1min)
  ↓
Phase 3: Avatar generation (GPU, 5min)
  ↓
Phase 4: Video composition (GPU, 4min)
  ↓
Phase 5: Audio sync & export (GPU, 2min)
  ↓
Output: Final video + billing report
```

**Test Steps:**
1. Submit multi-phase job with dependencies
2. Monitor each phase: latency, cost, status
3. Track cost across all 5 phases
4. Verify checkpoint at each phase boundary
5. Simulate failure at phase 3 (avatar)
6. Verify resume from phase 3 checkpoint
7. Verify final cost = sum of phase costs

**Expected Results:**
- **Total Latency:** 14-16min (with 1 failure + recovery)
- **Phase Breakdown Cost:**
  - Transcription: $0.00 (Ollama)
  - Analysis: $0.08 (Claude)
  - Avatar: $0.12 (GPU, 5min)
  - Composition: $0.08 (GPU, 4min)
  - Sync: $0.04 (GPU, 2min)
  - **Total: ~$0.32**
- **Cost Accuracy:** ±2%
- **Checkpoint Count:** 5 (one per phase)

**Acceptance Criteria:**
- ✓ All 5 phases execute in dependency order
- ✓ Cost tracking across all phases
- ✓ Single failure doesn't restart pipeline
- ✓ Total cost accurate and auditable

---

## Load Testing

### Test Configuration

```yaml
load_test:
  concurrent_jobs: 100
  duration_seconds: 600  # 10 minutes
  gpu_workers: 4         # 4 GPU instances
  job_mix:
    simple: 30%    # Ollama, <1s latency
    standard: 50%  # Claude, 1-5s latency
    complex: 20%   # Claude Opus, 5-30s latency
  success_criteria:
    cost_accuracy: 0.02     # ±2%
    p99_latency_ms: 30000   # 30s max
    success_rate: 0.98      # 98% success
```

### Load Test Execution

```bash
# Run load test
python -m autoflow.tests.load_test \
  --duration=600 \
  --concurrent=100 \
  --gpu-workers=4 \
  --output=/tmp/load_test_results.json

# Monitor in real-time
watch -n 1 'curl http://localhost:3000/metrics | jq .queue'
```

### Load Test Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Throughput | 100 jobs/min | TBD | TBD |
| P50 Latency | <3s | TBD | TBD |
| P99 Latency | <30s | TBD | TBD |
| Cost Accuracy | ±2% | TBD | TBD |
| Success Rate | >98% | TBD | TBD |
| Job Queue Peak | <5000 jobs | TBD | TBD |
| Database Throughput | >1000 events/sec | TBD | TBD |

---

## Chaos Testing

### Chaos 1: GPU Worker Timeout (Critical Resilience)

**Failure Mode:** GPU worker takes 60s but job timeout is 30s

**Test Steps:**
1. Configure GPU worker health check timeout: 30s
2. Submit job expected to take 60s
3. Verify: Job times out at 30s
4. Check: Retry queue (job moved there)
5. Monitor: Max 3 retries before failure
6. Verify: Cost event logs timeout

**Expected Behavior:**
- Job TIMEOUT at 30s (not stuck forever)
- Retry logic: exponential backoff (5s, 10s, 20s)
- After 3 retries: Job FAILED (not infinite loop)
- Cost tracking: Only charged for 30s attempts

**Pass Criteria:**
- ✓ Timeout fires reliably at 30s
- ✓ Exponential backoff implemented
- ✓ Max 3 retries enforced
- ✓ Cost accurate (30s * 3 = 90s charged)

---

### Chaos 2: Redis Down (Queue Resilience)

**Failure Mode:** Redis becomes unavailable during job processing

**Test Steps:**
1. Start processing 50 jobs (BullMQ in Redis)
2. Kill Redis instance mid-processing
3. Verify: New jobs queued in-memory (local fallback)
4. Monitor: No job loss (recover from local queue on restart)
5. Restart Redis
6. Verify: In-memory jobs flushed to Redis
7. Verify: No duplicate processing

**Expected Behavior:**
- In-memory fallback queue activated immediately
- No job loss (data persisted to disk if configured)
- Recovery automatic on Redis restart
- No duplicate job execution

**Pass Criteria:**
- ✓ In-memory fallback queue holds jobs
- ✓ Zero job loss during outage
- ✓ No duplicates after recovery
- ✓ Recovery time <5s

---

### Chaos 3: Network Partition (Observability Resilience)

**Failure Mode:** OpenTelemetry collector becomes unreachable

**Test Steps:**
1. Kill OpenTelemetry collector
2. Submit 10 jobs (cost tracking + metrics)
3. Verify: Metrics queued locally (not lost)
4. Monitor: No blocking (async collection)
5. Restart collector
6. Verify: Metrics flushed (backlog processed)

**Expected Behavior:**
- Metrics collection is async (fire & forget)
- Network failure doesn't block job processing
- Metrics queued locally during outage
- Automatic flush on collector recovery

**Pass Criteria:**
- ✓ Job processing unaffected by partition
- ✓ Metrics queued locally (<100ms overhead)
- ✓ Zero metric loss (buffered queue)
- ✓ Automatic flush on recovery

---

### Chaos 4: Concurrent Failure Cascade

**Failure Mode:** Multiple components fail simultaneously

**Test Configuration:**
```yaml
cascade_failure:
  - T+0s: GPU Worker 1 timeout
  - T+2s: GPU Worker 2 offline
  - T+5s: Circuit breaker opens (3 failures to LLM-Router)
  - T+10s: Redis latency spike (1000ms)
```

**Test Steps:**
1. Set up cascade timeline
2. Start 100 concurrent jobs
3. Execute failure cascade
4. Monitor: System behavior under stress
5. Verify: No data loss, graceful degradation
6. Measure: Recovery time to full capacity

**Expected Behavior:**
- Individual failures don't cascade
- Fallback chains work (Ollama if Claude fails)
- Queue doesn't overflow (backpressure works)
- Recovery staged (GPU 1 → GPU 2 → full)

**Pass Criteria:**
- ✓ No data loss despite cascade
- ✓ System remains operational
- ✓ Graceful degradation (reduced throughput, not failure)
- ✓ Recovery to full capacity <5min

---

## Test Execution Checklist

### Pre-Test
- [ ] Database seeded (clean state)
- [ ] Redis cleared (flush all)
- [ ] GPU workers healthy (health check passes)
- [ ] Ollama available (respond to ping)
- [ ] Claude API key valid
- [ ] OpenTelemetry exporter ready
- [ ] Monitoring dashboard open (real-time visibility)

### During Test
- [ ] Monitor CPU/Memory/Disk on each worker
- [ ] Monitor PostgreSQL query latency
- [ ] Monitor Redis memory usage
- [ ] Monitor GPU utilization
- [ ] Check logs for errors or warnings
- [ ] Verify no customer data exposure

### Post-Test
- [ ] Collect metrics and cost reports
- [ ] Verify all jobs completed/failed correctly
- [ ] Check database consistency
- [ ] Analyze logs for anomalies
- [ ] Generate test report

---

## Test Report Template

```markdown
# Phase 3 Integration Test Report
**Date:** 2026-04-XX
**Duration:** 10 hours
**Executed By:** @qa

## E2E Scenarios (10/10 PASS ✓)
- Scenario 1 (Simple Video): ✓ PASS
- Scenario 2 (Standard Video): ✓ PASS
- Scenario 3 (Complex Multi-Modal): ✓ PASS
- Scenario 4 (Voice Synthesis): ✓ PASS
- Scenario 5 (Checkpoint Resume): ✓ PASS
- Scenario 6 (Cost Accuracy): ✓ PASS
- Scenario 7 (Circuit Breaker): ✓ PASS
- Scenario 8 (Multi-Tenant): ✓ PASS
- Scenario 9 (Graceful Degradation): ✓ PASS
- Scenario 10 (End-to-End Pipeline): ✓ PASS

## Load Test Results
- Throughput: 100 jobs/min ✓
- P99 Latency: 28.5s (target: 30s) ✓
- Cost Accuracy: ±1.2% (target: ±2%) ✓
- Success Rate: 99.2% (target: >98%) ✓

## Chaos Test Results (4/4 PASS ✓)
- GPU Timeout: ✓ PASS
- Redis Down: ✓ PASS
- Network Partition: ✓ PASS
- Cascade Failure: ✓ PASS

## Issues Found
- [None] | [List any issues and remediation]

## Sign-Off
- @qa: APPROVED FOR PRODUCTION DEPLOYMENT
- @devops: Ready for deployment to staging

## Next Steps
1. Deploy to production
2. Monitor for 24h
3. Promote to GA
```

---

## Success Criteria Summary

| Criterion | Target | Method | Status |
|-----------|--------|--------|--------|
| **All E2E Scenarios** | 10/10 PASS | Run scenarios 1-10 | TBD |
| **Load Test Success** | 100 jobs concurrent | Monitor throughput | TBD |
| **Cost Accuracy** | ±2% tolerance | Compare estimate vs actual | TBD |
| **P99 Latency** | <30s | Monitor dashboard | TBD |
| **Success Rate** | >98% | Count failed jobs | TBD |
| **Chaos Resilience** | 4/4 scenarios PASS | Execute chaos tests | TBD |
| **Zero Data Loss** | 100% of jobs audited | Verify database | TBD |
| **Observability** | Full tracing | Check OpenTelemetry logs | TBD |

---

## Conclusion

This integration test plan validates Phase 3 across all 3 epics:
- **Epic 3.1:** Cost tracking accuracy (±2%)
- **Epic 3.2:** GPU worker resilience (graceful degradation)
- **Epic 3.3:** BullMQ checkpointing (resume capability)

All 10 E2E scenarios + load test + 4 chaos scenarios must PASS before production deployment.

**Target Completion Date:** 2026-04-12 (1 day)
**Estimated Duration:** 8-10 hours of testing
**Success Probability:** 95% (based on unit test pass rate: 435/435 ✓)
