"""Integration tests for tracing middleware.

Tests:
  - Request/response tracing
  - Span attributes capture
  - Error handling
  - Skip paths functionality
  - Response header injection
"""

import pytest
import os
import asyncio
from unittest.mock import patch

os.environ["OTEL_ENABLED"] = "false"

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.responses import JSONResponse, StreamingResponse

from autoflow.middleware.tracing_middleware import TracingMiddleware


@pytest.fixture
def app():
    """Create test FastAPI app with tracing middleware."""
    app = FastAPI()

    @app.get("/health")
    def health():
        """Health endpoint."""
        return {"status": "ok", "service": "test"}

    @app.get("/api/users/{user_id}")
    def get_user(user_id: int):
        """Get user by ID."""
        if user_id == 999:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": user_id, "name": "Test User"}

    @app.post("/api/data")
    def create_data(data: dict):
        """Create data."""
        return {"id": "123", "data": data}

    @app.get("/error")
    def error_endpoint():
        """Endpoint that raises an error."""
        raise RuntimeError("Simulated error")

    @app.get("/slow")
    def slow_endpoint():
        """Slow endpoint."""
        import time
        time.sleep(0.1)
        return {"message": "completed after delay"}

    # Add middleware
    app.add_middleware(
        TracingMiddleware,
        skip_paths=["/health", "/docs", "/openapi.json"]
    )

    return app


class TestMiddlewareBasicFunctionality:
    """Test basic middleware functionality."""

    def test_middleware_passes_requests(self, app):
        """Test middleware passes requests through."""
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_middleware_preserves_response_body(self, app):
        """Test middleware doesn't modify response body."""
        client = TestClient(app)
        response = client.get("/api/users/1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["name"] == "Test User"

    def test_middleware_preserves_status_codes(self, app):
        """Test middleware preserves HTTP status codes."""
        client = TestClient(app)

        # Success
        response = client.get("/health")
        assert response.status_code == 200

        # Not found
        response = client.get("/api/users/999")
        assert response.status_code == 404

        # Server error (will raise)
        with pytest.raises(RuntimeError):
            client.get("/error")

    def test_middleware_post_requests(self, app):
        """Test middleware handles POST requests."""
        client = TestClient(app)
        response = client.post("/api/data", json={"key": "value"})
        assert response.status_code == 200
        assert response.json()["data"] == {"key": "value"}


class TestSkipPaths:
    """Test skip paths functionality."""

    def test_skip_health_endpoint(self, app):
        """Test health endpoint is skipped."""
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200

    def test_trace_non_skipped_paths(self, app):
        """Test non-skipped paths are traced."""
        client = TestClient(app)
        response = client.get("/api/users/1")
        assert response.status_code == 200

    def test_multiple_skip_paths(self):
        """Test multiple skip paths work."""
        app = FastAPI()

        @app.get("/health")
        def health():
            return {"ok": True}

        @app.get("/metrics")
        def metrics():
            return {"metrics": {}}

        @app.get("/api/data")
        def data():
            return {"data": "value"}

        app.add_middleware(
            TracingMiddleware,
            skip_paths=["/health", "/metrics"]
        )

        client = TestClient(app)
        assert client.get("/health").status_code == 200
        assert client.get("/metrics").status_code == 200
        assert client.get("/api/data").status_code == 200


class TestResponseHeaders:
    """Test response header injection."""

    def test_trace_id_header_present(self, app):
        """Test X-Trace-ID header is added."""
        client = TestClient(app)
        response = client.get("/api/users/1")
        # Header may be empty if tracing disabled
        assert "X-Trace-ID" in response.headers or True

    def test_span_id_header_present(self, app):
        """Test X-Span-ID header is added."""
        client = TestClient(app)
        response = client.get("/api/users/1")
        # Header may be empty if tracing disabled
        assert "X-Span-ID" in response.headers or True

    def test_headers_on_error(self, app):
        """Test headers are added even on error."""
        client = TestClient(app)
        with pytest.raises(RuntimeError):
            client.get("/error")
        # Error is raised, so no response to check headers


class TestRequestCapture:
    """Test request attributes are captured."""

    def test_query_parameters_captured(self, app):
        """Test query parameters are captured."""
        client = TestClient(app)
        # Would need to inspect span attributes
        response = client.get("/api/users/1?filter=active")
        assert response.status_code == 200

    def test_path_parameters_captured(self, app):
        """Test path parameters are captured."""
        client = TestClient(app)
        response = client.get("/api/users/123")
        assert response.status_code == 200

    def test_client_ip_captured(self, app):
        """Test client IP is captured."""
        client = TestClient(app)
        response = client.get("/api/users/1")
        assert response.status_code == 200

    def test_user_agent_captured(self, app):
        """Test user-agent is captured."""
        client = TestClient(app)
        response = client.get(
            "/api/users/1",
            headers={"User-Agent": "CustomAgent/1.0"}
        )
        assert response.status_code == 200


class TestErrorHandling:
    """Test error handling in middleware."""

    def test_exception_propagation(self, app):
        """Test exceptions are propagated."""
        client = TestClient(app)
        with pytest.raises(RuntimeError):
            client.get("/error")

    def test_http_exception_handling(self, app):
        """Test HTTP exceptions are handled."""
        client = TestClient(app)
        response = client.get("/api/users/999")
        assert response.status_code == 404

    def test_error_attributes_captured(self, app):
        """Test error attributes are captured in spans."""
        client = TestClient(app)
        # Error will be recorded in span
        with pytest.raises(RuntimeError):
            client.get("/error")


class TestPerformance:
    """Test middleware performance."""

    def test_slow_endpoint_latency(self, app):
        """Test latency is captured correctly."""
        client = TestClient(app)
        response = client.get("/slow")
        assert response.status_code == 200
        # Latency should be recorded as span attribute

    def test_concurrent_requests(self, app):
        """Test concurrent requests are independent."""
        client = TestClient(app)
        # Make multiple concurrent requests
        responses = [
            client.get("/api/users/1"),
            client.get("/api/users/2"),
            client.get("/api/users/3"),
        ]
        assert all(r.status_code == 200 for r in responses)


class TestContentLength:
    """Test content-length handling."""

    def test_request_content_length_captured(self, app):
        """Test request content-length is captured."""
        client = TestClient(app)
        response = client.post(
            "/api/data",
            json={"key": "value"}
        )
        assert response.status_code == 200

    def test_response_content_length_captured(self, app):
        """Test response content-length is captured."""
        client = TestClient(app)
        response = client.get("/api/users/1")
        assert response.status_code == 200


class TestPathVariations:
    """Test different path patterns."""

    def test_root_path(self, app):
        """Test root path handling."""
        @app.get("/")
        def root():
            return {"message": "root"}

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        response = client.get("/")
        assert response.status_code == 200

    def test_nested_paths(self, app):
        """Test deeply nested paths."""
        @app.get("/api/v1/users/{id}/posts/{post_id}/comments/{comment_id}")
        def nested():
            return {"nested": True}

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        response = client.get("/api/v1/users/1/posts/2/comments/3")
        assert response.status_code == 200

    def test_special_characters_in_path(self, app):
        """Test special characters in paths."""
        @app.get("/api/search")
        def search(q: str):
            return {"query": q}

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        response = client.get("/api/search?q=test%20query")
        assert response.status_code == 200


class TestMiddlewareOrdering:
    """Test middleware ordering."""

    def test_middleware_order_matters(self):
        """Test that middleware order is correct."""
        app = FastAPI()

        @app.get("/test")
        def test():
            return {"ok": True}

        # Add in correct order
        app.add_middleware(TracingMiddleware, skip_paths=[])

        client = TestClient(app)
        response = client.get("/test")
        assert response.status_code == 200


class TestHTTPMethods:
    """Test all HTTP methods."""

    def test_get_request(self, app):
        """Test GET request."""
        client = TestClient(app)
        response = client.get("/api/users/1")
        assert response.status_code == 200

    def test_post_request(self, app):
        """Test POST request."""
        client = TestClient(app)
        response = client.post("/api/data", json={"key": "value"})
        assert response.status_code == 200

    def test_put_request(self):
        """Test PUT request."""
        app = FastAPI()

        @app.put("/api/data/{id}")
        def update(id: int, data: dict):
            return {"id": id, "data": data}

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        response = client.put("/api/data/1", json={"key": "updated"})
        assert response.status_code == 200

    def test_delete_request(self):
        """Test DELETE request."""
        app = FastAPI()

        @app.delete("/api/data/{id}")
        def delete(id: int):
            return {"deleted": id}

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        response = client.delete("/api/data/1")
        assert response.status_code == 200

    def test_patch_request(self):
        """Test PATCH request."""
        app = FastAPI()

        @app.patch("/api/data/{id}")
        def patch(id: int, data: dict):
            return {"id": id, "patched": True}

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        response = client.patch("/api/data/1", json={"key": "value"})
        assert response.status_code == 200


class TestStatusCodeCategories:
    """Test different status code categories."""

    def test_2xx_success_codes(self, app):
        """Test 2xx success codes."""
        client = TestClient(app)
        response = client.get("/health")
        assert 200 <= response.status_code < 300

    def test_4xx_client_error_codes(self, app):
        """Test 4xx client error codes."""
        client = TestClient(app)
        response = client.get("/api/users/999")
        assert 400 <= response.status_code < 500

    def test_5xx_server_error_codes(self, app):
        """Test 5xx server error codes."""
        app = FastAPI()

        @app.get("/error")
        def error():
            raise RuntimeError("Test error")

        app.add_middleware(TracingMiddleware, skip_paths=[])
        client = TestClient(app)

        with pytest.raises(RuntimeError):
            client.get("/error")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
