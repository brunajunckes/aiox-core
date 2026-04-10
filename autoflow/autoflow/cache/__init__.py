"""
Advanced Caching Module
=======================

Multi-level caching (L1 in-memory, L2 Redis) with invalidation strategies,
warming, and comprehensive monitoring.
"""

from .redis_cache import (
    RedisCache,
    RedisConnectionPool,
    RedisSerializer,
    create_redis_cache,
)

from .strategies import (
    CacheInvalidationManager,
    TTLInvalidationStrategy,
    EventBasedInvalidationStrategy,
    PatternBasedInvalidationStrategy,
    CacheWarmingStrategy,
    get_invalidation_manager,
    InvalidationStrategy,
)

from .monitoring import (
    CachePerformanceMonitor,
    PrometheusMetrics,
    get_performance_monitor,
    get_prometheus_metrics,
    sync_monitor_to_prometheus,
)

__all__ = [
    # Redis Cache
    "RedisCache",
    "RedisConnectionPool",
    "RedisSerializer",
    "create_redis_cache",
    # Strategies
    "CacheInvalidationManager",
    "TTLInvalidationStrategy",
    "EventBasedInvalidationStrategy",
    "PatternBasedInvalidationStrategy",
    "CacheWarmingStrategy",
    "get_invalidation_manager",
    "InvalidationStrategy",
    # Monitoring
    "CachePerformanceMonitor",
    "PrometheusMetrics",
    "get_performance_monitor",
    "get_prometheus_metrics",
    "sync_monitor_to_prometheus",
]
