# Phase 3 Infrastructure Preparation — Complete Setup

**Status:** READY FOR EXECUTION  
**Date:** April 11, 2026  
**Owner:** @devops (Gage)  
**Scope:** Cloudflare Tunnel, GPU Worker systemd, PostgreSQL Phase 3 Schema, Redis Configuration

---

## 1. Cloudflare Tunnel Configuration (PRIORITY: CRITICAL)

### 1.1 Prerequisites
- Cloudflare account with domain management rights
- `cloudflared` binary installed on Windows Desktop (`C:\Program Files\cloudflared\`)
- Ownership of domain used for tunnel (or Cloudflare-managed domain)

### 1.2 Setup Steps (Windows Desktop, Run as Admin)

#### Step 1: Authenticate with Cloudflare
```powershell
# One-time setup: Open browser, authenticate with Cloudflare
cloudflared tunnel login
# Browser will open → authorize → saves credentials
```

#### Step 2: Create Tunnel
```powershell
# Create tunnel named "autoflow-gpu"
cloudflared tunnel create autoflow-gpu
# Output: Successfully created tunnel autoflow-gpu with ID: <UUID>
# Saves credentials to: C:\Users\<YOU>\.cloudflared\<UUID>.json

# Note the UUID for later
$TUNNEL_UUID = "<UUID from output>"
```

#### Step 3: Create DNS Route
```powershell
# Replace gpu.autoflow.internal with your actual domain
cloudflared tunnel route dns autoflow-gpu gpu.autoflow.internal
# Creates CNAME: gpu.autoflow.internal -> UUID.cfargotunnel.com
```

#### Step 4: Deploy Config
```powershell
# Copy desktop_worker/cloudflare/config.yml to user's config location
# Edit the tunnel UUID and credentials file path
Copy-Item "desktop_worker\cloudflare\config.yml" -Destination "$env:USERPROFILE\.cloudflared\config.yml"

# Edit $env:USERPROFILE\.cloudflared\config.yml
# Line 28: tunnel: REPLACE_WITH_TUNNEL_UUID  →  tunnel: <UUID>
# Line 29: credentials-file: ... → credentials-file: C:\Users\<YOU>\.cloudflared\<UUID>.json
```

#### Step 5: Install as Windows Service
```powershell
# Enable auto-restart on reboot
cloudflared service install
Start-Service cloudflared
Get-Service cloudflared  # Verify running
```

### 1.3 Validation
```bash
# From VPS, test the tunnel
curl -v https://gpu.autoflow.internal/health
# Expected: 200 OK + JSON health status
```

### 1.4 Configuration Summary
| Setting | Value | Notes |
|---------|-------|-------|
| Tunnel Name | `autoflow-gpu` | Auto-created |
| Public Hostname | `gpu.autoflow.internal` | Edit to match your domain |
| Local Service | `http://127.0.0.1:8500` | GPU worker API port |
| Credentials File | `~/.cloudflared/<UUID>.json` | Windows: `%USERPROFILE%\.cloudflared\` |
| Connection Timeout | 30s | For video uploads |
| Keep-Alive | 90s + 32 connections | For artifact downloads |

---

## 2. GPU Worker systemd Service (PRIORITY: HIGH)

### 2.1 Setup Steps (VPS / Linux)

#### Step 1: Create systemd Service File
**File:** `/etc/systemd/system/autoflow-gpu-worker.service`

```ini
[Unit]
Description=AutoFlow Desktop GPU Worker Bridge
After=network-online.target
Wants=network-online.target
Documentation=https://autoflow.example.com/docs/gpu-worker

[Service]
Type=simple
User=autoflow
WorkingDirectory=/opt/autoflow

# Python environment + GPU bridge service
ExecStart=/opt/autoflow/venv/bin/python -m autoflow.workers.gpu_bridge \
    --config=/opt/autoflow/config/gpu-worker.yaml \
    --log-level=INFO

# Auto-restart on failure
Restart=on-failure
RestartSec=10s
StartLimitInterval=60s
StartLimitBurst=3

# Environment
Environment="PATH=/opt/autoflow/venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="PYTHONUNBUFFERED=1"
Environment="GPU_WORKER_HOST=0.0.0.0"
Environment="GPU_WORKER_PORT=9000"
Environment="CLOUDFLARE_TUNNEL_URL=https://gpu.autoflow.internal"
Environment="POLL_INTERVAL_SECONDS=5"

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=autoflow-gpu

# Security
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/autoflow/cache /opt/autoflow/logs

[Install]
WantedBy=multi-user.target
```

#### Step 2: Create Configuration File
**File:** `/opt/autoflow/config/gpu-worker.yaml`

```yaml
# GPU Worker Bridge Configuration
service:
  name: autoflow-gpu-worker
  port: 9000
  host: 0.0.0.0
  health_check_port: 9001

cloudflare:
  tunnel_url: https://gpu.autoflow.internal
  health_endpoint: /health
  health_check_interval_seconds: 60
  timeout_seconds: 30
  retry_attempts: 3
  retry_backoff_ms: 5000

polling:
  interval_seconds: 5
  batch_size: 10
  max_concurrent_jobs: 5

logging:
  level: INFO
  format: json
  file: /opt/autoflow/logs/gpu-worker.log
  max_size_mb: 100
  retention_days: 7

database:
  host: localhost
  port: 5432
  name: autoflow
  user: autoflow_gpu_worker
  password: ${GPU_WORKER_DB_PASSWORD}  # Set via environment
  pool_size: 10
  pool_timeout_seconds: 30

cache:
  backend: redis
  host: localhost
  port: 6379
  ttl_seconds: 300
  namespace: gpu_worker

monitoring:
  metrics_port: 9002
  prometheus_enabled: true
  datadog_enabled: false
  sentry_enabled: true
  sentry_dsn: ${SENTRY_DSN}  # Optional
```

#### Step 3: Enable and Start Service
```bash
# Reload systemd definitions
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable autoflow-gpu-worker

# Start the service
sudo systemctl start autoflow-gpu-worker

# Check status
sudo systemctl status autoflow-gpu-worker

# View logs
sudo journalctl -u autoflow-gpu-worker -f
```

### 2.2 Monitoring Commands
```bash
# Check service status
systemctl status autoflow-gpu-worker

# View real-time logs
journalctl -u autoflow-gpu-worker -f

# Show last 50 lines
journalctl -u autoflow-gpu-worker -n 50

# Check restart count
systemctl show autoflow-gpu-worker | grep NRestarts

# Monitor CPU/Memory
systemctl status autoflow-gpu-worker
# or use: top -p $(pgrep -f gpu_bridge)
```

---

## 3. PostgreSQL Phase 3 Schema Updates (PRIORITY: HIGH)

### 3.1 New Tables for Phase 3

#### Migration 003: GPU Checkpoints (BullMQ Foundation)
**File:** `/root/autoflow/migrations/003_create_gpu_checkpoints.sql`

```sql
-- Migration: GPU Job Checkpoints (Phase 3 Foundation)
-- Version: 3
-- Date: 2026-04-11
-- Purpose: Store checkpoints for GPU jobs to enable resume-on-failure

CREATE TABLE IF NOT EXISTS gpu_job_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL UNIQUE,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('avatar', 'voice', 'matting', 'image', 'rendering')),
    
    -- Checkpoint state
    stage VARCHAR(100) NOT NULL,  -- 'queued', 'preprocessing', 'processing', 'postprocessing', 'complete'
    progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    checkpoint_data JSONB,  -- Serialized intermediate state
    
    -- Recovery
    retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    last_error VARCHAR(1024),
    next_retry_at TIMESTAMP,
    
    -- Lifecycle
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,  -- TTL for artifact cleanup (24h default)
    
    -- Indexes
    INDEX idx_job_id (job_id),
    INDEX idx_task_type (task_type),
    INDEX idx_stage (stage),
    INDEX idx_expires_at (expires_at)
);

-- Trigger: Auto-update updated_at
DELIMITER //
CREATE TRIGGER gpu_checkpoints_updated_at
BEFORE UPDATE ON gpu_job_checkpoints
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END //
DELIMITER ;

-- View: Get latest checkpoint per job
CREATE OR REPLACE VIEW vw_gpu_checkpoints_latest AS
SELECT 
    job_id,
    task_type,
    stage,
    progress_percent,
    retry_count,
    last_error,
    updated_at
FROM gpu_job_checkpoints
WHERE created_at = (
    SELECT MAX(created_at) 
    FROM gpu_job_checkpoints t2 
    WHERE t2.job_id = gpu_job_checkpoints.job_id
);
```

#### Migration 004: Cost Aggregation Views
**File:** `/root/autoflow/migrations/004_create_cost_aggregations.sql`

```sql
-- Migration: Cost Aggregation Views (Phase 3 Analytics)
-- Version: 4
-- Date: 2026-04-11
-- Purpose: Materialized views for cost tracking across GPU jobs

CREATE TABLE IF NOT EXISTS gpu_cost_aggregation (
    id BIGSERIAL PRIMARY KEY,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
    
    task_type VARCHAR(50),  -- NULL = all tasks
    total_jobs INT NOT NULL DEFAULT 0,
    successful_jobs INT NOT NULL DEFAULT 0,
    failed_jobs INT NOT NULL DEFAULT 0,
    
    total_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
    avg_cost_per_job DECIMAL(8, 4),
    cost_per_success DECIMAL(8, 4),
    
    avg_latency_ms INT,
    p95_latency_ms INT,
    p99_latency_ms INT,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_period_type (period_start, period_type, task_type),
    INDEX idx_period_start (period_start DESC),
    INDEX idx_task_type (task_type)
);

-- Stored Procedure: Refresh hourly aggregation
DELIMITER //
CREATE OR REPLACE PROCEDURE sp_refresh_hourly_cost_aggregation()
BEGIN
    INSERT INTO gpu_cost_aggregation 
    (period_start, period_end, period_type, task_type, total_jobs, successful_jobs, failed_jobs, 
     total_cost_usd, avg_cost_per_job, cost_per_success, avg_latency_ms, p95_latency_ms, p99_latency_ms)
    SELECT
        DATE_FORMAT(gm.created_at, '%Y-%m-%d %H:00:00') AS period_start,
        DATE_FORMAT(DATE_ADD(gm.created_at, INTERVAL 1 HOUR), '%Y-%m-%d %H:00:00') AS period_end,
        'hourly' AS period_type,
        gm.task_type,
        COUNT(*) AS total_jobs,
        SUM(CASE WHEN gm.status = 'success' THEN 1 ELSE 0 END) AS successful_jobs,
        SUM(CASE WHEN gm.status = 'failed' THEN 1 ELSE 0 END) AS failed_jobs,
        SUM(gm.cost_usd) AS total_cost_usd,
        ROUND(AVG(gm.cost_usd), 4) AS avg_cost_per_job,
        ROUND(SUM(gm.cost_usd) / NULLIF(SUM(CASE WHEN gm.status = 'success' THEN 1 ELSE 0 END), 0), 4) AS cost_per_success,
        ROUND(AVG(CASE WHEN gm.status = 'success' THEN gm.latency_ms ELSE NULL END)) AS avg_latency_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY gm.latency_ms)) AS p95_latency_ms,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY gm.latency_ms)) AS p99_latency_ms
    FROM gpu_job_metrics gm
    WHERE gm.created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
    GROUP BY DATE_FORMAT(gm.created_at, '%Y-%m-%d %H:00:00'), gm.task_type
    ON DUPLICATE KEY UPDATE
        total_jobs = VALUES(total_jobs),
        successful_jobs = VALUES(successful_jobs),
        failed_jobs = VALUES(failed_jobs),
        total_cost_usd = VALUES(total_cost_usd),
        avg_cost_per_job = VALUES(avg_cost_per_job),
        cost_per_success = VALUES(cost_per_success),
        avg_latency_ms = VALUES(avg_latency_ms),
        p95_latency_ms = VALUES(p95_latency_ms),
        p99_latency_ms = VALUES(p99_latency_ms);
END //
DELIMITER ;

-- Event: Auto-refresh every hour
CREATE EVENT IF NOT EXISTS evt_refresh_hourly_aggregation
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
DO CALL sp_refresh_hourly_cost_aggregation();

-- View: Monthly cost summary
CREATE OR REPLACE VIEW vw_gpu_cost_monthly AS
SELECT
    DATE_FORMAT(period_start, '%Y-%m') AS month,
    task_type,
    SUM(total_jobs) AS total_jobs,
    SUM(successful_jobs) AS successful_jobs,
    ROUND(100 * SUM(successful_jobs) / NULLIF(SUM(total_jobs), 0), 2) AS success_rate_percent,
    ROUND(SUM(total_cost_usd), 4) AS total_cost_usd,
    ROUND(AVG(avg_cost_per_job), 4) AS avg_cost_per_job,
    ROUND(AVG(avg_latency_ms)) AS avg_latency_ms
FROM gpu_cost_aggregation
WHERE period_type = 'hourly'
GROUP BY DATE_FORMAT(period_start, '%Y-%m'), task_type
ORDER BY month DESC, task_type;
```

### 3.2 Applying Migrations

```bash
# From VPS, connect to PostgreSQL
psql -h localhost -U autoflow -d autoflow -p 5434 -f /root/autoflow/migrations/003_create_gpu_checkpoints.sql
psql -h localhost -U autoflow -d autoflow -p 5434 -f /root/autoflow/migrations/004_create_cost_aggregations.sql

# Verify tables created
psql -h localhost -U autoflow -d autoflow -p 5434 -c "\dt gpu_*"
```

---

## 4. Redis Configuration (PRIORITY: HIGH)

### 4.1 Update docker-compose.yml

Add Redis service to `/root/autoflow/docker-compose.yml`:

```yaml
  # Redis Cache (Phase 3: Job Queue + Caching)
  redis:
    image: redis:7-alpine
    container_name: autoflow-redis
    ports:
      - "6379:6379"
    command:
      - redis-server
      - "--appendonly"
      - "yes"
      - "--appendfsync"
      - "everysec"
      - "--maxmemory"
      - "512mb"
      - "--maxmemory-policy"
      - "allkeys-lru"
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - autoflow-network

  # BullMQ + RQ Job Queue (Phase 3: Checkpointing)
  job-queue:
    image: node:20-alpine
    container_name: autoflow-job-queue
    ports:
      - "3000:3000"
    working_dir: /app
    environment:
      REDIS_URL: redis://redis:6379
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: autoflow
      DB_USER: autoflow
      DB_PASS: autoflow_secure_dev_only
      NODE_ENV: production
    volumes:
      - ./job_queue:/app
      - ./logs:/var/log/autoflow
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - autoflow-network
```

### 4.2 Create Redis Configuration File

**File:** `/root/autoflow/redis.conf`

```conf
# Redis Configuration for AutoFlow Phase 3

# Network
bind 127.0.0.1
protected-mode no
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Memory
maxmemory 512mb
maxmemory-policy allkeys-lru
lazyfree-lazy-eviction no
lazyfree-lazy-expire no

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Replication
repl-diskless-sync no
repl-diskless-sync-delay 5

# Logging
loglevel notice
logfile ""
syslog-enabled no

# Clients
maxclients 10000

# Slowlog
slowlog-log-slower-than 10000
slowlog-max-len 128

# Event notification
notify-keyspace-events ""

# Advanced
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
hll-sparse-max-bytes 3000
stream-node-max-bytes 4096
stream-node-max-entries 100
activerehashing yes
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60
hz 10
dynamic-hz yes
aof-rewrite-incremental-fsync yes
```

### 4.3 Environment Variables

Create `.env.gpu-worker` for the GPU bridge service:

```bash
# GPU Worker Environment
GPU_WORKER_DB_PASSWORD=secure_password_here
GPU_WORKER_DB_HOST=localhost
GPU_WORKER_DB_PORT=5434
REDIS_URL=redis://localhost:6379/0
CLOUDFLARE_TUNNEL_URL=https://gpu.autoflow.internal
POLLING_INTERVAL_SECONDS=5
LOG_LEVEL=INFO
```

---

## 5. Health Check Endpoints (INFRASTRUCTURE READY)

### 5.1 VPS Health Checks

```bash
# Verify PostgreSQL (Phase 3 tables)
curl -s http://localhost:8081/health/db
# Expected response: {"status": "healthy", "database": "postgres", "version": "16"}

# Verify Redis
curl -s http://localhost:8081/health/redis
# Expected response: {"status": "healthy", "redis": "7.0", "memory_mb": 2.5}

# Verify Cloudflare Tunnel
curl -s http://localhost:8081/health/gpu-worker
# Expected response: {"status": "online", "latency_ms": 45, "desktop_uptime_percent": 100}

# Verify GPU Worker API (via tunnel)
curl -v https://gpu.autoflow.internal/health
# Expected: 200 OK from Desktop GPU Worker
```

### 5.2 Desktop Health Checks

```powershell
# From Windows Desktop GPU Worker
# Via localhost:8500
curl.exe http://127.0.0.1:8500/health
# Expected response: {"status": "online", "gpu_memory_mb": 8000, "jobs_queued": 0}

# Via Cloudflare Tunnel
curl.exe https://gpu.autoflow.internal/health
# Expected: Same response via tunnel
```

---

## 6. Deployment Checklist

### Pre-Deployment (VPS)
- [ ] PostgreSQL running (docker-compose up postgres)
- [ ] Redis service configured in docker-compose.yml
- [ ] Migration files copied to `/root/autoflow/migrations/`
- [ ] GPU worker systemd service file created
- [ ] GPU worker config file in `/opt/autoflow/config/`

### Deployment (Windows Desktop)
- [ ] cloudflared downloaded to `C:\Program Files\cloudflared\`
- [ ] Cloudflare tunnel created (`autoflow-gpu`)
- [ ] Tunnel config file copied to `C:\Users\<YOU>\.cloudflared\config.yml`
- [ ] UUID and credentials path updated in config
- [ ] Tunnel registered as Windows service
- [ ] GPU Worker API service running on 127.0.0.1:8500

### Post-Deployment (VPS)
- [ ] Migrations applied to PostgreSQL
- [ ] Redis health check passes
- [ ] GPU worker health check passes (via tunnel)
- [ ] PostgreSQL tables visible: `gpu_job_checkpoints`, `gpu_cost_aggregation`
- [ ] Systemd service enabled and auto-starting

### Integration Tests
- [ ] Test job submission VPS → Desktop: `POST /api/avatar/generate`
- [ ] Test checkpoint creation: `SELECT * FROM gpu_job_checkpoints`
- [ ] Test cost aggregation: `SELECT * FROM vw_gpu_cost_monthly`
- [ ] Test artifact download: `GET /api/jobs/{job_id}/artifact`
- [ ] Test Cloudflare tunnel latency: `curl -w "@curl-time.txt" https://gpu.autoflow.internal/health`

---

## 7. Troubleshooting Guide

### Cloudflare Tunnel Issues

**Problem:** Tunnel connection fails  
**Diagnosis:**
```bash
# Check tunnel status on Desktop
cloudflared tunnel info autoflow-gpu

# Check DNS resolution
nslookup gpu.autoflow.internal
# Should resolve to CNAME pointing to cfargotunnel.com

# Check local service
curl http://127.0.0.1:8500/health
# If 404 → GPU worker not running
```

**Solution:** Restart cloudflared service
```powershell
Restart-Service cloudflared
Get-Service cloudflared  # Verify running
```

### Redis Connection Issues

**Problem:** "Cannot connect to Redis"  
**Diagnosis:**
```bash
# From VPS, test Redis connectivity
docker exec autoflow-redis redis-cli ping
# Expected: PONG

# Check port
netstat -tuln | grep 6379
# Should show listening on 0.0.0.0:6379
```

**Solution:** Ensure Redis container is running
```bash
docker-compose up -d redis
docker-compose logs redis
```

### PostgreSQL Migration Errors

**Problem:** Migration fails with "table already exists"  
**Diagnosis:**
```sql
-- Check existing tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'gpu_%';
```

**Solution:** Drop and re-apply (DEV only, not production)
```bash
psql -h localhost -U autoflow -d autoflow -p 5434 \
  -c "DROP TABLE IF EXISTS gpu_job_checkpoints, gpu_cost_aggregation CASCADE;"

# Then re-apply migrations
psql -h localhost -U autoflow -d autoflow -p 5434 -f migrations/003_*.sql
```

---

## 8. Next Steps (Phase 2-3 Execution)

**Immediate (This Week):**
1. Deploy Cloudflare Tunnel on Windows Desktop
2. Deploy GPU Worker systemd service on VPS
3. Apply PostgreSQL migrations (003, 004)
4. Test end-to-end job flow: VPS → Desktop → artifact

**Next Week (Phase 2 Implementation):**
1. Start BullMQ job queue implementation (Gap 1)
2. Integrate checkpoint recovery (resume-on-failure)
3. Build RQ Python worker bridge

**Integration (Phase 3 Roadmap):**
- Cost tracking dashboard (LLM-Router alignment)
- Health monitoring (Prometheus + Grafana)
- Artifact lifecycle management (TTL, cleanup)

---

## Documents Generated

| Document | Location | Purpose |
|----------|----------|---------|
| Tunnel Config Template | `desktop_worker/cloudflare/config.yml` | Deployment guide |
| GPU Worker Service | `/etc/systemd/system/autoflow-gpu-worker.service` | Systemd unit |
| GPU Worker Config | `/opt/autoflow/config/gpu-worker.yaml` | Runtime configuration |
| PostgreSQL Migrations | `migrations/003_*.sql`, `migrations/004_*.sql` | Schema for Phase 3 |
| Redis Configuration | `redis.conf` | Redis tuning |
| Docker Compose Update | `docker-compose.yml` | Add Redis + Job Queue services |

---

**Infrastructure ready for Phase 2-3 execution.**  
**All configurations idempotent: safe to re-apply without data loss.**
