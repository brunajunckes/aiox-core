# BullMQ Implementation Checklist — Gap 1

**Duration:** 8 hours (3h setup, 3h job classes, 2h testing)  
**Owner:** @dev (implementation)  
**Prerequisite:** BULLMQ-ARCHITECTURE.md (design document)

---

## PHASE 1: Database & Infrastructure Setup (3 hours)

### 1.1 PostgreSQL Schema Creation (45 min)

- [ ] Create migration file: `autoflow/migrations/001_create_job_tables.sql`
- [ ] Define `autoflow_checkpoints` table with JSONB outputs column
- [ ] Define `autoflow_errors` table with E4 taxonomy foreign key
- [ ] Define `autoflow_metrics` table for cost tracking
- [ ] Define `autoflow_error_taxonomy` lookup table
- [ ] Create indexes: `idx_checkpoint_workflow`, `idx_error_workflow`, `idx_metric_workflow`
- [ ] Run migration: `psql -d autoflow_db -f migrations/001_create_job_tables.sql`
- [ ] Verify tables created: `\dt autoflow_*` in psql
- [ ] Test: Insert sample checkpoint record, verify JSONB handling
- [ ] Backup: `pg_dump autoflow_db > autoflow_schema_backup.sql`

### 1.2 Supabase Storage Configuration (30 min)

- [ ] Create Supabase Storage bucket: `autoflow-artifacts`
- [ ] Configure lifecycle rules:
  - [ ] Stage 1-3 artifacts: 24-hour TTL (auto-delete)
  - [ ] Stage 4 matte: 7-day TTL
  - [ ] Stage 5 final: 90-day TTL
- [ ] Create `.env.local` entries: `SUPABASE_URL`, `SUPABASE_KEY`
- [ ] Test: Upload test file via Supabase client
- [ ] Verify: List bucket contents via API

### 1.3 Redis Configuration (30 min)

- [ ] Check Redis running: `redis-cli ping` → expect PONG
- [ ] Configure max memory: `redis-cli CONFIG SET maxmemory-policy allkeys-lru`
- [ ] Verify configuration persisted in `/etc/redis/redis.conf`
- [ ] Test queue connection: Create test queue, enqueue dummy job
- [ ] Monitor: `redis-cli --stat` (should show memory usage < 100MB initially)

### 1.4 Environment Variables (15 min)

Create `.env.production` with:
```ini
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:password@localhost/autoflow_db
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJhbGc...
LLM_ROUTER_URL=http://localhost:8000
TTS_API_URL=http://localhost:7860
GPU_WORKER_URL=https://<cloudflare-tunnel-domain>.trycloudflare.com
```

- [ ] Load test: `python -c "import os; from dotenv import load_dotenv; load_dotenv('.env.production'); print(os.getenv('REDIS_URL'))"`

---

## PHASE 2: Job Classes Implementation (3 hours)

### 2.1 Base Job Class (45 min)

- [ ] Create file: `autoflow/core/jobs/video_stages.py`
- [ ] Implement `BaseVideoJob` class with:
  - [ ] `create()` class method with metadata
  - [ ] `checkpoint()` method → PostgreSQL + Supabase
  - [ ] `_save_checkpoint()` → INSERT to autoflow_checkpoints
  - [ ] `_upload_artifacts()` → Upload to Supabase Storage
  - [ ] `execute()` abstract method (override in subclasses)
- [ ] Constants: `DEFAULT_TIMEOUT=1800`, `MAX_RETRIES=3`, `BACKOFF_SECONDS=60`
- [ ] Test: Instantiate BaseVideoJob, verify metadata structure

### 2.2 Five Stage Job Classes (90 min)

- [ ] Implement `Stage1ScriptGenerationJob`
  - [ ] Input: brief_text
  - [ ] Execute: Call LLM router → generate script.json
  - [ ] Output: checkpoint({script: ..., token_count: ...})
  - [ ] Test: Mock LLM call, verify script structure

- [ ] Implement `Stage2AudioSynthesisJob`
  - [ ] Input: script_json (from Stage 1 checkpoint)
  - [ ] Execute: Call TTS service → audio.wav
  - [ ] Output: checkpoint({audio: ..., duration_seconds: ...})
  - [ ] Test: Mock TTS, verify audio duration

- [ ] Implement `Stage3VoiceSegmentationJob`
  - [ ] Input: audio_wav (from Stage 2 checkpoint)
  - [ ] Execute: Call VAD model → segments.json
  - [ ] Output: checkpoint({segments: ..., num_segments: ...})
  - [ ] Test: Mock VAD, verify segments format

- [ ] Implement `Stage4VideoMattingJob`
  - [ ] Input: script.json + segments.json
  - [ ] Execute: Call GpuWorkerClient (stub for now)
  - [ ] Output: checkpoint({matte: ..., resolution: ...})
  - [ ] Test: Mock GPU worker, verify matte URL

- [ ] Implement `Stage5RenderingJob`
  - [ ] Input: matte.mp4 + audio.wav
  - [ ] Execute: Call rendering service → final_video.mp4
  - [ ] Output: checkpoint({video: ..., bitrate: ...})
  - [ ] Test: Mock rendering, verify final video URL

### 2.3 Error Handling Decorator (45 min)

- [ ] Create file: `autoflow/core/jobs/error_handler.py`
- [ ] Implement `execute_with_error_handling()` function:
  - [ ] Try/except for TimeoutError → E4_TIMEOUT → TRANSIENT retry (60s, 3x)
  - [ ] Try/except for GpuUnavailableError → E4_GPU_UNAVAIL → RECOVERABLE retry (300s, 2x)
  - [ ] Try/except for MemoryError/AuthError/ValueError → FATAL → escalate
  - [ ] Log all errors to autoflow_errors table
  - [ ] Webhook notification for escalations
- [ ] Test: Simulate each error type, verify logging

---

## PHASE 3: Worker & Queueing (45 min)

### 3.1 RQ Worker Implementation

- [ ] Create file: `autoflow/core/jobs/executor.py`
- [ ] Implement `run_worker()` function:
  - [ ] Create Redis connection
  - [ ] Create Queue: `Queue('autoflow-jobs', connection=redis_conn)`
  - [ ] Create Worker: `Worker([queue], connection=redis_conn)`
  - [ ] Attach event hooks: `handle_job_success()`, `handle_job_failure()`
  - [ ] Start worker: `worker.work(with_scheduler=True, logging_level='INFO')`
- [ ] Implement `handle_job_failure()` → resume_from_checkpoint()
- [ ] Implement `handle_job_success()` → log_metric()
- [ ] Test: Enqueue job, verify worker processes it

### 3.2 API Endpoint for Job Submission

- [ ] Create file: `autoflow/api/endpoints/video_jobs.py` (if not exists)
- [ ] Implement POST `/api/videos/submit`:
  - [ ] Accept JSON: `{brief: "...", user_id: "...", ...}`
  - [ ] Generate workflow_id = UUID
  - [ ] Enqueue Stage1ScriptGenerationJob
  - [ ] Return: `{workflow_id, job_id, status: QUEUED}`
- [ ] Implement GET `/api/videos/<workflow_id>/status`:
  - [ ] Fetch checkpoints from autoflow_checkpoints table
  - [ ] Fetch errors from autoflow_errors table
  - [ ] Return: `{workflow_id, current_stage, checkpoints: [...], errors: [...]}`
- [ ] Test: POST submit, then GET status (verify QUEUED)

---

## PHASE 4: Checkpoint Recovery (45 min)

### 4.1 Resume Logic Implementation

- [ ] Create file: `autoflow/core/jobs/checkpoint.py`
- [ ] Implement `fetch_checkpoint(workflow_id, stage)`:
  - [ ] Query: `SELECT * FROM autoflow_checkpoints WHERE workflow_id=? AND stage=? ORDER BY attempt DESC LIMIT 1`
  - [ ] Return: checkpoint record with outputs (JSONB)
- [ ] Implement `resume_from_checkpoint(workflow_id, failed_stage)`:
  - [ ] Load last successful checkpoint (failed_stage - 1)
  - [ ] Extract outputs as inputs for failed_stage
  - [ ] Increment attempt counter
  - [ ] Re-enqueue job with backoff
  - [ ] Return: new job_id
- [ ] Implement `mark_checkpoint_failed(workflow_id, stage, error)`:
  - [ ] Update autoflow_checkpoints: status = FAILED, error message
- [ ] Test: Create checkpoint, mark failed, resume, verify new job in queue

### 4.2 Artifact Upload Helper

- [ ] Create file: `autoflow/core/storage/artifact_upload.py`
- [ ] Implement `upload_artifacts(workflow_id, stage, outputs)`:
  - [ ] Iterate outputs keys (script, audio, segments, matte, video)
  - [ ] For each: upload to Supabase Storage
  - [ ] Path format: `autoflow-artifacts/{workflow_id}/stage{stage}_{key}`
  - [ ] Return: artifact URLs dict
- [ ] Implement `cleanup_artifacts(workflow_id, ttl_hours)`:
  - [ ] Query Supabase for artifacts older than ttl_hours
  - [ ] Delete via Storage API
- [ ] Test: Upload test file, verify in Supabase console

---

## PHASE 5: Testing Suite (2 hours)

### 5.1 Unit Tests (45 min)

Create `tests/test_video_jobs.py`:

- [ ] Test Stage1ScriptGenerationJob:
  - [ ] Mock LLM router, verify script.json structure
  - [ ] Verify checkpoint saved to database
  - [ ] Verify artifact uploaded to Supabase

- [ ] Test Stage2AudioSynthesisJob:
  - [ ] Mock TTS service, verify audio.wav duration
  - [ ] Verify checkpoint with duration_seconds

- [ ] Test error_handler decorator:
  - [ ] Simulate TimeoutError → verify TRANSIENT retry queued
  - [ ] Simulate GpuUnavailableError → verify RECOVERABLE retry queued
  - [ ] Simulate MemoryError → verify FATAL escalation logged

- [ ] Run: `pytest tests/test_video_jobs.py -v`

### 5.2 Integration Tests (45 min)

Create `tests/test_workflow_e2e.py`:

- [ ] Test full pipeline (Stage 1-5):
  - [ ] Create workflow_id
  - [ ] Enqueue Stage1
  - [ ] Mock execute Stage1 → verify checkpoint[1] saved
  - [ ] Auto-enqueue Stage2 (verify depends_on works)
  - [ ] Execute Stage2-5 sequentially
  - [ ] Verify all 5 checkpoints in database
  - [ ] Verify all artifacts in Supabase

- [ ] Test worker crash recovery:
  - [ ] Create checkpoints for Stage 1-2
  - [ ] Start Stage3 job, simulate crash (kill job)
  - [ ] Call resume_from_checkpoint(workflow_id, stage=3)
  - [ ] Verify Stage3 re-enqueued with attempt=2
  - [ ] Execute Stage3 again → verify success
  - [ ] Verify checkpoint[3] with attempt=2

- [ ] Test error escalation:
  - [ ] Enqueue Stage1 with mock LLM that throws MemoryError
  - [ ] Verify error logged to autoflow_errors with category=FATAL
  - [ ] Verify webhook notification sent
  - [ ] Verify job marked as FAILED (not retried)

- [ ] Run: `pytest tests/test_workflow_e2e.py -v`

### 5.3 Load Test (30 min)

Create `tests/test_load.py`:

- [ ] Enqueue 10 parallel workflows
- [ ] Measure: queue depth, worker CPU %, execution time
- [ ] Expected results:
  - [ ] All 10 workflows process without queue overflow
  - [ ] Worker CPU < 80%
  - [ ] Average stage execution time < 10 seconds

- [ ] Run: `pytest tests/test_load.py -v`

---

## PHASE 6: Deployment & Validation (1 hour)

### 6.1 Staging Deployment (30 min)

- [ ] Install dependencies: `pip install -r requirements-jobs.txt`
- [ ] Set environment variables (staging URLs)
- [ ] Run migrations: `python -m alembic upgrade head`
- [ ] Start worker as background process: `rq worker autoflow-jobs &`
- [ ] Test API: `curl -X POST http://localhost:5000/api/videos/submit -d '{"brief": "test"}'`
- [ ] Monitor worker: `rq info` (should show 1 worker)
- [ ] Check logs: `tail -f logs/worker.log` (should show job processing)

### 6.2 Systemd Service Setup (20 min)

Create `/etc/systemd/system/autoflow-worker.service`:

```ini
[Unit]
Description=AutoFlow RQ Worker
After=redis.service

[Service]
Type=simple
User=autoflow
WorkingDirectory=/root/autoflow
ExecStart=/usr/bin/python -m rq.cli.worker autoflow-jobs
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

- [ ] Create systemd service file
- [ ] Enable: `sudo systemctl enable autoflow-worker`
- [ ] Start: `sudo systemctl start autoflow-worker`
- [ ] Verify: `sudo systemctl status autoflow-worker`
- [ ] Check logs: `sudo journalctl -u autoflow-worker -f`

### 6.3 Production Checklist (10 min)

- [ ] Verify all environment variables set in production
- [ ] Run smoke test: `pytest tests/test_workflow_e2e.py::test_full_pipeline -v`
- [ ] Check database performance: `SELECT COUNT(*) FROM autoflow_checkpoints;` (should be fast)
- [ ] Monitor Redis: `redis-cli INFO memory` (should show < 500MB)
- [ ] Verify backup: `pg_dump autoflow_db | gzip > autoflow_db_$(date +%Y%m%d).sql.gz`

---

## Sign-Off Checklist

### Implementation Complete

- [ ] All 5 job classes implemented and tested
- [ ] Checkpoint save/resume logic verified
- [ ] Error handling (E4 taxonomy) integrated
- [ ] PostgreSQL schema created + indexes
- [ ] Supabase Storage configured with TTL
- [ ] RQ worker running successfully
- [ ] API endpoints working (submit + status)
- [ ] Unit tests pass (100% coverage)
- [ ] Integration tests pass (full pipeline)
- [ ] Load test validates 10+ parallel workflows
- [ ] Systemd service configured and verified
- [ ] Production environment validated

### Documentation Complete

- [ ] BULLMQ-ARCHITECTURE.md reviewed
- [ ] Runbook created for manual escalations
- [ ] Monitoring/alerting rules configured
- [ ] Deployment guide written

### Team Sign-Off

- [ ] @dev: Implementation complete
- [ ] @qa: All tests passing
- [ ] @architect: Design validated
- [ ] @devops: Ready for deployment

---

**Ready for Production Rollout!**
