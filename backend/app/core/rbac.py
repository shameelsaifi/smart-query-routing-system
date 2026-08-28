from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.auth import get_authenticated_supabase_user
from app.core.database import SessionLocal


async def get_current_application_user(
    supabase_user: dict[str, Any] = Depends(
        get_authenticated_supabase_user
    ),
) -> dict[str, Any]:
    user_id = supabase_user.get("id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user identity is incomplete.",
        )

    db = SessionLocal()

    try:
        application_user = db.execute(
            text(
                """
                SELECT
                    u.user_id::text AS user_id,
                    u.full_name,
                    u.email,
                    u.role,
                    u.is_active,
                    u.is_available,
                    u.department_id::text AS department_id,
                    d.department_name,
                    ad.desk_code,
                    ad.desk_name
                FROM public.users u
                LEFT JOIN public.departments d
                    ON d.department_id = u.department_id
                LEFT JOIN public.accounts_desks ad
                    ON ad.desk_id = u.desk_id
                WHERE u.user_id = CAST(:user_id AS UUID)
                  AND u.is_active = TRUE
                LIMIT 1
                """
            ),
            {"user_id": user_id},
        ).mappings().first()

        if application_user is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Application profile not found.",
            )

        return dict(application_user)

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authorization check failed.",
        ) from exc

    finally:
        db.close()


def require_role(
    *allowed_roles: str,
) -> Callable[..., Any]:
    async def role_checker(
        current_user: dict[str, Any] = Depends(
            get_current_application_user
        ),
    ) -> dict[str, Any]:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied for this role.",
            )

        return current_user

    return role_checker


def require_desk(
    required_desk_code: str,
) -> Callable[..., Any]:
    async def desk_checker(
        current_user: dict[str, Any] = Depends(
            get_current_application_user
        ),
    ) -> dict[str, Any]:
        if current_user["role"] != "DEPARTMENT_STAFF":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accounts officer access required.",
            )

        if current_user["desk_code"] != required_desk_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied for this Accounts desk.",
            )

        return current_user

    return desk_checker