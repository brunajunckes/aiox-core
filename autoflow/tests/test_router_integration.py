"""Integration tests for autoflow.core.router.

These tests validate the LLM-Router-AIOX integration without requiring a real
LLM inference call. Run with::

    cd /root/autoflow && . .venv/bin/activate && python -m pytest tests/test_router_integration.py -v

Or standalone::

    python tests/test_router_integration.py
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

# Make package importable when running as a script
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from autoflow.core import router  # noqa: E402


def _read_log(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


# ---------------------------------------------------------------------------
# Test 1 — Public API surface is preserved
# ---------------------------------------------------------------------------
def test_public_api_surface():
    assert callable(router.call_llm_sync)
    assert callable(router.router_health)
    # Backward-compatible signature: positional prompt, keyword system/model/...
    import inspect

    sig = inspect.signature(router.call_llm_sync)
    params = list(sig.parameters.keys())
    for required in ("prompt", "system", "model", "temperature", "max_tokens"):
        assert required in params, f"missing kwarg: {required}"
    print("  [PASS] public api preserved")


# ---------------------------------------------------------------------------
# Test 2 — router_health() works
# ---------------------------------------------------------------------------
def test_router_health():
    h = router.router_health()
    assert "llm_router_url" in h
    assert "ollama_url" in h
    assert "circuit_state" in h
    assert h["circuit_state"] in ("closed", "open", "half_open")
    print(f"  [PASS] health ok: circuit={h['circuit_state']}")


# ---------------------------------------------------------------------------
# Test 3 — LLM-Router-AIOX /route is reachable and returns routing decisions
# ---------------------------------------------------------------------------
def test_routing_decision_fetch():
    decision = router._fetch_routing_decision("Write hello world in Python")
    if decision is None:
        print("  [SKIP] LLM-Router unreachable; skipping routing-decision test")
        return
    assert "model" in decision
    assert decision["model"] in ("ollama", "claude")
    assert "complexity_score" in decision
    assert isinstance(decision["complexity_score"], (int, float))
    assert 0 < decision["complexity_score"] <= 20
    print(
        f"  [PASS] routing decision: model={decision['model']} "
        f"score={decision['complexity_score']} level={decision.get('complexity_level')}"
    )


# ---------------------------------------------------------------------------
# Test 4 — Circuit breaker opens after N failures
# ---------------------------------------------------------------------------
def test_circuit_breaker_opens_on_failures():
    cb = router.CircuitBreaker(failure_threshold=2, reset_seconds=60)
    assert cb.allow() is True
    cb.record_failure()
    assert cb.allow() is True  # still closed
    cb.record_failure()
    assert cb.allow() is False  # opened
    assert cb.state == "open"
    cb.record_success()  # manual recovery
    assert cb.state == "closed"
    print("  [PASS] circuit breaker open/close transitions")


# ---------------------------------------------------------------------------
# Test 5 — Circuit breaker bypasses LLM-Router when open
# ---------------------------------------------------------------------------
def test_circuit_breaker_bypass():
    # Temporarily force the global breaker OPEN
    original_state = router._llm_router_breaker._state
    original_failures = router._llm_router_breaker._failures
    try:
        router._llm_router_breaker._state = router.CircuitBreaker.OPEN
        router._llm_router_breaker._opened_at = 1e18  # never reset
        assert router._fetch_routing_decision("hello") is None
        print("  [PASS] circuit-open bypass works")
    finally:
        router._llm_router_breaker._state = original_state
        router._llm_router_breaker._failures = original_failures


# ---------------------------------------------------------------------------
# Test 6 — Cost log is written on success
# ---------------------------------------------------------------------------
def test_cost_log_write(monkeypatch=None):
    # Redirect log to a temp file
    with tempfile.TemporaryDirectory() as td:
        log_path = os.path.join(td, "router.jsonl")
        original_path = router.COST_LOG_PATH
        router.COST_LOG_PATH = log_path
        try:
            router._log_event({"type": "llm_call", "status": "success", "provider": "test"})
            events = _read_log(log_path)
            assert len(events) == 1
            ev = events[0]
            assert ev["type"] == "llm_call"
            assert ev["provider"] == "test"
            assert "ts" in ev  # timestamp injected
            assert ev["service"] == "autoflow-router"
            print(f"  [PASS] cost log wrote {len(events)} event(s)")
        finally:
            router.COST_LOG_PATH = original_path


# ---------------------------------------------------------------------------
# Test 7 — call_llm_sync falls back when no provider is available
# ---------------------------------------------------------------------------
def test_fallback_failure_chain(monkeypatch=None):
    # Patch both providers to raise, ensure RuntimeError is surfaced.
    import autoflow.core.router as r

    saved_ollama = r._call_ollama_sync
    saved_claude = r._call_claude_sync
    try:
        def boom_ollama(*a, **kw):
            raise RuntimeError("simulated ollama down")

        def boom_claude(*a, **kw):
            raise RuntimeError("simulated claude down")

        r._call_ollama_sync = boom_ollama
        r._call_claude_sync = boom_claude

        # Also short-circuit LLM-Router to return None quickly
        saved_fetch = r._fetch_routing_decision
        r._fetch_routing_decision = lambda prompt, context=None: None

        try:
            r.call_llm_sync("test prompt")
        except RuntimeError as exc:
            assert "All LLM providers failed" in str(exc)
            print("  [PASS] fallback chain raises when all fail")
            return
        raise AssertionError("expected RuntimeError")
    finally:
        r._call_ollama_sync = saved_ollama
        r._call_claude_sync = saved_claude
        r._fetch_routing_decision = saved_fetch


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
def main() -> int:
    tests = [
        test_public_api_surface,
        test_router_health,
        test_routing_decision_fetch,
        test_circuit_breaker_opens_on_failures,
        test_circuit_breaker_bypass,
        test_cost_log_write,
        test_fallback_failure_chain,
    ]
    failures = 0
    for fn in tests:
        print(f"\n{fn.__name__}:")
        try:
            fn()
        except AssertionError as exc:
            print(f"  [FAIL] {exc}")
            failures += 1
        except Exception as exc:
            print(f"  [ERROR] {type(exc).__name__}: {exc}")
            failures += 1

    print(f"\n{'=' * 60}")
    if failures == 0:
        print(f"ALL TESTS PASSED ({len(tests)} tests)")
        return 0
    print(f"FAILED: {failures} / {len(tests)}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
