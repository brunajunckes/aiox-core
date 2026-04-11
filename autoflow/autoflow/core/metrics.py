"""Metrics Collection for LLM Router.

Tracks:
  - Latency per provider
  - Cost per complexity level
  - Success rates
  - Circuit breaker state changes
  - Provider availability
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional


@dataclass
class LatencyMetrics:
    """Latency statistics for a provider."""

    provider: str
    min_ms: int = 0
    max_ms: int = 0
    avg_ms: float = 0.0
    samples: int = 0
    _sum_ms: int = field(default=0, init=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False)

    def record(self, latency_ms: int) -> None:
        """Record a latency sample."""
        with self._lock:
            self.samples += 1
            self._sum_ms += latency_ms

            if self.min_ms == 0 or latency_ms < self.min_ms:
                self.min_ms = latency_ms

            if latency_ms > self.max_ms:
                self.max_ms = latency_ms

            self.avg_ms = self._sum_ms / self.samples

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict."""
        return {
            "provider": self.provider,
            "min_ms": self.min_ms,
            "max_ms": self.max_ms,
            "avg_ms": round(self.avg_ms, 2),
            "samples": self.samples,
        }


@dataclass
class CostMetrics:
    """Cost tracking by complexity level."""

    complexity_level: str
    total_cost_usd: float = 0.0
    request_count: int = 0
    avg_cost_per_request: float = 0.0
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False)

    def record(self, cost_usd: float) -> None:
        """Record a cost."""
        with self._lock:
            self.total_cost_usd += cost_usd
            self.request_count += 1
            self.avg_cost_per_request = (
                self.total_cost_usd / self.request_count if self.request_count > 0 else 0.0
            )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict."""
        return {
            "complexity_level": self.complexity_level,
            "total_cost_usd": round(self.total_cost_usd, 4),
            "request_count": self.request_count,
            "avg_cost_per_request": round(self.avg_cost_per_request, 6),
        }


@dataclass
class SuccessRateMetrics:
    """Success rate tracking by provider."""

    provider: str
    successes: int = 0
    failures: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False)

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        total = self.successes + self.failures
        return (self.successes / total * 100) if total > 0 else 0.0

    def record_success(self) -> None:
        """Record a successful request."""
        with self._lock:
            self.successes += 1

    def record_failure(self) -> None:
        """Record a failed request."""
        with self._lock:
            self.failures += 1

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict."""
        return {
            "provider": self.provider,
            "successes": self.successes,
            "failures": self.failures,
            "success_rate_percent": round(self.success_rate, 2),
            "total_requests": self.successes + self.failures,
        }


class MetricsCollector:
    """Thread-safe metrics collector for LLM Router."""

    def __init__(self) -> None:
        """Initialize collector."""
        self._lock = threading.Lock()
        self.latency_metrics: Dict[str, LatencyMetrics] = {}
        self.cost_metrics: Dict[str, CostMetrics] = {}
        self.success_metrics: Dict[str, SuccessRateMetrics] = {}
        self.circuit_state_changes: list[dict[str, Any]] = []
        self.start_time = datetime.now(timezone.utc)

    def record_llm_call(
        self,
        provider: str,
        latency_ms: int,
        cost_usd: float,
        complexity_level: Optional[str],
        status: str,
    ) -> None:
        """Record an LLM call with metrics.

        Args:
            provider: "ollama" or "claude"
            latency_ms: call latency in milliseconds
            cost_usd: cost of the call in USD
            complexity_level: "simple", "standard", or "complex"
            status: "success" or "error"
        """
        with self._lock:
            # Record latency
            if provider not in self.latency_metrics:
                self.latency_metrics[provider] = LatencyMetrics(provider=provider)
            self.latency_metrics[provider].record(latency_ms)

            # Record cost (if applicable)
            if complexity_level:
                if complexity_level not in self.cost_metrics:
                    self.cost_metrics[complexity_level] = CostMetrics(
                        complexity_level=complexity_level
                    )
                self.cost_metrics[complexity_level].record(cost_usd)

            # Record success rate
            if provider not in self.success_metrics:
                self.success_metrics[provider] = SuccessRateMetrics(provider=provider)

            if status == "success":
                self.success_metrics[provider].record_success()
            elif status == "error":
                self.success_metrics[provider].record_failure()

    def record_circuit_state_change(
        self,
        from_state: str,
        to_state: str,
        reason: Optional[str] = None,
    ) -> None:
        """Record a circuit breaker state change.

        Args:
            from_state: previous state
            to_state: new state
            reason: reason for change
        """
        with self._lock:
            self.circuit_state_changes.append(
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "from": from_state,
                    "to": to_state,
                    "reason": reason,
                }
            )

    def get_summary(self) -> dict[str, Any]:
        """Get full metrics summary.

        Returns:
            Dictionary with latency, cost, success rate, and circuit history
        """
        with self._lock:
            uptime_seconds = (datetime.now(timezone.utc) - self.start_time).total_seconds()

            return {
                "uptime_seconds": int(uptime_seconds),
                "latency_metrics": {
                    k: v.to_dict() for k, v in sorted(self.latency_metrics.items())
                },
                "cost_metrics": {
                    k: v.to_dict() for k, v in sorted(self.cost_metrics.items())
                },
                "success_rate_metrics": {
                    k: v.to_dict() for k, v in sorted(self.success_metrics.items())
                },
                "circuit_state_changes": list(self.circuit_state_changes[-10:]),  # Last 10
            }

    def get_latency_summary(self) -> dict[str, Any]:
        """Get latency metrics only."""
        with self._lock:
            return {k: v.to_dict() for k, v in sorted(self.latency_metrics.items())}

    def get_cost_summary(self) -> dict[str, Any]:
        """Get cost metrics only."""
        with self._lock:
            return {k: v.to_dict() for k, v in sorted(self.cost_metrics.items())}

    def get_success_rate_summary(self) -> dict[str, Any]:
        """Get success rate metrics only."""
        with self._lock:
            return {k: v.to_dict() for k, v in sorted(self.success_metrics.items())}

    def reset(self) -> None:
        """Reset all metrics (useful for testing)."""
        with self._lock:
            self.latency_metrics.clear()
            self.cost_metrics.clear()
            self.success_metrics.clear()
            self.circuit_state_changes.clear()
            self.start_time = datetime.now(timezone.utc)


# Global metrics collector instance
_collector: Optional[MetricsCollector] = None
_collector_lock = threading.Lock()


def get_collector() -> MetricsCollector:
    """Get or initialize global metrics collector."""
    global _collector
    if _collector is None:
        with _collector_lock:
            if _collector is None:
                _collector = MetricsCollector()
    return _collector


def record_llm_call(
    provider: str,
    latency_ms: int,
    cost_usd: float,
    complexity_level: Optional[str],
    status: str,
) -> None:
    """Module-level function to record LLM call."""
    get_collector().record_llm_call(
        provider=provider,
        latency_ms=latency_ms,
        cost_usd=cost_usd,
        complexity_level=complexity_level,
        status=status,
    )


def record_circuit_state_change(
    from_state: str,
    to_state: str,
    reason: Optional[str] = None,
) -> None:
    """Module-level function to record circuit state change."""
    get_collector().record_circuit_state_change(
        from_state=from_state,
        to_state=to_state,
        reason=reason,
    )


def get_summary() -> dict[str, Any]:
    """Module-level function to get full summary."""
    return get_collector().get_summary()
