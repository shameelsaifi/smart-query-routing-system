from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.schemas.ticket import TicketCreate
from app.services.ticket_access_service import (
    TICKET_FROM,
    actor_parameters,
    load_ticket_actor,
    record_ticket_change,
)


def create_ticket(
    current_user: dict[str, Any],
    ticket_data: TicketCreate,
) -> dict[str, Any]:
    subject = ticket_data.subject.strip()
    message = ticket_data.message.strip()
    if not subject or not message:
        raise HTTPException(422, "Subject and message are required.")

    try:
        with SessionLocal.begin() as db:
            actor = load_ticket_actor(db, current_user, "STUDENT")
            row = db.execute(text("""
                INSERT INTO public.tickets (
                    student_id, subject, message, source, status, submitted_at
                )
                VALUES (
                    CAST(:student_id AS UUID), :subject, :message,
                    'WEB', 'PENDING', clock_timestamp()
                )
                RETURNING
                    ticket_id::text AS ticket_id, ticket_number,
                    subject, message, source, status, submitted_at
            """), {
                "student_id": actor["user_id"],
                "subject": subject,
                "message": message,
            }).mappings().first()

            if row is None:
                raise HTTPException(500, "Ticket could not be created.")
            ticket = dict(row)
            record_ticket_change(
                db, actor["user_id"], None, ticket,
                "TICKET_SUBMITTED", "Query submitted via web.",
                ticket["submitted_at"],
            )
        return ticket

    except SQLAlchemyError as exc:
        raise HTTPException(503, "Ticket creation is temporarily unavailable.") from exc


def get_assigned_tickets(
    current_user: dict[str, Any],
) -> list[dict[str, Any]]:
    try:
        with SessionLocal() as db:
            actor = load_ticket_actor(db, current_user, "DEPARTMENT_STAFF")
            rows = db.execute(text("""
                SELECT
                    t.ticket_id::text AS ticket_id,
                    t.ticket_number, t.subject, t.message,
                    t.category, t.priority, t.confidence, t.status, t.source,
                    t.ai_intent, t.ai_summary, t.ai_draft_reply,
                    t.requires_manual_review, t.processing_method,
                    t.created_at, t.submitted_at, t.sla_due_at, t.resolved_at,
                    student.full_name AS student_name,
                    desk.desk_code, desk.desk_name
            """ + TICKET_FROM + """
                JOIN public.users student ON student.user_id = t.student_id
                WHERE t.assigned_officer_id = CAST(:actor_id AS UUID)
                  AND desk.department_id = CAST(:department_id AS UUID)
                  AND t.routed_desk_id = CAST(:desk_id AS UUID)
                  AND t.status <> 'DRAFT'
                ORDER BY t.created_at DESC, t.ticket_number DESC
            """), actor_parameters(actor)).mappings().all()
            return [dict(row) for row in rows]

    except SQLAlchemyError as exc:
        raise HTTPException(503, "Assigned tickets are temporarily unavailable.") from exc