from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    Query,
    Response,
    status,
)

from app.core.rbac import require_role

from app.schemas.admin_management import (
    AdminAuditLogListResponse,
    AdminDepartmentCreate,
    AdminDepartmentItem,
    AdminDepartmentListResponse,
    AdminDepartmentUpdate,
    AdminQueryListResponse,
    AdminRoutingOptionsResponse,
    AdminRoutingRuleCreate,
    AdminRoutingRuleItem,
    AdminRoutingRuleListResponse,
    AdminRoutingRuleUpdate,
)

from app.services.admin_management_service import (
    create_admin_department,
    create_admin_routing_rule,
    get_admin_audit_logs,
    get_admin_departments,
    get_admin_queries,
    get_admin_routing_options,
    get_admin_routing_rules,
    update_admin_department,
    update_admin_routing_rule,
)


router = APIRouter()


admin_dependency = require_role(
    "ADMIN"
)


# ============================================================
# QUERIES
# ============================================================


@router.get(
    "/queries",
    response_model=AdminQueryListResponse,
    summary=(
        "List system queries for "
        "administrator monitoring"
    ),
)
def admin_queries(
    response: Response,

    search: str | None = Query(
        default=None,
        max_length=255,
    ),

    query_status: str | None = Query(
        default=None,
        alias="status",
        max_length=30,
    ),

    source: str | None = Query(
        default=None,
        max_length=20,
    ),

    priority: str | None = Query(
        default=None,
        max_length=20,
    ),

    department_id: str | None = Query(
        default=None,
        max_length=50,
    ),

    page: int = Query(
        default=1,
        ge=1,
    ),

    page_size: int = Query(
        default=25,
        ge=1,
        le=100,
    ),

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminQueryListResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return AdminQueryListResponse.model_validate(
        get_admin_queries(
            current_user,
            search=search,
            query_status=query_status,
            source=source,
            priority=priority,
            department_id=department_id,
            page=page,
            page_size=page_size,
        )
    )


# ============================================================
# DEPARTMENTS
# ============================================================


@router.get(
    "/departments",
    response_model=AdminDepartmentListResponse,
    summary="List university departments",
)
def admin_departments(
    response: Response,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminDepartmentListResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return AdminDepartmentListResponse.model_validate(
        get_admin_departments(
            current_user
        )
    )


@router.post(
    "/departments",
    response_model=AdminDepartmentItem,
    status_code=status.HTTP_201_CREATED,
    summary="Create a university department",
)
def add_admin_department(
    data: AdminDepartmentCreate,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminDepartmentItem:
    return AdminDepartmentItem.model_validate(
        create_admin_department(
            current_user,
            data,
        )
    )


@router.patch(
    "/departments/{department_id}",
    response_model=AdminDepartmentItem,
    summary="Update a university department",
)
def edit_admin_department(
    department_id: str,
    data: AdminDepartmentUpdate,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminDepartmentItem:
    return AdminDepartmentItem.model_validate(
        update_admin_department(
            current_user,
            department_id,
            data,
        )
    )


# ============================================================
# ROUTING RULES
# ============================================================


@router.get(
    "/routing-rules/options",
    response_model=AdminRoutingOptionsResponse,
    summary=(
        "Get routing categories, "
        "departments and desks"
    ),
)
def admin_routing_options(
    response: Response,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminRoutingOptionsResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return AdminRoutingOptionsResponse.model_validate(
        get_admin_routing_options(
            current_user
        )
    )


@router.get(
    "/routing-rules",
    response_model=AdminRoutingRuleListResponse,
    summary="List administrator routing rules",
)
def admin_routing_rules(
    response: Response,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminRoutingRuleListResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return AdminRoutingRuleListResponse.model_validate(
        get_admin_routing_rules(
            current_user
        )
    )


@router.post(
    "/routing-rules",
    response_model=AdminRoutingRuleItem,
    status_code=status.HTTP_201_CREATED,
    summary="Create a routing rule",
)
def add_admin_routing_rule(
    data: AdminRoutingRuleCreate,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminRoutingRuleItem:
    return AdminRoutingRuleItem.model_validate(
        create_admin_routing_rule(
            current_user,
            data,
        )
    )


@router.patch(
    "/routing-rules/{rule_id}",
    response_model=AdminRoutingRuleItem,
    summary="Update a routing rule",
)
def edit_admin_routing_rule(
    rule_id: str,
    data: AdminRoutingRuleUpdate,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminRoutingRuleItem:
    return AdminRoutingRuleItem.model_validate(
        update_admin_routing_rule(
            current_user,
            rule_id,
            data,
        )
    )


# ============================================================
# AUDIT LOGS
# ============================================================


@router.get(
    "/audit-logs",
    response_model=AdminAuditLogListResponse,
    summary="List administrative audit logs",
)
def admin_audit_logs(
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
        default=25,
        ge=1,
        le=100,
    ),

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminAuditLogListResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return AdminAuditLogListResponse.model_validate(
        get_admin_audit_logs(
            current_user,
            search=search,
            action=action,
            entity_type=entity_type,
            outcome=outcome,
            page=page,
            page_size=page_size,
        )
    )