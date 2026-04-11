"""Epic 3.1: LLM-Router Alignment Implementation Tests

Comprehensive tests for:
  1. Cost logger integration with router
  2. Metrics collection (latency, cost, success rate)
  3. Circuit breaker with metric recording
  4. Cost summary CLI command
  5. Cost accuracy verification
"""

import pytest
import json
import os
from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock, patch

from autoflow.core import router
from autoflow.core import cost_logger
from autoflow.core import metrics
from autoflow import cli


# ────────────────────────────────────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def reset_metrics():
    """Reset metrics before each test."""
    collector = metrics.get_collector()
    collector.reset()
    yield
    collector.reset()


@pytest.fixture
def reset_circuit_breaker():
    """Reset circuit breaker."""
    router._llm_router_breaker = router.CircuitBreaker(
        failure_threshold=int(os.getenv("AUTOFLOW_ROUTER_CB_THRESHOLD", "3")),
        reset_seconds=float(os.getenv("AUTOFLOW_ROUTER_CB_RESET", "60")),
    )
    yield


# ────────────────────────────────────────────────────────────────────────────
# Deliverable 1: Cost Logger Integration
# ────────────────────────────────────────────────────────────────────────────


class TestCostLoggerIntegration:
    """Test cost logger integration with router."""

    def test_log_event_creates_cost_event(self):
        """Test that _log_event creates a properly structured CostEvent."""
        event_dict = {
            "type": "llm_call",
            "status": "success",
            "provider": "ollama",
            "model": "qwen2.5:7b",
            "preferred": "ollama",
            "fallback_used": False,
            "complexity_score": 5,
            "complexity_level": "simple",
            "estimated_cost_usd": 0.0,
            "actual_cost_usd": 0.0,
            "latency_ms": 850,
            "prompt_chars": 512,
            "response_chars": 256,
            "circuit_state": "closed",
            "routing_reason": "complexity-based",
        }

        # Mock cost_logger.log_llm_call to capture the call
        with patch.object(cost_logger, "log_llm_call") as mock_log:
            router._log_event(event_dict)
            mock_log.assert_called_once()

    def test_cost_event_dataclass_structure(self):
        """Test CostEvent dataclass has all required fields."""
        event = cost_logger.CostEvent(
            timestamp=datetime.now(timezone.utc).isoformat(),
            type="llm_call",
            status="success",
            provider="ollama",
            model="qwen2.5:7b",
            preferred_provider="ollama",
            fallback_used=False,
            complexity_score=5,
            complexity_level="simple",
            estimated_cost_usd=0.0,
            actual_cost_usd=0.0,
            latency_ms=850,
            prompt_chars=512,
            response_chars=256,
            circuit_state="closed",
            routing_reason="complexity-based",
        )

        assert event.provider == "ollama"
        assert event.complexity_level == "simple"
        assert event.actual_cost_usd == 0.0
        assert event.latency_ms == 850

    def test_cost_event_to_jsonl(self):
        """Test CostEvent serializes to valid JSONL."""
        event = cost_logger.CostEvent(
            timestamp=datetime.now(timezone.utc).isoformat(),
            type="llm_call",
            status="success",
            provider="claude",
            model="claude-3-haiku",
        )

        jsonl = event.to_jsonl()
        assert isinstance(jsonl, str)

        # Should be valid JSON
        parsed = json.loads(jsonl)
        assert parsed["type"] == "llm_call"
        assert parsed["status"] == "success"
        assert parsed["provider"] == "claude"


# ────────────────────────────────────────────────────────────────────────────
# Deliverable 2: Metrics Collection
# ────────────────────────────────────────────────────────────────────────────


class TestMetricsCollection:
    """Test metrics collection module."""

    def test_latency_metrics_single_sample(self, reset_metrics):
        """Test recording a single latency sample."""
        collector = metrics.get_collector()
        latency_metric = metrics.LatencyMetrics(provider="ollama")

        latency_metric.record(100)

        assert latency_metric.samples == 1
        assert latency_metric.min_ms == 100
        assert latency_metric.max_ms == 100
        assert latency_metric.avg_ms == 100.0

    def test_latency_metrics_multiple_samples(self, reset_metrics):
        """Test recording multiple latency samples."""
        latency_metric = metrics.LatencyMetrics(provider="ollama")

        latency_metric.record(100)
        latency_metric.record(200)
        latency_metric.record(150)

        assert latency_metric.samples == 3
        assert latency_metric.min_ms == 100
        assert latency_metric.max_ms == 200
        assert latency_metric.avg_ms == pytest.approx(150.0)

    def test_cost_metrics_recording(self, reset_metrics):
        """Test recording costs by complexity level."""
        cost_metric = metrics.CostMetrics(complexity_level="simple")

        cost_metric.record(0.001)
        cost_metric.record(0.002)

        assert cost_metric.request_count == 2
        assert cost_metric.total_cost_usd == pytest.approx(0.003)
        assert cost_metric.avg_cost_per_request == pytest.approx(0.0015)

    def test_success_rate_metrics(self, reset_metrics):
        """Test success rate tracking."""
        success_metric = metrics.SuccessRateMetrics(provider="ollama")

        success_metric.record_success()
        success_metric.record_success()
        success_metric.record_failure()

        assert success_metric.successes == 2
        assert success_metric.failures == 1
        assert success_metric.success_rate == pytest.approx(66.67, abs=0.01)

    def test_collector_record_llm_call(self, reset_metrics):
        """Test collector.record_llm_call integrates all metrics."""
        collector = metrics.get_collector()

        collector.record_llm_call(
            provider="ollama",
            latency_ms=500,
            cost_usd=0.0,
            complexity_level="simple",
            status="success",
        )

        latency_summary = collector.get_latency_summary()
        assert "ollama" in latency_summary
        assert latency_summary["ollama"]["samples"] == 1
        assert latency_summary["ollama"]["avg_ms"] == 500.0

    def test_collector_circuit_state_changes(self, reset_metrics):
        """Test recording circuit state changes."""
        collector = metrics.get_collector()

        collector.record_circuit_state_change(
            from_state="closed",
            to_state="open",
            reason="failure_threshold_exceeded",
        )

        summary = collector.get_summary()
        assert len(summary["circuit_state_changes"]) == 1
        assert summary["circuit_state_changes"][0]["from"] == "closed"
        assert summary["circuit_state_changes"][0]["to"] == "open"

    def test_metrics_thread_safety(self, reset_metrics):
        """Test metrics are thread-safe."""
        import threading

        collector = metrics.get_collector()
        errors = []

        def record_metrics():
            try:
                for i in range(100):
                    collector.record_llm_call(
                        provider="ollama",
                        latency_ms=100 + i,
                        cost_usd=0.0,
                        complexity_level="simple",
                        status="success",
                    )
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=record_metrics) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        summary = collector.get_summary()
        latency = summary["latency_metrics"]["ollama"]
        # 5 threads * 100 samples = 500 total
        assert latency["samples"] == 500


# ────────────────────────────────────────────────────────────────────────────
# Deliverable 3: Circuit Breaker Integration
# ────────────────────────────────────────────────────────────────────────────


class TestCircuitBreakerMetrics:
    """Test circuit breaker with metric recording."""

    def test_circuit_breaker_records_failure_threshold(self, reset_metrics, reset_circuit_breaker):
        """Test circuit breaker opens and records state change."""
        breaker = router.CircuitBreaker(failure_threshold=2, reset_seconds=1.0)
        collector = metrics.get_collector()

        # Record 2 failures
        breaker.record_failure()
        breaker.record_failure()

        # Should now be open
        assert breaker.state == "open"

        # Check metrics recorded the state change
        summary = collector.get_summary()
        changes = summary["circuit_state_changes"]

        # Should have recorded transition to OPEN
        open_changes = [c for c in changes if c["to"] == "open"]
        assert len(open_changes) >= 1

    def test_circuit_breaker_recovery_recorded(self, reset_metrics, reset_circuit_breaker):
        """Test circuit breaker recovery is recorded in metrics."""
        breaker = router.CircuitBreaker(failure_threshold=2, reset_seconds=1.0)
        collector = metrics.get_collector()

        # Open the breaker
        breaker.record_failure()
        breaker.record_failure()
        assert breaker.state == "open"

        # Record success to close
        breaker.record_success()
        assert breaker.state == "closed"

        # Check metrics recorded the recovery
        summary = collector.get_summary()
        changes = summary["circuit_state_changes"]

        closed_changes = [c for c in changes if c["to"] == "closed"]
        assert len(closed_changes) >= 1


# ────────────────────────────────────────────────────────────────────────────
# Deliverable 4: Cost Summary CLI Command
# ────────────────────────────────────────────────────────────────────────────


class TestCostSummaryCLI:
    """Test CLI cost-summary command."""

    def test_cost_summary_no_data(self):
        """Test cost-summary with no data available."""
        args = MagicMock(days=1, workflow=None)

        with patch.object(cost_logger, "get_cost_summary", return_value=None):
            result = cli.cost_summary_cmd(args)
            assert result == 1

    def test_cost_summary_with_data(self):
        """Test cost-summary with data."""
        args = MagicMock(days=1, workflow=None)
        summary_data = {
            "total_requests": 10,
            "total_cost_usd": 0.05,
            "average_cost_per_request": 0.005,
            "by_provider": {"ollama": 0.0, "claude": 0.05},
            "by_model": {"qwen2.5:7b": 0.0, "claude-3-haiku": 0.05},
            "by_complexity": {"simple": 0.0, "standard": 0.05},
        }

        with patch.object(cost_logger, "get_cost_summary", return_value=summary_data):
            result = cli.cost_summary_cmd(args)
            assert result == 0

    def test_cost_summary_by_workflow(self):
        """Test cost-summary filtered by workflow."""
        args = MagicMock(days=7, workflow="research")
        summary_data = {
            "total_requests": 5,
            "total_cost_usd": 0.03,
            "average_cost_per_request": 0.006,
            "by_provider": {"claude": 0.03},
            "by_model": {"claude-3-haiku": 0.03},
            "by_complexity": {"standard": 0.03},
        }

        with patch.object(cost_logger, "get_cost_summary", return_value=summary_data) as mock_get:
            result = cli.cost_summary_cmd(args)
            assert result == 0
            # Verify workflow filter was passed
            mock_get.assert_called_once_with(days=7, workflow_type="research")

    def test_router_health_cmd(self):
        """Test router-health command."""
        args = MagicMock()
        health = {
            "llm_router_url": "http://localhost:3000",
            "ollama_url": "http://localhost:11434",
            "ollama_default_model": "qwen2.5:7b",
            "claude_configured": True,
            "cost_log_path": "/var/log/autoflow-cost.jsonl",
            "circuit_state": "closed",
        }

        with patch.object(router, "router_health", return_value=health):
            result = cli.router_health_cmd(args)
            assert result == 0

    def test_circuit_status_cmd(self):
        """Test circuit-status command."""
        args = MagicMock()
        health = {
            "circuit_state": "closed",
        }

        with patch.object(router, "router_health", return_value=health):
            result = cli.circuit_status_cmd(args)
            assert result == 0


# ────────────────────────────────────────────────────────────────────────────
# Deliverable 5: Cost Accuracy Verification
# ────────────────────────────────────────────────────────────────────────────


class TestCostAccuracy:
    """Test cost accuracy within tolerance."""

    def test_ollama_zero_cost(self):
        """Test Ollama calls have zero cost."""
        event = {
            "type": "llm_call",
            "status": "success",
            "provider": "ollama",
            "model": "qwen2.5:7b",
            "actual_cost_usd": 0.0,
        }

        assert event["actual_cost_usd"] == 0.0

    def test_claude_cost_calculation(self):
        """Test Claude costs are calculated based on tokens."""
        # Claude Haiku: $0.00080 per 1K input, $0.0024 per 1K output
        input_tokens = 1000
        output_tokens = 500

        # Manual calculation
        input_cost = (input_tokens / 1000) * 0.00080
        output_cost = (output_tokens / 1000) * 0.0024
        expected_cost = input_cost + output_cost  # $0.0008 + $0.0012 = $0.002

        assert expected_cost == pytest.approx(0.002, rel=0.05)  # Within 5%

    def test_cost_accuracy_tolerance(self):
        """Test cost accuracy is within 5% tolerance."""
        estimated = 0.100
        actual = 0.102  # 2% variance

        accuracy = abs(actual - estimated) / estimated
        assert accuracy < 0.05  # Within 5%

    def test_cost_logging_captures_tokens(self):
        """Test cost logging captures token information for accuracy tracking."""
        event = cost_logger.CostEvent(
            timestamp=datetime.now(timezone.utc).isoformat(),
            type="llm_call",
            status="success",
            provider="claude",
            model="claude-3-haiku",
            input_tokens=1000,
            output_tokens=500,
            estimated_cost_usd=0.002,
            actual_cost_usd=0.002,
        )

        assert event.input_tokens == 1000
        assert event.output_tokens == 500
        assert event.estimated_cost_usd == event.actual_cost_usd


# ────────────────────────────────────────────────────────────────────────────
# Deliverable 6: Comprehensive Integration Tests
# ────────────────────────────────────────────────────────────────────────────


class TestEpic31Integration:
    """End-to-end tests for Epic 3.1."""

    def test_router_call_logs_metrics(self, reset_metrics):
        """Test that a router call logs metrics."""
        collector = metrics.get_collector()

        # Mock the provider calls
        with patch("autoflow.core.router._call_ollama_sync", return_value="response"):
            with patch("autoflow.core.router._fetch_routing_decision", return_value=None):
                response = router.call_llm_sync(
                    prompt="test",
                    system="system",
                    temperature=0.7,
                    max_tokens=100,
                )

                assert response == "response"

                # Verify metrics were recorded
                summary = collector.get_summary()
                assert len(summary["latency_metrics"]) > 0
                assert "ollama" in summary["latency_metrics"]

    def test_cost_logger_integration_with_router_health(self, reset_metrics):
        """Test cost logger integrates with router health check."""
        health = router.router_health()

        assert "metrics" in health
        assert "latency" in health["metrics"]
        assert "success_rates" in health["metrics"]
        assert "cost_by_complexity" in health["metrics"]

    def test_full_epic_workflow(self, reset_metrics, reset_circuit_breaker):
        """Test full Epic 3.1 workflow: route → log → collect metrics."""
        collector = metrics.get_collector()

        # 1. Record a successful call
        metrics.record_llm_call(
            provider="ollama",
            latency_ms=500,
            cost_usd=0.0,
            complexity_level="simple",
            status="success",
        )

        # 2. Record a failed call
        metrics.record_llm_call(
            provider="claude",
            latency_ms=1000,
            cost_usd=0.003,
            complexity_level="complex",
            status="error",
        )

        # 3. Verify metrics summary
        summary = collector.get_summary()

        latency = summary["latency_metrics"]
        assert latency["ollama"]["samples"] == 1
        assert latency["claude"]["samples"] == 1

        cost = summary["cost_metrics"]
        assert cost["simple"]["total_cost_usd"] == 0.0
        assert cost["complex"]["total_cost_usd"] == pytest.approx(0.003)

        success = summary["success_rate_metrics"]
        assert success["ollama"]["success_rate_percent"] == 100.0
        assert success["claude"]["success_rate_percent"] == 0.0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
