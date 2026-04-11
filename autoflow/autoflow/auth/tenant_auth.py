"""Tenant authentication and API key management.

Handles API key generation, tenant identification from requests,
quota enforcement, and rate limiting per tenant.
"""

import logging
import re
from typing import Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

from ..core.tenants import get_tenant_manager, TenantContext

logger = logging.getLogger(__name__)


class TenantAuthenticator:
    """Handles tenant authentication via API keys.

    Validates API keys, extracts tenant information, and enforces quotas.
    """

    def __init__(self):
        """Initialize authenticator."""
        self.tenant_manager = get_tenant_manager()
        self.request_log = defaultdict(list)  # tenant_id -> [(timestamp, endpoint)]

    def authenticate_request(
        self, authorization_header: Optional[str], headers: dict = None
    ) -> Tuple[Optional[str], Optional[str]]:
        """Authenticate request and extract tenant ID.

        Supports multiple authentication methods:
        1. Authorization: Bearer {api_key}
        2. X-API-Key: {api_key}
        3. X-Tenant-ID: {tenant_id}

        Args:
            authorization_header: Authorization header value
            headers: Full request headers dictionary

        Returns:
            Tuple of (tenant_id, error_message)
            Returns (tenant_id, None) on success
            Returns (None, error_message) on failure
        """
        if headers is None:
            headers = {}

        # Method 1: Bearer token in Authorization header
        if authorization_header and authorization_header.startswith("Bearer "):
            api_key = authorization_header.split(" ", 1)[1]
            tenant_config = self.tenant_manager.get_tenant_by_api_key(api_key)
            if tenant_config:
                return tenant_config.tenant_id, None
            return None, "Invalid API key"

        # Method 2: X-API-Key header
        api_key = headers.get("X-API-Key")
        if api_key:
            tenant_config = self.tenant_manager.get_tenant_by_api_key(api_key)
            if tenant_config:
                return tenant_config.tenant_id, None
            return None, "Invalid API key"

        # Method 3: X-Tenant-ID header (for internal/trusted requests)
        tenant_id = headers.get("X-Tenant-ID")
        if tenant_id:
            if self.tenant_manager.get_tenant(tenant_id):
                return tenant_id, None
            return None, "Unknown tenant ID"

        return None, "Missing authentication credentials"

    def enforce_quota(self, tenant_id: str, quota_type: str) -> Tuple[bool, Optional[str]]:
        """Enforce tenant quota limits.

        Args:
            tenant_id: Tenant identifier
            quota_type: Quota type to check

        Returns:
            Tuple of (allowed, error_message)
            Returns (True, None) if within quota
            Returns (False, error_message) if quota exceeded
        """
        try:
            within_quota = self.tenant_manager.check_quota(tenant_id, quota_type)

            if not within_quota:
                config = self.tenant_manager.get_tenant(tenant_id)
                if quota_type == "requests_per_hour":
                    limit = config.max_requests_per_hour
                    error = f"Rate limit exceeded: {limit} requests per hour"
                elif quota_type == "concurrent_workflows":
                    limit = config.max_concurrent_workflows
                    error = f"Concurrent workflow limit exceeded: {limit} workflows"
                elif quota_type == "jobs_per_day":
                    limit = config.max_jobs_per_day
                    error = f"Daily job limit exceeded: {limit} jobs per day"
                elif quota_type == "storage":
                    limit = config.storage_quota_gb
                    error = f"Storage quota exceeded: {limit} GB"
                else:
                    error = "Unknown quota exceeded"

                return False, error

            return True, None

        except ValueError as e:
            return False, str(e)

    def record_request(self, tenant_id: str, endpoint: str):
        """Record tenant API request for auditing.

        Args:
            tenant_id: Tenant identifier
            endpoint: API endpoint called
        """
        self.request_log[tenant_id].append((datetime.now(), endpoint))

        # Record usage
        self.tenant_manager.record_usage(tenant_id, "requests", 1.0)

        # Keep only recent logs (last 24 hours)
        cutoff = datetime.now() - timedelta(hours=24)
        self.request_log[tenant_id] = [
            (ts, ep) for ts, ep in self.request_log[tenant_id] if ts > cutoff
        ]

    def get_request_logs(self, tenant_id: str, hours: int = 1) -> list:
        """Get recent request logs for tenant.

        Args:
            tenant_id: Tenant identifier
            hours: Number of hours to look back

        Returns:
            List of (timestamp, endpoint) tuples
        """
        cutoff = datetime.now() - timedelta(hours=hours)
        return [
            (ts, ep)
            for ts, ep in self.request_log.get(tenant_id, [])
            if ts > cutoff
        ]

    def get_request_count(self, tenant_id: str, hours: int = 1) -> int:
        """Get request count for tenant in specified time window.

        Args:
            tenant_id: Tenant identifier
            hours: Number of hours to look back

        Returns:
            Request count
        """
        return len(self.get_request_logs(tenant_id, hours))


class TenantRateLimiter:
    """Token bucket rate limiter for tenants.

    Implements per-tenant rate limiting with configurable limits.
    """

    def __init__(self):
        """Initialize rate limiter."""
        self.tenant_manager = get_tenant_manager()
        self.buckets = defaultdict(self._create_bucket)

    def _create_bucket(self):
        """Create new rate limit bucket with full tokens."""
        return {
            "tokens": 1.0,  # Start with 1 token, will refill based on config
            "last_refill": datetime.now()
        }

    def is_allowed(self, tenant_id: str) -> bool:
        """Check if request is allowed under rate limit.

        Uses token bucket algorithm with per-tenant limits.

        Args:
            tenant_id: Tenant identifier

        Returns:
            True if request allowed, False if rate limited
        """
        config = self.tenant_manager.get_tenant(tenant_id)
        if not config:
            return False

        bucket = self.buckets[tenant_id]
        now = datetime.now()

        # Refill tokens based on elapsed time
        elapsed = (now - bucket["last_refill"]).total_seconds()
        tokens_per_second = config.max_requests_per_hour / 3600.0
        tokens_to_add = elapsed * tokens_per_second

        bucket["tokens"] = min(
            config.max_requests_per_hour, bucket["tokens"] + tokens_to_add
        )
        bucket["last_refill"] = now

        # Check if token available
        if bucket["tokens"] >= 1.0:
            bucket["tokens"] -= 1.0
            return True

        return False

    def get_rate_limit_info(self, tenant_id: str) -> dict:
        """Get current rate limit status for tenant.

        Args:
            tenant_id: Tenant identifier

        Returns:
            Dictionary with rate limit info
        """
        config = self.tenant_manager.get_tenant(tenant_id)
        if not config:
            return {}

        bucket = self.buckets[tenant_id]
        tokens = min(config.max_requests_per_hour, bucket["tokens"])

        return {
            "tenant_id": tenant_id,
            "limit": config.max_requests_per_hour,
            "tokens_available": int(tokens),
            "reset_in_seconds": 3600,  # Always 1 hour for requests_per_hour
        }


# Global authenticator and rate limiter instances
_authenticator: Optional[TenantAuthenticator] = None
_rate_limiter: Optional[TenantRateLimiter] = None


def get_authenticator() -> TenantAuthenticator:
    """Get or create global authenticator instance.

    Returns:
        Global TenantAuthenticator instance
    """
    global _authenticator
    if _authenticator is None:
        _authenticator = TenantAuthenticator()
    return _authenticator


def get_rate_limiter() -> TenantRateLimiter:
    """Get or create global rate limiter instance.

    Returns:
        Global TenantRateLimiter instance
    """
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = TenantRateLimiter()
    return _rate_limiter
