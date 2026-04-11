# BullMQ Quick Reference — Gap 1

**TL;DR:** Job queue + PostgreSQL checkpoints + Supabase storage = resilient 5-stage video pipeline with automatic recovery.

---

## 1. Architecture in 30 Seconds

```
User Brief → Redis Queue → Stage 1 → Checkpoint 1 → Stage 2 → ... → Stage 5 → Video

If worker crashes at Stage 3:
  Resume from Checkpoint 2 → re-execute Stage 3 → continue
  (No re-processing of Stages 1-2)
```

---

## 2. Five Job Classes

| Stage | Input | Process | Output |
|-------|-------|---------|--------|
| **1** | Brief text | LLM → script.json | script |
| **2** | script.json | TTS → audio.wav | audio |
| **3** | audio.wav | VAD → segments.json | segments |
| **4** | script + segments | GPU → matte.mp4 | matte (7-day TTL) |
| **5** | matte + audio | Render → video.mp4 | video (90-day TTL) |

---

## 3. Error Handling (E4 Taxonomy)

```
TRANSIENT (timeout)          → Retry 60s, 3x
  Example: E4_TIMEOUT, E4_API_QUOTA

RECOVERABLE (temporary)      → Retry 300s, 2x
  Example: E4_GPU_UNAVAIL

FATAL (unrecoverable)        → Escalate, no retry
  Example: E4_OOM, E4_AUTH_FAIL
```

---

## 4. Checkpoint Schema (PostgreSQL)

```sql
-- Save after each stage
INSERT INTO autoflow_checkpoints (workflow_id, stage, attempt, status, outputs)
VALUES ('abc-123', 1, 1, 'SUCCESS', '{"script": {...}, "tokens": 1250}');

-- Resume on crash
SELECT outputs FROM autoflow_checkpoints
WHERE workflow_id = 'abc-123' AND stage = 2
ORDER BY attempt DESC LIMIT 1;
```

---

## 5. Key Dependency Tree

```
BaseVideoJob (abstract)
├── Stage1ScriptGenerationJob
├── Stage2AudioSynthesisJob
├── Stage3VoiceSegmentationJob
├── Stage4VideoMattingJob
└── Stage5RenderingJob

execute_with_error_handling() → catches errors → logs to autoflow_errors
checkpoint() → saves to PostgreSQL + Supabase Storage
resume_from_checkpoint() → loads last successful, re-enqueues with backoff
```

---

## 6. Implementation Files

| File | Purpose | Lines |
|------|---------|-------|
| `autoflow/migrations/001_create_job_tables.sql` | PostgreSQL schema | ~150 |
| `autoflow/core/jobs/video_stages.py` | 5 job classes + base | ~250 |
| `autoflow/core/jobs/error_handler.py` | E4 error handling | ~80 |
| `autoflow/core/jobs/executor.py` | RQ worker loop | ~50 |
| `autoflow/core/jobs/checkpoint.py` | Checkpoint save/resume | ~60 |
| `autoflow/api/endpoints/video_jobs.py` | Submit + status API | ~40 |
| `tests/test_video_jobs.py` | Unit tests | ~150 |
| `tests/test_workflow_e2e.py` | Integration tests | ~200 |

**Total: ~950 lines of code**

---

## 7. Environment Variables

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

## 8. Commands

### Install
```bash
pip install -r requirements-jobs.txt
python -m alembic upgrade head  # Run migrations
```

### Run Worker
```bash
# Manual
rq worker autoflow-jobs -l INFO

# Systemd (production)
sudo systemctl start autoflow-worker
sudo systemctl status autoflow-worker
```

### Test
```bash
pytest tests/test_video_jobs.py -v
pytest tests/test_workflow_e2e.py -v
pytest tests/test_load.py -v
```

### Monitor
```bash
rq info                              # Worker status
redis-cli --stat                     # Redis memory
tail -f logs/worker.log              # Worker logs
psql -c "SELECT COUNT(*) FROM autoflow_checkpoints;"  # Checkpoint count
```

---

## 9. Deployment Timeline

| Phase | Duration | What |
|-------|----------|------|
| **Setup** | 3h | PostgreSQL + Redis + env |
| **Code** | 3h | 5 job classes + worker |
| **Test** | 2h | Unit + integration + load |
| **Deploy** | 1h | Systemd + monitoring |
| **Total** | **8h** | |

---

## 10. Critical Success Metrics

- [ ] Job success rate > 99%
- [ ] Checkpoint hit rate > 95% (for resumed jobs)
- [ ] Stage execution time P95 < 10 min
- [ ] Error escalation rate < 0.5%/hour
- [ ] Redis queue depth < 1000 jobs
- [ ] Worker CPU utilization < 80%

---

## 11. What This Solves (Gap 1)

**Before (Problem):**
```
Stage 1 → Stage 2 → Stage 3 (CRASH) ❌
→ Entire pipeline restarts
→ 2+ hours GPU time LOST
→ Zero recovery mechanism
```

**After (Solution):**
```
Stage 1 → Checkpoint 1 ✓
Stage 2 → Checkpoint 2 ✓
Stage 3 (CRASH) ❌
→ Resume from Checkpoint 2
→ Stage 3 re-executes (with backoff)
→ Continue to Stages 4-5 ✓
→ 2h GPU time SAVED
```

---

## 12. Blocks (for Gap 2 & 3)

- **Gap 2 (GPU Worker):** Needs checkpoint resume (Gap 1) to survive long-running jobs
- **Gap 3 (LLM-Router):** Needs stable job execution (Gap 1) for cost tracking

---

## 13. Architecture Visualization

```
┌─────────────────────────────────────┐
│ Client: POST /api/videos/submit     │
│ {brief: "..."}                      │
└──────────────┬──────────────────────┘
               ↓
        ┌──────────────┐
        │ Redis Queue  │
        │ autoflow-    │
        │ jobs         │
        └──────────────┘
               ↓
    ┌──────────────────────┐
    │ RQ Worker Process    │
    │ (1+ instances)       │
    │                      │
    │ for job in queue:    │
    │  Stage1.execute()    │
    │  .checkpoint()       │
    │  Stage2.execute()    │
    │  .checkpoint()       │
    │  ...Stage5           │
    └──────────────────────┘
         ↙             ↘
    ┌───────────┐   ┌──────────────┐
    │PostgreSQL │   │Supabase      │
    │Checkpoints│   │Storage       │
    │Errors     │   │Artifacts     │
    │Metrics    │   │(with TTL)    │
    └───────────┘   └──────────────┘
```

---

## 14. Testing Scenarios

| Scenario | Test | Expected |
|----------|------|----------|
| Normal execution | Stage 1→5 sequentially | 5 checkpoints saved |
| Worker crash mid-stage | Kill worker at stage 3 | Resume from stage 2, re-execute 3 |
| Transient error (timeout) | Mock timeout in stage 2 | Retry 60s, up to 3x |
| Recoverable error (GPU unavail) | Mock GPU offline | Retry 300s, up to 2x |
| Fatal error (OOM) | Mock MemoryError | Escalate to dashboard, no retry |
| 10 parallel workflows | Enqueue 10 jobs | All complete without overflow |

---

## 15. Production Checklist (Quick)

- [ ] Migrations run successfully
- [ ] All 5 job classes implemented
- [ ] RQ worker starts without errors
- [ ] API endpoints respond (submit + status)
- [ ] Unit tests: 100% pass
- [ ] Integration tests: full pipeline works
- [ ] Load test: 10+ parallel jobs
- [ ] Systemd service configured
- [ ] Monitoring alerts configured
- [ ] Backup verified

---

**Ready to implement? Start with Phase 1 (DB setup), then Phase 2 (job classes), then Phase 3-6 (worker/test/deploy).**

**Questions? See BULLMQ-ARCHITECTURE.md for full details.**
