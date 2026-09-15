from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.schemas.student_ticket_detail import (
    StudentTicketDetailFilters,
    StudentTicketDetails,
)
from app.services.ticket_access_service import load_ticket_actor


HISTORY_PAGE_SIZE = 20


def get_student_ticket_details(
    current_user: dict[str, Any],
    ticket_number: str,
    filters: StudentTicketDetailFilters,
) -> StudentTicketDetails:
    try:
        with SessionLocal() as db:
            actor = load_ticket_actor(db, current_user, "STUDENT")

            row = db.execute(
                text("""
                    WITH owned_ticket AS MATERIALIZED (
                        SELECT
                            t.ticket_id,
                            t.ticket_number,
                            t.subject,
                            t.message,
                            t.status,
                            t.source,
                            t.category,
                            t.priority,
                            d.department_name,
                            desk.desk_name,
                            t.created_at,
                            t.submitted_at,
                            t.updated_at,
                            t.sla_due_at,
                            t.resolved_at,
                            t.closed_at
                        FROM public.tickets t
                        LEFT JOIN public.accounts_desks desk
                          ON desk.desk_id = t.routed_desk_id
                        LEFT JOIN public.departments d
                          ON d.department_id = desk.department_id
                        WHERE t.student_id = CAST(:student_id AS UUID)
                          AND t.ticket_number = :ticket_number
                    ),
                    events AS (
                        SELECT
                            h.history_id,
                            h.event_sequence,
                            h.previous_status,
                            h.new_status,
                            h.changed_at
                        FROM public.query_status_history h
                        JOIN owned_ticket t
                          ON t.ticket_id = h.ticket_id
                        WHERE (
                            CAST(:before_sequence AS BIGINT) IS NULL
                            OR h.event_sequence
                               < CAST(:before_sequence AS BIGINT)
                        )
                        ORDER BY h.event_sequence DESC
                        LIMIT :event_limit
                    )
                    SELECT
                        to_jsonb(t) AS ticket,
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'history_id',
                                        e.history_id::text,
                                        'sequence',
                                        e.event_sequence::text,
                                        'previous_status',
                                        e.previous_status,
                                        'new_status',
                                        e.new_status,
                                        'changed_at',
                                        e.changed_at
                                    )
                                    ORDER BY e.event_sequence DESC
                                )
                                FROM events e
                            ),
                            '[]'::jsonb
                        ) AS history
                    FROM owned_ticket t
                """),
                {
                    "student_id": actor["user_id"],
                    "ticket_number": ticket_number,
                    "before_sequence": filters.before_sequence,
                    "event_limit": HISTORY_PAGE_SIZE + 1,
                },
            ).mappings().one_or_none()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Ticket not found or not accessible.",
                )

            events = row["history"]
            visible_events = events[:HISTORY_PAGE_SIZE]

            next_before = (
                visible_events[-1]["sequence"]
                if len(events) > HISTORY_PAGE_SIZE
                else None
            )

            return StudentTicketDetails.model_validate(
                {
                    "ticket": row["ticket"],
                    "history": visible_events,
                    "next_before_sequence": next_before,
                }
            )

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Ticket details are temporarily unavailable. "
                "Please try again."
            ),
        ) from exc