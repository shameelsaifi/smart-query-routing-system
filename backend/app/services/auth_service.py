from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


def provision_application_user(
    supabase_user: dict[str, Any],
) -> dict[str, Any]:
    auth_user_id = supabase_user.get("id")
    email = str(supabase_user.get("email", "")).strip().lower()

    user_metadata = supabase_user.get("user_metadata") or {}
    google_name = (
        user_metadata.get("full_name")
        or user_metadata.get("name")
        or email.split("@")[0]
    )

    if not auth_user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user identity is incomplete.",
        )

    db = SessionLocal()

    try:
        approved_user = db.execute(
            text(
                """
                SELECT
                    approved_user_id,
                    email,
                    full_name,
                    role,
                    department_id,
                    desk_id
                FROM public.approved_users
                WHERE email = :email
                  AND is_active = TRUE
                LIMIT 1
                """
            ),
            {"email": email},
        ).mappings().first()

        if approved_user is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. This account is not approved.",
            )

        full_name = approved_user["full_name"] or google_name

        db.execute(
            text(
                """
                INSERT INTO public.users (
                    user_id,
                    approved_user_id,
                    department_id,
                    desk_id,
                    full_name,
                    email,
                    role,
                    is_active,
                    is_available
                )
                VALUES (
                    CAST(:user_id AS UUID),
                    :approved_user_id,
                    :department_id,
                    :desk_id,
                    :full_name,
                    :email,
                    :role,
                    TRUE,
                    TRUE
                )
                ON CONFLICT (user_id)
                DO UPDATE SET
                    approved_user_id = EXCLUDED.approved_user_id,
                    department_id = EXCLUDED.department_id,
                    desk_id = EXCLUDED.desk_id,
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    role = EXCLUDED.role,
                    is_active = TRUE
                """
            ),
            {
                "user_id": auth_user_id,
                "approved_user_id": approved_user["approved_user_id"],
                "department_id": approved_user["department_id"],
                "desk_id": approved_user["desk_id"],
                "full_name": full_name,
                "email": email,
                "role": approved_user["role"],
            },
        )

        db.commit()

        application_user = db.execute(
            text(
                """
                SELECT
                    u.user_id::text AS user_id,
                    u.full_name,
                    u.email,
                    u.role,
                    u.is_active,
                    d.department_name,
                    ad.desk_code,
                    ad.desk_name
                FROM public.users u
                LEFT JOIN public.departments d
                    ON d.department_id = u.department_id
                LEFT JOIN public.accounts_desks ad
                    ON ad.desk_id = u.desk_id
                WHERE u.user_id = CAST(:user_id AS UUID)
                """
            ),
            {"user_id": auth_user_id},
        ).mappings().first()

        if application_user is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User profile could not be loaded.",
            )

        return dict(application_user)

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User provisioning failed.",
        ) from exc

    finally:
        db.close()