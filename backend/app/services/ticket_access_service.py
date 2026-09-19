import json
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.auth_service import _load_application_user


TICKET_FROM = """
    FROM public.tickets t

    LEFT JOIN public.query_assignments current_assignment
      ON current_assignment.ticket_id = t.ticket_id
     AND current_assignment.is_current = TRUE

    LEFT JOIN public.routing_rules current_rule
      ON current_rule.rule_id = current_assignment.rule_id

    LEFT JOIN public.accounts_desks desk
      ON desk.desk_id = t.routed_desk_id

    LEFT JOIN public.departments ticket_department
      ON ticket_department.department_id = COALESCE(
          current_assignment.department_id,
          desk.department_id
      )

    LEFT JOIN public.users officer
      ON officer.user_id = t.assigned_officer_id
"""


def load_ticket_actor(
    db: Session,
    current_user: dict[str, Any],
    *roles: str,
) -> dict[str, Any]:
    try:
        user_id = str(
            UUID(str(current_user["user_id"]))
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            401,
            "Authenticated user identity is invalid.",
        ) from exc

    db.execute(
        text(
            """
            SELECT u.user_id
            FROM public.users u
            JOIN public.approved_users au
              ON au.approved_user_id =
                 u.approved_user_id
            WHERE u.user_id =
                  CAST(:user_id AS UUID)
            FOR SHARE OF u, au
            """
        ),
        {
            "user_id": user_id,
        },
    )

    actor = _load_application_user(
        db,
        user_id,
        current_user["email"],
    )

    if actor["role"] not in roles:
        raise HTTPException(
            403,
            "Access denied for this role.",
        )

    return actor


def actor_parameters(
    actor: dict[str, Any],
) -> dict[str, Any]:
    return {
        "actor_id": actor["user_id"],
        "actor_role": actor["role"],
        "department_id": actor["department_id"],
        "desk_id": actor["desk_id"],
        "is_hod": actor["role"] == "HOD",
    }


def lock_accessible_ticket(
    db: Session,
    ticket_number: str,
    actor: dict[str, Any],
) -> dict[str, Any]:
    ticket = db.execute(
        text(
            """
            SELECT
                t.*,

                ticket_department.department_id::text
                    AS ticket_department_id,

                ticket_department.department_name
                    AS ticket_department_name,

                current_assignment.assignment_id::text
                    AS current_assignment_id,

                current_assignment.rule_id::text
                    AS routing_rule_id,

                COALESCE(
                    current_rule.target_role,
                    CASE
                        WHEN t.routed_desk_id IS NOT NULL
                            THEN 'DEPARTMENT_STAFF'
                        ELSE NULL
                    END
                ) AS target_role,

                desk.desk_code,
                desk.desk_name,

                officer.full_name
                    AS assigned_officer_name

            """
            + TICKET_FROM
            + """
            WHERE t.ticket_number = :ticket_number

              AND t.status <> 'DRAFT'

              AND ticket_department.department_id =
                  CAST(:department_id AS UUID)

              AND (
                    :is_hod = TRUE

                    OR (
                        t.assigned_officer_id =
                            CAST(:actor_id AS UUID)

                        AND (
                            (
                                CAST(:desk_id AS UUID)
                                    IS NULL
                                AND
                                t.routed_desk_id
                                    IS NULL
                            )
                            OR
                            t.routed_desk_id =
                                CAST(:desk_id AS UUID)
                        )

                        AND (
                            current_rule.target_role =
                                :actor_role

                            OR (
                                current_rule.target_role
                                    IS NULL

                                AND
                                :actor_role =
                                    'DEPARTMENT_STAFF'

                                AND
                                t.routed_desk_id
                                    IS NOT NULL
                            )
                        )
                    )
              )

            FOR UPDATE OF t
            """
        ),
        {
            **actor_parameters(actor),
            "ticket_number": ticket_number,
        },
    ).mappings().first()

    if ticket is None:
        raise HTTPException(
            404,
            "Ticket not found or not accessible.",
        )

    return dict(ticket)


def record_ticket_change(
    db: Session,
    actor_id: str,
    before: dict[str, Any] | None,
    after: dict[str, Any],
    action: str,
    note: str,
    event_at: Any,
) -> None:
    previous_status = (
        before["status"]
        if before
        else None
    )

    if previous_status != after["status"]:
        db.execute(
            text(
                """
                INSERT INTO public.query_status_history (
                    ticket_id,
                    changed_by_user_id,
                    previous_status,
                    new_status,
                    change_note,
                    changed_at
                )
                VALUES (
                    CAST(:ticket_id AS UUID),
                    CAST(:actor_id AS UUID),
                    :previous_status,
                    :new_status,
                    :note,
                    :event_at
                )
                """
            ),
            {
                "ticket_id": str(
                    after["ticket_id"]
                ),
                "actor_id": actor_id,
                "previous_status": (
                    previous_status
                ),
                "new_status": after["status"],
                "note": note,
                "event_at": event_at,
            },
        )

    fields = (
        "status",
        "assigned_officer_id",
        "routed_desk_id",
        "resolved_at",
    )

    old_values = (
        {
            key: before.get(key)
            for key in fields
        }
        if before
        else None
    )

    new_values = {
        key: after.get(key)
        for key in fields
    }

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
                created_at
            )
            VALUES (
                CAST(:actor_id AS UUID),
                :action,
                'TICKET',
                CAST(:ticket_id AS UUID),
                CAST(:old_values AS JSONB),
                CAST(:new_values AS JSONB),
                :event_at
            )
            """
        ),
        {
            "actor_id": actor_id,
            "action": action,
            "ticket_id": str(
                after["ticket_id"]
            ),
            "old_values": (
                json.dumps(
                    old_values,
                    default=str,
                )
                if before
                else None
            ),
            "new_values": json.dumps(
                new_values,
                default=str,
            ),
            "event_at": event_at,
        },
    )