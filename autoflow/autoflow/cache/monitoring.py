"""
Cache Performance Monitoring
============================

Prometheus metrics for cache hit rates, evictions, memory usage, and latency.
"""

import logging
import time
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from collections import deque

log = logging.getLogger("cache_monitoring")


@dataclass
class CacheMetric:
    """Single cache metric."""

    timestamp: float = field(default_factory=time.time)
    metric_type: str = ""  # hit, miss, eviction, error
    key: str = ""
    duration_ms: float = 0.0
    cache_level: str = ""  # l1, l2, l3


class CachePerformanceMonitor:
    """Monitor and track cache performance metrics."""

    def __init__(self, history_size: int = 10000):
        """
        Initialize performance monitor.

        Args:
            history_size: Max metrics to keep in history
        """
        self.history_size = history_size
        self.metrics: deque = deque(maxlen=history_size)

        # Aggregated counters
        self.total_hits = 0
        self.total_misses = 0
        self.total_evictions = 0
        self.total_errors = 0

        # Latency tracking
        self.latencies: deque = deque(maxlen=1000)

    def record_hit(
        self,
        key: str,
        cache_level: str = "unknown",
        duration_ms: float = 0.0,
    ) -> None:
        """
        Record cache hit.

        Args:
            key: Cache key accessed
            cache_level: Which cache level (l1, l2, etc.)
            duration_ms: Lookup duration in milliseconds
        """
        metric = CacheMetric(
            metric_type="hit",
            key=key,
            duration_ms=duration_ms,
            cache_level=cache_level,
        )
        self.metrics.append(metric)
        self.total_hits += 1
        self._record_latency(duration_ms)

        log.debug(
            f"[Cache Monitor] Hit: {key[:16]}... "
            f"({cache_level}, {duration_ms:.2f}ms)"
        )

    def record_miss(
        self,
        key: str,
        cache_level: str = "unknown",
        duration_ms: float = 0.0,
    ) -> None:
        """
        Record cache miss.

        Args:
            key: Cache key requested
            cache_level: Which cache level
            duration_ms: Lookup duration
        """
        metric = CacheMetric(
            metric_type="miss",
            key=key,
            duration_ms=duration_ms,
            cache_level=cache_level,
        )
        self.metrics.append(metric)
        self.total_misses += 1
        self._record_latency(duration_ms)

    def record_eviction(
        self,
        key: str,
        cache_level: str = "unknown",
    ) -> None:
        """
        Record cache eviction.

        Args:
            key: Cache key evicted
            cache_level: Which cache level
        """
        metric = CacheMetric(
            metric_type="eviction",
            key=key,
            cache_level=cache_level,
        )
        self.metrics.append(metric)
        self.total_evictions += 1

        log.debug(f"[Cache Monitor] Eviction: {key[:16]}... ({cache_level})")

    def record_error(
        self,
        key: str,
        cache_level: str = "unknown",
        error: str = "",
    ) -> None:
        """
        Record cache error.

        Args:
            key: Cache key
            cache_level: Which cache level
            error: Error message
        """
        metric = CacheMetric(
            metric_type="error",
            key=key,
            cache_level=cache_level,
        )
        self.metrics.append(metric)
        self.total_errors += 1

        log.warning(
            f"[Cache Monitor] Error: {key[:16]}... ({cache_level}): {error}"
        )

    def _record_latency(self, duration_ms: float) -> None:
        """Record operation latency."""
        self.latencies.append(duration_ms)

    def get_hit_rate(self) -> float:
        """
        Get overall cache hit rate.

        Returns:
            Hit rate as percentage (0-100)
        """
        total = self.total_hits + self.total_misses
        if total == 0:
            return 0.0

        return (self.total_hits / total) * 100

    def get_average_latency_ms(self) -> float:
        """
        Get average cache lookup latency.

        Returns:
            Average latency in milliseconds
        """
        if not self.latencies:
            return 0.0

        return sum(self.latencies) / len(self.latencies)

    def get_p99_latency_ms(self) -> float:
        """
        Get 99th percentile cache lookup latency.

        Returns:
            P99 latency in milliseconds
        """
        if not self.latencies:
            return 0.0

        sorted_latencies = sorted(self.latencies)
        idx = int(len(sorted_latencies) * 0.99)

        return sorted_latencies[idx]

    def get_summary(self) -> Dict[str, Any]:
        """Get summary statistics."""
        return {
            "total_hits": self.total_hits,
            "total_misses": self.total_misses,
            "total_evictions": self.total_evictions,
            "total_errors": self.total_errors,
            "hit_rate_percent": round(self.get_hit_rate(), 2),
            "avg_latency_ms": round(self.get_average_latency_ms(), 3),
            "p99_latency_ms": round(self.get_p99_latency_ms(), 3),
            "metrics_in_history": len(self.metrics),
        }

    def get_by_level(self, cache_level: str) -> Dict[str, Any]:
        """
        Get metrics for specific cache level.

        Args:
            cache_level: Cache level to filter (l1, l2, etc.)

        Returns:
            Metrics for that level
        """
        hits = sum(
            1 for m in self.metrics
            if m.metric_type == "hit" and m.cache_level == cache_level
        )
        misses = sum(
            1 for m in self.metrics
            if m.metric_type == "miss" and m.cache_level == cache_level
        )
        evictions = sum(
            1 for m in self.metrics
            if m.metric_type == "eviction" and m.cache_level == cache_level
        )
        errors = sum(
            1 for m in self.metrics
            if m.metric_type == "error" and m.cache_level == cache_level
        )

        total = hits + misses
        hit_rate = (hits / total * 100) if total > 0 else 0

        level_latencies = [
            m.duration_ms for m in self.metrics
            if m.cache_level == cache_level and m.duration_ms > 0
        ]
        avg_latency = (
            sum(level_latencies) / len(level_latencies)
            if level_latencies else 0.0
        )

        return {
            "cache_level": cache_level,
            "hits": hits,
            "misses": misses,
            "evictions": evictions,
            "errors": errors,
            "hit_rate_percent": round(hit_rate, 2),
            "avg_latency_ms": round(avg_latency, 3),
        }

    def clear(self) -> None:
        """Clear all metrics."""
        self.metrics.clear()
        self.latencies.clear()
        self.total_hits = 0
        self.total_misses = 0
        self.total_evictions = 0
        self.total_errors = 0

        log.info("[Cache Monitor] Cleared all metrics")


class PrometheusMetrics:
    """Prometheus-style metrics for cache monitoring."""

    def __init__(self):
        """Initialize Prometheus metrics."""
        self.metrics: Dict[str, float] = {}
        self.last_export = time.time()

    def set_gauge(self, name: str, value: float, labels: Optional[Dict] = None) -> None:
        """
        Set gauge metric.

        Args:
            name: Metric name
            value: Metric value
            labels: Optional labels dict
        """
        key = self._make_key(name, labels)
        self.metrics[key] = value

    def increment_counter(
        self,
        name: str,
        increment: float = 1.0,
        labels: Optional[Dict] = None,
    ) -> None:
        """
        Increment counter metric.

        Args:
            name: Metric name
            increment: Amount to increment (default: 1)
            labels: Optional labels dict
        """
        key = self._make_key(name, labels)
        self.metrics[key] = self.metrics.get(key, 0.0) + increment

    def record_histogram(
        self,
        name: str,
        value: float,
        labels: Optional[Dict] = None,
    ) -> None:
        """
        Record histogram value (latency).

        Args:
            name: Metric name
            value: Value to record
            labels: Optional labels dict
        """
        key = self._make_key(f"{name}_sum", labels)
        self.metrics[key] = self.metrics.get(key, 0.0) + value

        count_key = self._make_key(f"{name}_count", labels)
        self.metrics[count_key] = self.metrics.get(count_key, 0.0) + 1

    def _make_key(self, name: str, labels: Optional[Dict] = None) -> str:
        """Make metric key with labels."""
        if not labels:
            return name

        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"

    def export_text(self) -> str:
        """
        Export metrics in Prometheus text format.

        Returns:
            Prometheus-formatted metrics
        """
        lines = [
            "# HELP autoflow_cache Cache performance metrics",
            "# TYPE autoflow_cache gauge",
        ]

        for key, value in sorted(self.metrics.items()):
            lines.append(f"autoflow_cache{key} {value}")

        lines.append(f"\n# Exported at {time.time()}")

        return "\n".join(lines)

    def get_all(self) -> Dict[str, float]:
        """Get all metrics."""
        return dict(self.metrics)


# Global instances
_performance_monitor: Optional[CachePerformanceMonitor] = None
_prometheus_metrics: Optional[PrometheusMetrics] = None


def get_performance_monitor() -> CachePerformanceMonitor:
    """Get or create global performance monitor."""
    global _performance_monitor
    if _performance_monitor is None:
        _performance_monitor = CachePerformanceMonitor()
    return _performance_monitor


def get_prometheus_metrics() -> PrometheusMetrics:
    """Get or create global Prometheus metrics."""
    global _prometheus_metrics
    if _prometheus_metrics is None:
        _prometheus_metrics = PrometheusMetrics()
    return _prometheus_metrics


def sync_monitor_to_prometheus(monitor: CachePerformanceMonitor) -> None:
    """
    Sync performance monitor stats to Prometheus metrics.

    Args:
        monitor: CachePerformanceMonitor instance
    """
    prometheus = get_prometheus_metrics()
    summary = monitor.get_summary()

    prometheus.set_gauge("cache_hits_total", float(summary["total_hits"]))
    prometheus.set_gauge("cache_misses_total", float(summary["total_misses"]))
    prometheus.set_gauge("cache_evictions_total", float(summary["total_evictions"]))
    prometheus.set_gauge("cache_errors_total", float(summary["total_errors"]))
    prometheus.set_gauge("cache_hit_rate_percent", summary["hit_rate_percent"])
    prometheus.set_gauge("cache_avg_latency_ms", summary["avg_latency_ms"])
    prometheus.set_gauge("cache_p99_latency_ms", summary["p99_latency_ms"])
