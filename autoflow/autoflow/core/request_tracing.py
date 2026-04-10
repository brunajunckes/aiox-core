"""
Distributed Request Tracing System
===================================

Traces requests through entire AutoFlow pipeline:
1. Request ID generation and propagation
2. Structured logging with context
3. Performance metrics per stage
4. Error tracking with stack traces
5. Timeline visualization for debugging
"""
import uuid
import time
import logging
from typing import Optional, Dict, List
from dataclasses import dataclass, field
from contextvars import ContextVar
import json

log = logging.getLogger("tracing")

# Context variable to hold trace ID across async operations
_trace_context: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)


@dataclass
class TraceSpan:
    """Single operation in a trace."""
    span_id: str
    operation: str
    start_time: float
    end_time: float = 0.0
    duration_ms: float = 0.0
    status: str = "PENDING"  # PENDING, SUCCESS, ERROR
    error: Optional[str] = None
    metadata: Dict = field(default_factory=dict)

    def finish(self, status: str = "SUCCESS", error: Optional[str] = None) -> None:
        """Mark span as finished."""
        self.end_time = time.time()
        self.duration_ms = (self.end_time - self.start_time) * 1000
        self.status = status
        self.error = error


@dataclass
class RequestTrace:
    """Complete trace for a single request."""
    trace_id: str
    request_type: str  # "seo", "research", "video"
    start_time: float
    end_time: float = 0.0
    total_duration_ms: float = 0.0
    status: str = "ACTIVE"
    spans: List[TraceSpan] = field(default_factory=list)
    error: Optional[str] = None

    def add_span(self, operation: str) -> TraceSpan:
        """Start a new span."""
        span = TraceSpan(
            span_id=str(uuid.uuid4())[:8],
            operation=operation,
            start_time=time.time(),
        )
        self.spans.append(span)
        return span

    def finish(self, status: str = "SUCCESS", error: Optional[str] = None) -> None:
        """Mark trace as finished."""
        self.end_time = time.time()
        self.total_duration_ms = (self.end_time - self.start_time) * 1000
        self.status = status
        self.error = error

    def to_dict(self) -> Dict:
        """Convert to dictionary for logging."""
        return {
            "trace_id": self.trace_id,
            "request_type": self.request_type,
            "status": self.status,
            "total_duration_ms": self.total_duration_ms,
            "span_count": len(self.spans),
            "error": self.error,
            "spans": [
                {
                    "operation": s.operation,
                    "duration_ms": s.duration_ms,
                    "status": s.status,
                    "error": s.error,
                }
                for s in self.spans
            ],
        }


class RequestTracer:
    """Manage request tracing."""

    def __init__(self):
        self.active_traces: Dict[str, RequestTrace] = {}
        self.completed_traces: List[RequestTrace] = []
        self.max_completed = 1000  # Keep last 1000 traces

    def start_trace(self, request_type: str) -> str:
        """Start new trace and return trace ID."""
        trace_id = str(uuid.uuid4())[:16]
        trace = RequestTrace(
            trace_id=trace_id,
            request_type=request_type,
            start_time=time.time(),
        )
        self.active_traces[trace_id] = trace
        _trace_context.set(trace_id)

        log.info(f"[TRACE] Start {trace_id}: {request_type}")
        return trace_id

    def add_span(self, trace_id: str, operation: str) -> Optional[TraceSpan]:
        """Add operation span to trace."""
        if trace_id not in self.active_traces:
            return None

        trace = self.active_traces[trace_id]
        span = trace.add_span(operation)
        log.debug(f"[TRACE] {trace_id}: Start span {span.span_id} ({operation})")
        return span

    def finish_span(
        self,
        trace_id: str,
        span_id: str,
        status: str = "SUCCESS",
        error: Optional[str] = None,
    ) -> None:
        """Finish operation span."""
        if trace_id not in self.active_traces:
            return

        trace = self.active_traces[trace_id]
        for span in trace.spans:
            if span.span_id == span_id:
                span.finish(status, error)
                level = "ERROR" if status == "ERROR" else "DEBUG"
                log.log(
                    logging.ERROR if level == "ERROR" else logging.DEBUG,
                    f"[TRACE] {trace_id}: Finish span {span_id} ({span.operation}) "
                    f"({span.duration_ms:.0f}ms, {status})"
                )
                break

    def finish_trace(
        self,
        trace_id: str,
        status: str = "SUCCESS",
        error: Optional[str] = None,
    ) -> None:
        """Finish trace and move to completed."""
        if trace_id not in self.active_traces:
            return

        trace = self.active_traces.pop(trace_id)
        trace.finish(status, error)

        # Store in completed
        self.completed_traces.append(trace)
        if len(self.completed_traces) > self.max_completed:
            self.completed_traces.pop(0)

        log.info(
            f"[TRACE] Finish {trace_id}: {trace.request_type} "
            f"({trace.total_duration_ms:.0f}ms, {status})"
        )

    def get_trace(self, trace_id: str) -> Optional[Dict]:
        """Get trace details."""
        if trace_id in self.active_traces:
            return self.active_traces[trace_id].to_dict()

        for trace in reversed(self.completed_traces):
            if trace.trace_id == trace_id:
                return trace.to_dict()

        return None

    def get_recent_traces(self, limit: int = 50) -> List[Dict]:
        """Get recent completed traces."""
        traces = []
        for trace in reversed(self.completed_traces[-limit:]):
            traces.append(trace.to_dict())
        return traces

    def get_stats(self) -> Dict:
        """Get tracing statistics."""
        completed = self.completed_traces
        if not completed:
            return {"total_traces": 0}

        durations = [t.total_duration_ms for t in completed]
        by_type = {}
        for trace in completed:
            if trace.request_type not in by_type:
                by_type[trace.request_type] = []
            by_type[trace.request_type].append(trace.total_duration_ms)

        return {
            "total_traces": len(completed),
            "active_traces": len(self.active_traces),
            "avg_duration_ms": sum(durations) / len(durations),
            "min_duration_ms": min(durations),
            "max_duration_ms": max(durations),
            "by_type": {
                req_type: {
                    "count": len(durs),
                    "avg_ms": sum(durs) / len(durs),
                }
                for req_type, durs in by_type.items()
            },
        }


# Global instance
_tracer: Optional[RequestTracer] = None


def get_tracer() -> RequestTracer:
    """Get or create global tracer."""
    global _tracer
    if _tracer is None:
        _tracer = RequestTracer()
    return _tracer


def get_current_trace_id() -> Optional[str]:
    """Get trace ID from context."""
    return _trace_context.get()
