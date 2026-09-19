import json
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


def assign_available_officer(
    ticket_number: str,
) -> dict[str, Any]:
    db = SessionLocal()

    try:
        ticket = db.execute(
            text(
                """
                SELECT
                    t.ticket_id,
                    t.ticket_number,
                    t.status,
                    t.assigned_officer_id,

                    qa.assignment_id,
                    qa.department_id,
                    qa.desk_id,
                    qa.rule_id,
                    qa.assignment_method,

                    r.target_role,

                    d.department_name,

                    desk.desk_code,
                    desk.desk_name

                FROM public.tickets t

                LEFT JOIN public.query_assignments qa
                  ON qa.ticket_id = t.ticket_id
                 AND qa.is_current = TRUE

                LEFT JOIN public.routing_rules r
                  ON r.rule_id = qa.rule_id

                LEFT JOIN public.departments d
                  ON d.department_id = qa.department_id

                LEFT JOIN public.accounts_desks desk
                  ON desk.desk_id = qa.desk_id

                WHERE t.ticket_number = :ticket_number
                LIMIT 1
                FOR UPDATE OF t
                """
            ),
            {
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        if ticket is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found.",
            )

        if ticket["status"] != "ROUTED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only a ROUTED ticket can receive "
                    "automatic officer assignment."
                ),
            )

        if ticket["assignment_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The routed ticket has no current "
                    "assignment record."
                ),
            )

        if ticket["assigned_officer_id"] is not None:
            officer = db.execute(
                text(
                    """
                    SELECT
                        user_id,
                        full_name,
                        email,
                        role
                    FROM public.users
                    WHERE user_id = :user_id
                    LIMIT 1
                    """
                ),
                {
                    "user_id": ticket[
                        "assigned_officer_id"
                    ],
                },
            ).mappings().first()

            db.commit()

            return {
                "ticket_number": (
                    ticket["ticket_number"]
                ),
                "status": ticket["status"],
                "department_name": (
                    ticket["department_name"]
                ),
                "desk_code": ticket["desk_code"],
                "desk_name": ticket["desk_name"],
                "assigned_officer": (
                    officer["full_name"]
                    if officer
                    else None
                ),
                "assigned_officer_id": (
                    ticket["assigned_officer_id"]
                ),
                "assignment_status": (
                    "ALREADY_ASSIGNED"
                ),
            }

        target_role = ticket["target_role"]

        if target_role is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The current routing rule has no "
                    "target role."
                ),
            )

        officer = db.execute(
            text(
                """
                SELECT
                    u.user_id,
                    u.full_name,
                    u.email,
                    u.role,
                    u.department_id,
                    u.desk_id,

                    COUNT(
                        active_assignment.assignment_id
                    ) FILTER (
                        WHERE active_ticket.ticket_id
                              IS NOT NULL
                    ) AS active_workload

                FROM public.users u

                LEFT JOIN public.query_assignments
                    active_assignment
                  ON active_assignment.assigned_user_id =
                     u.user_id
                 AND active_assignment.is_current = TRUE

                LEFT JOIN public.tickets active_ticket
                  ON active_ticket.ticket_id =
                     active_assignment.ticket_id
                 AND active_ticket.status NOT IN (
                     'DRAFT',
                     'RESOLVED',
                     'CLOSED'
                 )

                WHERE u.role = :target_role
                  AND u.is_active = TRUE
                  AND u.is_available = TRUE

                  AND (
                        :target_role = 'ADMIN'
                        OR u.department_id =
                           :department_id
                  )

                  AND (
                        CAST(:desk_id AS uuid) IS NULL
                        OR u.desk_id =
                           CAST(:desk_id AS uuid)
                  )

                GROUP BY
                    u.user_id,
                    u.full_name,
                    u.email,
                    u.role,
                    u.department_id,
                    u.desk_id,
                    u.created_at

                ORDER BY
                    COUNT(
                        active_assignment.assignment_id
                    ) FILTER (
                        WHERE active_ticket.ticket_id
                              IS NOT NULL
                    ) ASC,
                    u.created_at ASC,
                    u.user_id ASC

                LIMIT 1
                """
            ),
            {
                "target_role": target_role,
                "department_id": (
                    ticket["department_id"]
                ),
                "desk_id": ticket["desk_id"],
            },
        ).mappings().first()

        if officer is None:
            db.commit()

            return {
                "ticket_number": (
                    ticket["ticket_number"]
                ),
                "status": ticket["status"],
                "department_name": (
                    ticket["department_name"]
                ),
                "desk_code": ticket["desk_code"],
                "desk_name": ticket["desk_name"],
                "assigned_officer": None,
                "assigned_officer_id": None,
                "assignment_status": (
                    "WAITING_FOR_AVAILABLE_OFFICER"
                ),
            }

        db.execute(
            text(
                """
                UPDATE public.query_assignments
                SET is_current = FALSE
                WHERE assignment_id = :assignment_id
                  AND is_current = TRUE
                """
            ),
            {
                "assignment_id": (
                    ticket["assignment_id"]
                ),
            },
        )

        db.execute(
            text(
                """
                INSERT INTO public.query_assignments (
                    ticket_id,
                    department_id,
                    desk_id,
                    assigned_user_id,
                    assigned_by_user_id,
                    rule_id,
                    assignment_method,
                    assignment_reason,
                    is_current
                )
                VALUES (
                    :ticket_id,
                    :department_id,
                    :desk_id,
                    :assigned_user_id,
                    NULL,
                    :rule_id,
                    :assignment_method,
                    :assignment_reason,
                    TRUE
                )
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
                "department_id": (
                    ticket["department_id"]
                ),
                "desk_id": ticket["desk_id"],
                "assigned_user_id": (
                    officer["user_id"]
                ),
                "rule_id": ticket["rule_id"],
                "assignment_method": (
                    ticket["assignment_method"]
                ),
                "assignment_reason": (
                    "Automatic workload-aware "
                    "assignment to an available "
                    "authorized user."
                ),
            },
        )

        updated_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    assigned_officer_id =
                        :officer_id,
                    updated_at = NOW()
                WHERE ticket_id = :ticket_id
                  AND status = 'ROUTED'
                RETURNING ticket_id
                """
            ),
            {
                "officer_id": officer["user_id"],
                "ticket_id": ticket["ticket_id"],
            },
        ).first()

        if updated_ticket is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Ticket state changed during "
                    "officer assignment."
                ),
            )

        db.execute(
            text(
                """
                INSERT INTO public.audit_logs (
                    actor_service,
                    action,
                    entity_type,
                    entity_id,
                    details
                )
                VALUES (
                    'processing_pipeline',
                    'TICKET_OFFICER_ASSIGNED',
                    'TICKET',
                    :ticket_id,
                    CAST(:details AS jsonb)
                )
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
                "details": json.dumps(
                    {
                        "assigned_user_id": str(
                            officer["user_id"]
                        ),
                        "assigned_user": (
                            officer["full_name"]
                        ),
                        "target_role": target_role,
                        "department": (
                            ticket["department_name"]
                        ),
                        "desk": ticket["desk_name"],
                        "active_workload_before_assignment": (
                            int(
                                officer[
                                    "active_workload"
                                ]
                            )
                        ),
                    }
                ),
            },
        )

        db.commit()

        return {
            "ticket_number": (
                ticket["ticket_number"]
            ),
            "status": ticket["status"],
            "department_name": (
                ticket["department_name"]
            ),
            "desk_code": ticket["desk_code"],
            "desk_name": ticket["desk_name"],
            "assigned_officer": (
                officer["full_name"]
            ),
            "assigned_officer_id": (
                officer["user_id"]
            ),
            "assignment_status": "ASSIGNED",
        }

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Officer assignment failed.",
        ) from exc

    finally:
        db.close()