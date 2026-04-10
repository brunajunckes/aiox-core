# ✅ Ollama Enforcement — Configuração FINAL

## 🔧 Endpoints GARANTIDOS

```
Ollama Online:    http://ollama.ampcast.site:11434   ← ÚNICO, SEMPRE ESTE
LLM-Router:       http://127.0.0.1:3000              ← VPS (decisões de roteamento)
Claude Opus:      https://api.anthropic.com/...      ← Fallback (pagável)
Local VPS:        ❌ NUNCA (removido)
```

## 📦 Modelos Confirmados (Online)

```
✓ qwen2.5:7b          ← CONFIRMADO, pronto para usar
? gemma:QUAL?         ← ESPERANDO CONFIRMAÇÃO DO USUÁRIO
```

## ⚠️ FALTANDO: Nome Exato do Gemma

**Preciso de uma destas variações:**

1. `gemma:7b`
2. `gemma:13b`
3. `gemma2:9b`
4. `gemma2:27b`
5. Outra? (digita o nome exato)

## 🎯 Estratégia de Roteamento (com seus modelos)

```
SIMPLE (0-3)     → qwen2.5:7b           FREE    300ms   Qual?
STANDARD (4-8)   → gemma:[QUAL]        FREE    500ms   ← AGUARDANDO
COMPLEX (9-15)   → Claude Opus          Pagável 2s      ✓
```

## 📍 Arquivos JÁ CONFIGURADOS para Online

```
✓ /root/autoflow/autoflow/core/config.py
  OLLAMA_URL = "http://ollama.ampcast.site:11434"  (HARDCODED)

✓ /root/autoflow/autoflow/core/ollama_enforce.py  
  OLLAMA_URL = "http://ollama.ampcast.site:11434"  (HARDCODED)

✓ /root/autoflow/autoflow/core/task_router.py
  Usa config.OLLAMA_URL automaticamente

✓ /root/autoflow/autoflow/core/llm_config.yaml
  provider: "ollama_online" → http://ollama.ampcast.site:11434
```

## 🚀 Próximo Passo

**Diga qual é o gemma e eu completo a configuração:**

```bash
# Opção 1: Se for gemma:7b
# → Vou atualizar ollama_enforce.py com "gemma:7b"
# → Vou rodar testes

# Opção 2: Se for gemma:13b
# → Similar

# Opção 3: Se for outra versão
# → Digita o nome exato
```

---

**Status:** 🟡 AGUARDANDO INPUT DO USUÁRIO (nome do gemma)
