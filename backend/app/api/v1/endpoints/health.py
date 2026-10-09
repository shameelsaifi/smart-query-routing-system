from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    Response,
)

from app.core.config import settings
from app.core.rbac import require_role
from app.services.admin_integration_service import (
    get_admin_integration_status,
)


router = APIRouter()


admin_dependency = require_role(
    "ADMIN",
)


@router.get(
    "",
    summary="Check backend health",
)
async def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


@router.get(
    "/integrations",
    summary=(
        "Get administrator integration "
        "configuration and operational status"
    ),
)
def admin_integration_health(
    response: Response,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> dict[str, Any]:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return get_admin_integration_status(
        current_user
    )