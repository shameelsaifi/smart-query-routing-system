from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.services.ticket_access_service import (
    load_ticket_actor,
    lock_accessible_ticket,
    record_ticket_change,
)


MANUAL_ESCALATION_STATUSES = {
    "ROUTED",
    "IN_PROGRESS",
    "NEEDS_INFORMATION",
}


def escalate_ticket_to_hod(
    ticket_number: str,
    current_user: dict[str, Any],
    reason: str,
) -> dict[str, Any]:
    cleaned_reason = (
        reason.strip()
        if isinstance(reason, str)
        else ""
    )

    if len(cleaned_reason) < 5:
        raise HTTPException(
            422,
            "Escalation reason must be at least 5 characters.",
        )

    if len(cleaned_reason) > 500:
        raise HTTPException(
            422,
            "Escalation reason cannot exceed 500 characters.",
        )

    try:
        with SessionLocal.begin() as db:
            actor = load_ticket_actor(
                db,
                current_user,
                "DEPARTMENT_STAFF",
                "INSTRUCTOR",
            )

            ticket = lock_accessible_ticket(
                db,
                ticket_number,
                actor,
            )

            if ticket["status"] not in MANUAL_ESCALATION_STATUSES:
                if ticket["status"] == "ESCALATED":
                    raise HTTPException(
                        409,
                        "This query is already escalated.",
                    )

                raise HTTPException(
                    409,
                    (
                        "Only routed, in-progress, or information-waiting "
                        "queries can be manually escalated to the HOD."
                    ),
                )

            department_id = ticket.get(
                "ticket_department_id"
            )

            if not department_id:
                raise HTTPException(
                    409,
                    "This query does not have a department for HOD escalation.",
                )

            active_escalation = db.execute(
                text(
                    """
                    SELECT
                        escalation_id::text AS escalation_id,
                        target_role,
                        escalation_status
                    FROM public.escalations
                    WHERE ticket_id = CAST(:ticket_id AS UUID)
                      AND escalation_status IN ('OPEN', 'ACKNOWLEDGED')
                    ORDER BY escalated_at DESC, escalation_id DESC
                    LIMIT 1
                    FOR UPDATE
                    """
                ),
                {
                    "ticket_id": str(ticket["ticket_id"]),
                },
            ).mappings().first()

            if active_escalation is not None:
                raise HTTPException(
                    409,
                    (
                        "This query already has an active escalation to "
                        f"{active_escalation['target_role']}."
                    ),
                )

            hod = db.execute(
                text(
                    """
                    SELECT
                        user_id::text AS user_id,
                        full_name,
                        email,
                        department_id::text AS department_id
                    FROM public.users
                    WHERE role = 'HOD'
                      AND is_active = TRUE
                      AND department_id = CAST(:department_id AS UUID)
                    ORDER BY created_at, user_id
                    LIMIT 1
                    """
                ),
                {
                    "department_id": str(department_id),
                },
            ).mappings().first()

            if hod is None:
                raise HTTPException(
                    409,
                    (
                        "No active HOD is configured for this department. "
                        "Assign an active HOD before escalating this query."
                    ),
                )

            event_at = db.execute(
                text("SELECT clock_timestamp()")
            ).scalar_one()

            updated_row = db.execute(
                text(
                    """
                    UPDATE public.tickets
                    SET
                        status = 'ESCALATED',
                        updated_at = :event_at
                    WHERE ticket_id = CAST(:ticket_id AS UUID)
                    RETURNING
                        ticket_id::text AS ticket_id,
                        ticket_number,
                        subject,
                        category,
                        priority,
                        confidence,
                        status,
                        assigned_officer_id::text AS assigned_officer_id,
                        routed_desk_id::text AS routed_desk_id,
                        resolved_at,
                        updated_at
                    """
                ),
                {
                    "ticket_id": str(ticket["ticket_id"]),
                    "event_at": event_at,
                },
            ).mappings().first()

            if updated_row is None:
                raise HTTPException(
                    409,
                    "Ticket state changed during escalation. Please refresh and retry.",
                )

            updated = dict(updated_row)
            escalation_event_key = (
                "staff-hod:"
                + str(uuid4())
            )

            escalation = db.execute(
                text(
                    """
                    INSERT INTO public.escalations (
                        ticket_id,
                        department_id,
                        escalated_from_user_id,
                        escalated_to_user_id,
                        escalated_by_user_id,
                        escalated_by_service,
                        target_role,
                        escalation_type,
                        event_key,
                        reason,
                        escalation_status,
                        escalated_at,
                        acknowledged_at,
                        resolved_at
                    )
                    VALUES (
                        CAST(:ticket_id AS UUID),
                        CAST(:department_id AS UUID),
                        CAST(:from_user_id AS UUID),
                        CAST(:hod_user_id AS UUID),
                        CAST(:actor_id AS UUID),
                        NULL,
                        'HOD',
                        'MANUAL',
                        :event_key,
                        :reason,
                        'OPEN',
                        :event_at,
                        NULL,
                        NULL
                    )
                    RETURNING
                        escalation_id::text AS escalation_id,
                        target_role,
                        escalation_type,
                        escalation_status,
                        reason,
                        escalated_at
                    """
                ),
                {
                    "ticket_id": updated["ticket_id"],
                    "department_id": str(department_id),
                    "from_user_id": actor["user_id"],
                    "hod_user_id": hod["user_id"],
                    "actor_id": actor["user_id"],
                    "event_key": escalation_event_key,
                    "reason": cleaned_reason,
                    "event_at": event_at,
                },
            ).mappings().first()

            if escalation is None:
                raise HTTPException(
                    500,
                    "HOD escalation could not be created.",
                )

            record_ticket_change(
                db,
                actor["user_id"],
                ticket,
                updated,
                "TICKET_ESCALATE_HOD",
                (
                    "Manual escalation to HOD: "
                    + cleaned_reason
                ),
                event_at,
            )

            return {
                **updated,
                "escalation_id": escalation["escalation_id"],
                "target_role": "HOD",
                "escalation_type": "MANUAL",
                "escalation_status": "OPEN",
                "escalation_reason": cleaned_reason,
                "escalated_at": escalation["escalated_at"],
                "escalated_to": {
                    "user_id": hod["user_id"],
                    "full_name": hod["full_name"],
                    "email": hod["email"],
                },
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            "Query escalation could not complete. Please try again.",
        ) from exc
