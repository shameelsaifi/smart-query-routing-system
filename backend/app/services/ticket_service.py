from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.schemas.ticket import TicketCreate


def create_ticket(
    current_user: dict[str, Any],
    ticket_data: TicketCreate,
) -> dict[str, Any]:
    student_id = current_user.get("user_id")

    if not student_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user profile is incomplete.",
        )

    subject = ticket_data.subject.strip()
    message = ticket_data.message.strip()

    if not subject or not message:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Subject and message are required.",
        )

    db = SessionLocal()

    try:
        ticket = db.execute(
            text(
                """
                INSERT INTO public.tickets (
                    student_id,
                    subject,
                    message,
                    source,
                    status
                )
                VALUES (
                    CAST(:student_id AS UUID),
                    :subject,
                    :message,
                    'WEB',
                    'PENDING'
                )
                RETURNING
                    ticket_id::text AS ticket_id,
                    ticket_number,
                    subject,
                    message,
                    source,
                    status
                """
            ),
            {
                "student_id": student_id,
                "subject": subject,
                "message": message,
            },
        ).mappings().first()

        if ticket is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ticket could not be created.",
            )

        db.commit()

        return dict(ticket)

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket creation failed.",
        ) from exc

    finally:
        db.close()


def get_assigned_tickets(
    current_user: dict[str, Any],
) -> list[dict[str, Any]]:
    officer_id = current_user.get("user_id")

    if not officer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user profile is incomplete.",
        )

    db = SessionLocal()

    try:
        tickets = db.execute(
            text(
                """
                SELECT
                    t.ticket_id::text AS ticket_id,
                    t.ticket_number,
                    t.subject,
                    t.message,
                    t.category,
                    t.priority,
                    t.confidence,
                    t.status,
                    t.source,
                    t.ai_intent,
                    t.ai_summary,
                    t.ai_draft_reply,
                    t.requires_manual_review,
                    t.processing_method,
                    t.created_at,
                    s.full_name AS student_name,
                    ad.desk_code,
                    ad.desk_name
                FROM public.tickets t
                JOIN public.users s
                    ON s.user_id = t.student_id
                LEFT JOIN public.accounts_desks ad
                    ON ad.desk_id = t.routed_desk_id
                WHERE t.assigned_officer_id =
                    CAST(:officer_id AS UUID)
                ORDER BY t.created_at DESC
                """
            ),
            {
                "officer_id": officer_id,
            },
        ).mappings().all()

        return [
            dict(ticket)
            for ticket in tickets
        ]

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Assigned tickets could not be loaded.",
        ) from exc

    finally:
        db.close()