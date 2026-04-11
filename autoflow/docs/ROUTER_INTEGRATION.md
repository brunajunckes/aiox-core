# LLM-Router Integration — Cost-Optimized Complexity-Based Routing

**Story 5.5: LLM-Router Integration — Cost Optimization**

## Overview

AutoFlow implements intelligent LLM routing with complexity-driven provider selection, robust cost tracking, and circuit breaker protection. This document describes the architecture, configuration, and usage.

## Architecture

### High-Level Flow

```
Request with Prompt + Context
    ↓
LLM-Router-AIOX /route Endpoint (complexity analysis)
    ↓
Routing Decision (model, complexity_score, estimated_cost)
    ↓
Provider Selection (Ollama for simple, Claude for complex)
    ↓
Execution with Fallback (try preferred, then alternatives)
    ↓
Cost Logging (PostgreSQL + file fallback)
    ↓
Circuit Breaker Protection (if router fails repeatedly)
```

### Components

#### 1. Router (`autoflow/core/router.py`)

**Main Entry Point:**
```python
result = call_llm_sync(
    prompt="user prompt",
    system="system message",
    context={"workflow_type": "research", "request_id": "req_123"}  # optional
)
```

**Routing Decision Flow:**
1. Call `_fetch_routing_decision(prompt, context)` → LLM-Router `/route` endpoint
2. Parse response: `{ model, complexity_score, complexity_level, estimated_cost, reason }`
3. On LLM-Router failure: circuit breaker activates, default to Ollama (cheap)
4. Execute preferred provider with fallback chain

**Circuit Breaker:**
- **CLOSED**: Normal operation, requests flow to LLM-Router
- **OPEN**: Router failed 3+ times, bypass for 5 minutes
- **HALF**: After 5min cooldown, allow one probe request to test recovery
- **Reset**: Success on probe → CLOSED

#### 2. Cost Logger (`autoflow/core/cost_logger.py`)

**Structured Event Logging:**
```python
cost_logger.log_llm_call(
    status="success",
    provider="ollama",
    model="qwen2.5:7b",
    complexity_score=5,
    complexity_level="simple",
    estimated_cost_usd=0.0,
    actual_cost_usd=0.0,
    latency_ms=850,
    routing_reason="simple-task-ollama"
)
```

**Storage:**
- Primary: PostgreSQL `autoflow_cost_events` table
- Fallback: JSONL file `/var/log/autoflow-cost.jsonl`

**Schema:**
```sql
CREATE TABLE autoflow_cost_events (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    service VARCHAR(50) NOT NULL,
    event_id VARCHAR(32) NOT NULL,
    
    -- Request context
    workflow_type VARCHAR(100),
    request_id VARCHAR(100),
    
    -- Event type
    type VARCHAR(50) NOT NULL,      -- llm_call, routing_decision, circuit_breaker_event
    status VARCHAR(20) NOT NULL,    -- success, error, timeout
    routing_reason VARCHAR(200),
    
    -- Provider & model
    provider VARCHAR(50),           -- ollama, claude
    model VARCHAR(100),
    preferred_provider VARCHAR(50),
    fallback_used BOOLEAN DEFAULT FALSE,
    
    -- Complexity
    complexity_score INT,           -- 1-15
    complexity_level VARCHAR(50),   -- simple, standard, complex
    
    -- Cost (USD)
    estimated_cost_usd DECIMAL(10, 6),
    actual_cost_usd DECIMAL(10, 6),
    
    -- Tokens
    input_tokens INT,
    output_tokens INT,
    prompt_chars INT,
    response_chars INT,
    
    -- Performance
    latency_ms INT,                 -- provider latency
    total_ms INT,                   -- total request time
    
    -- Circuit breaker
    circuit_state VARCHAR(20),      -- closed, open, half_open
    
    -- Error
    error TEXT,
    
    -- Metadata
    metadata JSONB,
    
    INDEX (timestamp, service),
    INDEX (workflow_type, timestamp),
    INDEX (provider, timestamp),
    INDEX (complexity_level, timestamp)
);
```

## Configuration

### Environment Variables

```bash
# LLM-Router endpoint
LLM_ROUTER_URL=http://localhost:3000

# Ollama
OLLAMA_URL=http://ollama.ampcast.site
OLLAMA_MODEL=qwen2.5:7b

# Claude (optional fallback)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# Database (cost logging)
AUTOFLOW_DB_URL=postgresql://user:pass@host/db

# Cost logging
AUTOFLOW_COST_LOG=/var/log/autoflow-cost.jsonl

# Circuit breaker
AUTOFLOW_ROUTER_CB_THRESHOLD=3          # failures before open
AUTOFLOW_ROUTER_CB_RESET=60             # seconds to wait before half-open
```

## Usage Examples

### Simple Request (Auto-Routing)

```python
from autoflow.core.router import call_llm_sync

response = call_llm_sync(
    prompt="What is Python?",
    system="You are a helpful assistant."
)
# Router decides: complexity=3 (simple) → Ollama ($0)
```

### Complex Request (Auto-Routing)

```python
response = call_llm_sync(
    prompt="Design a distributed system for real-time ML inference with...",
    system="You are a senior architect.",
    context={"workflow_type": "architecture"}
)
# Router decides: complexity=14 (complex) → Claude ($0.015)
```

### Explicit Model Override (Bypass Router)

```python
response = call_llm_sync(
    prompt="...",
    model="qwen2.5:7b"  # Explicitly use this model
)
# Router is NOT called, goes straight to Ollama
```

### Cost Analysis

```python
from autoflow.core import cost_logger

# Get last 7 days of costs
summary = cost_logger.get_cost_summary(days=7)
print(f"Total cost: ${summary['total_cost_usd']}")
print(f"By model: {summary['by_model']}")
print(f"By provider: {summary['by_provider']}")
```

## Routing Decision Criteria

### Complexity Scoring (1-15)

LLM-Router analyzes:
1. **Prompt length** — longer = more complex
2. **Required knowledge** — domain-specific vocabulary
3. **Task type** — analysis, coding, creative, etc.
4. **Reasoning depth** — multi-step reasoning required

### Decision Logic

| Score | Level | Provider | Est. Cost |
|-------|-------|----------|-----------|
| 1-4 | Simple | Ollama | $0.00 |
| 5-10 | Standard | Ollama | $0.00 |
| 11-13 | Complex | Claude | $0.01 |
| 14-15 | Expert | Claude | $0.02 |

### Cost Optimization

**Ollama (qwen2.5:7b)**
- Cost: $0.00 (local, no API)
- Speed: 5-10s (on GPU)
- Quality: Good for simple/medium tasks

**Claude (Haiku)**
- Cost: $0.00080 / 1K input tokens
- Speed: 1-3s (API)
- Quality: Excellent for complex reasoning

**Claude (Sonnet)**
- Cost: $0.003 / 1K input tokens
- Speed: 2-5s (API)
- Quality: Expert-level output

## Circuit Breaker Behavior

### Normal Operation (CLOSED)

```
Request → LLM-Router /route → Success ✓
         → log cost event
         → execute provider
         → return response
```

### Router Failure Detection (CLOSED → OPEN)

```
Request 1 → /route fails → log error (failures=1)
Request 2 → /route fails → log error (failures=2)
Request 3 → /route fails → log error (failures=3, THRESHOLD!)
            → Circuit breaker OPENS
            → Default to Ollama (cheap)
```

### Cooldown & Recovery (OPEN → HALF → CLOSED)

```
[Next 5 minutes: all requests bypass router, use Ollama]

After 5 minutes:
Request → LLM-Router /route → Probe request
                            → Success ✓ → CLOSED (resume routing)
                            → Failure ✗ → OPEN (stay broken)
```

## Cost Logging

### Event Types

**1. llm_call**
```json
{
  "type": "llm_call",
  "status": "success",
  "provider": "ollama",
  "model": "qwen2.5:7b",
  "complexity_score": 5,
  "estimated_cost_usd": 0.0,
  "actual_cost_usd": 0.0,
  "latency_ms": 850,
  "fallback_used": false
}
```

**2. routing_decision**
```json
{
  "type": "routing_decision",
  "status": "success",
  "complexity_score": 12,
  "complexity_level": "complex",
  "estimated_cost": 0.015,
  "reasoning": "complex-task-requires-claude"
}
```

**3. circuit_breaker_event**
```json
{
  "type": "circuit_breaker_event",
  "circuit_state": "open",
  "routing_reason": "threshold-exceeded",
  "metadata": {"failures": 3}
}
```

### Cost Aggregation

**By Provider (7 days):**
```python
summary = cost_logger.get_cost_summary(days=7)
# {
#   "by_provider": {
#     "ollama": 0.0,
#     "claude": 12.45
#   }
# }
```

**By Complexity Level:**
```python
summary = cost_logger.get_cost_summary(days=7)
# {
#   "by_complexity": {
#     "simple": 0.0,
#     "standard": 0.0,
#     "complex": 12.45
#   }
# }
```

## Testing

### Unit Tests

Run comprehensive test suite:
```bash
cd /root/autoflow
source .venv/bin/activate
pytest tests/test_router_v2_integration.py -v
```

**Coverage: 31 tests**
- AC1-2: Routing decision fetching and parsing
- AC4: Circuit breaker state transitions
- AC3, AC7: Cost logging and accuracy
- AC5-6: Fallback chain execution
- Integration: End-to-end flows
- Edge cases: Boundary conditions

### Test Results

```
31 passed in 2.31s
- 5 routing decision tests
- 6 circuit breaker tests
- 8 cost logging tests
- 5 fallback chain tests
- 3 integration tests
- 4 edge case tests
```

## Troubleshooting

### "LLM-Router unreachable"

**Symptom:** Circuit breaker opens, defaults to Ollama

**Cause:** LLM-Router service not running

**Solution:**
```bash
# Check LLM-Router status
curl -s http://localhost:3000/health

# If down, restart
docker compose up -d llm-router
```

### "All LLM providers failed"

**Symptom:** RuntimeError, all calls fail

**Cause:** Both Ollama and Claude unavailable

**Solution:**
```bash
# Check Ollama
curl -s http://ollama.ampcast.site/api/tags

# Check Claude API key
echo $ANTHROPIC_API_KEY

# Check connectivity
ping ollama.ampcast.site
```

### High costs despite simple tasks

**Symptom:** Complexity score unexpectedly high

**Cause:** LLM-Router miscalibrated

**Solution:**
```python
# Check routing decision reasoning
call_llm_sync(prompt, context={"request_id": "debug_123"})

# View logs
grep "routing_decision" /var/log/autoflow-cost.jsonl | tail -5
```

## Performance Characteristics

### Latency

| Step | Time |
|------|------|
| LLM-Router decision | 50-200ms |
| Ollama inference | 5-15s |
| Claude API call | 1-5s |
| Cost logging | <1ms |
| **Total (simple)** | **5-15s** |
| **Total (complex)** | **1-5s** |

### Cost

| Workflow Type | Provider | Avg Cost |
|---------------|----------|----------|
| Analysis | Ollama | $0.00 |
| Coding | Ollama/Claude | $0.001-0.015 |
| Research | Claude | $0.01-0.03 |
| Creative | Claude | $0.005-0.02 |

## References

- **Router Code:** `/root/autoflow/autoflow/core/router.py`
- **Cost Logger:** `/root/autoflow/autoflow/core/cost_logger.py`
- **Tests:** `/root/autoflow/tests/test_router_v2_integration.py`
- **Config:** `/root/autoflow/autoflow/core/config.py`
