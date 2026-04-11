# Cost-Based Optimization Guide — Epic 3.1

**Last Updated:** 2026-04-11  
**Status:** Implementation Complete

---

## Overview

This guide documents the cost-based routing system implemented in Epic 3.1, which integrates LLM-Router with comprehensive cost logging, metrics collection, and CLI analysis tools.

### Key Components

| Component | Purpose | File |
|-----------|---------|------|
| **cost_logger.py** | Structured cost tracking to PostgreSQL/JSONL | `autoflow/core/cost_logger.py` |
| **metrics.py** | In-memory metrics collection (latency, cost, success rate) | `autoflow/core/metrics.py` |
| **router.py** | Enhanced LLM router with cost logging + metrics | `autoflow/core/router.py` |
| **cli.py** | CLI commands for cost analysis | `autoflow/cli.py` |

---

## Cost Tracking Architecture

### Data Flow

```
LLM Call Execution
  ↓
Router decides: Ollama or Claude (complexity-based)
  ↓
Provider executes (ollama | claude)
  ↓
Log cost event:
  - Timestamp (ISO8601 UTC)
  - Provider, model, complexity_score, complexity_level
  - Estimated cost (from LLM-Router)
  - Actual cost (calculated post-call)
  - Latency (ms), tokens, circuit state
  ↓
Store to:
  - PostgreSQL (primary)
  - JSONL file (fallback)
  ↓
Collect metrics:
  - Latency histogram (per provider)
  - Cost totals (per complexity level)
  - Success rates (per provider)
  - Circuit state changes
```

### Cost Event Structure

```python
CostEvent {
  # Identifiers
  timestamp: str              # ISO8601 UTC
  event_id: str              # Unique ID
  
  # Context
  workflow_type: str          # research, seo, video, etc.
  request_id: str            # Trace ID
  
  # Routing decision
  type: str                  # "llm_call", "routing_decision"
  status: str                # success, error, timeout
  
  # Provider info
  provider: str              # ollama, claude
  model: str                 # qwen2.5:7b, claude-3-haiku
  preferred_provider: str    # Provider chosen by router
  fallback_used: bool        # True if provider != preferred
  
  # Complexity metrics
  complexity_score: int      # 1-15
  complexity_level: str      # simple, standard, complex
  
  # Cost tracking
  estimated_cost_usd: float  # From LLM-Router
  actual_cost_usd: float     # Calculated post-call
  
  # Performance
  latency_ms: int            # Provider call latency
  total_ms: int              # Full request latency
  
  # Tokens (for cost accuracy)
  input_tokens: int
  output_tokens: int
  prompt_chars: int
  response_chars: int
  
  # Resilience
  circuit_state: str         # closed, open, half_open
  
  # Metadata
  error: str                 # Error message if status=error
  routing_reason: str        # Why routing decision was made
}
```

---

## Cost Calculation

### Provider Costs

#### Ollama (Local)
- **Cost:** $0.00 per request (no API charges)
- **Typical Models:**
  - `qwen2.5:3b` — Fast, efficient
  - `qwen2.5:7b` — Balanced quality/speed
  - `gemma2:latest` — Good quality

#### Claude Haiku (Budget)
- **Cost:** $0.00080 per 1K input tokens, $0.0024 per 1K output tokens
- **Use Case:** High-volume, latency-tolerant tasks
- **Example:** 1000 input + 500 output = $0.0008 + $0.0012 = **$0.002**

#### Claude 3.5 Sonnet (Premium)
- **Cost:** $0.003 per 1K input tokens, $0.015 per 1K output tokens
- **Use Case:** Complex reasoning, high-quality output
- **Example:** 1000 input + 500 output = $0.003 + $0.0075 = **$0.0105**

### Routing Logic (LLM-Router)

The router analyzes request complexity (1-15 scale):

| Score | Level | Recommended Provider | Rationale |
|-------|-------|----------------------|-----------|
| 1-5 | **simple** | Ollama | Fast + free, sufficient for basic tasks |
| 6-10 | **standard** | Ollama first, Claude if needed | Most requests here; start cheap |
| 11-15 | **complex** | Claude | Complex reasoning needs better model |

**Example Complexity Factors:**
- Multi-step reasoning → +3 points
- Code generation → +2 points
- Creative writing → +4 points
- Domain expertise required → +5 points
- Multilingual → +2 points

---

## CLI Usage

### Cost Summary

```bash
# Last 24 hours
python -m autoflow.cli cost-summary

# Last 7 days
python -m autoflow.cli cost-summary --days=7

# Specific workflow
python -m autoflow.cli cost-summary --workflow=research
```

**Output Example:**
```
────────────────────────────────────────────────────────────────
AutoFlow Cost Summary — Last 1 day(s)
────────────────────────────────────────────────────────────────

Total Requests: 250
Total Cost:     $0.1250
Avg Per Request: $0.0005

────────────────────────────────────────────────────────────────
Breakdown by Provider:
────────────────────────────────────────────────────────────────
  ollama       $0.0000 (  0.00%)
  claude       $0.1250 (100.00%)

────────────────────────────────────────────────────────────────
Breakdown by Model:
────────────────────────────────────────────────────────────────
  claude-3-haiku             $0.1250 (100.00%)

────────────────────────────────────────────────────────────────
Breakdown by Complexity:
────────────────────────────────────────────────────────────────
  simple       $0.0000 (  0.00%)
  standard     $0.0750 ( 60.00%)
  complex      $0.0500 ( 40.00%)
```

### Router Health

```bash
python -m autoflow.cli router-health
```

**Output:**
```
────────────────────────────────────────────────────────────────
AutoFlow Router Health
────────────────────────────────────────────────────────────────

LLM Router URL:        http://localhost:3000
Ollama URL:            http://localhost:11434
Ollama Default Model:  qwen2.5:7b
Claude Configured:     True
Cost Log Path:         /var/log/autoflow-cost.jsonl
Circuit Breaker State: closed

────────────────────────────────────────────────────────────────
```

### Cost Trend

```bash
python -m autoflow.cli cost-trend --days=30
```

### Cost by Model

```bash
python -m autoflow.cli cost-by-model --days=7
```

### Circuit Status

```bash
python -m autoflow.cli circuit-status
```

---

## Configuration

### Environment Variables

```bash
# Cost logging
AUTOFLOW_COST_LOG=/var/log/autoflow-cost.jsonl
AUTOFLOW_DB_URL=postgresql://user:pass@localhost:5432/autoflow

# Circuit breaker
AUTOFLOW_ROUTER_CB_THRESHOLD=3        # Failures to open circuit
AUTOFLOW_ROUTER_CB_RESET=60            # Seconds until half-open probe

# LLM Router
AUTOFLOW_LLM_ROUTER_URL=http://localhost:3000
AUTOFLOW_OLLAMA_URL=http://localhost:11434
AUTOFLOW_OLLAMA_MODEL=qwen2.5:7b
ANTHROPIC_API_KEY=...                 # Required for Claude
```

### PostgreSQL Schema

The cost logger creates this table:

```sql
CREATE TABLE autoflow_cost_events (
  timestamp TIMESTAMP NOT NULL,
  service VARCHAR(50),
  event_id VARCHAR(16) PRIMARY KEY,
  workflow_type VARCHAR(50),
  request_id VARCHAR(50),
  
  type VARCHAR(50),               -- llm_call, routing_decision
  status VARCHAR(20),             -- success, error, timeout
  routing_reason VARCHAR(100),
  
  provider VARCHAR(20),           -- ollama, claude
  model VARCHAR(50),
  preferred_provider VARCHAR(20),
  fallback_used BOOLEAN,
  
  complexity_score INT,           -- 1-15
  complexity_level VARCHAR(20),   -- simple, standard, complex
  
  estimated_cost_usd NUMERIC(10,6),
  actual_cost_usd NUMERIC(10,6),
  
  input_tokens INT,
  output_tokens INT,
  prompt_chars INT,
  response_chars INT,
  
  latency_ms INT,
  total_ms INT,
  circuit_state VARCHAR(20),      -- closed, open, half_open
  
  error TEXT,
  metadata JSONB,
  
  CREATED_AT TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_timestamp ON autoflow_cost_events(timestamp);
CREATE INDEX idx_provider ON autoflow_cost_events(provider);
CREATE INDEX idx_complexity_level ON autoflow_cost_events(complexity_level);
CREATE INDEX idx_workflow_type ON autoflow_cost_events(workflow_type);
```

---

## Optimization Strategies

### Strategy 1: Route by Complexity

Use LLM-Router to automatically route based on request complexity:

| Complexity | Provider | Estimated Cost | Quality |
|-----------|----------|------------------|---------|
| Simple (1-5) | Ollama | $0.00 | Adequate |
| Standard (6-10) | Ollama → Claude | $0.00-0.003 | Good |
| Complex (11-15) | Claude | $0.003+ | Excellent |

**Impact:** Save 70-90% on simple/standard requests by using Ollama.

### Strategy 2: Circuit Breaker Protection

Circuit breaker automatically isolates failing services:

```
Normal (CLOSED)
  ↓
3 consecutive failures
  ↓
OPEN (fail fast, bypass LLM-Router)
  ↓
60 second cooldown
  ↓
HALF-OPEN (probe with next request)
  ↓
Success → CLOSED (resume normal)
Failure → OPEN (continue isolation)
```

**Benefit:** Reduces latency during outages, prevents cascading failures.

### Strategy 3: Cost Alerts

Monitor cost trends and set alerts:

```python
summary = cost_logger.get_cost_summary(days=1)
daily_cost = summary["total_cost_usd"]

if daily_cost > 1.0:  # $1/day threshold
    send_alert(f"Daily cost: ${daily_cost:.2f}")
```

### Strategy 4: Fallback Chain Optimization

Router automatically tries fallback providers:

```
Preferred (from LLM-Router)
  ↓
Fallback 1 (next best option)
  ↓
Fallback 2 (last resort)
  ↓
All failed → Raise error
```

**Example:**
- Preferred: Claude (best quality for complex task)
- Fallback 1: Ollama (fallback, free)
- If Claude unavailable, use Ollama automatically

---

## Metrics and Dashboards

### Available Metrics

#### Latency Metrics (per provider)
```json
{
  "provider": "ollama",
  "min_ms": 450,
  "max_ms": 2100,
  "avg_ms": 850,
  "samples": 1234
}
```

#### Cost Metrics (per complexity level)
```json
{
  "complexity_level": "simple",
  "total_cost_usd": 0.0,
  "request_count": 500,
  "avg_cost_per_request": 0.0
}
```

#### Success Rate Metrics (per provider)
```json
{
  "provider": "claude",
  "successes": 450,
  "failures": 2,
  "success_rate_percent": 99.56,
  "total_requests": 452
}
```

### Programmatic Access

```python
from autoflow.core import metrics

# Get full summary
summary = metrics.get_summary()
print(f"Latency: {summary['latency_metrics']}")
print(f"Cost: {summary['cost_metrics']}")
print(f"Success: {summary['success_rate_metrics']}")

# Get specific metrics
latency = metrics.get_collector().get_latency_summary()
cost = metrics.get_collector().get_cost_summary()
success = metrics.get_collector().get_success_rate_summary()
```

---

## Testing and Validation

### Unit Tests

```bash
pytest tests/test_epic3_1_integration.py -v
```

**Coverage:**
- Cost logger integration (5 tests)
- Metrics collection (7 tests)
- Circuit breaker (2 tests)
- CLI commands (5 tests)
- Cost accuracy (4 tests)
- Full integration (3 tests)

**All 26 tests passing** ✓

### Acceptance Criteria Verification

| AC | Test | Status |
|----|------|--------|
| AC1 | `test_log_event_creates_cost_event` | ✓ |
| AC2 | `test_cost_event_dataclass_structure` | ✓ |
| AC3 | `test_cost_event_to_jsonl` | ✓ |
| AC4 | `test_circuit_breaker_records_failure_threshold` | ✓ |
| AC5 | `test_cost_summary_with_data` | ✓ |
| AC6 | `test_router_health_cmd` | ✓ |
| AC7 | `test_cost_accuracy_tolerance` | ✓ |
| AC8 | `test_full_epic_workflow` | ✓ |

---

## Troubleshooting

### Circuit Breaker is OPEN

**Symptoms:** All requests route to Ollama, circuit-status shows "OPEN"

**Cause:** LLM-Router has failed 3+ consecutive times

**Solution:**
1. Check LLM-Router health: `curl http://localhost:3000/health`
2. Check network connectivity to router
3. Wait 60 seconds for cooldown (or restart router)
4. Requests will automatically recover when LLM-Router is back online

### No Cost Data in Database

**Symptoms:** `get_cost_summary()` returns empty dict

**Cause:** PostgreSQL not configured or not running

**Solution:**
1. Check `AUTOFLOW_DB_URL` environment variable
2. Verify PostgreSQL connection: `psql $AUTOFLOW_DB_URL -c "SELECT 1"`
3. Create cost events table (schema provided above)
4. Cost logger falls back to JSONL file at `/var/log/autoflow-cost.jsonl`

### High Latency on Ollama

**Symptoms:** `avg_ms` > 2000 for Ollama calls

**Cause:** Model size too large or system overload

**Solution:**
1. Switch to faster model: `AUTOFLOW_OLLAMA_MODEL=qwen2.5:3b`
2. Check system resources: `top`, `nvidia-smi`
3. Reduce concurrent requests
4. Consider running on GPU with larger model: `qwen2.5:7b`

---

## Migration Guide

### From Previous Router (without cost logging)

No breaking changes. Existing code continues to work:

```python
from autoflow.core import router

# Same API — just enhanced with logging
response = router.call_llm_sync(
    prompt="Your prompt",
    system="System prompt",
    temperature=0.7,
    max_tokens=4096,
)
```

**Changes are transparent:**
- Cost events logged to PostgreSQL (if configured)
- Metrics collected automatically
- CLI commands available for analysis

### Upgrading Cost Logging

If migrating from file-only logging to PostgreSQL:

```bash
# 1. Set database URL
export AUTOFLOW_DB_URL=postgresql://user:pass@localhost:5432/autoflow

# 2. Create table (SQL schema above)
psql $AUTOFLOW_DB_URL < schema.sql

# 3. Optionally migrate historical data from JSONL
python scripts/migrate_jsonl_to_postgres.py /var/log/autoflow-cost.jsonl
```

---

## Future Enhancements

### Phase 4 Roadmap

- [ ] Cost forecasting (predict monthly spend)
- [ ] Anomaly detection (alert on unusual costs)
- [ ] Model recommendation engine (suggest cheapest model for task)
- [ ] Budget enforcement (hard limits per tenant/workflow)
- [ ] Cost allocation (charge-back by department)
- [ ] Prometheus metrics export (Grafana integration)

---

## References

- **Story 5.5:** LLM-Router Integration (Phase 2) — architecture foundation
- **Epic 3.1:** LLM-Router Alignment Implementation (Phase 3) — this document
- **Cost Logger Module:** `autoflow/core/cost_logger.py` — detailed implementation
- **Metrics Module:** `autoflow/core/metrics.py` — metrics collection
- **Router Module:** `autoflow/core/router.py` — enhanced with cost logging

---

**Questions?** Check `autoflow/tests/test_epic3_1_integration.py` for usage examples.
