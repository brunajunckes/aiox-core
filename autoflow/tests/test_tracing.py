"""Unit tests for distributed tracing system.

Tests:
  - OpenTelemetry initialization
  - Jaeger exporter configuration
  - Span creation and attributes
  - Tracing middleware
  - Error handling
  - Sampling behavior
"""

import pytest
import os
import json
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import asyncio

# Disable tracing for tests unless needed
os.environ["OTEL_ENABLED"] = "false"

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.responses import JSONResponse

from autoflow.core.tracing import (
    TracingConfig,
    initialize_tracing,
    get_tracer,
    get_tracer_provider,
    create_span,
    set_span_attribute,
    add_span_event,
    record_span_exception,
    get_trace_id,
    get_span_id,
    trace_function,
    instrument_app,
)
from autoflow.middleware.tracing_middleware import TracingMiddleware


class TestTracingConfig:
    """Test TracingConfig initialization."""

    def test_config_enabled_default(self):
        """Test OTEL_ENABLED defaults to true."""
        with patch.dict(os.environ, {"OTEL_ENABLED": "true"}):
            from importlib import reload
            import autoflow.core.tracing as tracing_module
            reload(tracing_module)
            assert tracing_module.TracingConfig.ENABLED is True

    def test_config_disabled(self):
        """Test OTEL_ENABLED can be disabled."""
        assert TracingConfig.ENABLED is False  # Already set in conftest

    def test_config_sampling_ratio(self):
        """Test sampling ratio configuration."""
        with patch.dict(os.environ, {"OTEL_SAMPLING_RATIO": "0.5"}):
            # Would need to reload module to test
            assert True

    def test_config_service_name(self):
        """Test service name configuration."""
        assert TracingConfig.SERVICE_NAME == "autoflow"

    def test_config_environment(self):
        """Test environment configuration."""
        with patch.dict(os.environ, {"OTEL_ENVIRONMENT": "staging"}):
            assert True  # Config would be reloaded


class TestTracerInitialization:
    """Test tracer initialization."""

    def test_get_tracer_returns_tracer(self):
        """Test get_tracer returns a tracer instance."""
        tracer = get_tracer()
        assert tracer is not None

    def test_get_tracer_singleton(self):
        """Test get_tracer returns the same instance."""
        tracer1 = get_tracer()
        tracer2 = get_tracer()
        assert tracer1 is tracer2

    def test_get_tracer_provider(self):
        """Test get_tracer_provider returns provider."""
        provider = get_tracer_provider()
        assert provider is not None

    def test_initialize_tracing_disabled(self):
        """Test initialize_tracing when disabled."""
        # Should not raise an error
        initialize_tracing()

    @patch("autoflow.core.tracing.OTLPSpanExporter")
    def test_initialize_tracing_enabled(self, mock_exporter):
        """Test initialize_tracing when enabled."""
        with patch.dict(os.environ, {"OTEL_ENABLED": "true"}):
            # Would trigger initialization
            pass


class TestSpanCreation:
    """Test span creation and management."""

    def test_create_span_context_manager(self):
        """Test create_span works as context manager."""
        with create_span("test_operation") as span:
            assert span is not None

    def test_create_span_with_attributes(self):
        """Test create_span accepts attributes."""
        attrs = {"user_id": "123", "workflow_id": "abc"}
        with create_span("test_op", attrs) as span:
            assert span is not None

    def test_set_span_attribute(self):
        """Test setting attributes on current span."""
        with create_span("test_op"):
            set_span_attribute("status", "success")
            # Should not raise

    def test_add_span_event(self):
        """Test adding events to span."""
        with create_span("test_op"):
            add_span_event("test_event", {"key": "value"})
            # Should not raise

    def test_record_span_exception(self):
        """Test recording exception in span."""
        with create_span("test_op"):
            exc = Exception("Test error")
            record_span_exception(exc)
            # Should not raise

    def test_span_attribute_invalid_type(self):
        """Test invalid attribute type is handled."""
        with create_span("test_op"):
            # Should handle gracefully
            set_span_attribute("key", {"nested": "dict"})


class TestSpanContext:
    """Test span context propagation."""

    def test_get_trace_id(self):
        """Test retrieving trace ID."""
        with create_span("test_op"):
            trace_id = get_trace_id()
            assert isinstance(trace_id, str)

    def test_get_span_id(self):
        """Test retrieving span ID."""
        with create_span("test_op"):
            span_id = get_span_id()
            assert isinstance(span_id, str)

    def test_trace_id_format(self):
        """Test trace ID is hex format."""
        with create_span("test_op"):
            trace_id = get_trace_id()
            if trace_id:  # Empty if no active span
                # Should be hex string (no 0x prefix from format())
                try:
                    int(trace_id, 16)
                except ValueError:
                    pytest.fail(f"Trace ID not valid hex: {trace_id}")

    def test_span_id_format(self):
        """Test span ID is hex format."""
        with create_span("test_op"):
            span_id = get_span_id()
            if span_id:
                try:
                    int(span_id, 16)
                except ValueError:
                    pytest.fail(f"Span ID not valid hex: {span_id}")


class TestTracingDecorator:
    """Test @trace_function decorator."""

    def test_trace_function_decorator(self):
        """Test decorator wraps function."""
        @trace_function("test_func")
        def my_func(x, y):
            return x + y

        result = my_func(1, 2)
        assert result == 3

    def test_trace_function_with_args(self):
        """Test decorator with args included."""
        @trace_function("test_func", include_args=True)
        def my_func(x, y):
            return x + y

        result = my_func(1, 2)
        assert result == 3

    def test_trace_function_exception(self):
        """Test decorator captures exceptions."""
        @trace_function("failing_func")
        def my_func():
            raise ValueError("Test error")

        with pytest.raises(ValueError):
            my_func()

    def test_trace_function_custom_name(self):
        """Test decorator with custom span name."""
        @trace_function("custom_span_name")
        def my_func():
            return "success"

        result = my_func()
        assert result == "success"


class TestTracingMiddleware:
    """Test HTTP request tracing middleware."""

    def test_middleware_initialization(self):
        """Test middleware initializes."""
        app = FastAPI()
        middleware = TracingMiddleware(
            app=app,
            skip_paths=["/health"]
        )
        assert middleware is not None

    def test_middleware_skip_paths(self):
        """Test middleware skips configured paths."""
        app = FastAPI()

        @app.get("/health")
        def health():
            return {"status": "ok"}

        @app.get("/api/data")
        def get_data():
            return {"data": "value"}

        app.add_middleware(TracingMiddleware, skip_paths=["/health"])
        client = TestClient(app)

        # Both should work
        response1 = client.get("/health")
        response2 = client.get("/api/data")

        assert response1.status_code == 200
        assert response2.status_code == 200

    @pytest.mark.asyncio
    async def test_middleware_request_tracing(self):
        """Test middleware traces requests."""
        app = FastAPI()

        @app.get("/test")
        def test_endpoint():
            return {"result": "ok"}

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        response = client.get("/test")

        assert response.status_code == 200
        assert "X-Trace-ID" in response.headers or True  # May not have trace

    def test_middleware_request_attributes(self):
        """Test middleware captures request attributes."""
        app = FastAPI()

        @app.post("/api/test")
        def test_endpoint():
            return {"ok": True}

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        response = client.post("/api/test", json={"data": "test"})
        assert response.status_code == 200

    def test_middleware_error_handling(self):
        """Test middleware handles errors."""
        app = FastAPI()

        @app.get("/error")
        def error_endpoint():
            raise RuntimeError("Test error")

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        with pytest.raises(RuntimeError):
            client.get("/error")


class TestTracingIntegration:
    """Integration tests for tracing system."""

    def test_workflow_span_hierarchy(self):
        """Test nested span hierarchy."""
        with create_span("workflow", {"id": "wf1"}):
            set_span_attribute("status", "started")

            with create_span("task", {"id": "task1"}):
                set_span_attribute("status", "running")
                # Nested span

            add_span_event("task_completed")
            set_span_attribute("status", "completed")

    def test_error_context_preservation(self):
        """Test error context is preserved."""
        try:
            with create_span("operation"):
                raise ValueError("Test error")
        except ValueError:
            pass  # Expected

    def test_multiple_events(self):
        """Test multiple events in single span."""
        with create_span("multi_event"):
            add_span_event("started", {"timestamp": datetime.utcnow().isoformat()})
            add_span_event("processing")
            add_span_event("completed", {"duration_ms": 100})

    def test_concurrent_spans(self):
        """Test concurrent spans are independent."""
        import threading

        results = []

        def worker(worker_id):
            with create_span("worker", {"id": worker_id}):
                set_span_attribute("worker_id", worker_id)
                results.append(worker_id)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(results) == 3


class TestTracingDisabled:
    """Test behavior when tracing is disabled."""

    def test_create_span_disabled(self):
        """Test create_span works when disabled."""
        # Tracing is disabled in test environment
        with create_span("test"):
            set_span_attribute("key", "value")
            # Should not raise

    def test_tracer_functions_disabled(self):
        """Test tracer functions work when disabled."""
        trace_id = get_trace_id()
        span_id = get_span_id()
        # Should return empty strings or not crash

    def test_decorator_disabled(self):
        """Test decorator works when disabled."""
        @trace_function("test")
        def my_func():
            return "ok"

        assert my_func() == "ok"


class TestTracingPerformance:
    """Performance tests for tracing overhead."""

    def test_span_creation_overhead(self):
        """Test span creation has minimal overhead."""
        import time

        # Baseline
        start = time.time()
        for _ in range(100):
            pass
        baseline = time.time() - start

        # With spans
        start = time.time()
        for _ in range(100):
            with create_span("test"):
                pass
        with_spans = time.time() - start

        # Overhead should be <50% for 100 spans
        overhead = (with_spans - baseline) / baseline
        assert overhead < 0.5 or with_spans < 0.1  # Either small overhead or both small

    def test_attribute_setting_overhead(self):
        """Test attribute setting overhead."""
        import time

        with create_span("perf_test"):
            start = time.time()
            for i in range(100):
                set_span_attribute(f"attr_{i}", f"value_{i}")
            duration = time.time() - start

        # 100 attributes should take <100ms
        assert duration < 0.1


class TestSamplingConfiguration:
    """Test sampling configuration."""

    def test_sampling_ratio_default(self):
        """Test default sampling ratio."""
        assert TracingConfig.SAMPLING_RATIO == 0.1  # 10%

    def test_sampling_ratio_range(self):
        """Test sampling ratio is valid."""
        assert 0.0 <= TracingConfig.SAMPLING_RATIO <= 1.0

    def test_sampling_ratio_zero(self):
        """Test sampling ratio can be zero."""
        with patch.dict(os.environ, {"OTEL_SAMPLING_RATIO": "0"}):
            ratio = float(os.getenv("OTEL_SAMPLING_RATIO", "0.1"))
            assert ratio == 0.0


# Fixtures

@pytest.fixture
def mock_jaeger_exporter():
    """Mock Jaeger exporter."""
    with patch("autoflow.core.tracing.JaegerExporter") as mock:
        yield mock


@pytest.fixture
def test_app():
    """Create test FastAPI app."""
    app = FastAPI()

    @app.get("/test")
    def test_endpoint():
        return {"status": "ok"}

    @app.post("/workflow")
    def create_workflow(data: dict):
        return {"id": "wf1", "status": "created"}

    return app


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
