#!/usr/bin/env python3
"""
Cache Performance Benchmarks
============================

Demonstrates cache hit rates, latency, and efficiency.
Run with: python3 benchmarks/benchmark_cache.py
"""

import asyncio
import time
import random
import string
from typing import Dict, Any


async def benchmark_l1_cache():
    """Benchmark L1 in-memory cache."""
    print("\n" + "="*60)
    print("L1 CACHE (In-Memory) BENCHMARK")
    print("="*60)

    from autoflow.core.caching import L1Cache

    cache = L1Cache(max_size=10000, default_ttl=3600)

    # Warm up
    print("\n[1] Warm-up: Setting 1000 entries...")
    start = time.time()
    for i in range(1000):
        await cache.set(f"key_{i}", f"value_{i}")
    warmup_time = time.time() - start
    print(f"    Set 1000 entries in {warmup_time:.2f}s ({1000/warmup_time:.0f} ops/sec)")

    # Random reads (80% hit rate expected)
    print("\n[2] Random reads: 5000 requests (expect 80% hit rate)...")
    start = time.time()
    hits = 0
    for _ in range(5000):
        key = f"key_{random.randint(0, 1999)}"  # Some misses
        if await cache.get(key) is not None:
            hits += 1
    read_time = time.time() - start
    hit_rate = (hits / 5000) * 100
    latency = (read_time / 5000) * 1000

    print(f"    5000 reads in {read_time:.2f}s ({5000/read_time:.0f} ops/sec)")
    print(f"    Hit rate: {hit_rate:.1f}%")
    print(f"    Avg latency: {latency:.3f}ms")

    # Metrics
    metrics = cache.get_metrics()
    print(f"\n[3] Final metrics:")
    print(f"    Entries: {metrics['entries']}")
    print(f"    Total hits: {metrics['hits']}")
    print(f"    Total misses: {metrics['misses']}")
    print(f"    Evictions: {metrics['evictions']}")


async def benchmark_multi_level_cache():
    """Benchmark multi-level cache (L1 + L2)."""
    print("\n" + "="*60)
    print("MULTI-LEVEL CACHE BENCHMARK")
    print("="*60)

    from autoflow.core.caching import MultiLevelCache

    cache = MultiLevelCache(l1_max_size=5000, l1_ttl=3600)

    # Set values
    print("\n[1] Setting 1000 entries...")
    start = time.time()
    for i in range(1000):
        data = {
            "id": i,
            "name": f"item_{i}",
            "data": "x" * 100
        }
        await cache.set(f"item_{i}", data, ttl=3600)
    set_time = time.time() - start
    print(f"    Set 1000 entries in {set_time:.2f}s")

    # L1 hits (warm cache)
    print("\n[2] L1 hits (warm cache): 1000 reads...")
    start = time.time()
    for i in range(1000):
        await cache.get(f"item_{i}")
    l1_time = time.time() - start
    l1_latency = (l1_time / 1000) * 1000
    print(f"    1000 reads in {l1_time:.3f}s")
    print(f"    Avg latency: {l1_latency:.3f}ms (L1 hit)")

    # Mixed reads
    print("\n[3] Mixed reads: 2000 requests...")
    start = time.time()
    for _ in range(2000):
        key = f"item_{random.randint(0, 999)}"
        await cache.get(key)
    mixed_time = time.time() - start
    mixed_latency = (mixed_time / 2000) * 1000
    print(f"    2000 reads in {mixed_time:.3f}s")
    print(f"    Avg latency: {mixed_latency:.3f}ms")

    # Metrics
    metrics = cache.get_metrics()
    print(f"\n[4] Final metrics:")
    print(f"    L1 hit rate: {metrics['l1']['hit_rate_percent']:.1f}%")
    print(f"    L1 entries: {metrics['l1']['entries']}")
    print(f"    L2 status: {'Connected' if metrics['l2']['connected'] else 'Fallback'}")


async def benchmark_cache_decorator():
    """Benchmark @cached decorator."""
    print("\n" + "="*60)
    print("CACHE DECORATOR BENCHMARK")
    print("="*60)

    from autoflow.core.caching import cached, get_cache

    # Clear cache first
    await get_cache().clear()

    call_count = 0

    @cached(ttl=3600, prefix="test")
    async def expensive_function(x: int):
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.01)  # Simulate work
        return x * 2

    # First calls (cache misses)
    print("\n[1] First 100 calls (cache misses)...")
    start = time.time()
    for i in range(100):
        await expensive_function(i)
    miss_time = time.time() - start
    print(f"    100 calls in {miss_time:.2f}s ({100/miss_time:.0f} calls/sec)")
    print(f"    Actual function calls: {call_count}")

    # Repeated calls (cache hits)
    print("\n[2] Repeated 100 calls (cache hits)...")
    start = time.time()
    for i in range(100):
        await expensive_function(i)
    hit_time = time.time() - start
    print(f"    100 calls in {hit_time:.3f}s ({100/hit_time:.0f} calls/sec)")
    print(f"    Actual function calls: {call_count} (no new calls)")

    speedup = miss_time / hit_time
    print(f"\n[3] Speedup: {speedup:.1f}x faster with cache!")


async def benchmark_cache_warming():
    """Benchmark cache warming."""
    print("\n" + "="*60)
    print("CACHE WARMING BENCHMARK")
    print("="*60)

    from autoflow.core.caching import MultiLevelCache, CacheWarmer

    cache = MultiLevelCache()
    warmer = CacheWarmer(cache)

    async def load_large_dataset():
        """Simulate loading large dataset."""
        await asyncio.sleep(0.1)  # Simulate I/O
        return {f"item_{i}": {"data": "x" * 50} for i in range(1000)}

    print("\n[1] Warming cache with 1000 items...")
    result = await warmer.warm_cache(
        load_large_dataset,
        key_prefix="warmed",
        ttl=3600,
    )

    print(f"    Entries warmed: {result['entries_warmed']}")
    print(f"    Time elapsed: {result['elapsed_seconds']:.2f}s")
    print(f"    Throughput: {result['entries_per_second']:.0f} items/sec")

    # Verify data is cached
    print("\n[2] Verifying cached data...")
    start = time.time()
    count = 0
    for i in range(1000):
        if await cache.get(f"warmed:item_{i}") is not None:
            count += 1
    retrieval_time = time.time() - start

    print(f"    Found {count}/1000 items in {retrieval_time:.3f}s")
    print(f"    Avg retrieval: {(retrieval_time/1000)*1000:.3f}ms")


async def benchmark_pattern_invalidation():
    """Benchmark pattern-based invalidation."""
    print("\n" + "="*60)
    print("PATTERN INVALIDATION BENCHMARK")
    print("="*60)

    from autoflow.core.caching import MultiLevelCache

    cache = MultiLevelCache()

    # Set up cache with patterns
    print("\n[1] Setting up cache with 3000 items (3 patterns)...")
    start = time.time()
    for i in range(1000):
        await cache.set(f"workflow:{i}", f"workflow_data_{i}")
        await cache.set(f"user:{i}", f"user_data_{i}")
        await cache.set(f"config:{i}", f"config_data_{i}")
    setup_time = time.time() - start
    print(f"    Set 3000 items in {setup_time:.2f}s")

    # Invalidate workflow pattern
    print("\n[2] Invalidating 'workflow:*' pattern...")
    start = time.time()
    await cache.invalidate("workflow")
    invalidate_time = time.time() - start
    print(f"    Invalidated in {invalidate_time:.3f}s")

    # Verify
    print("\n[3] Verifying invalidation...")
    workflow_count = sum([
        1 for i in range(1000)
        if await cache.get(f"workflow:{i}") is not None
    ])
    user_count = sum([
        1 for i in range(1000)
        if await cache.get(f"user:{i}") is not None
    ])

    print(f"    Workflow items remaining: {workflow_count} (expect 0)")
    print(f"    User items remaining: {user_count} (expect 1000)")


async def benchmark_monitoring():
    """Benchmark performance monitoring."""
    print("\n" + "="*60)
    print("MONITORING BENCHMARK")
    print("="*60)

    from autoflow.cache.monitoring import get_performance_monitor

    monitor = get_performance_monitor()
    monitor.clear()

    print("\n[1] Recording 10000 cache operations...")
    start = time.time()
    for i in range(10000):
        if random.random() < 0.8:  # 80% hit rate
            monitor.record_hit(f"key_{i}", cache_level="l1", duration_ms=0.5)
        else:
            monitor.record_miss(f"key_{i}", cache_level="l2", duration_ms=5.0)

        if i % 100 == 0 and i > 0:
            monitor.record_eviction(f"key_{i-1}", cache_level="l1")
    record_time = time.time() - start
    print(f"    Recorded 10000 ops in {record_time:.2f}s ({10000/record_time:.0f} ops/sec)")

    # Get metrics
    print("\n[2] Metrics:")
    summary = monitor.get_summary()
    print(f"    Total hits: {summary['total_hits']}")
    print(f"    Total misses: {summary['total_misses']}")
    print(f"    Hit rate: {summary['hit_rate_percent']:.1f}%")
    print(f"    Avg latency: {summary['avg_latency_ms']:.3f}ms")
    print(f"    P99 latency: {summary['p99_latency_ms']:.3f}ms")


async def main():
    """Run all benchmarks."""
    print("\n" + "█"*60)
    print("█ AUTOFLOW CACHING SYSTEM BENCHMARKS")
    print("█"*60)

    try:
        await benchmark_l1_cache()
        await benchmark_multi_level_cache()
        await benchmark_cache_decorator()
        await benchmark_cache_warming()
        await benchmark_pattern_invalidation()
        await benchmark_monitoring()

        print("\n" + "="*60)
        print("✅ ALL BENCHMARKS COMPLETED SUCCESSFULLY")
        print("="*60 + "\n")

    except Exception as e:
        print(f"\n❌ Benchmark failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
