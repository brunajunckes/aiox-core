"""Multi-tenant management and context propagation.

Provides tenant context management, tenant-aware operations, configuration storage,
and quota management for multi-tenant deployments.
"""

import os
import uuid
import logging
from contextlib import contextmanager
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from threading import local

logger = logging.getLogger(__name__)


@dataclass
class TenantConfig:
    """Tenant configuration settings."""

    tenant_id: str
    name: str
    max_requests_per_hour: int = 1000
    max_concurrent_workflows: int = 10
    max_jobs_per_day: int = 500
    storage_quota_gb: float = 100.0
    features: Dict[str, bool] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.features is None:
            self.features = {
                "advanced_analytics": False,
                "custom_models": False,
                "api_access": True,
                "batch_processing": False,
                "webhook_integrations": False,
                "priority_support": False,
            }
        if self.metadata is None:
            self.metadata = {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


class TenantContext:
    """Thread-local tenant context storage.

    Provides thread-safe tenant context management within request scope.
    """

    _context = local()

    @classmethod
    def set_tenant(cls, tenant_id: str, config: Optional[TenantConfig] = None):
        """Set current tenant in thread-local context.

        Args:
            tenant_id: Tenant identifier
            config: Optional tenant configuration
        """
        cls._context.tenant_id = tenant_id
        cls._context.config = config

    @classmethod
    def get_tenant_id(cls) -> Optional[str]:
        """Get current tenant ID from context.

        Returns:
            Current tenant ID or None if not set
        """
        return getattr(cls._context, "tenant_id", None)

    @classmethod
    def get_config(cls) -> Optional[TenantConfig]:
        """Get current tenant configuration from context.

        Returns:
            Current tenant config or None if not set
        """
        return getattr(cls._context, "config", None)

    @classmethod
    def clear(cls):
        """Clear tenant context."""
        cls._context.tenant_id = None
        cls._context.config = None

    @classmethod
    @contextmanager
    def scope(cls, tenant_id: str, config: Optional[TenantConfig] = None):
        """Context manager for tenant scope.

        Args:
            tenant_id: Tenant identifier
            config: Optional tenant configuration

        Yields:
            Tenant ID within scope
        """
        old_tenant = cls.get_tenant_id()
        old_config = cls.get_config()

        try:
            cls.set_tenant(tenant_id, config)
            yield tenant_id
        finally:
            cls.set_tenant(old_tenant, old_config)


class TenantManager:
    """Manages tenant lifecycle, configuration, and quotas.

    Handles tenant creation, configuration retrieval, quota tracking,
    and tenant-aware operations.
    """

    def __init__(self):
        """Initialize tenant manager.

        In production, this would connect to a database.
        For now, uses in-memory storage for demo.
        """
        # In-memory storage (replace with DB in production)
        self._tenants: Dict[str, TenantConfig] = {}
        self._usage: Dict[str, Dict[str, Any]] = {}
        self._api_keys: Dict[str, str] = {}  # api_key -> tenant_id

        # Load default tenant if specified
        if os.getenv("DEFAULT_TENANT_ID"):
            self._initialize_default_tenant()

    def create_tenant(
        self,
        name: str,
        max_requests_per_hour: int = 1000,
        max_concurrent_workflows: int = 10,
        max_jobs_per_day: int = 500,
        storage_quota_gb: float = 100.0,
    ) -> TenantConfig:
        """Create new tenant.

        Args:
            name: Tenant name
            max_requests_per_hour: Rate limit
            max_concurrent_workflows: Concurrent workflow limit
            max_jobs_per_day: Daily job limit
            storage_quota_gb: Storage quota in GB

        Returns:
            Created tenant configuration
        """
        tenant_id = str(uuid.uuid4())

        config = TenantConfig(
            tenant_id=tenant_id,
            name=name,
            max_requests_per_hour=max_requests_per_hour,
            max_concurrent_workflows=max_concurrent_workflows,
            max_jobs_per_day=max_jobs_per_day,
            storage_quota_gb=storage_quota_gb,
        )

        self._tenants[tenant_id] = config
        self._usage[tenant_id] = {
            "requests_this_hour": 0,
            "concurrent_workflows": 0,
            "jobs_today": 0,
            "storage_used_gb": 0.0,
        }

        logger.info(f"Created tenant {tenant_id}: {name}")
        return config

    def get_tenant(self, tenant_id: str) -> Optional[TenantConfig]:
        """Get tenant configuration by ID.

        Args:
            tenant_id: Tenant identifier

        Returns:
            Tenant configuration or None if not found
        """
        return self._tenants.get(tenant_id)

    def list_tenants(self) -> list[TenantConfig]:
        """List all tenants.

        Returns:
            List of tenant configurations
        """
        return list(self._tenants.values())

    def delete_tenant(self, tenant_id: str) -> bool:
        """Delete tenant and associated data.

        Args:
            tenant_id: Tenant identifier

        Returns:
            True if deleted, False if not found
        """
        if tenant_id in self._tenants:
            del self._tenants[tenant_id]
            del self._usage[tenant_id]

            # Remove associated API keys
            keys_to_delete = [k for k, v in self._api_keys.items() if v == tenant_id]
            for key in keys_to_delete:
                del self._api_keys[key]

            logger.info(f"Deleted tenant {tenant_id}")
            return True

        return False

    def generate_api_key(self, tenant_id: str) -> str:
        """Generate API key for tenant.

        Args:
            tenant_id: Tenant identifier

        Returns:
            Generated API key
        """
        if tenant_id not in self._tenants:
            raise ValueError(f"Tenant {tenant_id} not found")

        api_key = f"sk_{uuid.uuid4().hex}"
        self._api_keys[api_key] = tenant_id

        logger.info(f"Generated API key for tenant {tenant_id}")
        return api_key

    def get_tenant_by_api_key(self, api_key: str) -> Optional[TenantConfig]:
        """Get tenant configuration by API key.

        Args:
            api_key: API key

        Returns:
            Tenant configuration or None if key not found
        """
        tenant_id = self._api_keys.get(api_key)
        if tenant_id:
            return self.get_tenant(tenant_id)
        return None

    def check_quota(self, tenant_id: str, quota_type: str) -> bool:
        """Check if tenant has quota available.

        Args:
            tenant_id: Tenant identifier
            quota_type: Quota type (requests_per_hour, concurrent_workflows, jobs_per_day, storage)

        Returns:
            True if within quota, False if exceeded

        Raises:
            ValueError: If tenant or quota type not found
        """
        config = self.get_tenant(tenant_id)
        if not config:
            raise ValueError(f"Tenant {tenant_id} not found")

        usage = self._usage.get(tenant_id, {})

        if quota_type == "requests_per_hour":
            return usage.get("requests_this_hour", 0) < config.max_requests_per_hour
        elif quota_type == "concurrent_workflows":
            return usage.get("concurrent_workflows", 0) < config.max_concurrent_workflows
        elif quota_type == "jobs_per_day":
            return usage.get("jobs_today", 0) < config.max_jobs_per_day
        elif quota_type == "storage":
            used = usage.get("storage_used_gb", 0.0)
            return used < config.storage_quota_gb
        else:
            raise ValueError(f"Unknown quota type: {quota_type}")

    def record_usage(self, tenant_id: str, usage_type: str, amount: float = 1.0):
        """Record tenant usage.

        Args:
            tenant_id: Tenant identifier
            usage_type: Usage type (requests, concurrent_workflows, jobs, storage)
            amount: Usage amount
        """
        if tenant_id not in self._usage:
            self._usage[tenant_id] = {
                "requests_this_hour": 0,
                "concurrent_workflows": 0,
                "jobs_today": 0,
                "storage_used_gb": 0.0,
            }

        if usage_type == "requests":
            self._usage[tenant_id]["requests_this_hour"] += amount
        elif usage_type == "concurrent_workflows":
            self._usage[tenant_id]["concurrent_workflows"] += amount
        elif usage_type == "jobs":
            self._usage[tenant_id]["jobs_today"] += amount
        elif usage_type == "storage":
            self._usage[tenant_id]["storage_used_gb"] += amount

    def get_usage(self, tenant_id: str) -> Dict[str, Any]:
        """Get tenant usage statistics.

        Args:
            tenant_id: Tenant identifier

        Returns:
            Usage dictionary
        """
        return self._usage.get(tenant_id, {})

    def reset_hourly_limits(self):
        """Reset hourly rate limit counters for all tenants.

        Should be called once per hour.
        """
        for usage in self._usage.values():
            usage["requests_this_hour"] = 0
        logger.info("Reset hourly limits for all tenants")

    def reset_daily_limits(self):
        """Reset daily limits for all tenants.

        Should be called once per day.
        """
        for usage in self._usage.values():
            usage["jobs_today"] = 0
        logger.info("Reset daily limits for all tenants")

    def _initialize_default_tenant(self):
        """Initialize default tenant from environment variable."""
        default_id = os.getenv("DEFAULT_TENANT_ID")
        if default_id and default_id not in self._tenants:
            config = TenantConfig(
                tenant_id=default_id,
                name=os.getenv("DEFAULT_TENANT_NAME", "Default Tenant"),
                max_requests_per_hour=int(
                    os.getenv("DEFAULT_TENANT_RATE_LIMIT", "1000")
                ),
            )
            self._tenants[default_id] = config
            self._usage[default_id] = {
                "requests_this_hour": 0,
                "concurrent_workflows": 0,
                "jobs_today": 0,
                "storage_used_gb": 0.0,
            }


# Global tenant manager instance
_tenant_manager: Optional[TenantManager] = None


def get_tenant_manager() -> TenantManager:
    """Get or create global tenant manager instance.

    Returns:
        Global TenantManager instance
    """
    global _tenant_manager
    if _tenant_manager is None:
        _tenant_manager = TenantManager()
    return _tenant_manager
