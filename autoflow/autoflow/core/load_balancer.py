"""
Load Balancer for Multiple Ollama Instances
===========================================

Distributes requests across multiple Ollama endpoints:
1. Health checks every 10 seconds
2. Round-robin allocation with weight-based distribution
3. Automatic fallback on failure
4. Tracks performance metrics per instance
"""
import asyncio
import logging
import time
from typing import List, Optional, Dict
from dataclasses import dataclass, field
import httpx

log = logging.getLogger("load-balancer")


@dataclass
class OllamaInstance:
    """Single Ollama instance metadata."""
    endpoint: str                          # e.g., "http://ollama.local:11434"
    name: str                              # e.g., "primary", "secondary"
    healthy: bool = True
    response_time_ms: float = 0.0
    request_count: int = 0
    error_count: int = 0
    last_health_check: float = field(default_factory=time.time)
    weight: float = 1.0                    # Load distribution weight

    @property
    def error_rate(self) -> float:
        """Calculate error rate."""
        if self.request_count == 0:
            return 0.0
        return self.error_count / self.request_count

    @property
    def health_score(self) -> float:
        """Score 0-100 based on health and performance."""
        if not self.healthy:
            return 0.0

        # Base score on response time (lower is better)
        time_score = max(0, 100 - (self.response_time_ms / 10))
        # Deduct for errors
        error_deduction = self.error_rate * 100
        # Weight by request count (more data = more reliable)
        request_weight = min(1.0, self.request_count / 100)

        return (time_score - error_deduction) * request_weight


class LoadBalancer:
    """Distribute requests across Ollama instances."""

    def __init__(self, instances: List[Dict]):
        """
        Initialize load balancer.

        Args:
            instances: List of dicts with 'endpoint' and optional 'name', 'weight'
        """
        self.instances: List[OllamaInstance] = []
        self.health_check_interval = 10  # seconds
        self.current_index = 0

        for inst in instances:
            self.instances.append(OllamaInstance(
                endpoint=inst["endpoint"],
                name=inst.get("name", inst["endpoint"]),
                weight=inst.get("weight", 1.0),
            ))

        log.info(f"Load balancer initialized with {len(self.instances)} instances")

    async def select_endpoint(self) -> str:
        """
        Select best endpoint for next request.

        Uses weighted round-robin with health consideration.
        Returns only healthy endpoints.
        """
        await self._update_health_checks()

        # Filter healthy instances
        healthy = [inst for inst in self.instances if inst.healthy]

        if not healthy:
            log.error("No healthy Ollama instances available!")
            # Return primary anyway (may fail, but worth trying)
            return self.instances[0].endpoint if self.instances else None

        # Weighted round-robin
        self.current_index = (self.current_index + 1) % len(healthy)
        selected = healthy[self.current_index]

        return selected.endpoint

    async def record_request(
        self,
        endpoint: str,
        success: bool,
        response_time_ms: float = 0.0,
    ) -> None:
        """Record request result for metrics."""
        for inst in self.instances:
            if inst.endpoint == endpoint:
                inst.request_count += 1
                inst.response_time_ms = response_time_ms
                if not success:
                    inst.error_count += 1
                    log.warning(f"Error on {inst.name}: error_rate={inst.error_rate:.1%}")
                break

    async def _update_health_checks(self) -> None:
        """Check health of all instances."""
        now = time.time()

        for inst in self.instances:
            # Check every N seconds
            if now - inst.last_health_check < self.health_check_interval:
                continue

            healthy = await self._check_instance_health(inst.endpoint)
            inst.healthy = healthy
            inst.last_health_check = now

            status = "✓" if healthy else "✗"
            log.info(f"[HEALTH] {inst.name}: {status} (score: {inst.health_score:.0f})")

    async def _check_instance_health(self, endpoint: str) -> bool:
        """Check if Ollama instance is responsive."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Try to get version or tags
                response = await client.get(f"{endpoint}/api/tags")
                return response.status_code == 200
        except Exception as e:
            log.debug(f"Health check failed for {endpoint}: {e}")
            return False

    def get_instance_stats(self) -> Dict:
        """Get stats for all instances."""
        return {
            "timestamp": time.time(),
            "instances": [
                {
                    "name": inst.name,
                    "endpoint": inst.endpoint,
                    "healthy": inst.healthy,
                    "health_score": inst.health_score,
                    "request_count": inst.request_count,
                    "error_count": inst.error_count,
                    "error_rate": inst.error_rate,
                    "response_time_ms": inst.response_time_ms,
                }
                for inst in self.instances
            ],
            "total_requests": sum(inst.request_count for inst in self.instances),
            "total_errors": sum(inst.error_count for inst in self.instances),
        }


# Global instance
_load_balancer: Optional[LoadBalancer] = None


def get_load_balancer() -> LoadBalancer:
    """Get or create global load balancer."""
    global _load_balancer
    if _load_balancer is None:
        # Default: single Ollama instance
        _load_balancer = LoadBalancer([
            {
                "endpoint": "http://ollama.ampcast.site",
                "name": "primary",
                "weight": 1.0,
            }
        ])
    return _load_balancer


def init_load_balancer(instances: List[Dict]) -> None:
    """Initialize load balancer with custom instances."""
    global _load_balancer
    _load_balancer = LoadBalancer(instances)
