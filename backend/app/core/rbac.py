from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException, status

from app.core.auth import get_authenticated_supabase_user
from app.schemas.auth import UserRole
from app.services.auth_service import get_application_user


def get_current_application_user(
    supabase_user: dict[str, Any] = Depends(get_authenticated_supabase_user),
) -> dict[str, Any]:
    return get_application_user(supabase_user)


def require_role(*allowed_roles: str) -> Callable[..., Any]:
    allowed = {UserRole(role) for role in allowed_roles}

    if not allowed:
        raise ValueError("At least one allowed role is required.")

    def role_checker(
        current_user: dict[str, Any] = Depends(get_current_application_user),
    ) -> dict[str, Any]:
        if current_user["role"] not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied for this role.",
            )

        return current_user

    return role_checker


def require_desk(required_desk_code: str) -> Callable[..., Any]:
    def desk_checker(
        current_user: dict[str, Any] = Depends(
            require_role(UserRole.DEPARTMENT_STAFF)
        ),
    ) -> dict[str, Any]:
        if current_user["desk_code"] != required_desk_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied for this Accounts desk.",
            )

        return current_user

    return desk_checker