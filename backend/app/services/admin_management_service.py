import json
import math
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

from app.schemas.admin_management import (
    AdminDepartmentCreate,
    AdminDepartmentUpdate,
    AdminRoutingRuleCreate,
    AdminRoutingRuleUpdate,
)


# ============================================================
# COMMON HELPERS
# ============================================================


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


def _uuid_string(
    value,
    *,
    field_name: str = "identifier",
) -> str:
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
            detail=(
                f"Invalid {field_name}."
            ),
        ) from exc


def _json_value(
    value,
) -> str:
    return json.dumps(
        value,
        default=str,
    )


def _write_audit(
    db,
    *,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    old_values: dict[str, Any] | None,
    new_values: dict[str, Any] | None,
    details: dict[str, Any] | None = None,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO public.audit_logs (
                actor_user_id,
                actor_service,
                action,
                entity_type,
                entity_id,
                outcome,
                old_values,
                new_values,
                details
            )
            VALUES (
                CAST(:actor_user_id AS UUID),
                NULL,
                :action,
                :entity_type,
                CAST(:entity_id AS UUID),
                'SUCCESS',
                CAST(:old_values AS JSONB),
                CAST(:new_values AS JSONB),
                CAST(:details AS JSONB)
            )
            """
        ),
        {
            "actor_user_id":
                actor_id,

            "action":
                action,

            "entity_type":
                entity_type,

            "entity_id":
                entity_id,

            "old_values":
                (
                    _json_value(
                        old_values
                    )
                    if old_values
                    is not None
                    else None
                ),

            "new_values":
                (
                    _json_value(
                        new_values
                    )
                    if new_values
                    is not None
                    else None
                ),

            "details":
                _json_value(
                    details
                    or {
                        "source":
                            "ADMIN_MANAGEMENT",
                    }
                ),
        },
    )


# ============================================================
# ALL QUERIES
# ============================================================


def get_admin_queries(
    current_user: dict[str, Any],
    *,
    search: str | None = None,
    query_status: str | None = None,
    source: str | None = None,
    priority: str | None = None,
    department_id: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> dict[str, Any]:
    _actor_id(
        current_user
    )

    where_parts = [
        "t.status <> 'DRAFT'",
    ]

    params: dict[str, Any] = {}


    if (
        search
        and search.strip()
    ):
        params["search"] = (
            "%"
            + search.strip().lower()
            + "%"
        )

        where_parts.append(
            """
            (
                LOWER(t.ticket_number)
                    LIKE :search

                OR LOWER(t.subject)
                    LIKE :search

                OR LOWER(
                    COALESCE(
                        student.full_name,
                        ''
                    )
                )
                    LIKE :search

                OR LOWER(
                    student.email
                )
                    LIKE :search

                OR LOWER(
                    COALESCE(
                        qc.category_name,
                        t.category,
                        ''
                    )
                )
                    LIKE :search

                OR LOWER(
                    COALESCE(
                        routed_department.department_name,
                        officer_department.department_name,
                        ''
                    )
                )
                    LIKE :search

                OR LOWER(
                    COALESCE(
                        desk.desk_name,
                        ''
                    )
                )
                    LIKE :search
            )
            """
        )


    if (
        query_status
        and query_status.strip()
        and query_status.upper()
        != "ALL"
    ):
        params[
            "query_status"
        ] = (
            query_status
            .strip()
            .upper()
        )

        where_parts.append(
            "t.status = :query_status"
        )


    if (
        source
        and source.strip()
        and source.upper()
        != "ALL"
    ):
        params[
            "source"
        ] = (
            source
            .strip()
            .upper()
        )

        where_parts.append(
            "t.source = :source"
        )


    if (
        priority
        and priority.strip()
        and priority.upper()
        != "ALL"
    ):
        params[
            "priority"
        ] = (
            priority
            .strip()
            .upper()
        )

        where_parts.append(
            "t.priority = :priority"
        )


    if (
        department_id
        and department_id.strip()
    ):
        normalized_department_id = (
            _uuid_string(
                department_id,
                field_name=(
                    "department ID"
                ),
            )
        )

        params[
            "department_id"
        ] = (
            normalized_department_id
        )

        where_parts.append(
            """
            COALESCE(
                routed_department.department_id,
                officer_department.department_id
            )
            = CAST(:department_id AS UUID)
            """
        )


    where_sql = (
        " AND ".join(
            where_parts
        )
    )

    offset = (
        page - 1
    ) * page_size


    base_joins = """
        FROM public.tickets t

        JOIN public.users student
          ON student.user_id =
             t.student_id

        LEFT JOIN public.query_categories qc
          ON qc.category_id =
             t.category_id

        LEFT JOIN public.accounts_desks desk
          ON desk.desk_id =
             t.routed_desk_id

        LEFT JOIN public.departments routed_department
          ON routed_department.department_id =
             desk.department_id

        LEFT JOIN public.users officer
          ON officer.user_id =
             t.assigned_officer_id

        LEFT JOIN public.departments officer_department
          ON officer_department.department_id =
             officer.department_id
    """


    try:
        with SessionLocal() as db:
            total = db.execute(
                text(
                    f"""
                    SELECT COUNT(*)::int
                    {base_joins}
                    WHERE {where_sql}
                    """
                ),
                params,
            ).scalar_one()


            query_params = {
                **params,
                "limit":
                    page_size,
                "offset":
                    offset,
            }


            rows = db.execute(
                text(
                    f"""
                    SELECT
                        t.ticket_id::text
                            AS ticket_id,

                        t.ticket_number,

                        t.student_id::text
                            AS student_id,

                        student.full_name
                            AS student_name,

                        student.email
                            AS student_email,

                        t.subject,
                        t.source,
                        t.status,

                        COALESCE(
                            qc.category_name,
                            t.category
                        )
                            AS category,

                        t.priority,

                        t.confidence,

                        COALESCE(
                            routed_department.department_id,
                            officer_department.department_id
                        )::text
                            AS department_id,

                        COALESCE(
                            routed_department.department_name,
                            officer_department.department_name
                        )
                            AS department_name,

                        desk.desk_id::text
                            AS desk_id,

                        desk.desk_name,

                        officer.user_id::text
                            AS assigned_officer_id,

                        officer.full_name
                            AS assigned_officer_name,

                        t.requires_manual_review,

                        t.created_at,
                        t.submitted_at,
                        t.updated_at,
                        t.sla_due_at,
                        t.resolved_at,
                        t.closed_at

                    {base_joins}

                    WHERE {where_sql}

                    ORDER BY
                        COALESCE(
                            t.submitted_at,
                            t.created_at
                        ) DESC,
                        t.ticket_number DESC

                    LIMIT :limit
                    OFFSET :offset
                    """
                ),
                query_params,
            ).mappings().all()


            items = []

            for row in rows:
                item = dict(row)

                if (
                    item["confidence"]
                    is not None
                ):
                    item[
                        "confidence"
                    ] = float(
                        item[
                            "confidence"
                        ]
                    )

                items.append(
                    item
                )


            return {
                "items":
                    items,

                "total":
                    total,

                "page":
                    page,

                "page_size":
                    page_size,

                "total_pages":
                    (
                        math.ceil(
                            total
                            / page_size
                        )
                        if total
                        else 0
                    ),
            }

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Administrative query data "
                "is temporarily unavailable."
            ),
        ) from exc


# ============================================================
# DEPARTMENTS
# ============================================================


def _load_department(
    db,
    department_id: str,
    *,
    for_update: bool = False,
):
    if for_update:
        locked = db.execute(
            text(
                """
                SELECT
                    department_id::text
                        AS department_id
                FROM public.departments
                WHERE department_id =
                      CAST(:department_id AS UUID)
                FOR UPDATE
                """
            ),
            {
                "department_id":
                    department_id,
            },
        ).mappings().first()

        if locked is None:
            return None

    return db.execute(
        text(
            """
            SELECT
                d.department_id::text
                    AS department_id,

                d.department_name,
                d.department_email,
                d.description,
                d.is_active,
                d.created_at,

                COUNT(
                    DISTINCT u.user_id
                ) FILTER (
                    WHERE
                        u.is_active = TRUE
                )::int
                    AS active_users,

                COUNT(
                    DISTINCT rr.rule_id
                ) FILTER (
                    WHERE
                        rr.is_active = TRUE
                )::int
                    AS active_routing_rules,

                COUNT(
                    DISTINCT t.ticket_id
                ) FILTER (
                    WHERE
                        t.status NOT IN (
                            'DRAFT',
                            'RESOLVED',
                            'CLOSED'
                        )
                )::int
                    AS active_queries

            FROM public.departments d

            LEFT JOIN public.users u
              ON u.department_id =
                 d.department_id

            LEFT JOIN public.routing_rules rr
              ON rr.department_id =
                 d.department_id

            LEFT JOIN public.accounts_desks desk
              ON desk.department_id =
                 d.department_id

            LEFT JOIN public.tickets t
              ON t.routed_desk_id =
                 desk.desk_id

            WHERE d.department_id =
                  CAST(:department_id AS UUID)

            GROUP BY
                d.department_id,
                d.department_name,
                d.department_email,
                d.description,
                d.is_active,
                d.created_at
            """
        ),
        {
            "department_id":
                department_id,
        },
    ).mappings().first()


def get_admin_departments(
    current_user: dict[str, Any],
) -> dict[str, Any]:
    _actor_id(
        current_user
    )

    try:
        with SessionLocal() as db:
            rows = db.execute(
                text(
                    """
                    SELECT
                        d.department_id::text
                            AS department_id,

                        d.department_name,
                        d.department_email,
                        d.description,
                        d.is_active,
                        d.created_at,

                        COUNT(
                            DISTINCT u.user_id
                        ) FILTER (
                            WHERE
                                u.is_active = TRUE
                        )::int
                            AS active_users,

                        COUNT(
                            DISTINCT rr.rule_id
                        ) FILTER (
                            WHERE
                                rr.is_active = TRUE
                        )::int
                            AS active_routing_rules,

                        COUNT(
                            DISTINCT t.ticket_id
                        ) FILTER (
                            WHERE
                                t.status NOT IN (
                                    'DRAFT',
                                    'RESOLVED',
                                    'CLOSED'
                                )
                        )::int
                            AS active_queries

                    FROM public.departments d

                    LEFT JOIN public.users u
                      ON u.department_id =
                         d.department_id

                    LEFT JOIN public.routing_rules rr
                      ON rr.department_id =
                         d.department_id

                    LEFT JOIN public.accounts_desks desk
                      ON desk.department_id =
                         d.department_id

                    LEFT JOIN public.tickets t
                      ON t.routed_desk_id =
                         desk.desk_id

                    GROUP BY
                        d.department_id,
                        d.department_name,
                        d.department_email,
                        d.description,
                        d.is_active,
                        d.created_at

                    ORDER BY
                        d.is_active DESC,
                        d.department_name
                    """
                )
            ).mappings().all()


            return {
                "items": [
                    dict(row)
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
                "Department data is "
                "temporarily unavailable."
            ),
        ) from exc


def create_admin_department(
    current_user: dict[str, Any],
    data: AdminDepartmentCreate,
) -> dict[str, Any]:
    actor_id = _actor_id(
        current_user
    )

    try:
        with SessionLocal.begin() as db:
            created = db.execute(
                text(
                    """
                    INSERT INTO public.departments (
                        department_name,
                        department_email,
                        description,
                        is_active
                    )
                    VALUES (
                        :department_name,
                        :department_email,
                        :description,
                        TRUE
                    )
                    RETURNING
                        department_id::text
                            AS department_id
                    """
                ),
                {
                    "department_name":
                        data.department_name,

                    "department_email":
                        data.department_email,

                    "description":
                        data.description,
                },
            ).mappings().one()


            row = _load_department(
                db,
                created[
                    "department_id"
                ],
            )

            serialized = dict(
                row
            )


            _write_audit(
                db,
                actor_id=actor_id,
                action=(
                    "ADMIN_DEPARTMENT_CREATED"
                ),
                entity_type=(
                    "DEPARTMENT"
                ),
                entity_id=(
                    created[
                        "department_id"
                    ]
                ),
                old_values=None,
                new_values=serialized,
            )

            return serialized

    except IntegrityError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "A department with the same "
                "name or email already exists."
            ),
        ) from exc

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Department could not "
                "be created."
            ),
        ) from exc


def update_admin_department(
    current_user: dict[str, Any],
    department_id,
    data: AdminDepartmentUpdate,
) -> dict[str, Any]:
    actor_id = _actor_id(
        current_user
    )

    normalized_id = _uuid_string(
        department_id,
        field_name=(
            "department ID"
        ),
    )


    try:
        with SessionLocal.begin() as db:
            existing = _load_department(
                db,
                normalized_id,
                for_update=True,
            )

            if existing is None:
                raise HTTPException(
                    status_code=(
                        status.HTTP_404_NOT_FOUND
                    ),
                    detail=(
                        "Department not found."
                    ),
                )


            old_values = dict(
                existing
            )

            fields = (
                data.model_fields_set
            )


            department_name = (
                data.department_name
                if "department_name"
                in fields
                else existing[
                    "department_name"
                ]
            )

            department_email = (
                data.department_email
                if "department_email"
                in fields
                else existing[
                    "department_email"
                ]
            )

            description = (
                data.description
                if "description"
                in fields
                else existing[
                    "description"
                ]
            )

            is_active = (
                data.is_active
                if "is_active"
                in fields
                else bool(
                    existing[
                        "is_active"
                    ]
                )
            )


            if (
                not is_active
                and bool(
                    existing[
                        "is_active"
                    ]
                )
            ):
                active_rule_count = (
                    db.execute(
                        text(
                            """
                            SELECT COUNT(*)::int
                            FROM public.routing_rules
                            WHERE
                                department_id =
                                    CAST(
                                        :department_id
                                        AS UUID
                                    )
                                AND is_active = TRUE
                            """
                        ),
                        {
                            "department_id":
                                normalized_id,
                        },
                    ).scalar_one()
                )

                if (
                    active_rule_count > 0
                ):
                    raise HTTPException(
                        status_code=(
                            status.HTTP_409_CONFLICT
                        ),
                        detail=(
                            "Deactivate this "
                            "department's active "
                            "routing rules first."
                        ),
                    )


            db.execute(
                text(
                    """
                    UPDATE public.departments
                    SET
                        department_name =
                            :department_name,

                        department_email =
                            :department_email,

                        description =
                            :description,

                        is_active =
                            :is_active

                    WHERE department_id =
                          CAST(
                              :department_id
                              AS UUID
                          )
                    """
                ),
                {
                    "department_name":
                        department_name,

                    "department_email":
                        department_email,

                    "description":
                        description,

                    "is_active":
                        is_active,

                    "department_id":
                        normalized_id,
                },
            )


            updated = _load_department(
                db,
                normalized_id,
            )

            serialized = dict(
                updated
            )


            _write_audit(
                db,
                actor_id=actor_id,
                action=(
                    "ADMIN_DEPARTMENT_UPDATED"
                ),
                entity_type=(
                    "DEPARTMENT"
                ),
                entity_id=(
                    normalized_id
                ),
                old_values=(
                    old_values
                ),
                new_values=(
                    serialized
                ),
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
                "The department update "
                "conflicts with existing data."
            ),
        ) from exc

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Department could not "
                "be updated."
            ),
        ) from exc


# ============================================================
# ROUTING RULES
# ============================================================


def _load_routing_rule(
    db,
    rule_id: str,
    *,
    for_update: bool = False,
):
    locking = (
        " FOR UPDATE OF rr"
        if for_update
        else ""
    )

    return db.execute(
        text(
            """
            SELECT
                rr.rule_id::text
                    AS rule_id,

                rr.rule_code,

                rr.category_id::text
                    AS category_id,

                qc.category_code,
                qc.category_name,

                rr.department_id::text
                    AS department_id,

                d.department_name,

                rr.desk_id::text
                    AS desk_id,

                desk.desk_code,
                desk.desk_name,

                rr.target_role,

                rr.rule_expression,

                rr.priority_order,
                rr.is_active,
                rr.created_at

            FROM public.routing_rules rr

            JOIN public.query_categories qc
              ON qc.category_id =
                 rr.category_id

            JOIN public.departments d
              ON d.department_id =
                 rr.department_id

            LEFT JOIN public.accounts_desks desk
              ON desk.desk_id =
                 rr.desk_id

            WHERE rr.rule_id =
                  CAST(:rule_id AS UUID)

            LIMIT 1
            """
            + locking
        ),
        {
            "rule_id":
                rule_id,
        },
    ).mappings().first()


def _validate_routing_target(
    db,
    *,
    category_id: str,
    department_id: str,
    desk_id: str | None,
    require_active: bool,
) -> None:
    category = db.execute(
        text(
            """
            SELECT
                category_id::text
                    AS category_id,
                is_active
            FROM public.query_categories
            WHERE category_id =
                  CAST(:category_id AS UUID)
            LIMIT 1
            """
        ),
        {
            "category_id":
                category_id,
        },
    ).mappings().first()


    if category is None:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Selected query category "
                "does not exist."
            ),
        )


    if (
        require_active
        and not category[
            "is_active"
        ]
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "An active routing rule "
                "cannot use an inactive category."
            ),
        )


    department = db.execute(
        text(
            """
            SELECT
                department_id::text
                    AS department_id,
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


    if department is None:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Selected department "
                "does not exist."
            ),
        )


    if (
        require_active
        and not department[
            "is_active"
        ]
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "An active routing rule "
                "cannot target an inactive "
                "department."
            ),
        )


    if desk_id is None:
        return


    desk = db.execute(
        text(
            """
            SELECT
                desk_id::text
                    AS desk_id,

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


    if desk is None:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Selected accounts desk "
                "does not exist."
            ),
        )


    if (
        desk[
            "department_id"
        ]
        != department_id
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Selected desk does not "
                "belong to the selected "
                "department."
            ),
        )


    if (
        require_active
        and not desk[
            "is_active"
        ]
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "An active routing rule "
                "cannot target an inactive desk."
            ),
        )


def get_admin_routing_options(
    current_user: dict[str, Any],
) -> dict[str, Any]:
    _actor_id(
        current_user
    )

    try:
        with SessionLocal() as db:
            categories = db.execute(
                text(
                    """
                    SELECT
                        category_id::text
                            AS category_id,
                        category_code,
                        category_name,
                        default_priority,
                        is_active
                    FROM public.query_categories
                    ORDER BY
                        is_active DESC,
                        category_name
                    """
                )
            ).mappings().all()


            departments = db.execute(
                text(
                    """
                    SELECT
                        department_id::text
                            AS department_id,
                        department_name,
                        is_active
                    FROM public.departments
                    ORDER BY
                        is_active DESC,
                        department_name
                    """
                )
            ).mappings().all()


            desks = db.execute(
                text(
                    """
                    SELECT
                        desk_id::text
                            AS desk_id,
                        department_id::text
                            AS department_id,
                        desk_code,
                        desk_name,
                        is_active
                    FROM public.accounts_desks
                    ORDER BY
                        is_active DESC,
                        desk_name
                    """
                )
            ).mappings().all()


            return {
                "categories": [
                    dict(row)
                    for row in categories
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
                "Routing configuration options "
                "are temporarily unavailable."
            ),
        ) from exc


def get_admin_routing_rules(
    current_user: dict[str, Any],
) -> dict[str, Any]:
    _actor_id(
        current_user
    )

    try:
        with SessionLocal() as db:
            rows = db.execute(
                text(
                    """
                    SELECT
                        rr.rule_id::text
                            AS rule_id,

                        rr.rule_code,

                        rr.category_id::text
                            AS category_id,

                        qc.category_code,
                        qc.category_name,

                        rr.department_id::text
                            AS department_id,

                        d.department_name,

                        rr.desk_id::text
                            AS desk_id,

                        desk.desk_code,
                        desk.desk_name,

                        rr.target_role,
                        rr.rule_expression,

                        rr.priority_order,
                        rr.is_active,
                        rr.created_at

                    FROM public.routing_rules rr

                    JOIN public.query_categories qc
                      ON qc.category_id =
                         rr.category_id

                    JOIN public.departments d
                      ON d.department_id =
                         rr.department_id

                    LEFT JOIN public.accounts_desks desk
                      ON desk.desk_id =
                         rr.desk_id

                    ORDER BY
                        rr.is_active DESC,
                        rr.priority_order,
                        rr.rule_code
                    """
                )
            ).mappings().all()


            return {
                "items": [
                    dict(row)
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
                "Routing rules are "
                "temporarily unavailable."
            ),
        ) from exc


def create_admin_routing_rule(
    current_user: dict[str, Any],
    data: AdminRoutingRuleCreate,
) -> dict[str, Any]:
    actor_id = _actor_id(
        current_user
    )

    category_id = _uuid_string(
        data.category_id,
        field_name="category ID",
    )

    department_id = _uuid_string(
        data.department_id,
        field_name="department ID",
    )

    desk_id = (
        _uuid_string(
            data.desk_id,
            field_name="desk ID",
        )
        if data.desk_id
        else None
    )


    try:
        with SessionLocal.begin() as db:
            _validate_routing_target(
                db,
                category_id=category_id,
                department_id=department_id,
                desk_id=desk_id,
                require_active=(
                    data.is_active
                ),
            )


            created = db.execute(
                text(
                    """
                    INSERT INTO public.routing_rules (
                        rule_code,
                        category_id,
                        department_id,
                        desk_id,
                        target_role,
                        rule_expression,
                        priority_order,
                        is_active
                    )
                    VALUES (
                        :rule_code,
                        CAST(
                            :category_id
                            AS UUID
                        ),
                        CAST(
                            :department_id
                            AS UUID
                        ),
                        CAST(
                            :desk_id
                            AS UUID
                        ),
                        :target_role,
                        CAST(
                            :rule_expression
                            AS JSONB
                        ),
                        :priority_order,
                        :is_active
                    )
                    RETURNING
                        rule_id::text
                            AS rule_id
                    """
                ),
                {
                    "rule_code":
                        data.rule_code,

                    "category_id":
                        category_id,

                    "department_id":
                        department_id,

                    "desk_id":
                        desk_id,

                    "target_role":
                        data.target_role,

                    "rule_expression":
                        _json_value(
                            data.rule_expression
                        ),

                    "priority_order":
                        data.priority_order,

                    "is_active":
                        data.is_active,
                },
            ).mappings().one()


            row = _load_routing_rule(
                db,
                created[
                    "rule_id"
                ],
            )

            serialized = dict(
                row
            )


            _write_audit(
                db,
                actor_id=actor_id,
                action=(
                    "ADMIN_ROUTING_RULE_CREATED"
                ),
                entity_type=(
                    "ROUTING_RULE"
                ),
                entity_id=(
                    created[
                        "rule_id"
                    ]
                ),
                old_values=None,
                new_values=(
                    serialized
                ),
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
                "Routing rule code already "
                "exists or the configuration "
                "violates a routing constraint."
            ),
        ) from exc

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Routing rule could not "
                "be created."
            ),
        ) from exc


def update_admin_routing_rule(
    current_user: dict[str, Any],
    rule_id,
    data: AdminRoutingRuleUpdate,
) -> dict[str, Any]:
    actor_id = _actor_id(
        current_user
    )

    normalized_rule_id = (
        _uuid_string(
            rule_id,
            field_name="routing rule ID",
        )
    )


    try:
        with SessionLocal.begin() as db:
            existing = _load_routing_rule(
                db,
                normalized_rule_id,
                for_update=True,
            )

            if existing is None:
                raise HTTPException(
                    status_code=(
                        status.HTTP_404_NOT_FOUND
                    ),
                    detail=(
                        "Routing rule not found."
                    ),
                )


            old_values = dict(
                existing
            )

            fields = (
                data.model_fields_set
            )


            rule_code = (
                data.rule_code
                if "rule_code"
                in fields
                else existing[
                    "rule_code"
                ]
            )

            category_id = (
                _uuid_string(
                    data.category_id,
                    field_name=(
                        "category ID"
                    ),
                )
                if "category_id"
                in fields
                else existing[
                    "category_id"
                ]
            )

            department_id = (
                _uuid_string(
                    data.department_id,
                    field_name=(
                        "department ID"
                    ),
                )
                if "department_id"
                in fields
                else existing[
                    "department_id"
                ]
            )


            if (
                "desk_id"
                in fields
            ):
                desk_id = (
                    _uuid_string(
                        data.desk_id,
                        field_name="desk ID",
                    )
                    if data.desk_id
                    else None
                )
            else:
                desk_id = existing[
                    "desk_id"
                ]


            target_role = (
                data.target_role
                if "target_role"
                in fields
                else existing[
                    "target_role"
                ]
            )


            rule_expression = (
                data.rule_expression
                if "rule_expression"
                in fields
                else existing[
                    "rule_expression"
                ]
            )


            priority_order = (
                data.priority_order
                if "priority_order"
                in fields
                else existing[
                    "priority_order"
                ]
            )


            is_active = (
                data.is_active
                if "is_active"
                in fields
                else bool(
                    existing[
                        "is_active"
                    ]
                )
            )


            _validate_routing_target(
                db,
                category_id=category_id,
                department_id=department_id,
                desk_id=desk_id,
                require_active=(
                    is_active
                ),
            )


            db.execute(
                text(
                    """
                    UPDATE public.routing_rules
                    SET
                        rule_code =
                            :rule_code,

                        category_id =
                            CAST(
                                :category_id
                                AS UUID
                            ),

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

                        target_role =
                            :target_role,

                        rule_expression =
                            CAST(
                                :rule_expression
                                AS JSONB
                            ),

                        priority_order =
                            :priority_order,

                        is_active =
                            :is_active

                    WHERE rule_id =
                          CAST(
                              :rule_id
                              AS UUID
                          )
                    """
                ),
                {
                    "rule_code":
                        rule_code,

                    "category_id":
                        category_id,

                    "department_id":
                        department_id,

                    "desk_id":
                        desk_id,

                    "target_role":
                        target_role,

                    "rule_expression":
                        _json_value(
                            rule_expression
                        ),

                    "priority_order":
                        priority_order,

                    "is_active":
                        is_active,

                    "rule_id":
                        normalized_rule_id,
                },
            )


            updated = _load_routing_rule(
                db,
                normalized_rule_id,
            )

            serialized = dict(
                updated
            )


            _write_audit(
                db,
                actor_id=actor_id,
                action=(
                    "ADMIN_ROUTING_RULE_UPDATED"
                ),
                entity_type=(
                    "ROUTING_RULE"
                ),
                entity_id=(
                    normalized_rule_id
                ),
                old_values=(
                    old_values
                ),
                new_values=(
                    serialized
                ),
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
                "Routing rule update conflicts "
                "with existing routing data."
            ),
        ) from exc

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Routing rule could not "
                "be updated."
            ),
        ) from exc


# ============================================================
# AUDIT LOGS
# ============================================================


def get_admin_audit_logs(
    current_user: dict[str, Any],
    *,
    search: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    outcome: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> dict[str, Any]:
    _actor_id(
        current_user
    )

    where_parts = [
        "1 = 1",
    ]

    params: dict[str, Any] = {}


    if (
        search
        and search.strip()
    ):
        params["search"] = (
            "%"
            + search.strip().lower()
            + "%"
        )

        where_parts.append(
            """
            (
                LOWER(a.action)
                    LIKE :search

                OR LOWER(a.entity_type)
                    LIKE :search

                OR LOWER(
                    COALESCE(
                        actor.full_name,
                        ''
                    )
                )
                    LIKE :search

                OR LOWER(
                    COALESCE(
                        actor.email,
                        ''
                    )
                )
                    LIKE :search

                OR LOWER(
                    COALESCE(
                        a.actor_service,
                        ''
                    )
                )
                    LIKE :search

                OR LOWER(
                    a.details::text
                )
                    LIKE :search
            )
            """
        )


    if (
        action
        and action.strip()
        and action.upper()
        != "ALL"
    ):
        params["action"] = (
            action.strip()
        )

        where_parts.append(
            "a.action = :action"
        )


    if (
        entity_type
        and entity_type.strip()
        and entity_type.upper()
        != "ALL"
    ):
        params[
            "entity_type"
        ] = (
            entity_type.strip()
        )

        where_parts.append(
            """
            a.entity_type =
                :entity_type
            """
        )


    if (
        outcome
        and outcome.strip()
        and outcome.upper()
        != "ALL"
    ):
        params[
            "outcome"
        ] = (
            outcome
            .strip()
            .upper()
        )

        where_parts.append(
            "a.outcome = :outcome"
        )


    where_sql = (
        " AND ".join(
            where_parts
        )
    )

    offset = (
        page - 1
    ) * page_size


    try:
        with SessionLocal() as db:
            total = db.execute(
                text(
                    f"""
                    SELECT COUNT(*)::int

                    FROM public.audit_logs a

                    LEFT JOIN public.users actor
                      ON actor.user_id =
                         a.actor_user_id

                    WHERE {where_sql}
                    """
                ),
                params,
            ).scalar_one()


            query_params = {
                **params,
                "limit":
                    page_size,
                "offset":
                    offset,
            }


            rows = db.execute(
                text(
                    f"""
                    SELECT
                        a.audit_id::text
                            AS audit_id,

                        a.event_sequence,

                        a.actor_user_id::text
                            AS actor_user_id,

                        actor.full_name
                            AS actor_name,

                        actor.email
                            AS actor_email,

                        a.actor_service,

                        a.action,
                        a.entity_type,

                        a.entity_id::text
                            AS entity_id,

                        a.outcome,

                        a.old_values,
                        a.new_values,
                        a.details,

                        a.request_id::text
                            AS request_id,

                        a.ip_address::text
                            AS ip_address,

                        a.created_at

                    FROM public.audit_logs a

                    LEFT JOIN public.users actor
                      ON actor.user_id =
                         a.actor_user_id

                    WHERE {where_sql}

                    ORDER BY
                        a.event_sequence DESC

                    LIMIT :limit
                    OFFSET :offset
                    """
                ),
                query_params,
            ).mappings().all()


            return {
                "items": [
                    dict(row)
                    for row in rows
                ],

                "total":
                    total,

                "page":
                    page,

                "page_size":
                    page_size,

                "total_pages":
                    (
                        math.ceil(
                            total
                            / page_size
                        )
                        if total
                        else 0
                    ),
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Audit logs are temporarily "
                "unavailable."
            ),
        ) from exc