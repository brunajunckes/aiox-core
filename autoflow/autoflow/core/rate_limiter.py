"""
Rate Limiting System
====================

Token bucket rate limiting per client:
1. Per-client rate limits
2. Configurable requests per second
3. Burst capacity
4. Automatic cleanup of expired clients
"""
import time
import logging
from typing import Dict, Optional
from dataclasses import dataclass, field
from collections import defaultdict

log = logging.getLogger("rate-limiter")


@dataclass
class RateLimitBucket:
    """Token bucket for single client."""
    client_id: str
    max_requests_per_second: float
    burst_capacity: int
    tokens: float = field(default_factory=lambda: float('inf'))
    last_update: float = field(default_factory=time.time)
    request_count: int = 0
    rejected_count: int = 0

    def allow_request(self) -> bool:
        """Check if request is allowed."""
        self._refill()

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            self.request_count += 1
            return True
        else:
            self.rejected_count += 1
            return False

    def _refill(self) -> None:
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_update
        self.last_update = now

        # Add tokens based on rate
        new_tokens = elapsed * self.max_requests_per_second
        self.tokens = min(self.burst_capacity, self.tokens + new_tokens)

    def get_stats(self) -> Dict:
        """Get bucket statistics."""
        self._refill()
        return {
            "client_id": self.client_id,
            "tokens_available": round(self.tokens, 2),
            "requests_total": self.request_count,
            "requests_rejected": self.rejected_count,
            "rejection_rate": (
                self.rejected_count / (self.request_count + self.rejected_count)
                if (self.request_count + self.rejected_count) > 0
                else 0.0
            ),
        }


class RateLimiter:
    """Rate limit requests per client."""

    def __init__(
        self,
        default_rps: float = 10.0,  # requests per second
        burst_capacity: int = 50,
        cleanup_interval: int = 3600,  # 1 hour
    ):
        """
        Initialize rate limiter.

        Args:
            default_rps: Default requests per second
            burst_capacity: Max burst capacity
            cleanup_interval: Remove inactive clients after N seconds
        """
        self.default_rps = default_rps
        self.burst_capacity = burst_capacity
        self.cleanup_interval = cleanup_interval

        self.buckets: Dict[str, RateLimitBucket] = {}
        self.client_limits: Dict[str, float] = {}  # Per-client overrides
        self.last_cleanup = time.time()

    def allow_request(self, client_id: str) -> bool:
        """Check if request is allowed for client."""
        self._cleanup_if_needed()

        if client_id not in self.buckets:
            rps = self.client_limits.get(client_id, self.default_rps)
            self.buckets[client_id] = RateLimitBucket(
                client_id=client_id,
                max_requests_per_second=rps,
                burst_capacity=self.burst_capacity,
            )

        bucket = self.buckets[client_id]
        allowed = bucket.allow_request()

        if not allowed:
            log.warning(f"[RATE-LIMIT] Rejected request from {client_id}")

        return allowed

    def set_client_limit(self, client_id: str, rps: float) -> None:
        """Set per-client rate limit override."""
        self.client_limits[client_id] = rps
        if client_id in self.buckets:
            self.buckets[client_id].max_requests_per_second = rps
        log.info(f"[RATE-LIMIT] Set limit for {client_id}: {rps} rps")

    def get_client_stats(self, client_id: str) -> Optional[Dict]:
        """Get rate limit stats for client."""
        if client_id not in self.buckets:
            return None
        return self.buckets[client_id].get_stats()

    def get_all_stats(self) -> Dict:
        """Get stats for all clients."""
        return {
            "total_clients": len(self.buckets),
            "clients": [
                bucket.get_stats()
                for bucket in self.buckets.values()
            ],
        }

    def _cleanup_if_needed(self) -> None:
        """Remove inactive client buckets."""
        now = time.time()
        if now - self.last_cleanup < self.cleanup_interval:
            return

        inactive = []
        for client_id, bucket in self.buckets.items():
            if now - bucket.last_update > self.cleanup_interval:
                inactive.append(client_id)

        for client_id in inactive:
            del self.buckets[client_id]
            self.last_cleanup = now

        if inactive:
            log.info(f"[RATE-LIMIT] Cleaned up {len(inactive)} inactive clients")


# Global instance
_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get or create global rate limiter."""
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter()
    return _limiter
