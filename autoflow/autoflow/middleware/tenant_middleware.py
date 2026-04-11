"""Tenant middleware for request processing.

Extracts tenant from requests, sets tenant context, validates access,
and logs tenant operations for audit purposes.
"""

import logging
import json
from typing import Callable
from datetime import datetime

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from ..core.tenants import TenantContext
from ..auth.tenant_auth import get_authenticator, get_rate_limiter

logger = logging.getLogger(__name__)


class TenantMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for tenant extraction and context management.

    Responsibilities:
    - Extract tenant from request (header/API key)
    - Set tenant context for request scope
    - Validate tenant access
    - Enforce rate limits
    - Log tenant operations
    """

    # Endpoints that don't require tenant authentication
    PUBLIC_ENDPOINTS = {
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/v1/health",
    }

    def __init__(self, app):
        """Initialize middleware.

        Args:
            app: FastAPI application
        """
        super().__init__(app)
        self.authenticator = get_authenticator()
        self.rate_limiter = get_rate_limiter()

    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        """Process request and set tenant context.

        Args:
            request: Incoming request
            call_next: Next middleware/endpoint

        Returns:
            Response from next handler
        """
        path = request.url.path

        # Skip tenant authentication for public endpoints
        if self._is_public_endpoint(path):
            response = await call_next(request)
            return response

        # Extract authentication header
        auth_header = request.headers.get("authorization")

        # Authenticate request and extract tenant
        tenant_id, error = self.authenticator.authenticate_request(
            auth_header, dict(request.headers)
        )

        if not tenant_id:
            logger.warning(f"Authentication failed for {path}: {error}")
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized", "message": error},
            )

        # Check rate limit
        if not self.rate_limiter.is_allowed(tenant_id):
            logger.warning(f"Rate limit exceeded for tenant {tenant_id} on {path}")
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": "Rate limit exceeded",
                },
            )

        # Check tenant-specific quotas
        quota_ok, quota_error = self.authenticator.enforce_quota(
            tenant_id, "requests_per_hour"
        )
        if not quota_ok:
            logger.warning(f"Quota exceeded for tenant {tenant_id}: {quota_error}")
            return JSONResponse(
                status_code=429,
                content={"error": "Quota Exceeded", "message": quota_error},
            )

        # Set tenant context for request scope
        tenant_config = self.authenticator.tenant_manager.get_tenant(tenant_id)
        TenantContext.set_tenant(tenant_id, tenant_config)

        # Record request
        self.authenticator.record_request(tenant_id, path)

        try:
            # Add tenant info to request state for downstream handlers
            request.state.tenant_id = tenant_id
            request.state.tenant_config = tenant_config

            # Call next handler
            response = await call_next(request)

            # Add tenant ID to response headers
            response.headers["X-Tenant-ID"] = tenant_id

            # Log successful request
            self._log_request(request, tenant_id, response.status_code)

            return response

        except Exception as e:
            logger.error(
                f"Error processing request for tenant {tenant_id}: {str(e)}",
                exc_info=True,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal Server Error",
                    "message": "An error occurred processing your request",
                },
            )
        finally:
            # Clear tenant context after request
            TenantContext.clear()

    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint requires tenant authentication.

        Args:
            path: Request path

        Returns:
            True if endpoint is public
        """
        return path in self.PUBLIC_ENDPOINTS or path.startswith("/api/v1/auth/")

    def _log_request(self, request: Request, tenant_id: str, status_code: int):
        """Log tenant API request for audit.

        Args:
            request: Request object
            tenant_id: Tenant identifier
            status_code: Response status code
        """
        log_data = {
            "timestamp": datetime.now(datetime.UTC).isoformat(),
            "tenant_id": tenant_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": status_code,
            "client_ip": request.client.host if request.client else "unknown",
        }

        logger.info(f"Tenant request: {json.dumps(log_data)}")


class TenantContextCleanupMiddleware(BaseHTTPMiddleware):
    """Ensures tenant context is cleaned up after request.

    Acts as safety net in case TenantMiddleware cleanup fails.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        """Process request and ensure cleanup.

        Args:
            request: Incoming request
            call_next: Next middleware/endpoint

        Returns:
            Response from next handler
        """
        try:
            response = await call_next(request)
            return response
        finally:
            TenantContext.clear()


def setup_tenant_middleware(app) -> None:
    """Setup tenant middleware on FastAPI app.

    Args:
        app: FastAPI application instance
    """
    # Add cleanup middleware first (innermost)
    app.add_middleware(TenantContextCleanupMiddleware)

    # Add main tenant middleware
    app.add_middleware(TenantMiddleware)

    logger.info("Tenant middleware configured")
