# Phase 3 Deployment Command Reference

**Document:** Single-Command Deployment Guide  
**Date:** 2026-04-11  
**Status:** Ready for Production  
**Owner:** @devops (Gage)  

---

## Quick Deploy Summary

```bash
# One-command deployment for entire Phase 3
./scripts/deploy-phase3.sh --environment=production --backup=true

# Expected duration: 15-20 minutes
# Verification: Automated post-deploy checks included
```

---

## Epic 3.1: LLM-Router Alignment Deployment

### Pre-Deployment

```bash
# 1. Backup current database
pg_dump autoflow > /backups/autoflow-$(date +%Y%m%d-%H%M%S).sql

# 2. Verify PostgreSQL connection
psql -h localhost -U autoflow -d autoflow -c "SELECT version();"

# 3. Set environment variables
export AUTOFLOW_DB_URL=postgresql://autoflow:password@localhost:5432/autoflow
export AUTOFLOW_COST_LOG=/var/log/autoflow-cost.jsonl
export AUTOFLOW_ROUTER_CB_THRESHOLD=3
export AUTOFLOW_ROUTER_CB_RESET=60
```

### Database Migrations

```bash
# 1. Create cost events table
psql -h localhost -U autoflow -d autoflow << 'EOF'
CREATE TABLE IF NOT EXISTS autoflow_cost_events (
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  event_id VARCHAR(16) PRIMARY KEY,
  type VARCHAR(50),
  status VARCHAR(20),
  provider VARCHAR(20),
  model VARCHAR(50),
  complexity_level VARCHAR(20),
  estimated_cost_usd NUMERIC(10,6),
  actual_cost_usd NUMERIC(10,6),
  tokens_input INT,
  tokens_output INT,
  latency_ms INT,
  circuit_state VARCHAR(20),
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON autoflow_cost_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_cost_provider ON autoflow_cost_events(provider);
CREATE INDEX IF NOT EXISTS idx_cost_complexity ON autoflow_cost_events(complexity_level);
EOF

# 2. Verify table created
psql -h localhost -U autoflow -d autoflow -c "\d autoflow_cost_events"
```

### Deploy Code

```bash
# 1. Deploy cost logger module
cp -r ./autoflow/core/cost_logger.py /opt/autoflow/autoflow/core/
cp -r ./autoflow/core/metrics.py /opt/autoflow/autoflow/core/

# 2. Deploy CLI module
cp ./autoflow/cli.py /opt/autoflow/autoflow/

# 3. Restart router service
systemctl restart autoflow-router

# 4. Verify service started
sleep 5
curl http://localhost:3000/health
```

### Post-Deployment Validation

```bash
# 1. Test cost logger
python3 -c "
from autoflow.core import cost_logger
event = cost_logger.log_event(cost_logger.CostEvent(
    provider='ollama',
    model='qwen2.5:7b',
    complexity_level='simple',
    estimated_cost_usd=0.0,
    actual_cost_usd=0.0,
    latency_ms=500
))
print(f'Cost event logged: {event.event_id}')
"

# 2. Test metrics collection
python3 -c "
from autoflow.core import metrics
metrics.record_llm_call(
    provider='ollama',
    latency_ms=500,
    cost_usd=0.0,
    complexity_level='simple',
    status='success'
)
summary = metrics.get_summary()
print(f'Metrics collected: {summary}')
"

# 3. Test CLI commands
python3 -m autoflow.cli cost-summary --days=1
python3 -m autoflow.cli router-health
python3 -m autoflow.cli circuit-status

# 4. Verify PostgreSQL persistence
psql -h localhost -U autoflow -d autoflow -c "SELECT COUNT(*) FROM autoflow_cost_events;"
```

### Rollback Epic 3.1

```bash
# 1. Disable cost logging
export AUTOFLOW_COST_LOGGING=false

# 2. Restart router
systemctl restart autoflow-router

# 3. Verify router still working
curl http://localhost:3000/health

# 4. Revert code changes
git revert --no-edit <commit-hash>

# 5. Redeploy previous version
./scripts/deploy-epic3-1.sh --revert

# 6. Restore database if needed
psql -h localhost -U autoflow -d autoflow < /backups/autoflow-*.sql
```

---

## Epic 3.2: GPU Worker Bridge Deployment

### Pre-Deployment

```bash
# 1. Verify GPU worker API accessible
curl -X GET http://localhost:5000/health

# 2. Create GPU worker database tables
psql -h localhost -U autoflow -d autoflow << 'EOF'
CREATE TABLE IF NOT EXISTS gpu_workers (
  worker_id VARCHAR(50) PRIMARY KEY,
  status VARCHAR(20),
  health_state VARCHAR(20),
  circuit_breaker_state VARCHAR(20),
  last_health_check TIMESTAMP,
  uptime_seconds INT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gpu_status ON gpu_workers(status);
CREATE INDEX IF NOT EXISTS idx_gpu_health ON gpu_workers(health_state);
EOF

# 3. Set environment variables
export AUTOFLOW_GPU_WORKER_URL=http://localhost:5000
export AUTOFLOW_GPU_WORKER_TIMEOUT=30
export AUTOFLOW_GPU_WORKERS_COUNT=4
```

### Deploy Code

```bash
# 1. Deploy GPU worker modules
mkdir -p /opt/autoflow/gpu
cp -r ./gpu/gpu_worker_client.py /opt/autoflow/gpu/
cp -r ./gpu/health_monitor.py /opt/autoflow/gpu/
cp -r ./gpu/task_manager.py /opt/autoflow/gpu/
cp -r ./gpu/models.py /opt/autoflow/gpu/

# 2. Install/update dependencies
pip install httpx pydantic asyncio tenacity

# 3. Start GPU worker monitoring
systemctl restart autoflow-gpu-monitor

# 4. Verify services started
sleep 10
curl http://localhost:5000/health
```

### Post-Deployment Validation

```bash
# 1. Test GPU worker client
python3 << 'EOF'
import asyncio
from gpu.gpu_worker_client import GpuWorkerClient
from gpu.models import AvatarGenerateRequest

async def test():
    client = GpuWorkerClient("http://localhost:5000")
    request = AvatarGenerateRequest(
        text_prompt="Professional avatar",
        style="realistic"
    )
    response = await client.generate_avatar(request)
    print(f"GPU Job Response: {response.job_id}")

asyncio.run(test())
EOF

# 2. Test health monitoring
python3 -c "
from gpu.health_monitor import HealthMonitor
monitor = HealthMonitor('gpu-1')
print(f'Worker health: {monitor.state}')
"

# 3. Test task manager
python3 -c "
from gpu.task_manager import GpuTaskManager
manager = GpuTaskManager(num_workers=4)
print(f'Task manager ready with {manager.num_workers} workers')
"

# 4. Check GPU metrics dashboard
curl http://localhost:5000/metrics | grep -i gpu

# 5. Verify database tables
psql -h localhost -U autoflow -d autoflow -c "SELECT * FROM gpu_workers;"
```

### Rollback Epic 3.2

```bash
# 1. Stop GPU monitoring
systemctl stop autoflow-gpu-monitor

# 2. Drain GPU job queue (stop accepting new jobs)
python3 -c "
from gpu.task_manager import GpuTaskManager
manager = GpuTaskManager()
manager.pause_job_submission()
"

# 3. Wait for in-flight jobs to complete (max 30s timeout)
sleep 30

# 4. Switch router to Ollama-only fallback
export AUTOFLOW_GPU_WORKER_DISABLED=true

# 5. Restart router
systemctl restart autoflow-router

# 6. Revert code changes
git revert --no-edit <commit-hash>

# 7. Redeploy previous version
./scripts/deploy-epic3-2.sh --revert

# 8. Verify Ollama fallback working
curl http://localhost:3000/health
```

---

## Epic 3.3: BullMQ Checkpointing Deployment

### Pre-Deployment

```bash
# 1. Verify Redis accessible
redis-cli ping

# 2. Check Redis configuration
redis-cli CONFIG GET maxmemory
redis-cli CONFIG GET maxmemory-policy

# 3. Create job checkpoint tables
psql -h localhost -U autoflow -d autoflow << 'EOF'
CREATE TABLE IF NOT EXISTS job_checkpoints (
  checkpoint_id VARCHAR(50) PRIMARY KEY,
  job_id VARCHAR(50) NOT NULL,
  attempt_number INT,
  progress_percent INT,
  checkpoint_data JSONB,
  cost_so_far NUMERIC(10,6),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkpoint_job ON job_checkpoints(job_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_created ON job_checkpoints(created_at);

CREATE TABLE IF NOT EXISTS job_queue (
  job_id VARCHAR(50) PRIMARY KEY,
  job_type VARCHAR(50),
  status VARCHAR(20),
  priority VARCHAR(20),
  data JSONB,
  attempt_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_priority ON job_queue(priority);
EOF

# 4. Set environment variables
export AUTOFLOW_REDIS_URL=redis://localhost:6379/0
export AUTOFLOW_BULLMQ_WORKERS=4
export AUTOFLOW_JOB_CHECKPOINT_INTERVAL=60
export AUTOFLOW_JOB_MAX_RETRIES=3
```

### Deploy Code & Services

```bash
# 1. Deploy BullMQ job queue module
mkdir -p /opt/autoflow/queue
cp -r ./autoflow/queue/bullmq_driver.py /opt/autoflow/queue/
cp -r ./autoflow/queue/checkpoint_manager.py /opt/autoflow/queue/

# 2. Install BullMQ dependencies
pip install bullmq redis aioredis

# 3. Start BullMQ UI (for monitoring)
cd /opt/autoflow && npm install @bull-board/express
systemctl restart autoflow-bullmq-ui

# 4. Start BullMQ workers (4 workers)
for i in {1..4}; do
  systemctl restart autoflow-bullmq-worker-$i
done

# 5. Verify services started
sleep 10
curl http://localhost:3001/admin/queues  # BullMQ UI
redis-cli KEYS "*"                        # Redis queue keys
```

### Post-Deployment Validation

```bash
# 1. Test job queue
python3 << 'EOF'
import asyncio
from autoflow.queue.bullmq_driver import BullMQJobQueue

async def test():
    queue = BullMQJobQueue("redis://localhost:6379/0")
    
    job = await queue.enqueue(
        job_type="test_job",
        data={"input": "test"}
    )
    print(f"Job created: {job.id}")
    print(f"Job status: {job.status}")
    
    # Check job in queue
    next_job = await queue.get_next()
    print(f"Next job: {next_job.id}")

asyncio.run(test())
EOF

# 2. Test checkpointing
python3 << 'EOF'
import asyncio
from autoflow.queue.checkpoint_manager import CheckpointManager

async def test():
    mgr = CheckpointManager()
    
    # Create checkpoint
    cp = await mgr.create_checkpoint(
        job_id="test-1",
        progress_percent=50,
        checkpoint_data={"phase": 2, "subtask": 3}
    )
    print(f"Checkpoint created: {cp.checkpoint_id}")
    
    # Retrieve checkpoint
    latest = await mgr.get_latest_checkpoint("test-1")
    print(f"Latest checkpoint progress: {latest.progress_percent}%")

asyncio.run(test())
EOF

# 3. Test job lifecycle
python3 << 'EOF'
import asyncio
from autoflow.queue.bullmq_driver import BullMQJobQueue

async def test():
    queue = BullMQJobQueue("redis://localhost:6379/0")
    
    # Create job
    job = await queue.enqueue(job_type="test", data={})
    print(f"1. Job created: {job.status}")
    
    # Get and process
    job = await queue.get_next()
    print(f"2. Job processing: {job.status}")
    
    # Complete
    await queue.mark_complete(job.id)
    print(f"3. Job completed")

asyncio.run(test())
EOF

# 4. Check BullMQ UI
curl http://localhost:3001/admin/queues

# 5. Verify Redis queue depth
redis-cli LLEN "bull:job:queue"

# 6. Verify database tables
psql -h localhost -U autoflow -d autoflow -c "SELECT COUNT(*) FROM job_queue; SELECT COUNT(*) FROM job_checkpoints;"
```

### Rollback Epic 3.3

```bash
# 1. Switch to synchronous processing (disable queue)
export AUTOFLOW_BULLMQ_ENABLED=false
export AUTOFLOW_JOB_MODE=synchronous

# 2. Restart all services
for i in {1..4}; do
  systemctl restart autoflow-bullmq-worker-$i
done
systemctl restart autoflow-router

# 3. Dump Redis queue to backup
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb /backups/redis-$(date +%Y%m%d-%H%M%S).rdb

# 4. Revert code changes
git revert --no-edit <commit-hash>

# 5. Redeploy previous version
./scripts/deploy-epic3-3.sh --revert

# 6. Restore Redis if needed
systemctl stop redis
cp /backups/redis-*.rdb /var/lib/redis/dump.rdb
systemctl start redis

# 7. Verify queue restored
redis-cli LLEN "bull:job:queue"
```

---

## Full Phase 3 Deployment (All Epics)

### One-Command Deploy

```bash
#!/bin/bash
# File: scripts/deploy-phase3.sh

set -e

ENVIRONMENT=${1:-production}
BACKUP=${2:-true}

echo "=== Phase 3 Deployment ==="
echo "Environment: $ENVIRONMENT"
echo "Backup: $BACKUP"

# 1. Backup database
if [ "$BACKUP" = "true" ]; then
  echo "Creating database backup..."
  pg_dump autoflow > /backups/autoflow-$(date +%Y%m%d-%H%M%S).sql
  echo "✓ Database backed up"
fi

# 2. Deploy Epic 3.1 (LLM-Router)
echo "Deploying Epic 3.1 (LLM-Router Alignment)..."
bash ./scripts/deploy-epic3-1.sh
echo "✓ Epic 3.1 deployed"

# 3. Deploy Epic 3.2 (GPU Worker)
echo "Deploying Epic 3.2 (GPU Worker Bridge)..."
bash ./scripts/deploy-epic3-2.sh
echo "✓ Epic 3.2 deployed"

# 4. Deploy Epic 3.3 (BullMQ)
echo "Deploying Epic 3.3 (BullMQ Checkpointing)..."
bash ./scripts/deploy-epic3-3.sh
echo "✓ Epic 3.3 deployed"

# 5. Run post-deploy validation
echo "Running post-deployment validation..."
bash ./scripts/validate-phase3.sh
echo "✓ All validations passed"

echo ""
echo "=== Phase 3 Deployment Complete ==="
echo "Duration: ~15-20 minutes"
echo "Next steps: Monitor metrics dashboard"
echo "Rollback: bash ./scripts/rollback-phase3.sh"
```

### Deployment Checklist

```bash
# Pre-Deployment
[ ] Database backups created
[ ] All services healthy (router, gpu-worker, redis)
[ ] Environment variables set correctly
[ ] Team notified of deployment window
[ ] On-call engineer assigned

# During Deployment
[ ] Run deploy-phase3.sh --environment=production
[ ] Monitor deployment progress
[ ] Watch error logs for issues
[ ] Team standing by for rollback

# Post-Deployment
[ ] All post-deploy validation passes
[ ] Metrics dashboard shows healthy state
[ ] Cost events being logged to PostgreSQL
[ ] GPU worker jobs processing correctly
[ ] Job queue and checkpoints working
[ ] Monitor for 24 hours
[ ] Customer communication: Deployment successful

# Rollback (if needed)
[ ] Execute rollback command
[ ] Verify all services operational
[ ] Restore from database backup
[ ] Communicate rollback to team
```

---

## Verification Commands

### Verify All Components

```bash
#!/bin/bash
# File: scripts/validate-phase3.sh

echo "=== Phase 3 Validation ==="

# 1. Verify LLM-Router
echo "1. Verifying LLM-Router..."
curl -s http://localhost:3000/health | jq .
assert "Circuit state: CLOSED or HALF_OPEN"

# 2. Verify Cost Logger
echo "2. Verifying Cost Logger..."
psql -h localhost -U autoflow -d autoflow -c "SELECT COUNT(*) FROM autoflow_cost_events;"
assert "Count > 0"

# 3. Verify GPU Worker
echo "3. Verifying GPU Worker..."
curl -s http://localhost:5000/health | jq .
assert "Status: healthy"

# 4. Verify BullMQ Queue
echo "4. Verifying BullMQ Queue..."
redis-cli PING
assert "Response: PONG"

# 5. Verify Checkpoints
echo "5. Verifying Checkpoints..."
psql -h localhost -U autoflow -d autoflow -c "SELECT COUNT(*) FROM job_checkpoints;"

# 6. Verify Metrics
echo "6. Verifying Metrics..."
curl -s http://localhost:9090/api/v1/query?query=up | jq .
assert "All targets up"

echo "=== All Validations Passed ==="
```

### Smoke Test

```bash
#!/bin/bash
# File: scripts/smoke-test-phase3.sh

echo "=== Phase 3 Smoke Test ==="

# 1. Simple job (Ollama)
echo "Testing simple job (Ollama)..."
python3 -c "
from autoflow.core import router
response = router.call_llm_sync('Hello', complexity=2)
print(f'Response: {response}')
"

# 2. Complex job (Claude)
echo "Testing complex job (Claude)..."
python3 -c "
from autoflow.core import router
response = router.call_llm_sync('Explain quantum computing', complexity=8)
print(f'Response: {response}')
"

# 3. Video job (GPU)
echo "Testing video job (GPU)..."
python3 -c "
from gpu.gpu_worker_client import GpuWorkerClient
from gpu.models import AvatarGenerateRequest
import asyncio

async def test():
    client = GpuWorkerClient('http://localhost:5000')
    request = AvatarGenerateRequest(text_prompt='Avatar test', style='realistic')
    response = await client.generate_avatar(request)
    print(f'GPU Job: {response.job_id}')

asyncio.run(test())
"

echo "=== Smoke Test Complete ==="
```

---

## Monitoring & Health Checks

### Daily Checklist (First 7 Days)

```bash
#!/bin/bash
# Run daily for 7 days post-deployment

echo "=== Daily Health Check ==="
date

# 1. Check error rates
echo "Error rates:"
curl -s http://localhost:9090/api/v1/query?query='rate(errors_total[5m])' | jq .

# 2. Check latency
echo "Latency (P99):"
curl -s http://localhost:9090/api/v1/query?query='histogram_quantile(0.99,latency_ms)' | jq .

# 3. Check cost accuracy
echo "Cost events (24h):"
psql -U autoflow -d autoflow -c "SELECT COUNT(*) FROM autoflow_cost_events WHERE created_at > NOW() - INTERVAL '24 hours';"

# 4. Check queue depth
echo "BullMQ queue depth:"
redis-cli LLEN "bull:job:queue"

# 5. Check GPU workers
echo "GPU workers:"
psql -U autoflow -d autoflow -c "SELECT worker_id, status FROM gpu_workers;"

# 6. Check database connections
echo "DB connections:"
psql -U autoflow -d autoflow -c "SELECT count(*) FROM pg_stat_activity;"

echo "=== Health Check Complete ==="
```

---

## Troubleshooting

### Issue: Cost Events Not Appearing

```bash
# 1. Check PostgreSQL connection
psql -h localhost -U autoflow -d autoflow -c "SELECT NOW();"

# 2. Check JSONL fallback
tail -f /var/log/autoflow-cost.jsonl

# 3. Verify cost logger is enabled
export AUTOFLOW_COST_LOGGING=true

# 4. Restart router
systemctl restart autoflow-router

# 5. Verify table exists
psql -U autoflow -d autoflow -c "\d autoflow_cost_events;"
```

### Issue: GPU Worker Not Responding

```bash
# 1. Check GPU worker health
curl http://localhost:5000/health

# 2. Check circuit breaker state
python3 -c "
from gpu.health_monitor import HealthMonitor
monitor = HealthMonitor('gpu-1')
print(f'State: {monitor.state}')
print(f'Circuit: {monitor.circuit_breaker.state}')
"

# 3. Check GPU logs
journalctl -u autoflow-gpu-monitor -f

# 4. Restart GPU worker
systemctl restart autoflow-gpu-monitor

# 5. Verify health restored
curl http://localhost:5000/health
```

### Issue: Redis Memory Full

```bash
# 1. Check memory usage
redis-cli INFO memory

# 2. Check eviction policy
redis-cli CONFIG GET maxmemory-policy

# 3. Clear old keys
redis-cli FLUSHDB  # WARNING: Loses all data!

# 4. Or: Scale Redis
# Increase maxmemory in redis.conf
redis-cli CONFIG SET maxmemory 4gb
redis-cli CONFIG REWRITE
```

---

## Success Criteria

**Deployment is successful if:**

- ✅ All services start without errors
- ✅ Cost events appear in PostgreSQL within 5 seconds
- ✅ GPU worker accepts and processes jobs
- ✅ BullMQ queue depth stays healthy (<1000 jobs)
- ✅ Checkpoints are created every 60 seconds
- ✅ Metrics dashboard shows all green
- ✅ No error spikes in logs
- ✅ P99 latency <30 seconds
- ✅ Success rate >98%

---

## Emergency Contacts

**Deployment Owner:** @devops (Gage)  
**On-Call Engineer:** [TBD]  
**Escalation:** @dev, @qa, @architect  

---

## Document Version

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-11 | Initial deployment guide |

---

*Deployment Guide for Phase 3 (Epic 3.1, 3.2, 3.3)*  
*Ready for Production — 2026-04-13*
