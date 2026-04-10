---
description: MANDATORY Ollama/Haiku for simple tasks — NEVER use Opus for boilerplate
globs:
  - "**/*"
---

# LLM Cost Optimization — NON-NEGOTIABLE

## Rule

**NEVER use Claude Opus for simple tasks. This burns credits and causes rate limits.**

## Fallback Chain (try in order)

| Priority | Provider | Endpoint | Model | When |
|----------|----------|----------|-------|------|
| 1 | Ollama Mac (SSH tunnel) | `http://127.0.0.1:11435/api/generate` | qwen2.5:3b | Fast (Apple Silicon) |
| 2 | Ollama VPS (local) | `http://127.0.0.1:11434/api/generate` | qwen2.5:3b | If Mac tunnel down |
| 3 | Claude Haiku | Agent tool with `model: "haiku"` | haiku | If both Ollama down |
| **NEVER** | Claude Opus | — | — | **NEVER for simple tasks** |

## How to check which Ollama is available

```bash
# Try remote first, then local
OLLAMA_URL=$(curl -s --connect-timeout 3 http://127.0.0.1:11435/api/tags >/dev/null 2>&1 && echo "http://127.0.0.1:11435" || (curl -s --connect-timeout 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && echo "http://127.0.0.1:11434" || echo "NONE"))
```

## What is a "simple task" (use Ollama/Haiku)

- Story file updates (checkboxes, status, file lists, change logs)
- YAML/JSON generation and formatting
- Boilerplate code (manifests, templates, barrel exports, index.js)
- Text formatting and markdown generation
- Commit message drafting
- Simple string transformations
- Documentation text generation
- Test boilerplate generation

## What is a "complex task" (use Opus)

- Multi-file architecture decisions requiring cross-module understanding
- Complex debugging and error analysis
- Security-sensitive code (path traversal, validation, auth)
- Integration logic spanning 3+ modules
- Code review requiring full context

## How to call Ollama (for sub-agents)

```bash
# Detect available endpoint
OLLAMA_URL=$(curl -s --connect-timeout 3 http://127.0.0.1:11435/api/tags >/dev/null 2>&1 && echo "http://127.0.0.1:11435" || (curl -s --connect-timeout 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && echo "http://127.0.0.1:11434" || echo "NONE"))

# Generate
curl -s "$OLLAMA_URL/api/generate" -d '{"model":"qwen2.5:3b","prompt":"...","stream":false}' | python3 -c "import sys,json;print(json.load(sys.stdin)['response'])"
```

## How to launch sub-agents for simple tasks

```
Agent({
  model: "haiku",  // Use Haiku, not Opus
  prompt: "..."
})
```

## Enforcement

- Main orchestrator: classify every task before executing
- Sub-agents: launch with `model: "haiku"` for simple tasks
- Squads: EVERY agent prompt MUST include this fallback chain
- **Violation = burning user credits. User lost 30min of Opus credits to boilerplate.**
