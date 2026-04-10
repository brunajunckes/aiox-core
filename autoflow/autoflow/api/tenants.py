"""Tenant management API endpoints.

Provides endpoints for:
- Tenant CRUD operations (admin only)
- API key management
- Quota and usage tracking
- Tenant configuration
"""

from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel, Field

from ..core.tenants import get_tenant_manager, TenantContext
from ..auth.tenant_auth import get_authenticator

router = APIRouter(prefix="/api/v1/tenants", tags=["tenants"])


# ============================================================================
# Pydantic Models
# ============================================================================


class TenantCreate(BaseModel):
    """Request model for creating tenant."""

    name: str = Field(..., description="Tenant name")
    max_requests_per_hour: int = Field(1000, description="Rate limit")
    max_concurrent_workflows: int = Field(10, description="Concurrent workflow limit")
    max_jobs_per_day: int = Field(500, description="Daily job limit")
    storage_quota_gb: float = Field(100.0, description="Storage quota in GB")


class TenantUpdate(BaseModel):
    """Request model for updating tenant."""

    name: Optional[str] = None
    max_requests_per_hour: Optional[int] = None
    max_concurrent_workflows: Optional[int] = None
    max_jobs_per_day: Optional[int] = None
    storage_quota_gb: Optional[float] = None


class TenantResponse(BaseModel):
    """Response model for tenant."""

    tenant_id: str
    name: str
    max_requests_per_hour: int
    max_concurrent_workflows: int
    max_jobs_per_day: int
    storage_quota_gb: float


class APIKeyResponse(BaseModel):
    """Response model for API key."""

    api_key: str
    tenant_id: str


class UsageResponse(BaseModel):
    """Response model for tenant usage."""

    tenant_id: str
    requests_this_hour: int
    concurrent_workflows: int
    jobs_today: int
    storage_used_gb: float


class TenantListResponse(BaseModel):
    """Response model for tenant list."""

    tenants: List[TenantResponse]
    total: int


# ============================================================================
# Helper Functions
# ============================================================================


def _is_admin(request: Request) -> bool:
    """Check if request is from admin.

    In production, this would check auth scopes/roles.
    For now, checks for special admin header.
    """
    return request.headers.get("X-Admin") == "true"


def _require_admin(request: Request) -> None:
    """Require admin authentication.

    Args:
        request: Request object

    Raises:
        HTTPException: If not admin
    """
    if not _is_admin(request):
        raise HTTPException(status_code=403, detail="Admin access required")


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/", response_model=TenantResponse)
async def create_tenant(request: Request, tenant: TenantCreate) -> dict:
    """Create new tenant.

    Requires admin access.

    Args:
        request: Request object
        tenant: Tenant creation data

    Returns:
        Created tenant configuration

    Raises:
        HTTPException: If not admin or creation fails
    """
    _require_admin(request)

    manager = get_tenant_manager()

    try:
        config = manager.create_tenant(
            name=tenant.name,
            max_requests_per_hour=tenant.max_requests_per_hour,
            max_concurrent_workflows=tenant.max_concurrent_workflows,
            max_jobs_per_day=tenant.max_jobs_per_day,
            storage_quota_gb=tenant.storage_quota_gb,
        )

        return {
            "tenant_id": config.tenant_id,
            "name": config.name,
            "max_requests_per_hour": config.max_requests_per_hour,
            "max_concurrent_workflows": config.max_concurrent_workflows,
            "max_jobs_per_day": config.max_jobs_per_day,
            "storage_quota_gb": config.storage_quota_gb,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(request: Request, tenant_id: str) -> dict:
    """Get tenant configuration.

    Can access own tenant or any tenant if admin.

    Args:
        request: Request object
        tenant_id: Tenant identifier

    Returns:
        Tenant configuration

    Raises:
        HTTPException: If tenant not found or access denied
    """
    manager = get_tenant_manager()

    # Check access: admin or own tenant
    current_tenant = TenantContext.get_tenant_id()
    if current_tenant != tenant_id and not _is_admin(request):
        raise HTTPException(status_code=403, detail="Access denied")

    config = manager.get_tenant(tenant_id)
    if not config:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {
        "tenant_id": config.tenant_id,
        "name": config.name,
        "max_requests_per_hour": config.max_requests_per_hour,
        "max_concurrent_workflows": config.max_concurrent_workflows,
        "max_jobs_per_day": config.max_jobs_per_day,
        "storage_quota_gb": config.storage_quota_gb,
    }


@router.get("/", response_model=TenantListResponse)
async def list_tenants(request: Request) -> dict:
    """List all tenants.

    Requires admin access. Regular users can only see their own tenant.

    Args:
        request: Request object

    Returns:
        List of tenants

    Raises:
        HTTPException: If not admin
    """
    _require_admin(request)

    manager = get_tenant_manager()
    tenants = manager.list_tenants()

    return {
        "tenants": [
            {
                "tenant_id": config.tenant_id,
                "name": config.name,
                "max_requests_per_hour": config.max_requests_per_hour,
                "max_concurrent_workflows": config.max_concurrent_workflows,
                "max_jobs_per_day": config.max_jobs_per_day,
                "storage_quota_gb": config.storage_quota_gb,
            }
            for config in tenants
        ],
        "total": len(tenants),
    }


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    request: Request, tenant_id: str, update: TenantUpdate
) -> dict:
    """Update tenant configuration.

    Requires admin access.

    Args:
        request: Request object
        tenant_id: Tenant identifier
        update: Update data

    Returns:
        Updated tenant configuration

    Raises:
        HTTPException: If not admin or tenant not found
    """
    _require_admin(request)

    manager = get_tenant_manager()
    config = manager.get_tenant(tenant_id)

    if not config:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Update fields
    if update.name:
        config.name = update.name
    if update.max_requests_per_hour:
        config.max_requests_per_hour = update.max_requests_per_hour
    if update.max_concurrent_workflows:
        config.max_concurrent_workflows = update.max_concurrent_workflows
    if update.max_jobs_per_day:
        config.max_jobs_per_day = update.max_jobs_per_day
    if update.storage_quota_gb:
        config.storage_quota_gb = update.storage_quota_gb

    return {
        "tenant_id": config.tenant_id,
        "name": config.name,
        "max_requests_per_hour": config.max_requests_per_hour,
        "max_concurrent_workflows": config.max_concurrent_workflows,
        "max_jobs_per_day": config.max_jobs_per_day,
        "storage_quota_gb": config.storage_quota_gb,
    }


@router.delete("/{tenant_id}")
async def delete_tenant(request: Request, tenant_id: str) -> dict:
    """Delete tenant and all associated data.

    Requires admin access.

    Args:
        request: Request object
        tenant_id: Tenant identifier

    Returns:
        Confirmation message

    Raises:
        HTTPException: If not admin or tenant not found
    """
    _require_admin(request)

    manager = get_tenant_manager()
    deleted = manager.delete_tenant(tenant_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {"message": f"Tenant {tenant_id} deleted"}


@router.post("/{tenant_id}/api-keys", response_model=APIKeyResponse)
async def generate_api_key(request: Request, tenant_id: str) -> dict:
    """Generate new API key for tenant.

    Users can generate keys for themselves, admins can generate for any tenant.

    Args:
        request: Request object
        tenant_id: Tenant identifier

    Returns:
        Generated API key

    Raises:
        HTTPException: If access denied or tenant not found
    """
    manager = get_tenant_manager()

    # Check access
    current_tenant = TenantContext.get_tenant_id()
    if current_tenant != tenant_id and not _is_admin(request):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        api_key = manager.generate_api_key(tenant_id)
        return {"api_key": api_key, "tenant_id": tenant_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{tenant_id}/usage", response_model=UsageResponse)
async def get_usage(request: Request, tenant_id: str) -> dict:
    """Get tenant usage statistics.

    Users can view their own usage, admins can view any tenant's usage.

    Args:
        request: Request object
        tenant_id: Tenant identifier

    Returns:
        Usage statistics

    Raises:
        HTTPException: If access denied or tenant not found
    """
    manager = get_tenant_manager()

    # Check access
    current_tenant = TenantContext.get_tenant_id()
    if current_tenant != tenant_id and not _is_admin(request):
        raise HTTPException(status_code=403, detail="Access denied")

    # Verify tenant exists
    config = manager.get_tenant(tenant_id)
    if not config:
        raise HTTPException(status_code=404, detail="Tenant not found")

    usage = manager.get_usage(tenant_id)

    return {
        "tenant_id": tenant_id,
        "requests_this_hour": usage.get("requests_this_hour", 0),
        "concurrent_workflows": usage.get("concurrent_workflows", 0),
        "jobs_today": usage.get("jobs_today", 0),
        "storage_used_gb": usage.get("storage_used_gb", 0.0),
    }


@router.post("/self/usage-reset")
async def reset_personal_usage(request: Request) -> dict:
    """Reset personal tenant usage (for testing).

    Only available for non-production environments.

    Args:
        request: Request object

    Returns:
        Confirmation message

    Raises:
        HTTPException: If production environment
    """
    import os

    if os.getenv("ENVIRONMENT") == "production":
        raise HTTPException(
            status_code=403, detail="Usage reset not allowed in production"
        )

    tenant_id = TenantContext.get_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    manager = get_tenant_manager()
    manager.reset_hourly_limits()
    manager.reset_daily_limits()

    return {"message": "Usage reset"}
