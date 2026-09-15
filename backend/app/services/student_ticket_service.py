from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.schemas.student_ticket import StudentTicketFilters, StudentTicketPage
from app.services.ticket_access_service import load_ticket_actor


def get_student_tickets(
    current_user: dict[str, Any],
    filters: StudentTicketFilters,
) -> StudentTicketPage:
    try:
        with SessionLocal() as db:
            actor = load_ticket_actor(db, current_user, "STUDENT")
            conditions = ["t.student_id = CAST(:student_id AS UUID)"]
            parameters = {
                "student_id": actor["user_id"],
                "page": filters.page,
                "page_size": filters.page_size,
            }

            if filters.search:
                escaped = (
                    filters.search.replace("!", "!!")
                    .replace("%", "!%")
                    .replace("_", "!_")
                )
                conditions.append(
                    "(t.ticket_number ILIKE :search ESCAPE '!' "
                    "OR t.subject ILIKE :search ESCAPE '!')"
                )
                parameters["search"] = "%" + escaped + "%"

            if filters.status:
                conditions.append("t.status = :status")
                parameters["status"] = filters.status

            if filters.source:
                conditions.append("t.source = :source")
                parameters["source"] = filters.source

            # One SQL statement keeps the count and page on the same snapshot.
            sql = """
                WITH matching AS MATERIALIZED (
                    SELECT
                        t.ticket_id::text AS ticket_id,
                        t.ticket_number, t.subject, t.status, t.source,
                        t.category, t.priority,
                        d.department_name, desk.desk_name,
                        t.created_at, t.submitted_at, t.updated_at
                    FROM public.tickets t
                    LEFT JOIN public.accounts_desks desk
                      ON desk.desk_id = t.routed_desk_id
                    LEFT JOIN public.departments d
                      ON d.department_id = desk.department_id
                    WHERE """ + " AND ".join(conditions) + """
                ),
                totals AS (
                    SELECT COUNT(*) AS total FROM matching
                ),
                paging AS (
                    SELECT
                        total,
                        GREATEST(
                            1,
                            (total + CAST(:page_size AS INTEGER) - 1)
                            / CAST(:page_size AS INTEGER)
                        ) AS total_pages
                    FROM totals
                ),
                bounds AS (
                    SELECT
                        total, total_pages,
                        LEAST(CAST(:page AS INTEGER), total_pages) AS page
                    FROM paging
                )
                SELECT
                    total, page, total_pages,
                    COALESCE((
                        SELECT jsonb_agg(
                            to_jsonb(item)
                            ORDER BY item.created_at DESC, item.ticket_number DESC
                        )
                        FROM (
                            SELECT * FROM matching
                            ORDER BY created_at DESC, ticket_number DESC
                            LIMIT CAST(:page_size AS INTEGER)
                            OFFSET (
                                SELECT (page - 1) * CAST(:page_size AS INTEGER)
                                FROM bounds
                            )
                        ) AS item
                    ), '[]'::jsonb) AS items
                FROM bounds
            """
            row = db.execute(text(sql), parameters).mappings().one()
            return StudentTicketPage.model_validate({
                **dict(row),
                "page_size": filters.page_size,
            })

    except SQLAlchemyError as exc:
        raise HTTPException(
            503, "Ticket history is temporarily unavailable. Please try again."
        ) from exc