"""Tracing Middleware — Request/Response tracing with span context propagation.

Captures:
  - Request method, path, query parameters
  - Response status code, latency
  - Error details
  - User/tenant context
"""

import time
import logging
from typing import Callable, Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from ..core.tracing import (
    get_tracer,
    set_span_attribute,
    record_span_exception,
    get_trace_id,
    get_span_id,
)

logger = logging.getLogger(__name__)


class TracingMiddleware(BaseHTTPMiddleware):
    """Middleware for tracing HTTP requests and responses.

    Automatically creates spans for each request with attributes:
      - http.method
      - http.url
      - http.target
      - http.status_code
      - http.response_content_length
      - http.request_content_length
      - duration_ms
      - trace_id
      - span_id
    """

    def __init__(self, app: ASGIApp, skip_paths: Optional[list] = None):
        """Initialize middleware.

        Args:
            app: ASGI application
            skip_paths: Paths to skip tracing (e.g., ["/health", "/metrics"])
        """
        super().__init__(app)
        self.skip_paths = skip_paths or []

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with tracing.

        Args:
            request: HTTP request
            call_next: Next middleware/handler

        Returns:
            HTTP response
        """
        # Skip certain paths
        if any(request.url.path.startswith(p) for p in self.skip_paths):
            return await call_next(request)

        tracer = get_tracer()
        start_time = time.time()

        # Create span name from method + path
        span_name = f"{request.method} {request.url.path}"

        with tracer.start_as_current_span(span_name) as span:
            # Set request attributes
            set_span_attribute("http.method", request.method)
            set_span_attribute("http.url", str(request.url))
            set_span_attribute("http.target", request.url.path)
            set_span_attribute("http.query_string", request.url.query)

            # Client info
            if request.client:
                set_span_attribute("http.client_ip", request.client.host)
                set_span_attribute("http.client_port", request.client.port)

            # Request headers (selective)
            if "user-agent" in request.headers:
                set_span_attribute("http.user_agent", request.headers["user-agent"])

            if "content-length" in request.headers:
                try:
                    content_length = int(request.headers["content-length"])
                    set_span_attribute("http.request_content_length", content_length)
                except ValueError:
                    pass

            # Custom headers (trace propagation)
            trace_id = request.headers.get("x-trace-id")
            if trace_id:
                set_span_attribute("trace.propagated_id", trace_id)

            span_id = request.headers.get("x-span-id")
            if span_id:
                set_span_attribute("trace.propagated_span_id", span_id)

            try:
                response = await call_next(request)

                # Set response attributes
                set_span_attribute("http.status_code", response.status_code)

                if "content-length" in response.headers:
                    try:
                        content_length = int(response.headers["content-length"])
                        set_span_attribute("http.response_content_length", content_length)
                    except ValueError:
                        pass

                # Calculate duration
                duration_ms = (time.time() - start_time) * 1000
                set_span_attribute("duration_ms", duration_ms)
                set_span_attribute("trace_id", get_trace_id())
                set_span_attribute("span_id", get_span_id())

                # Set status
                if 200 <= response.status_code < 300:
                    set_span_attribute("status", "success")
                elif 400 <= response.status_code < 500:
                    set_span_attribute("status", "client_error")
                else:
                    set_span_attribute("status", "error")

                # Add response headers to response
                response.headers["X-Trace-ID"] = get_trace_id()
                response.headers["X-Span-ID"] = get_span_id()

                logger.debug(
                    f"{request.method} {request.url.path} {response.status_code} "
                    f"({duration_ms:.1f}ms) [trace={get_trace_id()}]"
                )

                return response

            except Exception as e:
                # Record exception
                record_span_exception(e)
                set_span_attribute("status", "error")
                set_span_attribute("error.type", type(e).__name__)
                set_span_attribute("error.message", str(e))

                duration_ms = (time.time() - start_time) * 1000
                set_span_attribute("duration_ms", duration_ms)

                logger.error(
                    f"Error processing {request.method} {request.url.path}: {e} "
                    f"[trace={get_trace_id()}]"
                )

                raise
