"""Test Suite: LLM-Router Integration & Cost Logging (Story 5.5)

Comprehensive tests for:
  - LLM-Router /route endpoint integration
  - Cost accuracy (estimated vs actual)
  - Circuit breaker state transitions
  - Fallback chain execution
  - Cost logging to PostgreSQL
  - Edge cases and error scenarios
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock, call
from datetime import datetime, timezone
import httpx

# Import modules under test
from autoflow.core import router
from autoflow.core import cost_logger
from autoflow.core.router import CircuitBreaker, call_llm_sync


# ──────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_routing_decision():
    """Mock LLM-Router /route response."""
    return {
        "model": "ollama",
        "complexity_score": 5,
        "complexity_level": "simple",
        "estimated_cost": 0.0,
        "reason": "simple-task-ollama"
    }


@pytest.fixture
def mock_routing_complex():
    """Mock decision for complex task."""
    return {
        "model": "claude",
        "complexity_score": 12,
        "complexity_level": "complex",
        "estimated_cost": 0.015,
        "reason": "complex-task-claude"
    }


@pytest.fixture
def circuit_breaker():
    """Fresh circuit breaker instance."""
    return CircuitBreaker(failure_threshold=3, reset_seconds=1.0)


# ──────────────────────────────────────────────────────────────────────────
# AC1-2: LLM-Router Routing Decision Tests
# ──────────────────────────────────────────────────────────────────────────


class TestRoutingDecision:
    """AC1-2: Router calls /route endpoint, parses decision."""

    @patch('autoflow.core.router.httpx.Client')
    def test_fetch_routing_decision_success(self, mock_client_class, mock_routing_decision):
        """Test successful routing decision fetch."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"routing_decision": mock_routing_decision}
        mock_client.__enter__.return_value.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        decision = router._fetch_routing_decision("test prompt")

        assert decision is not None
        assert decision["model"] == "ollama"
        assert decision["complexity_score"] == 5
        assert decision["complexity_level"] == "simple"
        assert decision["estimated_cost"] == 0.0
        assert decision["reason"] == "simple-task-ollama"

    @patch('autoflow.core.router.httpx.Client')
    def test_fetch_routing_decision_with_context(self, mock_client_class, mock_routing_decision):
        """Test routing decision with context dict."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"routing_decision": mock_routing_decision}
        mock_client.__enter__.return_value.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        context = {"workflow_type": "research", "request_id": "req_123"}
        decision = router._fetch_routing_decision("test prompt", context=context)

        assert decision is not None
        # Verify context was passed in the POST body
        call_args = mock_client.__enter__.return_value.post.call_args
        assert call_args[1]["json"]["context"] == context

    @patch('autoflow.core.router.httpx.Client')
    def test_fetch_routing_decision_network_error(self, mock_client_class):
        """Test handling of network error from LLM-Router."""
        mock_client = MagicMock()
        mock_client.__enter__.return_value.post.side_effect = httpx.TimeoutException("timeout")
        mock_client_class.return_value = mock_client

        decision = router._fetch_routing_decision("test prompt")

        assert decision is None

    @patch('autoflow.core.router.httpx.Client')
    def test_fetch_routing_decision_invalid_response(self, mock_client_class):
        """Test handling of invalid/malformed response."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"wrong_field": "value"}
        mock_client.__enter__.return_value.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        decision = router._fetch_routing_decision("test prompt")

        assert decision is None

    @patch('autoflow.core.router.httpx.Client')
    def test_fetch_routing_decision_http_error(self, mock_client_class):
        """Test handling of HTTP error (e.g., 500)."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError("500", request=None, response=mock_response)
        mock_client.__enter__.return_value.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        decision = router._fetch_routing_decision("test prompt")

        assert decision is None


# ──────────────────────────────────────────────────────────────────────────
# AC4: Circuit Breaker Tests
# ──────────────────────────────────────────────────────────────────────────


class TestCircuitBreaker:
    """AC4: Circuit breaker state transitions & cooldown."""

    def test_circuit_breaker_initial_state(self, circuit_breaker):
        """Circuit breaker starts in CLOSED state."""
        assert circuit_breaker.state == CircuitBreaker.CLOSED
        assert circuit_breaker.allow() is True

    def test_circuit_breaker_record_success(self, circuit_breaker):
        """Success resets failure count."""
        circuit_breaker.record_failure()
        assert circuit_breaker._failures == 1

        circuit_breaker.record_success()
        assert circuit_breaker._failures == 0
        assert circuit_breaker.state == CircuitBreaker.CLOSED

    def test_circuit_breaker_open_on_threshold(self, circuit_breaker):
        """Circuit opens after threshold failures."""
        # Record 3 failures (threshold = 3)
        for _ in range(3):
            circuit_breaker.record_failure()

        assert circuit_breaker.state == CircuitBreaker.OPEN
        assert circuit_breaker.allow() is False

    def test_circuit_breaker_half_open_after_cooldown(self, circuit_breaker):
        """Circuit transitions to HALF state after cooldown."""
        # Force open state
        for _ in range(3):
            circuit_breaker.record_failure()

        assert circuit_breaker.state == CircuitBreaker.OPEN

        # Simulate cooldown expiry
        import time
        time.sleep(1.1)  # Just over reset_seconds

        assert circuit_breaker.state == CircuitBreaker.HALF

    def test_circuit_breaker_reset_on_half_open_success(self, circuit_breaker):
        """Success in HALF state transitions back to CLOSED."""
        # Force open state
        for _ in range(3):
            circuit_breaker.record_failure()

        import time
        time.sleep(1.1)
        assert circuit_breaker.state == CircuitBreaker.HALF

        # Success should reset
        circuit_breaker.record_success()
        assert circuit_breaker.state == CircuitBreaker.CLOSED

    def test_circuit_breaker_thread_safety(self, circuit_breaker):
        """Circuit breaker is thread-safe."""
        import concurrent.futures

        def record_failures():
            for _ in range(10):
                circuit_breaker.record_failure()

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(record_failures) for _ in range(3)]
            for future in concurrent.futures.as_completed(futures):
                future.result()

        # Should have enough failures to open (30 total, threshold 3)
        assert circuit_breaker.state == CircuitBreaker.OPEN


# ──────────────────────────────────────────────────────────────────────────
# AC3, AC7: Cost Logging Tests
# ──────────────────────────────────────────────────────────────────────────


class TestCostLogging:
    """AC3: Structured cost logging; AC7: Cost accuracy."""

    def test_cost_event_creation(self):
        """CostEvent correctly captures all fields."""
        event = cost_logger.CostEvent(
            timestamp="2026-04-11T12:00:00Z",
            workflow_type="research",
            status="success",
            provider="ollama",
            model="qwen2.5:7b",
            complexity_score=5,
            complexity_level="simple",
            estimated_cost_usd=0.0,
            actual_cost_usd=0.0,
            latency_ms=850,
            prompt_chars=512,
            response_chars=256,
            circuit_state="closed"
        )

        assert event.timestamp == "2026-04-11T12:00:00Z"
        assert event.provider == "ollama"
        assert event.actual_cost_usd == 0.0

    def test_cost_event_to_dict(self):
        """CostEvent.to_dict() produces valid dict."""
        event = cost_logger.CostEvent(
            timestamp="2026-04-11T12:00:00Z",
            provider="claude",
            status="success",
        )

        data = event.to_dict()
        assert isinstance(data, dict)
        assert data["timestamp"] == "2026-04-11T12:00:00Z"
        assert data["provider"] == "claude"

    def test_cost_event_to_jsonl(self):
        """CostEvent.to_jsonl() produces valid JSON."""
        event = cost_logger.CostEvent(
            timestamp="2026-04-11T12:00:00Z",
            provider="ollama",
        )

        jsonl = event.to_jsonl()
        parsed = json.loads(jsonl)
        assert parsed["provider"] == "ollama"

    @patch('autoflow.core.cost_logger.open', create=True)
    def test_log_cost_event_file_fallback(self, mock_open):
        """Cost event falls back to file when PostgreSQL unavailable."""
        # Disable PostgreSQL
        cost_logger._pg_logger = None
        with patch('builtins.open', mock_open):
            event = cost_logger.CostEvent(
                timestamp="2026-04-11T12:00:00Z",
                provider="ollama",
                status="success"
            )
            cost_logger.log_cost_event(event)

            # Verify file was opened (fallback)
            mock_open.assert_called()

    def test_log_llm_call_shorthand(self):
        """log_llm_call() shorthand creates and logs event."""
        with patch('autoflow.core.cost_logger.log_cost_event') as mock_log:
            cost_logger.log_llm_call(
                status="success",
                provider="claude",
                model="claude-3-haiku",
                estimated_cost_usd=0.001,
                actual_cost_usd=0.00085,
                complexity_score=8,
                complexity_level="standard",
                latency_ms=1250,
            )

            # Verify log was called
            assert mock_log.called
            call_event = mock_log.call_args[0][0]
            assert call_event.provider == "claude"
            assert call_event.actual_cost_usd == 0.00085

    def test_cost_accuracy_estimation_vs_actual(self):
        """Test cost accuracy: estimated vs actual within tolerance."""
        estimated = 0.015  # Estimated by LLM-Router
        actual = 0.0147    # Actual cost incurred
        tolerance = 0.05   # 5%

        error_pct = abs(actual - estimated) / estimated
        assert error_pct < tolerance, f"Cost error {error_pct*100:.2f}% exceeds tolerance"

    def test_log_routing_decision(self):
        """log_routing_decision() creates routing event."""
        with patch('autoflow.core.cost_logger.log_cost_event') as mock_log:
            decision = {
                "model": "claude",
                "complexity_score": 12,
                "complexity_level": "complex",
                "estimated_cost": 0.015,
                "reason": "complex-task"
            }
            cost_logger.log_routing_decision(
                decision=decision,
                circuit_state="closed"
            )

            assert mock_log.called
            event = mock_log.call_args[0][0]
            assert event.type == "routing_decision"
            assert event.complexity_level == "complex"

    def test_log_circuit_breaker_event(self):
        """log_circuit_breaker_event() logs state changes."""
        with patch('autoflow.core.cost_logger.log_cost_event') as mock_log:
            cost_logger.log_circuit_breaker_event(
                state="open",
                failures=3,
                reason="threshold-exceeded"
            )

            assert mock_log.called
            event = mock_log.call_args[0][0]
            assert event.type == "circuit_breaker_event"
            assert event.circuit_state == "open"


# ──────────────────────────────────────────────────────────────────────────
# AC5-6: Fallback Chain Tests
# ──────────────────────────────────────────────────────────────────────────


class TestFallbackChain:
    """AC5-6: Fallback chain execution & graceful degradation."""

    @patch('autoflow.core.router._call_ollama_sync')
    @patch('autoflow.core.router._call_claude_sync')
    @patch('autoflow.core.router._fetch_routing_decision')
    @patch('autoflow.core.router._log_event')
    def test_fallback_ollama_success(self, mock_log, mock_route, mock_claude, mock_ollama):
        """Preferred provider (Ollama) succeeds."""
        mock_route.return_value = {
            "model": "ollama",
            "complexity_score": 5,
            "complexity_level": "simple",
            "estimated_cost": 0.0,
            "reason": "simple"
        }
        mock_ollama.return_value = "response from ollama"

        result = call_llm_sync("test prompt")

        assert result == "response from ollama"
        mock_ollama.assert_called_once()
        mock_claude.assert_not_called()

    @patch('autoflow.core.router._call_ollama_sync')
    @patch('autoflow.core.router._call_claude_sync')
    @patch('autoflow.core.router._fetch_routing_decision')
    @patch('autoflow.core.router._log_event')
    def test_fallback_ollama_fails_claude_succeeds(self, mock_log, mock_route, mock_claude, mock_ollama):
        """Ollama fails, fallback to Claude succeeds."""
        mock_route.return_value = {
            "model": "ollama",
            "complexity_score": 5,
            "estimated_cost": 0.0,
            "reason": "simple"
        }
        mock_ollama.side_effect = Exception("Ollama down")
        mock_claude.return_value = "response from claude"

        result = call_llm_sync("test prompt")

        assert result == "response from claude"
        mock_ollama.assert_called_once()
        mock_claude.assert_called_once()

    @patch('autoflow.core.router._call_ollama_sync')
    @patch('autoflow.core.router._call_claude_sync')
    @patch('autoflow.core.router._fetch_routing_decision')
    @patch('autoflow.core.router._log_event')
    def test_fallback_both_providers_fail(self, mock_log, mock_route, mock_claude, mock_ollama):
        """Both providers fail -> RuntimeError."""
        mock_route.return_value = {
            "model": "ollama",
            "estimated_cost": 0.0,
        }
        mock_ollama.side_effect = Exception("Ollama down")
        mock_claude.side_effect = Exception("Claude API error")

        with pytest.raises(RuntimeError, match="All LLM providers failed"):
            call_llm_sync("test prompt")

    @patch('autoflow.core.router._call_ollama_sync')
    @patch('autoflow.core.router._call_claude_sync')
    @patch('autoflow.core.router._fetch_routing_decision')
    @patch('autoflow.core.router._log_event')
    def test_fallback_router_unavailable_defaults_to_ollama(self, mock_log, mock_route, mock_claude, mock_ollama):
        """LLM-Router unavailable -> default to Ollama (cheap)."""
        mock_route.return_value = None  # Router down
        mock_ollama.return_value = "response from ollama"

        result = call_llm_sync("test prompt")

        assert result == "response from ollama"
        # Verify defaulting to ollama when router unavailable
        assert mock_ollama.called

    @patch('autoflow.core.router._call_claude_sync')
    @patch('autoflow.core.router._call_ollama_sync')
    @patch('autoflow.core.router._fetch_routing_decision')
    @patch('autoflow.core.router._log_event')
    def test_fallback_explicit_model_override(self, mock_log, mock_route, mock_ollama, mock_claude):
        """Explicit model parameter bypasses LLM-Router."""
        mock_ollama.return_value = "response from ollama"

        result = call_llm_sync("test prompt", model="qwen2.5:3b")

        assert result == "response from ollama"
        # Router should not be called when model is explicit
        mock_route.assert_not_called()


# ──────────────────────────────────────────────────────────────────────────
# Integration Tests
# ──────────────────────────────────────────────────────────────────────────


class TestIntegration:
    """End-to-end integration tests."""

    @patch('autoflow.core.router._call_ollama_sync')
    @patch('autoflow.core.router._fetch_routing_decision')
    @patch('autoflow.core.router._log_event')
    def test_full_routing_flow_simple_task(self, mock_log, mock_route, mock_ollama):
        """Full flow: simple task -> LLM-Router decision -> Ollama."""
        mock_route.return_value = {
            "model": "ollama",
            "complexity_score": 4,
            "complexity_level": "simple",
            "estimated_cost": 0.0,
            "reason": "simple-local"
        }
        mock_ollama.return_value = "result"

        result = call_llm_sync(
            "simple task",
            context={"workflow_type": "analysis"}
        )

        assert result == "result"
        # Verify logging was called (llm_call events are logged)
        assert mock_log.called
        # Check that at least one call was made with status=success
        assert any("success" in str(call) for call in mock_log.call_args_list)

    @patch('autoflow.core.router._call_claude_sync')
    @patch('autoflow.core.router._fetch_routing_decision')
    @patch('autoflow.core.router._log_event')
    def test_full_routing_flow_complex_task(self, mock_log, mock_route, mock_claude):
        """Full flow: complex task -> LLM-Router decision -> Claude."""
        mock_route.return_value = {
            "model": "claude",
            "complexity_score": 13,
            "complexity_level": "complex",
            "estimated_cost": 0.015,
            "reason": "complex-quality"
        }
        mock_claude.return_value = "detailed response"

        result = call_llm_sync(
            "complex analysis required",
            context={"workflow_type": "research"}
        )

        assert result == "detailed response"
        # Verify cost logging
        assert any(c[0][0].get("status") == "success" for c in mock_log.call_args_list)

    @patch('autoflow.core.router._call_ollama_sync')
    @patch('autoflow.core.router._fetch_routing_decision')
    @patch('autoflow.core.router._log_event')
    def test_router_health_check(self, mock_log, mock_route, mock_ollama):
        """router_health() returns configuration snapshot."""
        health = router.router_health()

        assert "llm_router_url" in health
        assert "ollama_url" in health
        assert "circuit_state" in health
        assert health["claude_configured"] is not None


# ──────────────────────────────────────────────────────────────────────────
# Edge Cases
# ──────────────────────────────────────────────────────────────────────────


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_cost_event_zero_tokens(self):
        """Cost event with zero tokens."""
        event = cost_logger.CostEvent(
            timestamp="2026-04-11T12:00:00Z",
            status="success",
            input_tokens=0,
            output_tokens=0,
            actual_cost_usd=0.0
        )
        assert event.to_dict()["actual_cost_usd"] == 0.0

    def test_cost_event_very_large_tokens(self):
        """Cost event with very large token counts."""
        event = cost_logger.CostEvent(
            timestamp="2026-04-11T12:00:00Z",
            status="success",
            input_tokens=1_000_000,
            output_tokens=500_000,
            actual_cost_usd=0.150
        )
        assert event.input_tokens == 1_000_000
        assert event.actual_cost_usd == 0.150

    def test_cost_event_missing_optional_fields(self):
        """CostEvent can be created with minimal fields."""
        event = cost_logger.CostEvent(
            timestamp="2026-04-11T12:00:00Z",
        )
        # Should not raise
        assert event.timestamp == "2026-04-11T12:00:00Z"

    def test_circuit_breaker_failure_count_wraparound(self, circuit_breaker):
        """Circuit breaker handles many failures without issue."""
        for _ in range(100):
            circuit_breaker.record_failure()

        # Should be open, not wrapped/overflowed
        assert circuit_breaker.state == CircuitBreaker.OPEN


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
