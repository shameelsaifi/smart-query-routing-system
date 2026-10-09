import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.services.ticket_access_service import (
    load_ticket_actor,
    lock_accessible_ticket,
)


def _clean_email_reply(value: str | None) -> str:
    text_value = (value or "").strip()

    if not text_value:
        return ""

    quoted = re.search(
        r"\nOn .+?wrote:\s*(?:\n|$)",
        text_value,
        flags=re.IGNORECASE | re.DOTALL,
    )

    if quoted is not None:
        text_value = text_value[:quoted.start()].strip()

    return text_value


def _load_accessible_ticket(
    db,
    current_user: dict[str, Any],
    ticket_number: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    actor = load_ticket_actor(
        db,
        current_user,
        "STUDENT",
        "DEPARTMENT_STAFF",
        "INSTRUCTOR",
    )

    if actor["role"] == "STUDENT":
        ticket = db.execute(
            text(
                """
                SELECT
                    ticket_id::text AS ticket_id,
                    ticket_number,
                    student_id::text AS student_id,
                    status
                FROM public.tickets
                WHERE ticket_number = :ticket_number
                  AND student_id = CAST(:student_id AS UUID)
                LIMIT 1
                """
            ),
            {
                "ticket_number": ticket_number,
                "student_id": actor["user_id"],
            },
        ).mappings().first()

        if ticket is None:
            raise HTTPException(
                status_code=404,
                detail="Ticket not found or not accessible.",
            )

        return actor, dict(ticket)

    ticket = lock_accessible_ticket(
        db,
        ticket_number,
        actor,
    )

    return actor, dict(ticket)


def get_information_exchange(
    current_user: dict[str, Any],
    ticket_number: str,
) -> dict[str, Any]:
    try:
        with SessionLocal() as db:
            actor, ticket = _load_accessible_ticket(
                db,
                current_user,
                ticket_number,
            )

            request_rows = db.execute(
                text(
                    """
                    SELECT
                        r.response_id::text AS event_id,
                        r.final_response_text AS message,
                        r.created_at,
                        r.sent_at,
                        responder.full_name AS author_name
                    FROM public.responses r
                    LEFT JOIN public.users responder
                      ON responder.user_id = r.responder_id
                    WHERE r.ticket_id = CAST(:ticket_id AS UUID)
                      AND r.response_type = 'INFORMATION_REQUEST'
                      AND r.approval_status = 'APPROVED'
                      AND r.delivery_status = 'SENT'
                    ORDER BY COALESCE(r.sent_at, r.created_at), r.response_id
                    """
                ),
                {"ticket_id": ticket["ticket_id"]},
            ).mappings().all()

            reply_rows = db.execute(
                text(
                    """
                    SELECT
                        a.audit_id::text AS event_id,
                        a.details ->> 'message' AS message,
                        a.details ->> 'channel' AS channel,
                        a.created_at,
                        student.full_name AS author_name
                    FROM public.audit_logs a
                    LEFT JOIN public.users student
                      ON student.user_id = a.actor_user_id
                    WHERE a.entity_type = 'TICKET'
                      AND a.entity_id = CAST(:ticket_id AS UUID)
                      AND a.action = 'STUDENT_INFORMATION_REPLY_RECEIVED'
                      AND a.outcome = 'SUCCESS'
                    ORDER BY a.created_at, a.event_sequence
                    """
                ),
                {"ticket_id": ticket["ticket_id"]},
            ).mappings().all()

            items: list[dict[str, Any]] = []

            for row in request_rows:
                message = (row["message"] or "").strip()

                if not message:
                    continue

                items.append(
                    {
                        "event_id": f"request:{row['event_id']}",
                        "kind": "INFORMATION_REQUEST",
                        "direction": "STAFF_TO_STUDENT",
                        "author_role": "STAFF",
                        "author_name": row["author_name"] or "University Staff",
                        "channel": "GMAIL",
                        "message": message,
                        "created_at": row["sent_at"] or row["created_at"],
                    }
                )

            for row in reply_rows:
                message = _clean_email_reply(row["message"])

                if not message:
                    continue

                items.append(
                    {
                        "event_id": f"reply:{row['event_id']}",
                        "kind": "INFORMATION_REPLY",
                        "direction": "STUDENT_TO_STAFF",
                        "author_role": "STUDENT",
                        "author_name": row["author_name"] or "Student",
                        "channel": (row["channel"] or "GMAIL").upper(),
                        "message": message,
                        "created_at": row["created_at"],
                    }
                )

            items.sort(key=lambda item: item["created_at"])

            return {
                "ticket_number": ticket["ticket_number"],
                "ticket_status": ticket["status"],
                "viewer_role": actor["role"],
                "items": items,
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Information exchange is temporarily unavailable. "
                "Please try again."
            ),
        ) from exc
