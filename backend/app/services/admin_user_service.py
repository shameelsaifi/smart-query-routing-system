import json
from typing import Any
from uuid import UUID

from fastapi import (
    HTTPException,
    status,
)
from sqlalchemy import text
from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError,
)

from app.core.database import SessionLocal
from app.schemas.admin_user import (
    AdminUserCreate,
    AdminUserUpdate,
)


ALLOWED_ROLES = {
    "STUDENT",
    "INSTRUCTOR",
    "DEPARTMENT_STAFF",
    "HOD",
    "ADMIN",
}


DEPARTMENT_ROLES = {
    "INSTRUCTOR",
    "DEPARTMENT_STAFF",
    "HOD",
}


def _actor_id(
    current_user: dict[str, Any],
) -> str:
    raw_value = (
        current_user.get("user_id")
        or current_user.get("id")
        or current_user.get("sub")
    )

    try:
        return str(
            UUID(
                str(raw_value)
            )
        )
    except (
        TypeError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Authenticated administrator "
                "identity is unavailable."
            ),
        ) from exc


def _clean_uuid(
    value,
) -> str | None:
    if value is None:
        return None

    try:
        return str(
            UUID(
                str(value)
            )
        )
    except (
        TypeError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail="Invalid identifier.",
        ) from exc


def _validate_access_scope(
    db,
    *,
    role: str,
    department_id: str | None,
    desk_id: str | None,
) -> tuple[
    str | None,
    str | None,
]:
    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail="Unsupported user role.",
        )

    if role in {
        "STUDENT",
        "ADMIN",
    }:
        if (
            department_id is not None
            or desk_id is not None
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_422_UNPROCESSABLE_ENTITY
                ),
                detail=(
                    f"{role} accounts cannot "
                    "be assigned to a department "
                    "or accounts desk."
                ),
            )

        return None, None

    if (
        role in DEPARTMENT_ROLES
        and department_id is None
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "A department is required for "
                f"{role} accounts."
            ),
        )

    department = db.execute(
        text(
            """
            SELECT
                department_id::text
                    AS department_id,
                department_name,
                is_active
            FROM public.departments
            WHERE department_id =
                  CAST(:department_id AS UUID)
            LIMIT 1
            """
        ),
        {
            "department_id":
                department_id,
        },
    ).mappings().first()

    if (
        department is None
        or not department["is_active"]
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "The selected department does "
                "not exist or is inactive."
            ),
        )

    if desk_id is None:
        return (
            department_id,
            None,
        )

    if role != "DEPARTMENT_STAFF":
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Accounts desk assignment is "
                "only valid for Department Staff."
            ),
        )

    desk = db.execute(
        text(
            """
            SELECT
                desk_id::text AS desk_id,
                department_id::text
                    AS department_id,
                is_active
            FROM public.accounts_desks
            WHERE desk_id =
                  CAST(:desk_id AS UUID)
            LIMIT 1
            """
        ),
        {
            "desk_id":
                desk_id,
        },
    ).mappings().first()

    if (
        desk is None
        or not desk["is_active"]
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "The selected accounts desk "
                "does not exist or is inactive."
            ),
        )

    if (
        desk["department_id"]
        != department_id
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "The selected desk does not "
                "belong to the selected department."
            ),
        )

    return (
        department_id,
        desk_id,
    )


def _serialize_user(
    row,
) -> dict[str, Any]:
    return {
        "approved_user_id":
            row["approved_user_id"],

        "user_id":
            row["user_id"],

        "email":
            row["email"],

        "full_name":
            (
                row["full_name"]
                or row["email"].split("@")[0]
            ),

        "role":
            row["role"],

        "is_active":
            bool(
                row["is_active"]
            ),

        "is_provisioned":
            row["user_id"] is not None,

        "is_available":
            row["is_available"],

        "department_id":
            row["department_id"],

        "department_name":
            row["department_name"],

        "desk_id":
            row["desk_id"],

        "desk_code":
            row["desk_code"],

        "desk_name":
            row["desk_name"],

        "created_at":
            row["created_at"],
    }


def _load_managed_user(
    db,
    record_id: str,
    *,
    for_update: bool = False,
):
    locking = (
    " FOR UPDATE OF au"
    if for_update
    else ""
)

    return db.execute(
        text(
            """
            SELECT
                au.approved_user_id::text
                    AS approved_user_id,

                u.user_id::text
                    AS user_id,

                au.email,

                COALESCE(
                    u.full_name,
                    au.full_name
                ) AS full_name,

                au.role,

                au.is_active,

                u.is_available,

                au.department_id::text
                    AS department_id,

                d.department_name,

                au.desk_id::text
                    AS desk_id,

                ad.desk_code,

                ad.desk_name,

                au.created_at

            FROM public.approved_users au

            LEFT JOIN public.users u
              ON u.approved_user_id =
                 au.approved_user_id

            LEFT JOIN public.departments d
              ON d.department_id =
                 au.department_id

            LEFT JOIN public.accounts_desks ad
              ON ad.desk_id =
                 au.desk_id

            WHERE
                au.approved_user_id =
                    CAST(:record_id AS UUID)

                OR u.user_id =
                    CAST(:record_id AS UUID)

            LIMIT 1
            """
            + locking
        ),
        {
            "record_id":
                record_id,
        },
    ).mappings().first()


def _audit(
    db,
    *,
    actor_id: str,
    action: str,
    approved_user_id: str,
    old_values: dict[str, Any] | None,
    new_values: dict[str, Any],
) -> None:
    db.execute(
        text(
            """
            INSERT INTO public.audit_logs (
                actor_user_id,
                action,
                entity_type,
                entity_id,
                old_values,
                new_values,
                details
            )
            VALUES (
                CAST(:actor_id AS UUID),
                :action,
                'APPROVED_USER',
                CAST(:entity_id AS UUID),
                CAST(:old_values AS JSONB),
                CAST(:new_values AS JSONB),
                CAST(:details AS JSONB)
            )
            """
        ),
        {
            "actor_id":
                actor_id,

            "action":
                action,

            "entity_id":
                approved_user_id,

            "old_values":
                (
                    json.dumps(
                        old_values,
                        default=str,
                    )
                    if old_values
                    is not None
                    else None
                ),

            "new_values":
                json.dumps(
                    new_values,
                    default=str,
                ),

            "details":
                json.dumps(
                    {
                        "source":
                            "ADMIN_USER_MANAGEMENT",
                    }
                ),
        },
    )


def get_admin_users(
    current_user: dict[str, Any],
    *,
    search: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
) -> dict[str, Any]:
    _actor_id(
        current_user
    )

    normalized_search = (
        search.strip().lower()
        if search
        and search.strip()
        else None
    )

    normalized_role = (
        role.strip().upper()
        if role
        and role.strip()
        else None
    )

    if (
        normalized_role is not None
        and normalized_role
        not in ALLOWED_ROLES
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail="Unsupported role filter.",
        )

    try:
        with SessionLocal() as db:
            rows = db.execute(
                text(
                    """
                    SELECT
                        au.approved_user_id::text
                            AS approved_user_id,

                        u.user_id::text
                            AS user_id,

                        au.email,

                        COALESCE(
                            u.full_name,
                            au.full_name
                        ) AS full_name,

                        au.role,

                        au.is_active,

                        u.is_available,

                        au.department_id::text
                            AS department_id,

                        d.department_name,

                        au.desk_id::text
                            AS desk_id,

                        ad.desk_code,

                        ad.desk_name,

                        au.created_at

                    FROM public.approved_users au

                    LEFT JOIN public.users u
                      ON u.approved_user_id =
                         au.approved_user_id

                    LEFT JOIN public.departments d
                      ON d.department_id =
                         au.department_id

                    LEFT JOIN public.accounts_desks ad
                      ON ad.desk_id =
                         au.desk_id

                    WHERE (
                        CAST(:search AS TEXT)
                            IS NULL

                        OR lower(au.email)
                           LIKE
                           '%' || :search || '%'

                        OR lower(
                            COALESCE(
                                u.full_name,
                                au.full_name,
                                ''
                            )
                        )
                           LIKE
                           '%' || :search || '%'
                    )

                    AND (
                        CAST(:role AS TEXT)
                            IS NULL
                        OR au.role = :role
                    )

                    AND (
                        CAST(:active AS BOOLEAN)
                            IS NULL
                        OR au.is_active = :active
                    )

                    ORDER BY
                        au.is_active DESC,
                        COALESCE(
                            u.full_name,
                            au.full_name,
                            au.email
                        ) ASC,
                        au.created_at ASC
                    """
                ),
                {
                    "search":
                        normalized_search,

                    "role":
                        normalized_role,

                    "active":
                        is_active,
                },
            ).mappings().all()

            return {
                "items": [
                    _serialize_user(
                        row
                    )
                    for row in rows
                ],

                "total":
                    len(rows),
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "User management data is "
                "temporarily unavailable."
            ),
        ) from exc


def get_admin_user_options(
    current_user: dict[str, Any],
) -> dict[str, Any]:
    _actor_id(
        current_user
    )

    try:
        with SessionLocal() as db:
            departments = db.execute(
                text(
                    """
                    SELECT
                        department_id::text
                            AS department_id,
                        department_name
                    FROM public.departments
                    WHERE is_active = TRUE
                    ORDER BY department_name
                    """
                )
            ).mappings().all()

            desks = db.execute(
                text(
                    """
                    SELECT
                        desk_id::text
                            AS desk_id,
                        desk_code,
                        desk_name,
                        department_id::text
                            AS department_id
                    FROM public.accounts_desks
                    WHERE is_active = TRUE
                    ORDER BY desk_name
                    """
                )
            ).mappings().all()

            return {
                "roles": [
                    "STUDENT",
                    "INSTRUCTOR",
                    "DEPARTMENT_STAFF",
                    "HOD",
                    "ADMIN",
                ],

                "departments": [
                    dict(row)
                    for row in departments
                ],

                "desks": [
                    dict(row)
                    for row in desks
                ],
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "User-management options are "
                "temporarily unavailable."
            ),
        ) from exc


def create_admin_user(
    current_user: dict[str, Any],
    data: AdminUserCreate,
) -> dict[str, Any]:
    actor_id = _actor_id(
        current_user
    )

    email = (
        data.email
        .strip()
        .lower()
    )

    full_name = (
        data.full_name
        .strip()
    )

    role = data.role

    department_id = _clean_uuid(
        data.department_id
    )

    desk_id = _clean_uuid(
        data.desk_id
    )

    try:
        with SessionLocal.begin() as db:
            (
                department_id,
                desk_id,
            ) = _validate_access_scope(
                db,
                role=role,
                department_id=department_id,
                desk_id=desk_id,
            )

            existing = db.execute(
                text(
                    """
                    SELECT
                        approved_user_id::text
                            AS approved_user_id
                    FROM public.approved_users
                    WHERE email = :email
                    LIMIT 1
                    """
                ),
                {
                    "email":
                        email,
                },
            ).mappings().first()

            if existing is not None:
                raise HTTPException(
                    status_code=(
                        status.HTTP_409_CONFLICT
                    ),
                    detail=(
                        "This email is already "
                        "authorized."
                    ),
                )

            existing_profile = db.execute(
                text(
                    """
                    SELECT
                        user_id::text AS user_id
                    FROM public.users
                    WHERE email = :email
                    LIMIT 1
                    """
                ),
                {
                    "email":
                        email,
                },
            ).mappings().first()

            if existing_profile is not None:
                raise HTTPException(
                    status_code=(
                        status.HTTP_409_CONFLICT
                    ),
                    detail=(
                        "An application profile "
                        "already exists for this email."
                    ),
                )

            created = db.execute(
                text(
                    """
                    INSERT INTO public.approved_users (
                        email,
                        full_name,
                        role,
                        department_id,
                        desk_id,
                        is_active
                    )
                    VALUES (
                        :email,
                        :full_name,
                        :role,
                        CAST(:department_id AS UUID),
                        CAST(:desk_id AS UUID),
                        TRUE
                    )
                    RETURNING
                        approved_user_id::text
                            AS approved_user_id
                    """
                ),
                {
                    "email":
                        email,

                    "full_name":
                        full_name,

                    "role":
                        role,

                    "department_id":
                        department_id,

                    "desk_id":
                        desk_id,
                },
            ).mappings().one()

            created_user = _load_managed_user(
                db,
                created[
                    "approved_user_id"
                ],
            )

            serialized = _serialize_user(
                created_user
            )

            _audit(
                db,
                actor_id=actor_id,
                action="ADMIN_USER_CREATED",
                approved_user_id=(
                    created[
                        "approved_user_id"
                    ]
                ),
                old_values=None,
                new_values=serialized,
            )

            return serialized

    except HTTPException:
        raise

    except IntegrityError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "The requested user configuration "
                "conflicts with existing data."
            ),
        ) from exc

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "The user could not be created "
                "at this time."
            ),
        ) from exc


def update_admin_user(
    current_user: dict[str, Any],
    record_id,
    data: AdminUserUpdate,
) -> dict[str, Any]:
    actor_id = _actor_id(
        current_user
    )

    target_id = _clean_uuid(
        record_id
    )

    if target_id is None:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail="A valid user ID is required.",
        )

    try:
        with SessionLocal.begin() as db:
            existing = _load_managed_user(
                db,
                target_id,
                for_update=True,
            )

            if existing is None:
                raise HTTPException(
                    status_code=(
                        status.HTTP_404_NOT_FOUND
                    ),
                    detail="User not found.",
                )

            old_values = _serialize_user(
                existing
            )

            fields = (
                data.model_fields_set
            )

            full_name = (
                data.full_name
                if "full_name" in fields
                else existing["full_name"]
            )

            role = (
                data.role
                if "role" in fields
                else existing["role"]
            )

            department_id = (
                _clean_uuid(
                    data.department_id
                )
                if "department_id" in fields
                else existing[
                    "department_id"
                ]
            )

            desk_id = (
                _clean_uuid(
                    data.desk_id
                )
                if "desk_id" in fields
                else existing[
                    "desk_id"
                ]
            )

            is_active = (
                data.is_active
                if "is_active" in fields
                else bool(
                    existing[
                        "is_active"
                    ]
                )
            )

            if (
                existing["user_id"]
                == actor_id
                and (
                    role != "ADMIN"
                    or not is_active
                )
            ):
                raise HTTPException(
                    status_code=(
                        status.HTTP_409_CONFLICT
                    ),
                    detail=(
                        "You cannot deactivate or "
                        "remove your own Admin role."
                    ),
                )

            (
                department_id,
                desk_id,
            ) = _validate_access_scope(
                db,
                role=role,
                department_id=department_id,
                desk_id=desk_id,
            )

            db.execute(
                text(
                    """
                    UPDATE public.approved_users
                    SET
                        full_name =
                            :full_name,
                        role =
                            :role,
                        department_id =
                            CAST(
                                :department_id
                                AS UUID
                            ),
                        desk_id =
                            CAST(
                                :desk_id
                                AS UUID
                            ),
                        is_active =
                            :is_active
                    WHERE approved_user_id =
                          CAST(
                              :approved_user_id
                              AS UUID
                          )
                    """
                ),
                {
                    "full_name":
                        full_name,

                    "role":
                        role,

                    "department_id":
                        department_id,

                    "desk_id":
                        desk_id,

                    "is_active":
                        is_active,

                    "approved_user_id":
                        existing[
                            "approved_user_id"
                        ],
                },
            )

            if existing["user_id"]:
                db.execute(
                    text(
                        """
                        UPDATE public.users
                        SET
                            full_name =
                                :full_name,
                            role =
                                :role,
                            department_id =
                                CAST(
                                    :department_id
                                    AS UUID
                                ),
                            desk_id =
                                CAST(
                                    :desk_id
                                    AS UUID
                                ),
                            is_active =
                                :is_active
                        WHERE user_id =
                              CAST(
                                  :user_id
                                  AS UUID
                              )
                        """
                    ),
                    {
                        "full_name":
                            full_name,

                        "role":
                            role,

                        "department_id":
                            department_id,

                        "desk_id":
                            desk_id,

                        "is_active":
                            is_active,

                        "user_id":
                            existing[
                                "user_id"
                            ],
                    },
                )

            updated = _load_managed_user(
                db,
                existing[
                    "approved_user_id"
                ],
            )

            serialized = _serialize_user(
                updated
            )

            _audit(
                db,
                actor_id=actor_id,
                action="ADMIN_USER_UPDATED",
                approved_user_id=(
                    existing[
                        "approved_user_id"
                    ]
                ),
                old_values=old_values,
                new_values=serialized,
            )

            return serialized

    except HTTPException:
        raise

    except IntegrityError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "The requested user update "
                "conflicts with existing data."
            ),
        ) from exc

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "The user could not be updated "
                "at this time."
            ),
        ) from exc