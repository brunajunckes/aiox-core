"""
Circuit Breaker Pattern Implementation
======================================

Prevents cascading failures by:
1. Tracking failure rate
2. Opening circuit after threshold (5+ failures)
3. Fast-failing during cooldown (60 seconds)
4. Half-open state for recovery testing
5. Automatic recovery when healthy

States:
- CLOSED: Normal operation, requests pass through
- OPEN: Too many failures, fast-fail all requests
- HALF_OPEN: Testing if service recovered
"""
import time
import logging
from enum import Enum
from typing import Callable, Any, Optional, Dict
import asyncio

log = logging.getLogger("circuit-breaker")


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "CLOSED"           # Normal operation
    OPEN = "OPEN"               # Service failing, reject requests
    HALF_OPEN = "HALF_OPEN"     # Testing recovery


class CircuitBreaker:
    """Circuit breaker for service failure handling."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        success_threshold: int = 2,
    ):
        """
        Initialize circuit breaker.

        Args:
            name: Breaker name (e.g., "ollama")
            failure_threshold: Failures before opening (default: 5)
            recovery_timeout: Seconds before trying recovery (default: 60)
            success_threshold: Successes in half-open to close (default: 2)
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.last_state_change = time.time()

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function through circuit breaker.

        Args:
            func: Async function to execute
            *args, **kwargs: Arguments to pass to function

        Returns:
            Function result

        Raises:
            CircuitBreakerOpen: If circuit is open
            Exception: Any exception from the function
        """
        # Update state if necessary
        await self._update_state()

        if self.state == CircuitState.OPEN:
            raise CircuitBreakerOpen(f"Circuit breaker '{self.name}' is OPEN")

        try:
            result = await func(*args, **kwargs)
            await self._record_success()
            return result

        except Exception as e:
            await self._record_failure()
            raise

    async def _update_state(self) -> None:
        """Check if state should change."""
        now = time.time()

        if self.state == CircuitState.CLOSED:
            # No state change needed
            return

        if self.state == CircuitState.OPEN:
            # Check if ready to try recovery
            if now - self.last_failure_time >= self.recovery_timeout:
                self._transition_to(CircuitState.HALF_OPEN)
                log.info(f"[CB {self.name}] OPEN → HALF_OPEN (testing recovery)")

        elif self.state == CircuitState.HALF_OPEN:
            # Already in half-open, waiting for successes
            pass

    async def _record_success(self) -> None:
        """Record a successful call."""
        self.failure_count = max(0, self.failure_count - 1)

        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self._transition_to(CircuitState.CLOSED)
                log.info(f"[CB {self.name}] HALF_OPEN → CLOSED (recovered)")

    async def _record_failure(self) -> None:
        """Record a failed call."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        self.success_count = 0

        if self.state == CircuitState.CLOSED:
            if self.failure_count >= self.failure_threshold:
                self._transition_to(CircuitState.OPEN)
                log.error(
                    f"[CB {self.name}] CLOSED → OPEN "
                    f"(failures: {self.failure_count}/{self.failure_threshold})"
                )

        elif self.state == CircuitState.HALF_OPEN:
            # Failure during recovery testing
            self._transition_to(CircuitState.OPEN)
            log.warning(f"[CB {self.name}] HALF_OPEN → OPEN (recovery failed)")

    def _transition_to(self, new_state: CircuitState) -> None:
        """Transition to new state."""
        self.state = new_state
        self.last_state_change = time.time()
        self.success_count = 0

    def reset(self) -> None:
        """Manually reset circuit breaker."""
        self._transition_to(CircuitState.CLOSED)
        self.failure_count = 0
        log.info(f"[CB {self.name}] Manual reset to CLOSED")

    def get_state(self) -> Dict:
        """Get current breaker state."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
            "last_failure": self.last_failure_time,
            "time_until_recovery": max(
                0,
                self.recovery_timeout - (time.time() - self.last_failure_time)
                if self.last_failure_time else 0
            ),
        }


class CircuitBreakerOpen(Exception):
    """Raised when circuit breaker is open."""
    pass


# Global circuit breakers
_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: int = 60,
) -> CircuitBreaker:
    """Get or create circuit breaker by name."""
    if name not in _breakers:
        _breakers[name] = CircuitBreaker(
            name=name,
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )
    return _breakers[name]


def get_all_breakers() -> Dict[str, CircuitBreaker]:
    """Get all circuit breakers."""
    return _breakers.copy()
