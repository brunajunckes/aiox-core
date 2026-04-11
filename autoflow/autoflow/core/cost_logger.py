"""Cost Logger — Structured cost tracking for AutoFlow router.

Logs every LLM call (attempt, success, fallback) to PostgreSQL with:
  - Timestamp (UTC ISO8601)
  - Workflow type / complexity
  - Model chosen (ollama | claude)
  - Complexity score (1-15)
  - Estimated vs actual cost
  - Latency (ms)
  - Circuit breaker state
  - Routing decision reason

All writes are non-blocking (silent failures). Thread-safe via connection pooling.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

try:
    import psycopg2
    import psycopg2.pool
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

log = logging.getLogger("cost-logger")


# ───────────────────────────────────────────────────────────────────────────
# Cost Event Dataclass
# ───────────────────────────────────────────────────────────────────────────


@dataclass
class CostEvent:
    """Single cost tracking event."""

    # Identifiers
    timestamp: str  # ISO8601 UTC
    service: str = "autoflow-router"
    event_id: str = field(default_factory=lambda: os.urandom(8).hex())

    # Request context
    workflow_type: Optional[str] = None
    request_id: Optional[str] = None

    # Routing decision
    type: str = "llm_call"  # or "routing_decision", "circuit_breaker_event"
    status: str = "unknown"  # success, error, timeout
    routing_reason: Optional[str] = None

    # Provider & model
    provider: Optional[str] = None  # ollama, claude
    model: Optional[str] = None
    preferred_provider: Optional[str] = None
    fallback_used: bool = False

    # Complexity
    complexity_score: Optional[int] = None  # 1-15
    complexity_level: Optional[str] = None  # simple, standard, complex

    # Cost (USD)
    estimated_cost_usd: float = 0.0
    actual_cost_usd: float = 0.0

    # Tokens
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    prompt_chars: int = 0
    response_chars: int = 0

    # Performance
    latency_ms: int = 0
    total_ms: int = 0

    # Circuit breaker
    circuit_state: Optional[str] = None  # closed, open, half_open

    # Error
    error: Optional[str] = None

    # Metadata
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        return data

    def to_jsonl(self) -> str:
        """Convert to single JSONL line."""
        return json.dumps(self.to_dict(), default=str)


# ───────────────────────────────────────────────────────────────────────────
# PostgreSQL Connection Pool
# ───────────────────────────────────────────────────────────────────────────


class PostgreSQLCostLogger:
    """Log cost events to PostgreSQL with connection pooling."""

    def __init__(self, database_url: Optional[str] = None) -> None:
        """Initialize PostgreSQL logger.

        Args:
            database_url: libpq connection string or None to skip (fallback to file)
        """
        self.database_url = database_url or os.getenv(
            "AUTOFLOW_DB_URL",
            os.getenv(
                "DATABASE_URL",
                "postgresql://autoflow:autoflow_secure_2026@localhost:5432/autoflow",
            ),
        )
        self.pool = None
        self.enabled = False
        self._lock = threading.Lock()

        if HAS_PSYCOPG2:
            try:
                self.pool = psycopg2.pool.SimpleConnectionPool(
                    1, 5, self.database_url, connect_timeout=5
                )
                self.enabled = True
                log.info("[CostLogger] PostgreSQL pool initialized")
            except Exception as exc:
                log.warning(
                    f"[CostLogger] PostgreSQL unavailable: {exc}. "
                    "Falling back to file logging."
                )
                self.enabled = False
        else:
            log.warning(
                "[CostLogger] psycopg2 not installed. "
                "Falling back to file logging."
            )

    def log_event(self, event: CostEvent) -> None:
        """Write cost event to PostgreSQL (non-blocking)."""
        if not self.enabled or not self.pool:
            return

        try:
            with self._lock:
                conn = self.pool.getconn()
                try:
                    cur = conn.cursor()
                    cur.execute(
                        """
                        INSERT INTO autoflow_cost_events (
                            timestamp, service, event_id, workflow_type,
                            request_id, type, status, routing_reason,
                            provider, model, preferred_provider, fallback_used,
                            complexity_score, complexity_level,
                            estimated_cost_usd, actual_cost_usd,
                            input_tokens, output_tokens, prompt_chars, response_chars,
                            latency_ms, total_ms, circuit_state, error, metadata
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s
                        )
                        """,
                        (
                            event.timestamp,
                            event.service,
                            event.event_id,
                            event.workflow_type,
                            event.request_id,
                            event.type,
                            event.status,
                            event.routing_reason,
                            event.provider,
                            event.model,
                            event.preferred_provider,
                            event.fallback_used,
                            event.complexity_score,
                            event.complexity_level,
                            event.estimated_cost_usd,
                            event.actual_cost_usd,
                            event.input_tokens,
                            event.output_tokens,
                            event.prompt_chars,
                            event.response_chars,
                            event.latency_ms,
                            event.total_ms,
                            event.circuit_state,
                            event.error,
                            json.dumps(event.metadata) if event.metadata else None,
                        ),
                    )
                    conn.commit()
                finally:
                    cur.close()
                    self.pool.putconn(conn)
        except Exception as exc:
            # Silent failure — never block a request on I/O
            print(
                f"[CostLogger] PostgreSQL write failed: {exc}",
                file=sys.stderr,
            )


# ───────────────────────────────────────────────────────────────────────────
# Global Logger Instances
# ───────────────────────────────────────────────────────────────────────────

# File-based fallback
COST_LOG_PATH = os.getenv("AUTOFLOW_COST_LOG", "/var/log/autoflow-cost.jsonl")
_file_log_lock = threading.Lock()

# PostgreSQL logger (initialized on first use)
_pg_logger: Optional[PostgreSQLCostLogger] = None
_pg_logger_lock = threading.Lock()


def get_pg_logger() -> PostgreSQLCostLogger:
    """Get or initialize PostgreSQL logger (lazy initialization)."""
    global _pg_logger
    if _pg_logger is None:
        with _pg_logger_lock:
            if _pg_logger is None:
                _pg_logger = PostgreSQLCostLogger()
    return _pg_logger


# ───────────────────────────────────────────────────────────────────────────
# Public API
# ───────────────────────────────────────────────────────────────────────────


def log_cost_event(event: CostEvent) -> None:
    """Log a cost event to PostgreSQL and/or file (non-blocking).

    Automatically timestamps if not provided.
    Falls back to file logging if PostgreSQL unavailable.
    """
    # Auto-set timestamp if not provided
    if not event.timestamp:
        event.timestamp = datetime.now(timezone.utc).isoformat()

    # Try PostgreSQL first
    pg_logger = get_pg_logger()
    if pg_logger.enabled:
        pg_logger.log_event(event)
        return

    # Fallback: write to JSONL file
    try:
        with _file_log_lock:
            with open(COST_LOG_PATH, "a", encoding="utf-8") as fh:
                fh.write(event.to_jsonl() + "\n")
    except Exception as exc:
        # Never block on file I/O
        print(
            f"[CostLogger] File write failed: {exc}",
            file=sys.stderr,
        )


def log_llm_call(
    *,
    status: str,
    provider: str,
    model: str,
    preferred: Optional[str] = None,
    fallback_used: bool = False,
    complexity_score: Optional[int] = None,
    complexity_level: Optional[str] = None,
    estimated_cost_usd: float = 0.0,
    actual_cost_usd: float = 0.0,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    prompt_chars: int = 0,
    response_chars: int = 0,
    latency_ms: int = 0,
    total_ms: int = 0,
    circuit_state: Optional[str] = None,
    routing_reason: Optional[str] = None,
    error: Optional[str] = None,
    workflow_type: Optional[str] = None,
    request_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    """Log an LLM call event (shorthand).

    Args:
        status: "success", "error", "timeout"
        provider: "ollama", "claude"
        model: model identifier
        preferred: preferred provider before fallback
        fallback_used: whether fallback was used
        complexity_score: 1-15 complexity rating
        complexity_level: "simple", "standard", "complex"
        estimated_cost_usd: estimated cost from LLM-Router
        actual_cost_usd: actual cost charged
        input_tokens: input token count
        output_tokens: output token count
        prompt_chars: length of input prompt
        response_chars: length of output response
        latency_ms: provider call latency
        total_ms: total request latency (including routing decision)
        circuit_state: "closed", "open", "half_open"
        routing_reason: why this routing decision was made
        error: error message (if status == "error")
        workflow_type: workflow type if available
        request_id: request identifier if available
        metadata: arbitrary metadata dict
    """
    event = CostEvent(
        timestamp=datetime.now(timezone.utc).isoformat(),
        type="llm_call",
        status=status,
        provider=provider,
        model=model,
        preferred_provider=preferred,
        fallback_used=fallback_used,
        complexity_score=complexity_score,
        complexity_level=complexity_level,
        estimated_cost_usd=estimated_cost_usd,
        actual_cost_usd=actual_cost_usd,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        prompt_chars=prompt_chars,
        response_chars=response_chars,
        latency_ms=latency_ms,
        total_ms=total_ms,
        circuit_state=circuit_state,
        routing_reason=routing_reason,
        error=error,
        workflow_type=workflow_type,
        request_id=request_id,
        metadata=metadata or {},
    )
    log_cost_event(event)


def log_routing_decision(
    *,
    decision: dict[str, Any],
    circuit_state: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    """Log a routing decision event.

    Args:
        decision: routing decision dict from LLM-Router-AIOX
        circuit_state: circuit breaker state at decision time
        error: error message if decision failed
    """
    event = CostEvent(
        timestamp=datetime.now(timezone.utc).isoformat(),
        type="routing_decision",
        status="error" if error else "success",
        routing_reason=decision.get("reason"),
        complexity_score=decision.get("complexity_score"),
        complexity_level=decision.get("complexity_level"),
        estimated_cost_usd=float(decision.get("estimated_cost", 0.0)),
        circuit_state=circuit_state,
        error=error,
        metadata=decision,
    )
    log_cost_event(event)


def log_circuit_breaker_event(
    *,
    state: str,
    failures: int,
    reason: Optional[str] = None,
) -> None:
    """Log a circuit breaker state change.

    Args:
        state: "closed", "open", "half_open"
        failures: number of consecutive failures
        reason: description of state change
    """
    event = CostEvent(
        timestamp=datetime.now(timezone.utc).isoformat(),
        type="circuit_breaker_event",
        status="info",
        circuit_state=state,
        routing_reason=reason,
        metadata={"failures": failures},
    )
    log_cost_event(event)


# ───────────────────────────────────────────────────────────────────────────
# Cost Aggregation Helpers
# ───────────────────────────────────────────────────────────────────────────


def get_cost_summary(
    days: int = 1,
    workflow_type: Optional[str] = None,
) -> dict[str, Any]:
    """Get cost summary for recent period (PostgreSQL only).

    Args:
        days: number of days to aggregate
        workflow_type: filter by workflow type (optional)

    Returns:
        {
            "total_requests": int,
            "total_cost_usd": float,
            "average_cost_per_request": float,
            "by_model": { model: cost_usd, ... },
            "by_provider": { provider: cost_usd, ... },
            "by_complexity": { level: cost_usd, ... },
        }
    """
    pg_logger = get_pg_logger()
    if not pg_logger.enabled or not pg_logger.pool:
        log.warning("[CostLogger] PostgreSQL not available for aggregation")
        return {}

    try:
        conn = pg_logger.pool.getconn()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            # Main query
            where_clause = (
                "WHERE timestamp > now() - interval '%d days' AND type = 'llm_call'"
                % days
            )
            if workflow_type:
                where_clause += f" AND workflow_type = '{workflow_type}'"

            cur.execute(
                f"""
                SELECT
                    COUNT(*) as total_requests,
                    SUM(actual_cost_usd) as total_cost,
                    AVG(actual_cost_usd) as avg_cost
                FROM autoflow_cost_events
                {where_clause}
                """
            )
            row = cur.fetchone()
            total_requests = row["total_requests"] or 0
            total_cost = float(row["total_cost"] or 0.0)
            avg_cost = float(row["avg_cost"] or 0.0)

            # By model
            cur.execute(
                f"""
                SELECT model, SUM(actual_cost_usd) as cost
                FROM autoflow_cost_events
                {where_clause}
                GROUP BY model
                """
            )
            by_model = {row["model"]: float(row["cost"]) for row in cur.fetchall()}

            # By provider
            cur.execute(
                f"""
                SELECT provider, SUM(actual_cost_usd) as cost
                FROM autoflow_cost_events
                {where_clause}
                GROUP BY provider
                """
            )
            by_provider = {
                row["provider"]: float(row["cost"]) for row in cur.fetchall()
            }

            # By complexity
            cur.execute(
                f"""
                SELECT complexity_level, SUM(actual_cost_usd) as cost
                FROM autoflow_cost_events
                {where_clause}
                GROUP BY complexity_level
                """
            )
            by_complexity = {
                row["complexity_level"]: float(row["cost"])
                for row in cur.fetchall()
            }

            return {
                "total_requests": total_requests,
                "total_cost_usd": total_cost,
                "average_cost_per_request": avg_cost,
                "by_model": by_model,
                "by_provider": by_provider,
                "by_complexity": by_complexity,
            }

        finally:
            cur.close()
            pg_logger.pool.putconn(conn)

    except Exception as exc:
        log.error(f"[CostLogger] aggregation failed: {exc}")
        return {}
