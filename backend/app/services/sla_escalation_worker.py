
import asyncio
import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal


logger = logging.getLogger(__name__)


OPEN_SLA_STATUSES = {
    "PENDING",
    "CLASSIFIED",
    "ROUTED",
    "IN_PROGRESS",
    "NEEDS_INFORMATION",
}


def _load_due_ticket(
    db,
) -> dict[str, Any] | None:
    row = db.execute(
        text(
            """
            SELECT
                t.ticket_id::text AS ticket_id,
                t.ticket_number,
                t.status,
                t.assigned_officer_id::text
                    AS assigned_officer_id,
                t.sla_due_at,
                assigned_user.department_id::text
                    AS department_id

            FROM public.tickets t

            LEFT JOIN public.users assigned_user
              ON assigned_user.user_id =
                 t.assigned_officer_id

            WHERE t.status IN (
                'PENDING',
                'CLASSIFIED',
                'ROUTED',
                'IN_PROGRESS',
                'NEEDS_INFORMATION'
            )

              AND t.sla_due_at IS NOT NULL
              AND t.sla_due_at <= NOW()

              AND NOT EXISTS (
                  SELECT 1
                  FROM public.escalations e
                  WHERE e.ticket_id = t.ticket_id
                    AND (
                        e.escalation_status IN (
                            'OPEN',
                            'ACKNOWLEDGED'
                        )

                        OR e.event_key =
                           'sla-breach:' ||
                           t.ticket_id::text
                    )
              )

            ORDER BY
                t.sla_due_at ASC,
                t.created_at ASC,
                t.ticket_id ASC

            FOR UPDATE OF t
            SKIP LOCKED

            LIMIT 1
            """
        )
    ).mappings().first()

    if row is None:
        return None

    return dict(row)


def _find_hod(
    db,
    department_id: str | None,
    assigned_officer_id: str | None,
) -> str | None:
    if department_id is None:
        return None

    hod_id = db.execute(
        text(
            """
            SELECT
                u.user_id::text

            FROM public.users u

            WHERE u.role = 'HOD'
              AND u.department_id =
                  CAST(:department_id AS UUID)
              AND u.is_active = TRUE

              AND (
                  CAST(
                      :assigned_officer_id AS UUID
                  ) IS NULL

                  OR u.user_id <>
                     CAST(
                         :assigned_officer_id AS UUID
                     )
              )

            ORDER BY
                u.created_at ASC,
                u.user_id ASC

            LIMIT 1
            """
        ),
        {
            "department_id": department_id,
            "assigned_officer_id": assigned_officer_id,
        },
    ).scalar_one_or_none()

    if hod_id is None:
        return None

    return str(hod_id)


def _find_admin(
    db,
    assigned_officer_id: str | None,
) -> str | None:
    admin_id = db.execute(
        text(
            """
            SELECT
                u.user_id::text

            FROM public.users u

            WHERE u.role = 'ADMIN'
              AND u.is_active = TRUE

              AND (
                  CAST(
                      :assigned_officer_id AS UUID
                  ) IS NULL

                  OR u.user_id <>
                     CAST(
                         :assigned_officer_id AS UUID
                     )
              )

            ORDER BY
                u.created_at ASC,
                u.user_id ASC

            LIMIT 1
            """
        ),
        {
            "assigned_officer_id": assigned_officer_id,
        },
    ).scalar_one_or_none()

    if admin_id is None:
        return None

    return str(admin_id)


def process_one_due_ticket() -> bool:
    """
    Escalate one overdue unresolved ticket.

    Returns True when an escalation is created.

    Returns False when:
    - No eligible overdue ticket exists.
    - No valid escalation recipient exists.
    - The SLA breach event already exists.
    """

    try:
        with SessionLocal.begin() as db:
            ticket = _load_due_ticket(db)

            if ticket is None:
                return False

            ticket_id = ticket["ticket_id"]
            ticket_number = ticket["ticket_number"]
            previous_status = ticket["status"]

            assigned_officer_id = ticket[
                "assigned_officer_id"
            ]

            department_id = ticket["department_id"]

            event_at = db.execute(
                text("SELECT clock_timestamp()")
            ).scalar_one()

            target_user_id = _find_hod(
                db,
                department_id,
                assigned_officer_id,
            )

            if target_user_id is not None:
                target_role = "HOD"

            else:
                target_user_id = _find_admin(
                    db,
                    assigned_officer_id,
                )
                target_role = "ADMIN"

            if target_user_id is None:
                logger.warning(
                    "SLA breach found for ticket %s, "
                    "but no active HOD or ADMIN "
                    "recipient is available.",
                    ticket_number,
                )
                return False

            event_key = "sla-breach:" + ticket_id

            reason = (
                "Automatic SLA breach: ticket "
                "exceeded the 24-hour resolution "
                "window."
            )

            escalation_id = db.execute(
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
                        escalation_status
                    )

                    VALUES (
                        CAST(:ticket_id AS UUID),
                        CAST(:department_id AS UUID),
                        CAST(
                            :assigned_officer_id AS UUID
                        ),
                        CAST(:target_user_id AS UUID),
                        NULL,
                        'sla_escalation_worker',
                        :target_role,
                        'SLA_BREACH',
                        :event_key,
                        :reason,
                        'OPEN'
                    )

                    ON CONFLICT (event_key)
                    DO NOTHING

                    RETURNING escalation_id::text
                    """
                ),
                {
                    "ticket_id": ticket_id,
                    "department_id": department_id,
                    "assigned_officer_id": (
                        assigned_officer_id
                    ),
                    "target_user_id": target_user_id,
                    "target_role": target_role,
                    "event_key": event_key,
                    "reason": reason,
                },
            ).scalar_one_or_none()

            if escalation_id is None:
                logger.info(
                    "SLA breach event already exists "
                    "for ticket %s. Skipping.",
                    ticket_number,
                )
                return False

            updated = db.execute(
                text(
                    """
                    UPDATE public.tickets

                    SET
                        status = 'ESCALATED',
                        updated_at = :event_at

                    WHERE ticket_id =
                          CAST(:ticket_id AS UUID)

                      AND status = :previous_status

                    RETURNING ticket_id::text
                    """
                ),
                {
                    "ticket_id": ticket_id,
                    "previous_status": previous_status,
                    "event_at": event_at,
                },
            ).scalar_one_or_none()

            if updated is None:
                raise RuntimeError(
                    "Ticket status changed before "
                    "SLA escalation completed."
                )

            db.execute(
                text(
                    """
                    INSERT INTO
                        public.query_status_history
                    (
                        ticket_id,
                        changed_by_service,
                        previous_status,
                        new_status,
                        change_note,
                        changed_at
                    )

                    VALUES (
                        CAST(:ticket_id AS UUID),
                        'sla_escalation_worker',
                        :previous_status,
                        'ESCALATED',
                        :change_note,
                        :event_at
                    )
                    """
                ),
                {
                    "ticket_id": ticket_id,
                    "previous_status": previous_status,
                    "change_note": (
                        "Ticket automatically "
                        "escalated after exceeding "
                        "the 24-hour SLA. "
                        f"Escalation target: "
                        f"{target_role}."
                    ),
                    "event_at": event_at,
                },
            )

            logger.info(
                "Ticket %s automatically escalated "
                "to %s. Escalation ID: %s.",
                ticket_number,
                target_role,
                escalation_id,
            )

            return True

    except SQLAlchemyError:
        logger.exception(
            "Database failure while processing "
            "an SLA escalation."
        )
        raise


async def sla_escalation_worker_loop() -> None:
    logger.info(
        "SLA escalation worker started."
    )

    try:
        while True:
            try:
                processed = await asyncio.to_thread(
                    process_one_due_ticket
                )

            except Exception:
                logger.exception(
                    "Unexpected SLA escalation "
                    "worker iteration failure."
                )
                processed = False

            if processed:
                await asyncio.sleep(0)

            else:
                await asyncio.sleep(
                    settings.sla_escalation_poll_seconds
                )

    except asyncio.CancelledError:
        logger.info(
            "SLA escalation worker stopped."
        )
        raise
