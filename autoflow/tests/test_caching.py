"""
Advanced Caching System Tests
=============================

Tests for L1 (in-memory), L2 (Redis), multi-level cache, strategies, and monitoring.
"""

import pytest
import asyncio
import time
from typing import Dict, Any

from autoflow.core.caching import (
    L1Cache,
    L2CacheRedis,
    MultiLevelCache,
    CacheWarmer,
    cache_key,
    cached,
    get_cache,
    init_cache,
)

from autoflow.cache.strategies import (
    TTLInvalidationStrategy,
    EventBasedInvalidationStrategy,
    PatternBasedInvalidationStrategy,
    CacheWarmingStrategy,
    CacheInvalidationManager,
)

from autoflow.cache.monitoring import (
    CachePerformanceMonitor,
    PrometheusMetrics,
    get_performance_monitor,
)

from autoflow.cache.redis_cache import RedisCache, RedisSerializer


# ============================================================================
# L1 Cache Tests
# ============================================================================

@pytest.mark.asyncio
class TestL1Cache:
    """Tests for in-memory L1 cache."""

    async def test_l1_basic_get_set(self):
        """Test basic get/set operations."""
        cache = L1Cache(max_size=100)

        # Set and get
        await cache.set("key1", "value1")
        result = await cache.get("key1")

        assert result == "value1"

    async def test_l1_ttl_expiration(self):
        """Test TTL-based expiration."""
        cache = L1Cache(default_ttl=1)

        await cache.set("key1", "value1", ttl=1)
        result = await cache.get("key1")
        assert result == "value1"

        # Wait for expiration
        await asyncio.sleep(1.5)
        result = await cache.get("key1")
        assert result is None

    async def test_l1_lru_eviction(self):
        """Test LRU eviction when max size reached."""
        cache = L1Cache(max_size=3, default_ttl=3600)

        # Fill cache
        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        await cache.set("key3", "value3")

        # Add one more - should evict key1 (least recently used)
        await cache.set("key4", "value4")

        assert await cache.get("key1") is None
        assert await cache.get("key2") == "value2"
        assert await cache.get("key4") == "value4"
        assert cache.evictions == 1

    async def test_l1_delete(self):
        """Test delete operation."""
        cache = L1Cache()

        await cache.set("key1", "value1")
        await cache.delete("key1")

        result = await cache.get("key1")
        assert result is None

    async def test_l1_clear(self):
        """Test clear operation."""
        cache = L1Cache()

        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        await cache.clear()

        assert await cache.get("key1") is None
        assert await cache.get("key2") is None
        assert len(cache.cache) == 0

    async def test_l1_invalidate_pattern(self):
        """Test pattern-based invalidation."""
        cache = L1Cache()

        await cache.set("workflow:1", "data1")
        await cache.set("workflow:2", "data2")
        await cache.set("user:1", "data3")

        await cache.invalidate("workflow")

        assert await cache.get("workflow:1") is None
        assert await cache.get("workflow:2") is None
        assert await cache.get("user:1") == "data3"

    async def test_l1_metrics(self):
        """Test metrics collection."""
        cache = L1Cache()

        await cache.set("key1", "value1")
        await cache.get("key1")  # hit
        await cache.get("key2")  # miss

        metrics = cache.get_metrics()

        assert metrics["hits"] == 1
        assert metrics["misses"] == 1
        assert metrics["hit_rate_percent"] == 50.0
        assert metrics["entries"] == 1


# ============================================================================
# L2 Redis Cache Tests (with fallback)
# ============================================================================

@pytest.mark.asyncio
class TestL2CacheRedis:
    """Tests for distributed L2 Redis cache."""

    async def test_l2_fallback_mode(self):
        """Test Redis cache graceful fallback when Redis unavailable."""
        # Use invalid URL to trigger fallback
        cache = L2CacheRedis(redis_url="redis://invalid:9999")

        assert cache.connected is False

        # Should not raise errors in fallback mode
        result = await cache.get("key1")
        assert result is None

        await cache.set("key1", "value1")  # No-op in fallback mode
        result = await cache.get("key1")
        assert result is None

    async def test_l2_metrics(self):
        """Test L2 metrics in fallback mode."""
        cache = L2CacheRedis(redis_url="redis://invalid:9999")

        await cache.get("key1")
        await cache.set("key1", "value1")

        metrics = cache.get_metrics()

        assert metrics["connected"] is False
        assert metrics["misses"] == 1


# ============================================================================
# Multi-Level Cache Tests
# ============================================================================

@pytest.mark.asyncio
class TestMultiLevelCache:
    """Tests for multi-level caching system."""

    async def test_mlc_l1_hit(self):
        """Test cache hit from L1."""
        cache = MultiLevelCache()

        await cache.set("key1", "value1", ttl=3600)
        result = await cache.get("key1")

        assert result == "value1"
        assert cache.l1.hits >= 1

    async def test_mlc_multi_type_values(self):
        """Test caching different data types."""
        cache = MultiLevelCache()

        # String
        await cache.set("str_key", "string_value")
        assert await cache.get("str_key") == "string_value"

        # Dict
        data = {"key": "value", "nested": {"data": 123}}
        await cache.set("dict_key", data)
        result = await cache.get("dict_key")
        assert result == data

        # List
        items = [1, 2, 3, "four"]
        await cache.set("list_key", items)
        result = await cache.get("list_key")
        assert result == items

    async def test_mlc_delete(self):
        """Test delete across all levels."""
        cache = MultiLevelCache()

        await cache.set("key1", "value1")
        await cache.delete("key1")

        result = await cache.get("key1")
        assert result is None

    async def test_mlc_clear(self):
        """Test clear across all levels."""
        cache = MultiLevelCache()

        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        await cache.clear()

        assert await cache.get("key1") is None
        assert await cache.get("key2") is None

    async def test_mlc_invalidate(self):
        """Test pattern-based invalidation across levels."""
        cache = MultiLevelCache()

        await cache.set("workflow:1", "data1")
        await cache.set("workflow:2", "data2")
        await cache.set("user:1", "data3")

        await cache.invalidate("workflow")

        assert await cache.get("workflow:1") is None
        assert await cache.get("workflow:2") is None
        assert await cache.get("user:1") == "data3"

    async def test_mlc_metrics(self):
        """Test aggregated metrics."""
        cache = MultiLevelCache()

        await cache.set("key1", "value1")
        await cache.get("key1")

        metrics = cache.get_metrics()

        assert "l1" in metrics
        assert "l2" in metrics
        assert metrics["l1"]["hits"] >= 1


# ============================================================================
# Cache Warming Tests
# ============================================================================

@pytest.mark.asyncio
class TestCacheWarming:
    """Tests for cache warming strategies."""

    async def test_warming_task_execution(self):
        """Test cache warming task execution."""
        cache = MultiLevelCache()
        warmer = CacheWarmer(cache)

        async def load_data():
            return {
                "workflow_1": {"id": 1, "name": "Workflow 1"},
                "workflow_2": {"id": 2, "name": "Workflow 2"},
            }

        result = await warmer.warm_cache(
            data_loader=load_data,
            key_prefix="workflows",
            ttl=3600,
        )

        assert result["success"] is True
        assert result["entries_warmed"] == 2
        assert result["entries_per_second"] > 0

    async def test_warming_task_registration(self):
        """Test warming task registration and execution."""
        cache = MultiLevelCache()
        warmer = CacheWarmer(cache)

        async def load_workflows():
            await asyncio.sleep(0.1)
            return {"wf1": "data1", "wf2": "data2"}

        warmer.register_warming_task(
            name="load_workflows",
            data_loader=load_workflows,
            key_prefix="workflow",
            initial_run=False,
        )

        assert "load_workflows" in {t["name"] for t in warmer.warming_tasks}

        # Manually run
        result = await warmer.warm_all()
        assert "load_workflows" in result
        assert result["load_workflows"]["success"] is True


# ============================================================================
# Decorator Tests
# ============================================================================

@pytest.mark.asyncio
class TestCacheDecorator:
    """Tests for @cached decorator."""

    async def test_cached_decorator(self):
        """Test @cached decorator functionality."""
        call_count = 0

        @cached(ttl=3600, prefix="test")
        async def expensive_function(x: int, y: int):
            nonlocal call_count
            call_count += 1
            return x + y

        # First call - should execute function
        result1 = await expensive_function(1, 2)
        assert result1 == 3
        assert call_count == 1

        # Second call - should hit cache
        result2 = await expensive_function(1, 2)
        assert result2 == 3
        assert call_count == 1  # Not incremented

    async def test_cached_different_args(self):
        """Test cached decorator with different arguments."""
        call_count = 0

        @cached(ttl=3600)
        async def multiply(x: int, y: int):
            nonlocal call_count
            call_count += 1
            return x * y

        await multiply(2, 3)
        await multiply(2, 3)  # Cache hit
        await multiply(3, 4)  # Different args - no hit
        await multiply(3, 4)  # Cache hit

        assert call_count == 2


# ============================================================================
# Cache Key Generation Tests
# ============================================================================

class TestCacheKeyGeneration:
    """Tests for cache key generation."""

    def test_cache_key_basic(self):
        """Test basic cache key generation."""
        key = cache_key("workflow", "123")
        assert isinstance(key, str)
        assert len(key) == 64  # SHA256 hex length

    def test_cache_key_with_prefix(self):
        """Test cache key with prefix."""
        key1 = cache_key("workflow", "123", prefix="api")
        key2 = cache_key("workflow", "123", prefix="task")

        assert key1 != key2

    def test_cache_key_consistency(self):
        """Test cache key consistency."""
        key1 = cache_key("a", "b", "c")
        key2 = cache_key("a", "b", "c")

        assert key1 == key2

    def test_cache_key_different_args(self):
        """Test different arguments produce different keys."""
        key1 = cache_key("a", "b")
        key2 = cache_key("a", "c")

        assert key1 != key2


# ============================================================================
# TTL Invalidation Strategy Tests
# ============================================================================

@pytest.mark.asyncio
class TestTTLInvalidation:
    """Tests for TTL-based invalidation."""

    async def test_ttl_registration(self):
        """Test TTL entry registration."""
        strategy = TTLInvalidationStrategy(default_ttl=3600)

        await strategy.register("key1", ttl=3600)
        assert "key1" in strategy.entries

    async def test_ttl_expiration_detection(self):
        """Test detection of expired entries."""
        strategy = TTLInvalidationStrategy()

        await strategy.register("key1", ttl=1)
        await asyncio.sleep(1.5)

        expired = await strategy.check_expired()
        assert "key1" in expired

    async def test_ttl_cleanup(self):
        """Test cleanup of expired entries."""
        strategy = TTLInvalidationStrategy()

        await strategy.register("key1", ttl=1)
        await strategy.register("key2", ttl=3600)
        await asyncio.sleep(1.5)

        cleaned = await strategy.cleanup()
        assert cleaned == 1
        assert "key2" in strategy.entries


# ============================================================================
# Event-Based Invalidation Tests
# ============================================================================

@pytest.mark.asyncio
class TestEventInvalidation:
    """Tests for event-based invalidation."""

    async def test_event_subscription(self):
        """Test event subscription."""
        strategy = EventBasedInvalidationStrategy()

        handler_called = []

        async def on_update(data):
            handler_called.append(data)

        await strategy.subscribe("workflow:updated", on_update)
        assert "workflow:updated" in strategy.listeners

    async def test_event_publishing(self):
        """Test event publishing and handler execution."""
        strategy = EventBasedInvalidationStrategy()

        handler_data = []

        async def on_update(data):
            handler_data.append(data)

        await strategy.subscribe("workflow:updated", on_update)
        count = await strategy.publish("workflow:updated", {"workflow_id": "123"})

        assert count == 1
        assert len(handler_data) == 1
        assert handler_data[0]["workflow_id"] == "123"

    async def test_event_history(self):
        """Test event history tracking."""
        strategy = EventBasedInvalidationStrategy()

        async def noop(data):
            pass

        await strategy.subscribe("test:event", noop)
        await strategy.publish("test:event", {"data": "value"})

        history = strategy.get_event_history()
        assert len(history) >= 1


# ============================================================================
# Pattern Invalidation Tests
# ============================================================================

@pytest.mark.asyncio
class TestPatternInvalidation:
    """Tests for pattern-based invalidation."""

    async def test_pattern_registration(self):
        """Test pattern registration."""
        strategy = PatternBasedInvalidationStrategy()

        await strategy.register_pattern("workflow:*", "workflow:123")
        assert "workflow:*" in strategy.patterns

    async def test_pattern_matching(self):
        """Test pattern matching."""
        strategy = PatternBasedInvalidationStrategy()

        assert strategy._pattern_matches("workflow:123", "workflow:*")
        assert not strategy._pattern_matches("user:123", "workflow:*")
        assert strategy._pattern_matches("data:123:nested", "*")

    async def test_pattern_invalidation(self):
        """Test pattern-based invalidation."""
        strategy = PatternBasedInvalidationStrategy()

        await strategy.register_pattern("workflow:*", "workflow:1")
        await strategy.register_pattern("workflow:*", "workflow:2")
        await strategy.register_pattern("user:*", "user:1")

        invalidated = await strategy.invalidate_pattern("workflow:*")
        assert invalidated == 2


# ============================================================================
# Performance Monitoring Tests
# ============================================================================

class TestPerformanceMonitoring:
    """Tests for cache performance monitoring."""

    def test_monitor_hit_recording(self):
        """Test recording cache hits."""
        monitor = CachePerformanceMonitor()

        monitor.record_hit("key1", cache_level="l1", duration_ms=0.5)
        monitor.record_hit("key2", cache_level="l1", duration_ms=0.3)

        summary = monitor.get_summary()
        assert summary["total_hits"] == 2

    def test_monitor_miss_recording(self):
        """Test recording cache misses."""
        monitor = CachePerformanceMonitor()

        monitor.record_hit("key1", cache_level="l1", duration_ms=0.5)
        monitor.record_miss("key2", cache_level="l1", duration_ms=0.1)

        summary = monitor.get_summary()
        assert summary["total_misses"] == 1
        assert summary["hit_rate_percent"] == 50.0

    def test_monitor_latency_tracking(self):
        """Test latency tracking."""
        monitor = CachePerformanceMonitor()

        monitor.record_hit("key1", duration_ms=1.0)
        monitor.record_hit("key2", duration_ms=2.0)
        monitor.record_hit("key3", duration_ms=3.0)

        summary = monitor.get_summary()
        assert summary["avg_latency_ms"] == pytest.approx(2.0, abs=0.1)

    def test_monitor_by_level(self):
        """Test metrics by cache level."""
        monitor = CachePerformanceMonitor()

        monitor.record_hit("key1", cache_level="l1", duration_ms=0.5)
        monitor.record_hit("key2", cache_level="l1", duration_ms=0.3)
        monitor.record_miss("key3", cache_level="l2", duration_ms=5.0)

        l1_metrics = monitor.get_by_level("l1")
        assert l1_metrics["hits"] == 2
        assert l1_metrics["hit_rate_percent"] == 100.0

        l2_metrics = monitor.get_by_level("l2")
        assert l2_metrics["misses"] == 1


# ============================================================================
# Prometheus Metrics Tests
# ============================================================================

class TestPrometheusMetrics:
    """Tests for Prometheus metrics export."""

    def test_prometheus_gauge(self):
        """Test gauge metric."""
        metrics = PrometheusMetrics()

        metrics.set_gauge("test_metric", 42.0)
        all_metrics = metrics.get_all()

        assert all_metrics["test_metric"] == 42.0

    def test_prometheus_counter(self):
        """Test counter metric."""
        metrics = PrometheusMetrics()

        metrics.increment_counter("request_count")
        metrics.increment_counter("request_count")

        all_metrics = metrics.get_all()
        assert all_metrics["request_count"] == 2.0

    def test_prometheus_histogram(self):
        """Test histogram metric."""
        metrics = PrometheusMetrics()

        metrics.record_histogram("request_latency_ms", 10.0)
        metrics.record_histogram("request_latency_ms", 20.0)

        all_metrics = metrics.get_all()
        assert all_metrics["request_latency_ms_sum"] == 30.0
        assert all_metrics["request_latency_ms_count"] == 2.0

    def test_prometheus_export(self):
        """Test Prometheus text export."""
        metrics = PrometheusMetrics()

        metrics.set_gauge("test_metric", 42.0)
        text = metrics.export_text()

        assert "test_metric" in text
        assert "42.0" in text


# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.asyncio
class TestIntegration:
    """Integration tests for full caching system."""

    async def test_full_workflow_caching(self):
        """Test complete caching workflow."""
        cache = MultiLevelCache()
        monitor = get_performance_monitor()
        monitor.clear()

        # Set values
        workflow_data = {"id": "wf1", "name": "Test Workflow", "status": "active"}
        await cache.set("workflow:wf1", workflow_data, ttl=3600)

        # Get values with monitoring
        start = time.time()
        result = await cache.get("workflow:wf1")
        duration = (time.time() - start) * 1000

        assert result == workflow_data

        # Monitor performance
        monitor.record_hit("workflow:wf1", cache_level="l1", duration_ms=duration)
        summary = monitor.get_summary()

        assert summary["total_hits"] >= 1
        assert summary["avg_latency_ms"] < 100  # Should be fast in-memory

    async def test_cache_warming_and_retrieval(self):
        """Test cache warming followed by retrieval."""
        cache = MultiLevelCache()
        warmer = CacheWarmer(cache)

        async def load_initial_data():
            return {
                "workflow_1": {"id": 1, "name": "Workflow 1"},
                "workflow_2": {"id": 2, "name": "Workflow 2"},
                "workflow_3": {"id": 3, "name": "Workflow 3"},
            }

        # Warm cache
        warm_result = await warmer.warm_cache(
            data_loader=load_initial_data,
            key_prefix="preloaded",
            ttl=3600,
        )

        assert warm_result["success"] is True
        assert warm_result["entries_warmed"] == 3

        # Retrieve warmed data
        data = await cache.get("preloaded:workflow_1")
        assert data is not None
        assert data["id"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
