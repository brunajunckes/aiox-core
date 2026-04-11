"""
Redis Cache Integration
=======================

Provides connection pooling, serialization, and error handling for Redis-backed caching.
"""

import json
import logging
import os
from typing import Optional, Any, Dict
from contextlib import asynccontextmanager
import asyncio

log = logging.getLogger("redis_cache")


class RedisConnectionPool:
    """Manages Redis connection pooling with health checks."""

    def __init__(self, redis_url: str = "redis://redis:6379"):
        """
        Initialize connection pool.

        Args:
            redis_url: Redis connection URL
        """
        self.redis_url = redis_url
        self.pool = None
        self.redis = None
        self.healthy = False
        self._connect()

    def _connect(self) -> None:
        """Establish Redis connection pool."""
        try:
            import redis
            from redis import ConnectionPool

            # Parse URL
            parsed = redis.connection.parse_url(self.redis_url)

            # Create pool with connection reuse
            self.pool = ConnectionPool(
                max_connections=20,
                socket_connect_timeout=5,
                socket_keepalive=True,
                socket_keepalive_options={
                    1: 1,  # TCP_KEEPIDLE
                    2: 1,  # TCP_KEEPINTVL
                    3: 3,  # TCP_KEEPCNT
                } if os.name == "posix" else {},
                health_check_interval=30,
                **parsed,
            )

            self.redis = redis.Redis(connection_pool=self.pool)
            self.redis.ping()
            self.healthy = True

            log.info(f"[Redis Pool] Connected to {self.redis_url}")

        except Exception as e:
            self.healthy = False
            log.error(f"[Redis Pool] Connection failed: {e}")

    @asynccontextmanager
    async def acquire(self):
        """
        Acquire connection from pool.

        Yields:
            Redis client connection
        """
        if not self.healthy or self.redis is None:
            raise RuntimeError("Redis connection not healthy")

        try:
            yield self.redis
        except Exception as e:
            log.error(f"[Redis Pool] Connection error: {e}")
            self.healthy = False
            # Attempt reconnect
            await asyncio.sleep(1)
            self._connect()
            raise

    def close(self) -> None:
        """Close connection pool."""
        if self.pool:
            self.pool.disconnect()
            log.info("[Redis Pool] Closed")


class RedisSerializer:
    """Handles serialization/deserialization for Redis storage."""

    @staticmethod
    def serialize(value: Any) -> str:
        """
        Serialize value to JSON string.

        Args:
            value: Value to serialize

        Returns:
            JSON string
        """
        try:
            return json.dumps(value, default=str)
        except (TypeError, ValueError) as e:
            log.error(f"[Redis Serializer] Serialization error: {e}")
            return str(value)

    @staticmethod
    def deserialize(value: str) -> Any:
        """
        Deserialize JSON string back to value.

        Args:
            value: JSON string

        Returns:
            Deserialized value
        """
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return value


class RedisCache:
    """High-level Redis cache with connection pooling and serialization."""

    def __init__(
        self,
        redis_url: str = "redis://redis:6379",
        namespace: str = "autoflow",
        default_ttl: int = 3600,
    ):
        """
        Initialize Redis cache.

        Args:
            redis_url: Redis connection URL
            namespace: Key namespace for isolation
            default_ttl: Default TTL in seconds
        """
        self.redis_url = redis_url
        self.namespace = namespace
        self.default_ttl = default_ttl
        self.pool = RedisConnectionPool(redis_url)
        self.serializer = RedisSerializer()

    def _make_key(self, key: str) -> str:
        """Create fully-qualified cache key with namespace."""
        return f"{self.namespace}::{key}"

    def _make_pattern(self, pattern: str) -> str:
        """Create pattern for key matching."""
        return f"{self.namespace}::{pattern}*"

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None
        """
        try:
            async with self.pool.acquire() as redis:
                full_key = self._make_key(key)
                value = redis.get(full_key)

                if value is None:
                    return None

                if isinstance(value, bytes):
                    value = value.decode()

                return self.serializer.deserialize(value)

        except Exception as e:
            log.error(f"[Redis Cache] Get error for {key}: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Set value in cache with optional TTL.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (default: 1 hour)

        Returns:
            Success status
        """
        try:
            ttl = ttl or self.default_ttl
            async with self.pool.acquire() as redis:
                full_key = self._make_key(key)
                serialized = self.serializer.serialize(value)

                redis.setex(full_key, ttl, serialized)
                log.debug(f"[Redis Cache] Set: {key} (TTL: {ttl}s)")
                return True

        except Exception as e:
            log.error(f"[Redis Cache] Set error for {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete key from cache.

        Args:
            key: Cache key

        Returns:
            Success status
        """
        try:
            async with self.pool.acquire() as redis:
                full_key = self._make_key(key)
                redis.delete(full_key)
                log.debug(f"[Redis Cache] Deleted: {key}")
                return True

        except Exception as e:
            log.error(f"[Redis Cache] Delete error for {key}: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """
        Check if key exists in cache.

        Args:
            key: Cache key

        Returns:
            Existence status
        """
        try:
            async with self.pool.acquire() as redis:
                full_key = self._make_key(key)
                return redis.exists(full_key) > 0

        except Exception as e:
            log.error(f"[Redis Cache] Exists error for {key}: {e}")
            return False

    async def get_ttl(self, key: str) -> Optional[int]:
        """
        Get remaining TTL for key in seconds.

        Args:
            key: Cache key

        Returns:
            TTL in seconds or None if key doesn't exist
        """
        try:
            async with self.pool.acquire() as redis:
                full_key = self._make_key(key)
                ttl = redis.ttl(full_key)

                if ttl == -1:  # No expiration set
                    return None
                elif ttl == -2:  # Key doesn't exist
                    return None
                else:
                    return ttl

        except Exception as e:
            log.error(f"[Redis Cache] TTL error for {key}: {e}")
            return None

    async def extend_ttl(self, key: str, additional_ttl: int) -> bool:
        """
        Extend TTL for existing key.

        Args:
            key: Cache key
            additional_ttl: Additional seconds to add

        Returns:
            Success status
        """
        try:
            async with self.pool.acquire() as redis:
                full_key = self._make_key(key)
                current_ttl = redis.ttl(full_key)

                if current_ttl <= 0:
                    return False

                new_ttl = current_ttl + additional_ttl
                redis.expire(full_key, new_ttl)
                log.debug(f"[Redis Cache] Extended TTL: {key} (new: {new_ttl}s)")
                return True

        except Exception as e:
            log.error(f"[Redis Cache] Extend TTL error for {key}: {e}")
            return False

    async def clear(self, pattern: Optional[str] = None) -> int:
        """
        Clear cache entries.

        Args:
            pattern: Optional pattern to match keys (e.g., "workflow:*")

        Returns:
            Number of keys deleted
        """
        try:
            async with self.pool.acquire() as redis:
                if pattern:
                    search_pattern = self._make_pattern(pattern)
                else:
                    search_pattern = self._make_pattern("*")

                keys = redis.keys(search_pattern)
                if keys:
                    redis.delete(*keys)

                log.info(f"[Redis Cache] Cleared {len(keys)} keys")
                return len(keys)

        except Exception as e:
            log.error(f"[Redis Cache] Clear error: {e}")
            return 0

    async def increment(self, key: str, delta: int = 1) -> Optional[int]:
        """
        Increment numeric value in cache.

        Args:
            key: Cache key
            delta: Amount to increment (default: 1)

        Returns:
            New value or None on error
        """
        try:
            async with self.pool.acquire() as redis:
                full_key = self._make_key(key)
                return redis.incrby(full_key, delta)

        except Exception as e:
            log.error(f"[Redis Cache] Increment error for {key}: {e}")
            return None

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get Redis cache statistics.

        Returns:
            Cache statistics
        """
        try:
            async with self.pool.acquire() as redis:
                info = redis.info()
                pattern = self._make_pattern("*")
                keys = redis.keys(pattern)

                return {
                    "namespace": self.namespace,
                    "keys_count": len(keys),
                    "redis_memory_mb": round(info.get("used_memory", 0) / 1024 / 1024, 2),
                    "redis_connected_clients": info.get("connected_clients", 0),
                    "redis_uptime_hours": round(info.get("uptime_in_seconds", 0) / 3600, 2),
                }

        except Exception as e:
            log.error(f"[Redis Cache] Stats error: {e}")
            return {"error": str(e)}


# Convenience factory
def create_redis_cache(
    redis_url: Optional[str] = None,
    namespace: Optional[str] = None,
    **kwargs,
) -> RedisCache:
    """
    Create a Redis cache instance.

    Args:
        redis_url: Redis URL (default: from env REDIS_URL)
        namespace: Key namespace (default: 'autoflow')
        **kwargs: Additional arguments

    Returns:
        RedisCache instance
    """
    redis_url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379")
    namespace = namespace or os.getenv("CACHE_NAMESPACE", "autoflow")

    return RedisCache(redis_url=redis_url, namespace=namespace, **kwargs)
