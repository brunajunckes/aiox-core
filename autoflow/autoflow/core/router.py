"""LLM Router — Routes to Ollama (local, free) with Claude fallback.

Priority: Ollama direct → Claude API (Max Plan)
LLM-Router-AIOX is available but skipped for now (its API needs alignment).
"""
import httpx
import json
import sys
from typing import Optional
from . import config


def call_llm_sync(
    prompt: str,
    system: str = "",
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """Synchronous LLM call. Tries Ollama first, then Claude API.

    This is the main entry point for all LangGraph nodes.
    """
    # Try Ollama first (local, free, fast after model loaded)
    try:
        return _call_ollama_sync(prompt, system, model or config.OLLAMA_MODEL, temperature, max_tokens)
    except Exception as e:
        print(f"[Router] Ollama failed: {e}", file=sys.stderr)

    # Fallback: Claude API (Max Plan)
    if config.ANTHROPIC_API_KEY:
        try:
            return _call_claude_sync(prompt, system, temperature, max_tokens)
        except Exception as e:
            print(f"[Router] Claude failed: {e}", file=sys.stderr)

    raise RuntimeError("All LLM providers failed. Check Ollama status or set ANTHROPIC_API_KEY.")


def _call_ollama_sync(prompt: str, system: str, model: str, temperature: float, max_tokens: int) -> str:
    """Direct synchronous Ollama call."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    with httpx.Client(timeout=300.0) as client:
        resp = client.post(
            f"{config.OLLAMA_URL}/api/chat",
            json={
                "model": model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
            },
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]


def _call_claude_sync(prompt: str, system: str, temperature: float, max_tokens: int) -> str:
    """Direct synchronous Claude API call."""
    with httpx.Client(timeout=120.0) as client:
        resp = client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": config.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": config.CLAUDE_MODEL,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
                **({"system": system} if system else {}),
                "temperature": temperature,
            },
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]
