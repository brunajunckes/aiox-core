# Ollama Models — Current & Available

**Date:** 2026-04-10  
**Ollama Instance:** http://ollama.ampcast.site (port 80)

---

## ✅ Currently Deployed (1 Model)

```
qwen2.5:7b          4.7GB    Q4_K_M   7.6B params    ✓ ACTIVE
```

**Task Types:**
- JSON/YAML formatting
- Boilerplate code generation
- Markdown documentation
- Commit messages
- Text formatting
- Story updates
- Test boilerplate

**Performance:**
- Latency: ~300ms
- Quality: 7/10
- Cost: FREE

---

## 🔵 Optional Models (Not Currently Deployed)

These models could be added to Ollama if needed:

### Standard Reasoning
```
gemma:4b             2.5GB    Q4_0     3.5B params
gemma2:9b            6.0GB    Q4_K_M   8.9B params
mistral:7b           4.4GB    Q4_K_M   7.3B params
llama2:7b            3.8GB    Q4_K_M   7.0B params
```

**Recommended:** `gemma:4b` for research, analysis, code generation
- Quality: 8/10
- Latency: ~400ms
- Cost: FREE (Ollama)

### Large Models
```
llama2:13b           7.4GB    Q4_K_M   13B params
qwen:14b             8.9GB    Q4_K_M   14B params
mistral:large        13GB     Q4_K_M   34B params
```

---

## 📊 Current Routing Strategy

| Task Tier | Current | Fallback |
|-----------|---------|----------|
| SIMPLE (0-3) | qwen2.5:7b | → claude_opus |
| STANDARD (4-8) | claude_opus | (none) |
| COMPLEX (9-15) | claude_opus | (none) |

**Cost Impact:**
- If only using qwen2.5: ~90% cost reduction
- Current setup: Simple tasks = FREE, Standard/Complex = $0.003/1K

---

## 🚀 How to Add Models

To add `gemma:4b` to the running Ollama:

```bash
# SSH into VPS where Ollama is running
curl -X POST http://ollama.ampcast.site/api/pull \
  -d '{"name":"gemma:4b"}'

# Verify it's loaded
curl http://ollama.ampcast.site/api/tags
```

Then update config:
1. Edit `/root/autoflow/autoflow/core/ollama_enforce.py` MODELS dict
2. Add to `llm_config.yaml` models section
3. Update `select_model()` to route STANDARD tasks to gemma instead of Opus
4. Re-run tests

---

## 📝 Configuration Files Updated

✅ `/root/autoflow/autoflow/core/config.py`  
✅ `/root/autoflow/autoflow/core/ollama_enforce.py`  
✅ `/root/autoflow/autoflow/core/llm_config.yaml`  
✅ `/root/autoflow/test_ollama_enforce.py`  

All files now correctly point to `http://ollama.ampcast.site` (port 80) with only qwen2.5:7b configured.

---

**Next Step:** If more models are deployed on Ollama, update the MODELS dict and re-run tests.
