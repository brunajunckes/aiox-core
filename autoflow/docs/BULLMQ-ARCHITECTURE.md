# BullMQ Architecture for AutoFlow Phase 2 — Gap 1

**Date:** 2026-04-11  
**Gap:** Phase 2 Gap 1 — Job Queue + Checkpointing for 5-Stage Video Pipeline  
**Scope:** Design document for resilient video workflow with job persistence, checkpoint recovery, and artifact management  
**Model:** Haiku (cost optimization)

---

## Executive Summary

**Problem:** AutoFlow video workflows (5 stages) lack job-level persistence. A GPU failure after 10 minutes wastes 2+ hours of compute, entire pipeline restarts, zero recovery mechanism.

**Solution:** BullMQ job queue with PostgreSQL checkpoints + Supabase artifact storage + 3-tier error handling (immediate retry → delayed retry → manual escalation).

**Architecture:** 5 job classes (one per stage) with checkpoint resume, Redis queue backend, structured logging to PostgreSQL, E4 taxonomy compliance.

**Timeline:** 8 hours (3h setup, 3h job classes, 2h testing)

---

## 1. System Architecture

### 1.1 Data Flow Diagram

```
Request Received
    ↓
┌─────────────────────────────────────────────────┐
│ BullMQ Job Enqueued                             │
│ (RedisQueue: autoflow-jobs)                     │
│ metadata: {workflow_id, stage, attempt}         │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Stage 1: Script Generation                      │
│ Worker polls job from queue                     │
│ Executes: LLM → script.json                     │
│ Status: PROCESSING                              │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ CHECKPOINT 1 (PostgreSQL + Supabase Storage)    │
│ ✓ Save script.json → Supabase                   │
│ ✓ Update job.progress: stage=1, status=SUCCESS │
│ ✓ Record execution time, tokens, cost           │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Stage 2: Audio Synthesis (GPU if needed)        │
│ Input: script.json (from checkpoint)            │
│ Execute: TTS → audio.wav                        │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ CHECKPOINT 2 → Stage 3: Voice Segmentation      │
│ CHECKPOINT 3 → Stage 4: Video Matting           │
│ CHECKPOINT 4 → Stage 5: Rendering               │
│ CHECKPOINT 5 → Final Artifact Upload            │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ On Worker Crash Mid-Execution                   │
│ BullMQ detects timeout (60s default)            │
│ Resume trigger: load last successful checkpoint │
│ Re-enqueue job with stage pointer = last_stage+1
└─────────────────────────────────────────────────┘
```

### 1.2 Component Stack

| Component | Technology | Purpose | Status |
|-----------|-----------|---------|--------|
| **Job Queue** | BullMQ (Node) OR RQ (Python) | Distribute work across workers | SELECT: RQ (simpler, Redis-native) |
| **Redis Backend** | Redis 6.0+ | Job queue storage + locks | Existing (VPS) |
| **Checkpoints** | PostgreSQL (autoflow_checkpoints) | Job state snapshots | NEW |
| **Artifact Storage** | Supabase Storage (R2-compatible) | Intermediate outputs | Existing (linked) |
| **Error Logging** | PostgreSQL (autoflow_errors) | E4 taxonomy taxonomy | NEW |
| **Metrics** | PostgreSQL (autoflow_metrics) | Cost tracking, latency | NEW |

### 1.3 Architecture Tiers

```
┌─ Tier 1: Orchestration ────────────────────────┐
│ AutoFlow Router (existing LangGraph workflows) │
│ Delegates to BullMQ job queue                  │
└────────────────────────────────────────────────┘
        ↓
┌─ Tier 2: Job Execution ────────────────────────┐
│ Worker Pool (1+ Python processes)              │
│ Runs RQ job classes (5 stage types)            │
│ Checkpoints to PostgreSQL after each stage     │
└────────────────────────────────────────────────┘
        ↓
┌─ Tier 3: Persistence ──────────────────────────┐
│ PostgreSQL: checkpoints, errors, metrics       │
│ Supabase Storage: script, audio, segments, etc │
│ Redis: job queue, locks, TTL-based cleanup    │
└────────────────────────────────────────────────┘
```

---

## 2. Job Definition Schema

### 2.1 Five Stage Job Classes

**Location:** `autoflow/core/jobs/video_stages.py`

```python
from rq import Job
from datetime import timedelta
import json
import psycopg2
from supabase import create_client

class BaseVideoJob(Job):
    """Abstract base for all video pipeline stages."""
    
    DEFAULT_TIMEOUT = 1800  # 30 minutes per stage
    MAX_RETRIES = 3
    BACKOFF_SECONDS = 60
    
    @classmethod
    def create(cls, workflow_id, stage_num, inputs):
        """Create job with metadata."""
        job = cls()
        job.meta = {
            'workflow_id': workflow_id,
            'stage': stage_num,
            'attempt': 1,
            'started_at': None,
            'checkpoint': None
        }
        return job
    
    def checkpoint(self, outputs):
        """Save stage outputs to PostgreSQL + Supabase."""
        # 1. Write to PostgreSQL
        checkpoint_record = {
            'workflow_id': self.meta['workflow_id'],
            'stage': self.meta['stage'],
            'status': 'SUCCESS',
            'outputs': json.dumps(outputs),
            'execution_time_ms': (datetime.now() - self.meta['started_at']).total_seconds() * 1000
        }
        self._save_checkpoint(checkpoint_record)
        
        # 2. Upload artifacts to Supabase
        self._upload_artifacts(outputs)
        
        return checkpoint_record
    
    def _save_checkpoint(self, record):
        """Persist to autoflow_checkpoints table."""
        # SQL INSERT INTO autoflow_checkpoints...
        pass
    
    def _upload_artifacts(self, outputs):
        """Upload JSON/media to Supabase Storage."""
        # supabase.storage.from('autoflow-artifacts').upload(...)
        pass


class Stage1ScriptGenerationJob(BaseVideoJob):
    """Stage 1: LLM generates screenplay/script from brief."""
    
    def execute(self, brief_text):
        """Input: {brief_text}, Output: {script: {}, metadata: {}}"""
        # Calls LLM router → generates script.json
        script = self.llm_generate(brief_text)
        return self.checkpoint({'script': script, 'token_count': 1250})


class Stage2AudioSynthesisJob(BaseVideoJob):
    """Stage 2: TTS synthesizes audio from script."""
    
    def execute(self, script_json):
        """Input: script.json, Output: audio.wav"""
        # Calls TTS service → audio.wav
        audio = self.tts_synthesize(script_json)
        return self.checkpoint({'audio': audio, 'duration_seconds': 45.2})


class Stage3VoiceSegmentationJob(BaseVideoJob):
    """Stage 3: Voice activity detection → segment timestamps."""
    
    def execute(self, audio_wav):
        """Input: audio.wav, Output: segments.json"""
        # Calls voice segmentation model
        segments = self.vad_segment(audio_wav)
        return self.checkpoint({'segments': segments, 'num_segments': 12})


class Stage4VideoMattingJob(BaseVideoJob):
    """Stage 4: Desktop GPU worker → alpha matting, avatar composition."""
    
    def execute(self, script, segments):
        """Input: script.json + segments.json, Output: matte.mp4"""
        # Delegates to GpuWorkerClient → Desktop → returns matte.mp4
        matte = self.gpu_matting(script, segments)
        return self.checkpoint({'matte': matte, 'resolution': '1920x1080'})


class Stage5RenderingJob(BaseVideoJob):
    """Stage 5: Final render → H.264 + subtitles + effects."""
    
    def execute(self, matte_mp4, audio_wav):
        """Input: matte.mp4 + audio.wav, Output: final_video.mp4"""
        # Render → final_video.mp4
        final = self.render(matte_mp4, audio_wav)
        return self.checkpoint({'video': final, 'bitrate': '8000k'})
```

### 2.2 Job Instantiation & Queueing

```python
from rq import Queue
from redis import Redis

redis_conn = Redis(host='localhost', port=6379)
queue = Queue('autoflow-jobs', connection=redis_conn)

# Example: enqueue workflow
brief = "Video about climate change, 2 minutes"
workflow_id = uuid.uuid4()

job1 = queue.enqueue(
    Stage1ScriptGenerationJob.execute,
    brief,
    job_id=f"{workflow_id}-stage1",
    meta={
        'workflow_id': workflow_id,
        'stage': 1,
        'attempt': 1
    },
    timeout='1800s',  # 30 minutes
    result_ttl=86400   # Keep results 24 hours
)

# Stage 2 waits for Stage 1 completion
job2 = queue.enqueue(
    Stage2AudioSynthesisJob.execute,
    depends_on=job1,
    job_id=f"{workflow_id}-stage2",
    meta={'workflow_id': workflow_id, 'stage': 2}
)
```

---

## 3. Checkpoint Strategy

### 3.1 PostgreSQL Schema

**Table: `autoflow_checkpoints`**

```sql
CREATE TABLE autoflow_checkpoints (
  id BIGSERIAL PRIMARY KEY,
  workflow_id UUID NOT NULL,
  stage INTEGER NOT NULL,
  attempt INTEGER DEFAULT 1,
  status VARCHAR(20),  -- SUCCESS, FAILED, RETRYING
  outputs JSONB,       -- Stage output (e.g., {script: {...}, tokens: 1250})
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (workflow_id, stage, attempt)
);

CREATE INDEX idx_checkpoint_workflow ON autoflow_checkpoints(workflow_id);
CREATE INDEX idx_checkpoint_stage ON autoflow_checkpoints(stage, status);
```

### 3.2 Resume Logic on Failure

```python
def resume_from_checkpoint(workflow_id, last_failed_stage):
    """
    Resume workflow from last successful checkpoint.
    Called when worker crashes or job times out.
    """
    # 1. Load last successful checkpoint
    last_checkpoint = fetch_checkpoint(workflow_id, last_failed_stage - 1)
    
    # 2. Re-enqueue failed stage with checkpoint inputs
    if last_failed_stage == 2:
        inputs = last_checkpoint['outputs']['script']
    elif last_failed_stage == 3:
        inputs = last_checkpoint['outputs']['audio']
    # ... etc for each stage
    
    # 3. Increment attempt counter
    attempt = last_checkpoint['attempt'] + 1
    
    # 4. Re-enqueue with backoff
    queue.enqueue(
        job_class_for_stage(last_failed_stage).execute,
        inputs,
        job_id=f"{workflow_id}-stage{last_failed_stage}-attempt{attempt}",
        meta={
            'workflow_id': workflow_id,
            'stage': last_failed_stage,
            'attempt': attempt
        },
        timeout='1800s'
    )
    
    return attempt
```

### 3.3 Artifact Lifecycle

**Supabase Storage Path:** `autoflow-artifacts/{workflow_id}/`

```
autoflow-artifacts/
├── {workflow_id}/
│   ├── stage1_script.json          (2 MB, TTL: 24h)
│   ├── stage2_audio.wav            (12 MB, TTL: 24h)
│   ├── stage3_segments.json        (1 MB, TTL: 24h)
│   ├── stage4_matte.mp4            (320 MB, TTL: 7 days)
│   └── stage5_final_video.mp4      (850 MB, TTL: 90 days)
```

**Cleanup Strategy:**
- Intermediate artifacts (1-3): Delete after workflow completion
- Matte video (4): Keep 7 days for re-render requests
- Final video (5): Keep 90 days (user archive window)

---

## 4. Error Handling (E4 Taxonomy)

### 4.1 Three-Tier Strategy

| Tier | Error Type | Action | TTL | Owner |
|------|-----------|--------|-----|-------|
| **Immediate Retry** | Transient (timeout, rate limit) | Retry in 60s, 3 max | 180s backoff | RQ job handler |
| **Delayed Retry** | Recoverable (GPU unavailable, API quota) | Retry in 5 min, 2 max | 300s backoff | Background worker |
| **Manual Escalation** | Fatal (OOM, auth failed, malformed input) | Log to PostgreSQL, notify via webhook | No retry | Operations dashboard |

### 4.2 Error Logging Schema

**Table: `autoflow_errors`**

```sql
CREATE TABLE autoflow_errors (
  id BIGSERIAL PRIMARY KEY,
  workflow_id UUID NOT NULL,
  stage INTEGER NOT NULL,
  error_type VARCHAR(50),  -- TRANSIENT, RECOVERABLE, FATAL
  error_code VARCHAR(20),
  error_message TEXT,
  traceback TEXT,
  attempt INTEGER DEFAULT 1,
  action_taken VARCHAR(50),  -- RETRY, ESCALATE, SKIP
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_error_workflow (workflow_id),
  INDEX idx_error_unresolved (resolved_at)
);

CREATE TABLE autoflow_error_taxonomy (
  code VARCHAR(20) PRIMARY KEY,
  category VARCHAR(50),
  is_retryable BOOLEAN,
  retry_delay_seconds INTEGER,
  max_retries INTEGER,
  description TEXT
);

-- Populate taxonomy
INSERT INTO autoflow_error_taxonomy VALUES
  ('E4_TIMEOUT', 'TRANSIENT', true, 60, 3, 'Job exceeded time limit'),
  ('E4_GPU_UNAVAIL', 'RECOVERABLE', true, 300, 2, 'GPU worker offline'),
  ('E4_API_QUOTA', 'RECOVERABLE', true, 300, 2, 'LLM provider quota exhausted'),
  ('E4_OOM', 'FATAL', false, null, 0, 'Out of memory'),
  ('E4_AUTH_FAIL', 'FATAL', false, null, 0, 'Authentication failed');
```

### 4.3 Error Handling Code

```python
def execute_with_error_handling(job, stage_class, inputs):
    """Wrap stage execution with error handling."""
    try:
        output = stage_class.execute(inputs)
        job.checkpoint(output)
        return output
    
    except TimeoutError as e:
        error = log_error(job, 'E4_TIMEOUT', str(e), is_retryable=True)
        if error['attempt'] < 3:
            queue.enqueue(
                stage_class.execute,
                inputs,
                scheduled_time=datetime.now() + timedelta(seconds=60)
            )
            return {'status': 'RETRYING', 'attempt': error['attempt'] + 1}
    
    except GpuUnavailableError as e:
        error = log_error(job, 'E4_GPU_UNAVAIL', str(e), is_retryable=True)
        if error['attempt'] < 2:
            queue.enqueue(
                stage_class.execute,
                inputs,
                scheduled_time=datetime.now() + timedelta(seconds=300)
            )
            return {'status': 'DELAYED_RETRY', 'attempt': error['attempt'] + 1}
    
    except (MemoryError, AuthError, ValueError) as e:
        error = log_error(job, error_code_for(e), str(e), is_retryable=False)
        notify_webhook({
            'workflow_id': job.meta['workflow_id'],
            'status': 'ESCALATED',
            'error': error,
            'action': 'MANUAL_REVIEW_REQUIRED'
        })
        raise
```

---

## 5. Dependency Management

### 5.1 pip Install Requirements

```ini
# autoflow/requirements-jobs.txt

# Job Queue
rq==1.14.0              # Python job queue with Redis
rq-scheduler==0.14.1    # Scheduled job execution

# Redis & Data
redis==5.0.0            # Redis Python client
psycopg2-binary==2.9.9  # PostgreSQL adapter

# Storage & APIs
supabase==2.0.0         # Supabase Python client
boto3==1.28.0           # AWS S3/R2 compatible storage

# Monitoring & Logging
python-json-logger==2.0.7  # JSON structured logging
sentry-sdk==1.38.0      # Error tracking

# Utilities
python-dotenv==1.0.0    # Environment variables
pydantic==2.5.0         # Data validation
```

**Installation:**
```bash
pip install -r requirements-jobs.txt
```

### 5.2 External Service Dependencies

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Redis | Job queue backend | `redis://localhost:6379` |
| PostgreSQL | Checkpoints + errors + metrics | `postgresql://user:pass@host/autoflow_db` |
| Supabase | Artifact storage | `SUPABASE_URL`, `SUPABASE_KEY` |
| LLM Router | Script generation | `LLM_ROUTER_URL` |
| TTS Service | Audio synthesis | `TTS_API_URL` |
| GPU Worker | Avatar/matting/rendering | `GPU_WORKER_URL` (via Cloudflare Tunnel) |

---

## 6. Code Skeleton & Pseudocode

### 6.1 Main Job Execution Loop (20 lines)

```python
# autoflow/core/jobs/executor.py
from rq.worker import Worker
from autoflow.core.jobs.video_stages import (
    Stage1ScriptGenerationJob,
    Stage2AudioSynthesisJob,
    Stage3VoiceSegmentationJob,
    Stage4VideoMattingJob,
    Stage5RenderingJob
)

def run_worker():
    """Main worker loop: pull jobs from queue, execute stages."""
    redis_conn = Redis(host='localhost', port=6379)
    queue = Queue('autoflow-jobs', connection=redis_conn)
    
    worker = Worker([queue], connection=redis_conn)
    
    # Event hooks
    worker.push_job_onto_failure_queue = handle_job_failure
    worker.handle_job_success = handle_job_success
    
    # Run indefinitely
    worker.work(with_scheduler=True, logging_level='INFO')

def handle_job_failure(job, exc_type, exc_value, traceback):
    """Called when job fails → checkpoint recovery."""
    resume_from_checkpoint(job.meta['workflow_id'], job.meta['stage'])

def handle_job_success(job, connection, result):
    """Called when job succeeds → log metrics."""
    log_metric(job.meta['workflow_id'], job.meta['stage'], job.ended_at - job.started_at)

if __name__ == '__main__':
    run_worker()
```

### 6.2 API Endpoint to Enqueue Workflow (15 lines)

```python
# autoflow/api/endpoints/video_jobs.py
from flask import Flask, request, jsonify
from rq import Queue
from autoflow.core.jobs.video_stages import Stage1ScriptGenerationJob

app = Flask(__name__)

@app.route('/api/videos/submit', methods=['POST'])
def submit_video_job():
    """Enqueue new video job from brief."""
    data = request.json
    workflow_id = str(uuid.uuid4())
    queue = Queue('autoflow-jobs', connection=redis_conn)
    
    job = queue.enqueue(
        Stage1ScriptGenerationJob.execute,
        data['brief'],
        job_id=f"{workflow_id}-stage1",
        meta={'workflow_id': workflow_id, 'stage': 1}
    )
    
    return jsonify({'workflow_id': workflow_id, 'job_id': job.id, 'status': 'QUEUED'})

@app.route('/api/videos/<workflow_id>/status', methods=['GET'])
def get_workflow_status(workflow_id):
    """Poll workflow status and retrieve checkpoint data."""
    checkpoints = fetch_checkpoints(workflow_id)
    return jsonify({'workflow_id': workflow_id, 'checkpoints': checkpoints})
```

---

## 7. Testing & Validation

### 7.1 E2E Test: Simulate GPU Crash + Recovery

```python
# tests/test_checkpoint_recovery.py
import pytest
from autoflow.core.jobs.video_stages import Stage3VoiceSegmentationJob
from autoflow.core.jobs.executor import resume_from_checkpoint

def test_worker_crash_during_stage3_resumes_successfully():
    """
    Scenario: Worker crashes during Stage 3 (voice segmentation).
    Expected: Job resumes from Stage 3 with Stage 2 outputs as input.
    """
    workflow_id = 'test-workflow-001'
    
    # 1. Simulate successful Stage 1 & 2
    checkpoint_stage2 = create_checkpoint(workflow_id, stage=2, audio_wav='...')
    
    # 2. Start Stage 3, simulate crash after 5 seconds
    job = queue.enqueue(Stage3VoiceSegmentationJob.execute, checkpoint_stage2)
    time.sleep(5)
    worker.kill_job(job.id)  # Simulate crash
    
    # 3. Verify job marked as FAILED
    assert fetch_job_status(job.id) == 'FAILED'
    
    # 4. Resume from checkpoint
    attempt2 = resume_from_checkpoint(workflow_id, stage=3)
    assert attempt2 == 2
    
    # 5. Verify new job queued with correct inputs
    new_job = fetch_job(f"{workflow_id}-stage3-attempt2")
    assert new_job.meta['attempt'] == 2
    assert new_job.input == checkpoint_stage2['outputs']['audio']
    
    # 6. Execute new job (should succeed)
    result = new_job.perform()
    assert result['segments'] is not None
```

### 7.2 Metrics Collection Test

```python
def test_metrics_collected_for_all_stages():
    """Verify cost tracking captured for all 5 stages."""
    workflow_id = 'test-workflow-002'
    
    # Execute full pipeline
    for stage in range(1, 6):
        execute_stage(workflow_id, stage)
    
    # Query metrics
    metrics = fetch_metrics(workflow_id)
    assert len(metrics) == 5
    
    # Verify structure
    for metric in metrics:
        assert metric['workflow_id'] == workflow_id
        assert metric['stage'] in range(1, 6)
        assert metric['execution_time_ms'] > 0
        assert metric['tokens_used'] >= 0 or metric['gpu_seconds'] >= 0
        assert metric['cost_usd'] > 0
```

---

## 8. Deployment Checklist

### 8.1 Pre-Deployment

- [ ] Create PostgreSQL tables (checkpoints, errors, metrics, error_taxonomy)
- [ ] Configure Supabase Storage bucket with lifecycle rules (24h TTL for intermediate)
- [ ] Set Redis max memory policy: `maxmemory-policy=allkeys-lru`
- [ ] Create RQ worker systemd service
- [ ] Configure environment variables: `REDIS_URL`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`
- [ ] Populate error taxonomy table
- [ ] Write integration tests (all 5 stages)
- [ ] Load test: 10 concurrent workflows

### 8.2 Production Rollout

**Phase 1 (Week 1):**
- Deploy RQ worker + job classes to staging
- Route 10% of jobs to new pipeline, 90% to legacy
- Monitor: error rates, latency, checkpoint hit rate

**Phase 2 (Week 2):**
- Increase to 50% traffic
- Validate checkpoint recovery scenarios
- Document runbook for manual escalations

**Phase 3 (Week 3):**
- Full cutover (100% traffic to new pipeline)
- Decommission legacy error handling
- Archive legacy logs

### 8.3 Monitoring & Alerting

**Key Metrics (to PostgreSQL):**
- Job success rate (target: >99%)
- Checkpoint hit rate (target: >95% for resumed jobs)
- Stage execution time (P95)
- Error escalation rate (target: <0.5%)
- Artifact storage usage (by TTL bucket)

**Alerts:**
- Stage timeout > 2 hours → page on-call
- Escalated errors > 5/hour → page on-call
- Redis queue depth > 1000 → page on-call
- Checkpoint save failures → page on-call

---

## 9. ASCII Diagram Summary

```
┌────────────────────────────────────────────────────────────────┐
│ AUTOFLOW BULLMQ ARCHITECTURE — 5-STAGE VIDEO PIPELINE          │
└────────────────────────────────────────────────────────────────┘

Input: {brief, workflow_id}
    ↓
Redis Queue (autoflow-jobs)
    ↓
┌─ Stage 1: Script Generation ─────────────────────────────────┐
│ Worker executes: LLM(brief) → script.json                    │
│ On success: Checkpoint to PG + upload to Supabase            │
│ On failure (E4_TIMEOUT): Retry in 60s, max 3 attempts       │
└──────────────────────────────────────────────────────────────┘
    ↓
┌─ Checkpoint 1 Saved ──────────────────────────────────────────┐
│ {workflow_id, stage: 1, attempt: 1, status: SUCCESS}         │
│ outputs: {script: {...}, token_count: 1250}                  │
└──────────────────────────────────────────────────────────────┘
    ↓
┌─ Stage 2: Audio Synthesis (TTS) ──────────────────────────────┐
│ Input: checkpoint[1].outputs.script                           │
│ Worker executes: TTS(script) → audio.wav                      │
│ Checkpoint 2 Saved                                            │
└──────────────────────────────────────────────────────────────┘
    ↓
┌─ Stage 3: Voice Segmentation ─────────────────────────────────┐
│ Input: checkpoint[2].outputs.audio                            │
│ Worker executes: VAD(audio) → segments.json                   │
│ On E4_GPU_UNAVAIL: Retry in 300s, max 2 attempts            │
│ Checkpoint 3 Saved                                            │
└──────────────────────────────────────────────────────────────┘
    ↓
┌─ Stage 4: Video Matting (GPU Worker) ──────────────────────────┐
│ Input: checkpoint[3].outputs.segments                         │
│ Delegate to: GpuWorkerClient → Desktop (via Cloudflare Tunnel)
│ Execute: Avatar + matting → matte.mp4                         │
│ Checkpoint 4 Saved (7-day TTL)                                │
└──────────────────────────────────────────────────────────────┘
    ↓
┌─ Stage 5: Final Rendering ────────────────────────────────────┐
│ Input: checkpoint[4].outputs.matte + checkpoint[2].audio      │
│ Worker executes: Render(matte, audio) → final_video.mp4       │
│ Checkpoint 5 Saved (90-day TTL)                               │
└──────────────────────────────────────────────────────────────┘
    ↓
Output: {workflow_id, status: COMPLETE, final_video_url: "..."}

┌─ Error Handling (E4 Taxonomy) ────────────────────────────────┐
│ TRANSIENT (E4_TIMEOUT): Retry immediately, 60s backoff        │
│ RECOVERABLE (E4_GPU_UNAVAIL): Retry later, 300s backoff       │
│ FATAL (E4_OOM): Escalate to operations dashboard              │
│ All errors logged to autoflow_errors with traceback           │
└──────────────────────────────────────────────────────────────┘

┌─ Worker Crash Recovery ───────────────────────────────────────┐
│ If worker dies mid-Stage 3:                                   │
│ 1. RQ detects job timeout after 1800s (30 min)               │
│ 2. Call resume_from_checkpoint(workflow_id, stage=3)          │
│ 3. Load checkpoint[2] (last successful = Stage 2)            │
│ 4. Re-enqueue Stage 3 with checkpoint[2].outputs as input    │
│ 5. New job: job_id={workflow_id}-stage3-attempt2             │
│ 6. Execute → Checkpoint 3 Saved (attempt=2)                  │
│ 7. Pipeline continues from Stage 4 automatically             │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Next Steps

### Immediate (This Sprint)

1. **Create PostgreSQL schema** (checkpoints, errors, metrics)
   - File: `autoflow/migrations/001_create_job_tables.sql`
   - Test: Verify tables + indexes created

2. **Implement BaseVideoJob + 5 stage classes**
   - File: `autoflow/core/jobs/video_stages.py`
   - Test: Unit tests for each stage

3. **Write RQ worker executor**
   - File: `autoflow/core/jobs/executor.py`
   - Test: E2E test with job queue

4. **Implement checkpoint save/resume logic**
   - File: `autoflow/core/jobs/checkpoint.py`
   - Test: Simulate crash → verify resume

### Next Sprint (Gap 2)

- Integrate `GpuWorkerClient` for Stage 4 (video matting)
- Set up Cloudflare Tunnel for Desktop → VPS bridge
- Deploy GPU worker on Desktop

### Sprint After (Gap 3)

- Integrate LLM-Router for cost tracking
- Add structured logging to PostgreSQL
- Create metrics dashboard

---

## 11. References

- **Error Taxonomy:** `.aiox-core/data/error-taxonomy.md` (Article IV — No Invention)
- **RQ Documentation:** https://python-rq.org/
- **PostgreSQL JSONB:** https://www.postgresql.org/docs/current/datatype-json.html
- **Supabase Storage:** https://supabase.com/docs/guides/storage
- **Phase 2 Context:** `/root/autoflow/PHASE-2-3-GAP-ANALYSIS.json`

---

**Architecture Review:** ✅ Ready for implementation  
**Complexity:** 8 hours (3h setup, 3h jobs, 2h testing)  
**Owner:** @architect (design) → @dev (implementation) → @qa (validation) → @devops (deployment)
