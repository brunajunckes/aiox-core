"""
Cache Invalidation & Warming Strategies
========================================

Implements TTL-based, event-based, and pattern-based cache invalidation strategies.
"""

import asyncio
import logging
import time
from typing import Optional, Dict, Any, Callable, List, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

log = logging.getLogger("cache_strategies")


class InvalidationStrategy(str, Enum):
    """Cache invalidation strategies."""

    TTL = "ttl"  # Time-based invalidation
    EVENT = "event"  # Event-driven invalidation
    PATTERN = "pattern"  # Pattern-based invalidation
    MANUAL = "manual"  # Manual invalidation


@dataclass
class CacheEntry:
    """Cache entry metadata."""

    key: str
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    ttl: Optional[int] = None
    strategy: InvalidationStrategy = InvalidationStrategy.TTL
    access_count: int = 0

    def is_expired(self) -> bool:
        """Check if entry has expired based on TTL."""
        if self.ttl is None:
            return False
        return time.time() - self.created_at > self.ttl

    def age_seconds(self) -> float:
        """Get age of entry in seconds."""
        return time.time() - self.created_at


class TTLInvalidationStrategy:
    """Time-to-live based cache invalidation."""

    def __init__(self, default_ttl: int = 3600):
        """
        Initialize TTL strategy.

        Args:
            default_ttl: Default TTL in seconds (default: 1 hour)
        """
        self.default_ttl = default_ttl
        self.entries: Dict[str, CacheEntry] = {}

    async def register(
        self,
        key: str,
        ttl: Optional[int] = None,
    ) -> None:
        """
        Register cache entry with TTL.

        Args:
            key: Cache key
            ttl: TTL in seconds (default: uses default_ttl)
        """
        ttl = ttl or self.default_ttl
        self.entries[key] = CacheEntry(
            key=key,
            ttl=ttl,
            strategy=InvalidationStrategy.TTL,
        )
        log.debug(f"[TTL Strategy] Registered: {key} (TTL: {ttl}s)")

    async def check_expired(self) -> List[str]:
        """
        Check for expired entries.

        Returns:
            List of expired keys
        """
        expired = []
        for key, entry in list(self.entries.items()):
            if entry.is_expired():
                expired.append(key)
                del self.entries[key]

        if expired:
            log.info(f"[TTL Strategy] Found {len(expired)} expired entries")

        return expired

    async def cleanup(self) -> int:
        """
        Remove all expired entries.

        Returns:
            Number of entries cleaned
        """
        expired = await self.check_expired()
        return len(expired)


class EventBasedInvalidationStrategy:
    """Event-driven cache invalidation."""

    def __init__(self):
        """Initialize event-based strategy."""
        self.listeners: Dict[str, List[Callable]] = {}
        self.event_history: List[Dict[str, Any]] = []

    async def subscribe(self, event_type: str, handler: Callable) -> None:
        """
        Subscribe to cache invalidation events.

        Args:
            event_type: Event type to listen for (e.g., "workflow:updated")
            handler: Async handler function
        """
        if event_type not in self.listeners:
            self.listeners[event_type] = []

        self.listeners[event_type].append(handler)
        log.info(f"[Event Strategy] Subscribed to {event_type}")

    async def publish(
        self,
        event_type: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        Publish invalidation event.

        Args:
            event_type: Event type
            data: Event data

        Returns:
            Number of handlers triggered
        """
        handlers = self.listeners.get(event_type, [])

        # Record event
        self.event_history.append({
            "event_type": event_type,
            "timestamp": time.time(),
            "handlers_count": len(handlers),
            "data": data,
        })

        # Call all handlers in parallel
        if handlers:
            await asyncio.gather(
                *[handler(data) for handler in handlers],
                return_exceptions=True,
            )

        log.info(f"[Event Strategy] Published {event_type} to {len(handlers)} handlers")

        return len(handlers)

    def get_event_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get recent event history.

        Args:
            limit: Max events to return

        Returns:
            Recent events
        """
        return self.event_history[-limit:]


class PatternBasedInvalidationStrategy:
    """Pattern-based cache invalidation for query results."""

    def __init__(self):
        """Initialize pattern strategy."""
        self.patterns: Dict[str, Set[str]] = {}  # pattern -> keys
        self.invalidation_log: List[Dict[str, Any]] = []

    async def register_pattern(self, pattern: str, key: str) -> None:
        """
        Register cache key with pattern.

        Args:
            pattern: Pattern (e.g., "workflow:*", "user:123:*")
            key: Cache key
        """
        if pattern not in self.patterns:
            self.patterns[pattern] = set()

        self.patterns[pattern].add(key)
        log.debug(f"[Pattern Strategy] Registered {key} with pattern {pattern}")

    async def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys matching pattern.

        Args:
            pattern: Pattern to match (supports * wildcard)

        Returns:
            Number of keys invalidated
        """
        invalidated = 0

        # Find matching patterns
        for registered_pattern, keys in list(self.patterns.items()):
            if self._pattern_matches(pattern, registered_pattern):
                invalidated += len(keys)
                self.patterns[registered_pattern].clear()

                self.invalidation_log.append({
                    "timestamp": time.time(),
                    "pattern": pattern,
                    "matched_pattern": registered_pattern,
                    "keys_invalidated": len(keys),
                })

        log.info(f"[Pattern Strategy] Invalidated {invalidated} keys for pattern {pattern}")

        return invalidated

    def _pattern_matches(self, target: str, pattern: str) -> bool:
        """Check if target matches pattern (simple * wildcard matching)."""
        if pattern == "*" or target == "*":
            return True

        # Convert pattern to regex-like matching
        target_parts = target.split(":")
        pattern_parts = pattern.split(":")

        if len(target_parts) != len(pattern_parts):
            return False

        for target_part, pattern_part in zip(target_parts, pattern_parts):
            if pattern_part == "*":
                continue
            if target_part != pattern_part:
                return False

        return True

    def get_invalidation_log(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get invalidation history.

        Args:
            limit: Max entries to return

        Returns:
            Invalidation history
        """
        return self.invalidation_log[-limit:]


class CacheWarmingStrategy:
    """Cache pre-loading and warm-up strategies."""

    def __init__(self):
        """Initialize cache warming."""
        self.warming_tasks: Dict[str, Dict[str, Any]] = {}
        self.warming_log: List[Dict[str, Any]] = []

    async def register_warming_task(
        self,
        task_id: str,
        loader_func: Callable,
        schedule: Optional[str] = None,
        initial_run: bool = True,
    ) -> None:
        """
        Register cache warming task.

        Args:
            task_id: Task identifier
            loader_func: Async function that returns dict of {key: value}
            schedule: Cron schedule (optional, for recurring warm-up)
            initial_run: Whether to run immediately on registration
        """
        self.warming_tasks[task_id] = {
            "loader_func": loader_func,
            "schedule": schedule,
            "registered_at": time.time(),
            "last_run": None,
            "run_count": 0,
        }

        if initial_run:
            await self.run_warming_task(task_id)

        log.info(f"[Warming Strategy] Registered task: {task_id}")

    async def run_warming_task(self, task_id: str) -> Dict[str, Any]:
        """
        Run a warming task immediately.

        Args:
            task_id: Task identifier

        Returns:
            Warming statistics
        """
        if task_id not in self.warming_tasks:
            return {"error": f"Task {task_id} not found"}

        task = self.warming_tasks[task_id]
        loader_func = task["loader_func"]

        try:
            start_time = time.time()
            data = await loader_func()

            elapsed = time.time() - start_time
            entry_count = len(data) if isinstance(data, dict) else 0

            result = {
                "task_id": task_id,
                "timestamp": start_time,
                "success": True,
                "entries_warmed": entry_count,
                "elapsed_seconds": round(elapsed, 2),
                "entries_per_second": round(entry_count / elapsed, 2) if elapsed > 0 else 0,
            }

            task["last_run"] = time.time()
            task["run_count"] += 1

            self.warming_log.append(result)

            log.info(
                f"[Warming Strategy] Task {task_id} completed: "
                f"{entry_count} entries in {elapsed:.2f}s"
            )

            return result

        except Exception as e:
            result = {
                "task_id": task_id,
                "timestamp": time.time(),
                "success": False,
                "error": str(e),
            }

            self.warming_log.append(result)

            log.error(f"[Warming Strategy] Task {task_id} failed: {e}")

            return result

    async def run_all_warming_tasks(self) -> Dict[str, Dict[str, Any]]:
        """
        Run all registered warming tasks.

        Returns:
            Results for all tasks
        """
        results = {}
        for task_id in self.warming_tasks.keys():
            results[task_id] = await self.run_warming_task(task_id)

        return results

    def get_warming_log(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get warming execution history."""
        return self.warming_log[-limit:]

    def get_task_stats(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a warming task."""
        if task_id not in self.warming_tasks:
            return None

        task = self.warming_tasks[task_id]
        return {
            "task_id": task_id,
            "registered_at": datetime.fromtimestamp(task["registered_at"]).isoformat(),
            "last_run": (
                datetime.fromtimestamp(task["last_run"]).isoformat()
                if task["last_run"]
                else None
            ),
            "run_count": task["run_count"],
        }


class CacheInvalidationManager:
    """Unified cache invalidation orchestrator."""

    def __init__(self):
        """Initialize invalidation manager."""
        self.ttl_strategy = TTLInvalidationStrategy()
        self.event_strategy = EventBasedInvalidationStrategy()
        self.pattern_strategy = PatternBasedInvalidationStrategy()
        self.warming_strategy = CacheWarmingStrategy()

    async def register_ttl(self, key: str, ttl: Optional[int] = None) -> None:
        """Register cache entry with TTL."""
        await self.ttl_strategy.register(key, ttl)

    async def subscribe_event(self, event_type: str, handler: Callable) -> None:
        """Subscribe to cache invalidation events."""
        await self.event_strategy.subscribe(event_type, handler)

    async def publish_event(
        self,
        event_type: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Publish invalidation event."""
        return await self.event_strategy.publish(event_type, data)

    async def register_pattern(self, pattern: str, key: str) -> None:
        """Register cache key with pattern."""
        await self.pattern_strategy.register_pattern(pattern, key)

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate keys matching pattern."""
        return await self.pattern_strategy.invalidate_pattern(pattern)

    async def cleanup_expired(self) -> int:
        """Clean up expired entries."""
        return await self.ttl_strategy.cleanup()

    def get_metrics(self) -> Dict[str, Any]:
        """Get invalidation metrics."""
        return {
            "ttl_entries": len(self.ttl_strategy.entries),
            "event_listeners": sum(
                len(v) for v in self.event_strategy.listeners.values()
            ),
            "event_history_size": len(self.event_strategy.event_history),
            "pattern_registrations": len(self.pattern_strategy.patterns),
            "warming_tasks": len(self.warming_strategy.warming_tasks),
            "warming_history_size": len(self.warming_strategy.warming_log),
        }


# Global instance
_invalidation_manager: Optional[CacheInvalidationManager] = None


def get_invalidation_manager() -> CacheInvalidationManager:
    """Get or create global invalidation manager."""
    global _invalidation_manager
    if _invalidation_manager is None:
        _invalidation_manager = CacheInvalidationManager()
    return _invalidation_manager
