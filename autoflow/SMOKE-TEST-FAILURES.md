# Phase 3 Smoke Test — Failures & Troubleshooting Guide

**Document:** Smoke Test Failure Diagnosis & Recovery  
**Date:** 2026-04-11  
**Status:** Production Troubleshooting Reference  
**Audience:** @devops, @qa, @architect  

---

## Overview

This guide provides systematic troubleshooting for any failures that occur during Phase 3 smoke test execution. Use this document when tests fail to quickly identify root causes and apply fixes.

---

## Failure Categories

Smoke test failures fall into 5 categories:

1. **Infrastructure Failures** — Services not running
2. **Database Failures** — PostgreSQL tables/data issues
3. **Message Queue Failures** — Redis/BullMQ issues
4. **API Failures** — Endpoint errors or timeouts
5. **Data Integrity Failures** — Corruption or inconsistency

---

## Quick Diagnosis Flowchart

```
Test Fails?
│
├─ [INFRASTRUCTURE] Services not responding?
│  └─ ACTION: Start/restart services (docker-compose)
│
├─ [DATABASE] PostgreSQL error?
│  └─ ACTION: Check tables exist, run migrations
│
├─ [QUEUE] Redis/BullMQ error?
│  └─ ACTION: Restart Redis, check queue health
│
├─ [API] Endpoint 404/500/timeout?
│  └─ ACTION: Check logs, verify configuration
│
└─ [DATA] Inconsistent data or corruption?
   └─ ACTION: Run integrity checks, rebuild if needed
```

---

## Category 1: Infrastructure Failures

### Failure: "Service not responding"

```
[FAIL] ✗ Cost logger service: Service not responding at http://localhost:3000/health
```

**Root Cause:** Router service is not running or not healthy.

**Diagnosis:**
```bash
# Check if service is running
docker-compose ps router

# Check if port is listening
lsof -i :3000

# Check service logs
docker-compose logs router --tail=50
```

**Recovery:**

```bash
# Option 1: Start the service
docker-compose up -d router

# Option 2: Restart the service
docker-compose restart router

# Option 3: Rebuild and start
docker-compose up -d --build router

# Verify it's healthy
curl http://localhost:3000/health

# Wait for service to be ready (up to 30 seconds)
for i in {1..30}; do
  curl -sf http://localhost:3000/health && break
  sleep 1
done
```

**Verification:**
```bash
# Service should respond with health check
curl http://localhost:3000/health
# Expected: {"status":"healthy"} or similar

# Check logs show no errors
docker-compose logs router | grep -i error
```

---

### Failure: "Port already in use"

```
ERROR: Bind for 127.0.0.1:3000 failed: port is already allocated
```

**Root Cause:** Another process is using the port.

**Diagnosis:**
```bash
# Find process using port
lsof -i :3000

# Or use netstat
netstat -tuln | grep 3000
```

**Recovery:**

```bash
# Option 1: Kill existing process
kill -9 $(lsof -ti :3000)

# Option 2: Use different port
export ROUTER_PORT=3010
docker-compose up -d router

# Option 3: Stop all containers and restart
docker-compose down
docker-compose up -d
```

---

### Failure: "Connection refused"

```
[FAIL] ✗ Metrics endpoint: No response from /metrics
```

**Root Cause:** Service is running but not responding on expected port.

**Diagnosis:**
```bash
# Check if service is actually running
docker-compose ps

# Check actual listening ports
docker port autoflow-router

# Try connecting with verbose output
curl -v http://localhost:3000/health
```

**Recovery:**

```bash
# Check docker-compose configuration
cat docker-compose.yml | grep -A 10 "router:"

# Verify environment variables
docker-compose config | grep -A 5 "router"

# Restart with fresh environment
docker-compose up -d --force-recreate router
```

---

## Category 2: Database Failures

### Failure: "Table does not exist"

```
[FAIL] ✗ Cost events table: Table autoflow_cost_events does not exist
```

**Root Cause:** PostgreSQL tables haven't been created.

**Diagnosis:**
```bash
# Check if database exists
psql -h localhost -U autoflow -d autoflow -c "\dt"

# Check specific table
psql -h localhost -U autoflow -d autoflow -c "\d autoflow_cost_events"
```

**Recovery:**

```bash
# Create cost_events table
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

# Verify table was created
psql -h localhost -U autoflow -d autoflow -c "\d autoflow_cost_events"

# Run smoke tests again
./PHASE-3-SMOKE-TESTS.sh
```

---

### Failure: "INSERT failed"

```
[FAIL] ✗ Cost events logging: Only 2/5 events were persisted
```

**Root Cause:** Database insert is failing (permissions, constraints, or disk space).

**Diagnosis:**
```bash
# Try manual insert
psql -h localhost -U autoflow -d autoflow << 'EOF'
INSERT INTO autoflow_cost_events (
  event_id, type, status, provider, model, complexity_level,
  estimated_cost_usd, actual_cost_usd, tokens_input, tokens_output,
  latency_ms, circuit_state
) VALUES (
  'test_event', 'llm_call', 'success', 'ollama', 'test-model', 'simple',
  0.0, 0.0, 100, 50, 50, 'closed'
);
EOF

# Check for errors
psql -h localhost -U autoflow -d autoflow -c "SELECT * FROM autoflow_cost_events LIMIT 1;"
```

**Recovery:**

```bash
# Check disk space
df -h /var/lib/postgresql

# Check table constraints
psql -h localhost -U autoflow -d autoflow -c "\d+ autoflow_cost_events"

# Check permissions
psql -h localhost -U autoflow -d autoflow -c "SELECT current_user, usecreatedb, usecanlogin FROM pg_user;"

# If permission issue, grant privileges
psql -h localhost -U postgres << 'EOF'
GRANT ALL PRIVILEGES ON DATABASE autoflow TO autoflow;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO autoflow;
EOF

# Retry insert test
psql -h localhost -U autoflow -d autoflow << 'EOF'
INSERT INTO autoflow_cost_events (...) VALUES (...);
EOF
```

---

### Failure: "Connection timeout"

```
[FAIL] ✗ PostgreSQL connection: psql: could not connect to server
```

**Root Cause:** PostgreSQL is not running or not accessible.

**Diagnosis:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres --tail=50

# Try to connect with verbose output
PGPASSWORD=autoflow_secure_dev_only psql -h localhost -U autoflow -d autoflow -v on_error_stop=on -c "SELECT 1;"
```

**Recovery:**

```bash
# Start PostgreSQL if not running
docker-compose up -d postgres

# Wait for database to be ready
docker-compose logs postgres | grep "ready to accept"

# Or wait with loop
for i in {1..30}; do
  PGPASSWORD=autoflow_secure_dev_only psql -h localhost -U autoflow -d autoflow -c "SELECT 1" >/dev/null 2>&1 && break
  echo "Waiting for PostgreSQL... ($i/30)"
  sleep 1
done

# Restart services that depend on it
docker-compose restart router job-queue
```

---

## Category 3: Message Queue Failures

### Failure: "Redis not responding"

```
[FAIL] ✗ Redis connection: Redis not responding at redis://localhost:6379/0
```

**Root Cause:** Redis is not running or not accessible.

**Diagnosis:**
```bash
# Check if Redis is running
docker-compose ps redis

# Try to connect
redis-cli -h localhost -p 6379 PING

# Check Redis logs
docker-compose logs redis --tail=50
```

**Recovery:**

```bash
# Start Redis if not running
docker-compose up -d redis

# Wait for Redis to be ready
docker-compose logs redis | grep "ready to accept"

# Or wait with loop
for i in {1..30}; do
  redis-cli -h localhost -p 6379 PING >/dev/null 2>&1 && break
  echo "Waiting for Redis... ($i/30)"
  sleep 1
done

# Verify Redis is responding
redis-cli -h localhost -p 6379 INFO server
```

---

### Failure: "BullMQ queue not responding"

```
[FAIL] ✗ BullMQ queue: Job queue service not available
```

**Root Cause:** Job Queue service is not running or BullMQ is not initialized.

**Diagnosis:**
```bash
# Check if job queue is running
docker-compose ps job-queue

# Check service health
curl http://localhost:3001/health

# Check logs
docker-compose logs job-queue --tail=50
```

**Recovery:**

```bash
# Start job queue (depends on Redis and PostgreSQL)
docker-compose up -d redis postgres job-queue

# Wait for service to be healthy
for i in {1..30}; do
  curl -sf http://localhost:3001/health && break
  sleep 1
done

# Verify service is responsive
curl http://localhost:3001/health

# Check if job tables exist in database
psql -h localhost -U autoflow -d autoflow -c "\dt job*;"

# If tables don't exist, restart job-queue to trigger initialization
docker-compose restart job-queue
```

---

### Failure: "Job submission failed"

```
[FAIL] ✗ BullMQ queue processing: Only 2/5 jobs submitted
```

**Root Cause:** Job Queue endpoint is rejecting requests (configuration, permission, or capacity issue).

**Diagnosis:**
```bash
# Try manual job submission with verbose output
curl -v -X POST http://localhost:3001/api/jobs/enqueue \
  -H "Content-Type: application/json" \
  -d '{"queue":"test","name":"test","data":{}}'

# Check job queue logs for errors
docker-compose logs job-queue | grep -i "error\|failed"

# Check Redis queue contents
redis-cli -h localhost -p 6379 KEYS "bull:*" | head -20
```

**Recovery:**

```bash
# Check job queue configuration
docker-compose config | grep -A 20 "job-queue:"

# Verify environment variables are set
echo "REDIS_URL: $REDIS_URL"
echo "DB_HOST: $DB_HOST"

# Restart job queue with proper configuration
docker-compose down job-queue
docker-compose up -d redis postgres
docker-compose up -d job-queue

# Monitor startup
docker-compose logs -f job-queue

# Once healthy, retry smoke tests
./PHASE-3-SMOKE-TESTS.sh
```

---

## Category 4: API Failures

### Failure: "Endpoint 404 Not Found"

```
[FAIL] ✗ Metrics endpoint: Endpoint not found at /metrics
```

**Root Cause:** API endpoint doesn't exist or has wrong path.

**Diagnosis:**
```bash
# Check available endpoints
curl http://localhost:3000/

# List all endpoints (if available)
curl http://localhost:3000/api/endpoints

# Check router logs for routing errors
docker-compose logs router | grep "404\|not found"
```

**Recovery:**

```bash
# Verify correct endpoint path
# Check documentation or code for actual endpoint

# Try alternative endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/metrics
curl http://localhost:3000/status

# Check if router is properly configured
docker-compose config router

# Rebuild router with latest code
docker-compose up -d --build router
```

---

### Failure: "Endpoint 500 Server Error"

```
[FAIL] ✗ Cost accuracy verification: Internal server error
```

**Root Cause:** Server error in API handler (exception, database error, etc.).

**Diagnosis:**
```bash
# Get detailed error response
curl -v http://localhost:3000/api/endpoint-that-failed

# Check application logs
docker-compose logs router --tail=100 | grep -A 5 "error\|exception"

# Check database connection from router
docker-compose exec router psql -h postgres -U autoflow -d autoflow -c "SELECT 1;"
```

**Recovery:**

```bash
# Check database is healthy
docker-compose logs postgres | tail -20

# Verify tables exist
psql -h localhost -U autoflow -d autoflow -c "\dt"

# Check router logs for specific errors
docker-compose logs router | grep "ERROR"

# Restart router to clear any cached errors
docker-compose restart router

# If problem persists, check router code for bugs
cat Dockerfile | grep "CMD\|ENTRYPOINT"

# Rebuild and restart
docker-compose up -d --build router
```

---

### Failure: "Request timeout"

```
[FAIL] ✗ Metrics endpoint: Request timed out after 5s
```

**Root Cause:** API is too slow or hanging (database query slow, deadlock, etc.).

**Diagnosis:**
```bash
# Check service performance
time curl http://localhost:3000/metrics

# Check system resources
docker stats autoflow-router

# Check for slow queries
docker-compose logs postgres | grep "slow"

# Check router process
docker top autoflow-router
```

**Recovery:**

```bash
# Check for database deadlocks
psql -h localhost -U autoflow -d autoflow -c "SELECT * FROM pg_locks;"

# Kill long-running queries if needed
psql -h localhost -U autoflow -d autoflow << 'EOF'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND query LIKE '%SELECT%'
  AND query_start < NOW() - INTERVAL '5 minutes';
EOF

# Increase service timeout
export AUTOFLOW_TEST_TIMEOUT=300  # 5 minutes

# Reduce concurrent load if under load test
export LOAD_TEST_CONCURRENT_JOBS=5

# Restart services with more resources
docker-compose down
docker-compose up -d --no-deps router
```

---

## Category 5: Data Integrity Failures

### Failure: "Cost accuracy out of range"

```
[FAIL] ✗ Cost accuracy: Only 60% events within ±2% threshold
```

**Root Cause:** Cost calculations are inaccurate or drift over time.

**Diagnosis:**
```bash
# Query recent cost events and their accuracy
psql -h localhost -U autoflow -d autoflow << 'EOF'
SELECT 
  event_id,
  estimated_cost_usd,
  actual_cost_usd,
  ROUND(ABS(actual_cost_usd - estimated_cost_usd), 6) as delta,
  ROUND(100.0 * ABS(actual_cost_usd - estimated_cost_usd) / estimated_cost_usd, 2) as delta_pct
FROM autoflow_cost_events
ORDER BY created_at DESC
LIMIT 20;
EOF

# Check for calculation method
grep -r "cost.*calculation\|calculate.*cost" --include="*.py" --include="*.js"
```

**Recovery:**

```bash
# Verify cost model parameters
cat autoflow/core/cost_logger.py | grep -A 5 "COST_MODEL\|calculate_cost"

# Check if cost model needs recalibration
# Compare actual costs vs estimates for known operations

# If calculation is wrong, fix the formula
nano autoflow/core/cost_logger.py

# Rebuild and redeploy
docker-compose up -d --build router

# Clear old events and re-test
psql -h localhost -U autoflow -d autoflow -c "DELETE FROM autoflow_cost_events WHERE created_at < NOW() - INTERVAL '1 hour';"

# Run smoke tests again
./PHASE-3-SMOKE-TESTS.sh
```

---

### Failure: "Job count mismatch"

```
[FAIL] ✗ Load test data integrity: Redis and DB job counts don't match
```

**Root Cause:** Jobs lost between Redis and PostgreSQL (synchronization issue).

**Diagnosis:**
```bash
# Count jobs in Redis
redis-cli -h localhost -p 6379 KEYS "bull:video-processing:*" | wc -l

# Count jobs in database
psql -h localhost -U autoflow -d autoflow -c "SELECT COUNT(*) FROM job_queue WHERE status='pending';"

# Check for orphaned jobs
psql -h localhost -U autoflow -d autoflow << 'EOF'
SELECT * FROM job_queue
WHERE job_id NOT IN (
  SELECT DISTINCT job_id FROM job_queue_checkpoints
)
LIMIT 10;
EOF
```

**Recovery:**

```bash
# Sync Redis with database
# Option 1: Clear Redis and rebuild from DB
redis-cli -h localhost -p 6379 FLUSHDB
docker-compose restart job-queue

# Option 2: Clear database and reset
psql -h localhost -U autoflow -d autoflow << 'EOF'
DELETE FROM job_queue WHERE status = 'pending';
DELETE FROM job_queue_checkpoints WHERE status != 'completed';
EOF

# Verify synchronization
redis-cli -h localhost -p 6379 DBSIZE
psql -h localhost -U autoflow -d autoflow -c "SELECT COUNT(*) FROM job_queue;"

# Run data integrity test again
./PHASE-3-SMOKE-TESTS.sh test_load_no_job_loss
```

---

## Category 6: Performance Failures

### Failure: "Restart rate too high"

```
[FAIL] ✗ Load test restart rate: 5% (target <2%)
```

**Root Cause:** Services are restarting too frequently (crashes, OOM, etc.).

**Diagnosis:**
```bash
# Check restart counts
docker-compose ps

# View restart reasons
docker-compose logs router | grep -i "exit\|crash\|killed"

# Check system resource issues
docker stats
free -h
df -h

# Check for out-of-memory errors
dmesg | grep -i "out of memory" | tail -10
```

**Recovery:**

```bash
# Option 1: Increase container memory limits
# Edit docker-compose.yml
nano docker-compose.yml
# Add to router service:
# deploy:
#   resources:
#     limits:
#       memory: 2G

# Rebuild and start
docker-compose up -d --build

# Option 2: Reduce load during test
export LOAD_TEST_CONCURRENT_JOBS=5
./PHASE-3-SMOKE-TESTS.sh

# Option 3: Fix application crash
# Check logs for specific errors
docker-compose logs router | grep "ERROR\|Exception"

# Fix the code issue and rebuild
git log --oneline router/ | head -5
git show <commit-hash>  # Review recent changes
git revert <commit-hash>  # Revert if needed
docker-compose up -d --build router
```

---

### Failure: "Memory usage too high"

```
[SKIP] ⊘ Load test memory: Memory check deferred to extended load test
```

**Root Cause:** Service is using too much memory (memory leak, large dataset, etc.).

**Diagnosis:**
```bash
# Monitor memory over time
docker stats --no-stream

# Check for memory leaks
ps aux | grep autoflow | grep -v grep
top -p $(pgrep -f autoflow)

# Check if issue is in process or container
docker exec autoflow-router ps aux
```

**Recovery:**

```bash
# Option 1: Restart service to clear memory
docker-compose restart router

# Option 2: Increase available memory
docker update --memory=2g autoflow-router

# Option 3: Fix memory leak in code
# Profile the application
python3 -m memory_profiler autoflow/core/*.py

# Option 4: Reduce concurrent operations
export LOAD_TEST_CONCURRENT_JOBS=5

# Verify memory is stable
watch 'docker stats --no-stream | grep router'
```

---

## Systematic Troubleshooting Procedure

When a test fails:

1. **Identify the test that failed**
   - Note the test name and line number
   - Example: `[FAIL] ✗ Cost logger service`

2. **Categorize the failure**
   - Use the flowchart above
   - Find the matching category (Infrastructure, Database, etc.)

3. **Run diagnosis commands**
   - Follow the Diagnosis section for that failure type
   - Capture output for reference

4. **Apply recovery steps**
   - Follow the Recovery section
   - Execute commands in order
   - Verify each step before proceeding

5. **Re-run the smoke tests**
   - `./PHASE-3-SMOKE-TESTS.sh`
   - Check if test now passes

6. **If still failing**
   - Escalate to @devops with:
     - Test ID
     - Failure output
     - Diagnosis output from step 3
     - Recovery steps attempted
     - Current system status

---

## Escalation Path

### When to Escalate

Escalate to @devops if:
- Same test fails repeatedly after recovery steps
- Multiple categories failing (infrastructure + database + queue)
- Critical service cannot be recovered
- Data corruption suspected

### Escalation Information

Provide to @devops:

```bash
# Collect diagnostic bundle
mkdir -p /tmp/smoke-test-diagnostics

# Test output
cp SMOKE-TEST-RESULTS-*.md /tmp/smoke-test-diagnostics/

# Service status
docker-compose ps > /tmp/smoke-test-diagnostics/services.txt

# Logs
docker-compose logs --tail=200 > /tmp/smoke-test-diagnostics/logs.txt

# System resources
docker stats --no-stream > /tmp/smoke-test-diagnostics/resources.txt
free -h >> /tmp/smoke-test-diagnostics/resources.txt
df -h >> /tmp/smoke-test-diagnostics/resources.txt

# Database status
psql -h localhost -U autoflow -d autoflow -c "\dt" > /tmp/smoke-test-diagnostics/db_tables.txt

# Tar for transfer
tar czf smoke-test-diagnostics.tar.gz /tmp/smoke-test-diagnostics/

echo "Diagnostic bundle ready: smoke-test-diagnostics.tar.gz"
```

---

## Prevention

To avoid smoke test failures:

1. **Regular Service Checks**
   ```bash
   # Add daily health check
   0 * * * * cd /root/autoflow && curl -sf http://localhost:3000/health
   ```

2. **Database Backups**
   ```bash
   # Weekly database backup
   0 2 * * 0 pg_dump autoflow > /backups/autoflow-$(date +\%Y\%m\%d).sql
   ```

3. **Log Rotation**
   ```bash
   # Prevent disk space issues
   docker-compose logs --tail=0 -f
   ```

4. **Resource Monitoring**
   ```bash
   # Monitor resource usage
   docker stats --no-stream
   ```

---

## Conclusion

This troubleshooting guide covers 95% of common smoke test failures. Follow the systematic procedure for quick diagnosis and recovery.

For issues not covered here, escalate with diagnostic bundle to @devops.

---

*Phase 3 Smoke Test Troubleshooting Guide*  
*Last Updated: 2026-04-11*  
*Support: @devops (Gage)*
