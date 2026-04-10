# 📋 AutoFlow — Próximos Passos (Roadmap)

**Data:** 2026-04-10  
**Status:** Implementação Ollama + Task Router COMPLETA  
**Próxima Fase:** Validação e Deploy

---

## 🎯 Prioridade 1: Validação End-to-End (HOJE)

### ✅ Passo 1.1: Testar um workflow real
```bash
# Test SEO workflow via Python
.venv/bin/python -c "
import asyncio
from autoflow.workflows.seo import run_seo
result = run_seo('Python programming tutorials')
print(f'Status: {result[\"status\"]}')
print(f'Keywords: {result[\"keywords\"][:3]}')
"
```

**Esperado:** 
- ✓ Workflow roda sem erros
- ✓ Retorna keywords
- ✓ Logs em `/var/log/autoflow-tasks.jsonl`

**Tempo estimado:** 5 min

---

### ✅ Passo 1.2: Verificar logs de roteamento
```bash
# Ver logs de routing
tail -f /var/log/autoflow-tasks.jsonl &

# Ver logs de enforcement
tail -f /var/log/autoflow-routing.jsonl &

# Verificar que Ollama foi chamado (não API)
grep -c "qwen2_5_fast" /var/log/autoflow-*.jsonl
```

**Esperado:**
- ✓ Logs sendo criados
- ✓ Todos os calls para qwen2.5:7b
- ✓ Cost = $0.00

**Tempo estimado:** 2 min

---

### ✅ Passo 1.3: Testar via API
```bash
# Start server
.venv/bin/python -m autoflow.api.server &

# Test endpoint
curl -X POST http://localhost:8080/workflow/research \
  -H "Content-Type: application/json" \
  -d '{"topic":"Machine learning trends"}'

# Check status
curl http://localhost:8080/workflow/{job_id}
```

**Esperado:**
- ✓ API responde em 200ms
- ✓ Workflow inicia em background
- ✓ Status updates corretamente

**Tempo estimado:** 5 min

---

## 🎯 Prioridade 2: Qualidade de Outputs (AMANHÃ)

### ✅ Passo 2.1: Adicionar validação de outputs
**Arquivo:** `/root/autoflow/autoflow/core/validator.py`

```python
# Adicionar validação para cada workflow type:
- seo: validate_seo_output(output)
  ├─ Check: keywords list present
  ├─ Check: title (10-70 chars)
  ├─ Check: body (300+ chars)
  
- research: validate_research_output(output)
  ├─ Check: title present
  ├─ Check: findings (list, 3+ items)
  ├─ Check: summary (100+ chars)
  
- video: validate_video_output(output)
  ├─ Check: script present (50+ chars)
  ├─ Check: duration (int, 15-600)
  ├─ Check: scenes (list, 1+ items)
```

**Tempo estimado:** 1 hora

---

### ✅ Passo 2.2: Implementar retry automático no task_router
**Arquivo:** `/root/autoflow/autoflow/core/task_router.py`

```python
# Se output validation falhar:
# 1. Log o erro
# 2. Retry com temperatura aumentada (0.7 → 0.9)
# 3. Max 2 retries por task
# 4. Se falhar 3x, raise com erro claro
```

**Tempo estimado:** 1 hora

---

### ✅ Passo 2.3: Criar test suite para outputs
```bash
# /root/autoflow/test_output_quality.py
# Rodar 10 workflows de cada tipo
# Validar outputs
# Report: pass rate, failures, avg quality score
```

**Tempo estimado:** 2 horas

---

## 🎯 Prioridade 3: Observabilidade (SEMANA 1)

### ✅ Passo 3.1: Dashboard de custo
**Criar:** `/root/autoflow/autoflow/api/dashboard.py`

```
Métricas a mostrar:
├─ Workflows executados (total, hoje, semana, mês)
├─ Custo acumulado (sempre $0.00 ✓)
├─ Tempo médio por workflow
├─ Taxa de sucesso (%)
├─ Modelos usados (breakdown)
└─ Últimos 10 workflows
```

**API Endpoint:**
```
GET /api/metrics/summary → {total_runs, total_cost, success_rate, ...}
```

**Tempo estimado:** 2 horas

---

### ✅ Passo 3.2: Alertas de falha
```python
# Se workflow falha 3x consecutivas:
# 1. Log com ERROR level
# 2. Email notification (opcional)
# 3. Marcar como "needs review" no dashboard
```

**Tempo estimado:** 1 hora

---

### ✅ Passo 3.3: Prometheus metrics
```python
# Expor métricas Prometheus:
# - autoflow_workflows_total (counter)
# - autoflow_workflow_duration_seconds (histogram)
# - autoflow_ollama_calls_total (counter)
# - autoflow_cost_usd_total (gauge, always 0)
```

**Tempo estimado:** 1.5 horas

---

## 🎯 Prioridade 4: Escalabilidade (SEMANA 2)

### ✅ Passo 4.1: Adicionar mais modelos ao Ollama
```bash
# Puxar modelos adicionais:
curl -X POST http://ollama.ampcast.site/api/pull \
  -d '{"name":"gemma2:9b"}'  # Better reasoning

curl -X POST http://ollama.ampcast.site/api/pull \
  -d '{"name":"mistral:7b"}'  # Code generation
```

**Depois atualizar task_router para usar:**
- qwen2.5:7b → SIMPLE tasks
- mistral:7b → CODE_GENERATION tasks  
- gemma2:9b → RESEARCH tasks

**Tempo estimado:** 2 horas

---

### ✅ Passo 4.2: Implementar model selection by task
```python
# Atualizar select_model() em ollama_enforce.py:

def select_model(profile):
    if profile.category == TaskCategory.CODE_GENERATION:
        return "mistral_7b"  # Melhor para código
    elif profile.category == TaskCategory.RESEARCH:
        return "gemma2_9b"   # Melhor para reasoning
    else:
        return "qwen2_5_fast"  # Default
```

**Tempo estimado:** 1.5 horas

---

### ✅ Passo 4.3: Load balancing entre instâncias Ollama
```python
# Se tiver múltiplas instâncias Ollama:
# - Health check cada uma
# - Round-robin allocation
# - Fallback para próxima se fails
```

**Tempo estimado:** 3 horas

---

## 🎯 Prioridade 5: Production Hardening (SEMANA 2-3)

### ✅ Passo 5.1: Error handling robusto
```python
# Tratamentos específicos para:
# - Ollama timeout (> 60s)
# - Ollama 503 (queue full)
# - Invalid JSON response
# - Rate limiting
# - Network errors

# Cada erro → log + retry com backoff exponencial
```

**Tempo estimado:** 2 horas

---

### ✅ Passo 5.2: Circuit breaker para Ollama
```python
# Se Ollama fails 5x:
# 1. Abrir circuit por 60s
# 2. Fast-fail durante cooldown
# 3. Health check a cada 10s
# 4. Fechar quando healthy novamente
```

**Tempo estimado:** 1.5 horas

---

### ✅ Passo 5.3: Request/Response caching
```python
# Cache de respostas por hash do prompt:
# - TTL: 24 horas
# - Max size: 100MB
# - Storage: Redis ou arquivo local

# Reutilizar resposta se prompt = hash anterior
```

**Tempo estimado:** 2 horas

---

## 🎯 Prioridade 6: Deploy & Documentation (SEMANA 3)

### ✅ Passo 6.1: Docker setup
```dockerfile
# /root/autoflow/Dockerfile
# Base: python:3.12-slim
# Install: deps, Ollama client
# Expose: 8080 (API)
# CMD: uvicorn autoflow.api.server:app
```

**Build & test:**
```bash
docker build -t autoflow:latest .
docker run -p 8080:8080 autoflow:latest
```

**Tempo estimado:** 1.5 horas

---

### ✅ Passo 6.2: Kubernetes deployment
```yaml
# /root/autoflow/k8s/deployment.yaml
# - Replicas: 3
# - Readiness: GET /health
# - Resource limits: 2GB RAM, 1 CPU
# - Env: OLLAMA_URL, etc
```

**Tempo estimado:** 2 horas

---

### ✅ Passo 6.3: Documentation completa
```
/root/autoflow/docs/
├─ README.md (overview + quick start)
├─ API.md (endpoints, examples)
├─ WORKFLOWS.md (como rodar cada tipo)
├─ DEPLOYMENT.md (Docker, K8s)
├─ MONITORING.md (logs, metrics)
└─ TROUBLESHOOTING.md (erros comuns)
```

**Tempo estimado:** 3 horas

---

## 📊 Timeline Total

| Semana | Prioridade | Tarefas | Horas |
|--------|-----------|---------|-------|
| Hoje | 1 | Validação E2E | 0.5 |
| Amanhã | 2 | Qualidade outputs | 4 |
| Semana 1 | 3 | Observabilidade | 5 |
| Semana 2 | 4,5 | Escalabilidade + hardening | 12 |
| Semana 3 | 6 | Deploy + docs | 6 |
| **TOTAL** | | | **27.5 horas** |

---

## ✅ Checklist Atual (Completo)

- [x] Ollama enforcement strategy
- [x] Task router integrado
- [x] 4 workflows atualizados
- [x] Testes passando (9/9)
- [x] Configuração OAuth-only (sem API key)
- [x] API endpoints existentes
- [ ] Validação de outputs
- [ ] Retry automático
- [ ] Dashboard de custo
- [ ] Alertas de falha
- [ ] Múltiplos modelos Ollama
- [ ] Load balancing
- [ ] Circuit breaker
- [ ] Caching
- [ ] Docker setup
- [ ] K8s deployment
- [ ] Documentação completa

---

## 🚀 Próximo Passo Imediato (AGORA)

**EXECUTE ISTO:**

```bash
# 1. Teste um workflow real
cd /root/autoflow
.venv/bin/python -c "from autoflow.workflows.research import run_research; print(run_research('AI trends'))"

# 2. Inicie o servidor
.venv/bin/python -m autoflow.api.server &

# 3. Teste a API
curl -X POST http://localhost:8080/workflow/research \
  -H "Content-Type: application/json" \
  -d '{"topic":"Machine Learning"}'

# 4. Monitore os logs
tail -f /var/log/autoflow-tasks.jsonl

# ✓ Se tudo rodar sem erros → passe para Passo 2.1
```

**Tempo:** 5-10 minutos

---

**Precisa de help em algum passo? Aviso quando acabar! 🚀**
