from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.auth import ApplicationUserResponse, UserRole


STAFF_ROLES = {
    UserRole.INSTRUCTOR,
    UserRole.DEPARTMENT_STAFF,
    UserRole.HOD,
}


def _authenticated_identity(
    supabase_user: dict[str, Any],
) -> tuple[str, str]:
    try:
        user_id = str(UUID(str(supabase_user["id"])))
        email = supabase_user["email"]

        if not isinstance(email, str) or not email.strip():
            raise ValueError("Missing email")

        return user_id, email.strip().lower()

    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user identity is incomplete.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def _load_application_user(
    db: Session,
    user_id: str,
    email: str,
) -> dict[str, Any]:
    row = db.execute(
        text(
            """
            SELECT
                u.user_id::text AS user_id,
                u.full_name,
                u.email,
                u.role,
                u.is_active,
                u.is_available,
                u.auto_reply_message,
                u.department_id::text AS department_id,
                d.department_name,
                d.is_active AS department_active,
                u.desk_id::text AS desk_id,
                ad.desk_code,
                ad.desk_name,
                ad.is_active AS desk_active,
                ad.department_id::text AS desk_department_id,
                au.email AS approved_email,
                au.is_active AS approval_active
            FROM public.users u
            LEFT JOIN public.approved_users au
                ON au.approved_user_id = u.approved_user_id
            LEFT JOIN public.departments d
                ON d.department_id = u.department_id
            LEFT JOIN public.accounts_desks ad
                ON ad.desk_id = u.desk_id
            WHERE u.user_id = CAST(:user_id AS UUID)
            """
        ),
        {"user_id": user_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Application profile not found. Please sign in again.",
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This account has been disabled.",
        )

    if (
        not row["approval_active"]
        or row["email"] != email
        or row["approved_email"] != email
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This account is not currently approved.",
        )

    if row["role"] in STAFF_ROLES:
        if not row["department_id"] or not row["department_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="An active department assignment is required.",
            )

    if row["desk_id"] is not None:
        if (
            not row["desk_active"]
            or not row["department_active"]
            or row["desk_department_id"] != row["department_id"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The assigned desk or department mapping is invalid.",
            )

    return ApplicationUserResponse.model_validate(row).model_dump(mode="json")


def get_application_user(
    supabase_user: dict[str, Any],
) -> dict[str, Any]:
    user_id, email = _authenticated_identity(supabase_user)

    try:
        with SessionLocal() as db:
            return _load_application_user(db, user_id, email)

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Application profile is temporarily unavailable.",
        ) from exc


def provision_application_user(
    supabase_user: dict[str, Any],
) -> dict[str, Any]:
    user_id, email = _authenticated_identity(supabase_user)

    metadata = supabase_user.get("user_metadata")

    if not isinstance(metadata, dict):
        metadata = {}

    try:
        with SessionLocal.begin() as db:
            approved_user = db.execute(
                text(
                    """
                    SELECT
                        approved_user_id,
                        full_name,
                        role,
                        department_id,
                        desk_id
                    FROM public.approved_users
                    WHERE email = :email
                      AND is_active = TRUE
                    FOR SHARE
                    """
                ),
                {"email": email},
            ).mappings().first()

            if approved_user is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. This account is not approved.",
                )

            name_candidates = (
                approved_user["full_name"],
                metadata.get("full_name"),
                metadata.get("name"),
                email.split("@")[0],
                "University User",
            )

            full_name = next(
                name.strip()[:150]
                for name in name_candidates
                if isinstance(name, str) and name.strip()
            )

            created = db.execute(
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
                        CAST(:approved_user_id AS UUID),
                        CAST(:department_id AS UUID),
                        CAST(:desk_id AS UUID),
                        :full_name,
                        :email,
                        :role,
                        TRUE,
                        TRUE
                    )
                    ON CONFLICT (user_id) DO NOTHING
                    RETURNING user_id
                    """
                ),
                {
                    "user_id": user_id,
                    "approved_user_id": approved_user["approved_user_id"],
                    "department_id": approved_user["department_id"],
                    "desk_id": approved_user["desk_id"],
                    "full_name": full_name,
                    "email": email,
                    "role": approved_user["role"],
                },
            ).mappings().first()

            # Existing profile settings remain under administrator control.
            profile = _load_application_user(db, user_id, email)

            if created is not None:
                db.execute(
                    text(
                        """
                        INSERT INTO public.audit_logs (
                            actor_user_id,
                            action,
                            entity_type,
                            entity_id,
                            new_values
                        )
                        VALUES (
                            CAST(:user_id AS UUID),
                            'USER_PROVISIONED',
                            'USER',
                            CAST(:user_id AS UUID),
                            jsonb_build_object(
                                'role', CAST(:role AS TEXT),
                                'department_id', CAST(:department_id AS UUID),
                                'desk_id', CAST(:desk_id AS UUID)
                            )
                        )
                        """
                    ),
                    {
                        "user_id": user_id,
                        "role": profile["role"],
                        "department_id": profile["department_id"],
                        "desk_id": profile["desk_id"],
                    },
                )

        return profile

    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The user profile could not be linked. Contact an administrator.",
        ) from exc

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User provisioning is temporarily unavailable.",
        ) from exc