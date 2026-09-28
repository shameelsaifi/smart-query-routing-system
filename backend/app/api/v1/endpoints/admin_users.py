from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    Query,
    Response,
    status,
)

from app.core.rbac import require_role

from app.schemas.admin_user import (
    AdminManagedUser,
    AdminUserCreate,
    AdminUserListResponse,
    AdminUserOptionsResponse,
    AdminUserUpdate,
)

from app.services.admin_user_service import (
    create_admin_user,
    get_admin_user_options,
    get_admin_users,
    update_admin_user,
)


router = APIRouter()


admin_dependency = require_role(
    "ADMIN"
)


@router.get(
    "/users",
    response_model=AdminUserListResponse,
    summary="List managed application users",
)
def list_admin_users(
    response: Response,

    search: str | None = Query(
        default=None,
        max_length=255,
    ),

    role: str | None = Query(
        default=None,
        max_length=30,
    ),

    is_active: bool | None = Query(
        default=None,
    ),

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminUserListResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return AdminUserListResponse.model_validate(
        get_admin_users(
            current_user,
            search=search,
            role=role,
            is_active=is_active,
        )
    )


@router.get(
    "/users/options",
    response_model=AdminUserOptionsResponse,
    summary=(
        "Get roles, departments and desks "
        "for user management"
    ),
)
def admin_user_options(
    response: Response,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminUserOptionsResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return AdminUserOptionsResponse.model_validate(
        get_admin_user_options(
            current_user
        )
    )


@router.post(
    "/users",
    response_model=AdminManagedUser,
    status_code=status.HTTP_201_CREATED,
    summary="Authorize a new application user",
)
def add_admin_user(
    data: AdminUserCreate,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminManagedUser:
    return AdminManagedUser.model_validate(
        create_admin_user(
            current_user,
            data,
        )
    )


@router.patch(
    "/users/{user_id}",
    response_model=AdminManagedUser,
    summary=(
        "Update role, department, desk "
        "or account status"
    ),
)
def edit_admin_user(
    user_id: str,
    data: AdminUserUpdate,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AdminManagedUser:
    return AdminManagedUser.model_validate(
        update_admin_user(
            current_user,
            user_id,
            data,
        )
    )