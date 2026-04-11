"""Health monitoring for Desktop GPU Worker.

Tracks Desktop online/offline state transitions and calculates rolling uptime percentage.
Used by GpuWorkerClient to detect when Desktop goes offline and trigger graceful degradation.

State Machine (Health States):
    - HEALTHY: Health check passed, GPU ready (>8GB free, queue depth < 10)
    - DEGRADED: Health check passed but resources tight (4-8GB free or queue depth >= 10)
    - DOWN: Health check timeout/failed, Desktop unreachable
    - RECOVERING: Attempting to reconnect after DOWN (up to 30s)

Circuit Breaker:
    - CLOSED (normal): Health is HEALTHY, all requests go through
    - OPEN (circuit broken): Health is DOWN, fail requests immediately
    - HALF_OPEN: Health is RECOVERING, allow test requests

Events:
    - record_online(): Transition from DOWN→HEALTHY or update state
    - record_offline(): Transition to DOWN state
    - record_degraded(): Transition to DEGRADED state

Uptime Tracking:
    - Tracks time in HEALTHY state only (excludes DEGRADED/DOWN)
    - SLA target: 99.5% uptime over 24 hours
    - Calculates percentage for metrics and alerting
"""

import logging
from datetime import datetime, timedelta
from typing import List, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class HealthState(str, Enum):
    """Health state enumeration."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    RECOVERING = "recovering"


class CircuitBreakerState(str, Enum):
    """Circuit breaker state."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Failing fast
    HALF_OPEN = "half_open"  # Testing recovery


class HealthMonitor:
    """Track Desktop GPU Worker uptime, state machine, and circuit breaker.

    Implements multi-state health tracking with circuit breaker pattern:
    - Health state: HEALTHY, DEGRADED, DOWN, RECOVERING
    - Circuit breaker: CLOSED (normal), OPEN (fail fast), HALF_OPEN (testing recovery)
    - Uptime tracking: Time in HEALTHY state (excludes DEGRADED/DOWN)
    - SLA: Target 99.5% uptime over 24-hour rolling window

    Attributes:
        window_hours: Time window for uptime calculation (default: 24)
        current_state: Current HealthState (HEALTHY, DEGRADED, DOWN, RECOVERING)
        circuit_breaker_state: CircuitBreakerState (CLOSED, OPEN, HALF_OPEN)
        events: List of (timestamp, state) tuples
        last_state_change: Timestamp of last state transition
        recovery_start_time: When circuit breaker entered HALF_OPEN state
    """

    # SLA target: 99.5% uptime = max 3.6 hours downtime per 24-hour window
    SLA_TARGET_PERCENT = 99.5
    RECOVERY_TIMEOUT_SECONDS = 30  # Time to recover before reopening circuit

    # Degraded state thresholds
    MIN_GPU_MEMORY_MB = 4096  # Less = DEGRADED
    MAX_QUEUE_DEPTH = 10  # Higher = DEGRADED

    def __init__(self, window_hours: int = 24):
        """Initialize health monitor.

        Args:
            window_hours: Rolling window for uptime calculation (hours)
        """
        self.window_hours = window_hours
        now = datetime.utcnow()

        # State tracking
        self.current_state = HealthState.HEALTHY
        self.circuit_breaker_state = CircuitBreakerState.CLOSED
        self.events: List[Tuple[datetime, HealthState]] = [(now, HealthState.HEALTHY)]
        self.last_state_change = now
        self.recovery_start_time: datetime = None

    def record_online(self, gpu_memory_free_mb: int = 8192, queue_depth: int = 0) -> None:
        """Record that Desktop came online and update health state.

        Updates state based on resource availability:
        - HEALTHY: >8GB free GPU memory and queue_depth < 10
        - DEGRADED: 4-8GB free or queue_depth >= 10

        Transitions:
        - DOWN/RECOVERING → HEALTHY or DEGRADED
        - DEGRADED → HEALTHY (if resources improved)

        Args:
            gpu_memory_free_mb: Free GPU memory in MB
            queue_depth: Number of pending jobs in queue
        """
        now = datetime.utcnow()

        # Determine new state based on resources
        if gpu_memory_free_mb > 8192 and queue_depth < self.MAX_QUEUE_DEPTH:
            new_state = HealthState.HEALTHY
        else:
            new_state = HealthState.DEGRADED

        # Update circuit breaker if transitioning from DOWN
        if self.current_state == HealthState.DOWN:
            self.circuit_breaker_state = CircuitBreakerState.HALF_OPEN
            self.recovery_start_time = now
            logger.info("GPU Worker: RECOVERING (circuit breaker HALF_OPEN)")

        # Record state change if different
        if self.current_state != new_state:
            self.events.append((now, new_state))
            old_state = self.current_state
            self.current_state = new_state
            self.last_state_change = now

            # Update circuit breaker based on new health state
            if new_state == HealthState.HEALTHY:
                self.circuit_breaker_state = CircuitBreakerState.CLOSED
                logger.info(f"GPU Worker: {new_state.value.upper()} (circuit breaker CLOSED)")
            elif new_state == HealthState.DEGRADED:
                if old_state == HealthState.DOWN:
                    logger.info(f"GPU Worker: {new_state.value.upper()} (recovering from DOWN)")
                else:
                    logger.warning(f"GPU Worker: {new_state.value.upper()} (resource constraints)")

            # Log recovery success
            if old_state in [HealthState.DOWN, HealthState.RECOVERING] and new_state in [HealthState.HEALTHY, HealthState.DEGRADED]:
                if self.recovery_start_time:
                    recovery_duration = (now - self.recovery_start_time).total_seconds()
                    logger.info(f"GPU Worker: Recovery successful after {recovery_duration:.1f}s")
                    self.recovery_start_time = None

    def record_offline(self) -> None:
        """Record that Desktop went offline or health check failed.

        Transitions to DOWN state and opens circuit breaker.
        Only records state change if not already in DOWN state. Idempotent.
        """
        if self.current_state != HealthState.DOWN:
            now = datetime.utcnow()
            self.events.append((now, HealthState.DOWN))
            self.current_state = HealthState.DOWN
            self.last_state_change = now
            self.circuit_breaker_state = CircuitBreakerState.OPEN
            logger.error("GPU Worker: DOWN (health check failed, circuit breaker OPEN)")

    def record_degraded(self) -> None:
        """Record that Desktop is degraded (resources tight).

        Transitions to DEGRADED state if currently HEALTHY.
        """
        if self.current_state == HealthState.HEALTHY:
            now = datetime.utcnow()
            self.events.append((now, HealthState.DEGRADED))
            self.current_state = HealthState.DEGRADED
            self.last_state_change = now
            logger.warning("GPU Worker: DEGRADED (resource constraints detected)")

    def uptime_percent(self) -> float:
        """Calculate uptime percentage in rolling window.

        Uptime = time in HEALTHY state / total time in window
        Excludes DEGRADED, DOWN, and RECOVERING states from uptime calculation.

        Returns:
            Uptime as percentage (0-100). Returns 100 if no events recorded.

        Logic:
            1. Get cutoff time: now - window_hours
            2. For each event pair, calculate time in each state
            3. Sum time in HEALTHY state / total time in window
        """
        if not self.events:
            return 100.0

        cutoff = datetime.utcnow() - timedelta(hours=self.window_hours)
        healthy_duration = timedelta(0)
        total_duration = timedelta(0)

        # Filter events within window
        relevant_events = [(ts, state) for ts, state in self.events if ts >= cutoff]

        # If no events in window, assume current state for entire window
        if not relevant_events:
            if self.current_state == HealthState.HEALTHY:
                return 100.0
            else:
                return 0.0

        # Calculate uptime between each pair of events
        for i in range(len(relevant_events)):
            ts_start, state = relevant_events[i]

            # Determine end time (next event or now)
            if i + 1 < len(relevant_events):
                ts_end = relevant_events[i + 1][0]
            else:
                ts_end = datetime.utcnow()

            # Duration of this event
            duration = ts_end - ts_start

            # Add to total
            total_duration += duration

            # Add to healthy if state == HEALTHY (only HEALTHY counts toward uptime)
            if state == HealthState.HEALTHY:
                healthy_duration += duration

        # Handle events before cutoff (they might have extended into the window)
        if relevant_events and relevant_events[0][0] > cutoff:
            first_event_ts, _ = relevant_events[0]
            if len(self.events) > 1:
                # Find state before the first relevant event
                pre_cutoff_state = None
                for j in range(len(self.events) - 1):
                    if self.events[j][0] < cutoff < self.events[j + 1][0]:
                        pre_cutoff_state = self.events[j][1]
                        break

                if pre_cutoff_state is None:
                    # Cutoff is before all events, use earliest state
                    pre_cutoff_state = self.events[0][1]

                # Add time from cutoff to first relevant event
                gap_duration = first_event_ts - cutoff
                total_duration += gap_duration
                if pre_cutoff_state == HealthState.HEALTHY:
                    healthy_duration += gap_duration

        # Calculate percentage
        if total_duration == timedelta(0):
            return 100.0

        return float((healthy_duration / total_duration) * 100)

    def is_circuit_open(self) -> bool:
        """Return True if circuit breaker is OPEN (failing fast).

        When circuit is open, requests should fail immediately without
        attempting to connect to the Desktop GPU worker.
        """
        return self.circuit_breaker_state == CircuitBreakerState.OPEN

    def should_retry_recovery(self) -> bool:
        """Check if in HALF_OPEN state and recovery timeout has elapsed.

        Returns:
            True if circuit is HALF_OPEN and recovery timeout (30s) has passed.
            Indicates it's time to test a request to see if Desktop recovered.
        """
        if self.circuit_breaker_state != CircuitBreakerState.HALF_OPEN:
            return False

        if not self.recovery_start_time:
            return False

        elapsed = (datetime.utcnow() - self.recovery_start_time).total_seconds()
        return elapsed >= self.RECOVERY_TIMEOUT_SECONDS

    def time_since_state_change(self) -> float:
        """Return seconds since last state transition.

        Useful for monitoring how long the system has been in current state.

        Returns:
            Seconds as float (0 if just changed)
        """
        return (datetime.utcnow() - self.last_state_change).total_seconds()

    def reset(self) -> None:
        """Reset history (useful for testing or maintenance)."""
        now = datetime.utcnow()
        self.events = [(now, HealthState.HEALTHY)]
        self.current_state = HealthState.HEALTHY
        self.circuit_breaker_state = CircuitBreakerState.CLOSED
        self.last_state_change = now
        self.recovery_start_time = None
        logger.info("HealthMonitor history reset")

    def __repr__(self) -> str:
        """String representation for logging."""
        uptime = self.uptime_percent()
        return (
            f"HealthMonitor("
            f"state={self.current_state.value}, "
            f"circuit={self.circuit_breaker_state.value}, "
            f"uptime_24h={uptime:.1f}%, "
            f"events={len(self.events)})"
        )
