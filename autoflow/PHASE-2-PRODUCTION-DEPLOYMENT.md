# Phase 2 AutoFlow — Production Deployment Guide

**Status:** Ready for Production  
**QA Approval:** ✅ APPROVED (291/291 tests passing)  
**Deployment Target:** VPS (main) + Desktop (GPU worker)  
**Estimated Downtime:** <5 minutes

---

## Pre-Deployment Checklist (Complete Before Deployment)

### Infrastructure Prerequisites
- [x] PostgreSQL database running and accessible
- [x] Redis server running on port 6379
- [x] Network connectivity: VPS ↔ Desktop (for GPU worker)
- [x] Sufficient disk space: /var/log/ (for cost logs)
- [ ] Monitoring stack (Prometheus + Grafana) — optional but recommended

### Secrets & Configuration
- [ ] ANTHROPIC_API_KEY set in environment
- [ ] LLM_ROUTER_API_KEY set in environment
- [ ] GPU_WORKER_URL configured (if using GPU worker)
- [ ] Database credentials set (PGHOST, PGUSER, PGPASSWORD)
- [ ] Redis credentials set (REDIS_PASSWORD)

### Database & Migrations
- [ ] PostgreSQL connectivity verified (`psql -U postgres -h localhost``)
- [ ] Database exists: `autoflow_production`
- [ ] Alembic migrations ready to apply
- [ ] Backup of existing database taken (if exists)

### Code & Dependencies
- [ ] Latest code pulled from `main` branch
- [ ] Virtual environment created: `.venv`
- [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] Tests passing locally: `pytest tests/ -v` (291/291)

### Systemd Services
- [ ] Service files created in `/etc/systemd/system/`
- [ ] Services enabled: `systemctl enable autoflow-api`
- [ ] User account created: `useradd autoflow` (if needed)
- [ ] Permissions set: `/root/autoflow` readable by autoflow user

---

## Deployment Steps

### Step 1: Pre-Deployment Database Backup

```bash
# Backup existing database (if any)
pg_dump autoflow_production > /backups/autoflow-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
ls -lh /backups/autoflow-*.sql
```

**Expected Output:** Backup file ~100 MB (variable by data volume)

---

### Step 2: Apply Database Migrations

```bash
cd /root/autoflow

# Activate virtual environment
source .venv/bin/activate

# Run migrations
python -m alembic upgrade head

# Verify migrations applied
psql autoflow_production -c "\dt"  # Should show tables
```

**Expected Output:**
```
autoflow_production=# \dt
                List of relations
 public | langgraph_checkpoints
 public | cost_logs
 public | model_registry
 public | tenant_config
 public | job_queue
```

---

### Step 3: Configure Environment Variables

```bash
# Create .env file
cat > /root/autoflow/.env << 'EOF'
# LLM Configuration
ANTHROPIC_API_KEY=sk-ant-xxxxx...
LLM_ROUTER_URL=http://localhost:7778
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# Database
PGHOST=localhost
PGUSER=autoflow
PGPASSWORD=xxxxx...
PGDATABASE=autoflow_production
PGPORT=5432

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# GPU Worker (if using GPU integration)
GPU_WORKER_URL=https://gpu.example.com

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4

# Logging
LOG_LEVEL=INFO
COST_LOG_PATH=/var/log/autoflow-router.jsonl

# Feature Flags (disable Gap features until ready)
ENABLE_RQ_JOBS=false
ENABLE_GPU_WORKER=false
ENABLE_LLM_ROUTER=true  # Gap 3 ready for production
EOF

# Secure .env file
chmod 600 /root/autoflow/.env
chown autoflow:autoflow /root/autoflow/.env
```

**Verification:**
```bash
# Test that secrets are readable
source /root/autoflow/.env && echo "ANTHROPIC_API_KEY set: ${ANTHROPIC_API_KEY:0:10}..."
```

---

### Step 4: Create Systemd Services

```bash
# Create AutoFlow API service
sudo tee /etc/systemd/system/autoflow-api.service > /dev/null << 'EOF'
[Unit]
Description=AutoFlow API Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=autoflow
WorkingDirectory=/root/autoflow
EnvironmentFile=/root/autoflow/.env

ExecStart=/root/autoflow/.venv/bin/uvicorn \
  autoflow.api.server:app \
  --host ${API_HOST:-0.0.0.0} \
  --port ${API_PORT:-8000} \
  --workers ${API_WORKERS:-4} \
  --loop uvloop

Restart=on-failure
RestartSec=10s

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=autoflow-api

# Security
PrivateTmp=yes
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# Create RQ Worker service (for Gap 1)
sudo tee /etc/systemd/system/autoflow-rq-worker.service > /dev/null << 'EOF'
[Unit]
Description=AutoFlow RQ Worker
After=network.target redis.service

[Service]
Type=simple
User=autoflow
WorkingDirectory=/root/autoflow
EnvironmentFile=/root/autoflow/.env

ExecStart=/root/autoflow/.venv/bin/rq worker \
  -u redis://localhost:6379 \
  --burst

Restart=on-failure
RestartSec=10s

StandardOutput=journal
StandardError=journal
SyslogIdentifier=autoflow-rq-worker

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload
```

---

### Step 5: Start Services

```bash
# Enable services
sudo systemctl enable autoflow-api
sudo systemctl enable autoflow-rq-worker

# Start services
sudo systemctl start autoflow-api
sudo systemctl start autoflow-rq-worker

# Check status
sudo systemctl status autoflow-api
sudo systemctl status autoflow-rq-worker

# View logs
sudo journalctl -u autoflow-api -f
sudo journalctl -u autoflow-rq-worker -f
```

**Expected Output (autoflow-api):**
```
autoflow-api[12345]: INFO:     Uvicorn running on http://0.0.0.0:8000
autoflow-api[12345]: INFO:     Application startup complete
```

---

### Step 6: Verify Deployment

```bash
# 1. API health check
curl http://localhost:8000/health
# Expected: 200 OK, {"status": "healthy"}

# 2. Router health
curl http://localhost:8000/api/router/health
# Expected: 200 OK, {"llm_router_url": "...", "circuit_state": "closed"}

# 3. Cost logging test
curl -X POST http://localhost:8000/api/test/cost-log \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test", "model": "qwen2.5:3b"}'
# Expected: 200 OK

# 4. Check cost log file
tail /var/log/autoflow-router.jsonl
# Expected: JSONL entries with {"status": "success", ...}
```

---

### Step 7: Configure Monitoring (Optional but Recommended)

```bash
# Install Prometheus node exporter (if not already installed)
cd /opt
wget https://github.com/prometheus/node_exporter/releases/download/v1.8.0/node_exporter-1.8.0.linux-amd64.tar.gz
tar xzf node_exporter-1.8.0.linux-amd64.tar.gz
sudo systemctl start node_exporter

# Create Prometheus scrape config
sudo tee /etc/prometheus/scrape_configs/autoflow.yml > /dev/null << 'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'autoflow'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:5432']
EOF

# Reload Prometheus
sudo systemctl reload prometheus

# Create Grafana dashboard (import JSON from /root/autoflow/dashboards/)
# Point Prometheus datasource to http://localhost:9090
```

---

## Post-Deployment Validation

### Immediate Checks (First 5 minutes)

```bash
# 1. Services running
systemctl is-active autoflow-api
systemctl is-active autoflow-rq-worker

# 2. No critical errors in logs
journalctl -u autoflow-api -p err -n 10

# 3. Cost logging active
wc -l /var/log/autoflow-router.jsonl

# 4. Database connectivity
psql autoflow_production -c "SELECT COUNT(*) FROM cost_logs;"

# 5. Circuit breaker healthy
curl -s http://localhost:8000/api/router/health | grep "circuit_state"
# Should be: "circuit_state": "closed"
```

### Extended Checks (First Hour)

```bash
# 1. API response latency
time curl -s http://localhost:8000/api/health > /dev/null

# 2. Cost tracking accuracy
# Run 5 test calls, verify cost logs
for i in {1..5}; do
  curl -X POST http://localhost:8000/api/llm/call \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": \"Test $i\", \"model\": \"qwen2.5:3b\"}"
done

# 3. Query aggregated costs
psql autoflow_production -c "SELECT COUNT(*), SUM(cost_usd) FROM cost_logs WHERE created_at > NOW() - INTERVAL '1 hour';"

# 4. Check for errors
journalctl -u autoflow-api --since "1 hour ago" | grep -i error
# Should be minimal/none

# 5. Verify fallback chain
# Simulate Ollama offline, verify Claude fallback works
```

### Health Check Dashboard

```bash
# Create simple health check script
cat > /usr/local/bin/autoflow-health-check << 'EOF'
#!/bin/bash

echo "=== AutoFlow Health Check ==="
echo "API Status: $(systemctl is-active autoflow-api)"
echo "RQ Worker Status: $(systemctl is-active autoflow-rq-worker)"
echo "API Port: $(curl -s http://localhost:8000/health | jq -r .status)"
echo "Circuit Breaker: $(curl -s http://localhost:8000/api/router/health | jq -r .circuit_state)"
echo "Cost Log Lines: $(wc -l < /var/log/autoflow-router.jsonl)"
echo "Recent Errors: $(journalctl -u autoflow-api -p err -n 5)"
EOF

chmod +x /usr/local/bin/autoflow-health-check
autoflow-health-check
```

---

## Rollback Procedure (If Issues Found)

### Quick Rollback (if deployment fails immediately)

```bash
# 1. Stop services
sudo systemctl stop autoflow-api
sudo systemctl stop autoflow-rq-worker

# 2. Rollback database (if migrations caused issues)
psql autoflow_production < /backups/autoflow-YYYYMMDD-HHMMSS.sql

# 3. Verify rollback
curl http://localhost:8000/health
# Should fail (old version not running)

# 4. Restart with previous version
cd /root/autoflow
git checkout previous-tag
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl start autoflow-api
```

### Disable Gap Features (if Phase 2 Gap causes issues)

```bash
# In .env file, set:
ENABLE_RQ_JOBS=false        # Disable Gap 1 (BullMQ)
ENABLE_GPU_WORKER=false     # Disable Gap 2 (GPU)
ENABLE_LLM_ROUTER=false     # Disable Gap 3 (LLM-Router) — if issues found

# Restart API
sudo systemctl restart autoflow-api

# Verify
curl http://localhost:8000/api/router/health
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

```
1. API Response Latency
   - Metric: request_duration_ms (histogram)
   - Alert: >500ms for 5+ consecutive requests
   - Action: Scale horizontally or optimize queries

2. Circuit Breaker State
   - Metric: circuit_breaker_state (gauge)
   - Alert: State = OPEN (2) for >60 seconds
   - Action: Check LLM-Router or Ollama health

3. Cost Tracking Accuracy
   - Metric: cost_usd_total (gauge, per workflow)
   - Alert: Actual vs Estimated >10% variance
   - Action: Verify token counting accuracy

4. Error Rate
   - Metric: errors_total (counter)
   - Alert: >1% error rate over 5 minutes
   - Action: Check logs, escalate if > 5%

5. Job Queue Depth
   - Metric: rq_jobs_queued (gauge)
   - Alert: >100 jobs queued (backlog building)
   - Action: Scale RQ workers

6. Database Connection Pool
   - Metric: pg_connections_active (gauge)
   - Alert: >80% of max_connections
   - Action: Increase pool size or restart
```

### Alert Rules (Prometheus)

```yaml
groups:
  - name: autoflow
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.95, request_duration_ms) > 500
        for: 5m
        
      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state == 2
        for: 1m
        
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.01
        for: 5m
        
      - alert: JobQueueBacklog
        expr: rq_jobs_queued > 100
        for: 10m
```

---

## GPU Worker Integration (Gap 2 — Post-Deployment)

If deploying GPU worker integration:

### On VPS (main)
```bash
# Set GPU worker URL
export GPU_WORKER_URL=https://gpu.example.com

# Enable GPU worker feature flag
export ENABLE_GPU_WORKER=true

# Restart API
sudo systemctl restart autoflow-api

# Test GPU connection
curl http://localhost:8000/api/gpu/health
```

### On Desktop (GPU Worker)
```bash
# Start GPU worker API
cd /root/autoflow/desktop_worker
python gpu_worker_api.py --port 5000

# Test health endpoint
curl http://localhost:5000/api/health
```

### Via Cloudflare Tunnel
```bash
# On Desktop, install cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

# Create tunnel
cloudflared tunnel create aiox-gpu

# Route DNS
cloudflared tunnel route dns aiox-gpu gpu.example.com

# Start tunnel
cloudflared tunnel run aiox-gpu
```

---

## LLM-Router Integration (Gap 3 — Already Ready)

LLM-Router integration is already functional in Gap 3. No additional deployment steps needed. Verify with:

```bash
# 1. LLM-Router running
curl http://localhost:7778/health

# 2. Routing decisions working
curl -X POST http://localhost:7778/route \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?"}'

# 3. Cost accuracy
curl http://localhost:8000/api/cost/accuracy
```

---

## Support & Troubleshooting

### Common Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| **API won't start** | Port 8000 in use | `lsof -i :8000` to find process, or use different port |
| **Database connection fails** | `PGCONNREFUSED` | Check PostgreSQL is running, credentials correct |
| **Circuit breaker OPEN** | `circuit_state: "open"` | Check Ollama/LLM-Router health; wait 60s for recovery |
| **Cost logs not writing** | `/var/log/autoflow-router.jsonl` empty | Check permissions, disk space; verify cost logger module |
| **GPU worker offline** | Avatar generation fails | Check Cloudflare Tunnel; verify GPU worker running on Desktop |
| **High latency** | API responses >1s | Check CPU/memory usage; scale workers if needed |

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
sudo systemctl restart autoflow-api

# View detailed logs
journalctl -u autoflow-api -f --lines=100
```

### Check Dependencies

```bash
# Verify all services running
systemctl is-active postgresql
systemctl is-active redis-server
systemctl is-active autoflow-api
systemctl is-active autoflow-rq-worker

# If any inactive, restart
sudo systemctl restart postgresql
sudo systemctl restart redis-server
sudo systemctl restart autoflow-api
```

---

## Post-Deployment Sign-Off

### Deployment Checklist (Complete After Deployment)

- [ ] All services started successfully
- [ ] Health checks passing (200 OK)
- [ ] Cost logs writing to file
- [ ] Circuit breaker healthy (CLOSED)
- [ ] No critical errors in logs (first hour)
- [ ] Database migrations applied
- [ ] Monitoring active (Prometheus scraping)
- [ ] Alert rules configured
- [ ] Backup verified

### Stakeholder Sign-Off

Once all checks passing:
- [ ] Get approval from @pm (Product Manager)
- [ ] Get sign-off from @devops (DevOps Engineer)
- [ ] Notify users of upgrade
- [ ] Monitor for 24 hours before closing deployment

---

## Deployment Summary

**Deployment Time:** ~2-4 hours  
**Downtime:** <5 minutes (for service restarts)  
**Rollback Time:** ~30 minutes (revert to previous version)

**Success Criteria:**
- ✅ 291 tests passing (or equivalent)
- ✅ API responding to health checks
- ✅ Cost logging active
- ✅ Circuit breaker healthy
- ✅ No critical errors for 1 hour
- ✅ Budget enforcement working

---

**Deployment Guide Generated:** 2026-04-11  
**QA Approval:** ✅ APPROVED  
**Ready for Production Deployment**
