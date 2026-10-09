from typing import Any
from uuid import UUID

from fastapi import (
    HTTPException,
    status,
)
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


def _hod_user_id(
    current_user: dict[str, Any],
) -> str:
    try:
        return str(
            UUID(
                str(
                    current_user[
                        "user_id"
                    ]
                )
            )
        )

    except (
        KeyError,
        TypeError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=401,
            detail=(
                "Authenticated HOD "
                "identity is invalid."
            ),
        ) from exc


def get_hod_audit_logs(
    current_user: dict[str, Any],
    *,
    search: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    outcome: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> dict[str, Any]:
    user_id = _hod_user_id(
        current_user
    )

    page = max(
        page,
        1,
    )

    page_size = min(
        max(
            page_size,
            1,
        ),
        100,
    )

    offset = (
        page - 1
    ) * page_size

    db = SessionLocal()

    try:
        hod = db.execute(
            text(
                """
                SELECT
                    u.user_id::text
                        AS user_id,

                    u.department_id::text
                        AS department_id

                FROM public.users u

                WHERE u.user_id =
                      CAST(
                          :user_id
                          AS UUID
                      )

                  AND u.role =
                      'HOD'

                  AND u.is_active =
                      TRUE

                  AND u.department_id
                      IS NOT NULL

                LIMIT 1
                """
            ),
            {
                "user_id":
                    user_id,
            },
        ).mappings().first()

        if hod is None:
            raise HTTPException(
                status_code=403,
                detail=(
                    "An active HOD "
                    "department assignment "
                    "is required."
                ),
            )

        department_id = (
            hod[
                "department_id"
            ]
        )


        scope_sql = """
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

                actor.role
                    AS actor_role,

                a.actor_service,

                a.action,

                a.entity_type,

                a.entity_id::text
                    AS entity_id,

                COALESCE(
                    ticket_entity.ticket_number,
                    response_ticket.ticket_number
                ) AS ticket_number,

                a.outcome,

                a.old_values,
                a.new_values,

                COALESCE(
                    a.details,
                    '{}'::jsonb
                ) AS details,

                a.created_at

            FROM public.audit_logs a

            LEFT JOIN public.users actor
              ON actor.user_id =
                 a.actor_user_id


            LEFT JOIN public.tickets
                ticket_entity
              ON a.entity_type =
                 'TICKET'

             AND ticket_entity.ticket_id =
                 a.entity_id

            LEFT JOIN public.accounts_desks
                ticket_desk
              ON ticket_desk.desk_id =
                 ticket_entity.routed_desk_id

            LEFT JOIN public.users
                ticket_owner
              ON ticket_owner.user_id =
                 ticket_entity.assigned_officer_id


            LEFT JOIN public.responses
                response_entity
              ON a.entity_type =
                 'RESPONSE'

             AND response_entity.response_id =
                 a.entity_id

            LEFT JOIN public.tickets
                response_ticket
              ON response_ticket.ticket_id =
                 response_entity.ticket_id

            LEFT JOIN public.accounts_desks
                response_desk
              ON response_desk.desk_id =
                 response_ticket.routed_desk_id

            LEFT JOIN public.users
                response_owner
              ON response_owner.user_id =
                 response_ticket.assigned_officer_id


            LEFT JOIN public.users
                user_entity
              ON a.entity_type =
                 'USER'

             AND user_entity.user_id =
                 a.entity_id


            LEFT JOIN public.approved_users
                approved_entity
              ON a.entity_type =
                 'APPROVED_USER'

             AND approved_entity.approved_user_id =
                 a.entity_id


            WHERE
                (
                    a.entity_type =
                    'TICKET'

                    AND (
                        ticket_desk.department_id =
                        CAST(
                            :department_id
                            AS UUID
                        )

                        OR (
                            ticket_desk.department_id
                            IS NULL

                            AND
                            ticket_owner.department_id =
                            CAST(
                                :department_id
                                AS UUID
                            )
                        )
                    )
                )

                OR
                (
                    a.entity_type =
                    'RESPONSE'

                    AND (
                        response_desk.department_id =
                        CAST(
                            :department_id
                            AS UUID
                        )

                        OR (
                            response_desk.department_id
                            IS NULL

                            AND
                            response_owner.department_id =
                            CAST(
                                :department_id
                                AS UUID
                            )
                        )
                    )
                )

                OR
                (
                    a.entity_type =
                    'USER'

                    AND
                    user_entity.department_id =
                    CAST(
                        :department_id
                        AS UUID
                    )
                )

                OR
                (
                    a.entity_type =
                    'APPROVED_USER'

                    AND
                    approved_entity.department_id =
                    CAST(
                        :department_id
                        AS UUID
                    )
                )

                OR
                (
                    a.entity_type =
                    'DEPARTMENT'

                    AND
                    a.entity_id =
                    CAST(
                        :department_id
                        AS UUID
                    )
                )
        """


        where_parts = [
            "1 = 1",
        ]

        params: dict[str, Any] = {
            "department_id":
                department_id,
        }


        if (
            search
            and search.strip()
        ):
            params[
                "search"
            ] = (
                "%"
                + search.strip().lower()
                + "%"
            )

            where_parts.append(
                """
                (
                    LOWER(
                        COALESCE(
                            s.action,
                            ''
                        )
                    )
                    LIKE :search

                    OR

                    LOWER(
                        COALESCE(
                            s.actor_name,
                            ''
                        )
                    )
                    LIKE :search

                    OR

                    LOWER(
                        COALESCE(
                            s.actor_email,
                            ''
                        )
                    )
                    LIKE :search

                    OR

                    LOWER(
                        COALESCE(
                            s.actor_service,
                            ''
                        )
                    )
                    LIKE :search

                    OR

                    LOWER(
                        COALESCE(
                            s.ticket_number,
                            ''
                        )
                    )
                    LIKE :search

                    OR

                    LOWER(
                        COALESCE(
                            s.entity_type,
                            ''
                        )
                    )
                    LIKE :search
                )
                """
            )


        if (
            action
            and action.strip()
        ):
            params[
                "action"
            ] = (
                action.strip()
                .upper()
            )

            where_parts.append(
                """
                UPPER(
                    s.action
                ) = :action
                """
            )


        if (
            entity_type
            and entity_type.strip()
        ):
            params[
                "entity_type"
            ] = (
                entity_type.strip()
                .upper()
            )

            where_parts.append(
                """
                UPPER(
                    s.entity_type
                ) = :entity_type
                """
            )


        if (
            outcome
            and outcome.strip()
        ):
            params[
                "outcome"
            ] = (
                outcome.strip()
                .upper()
            )

            where_parts.append(
                """
                UPPER(
                    s.outcome
                ) = :outcome
                """
            )


        where_sql = (
            "\nAND ".join(
                where_parts
            )
        )


        total = db.execute(
            text(
                f"""
                WITH scoped AS (
                    {scope_sql}
                )

                SELECT
                    COUNT(*)::int

                FROM scoped s

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
                WITH scoped AS (
                    {scope_sql}
                )

                SELECT
                    s.audit_id,
                    s.event_sequence,

                    s.actor_user_id,
                    s.actor_name,
                    s.actor_email,
                    s.actor_role,
                    s.actor_service,

                    s.action,

                    s.entity_type,
                    s.entity_id,
                    s.ticket_number,

                    s.outcome,

                    s.old_values,
                    s.new_values,
                    s.details,

                    s.created_at

                FROM scoped s

                WHERE {where_sql}

                ORDER BY
                    s.event_sequence DESC

                LIMIT :limit
                OFFSET :offset
                """
            ),
            query_params,
        ).mappings().all()


        total_pages = (
            (
                total
                + page_size
                - 1
            )
            // page_size
            if total
            else 0
        )


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
                total_pages,
        }

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Department audit history "
                "is temporarily unavailable."
            ),
        ) from exc

    finally:
        db.close()