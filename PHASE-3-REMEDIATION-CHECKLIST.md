# Phase 3.1 Remediation Checklist

**Assigned to:** @devops (Gage)  
**Priority:** CRITICAL (Blocking Deployment)  
**Estimated Time:** 4-5 hours  
**Start Date:** April 11, 2026  
**Target Completion:** April 11, 2026 (End of day)

---

## Overview

This checklist executes the critical remediation tasks needed to move infrastructure from **CONDITIONAL GO** to **PRODUCTION GO** for Phase 3 deployment.

**Success Criteria:**
- ✅ All 5 primary tasks complete
- ✅ Validation suite shows 13/18 items passing
- ✅ No new critical security issues found
- ✅ Performance baseline validated
- ✅ @qa sign-off obtained

---

## Task 1: Apply Database Migrations

**Objective:** Create gpu_job_metrics and gpu_job_checkpoints tables  
**Estimated Time:** 30 minutes  
**Blocker:** None  

### Steps

- [ ] Verify AutoFlow database is accessible
  ```bash
  docker exec autoflow-postgres psql -U autoflow -d autoflow -c "SELECT version();"
  ```

- [ ] Apply Migration 002: GPU Job Metrics
  ```bash
  docker exec autoflow-postgres psql -U autoflow -d autoflow < /root/autoflow/migrations/002_create_gpu_metrics.sql
  ```
  Expected: No errors, tables created

- [ ] Apply Migration 003: GPU Job Checkpoints
  ```bash
  docker exec autoflow-postgres psql -U autoflow -d autoflow < /root/autoflow/migrations/003_create_gpu_checkpoints.sql
  ```
  Expected: No errors, tables + triggers created

- [ ] Apply Migration 004: Cost Aggregations
  ```bash
  docker exec autoflow-postgres psql -U autoflow -d autoflow < /root/autoflow/migrations/004_create_cost_aggregations.sql
  ```
  Expected: No errors, tables created

- [ ] Verify all tables created
  ```bash
  docker exec autoflow-postgres psql -U autoflow -d autoflow -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema='public' AND table_name LIKE 'gpu%'
  ORDER BY table_name;"
  ```
  Expected output:
  ```
  gpu_job_checkpoints
  gpu_job_metrics
  gpu_worker_health_events
  ```

- [ ] Verify indexes created
  ```bash
  docker exec autoflow-postgres psql -U autoflow -d autoflow -c "
  SELECT indexname FROM pg_indexes 
  WHERE tablename LIKE 'gpu%'
  ORDER BY indexname;"
  ```
  Expected: 10+ indexes on GPU tables

- [ ] **CHECKPOINT:** Notify on Slack/Chat
  ```
  ✅ Migration applied successfully - gpu_job_metrics, gpu_job_checkpoints, cost_aggregations
  ```

### Rollback (if needed)
```bash
# Drop tables if migration fails
docker exec autoflow-postgres psql -U autoflow -d autoflow -c "
DROP TABLE IF EXISTS gpu_job_metrics CASCADE;
DROP TABLE IF EXISTS gpu_job_checkpoints CASCADE;
DROP TABLE IF EXISTS cost_aggregations CASCADE;"
```

---

## Task 2: Rotate Database Credentials

**Objective:** Move password from plaintext to secure storage  
**Estimated Time:** 1 hour  
**Blocker:** Task 1 (confirm DB accessible)

### Part A: Generate New Credentials

- [ ] Generate secure database password (32 characters, alphanumeric)
  ```bash
  NEW_DB_PASS=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-24)
  echo "Generated password: $NEW_DB_PASS"
  # Save this password somewhere secure (encrypted manager, Vault, etc.)
  ```
  **⚠️ DO NOT commit to git. DO NOT put in chat. Save to secure location.**

- [ ] Generate secure Grafana admin password
  ```bash
  NEW_GRAFANA_PASS=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-24)
  echo "Generated Grafana password: $NEW_GRAFANA_PASS"
  # Save this password separately
  ```

### Part B: Update Database

- [ ] Update autoflow database role password
  ```bash
  docker exec autoflow-postgres psql -U autoflow -d autoflow \
    -c "ALTER ROLE autoflow WITH PASSWORD '$NEW_DB_PASS';"
  ```
  Expected: ALTER ROLE

- [ ] Verify new password works by connecting
  ```bash
  PGPASSWORD=$NEW_DB_PASS docker exec autoflow-postgres psql \
    -U autoflow -d autoflow -c "SELECT 1;" 
  ```
  Expected: (1 row) with value 1

- [ ] Test old password NO LONGER works
  ```bash
  PGPASSWORD="autoflow_secure_dev_only" docker exec autoflow-postgres psql \
    -U autoflow -d autoflow -c "SELECT 1;" 2>&1 | grep -i "password"
  ```
  Expected: "password authentication failed"

### Part C: Update Docker Compose

- [ ] Backup current docker-compose.yml
  ```bash
  cp /root/autoflow/docker-compose.yml /root/autoflow/docker-compose.yml.backup.$(date +%s)
  ```

- [ ] Update environment variable in docker-compose.yml
  ```bash
  # Find and replace POSTGRES_PASSWORD
  sed -i "s/POSTGRES_PASSWORD: autoflow_secure_dev_only/POSTGRES_PASSWORD: $NEW_DB_PASS/" \
    /root/autoflow/docker-compose.yml
  
  # Also update AUTOFLOW_DB_PASS
  sed -i "s/AUTOFLOW_DB_PASS: autoflow_secure_dev_only/AUTOFLOW_DB_PASS: $NEW_DB_PASS/" \
    /root/autoflow/docker-compose.yml
  ```

- [ ] Verify changes
  ```bash
  grep -n "POSTGRES_PASSWORD\|AUTOFLOW_DB_PASS" /root/autoflow/docker-compose.yml
  ```
  Expected: Both lines show new password (not "autoflow_secure_dev_only")

- [ ] Update Grafana password in docker-compose.yml
  ```bash
  sed -i "s/GF_SECURITY_ADMIN_PASSWORD: admin/GF_SECURITY_ADMIN_PASSWORD: $NEW_GRAFANA_PASS/" \
    /root/autoflow/docker-compose.yml
  ```

- [ ] Verify Grafana password updated
  ```bash
  grep -n "GF_SECURITY_ADMIN_PASSWORD" /root/autoflow/docker-compose.yml
  ```

- [ ] **CHECKPOINT:** Notify on Slack/Chat
  ```
  ✅ Database credentials rotated and updated in docker-compose
  ```

### Part D: Restart Services (if needed)

- [ ] If connections fail after credential update, restart services:
  ```bash
  docker-compose -f /root/autoflow/docker-compose.yml down
  docker-compose -f /root/autoflow/docker-compose.yml up -d postgres
  sleep 30  # Wait for PostgreSQL to start
  docker-compose -f /root/autoflow/docker-compose.yml up -d
  ```

- [ ] Verify services are healthy
  ```bash
  docker ps | grep autoflow
  ```
  Expected: autoflow-api + autoflow-postgres showing "healthy" or "running"

### Rollback (if needed)
```bash
# Restore backup
cp /root/autoflow/docker-compose.yml.backup.TIMESTAMP /root/autoflow/docker-compose.yml
docker-compose -f /root/autoflow/docker-compose.yml down
docker-compose -f /root/autoflow/docker-compose.yml up -d
```

---

## Task 3: Deploy Redis

**Objective:** Launch Redis container for job queue and caching  
**Estimated Time:** 2 hours  
**Blocker:** Task 2 (must be first in chain)

### Part A: Add Redis to Docker Compose

- [ ] Open /root/autoflow/docker-compose.yml in editor

- [ ] Add Redis service (after ollama service, before autoflow service):
  ```yaml
  # Redis Cache & Job Queue
  redis:
    image: redis:7-alpine
    container_name: autoflow-redis
    ports:
      - "6379:6379"
    command: >
      redis-server 
      --appendonly yes 
      --maxmemory 512mb 
      --maxmemory-policy allkeys-lru
      --save 60 1000
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - autoflow-network
    restart: unless-stopped
  ```

- [ ] Add redis_data volume to volumes section:
  ```yaml
  volumes:
    postgres_data:
    ollama_data:
    prometheus_data:
    grafana_data:
    redis_data:
  ```

- [ ] Verify syntax
  ```bash
  docker-compose -f /root/autoflow/docker-compose.yml config > /tmp/compose-test.yml
  ```
  Expected: No errors, valid YAML output

### Part B: Start Redis

- [ ] Start Redis container
  ```bash
  docker-compose -f /root/autoflow/docker-compose.yml up -d redis
  ```
  Expected: "Creating autoflow-redis... done"

- [ ] Wait for Redis to be healthy (30 seconds)
  ```bash
  sleep 30
  ```

- [ ] Check Redis container status
  ```bash
  docker ps | grep redis
  docker inspect -f '{{.State.Health.Status}}' autoflow-redis 2>/dev/null || echo "Container running"
  ```
  Expected: "healthy" or "running"

- [ ] Verify Redis is accepting connections
  ```bash
  redis-cli -h localhost -p 6379 ping
  ```
  Expected: PONG

- [ ] Check Redis configuration
  ```bash
  redis-cli -h localhost -p 6379 CONFIG GET appendonly
  redis-cli -h localhost -p 6379 CONFIG GET maxmemory
  redis-cli -h localhost -p 6379 CONFIG GET maxmemory-policy
  ```
  Expected:
  - appendonly: yes
  - maxmemory: 536870912 (512MB)
  - maxmemory-policy: allkeys-lru

### Part C: Configure AutoFlow to Use Redis

- [ ] Update AutoFlow environment variables in docker-compose.yml
  ```yaml
  autoflow:
    ...
    environment:
      ...
      REDIS_URL: redis://redis:6379
      REDIS_HOST: redis
      REDIS_PORT: 6379
  ```

- [ ] Restart AutoFlow service
  ```bash
  docker-compose -f /root/autoflow/docker-compose.yml restart autoflow
  ```

- [ ] Check AutoFlow logs for Redis connection
  ```bash
  docker logs autoflow-api 2>&1 | grep -i redis | head -5
  ```
  Expected: "Connected to Redis" or similar success message (not "connection refused")

### Part D: Verify Job Queue

- [ ] Check if Redis has any keys
  ```bash
  redis-cli -h localhost -p 6379 DBSIZE
  ```
  Expected: 0 (empty initially) or growing number (if jobs are queued)

- [ ] Test Redis persistence
  ```bash
  redis-cli -h localhost -p 6379 SET test_key "Hello Redis"
  redis-cli -h localhost -p 6379 GET test_key
  ```
  Expected: "Hello Redis"

- [ ] Clean up test key
  ```bash
  redis-cli -h localhost -p 6379 DEL test_key
  ```

- [ ] **CHECKPOINT:** Notify on Slack/Chat
  ```
  ✅ Redis deployed and configured - persistence + LRU eviction enabled
  ```

### Rollback (if needed)
```bash
# Remove Redis from docker-compose and stop container
docker-compose -f /root/autoflow/docker-compose.yml down redis
# Or fully restart without Redis:
docker-compose -f /root/autoflow/docker-compose.yml down
# Edit compose to remove redis, then:
docker-compose -f /root/autoflow/docker-compose.yml up -d
```

---

## Task 4: Verify All Tables and Indexes

**Objective:** Comprehensive validation of database schema  
**Estimated Time:** 15 minutes  
**Blocker:** Task 1

### Validation Script

- [ ] Run complete database validation
  ```bash
  cat > /tmp/phase3-db-validation.sh << 'EOF'
#!/bin/bash
echo "=== Phase 3 Database Validation ==="
echo ""

DB_HOST="localhost"
DB_PORT="5434"
DB_USER="autoflow"
DB_NAME="autoflow"

# Function to run query
run_query() {
  docker exec autoflow-postgres psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "$1"
}

echo "1. GPU Metrics Table:"
run_query "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_name='gpu_job_metrics';"

echo "2. GPU Checkpoints Table:"
run_query "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_name='gpu_job_checkpoints';"

echo "3. Cost Aggregations Table:"
run_query "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_name='cost_aggregations';"

echo "4. GPU Metrics Indexes:"
run_query "SELECT COUNT(*) as index_count FROM pg_indexes WHERE tablename='gpu_job_metrics';"

echo "5. GPU Checkpoints Indexes:"
run_query "SELECT COUNT(*) as index_count FROM pg_indexes WHERE tablename='gpu_job_checkpoints';"

echo "6. Triggers:"
run_query "SELECT COUNT(*) as trigger_count FROM information_schema.triggers WHERE trigger_schema='public';"

echo "7. Views:"
run_query "SELECT COUNT(*) as view_count FROM information_schema.views WHERE table_schema='public';"

echo "8. Total Schema Size:"
run_query "SELECT pg_size_pretty(pg_database_size('autoflow')) as database_size;"

echo ""
echo "✓ Validation complete"
EOF

  chmod +x /tmp/phase3-db-validation.sh
  /tmp/phase3-db-validation.sh
  ```

- [ ] Verify results show:
  - ✅ gpu_job_metrics: 1 table found
  - ✅ gpu_job_checkpoints: 1 table found
  - ✅ cost_aggregations: 1 table found
  - ✅ GPU metrics indexes: 5+
  - ✅ GPU checkpoints indexes: 4+
  - ✅ Triggers: 1+ (gpu_checkpoints_updated_at)
  - ✅ Views: 0+ (may have 3 views)

- [ ] If any validation fails:
  - [ ] Recheck migration files exist: `ls -la /root/autoflow/migrations/00*.sql`
  - [ ] Look for SQL errors: `docker logs autoflow-postgres | grep -i error | tail -10`
  - [ ] Manually run one migration with verbose output:
    ```bash
    docker exec autoflow-postgres psql -U autoflow -d autoflow -f /docker-entrypoint-initdb.d/002_create_gpu_metrics.sql -v ON_ERROR_STOP=1
    ```

- [ ] **CHECKPOINT:** Notify on Slack/Chat
  ```
  ✅ Database schema validated - all GPU tables + indexes created
  ```

---

## Task 5: Enable API Key Secure Storage

**Objective:** Move hardcoded keys to environment/secrets  
**Estimated Time:** 1 hour  
**Blocker:** Task 2 (credentials management)

### Part A: Identify Hardcoded Keys

- [ ] Search for exposed keys in docker-compose.yml
  ```bash
  grep -E "TOKEN|KEY|SECRET|PASSWORD|OAUTH" /root/autoflow/docker-compose.yml
  ```
  Expected findings:
  - GF_SECURITY_ADMIN_PASSWORD (Grafana)
  - POSTGRES_PASSWORD (already handled in Task 2)

- [ ] Search for keys in .env files
  ```bash
  find /root/autoflow -name ".env*" -exec grep -l "KEY\|TOKEN\|SECRET" {} \;
  ```
  Expected: May find .env or .env.local

- [ ] Document all findings in secure location (password manager, not git)

### Part B: Create .env.local (for development)

- [ ] Create /root/autoflow/.env.local (NEVER commit to git)
  ```bash
  cat > /root/autoflow/.env.local << 'ENV'
# AutoFlow Phase 3 Environment Variables
# KEEP THIS FILE SECURE - NEVER COMMIT TO GIT

# Database
POSTGRES_PASSWORD=<NEW_DB_PASS_FROM_TASK_2>
AUTOFLOW_DB_PASS=<NEW_DB_PASS_FROM_TASK_2>

# Grafana
GF_SECURITY_ADMIN_PASSWORD=<NEW_GRAFANA_PASS_FROM_TASK_2>

# Anthropic API
ANTHROPIC_API_KEY=<GET_FROM_SECURE_MANAGER>
ANTHROPIC_OAUTH_TOKEN=<GET_FROM_SECURE_MANAGER>

# Supabase (if using)
SUPABASE_URL=<CONFIGURE_IF_NEEDED>
SUPABASE_KEY=<CONFIGURE_IF_NEEDED>

ENV
  chmod 600 /root/autoflow/.env.local
  ```

- [ ] Add .env.local to .gitignore
  ```bash
  echo ".env.local" >> /root/autoflow/.gitignore
  echo ".env*.local" >> /root/autoflow/.gitignore
  ```

- [ ] Verify git won't track it
  ```bash
  cd /root/autoflow && git status | grep -i ".env"
  ```
  Expected: No .env.local files listed

### Part C: Update Docker Compose for Production

- [ ] Create docker-compose.prod.yml with secrets reference
  ```yaml
  version: '3.9'
  
  services:
    postgres:
      image: postgres:16-alpine
      environment:
        POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      secrets:
        - db_password
      # ... rest of config
  
  secrets:
    db_password:
      file: /run/secrets/db_password.txt
    grafana_password:
      file: /run/secrets/grafana_password.txt
  ```

- [ ] Create secret files (for testing)
  ```bash
  mkdir -p /run/secrets
  echo "$NEW_DB_PASS" > /run/secrets/db_password.txt
  echo "$NEW_GRAFANA_PASS" > /run/secrets/grafana_password.txt
  chmod 600 /run/secrets/*.txt
  ```

- [ ] Document secret management strategy
  ```bash
  cat > /root/autoflow/SECRETS-MANAGEMENT.md << 'DOC'
# Secrets Management Strategy for Phase 3

## Development
- Use .env.local (gitignored)
- Rotate monthly

## Staging
- Use Docker secrets
- Rotate every 2 weeks

## Production
- Use HashiCorp Vault / AWS Secrets Manager
- Rotate every week
- Auto-rotation enabled

## Service Accounts
- Anthropic API key: service-account-phase3@aiox
- Supabase key: phase3-service-role
- All require MFA/IP whitelist

## Audit
- All credential access logged to CloudTrail/equivalent
- Weekly review of access logs
  DOC
  ```

- [ ] **CHECKPOINT:** Notify on Slack/Chat
  ```
  ✅ Secure storage configured - .env.local created, secrets strategy documented
  ```

### Part D: Verification

- [ ] Verify no hardcoded passwords in source
  ```bash
  grep -r "password\|PASSWORD\|secret\|SECRET\|key\|KEY" /root/autoflow \
    --exclude-dir=node_modules --exclude-dir=.venv --exclude="*.md" \
    | grep -v "config\|PASSWORD_FILE\|ENV\|\.env" | head -10
  ```
  Expected: No critical secrets exposed

- [ ] Verify services still work with updated credentials
  ```bash
  docker-compose -f /root/autoflow/docker-compose.yml restart
  sleep 30
  docker ps | grep autoflow | grep -E "healthy|running"
  ```
  Expected: All containers healthy

---

## Task 6: Final Validation & Sign-Off

**Objective:** Run complete validation suite and get approval  
**Estimated Time:** 30 minutes  
**Blocker:** All tasks 1-5 complete

### Validation

- [ ] Run complete infrastructure validation script
  ```bash
  /tmp/complete-validation.sh > /tmp/phase3-final-validation.log 2>&1
  cat /tmp/phase3-final-validation.log
  ```

- [ ] Check results:
  ```bash
  # Should show approximately:
  # Passed: 13
  # Failed: 3-5 (GPU worker + optional items)
  # Warnings: 10-12
  # Decision: GO for deployment
  ```

- [ ] If decision is "NO-GO":
  - [ ] Identify blocking issues
  - [ ] Resolve blocking issues
  - [ ] Re-run validation
  - [ ] Document resolution

### Documentation

- [ ] Update PHASE-3-INFRASTRUCTURE-VALIDATION-REPORT.md with actual results
  ```bash
  cp /tmp/phase3-final-validation.log /root/phase3-validation-results-$(date +%Y%m%d-%H%M%S).log
  ```

- [ ] Document any deviations from expected results

### Sign-Off

- [ ] Create summary report:
  ```bash
  cat > /root/PHASE-3-REMEDIATION-COMPLETE.md << 'REPORT'
# Phase 3.1 Remediation Complete

**Date:** $(date)
**Executed by:** @devops
**Status:** COMPLETE ✅

## Tasks Completed
- [x] Task 1: Database Migrations Applied (30m)
- [x] Task 2: Credentials Rotated (1h)
- [x] Task 3: Redis Deployed (2h)
- [x] Task 4: Schema Validation (15m)
- [x] Task 5: Secure Storage Configured (1h)

## Validation Results
- GPU Job Metrics table: CREATED ✅
- GPU Checkpoints table: CREATED ✅
- Cost Aggregations table: CREATED ✅
- Indexes: CREATED ✅
- Database password: ROTATED ✅
- Grafana password: ROTATED ✅
- Redis: DEPLOYED ✅
- Credentials: SECURED ✅

## Readiness
- Infrastructure Validation: PASS (13/18 items)
- Security Review: PENDING @architect
- Performance Baseline: PASS (<100ms P99)
- Database: HEALTHY ✅
- Services: HEALTHY ✅

## Next Steps
1. @architect reviews security findings
2. @qa runs final validation
3. @sm marks stories ready for deployment
4. Proceed to Phase 3.2 (Cloudflare tunnel)

REPORT
  ```

- [ ] Notify team on Slack/Chat:
  ```
  ✅ PHASE 3.1 REMEDIATION COMPLETE
  
  All critical blocking issues resolved:
  - Database migrations: ✅ Applied
  - Credentials: ✅ Rotated
  - Redis: ✅ Deployed
  - Schema: ✅ Validated
  - Secure storage: ✅ Configured
  
  Infrastructure readiness: 72% (13/18)
  Decision: GO for deployment (pending final approval)
  
  Next: @architect security sign-off + @qa validation
  ```

---

## Troubleshooting Guide

### Issue: Migration fails with "already exists" error

**Cause:** Tables already partially created  
**Solution:**
```bash
docker exec autoflow-postgres psql -U autoflow -d autoflow -c "
DROP TABLE IF EXISTS gpu_job_metrics CASCADE;
DROP TABLE IF EXISTS gpu_job_checkpoints CASCADE;
DROP TABLE IF EXISTS cost_aggregations CASCADE;"

# Then re-apply migrations
docker exec autoflow-postgres psql -U autoflow -d autoflow < /root/autoflow/migrations/002_create_gpu_metrics.sql
```

### Issue: Redis container won't start

**Cause:** Port 6379 already in use  
**Solution:**
```bash
# Find what's using port 6379
netstat -tlnp | grep 6379

# Or change Redis port in docker-compose:
sed -i 's/"6379:6379"/"6380:6379"/' /root/autoflow/docker-compose.yml

# Update REDIS_URL
sed -i 's/:6379/:6380/' /root/autoflow/docker-compose.yml
```

### Issue: Database connection fails after credential change

**Cause:** Services using old password  
**Solution:**
```bash
# Restart all services to pick up new env vars
docker-compose -f /root/autoflow/docker-compose.yml restart

# If still failing, check actual password in container
docker inspect autoflow-api | grep -A5 "\"Env\""

# Verify password is actually updated in docker-compose.yml
grep POSTGRES_PASSWORD /root/autoflow/docker-compose.yml
```

### Issue: Validation shows fewer than 13 items passing

**Cause:** Tasks not fully completed or services not healthy  
**Solution:**
1. Check service logs: `docker logs <service-name>`
2. Verify all containers are running: `docker ps | grep autoflow`
3. Check for errors: `docker-compose -f /root/autoflow/docker-compose.yml logs`
4. Resolve specific issues based on error messages
5. Re-run validation: `/tmp/complete-validation.sh`

---

## Success Criteria Checklist

**Phase 3.1 is complete when ALL items are checked:**

- [ ] Task 1: Migrations applied successfully
- [ ] Task 2: Database credentials rotated
- [ ] Task 3: Redis deployed and healthy
- [ ] Task 4: Schema validation shows all tables
- [ ] Task 5: Secrets securely stored
- [ ] Validation suite shows ≥13/18 passing
- [ ] No critical security issues remaining
- [ ] All services healthy and connected
- [ ] Team notified of completion
- [ ] Ready for final approval

**When all items ✅ checked: Phase 3.1 is COMPLETE and deployment can proceed.**

---

**Estimated Completion Time:** 4-5 hours from start  
**Blockage Risk:** LOW (if tasks followed sequentially)  
**Rollback Risk:** LOW (all steps reversible)

**Contact @devops with any issues or blockers during execution.**
