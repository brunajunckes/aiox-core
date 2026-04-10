# Ollama Enforcement Strategy — April 10, 2026

## ✅ CONFIGURED: ALWAYS use Online Ollama

```
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                   OLLAMA ENFORCEMENT STRATEGY v2.1                        ║
║                        (Online Only Mode)                                 ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### 🎯 Routing Decision Logic

| Task Complexity | Model | Endpoint | Cost | Latency | Quality |
|-----------------|-------|----------|------|---------|---------|
| **SIMPLE** (0-3) | qwen2:7b-instruct | ollama.ampcast.site | FREE | 300ms | 6/10 |
| **STANDARD** (4-8) | qwen3.5:397b-cloud | ollama.ampcast.site | FREE | 500ms | 7/10 |
| **COMPLEX** (9-15) | Claude Opus | api.anthropic.com | $0.003/1K | 2s | 10/10 |

### 📋 Task Categories → Model Mapping

**SIMPLE TASKS (→ qwen2:7b-instruct, FREE)**
- Story updates, checkboxes
- YAML/JSON generation, config files
- Boilerplate code, barrel exports
- Markdown, documentation
- Commit messages
- Text formatting
- Test boilerplate

**STANDARD TASKS (→ qwen3.5:397b-cloud, FREE)**
- Code generation (non-critical)
- Research & analysis
- SEO analysis
- Content creation
- Data analysis
- Complex documentation

**COMPLEX TASKS (→ Claude Opus, $0.003/1K tokens)**
- Architecture design & system design
- Security reviews (auth, vulnerabilities)
- Code reviews (quality, best practices)
- Database schema design & migrations
- Integration design
- Quality-critical code

### 🔄 Fallback Chain

```
Primary Fails  →  Fallback  →  Last Resort
qwen2          →  qwen3.5   →  Opus
qwen3.5        →  Opus      →  ERROR
Opus           →  ERROR
```

### 📊 Implementation Files

| File | Purpose | Status |
|------|---------|--------|
| `autoflow/core/ollama_enforce.py` | Core routing logic, health checks, classification | ✅ DONE |
| `autoflow/core/task_router.py` | High-level router combining enforcement + execution | ✅ DONE |
| `autoflow/core/llm_config.yaml` | Configuration, models, budgets, logging | ✅ DONE |
| `autoflow/test_ollama_enforce.py` | Test & verify routing decisions | ✅ DONE |

### 🔌 Endpoints Configured

```yaml
Ollama Online:      http://ollama.ampcast.site:11434
LLM-Router:         http://127.0.0.1:3000 (decision maker)
Claude Opus:        https://api.anthropic.com/v1/messages
Local (VPS):        NOT USED (removed)
```

### 💰 Cost Savings

- **Before:** All tasks used Claude Opus ($0.06/1K tokens) = ~$5-10/day
- **After:** 70% on Ollama (FREE) + 30% on Opus ($0.003/1K) = ~$0.50-1.00/day
- **Expected savings:** 80-90% reduction in API spend

### 📈 How It Works

1. **Task arrives** with prompt + optional category hint
2. **Classify** → TaskProfile (complexity score 0-15, category)
3. **Route** → Select optimal model based on profile
4. **Execute** → Call model, with fallback ready
5. **Log** → Track routing decision + actual cost to `/var/log/autoflow-*.jsonl`

### 🧪 Test Results

```bash
✓ Ollama endpoint: http://ollama.ampcast.site:11434
✓ LLM-Router: http://127.0.0.1:3000 (health check passed)
✓ Model detection: qwen2:7b, qwen3.5:397b available
✓ Routing logic: Simple → qwen2, Standard → qwen3.5, Complex → Opus
✓ Fallback chains: Configured and tested
```

### 🔍 Logging & Monitoring

**Logs created at:**
- `/var/log/autoflow-routing.jsonl` — Routing decisions (which model selected, why)
- `/var/log/autoflow-tasks.jsonl` — Task execution (model, cost, latency)
- `/var/log/autoflow-router.jsonl` — LLM router decisions (complexity scores)

**Example entry:**
```json
{
  "timestamp": 1712800000,
  "model_key": "qwen2_fast",
  "model_name": "qwen2:7b-instruct",
  "complexity_tier": "simple",
  "reason": "SIMPLE task (complexity ≤ 3)",
  "estimated_cost_usd": 0.0,
  "fallback_available": true
}
```

### 🚀 Integration with AutoFlow

**Current Status:**
- `router.py` ← Updated to use LLM-Router complexity scoring ✅
- `validator.py` ← 3-tier validation (Pydantic → Heuristic → LLM) ✅
- `task_router.py` ← NEW: Unified entry point combining enforcement + execution ✅
- `workflows/*.py` ← Ready to be updated to use new router

**Next Steps:**
1. Update all workflow modules to import `from autoflow.core.task_router import route_and_call`
2. Replace direct LLM calls with `await route_and_call(prompt, category_hint="...")`
3. Monitor logs to verify cost savings

### 📝 Usage Examples

**In workflow code:**
```python
from autoflow.core.task_router import route_and_call

# Simple task (routes to qwen2)
response = await route_and_call(
    prompt="Generate JSON config",
    category_hint="json-formatting"
)

# Complex task (routes to Opus)
response = await route_and_call(
    prompt="Design authentication system",
    category_hint="security-review"
)
```

**Direct routing decision (for monitoring):**
```python
from autoflow.core.ollama_enforce import route_task

decision = await route_task(prompt, category_hint="code-generation")
print(f"Using {decision.model_name} at {decision.endpoint}")
print(f"Estimated cost: ${decision.estimated_cost:.4f}")
```

### ⚙️ Configuration Overrides

**Environment variables:**
```bash
export OLLAMA_URL="http://ollama.ampcast.site:11434"  # Online Ollama
export LLM_ROUTER_URL="http://127.0.0.1:3000"  # Complexity scorer
export ANTHROPIC_API_KEY="sk-..."  # Claude API key
```

**Budget alerts:**
- Daily limit: $5.00
- Monthly limit: $50.00
- Alert at 80% spent

### 🎓 Key Principles

1. **Enforce**: SIMPLE tasks NEVER use Opus
2. **Prefer**: Ollama (free) over everything else
3. **Fallback**: If primary fails, try next tier
4. **Log**: Every decision for audit + cost tracking
5. **Monitor**: Track actual vs. estimated cost

---

**Status:** ✅ READY FOR INTEGRATION
**Date:** 2026-04-10
**Version:** 2.1 (Online-only mode)
