# BullMQ Architecture — Phase 2 Gap 1

**Status:** ✅ Design Complete  
**Date:** 2026-04-11  
**Scope:** Job queue + checkpointing for 5-stage video pipeline  
**Effort:** 8 hours (3h setup, 3h jobs, 2h test/deploy)

---

## Quick Start

1. **First time?** Read [BULLMQ-QUICK-REFERENCE.md](BULLMQ-QUICK-REFERENCE.md) (5 min)
2. **Need details?** See [BULLMQ-ARCHITECTURE.md](BULLMQ-ARCHITECTURE.md) (30 min)
3. **Ready to code?** Use [BULLMQ-IMPLEMENTATION-CHECKLIST.md](BULLMQ-IMPLEMENTATION-CHECKLIST.md) (8h)
4. **Show me code!** Check [BULLMQ-CODE-SKELETON.py](BULLMQ-CODE-SKELETON.py) (20-line samples)

---

## What This Solves

**Problem:** Video workflow crashes → entire pipeline restarts, 2+ hours GPU compute lost.

**Solution:** Job queue (RQ) + PostgreSQL checkpoints + auto-resume = transparent recovery.

**Impact:**
- Job success rate > 99%
- GPU time saved: 2h per crash
- Error visibility: 100% (all logged)
- Cost tracking: 30-50% reduction (with Gap 3)

---

## The Five Stages

```
Stage 1: Script Generation  (LLM)     → script.json
Stage 2: Audio Synthesis    (TTS)     → audio.wav
Stage 3: Voice Segmentation (VAD)     → segments.json
Stage 4: Video Matting      (GPU)     → matte.mp4
Stage 5: Final Rendering    (Compose) → final_video.mp4
```

After each stage → checkpoint to PostgreSQL + upload artifact to Supabase.  
If worker crashes → resume from last checkpoint.

---

## Architecture Diagram

```
POST /api/videos/submit {brief}
            ↓
    [Redis Queue]
            ↓
    [RQ Worker]
    ├─ Stage1 → Checkpoint1
    ├─ Stage2 → Checkpoint2
    ├─ Stage3 → Checkpoint3 (CRASH) ❌
    │
    ← Resume from Checkpoint2
    └─ Stage3 (attempt 2) → Checkpoint3 ✓
       ├─ Stage4 → Checkpoint4 ✓
       └─ Stage5 → Checkpoint5 ✓
            ↓
    [PostgreSQL] [Supabase Storage]
    ✓ Checkpoints ✓ Artifacts (with TTL)
    ✓ Errors
    ✓ Metrics
```

---

## Files to Create

**Core:**
- `autoflow/migrations/001_create_job_tables.sql` (150 lines SQL)
- `autoflow/core/jobs/video_stages.py` (250 lines Python)
- `autoflow/core/jobs/error_handler.py` (80 lines)
- `autoflow/core/jobs/executor.py` (50 lines)
- `autoflow/core/jobs/checkpoint.py` (60 lines)
- `autoflow/core/storage/artifact_upload.py` (40 lines)
- `autoflow/api/endpoints/video_jobs.py` (40 lines)

**Tests:**
- `tests/test_video_jobs.py` (150 lines)
- `tests/test_workflow_e2e.py` (200 lines)
- `tests/test_load.py` (50 lines)

**Infra:**
- `requirements-jobs.txt` (15 lines)
- `/etc/systemd/system/autoflow-worker.service` (15 lines)

**Total:** ~950 lines production code + tests

---

## Dependencies

```bash
pip install -r requirements-jobs.txt

# Includes:
# rq==1.14.0 (job queue)
# rq-scheduler==0.14.1
# redis==5.0.0 (Redis client)
# psycopg2-binary==2.9.9 (PostgreSQL)
# supabase==2.0.0 (Storage)
# boto3==1.28.0 (S3/R2)
# python-json-logger==2.0.7 (Logging)
```

---

## Error Handling (E4 Taxonomy)

| Error | Category | Action | Backoff | Max Retries |
|-------|----------|--------|---------|-------------|
| E4_TIMEOUT | TRANSIENT | Retry now | 60s | 3 |
| E4_API_QUOTA | TRANSIENT | Retry now | 60s | 3 |
| E4_GPU_UNAVAIL | RECOVERABLE | Retry later | 300s | 2 |
| E4_OOM | FATAL | Escalate | — | 0 |
| E4_AUTH_FAIL | FATAL | Escalate | — | 0 |

All logged to `autoflow_errors` table with full traceback.

---

## Timeline (8 hours)

| Phase | Duration | What |
|-------|----------|------|
| 1 | 3h | PostgreSQL + Redis + env setup |
| 2 | 3h | 5 job classes + worker |
| 3-6 | 2h | Worker/test/deploy |

---

## Environment Variables

```ini
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:password@localhost/autoflow_db
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJhbGc...
LLM_ROUTER_URL=http://localhost:8000
TTS_API_URL=http://localhost:7860
GPU_WORKER_URL=https://<cloudflare-tunnel>.trycloudflare.com
```

---

## Commands

```bash
# Install
pip install -r requirements-jobs.txt
python -m alembic upgrade head

# Run worker
rq worker autoflow-jobs -l INFO

# Monitor
rq info
redis-cli --stat
psql -c "SELECT COUNT(*) FROM autoflow_checkpoints;"

# Test
pytest tests/test_video_jobs.py -v
pytest tests/test_workflow_e2e.py -v
pytest tests/test_load.py -v
```

---

## Success Metrics

- ✓ Job success rate > 99%
- ✓ Checkpoint hit rate > 95%
- ✓ Stage execution time P95 < 10 min
- ✓ Error escalation < 0.5%/hour
- ✓ Redis queue depth < 1000
- ✓ Worker CPU < 80%

---

## What's Next

**Gap 2:** Desktop GPU Worker Integration  
- Integrate GpuWorkerClient with Stage 4
- Configure Cloudflare Tunnel
- 12 hours, depends on Gap 1

**Gap 3:** LLM-Router-AIOX Alignment  
- Replace direct LLM calls
- Add cost tracking
- 6 hours, parallel with Gap 2

---

## Document Index

| Document | Size | Purpose |
|----------|------|---------|
| [BULLMQ-QUICK-REFERENCE.md](BULLMQ-QUICK-REFERENCE.md) | 7.3 KB | 30-sec overview + checklists |
| [BULLMQ-ARCHITECTURE.md](BULLMQ-ARCHITECTURE.md) | 30 KB | Full design (11 sections) |
| [BULLMQ-IMPLEMENTATION-CHECKLIST.md](BULLMQ-IMPLEMENTATION-CHECKLIST.md) | 12 KB | 6-phase implementation plan |
| [BULLMQ-CODE-SKELETON.py](BULLMQ-CODE-SKELETON.py) | 13 KB | 8 pseudocode components |
| [BULLMQ-DELIVERABLES.txt](BULLMQ-DELIVERABLES.txt) | 14 KB | Full summary + timeline |
| [README-BULLMQ.md](README-BULLMQ.md) | This file | Index + quick start |

**Total:** 76 KB documentation + 2,104 lines

---

## Sign-Off

- ✅ Architecture designed
- ✅ All components specified
- ✅ Testing strategy defined
- ✅ Deployment plan ready
- ⏳ Implementation: Ready for @dev

---

**Start here:** [BULLMQ-QUICK-REFERENCE.md](BULLMQ-QUICK-REFERENCE.md)
