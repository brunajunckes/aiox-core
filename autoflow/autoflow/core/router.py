"""LLM Router — Integrates with LLM-Router-AIOX for complexity-based routing.

Flow:
    1. Ask LLM-Router-AIOX /route for a routing decision (model + complexity score + cost)
    2. Execute inference against the chosen provider (ollama | claude)
    3. Log every call (cost, latency, model, score) to /var/log/autoflow-router.jsonl
    4. Circuit breaker: if LLM-Router fails repeatedly, bypass it temporarily
    5. Fallback chain (LLM-Router down): Ollama -> Claude direct

This preserves the stable public entry point `call_llm_sync(prompt, system, ...)`
used by all LangGraph workflow nodes.
"""
from __future__ import annotations

import json
import os
import sys
import time
import threading
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from . import config


# ---------------------------------------------------------------------------
# Cost tracking log
# ---------------------------------------------------------------------------

COST_LOG_PATH = os.getenv("AUTOFLOW_ROUTER_LOG", "/var/log/autoflow-router.jsonl")
_log_lock = threading.Lock()


def _log_event(event: dict[str, Any]) -> None:
    """Append a JSONL event to the cost log. Silent on I/O failure."""
    event.setdefault("ts", datetime.now(timezone.utc).isoformat())
    event.setdefault("service", "autoflow-router")
    try:
        with _log_lock:
            with open(COST_LOG_PATH, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(event, default=str) + "\n")
    except Exception as exc:  # pragma: no cover - never block a real request
        print(f"[Router] cost-log write failed: {exc}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Circuit breaker for LLM-Router-AIOX
# ---------------------------------------------------------------------------


class CircuitBreaker:
    """Minimal thread-safe circuit breaker.

    States:
        CLOSED   - normal, requests flow through
        OPEN     - failing fast; requests bypass the dependency
        HALF     - probing; one request allowed to see if service is back
    """

    CLOSED = "closed"
    OPEN = "open"
    HALF = "half_open"

    def __init__(self, failure_threshold: int = 3, reset_seconds: float = 60.0) -> None:
        self.failure_threshold = failure_threshold
        self.reset_seconds = reset_seconds
        self._state = self.CLOSED
        self._failures = 0
        self._opened_at = 0.0
        self._lock = threading.Lock()

    @property
    def state(self) -> str:
        with self._lock:
            # Transition OPEN -> HALF after cooldown
            if self._state == self.OPEN and (time.monotonic() - self._opened_at) >= self.reset_seconds:
                self._state = self.HALF
            return self._state

    def allow(self) -> bool:
        return self.state != self.OPEN

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._state = self.CLOSED

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._failures >= self.failure_threshold:
                self._state = self.OPEN
                self._opened_at = time.monotonic()


_llm_router_breaker = CircuitBreaker(
    failure_threshold=int(os.getenv("AUTOFLOW_ROUTER_CB_THRESHOLD", "3")),
    reset_seconds=float(os.getenv("AUTOFLOW_ROUTER_CB_RESET", "60")),
)


# ---------------------------------------------------------------------------
# LLM-Router-AIOX client
# ---------------------------------------------------------------------------


def _fetch_routing_decision(prompt: str, context: Optional[dict] = None) -> Optional[dict]:
    """Call LLM-Router-AIOX /route. Returns the routing_decision dict or None.

    Returns None on any failure so the caller can use a default strategy.
    Updates the circuit breaker accordingly.
    """
    if not _llm_router_breaker.allow():
        return None

    url = f"{config.LLM_ROUTER_URL.rstrip('/')}/route"
    payload: dict[str, Any] = {"prompt": prompt}
    if context:
        payload["context"] = context

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        _llm_router_breaker.record_failure()
        _log_event(
            {
                "type": "routing_decision",
                "status": "error",
                "error": str(exc),
                "circuit_state": _llm_router_breaker.state,
            }
        )
        print(f"[Router] LLM-Router unreachable: {exc}", file=sys.stderr)
        return None

    decision = data.get("routing_decision") if isinstance(data, dict) else None
    if not decision or not isinstance(decision, dict):
        _llm_router_breaker.record_failure()
        return None

    _llm_router_breaker.record_success()
    return decision


# ---------------------------------------------------------------------------
# Provider calls
# ---------------------------------------------------------------------------


def _call_ollama_sync(
    prompt: str,
    system: str,
    model: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """Direct synchronous Ollama call."""
    messages: list[dict[str, str]] = []
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


def _call_claude_sync(
    prompt: str,
    system: str,
    temperature: float,
    max_tokens: int,
) -> str:
    """Direct synchronous Claude API call."""
    if not config.ANTHROPIC_API_KEY:
        raise RuntimeError("Claude fallback unavailable: ANTHROPIC_API_KEY not set")

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


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def call_llm_sync(
    prompt: str,
    system: str = "",
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    context: Optional[dict] = None,
) -> str:
    """Synchronous LLM call with complexity-aware routing.

    Flow:
        1. Consult LLM-Router-AIOX for a routing decision (chooses ollama|claude
           based on complexity score 1-15) unless the circuit breaker is open.
        2. Execute the chosen provider.
        3. On provider failure, try the other provider as in-process fallback.
        4. Log every attempt (cost, latency, complexity, model) to
           /var/log/autoflow-router.jsonl.

    The ``model`` arg is an explicit override: when provided it pins Ollama to
    that model and bypasses LLM-Router completely (used by workflows that need
    a specific model).
    """
    overall_start = time.monotonic()

    # Explicit model override -> bypass LLM-Router; go straight to Ollama.
    if model:
        return _execute_with_fallback(
            preferred="ollama",
            prompt=prompt,
            system=system,
            ollama_model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            routing_decision=None,
            started_at=overall_start,
        )

    # Ask LLM-Router-AIOX for a routing decision
    decision = _fetch_routing_decision(prompt, context)

    if decision is None:
        # LLM-Router down or bypassed: default preference is Ollama (cheap)
        preferred = "ollama"
    else:
        preferred = str(decision.get("model") or "ollama").lower()
        if preferred not in ("ollama", "claude"):
            preferred = "ollama"

    return _execute_with_fallback(
        preferred=preferred,
        prompt=prompt,
        system=system,
        ollama_model=config.OLLAMA_MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
        routing_decision=decision,
        started_at=overall_start,
    )


def _execute_with_fallback(
    *,
    preferred: str,
    prompt: str,
    system: str,
    ollama_model: str,
    temperature: float,
    max_tokens: int,
    routing_decision: Optional[dict],
    started_at: float,
) -> str:
    """Execute the preferred provider with cross-provider fallback + logging."""
    # Ordered list of providers to try
    order = [preferred] + [p for p in ("ollama", "claude") if p != preferred]

    last_error: Optional[Exception] = None
    complexity_score = (routing_decision or {}).get("complexity_score")
    complexity_level = (routing_decision or {}).get("complexity_level")
    estimated_cost = (routing_decision or {}).get("estimated_cost", 0.0)
    routing_reason = (routing_decision or {}).get("reason", "no-router-decision")

    for provider in order:
        call_start = time.monotonic()
        try:
            if provider == "ollama":
                text = _call_ollama_sync(
                    prompt, system, ollama_model, temperature, max_tokens
                )
                actual_model = ollama_model
                actual_cost = 0.0  # Ollama is free (local)
            elif provider == "claude":
                text = _call_claude_sync(prompt, system, temperature, max_tokens)
                actual_model = config.CLAUDE_MODEL
                # If LLM-Router gave an estimate use it, else rough token-based estimate.
                actual_cost = float(estimated_cost) if provider == preferred else 0.003
            else:
                continue

            latency_ms = int((time.monotonic() - call_start) * 1000)
            total_ms = int((time.monotonic() - started_at) * 1000)

            _log_event(
                {
                    "type": "llm_call",
                    "status": "success",
                    "provider": provider,
                    "model": actual_model,
                    "preferred": preferred,
                    "fallback_used": provider != preferred,
                    "complexity_score": complexity_score,
                    "complexity_level": complexity_level,
                    "estimated_cost_usd": estimated_cost,
                    "actual_cost_usd": actual_cost,
                    "latency_ms": latency_ms,
                    "total_ms": total_ms,
                    "prompt_chars": len(prompt),
                    "response_chars": len(text),
                    "circuit_state": _llm_router_breaker.state,
                    "routing_reason": routing_reason,
                }
            )
            return text

        except Exception as exc:
            last_error = exc
            latency_ms = int((time.monotonic() - call_start) * 1000)
            _log_event(
                {
                    "type": "llm_call",
                    "status": "error",
                    "provider": provider,
                    "preferred": preferred,
                    "error": str(exc),
                    "latency_ms": latency_ms,
                    "complexity_score": complexity_score,
                    "complexity_level": complexity_level,
                }
            )
            print(f"[Router] {provider} failed: {exc}", file=sys.stderr)
            continue

    raise RuntimeError(
        f"All LLM providers failed. Last error: {last_error}. "
        "Check Ollama status, LLM-Router status, or ANTHROPIC_API_KEY."
    )


# ---------------------------------------------------------------------------
# Introspection helpers (used by tests & diagnostics)
# ---------------------------------------------------------------------------


def router_health() -> dict[str, Any]:
    """Lightweight health snapshot for diagnostics / tests."""
    return {
        "llm_router_url": config.LLM_ROUTER_URL,
        "ollama_url": config.OLLAMA_URL,
        "ollama_default_model": config.OLLAMA_MODEL,
        "claude_configured": bool(config.ANTHROPIC_API_KEY),
        "cost_log_path": COST_LOG_PATH,
        "circuit_state": _llm_router_breaker.state,
    }
