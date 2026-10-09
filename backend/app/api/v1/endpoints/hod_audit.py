from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    Query,
    Response,
)

from app.core.rbac import require_role
from app.schemas.hod_audit import (
    HodAuditLogListResponse,
)
from app.services.hod_audit_service import (
    get_hod_audit_logs,
)


router = APIRouter()


hod_dependency = require_role(
    "HOD"
)


@router.get(
    "/audit-logs",
    response_model=HodAuditLogListResponse,
    summary=(
        "List department-scoped "
        "HOD audit history"
    ),
)
def hod_audit_logs(
    response: Response,

    search: str | None = Query(
        default=None,
        max_length=255,
    ),

    action: str | None = Query(
        default=None,
        max_length=100,
    ),

    entity_type: str | None = Query(
        default=None,
        max_length=50,
    ),

    outcome: str | None = Query(
        default=None,
        max_length=20,
    ),

    page: int = Query(
        default=1,
        ge=1,
    ),

    page_size: int = Query(
        default=10,
        ge=1,
        le=100,
    ),

    current_user: dict[str, Any] = Depends(
        hod_dependency
    ),
) -> HodAuditLogListResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return HodAuditLogListResponse.model_validate(
        get_hod_audit_logs(
            current_user,
            search=search,
            action=action,
            entity_type=entity_type,
            outcome=outcome,
            page=page,
            page_size=page_size,
        )
    )