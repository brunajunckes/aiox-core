"""OpenTelemetry Tracing Configuration — Jaeger Integration.

Provides distributed tracing for AutoFlow with:
  - Jaeger collector export
  - 10% sampling rate (configurable)
  - Span processors (batch + always-on)
  - Helper functions for custom spans
  - Automatic HTTP instrumentation
"""

import os
import logging
from typing import Optional, Dict, Any
from contextlib import contextmanager

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
try:
    # Try OTLP HTTP exporter first (more compatible)
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    USE_OTLP_HTTP = True
except ImportError:
    # Fallback to Jaeger Thrift
    try:
        from opentelemetry.exporter.jaeger.thrift import JaegerExporter as OTLPSpanExporter
        USE_OTLP_HTTP = False
    except ImportError:
        OTLPSpanExporter = None
        USE_OTLP_HTTP = None

from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
try:
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
except ImportError:
    SQLAlchemyInstrumentor = None
try:
    from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
except ImportError:
    Psycopg2Instrumentor = None

logger = logging.getLogger(__name__)


# ── Configuration ──

class TracingConfig:
    """Tracing configuration from environment."""

    ENABLED = os.getenv("OTEL_ENABLED", "true").lower() == "true"
    ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:4318")
    SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "autoflow")
    ENVIRONMENT = os.getenv("OTEL_ENVIRONMENT", "dev")
    SAMPLING_RATIO = float(os.getenv("OTEL_SAMPLING_RATIO", "0.1"))
    JAEGER_AGENT_HOST = os.getenv("JAEGER_AGENT_HOST", "localhost")
    JAEGER_AGENT_PORT = int(os.getenv("JAEGER_AGENT_PORT", "6831"))


# ── Global Tracer Instance ──

_tracer_provider: Optional[TracerProvider] = None
_global_tracer: Optional[trace.Tracer] = None


def get_tracer() -> trace.Tracer:
    """Get or initialize global tracer."""
    global _global_tracer
    if _global_tracer is None:
        initialize_tracing()
        _global_tracer = trace.get_tracer(__name__)
    return _global_tracer


def get_tracer_provider() -> TracerProvider:
    """Get tracer provider."""
    global _tracer_provider
    if _tracer_provider is None:
        _tracer_provider = TracerProvider(
            sampler=TraceIdRatioBased(TracingConfig.SAMPLING_RATIO)
        )
    return _tracer_provider


# ── Initialization ──

def initialize_tracing() -> None:
    """Initialize OpenTelemetry tracing with Jaeger/OTLP exporter.

    Sets up:
      - Tracer provider with sampling
      - OTLP or Jaeger exporter
      - Span processor
      - Automatic instrumentations
    """
    if not TracingConfig.ENABLED:
        logger.info("Tracing disabled (OTEL_ENABLED=false)")
        return

    if OTLPSpanExporter is None:
        logger.warning("OpenTelemetry exporter not available, tracing disabled")
        return

    try:
        # Create exporter
        if USE_OTLP_HTTP:
            # Use OTLP HTTP exporter
            exporter = OTLPSpanExporter(
                endpoint=TracingConfig.ENDPOINT,
            )
            endpoint_info = f"OTLP HTTP {TracingConfig.ENDPOINT}"
        else:
            # Use Jaeger Thrift exporter
            exporter = OTLPSpanExporter(
                agent_host_name=TracingConfig.JAEGER_AGENT_HOST,
                agent_port=TracingConfig.JAEGER_AGENT_PORT,
            )
            endpoint_info = f"Jaeger {TracingConfig.JAEGER_AGENT_HOST}:{TracingConfig.JAEGER_AGENT_PORT}"

        # Get/create tracer provider
        tracer_provider = get_tracer_provider()

        # Add batch span processor
        tracer_provider.add_span_processor(
            BatchSpanProcessor(
                exporter,
                max_queue_size=2048,
                max_export_batch_size=512,
                schedule_delay_millis=5000,
            )
        )

        # Set global tracer provider
        trace.set_tracer_provider(tracer_provider)

        logger.info(
            f"Tracing initialized: service={TracingConfig.SERVICE_NAME}, "
            f"endpoint={endpoint_info}, "
            f"sampling_ratio={TracingConfig.SAMPLING_RATIO}"
        )

    except Exception as e:
        logger.error(f"Failed to initialize tracing: {e}")
        raise


def instrument_app(app) -> None:
    """Instrument FastAPI app with automatic tracing.

    Args:
        app: FastAPI application instance
    """
    if not TracingConfig.ENABLED:
        return

    try:
        # Instrument FastAPI
        FastAPIInstrumentor.instrument_app(
            app,
            tracer_provider=get_tracer_provider(),
            skip_paths=["/health", "/metrics", "/docs", "/openapi.json"],
        )

        # Instrument HTTP client
        HTTPXClientInstrumentor().instrument(tracer_provider=get_tracer_provider())

        logger.info("FastAPI app instrumented with automatic tracing")

    except Exception as e:
        logger.error(f"Failed to instrument app: {e}")
        raise


def instrument_database(engine) -> None:
    """Instrument SQLAlchemy engine with tracing.

    Args:
        engine: SQLAlchemy engine instance
    """
    if not TracingConfig.ENABLED or SQLAlchemyInstrumentor is None:
        return

    try:
        SQLAlchemyInstrumentor().instrument(
            engine=engine,
            tracer_provider=get_tracer_provider(),
        )
        logger.info("Database engine instrumented with tracing")
    except Exception as e:
        logger.warning(f"Failed to instrument database: {e}")


def instrument_psycopg2() -> None:
    """Instrument psycopg2 for direct PostgreSQL tracing."""
    if not TracingConfig.ENABLED or Psycopg2Instrumentor is None:
        return

    try:
        Psycopg2Instrumentor().instrument(tracer_provider=get_tracer_provider())
        logger.info("psycopg2 instrumented with tracing")
    except Exception as e:
        logger.warning(f"Failed to instrument psycopg2: {e}")


# ── Span Creation Helpers ──

@contextmanager
def create_span(name: str, attributes: Optional[Dict[str, Any]] = None):
    """Context manager for creating and managing spans.

    Usage:
        with create_span("workflow_execution", {"workflow_id": "123"}) as span:
            # Your code here
            span.set_attribute("result", "success")

    Args:
        name: Span name
        attributes: Initial span attributes

    Yields:
        Active span
    """
    tracer = get_tracer()

    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, value in attributes.items():
                try:
                    span.set_attribute(key, value)
                except Exception as e:
                    logger.warning(f"Failed to set span attribute {key}: {e}")

        yield span


def set_span_attribute(key: str, value: Any) -> None:
    """Set attribute on current span.

    Args:
        key: Attribute key
        value: Attribute value
    """
    span = trace.get_current_span()
    if span:
        try:
            span.set_attribute(key, value)
        except Exception as e:
            logger.warning(f"Failed to set span attribute {key}: {e}")


def add_span_event(name: str, attributes: Optional[Dict[str, Any]] = None) -> None:
    """Add event to current span.

    Args:
        name: Event name
        attributes: Event attributes
    """
    span = trace.get_current_span()
    if span:
        try:
            span.add_event(name, attributes or {})
        except Exception as e:
            logger.warning(f"Failed to add span event {name}: {e}")


def record_span_exception(exception: Exception) -> None:
    """Record exception in current span.

    Args:
        exception: Exception to record
    """
    span = trace.get_current_span()
    if span:
        try:
            span.record_exception(exception)
            span.set_attribute("error", True)
        except Exception as e:
            logger.warning(f"Failed to record span exception: {e}")


# ── Span Context Propagation ──

def get_trace_id() -> str:
    """Get current trace ID.

    Returns:
        Trace ID hex string
    """
    span = trace.get_current_span()
    if span and span.is_recording():
        return format(span.get_span_context().trace_id, '032x')
    return ""


def get_span_id() -> str:
    """Get current span ID.

    Returns:
        Span ID hex string
    """
    span = trace.get_current_span()
    if span and span.is_recording():
        return format(span.get_span_context().span_id, '016x')
    return ""


# ── Tracing Decorators ──

def trace_function(name: Optional[str] = None, include_args: bool = False):
    """Decorator for tracing function execution.

    Usage:
        @trace_function("my_operation")
        def my_function(x, y):
            return x + y

    Args:
        name: Span name (defaults to function name)
        include_args: Whether to include function args in span attributes
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            span_name = name or func.__name__
            attributes = {}

            if include_args:
                attributes["args_count"] = len(args)
                attributes["kwargs_count"] = len(kwargs)

            with create_span(span_name, attributes):
                try:
                    result = func(*args, **kwargs)
                    set_span_attribute("status", "success")
                    return result
                except Exception as e:
                    record_span_exception(e)
                    raise

        return wrapper
    return decorator
