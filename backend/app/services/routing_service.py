import json
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


def route_ticket(
    ticket_number: str,
) -> dict[str, Any]:
    db = SessionLocal()

    try:
        ticket = db.execute(
            text(
                """
                SELECT
                    ticket_id,
                    ticket_number,
                    category,
                    category_id,
                    status,
                    processing_method
                FROM public.tickets
                WHERE ticket_number = :ticket_number
                LIMIT 1
                FOR UPDATE
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

        if ticket["status"] != "CLASSIFIED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only a CLASSIFIED ticket can be routed."
                ),
            )

        route = db.execute(
            text(
                """
                SELECT
                    c.category_id,
                    c.category_code,
                    c.category_name,

                    r.rule_id,
                    r.rule_code,
                    r.department_id,
                    r.desk_id,
                    r.target_role,
                    r.priority_order,

                    d.department_name,

                    desk.desk_code,
                    desk.desk_name

                FROM public.query_categories c

                JOIN public.routing_rules r
                  ON r.category_id = c.category_id
                 AND r.is_active = TRUE

                JOIN public.departments d
                  ON d.department_id = r.department_id
                 AND d.is_active = TRUE

                LEFT JOIN public.accounts_desks desk
                  ON desk.desk_id = r.desk_id
                 AND desk.department_id = r.department_id
                 AND desk.is_active = TRUE

                WHERE c.is_active = TRUE
                  AND (
                        (
                            :category_id IS NOT NULL
                            AND c.category_id = :category_id
                        )
                        OR
                        (
                            :category_id IS NULL
                            AND c.category_name = :category_name
                        )
                  )

                ORDER BY
                    r.priority_order ASC,
                    r.rule_id ASC

                LIMIT 1
                """
            ),
            {
                "category_id": ticket["category_id"],
                "category_name": ticket["category"],
            },
        ).mappings().first()

        if route is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "No active database routing rule exists "
                    "for this classification."
                ),
            )

        assignment_method = (
            "AI_ASSISTED"
            if ticket["processing_method"] == "GEMINI_AI"
            else "RULE_BASED"
        )

        db.execute(
            text(
                """
                UPDATE public.query_assignments
                SET is_current = FALSE
                WHERE ticket_id = :ticket_id
                  AND is_current = TRUE
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
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
                    NULL,
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
                "department_id": route["department_id"],
                "desk_id": route["desk_id"],
                "rule_id": route["rule_id"],
                "assignment_method": assignment_method,
                "assignment_reason": (
                    "Initial destination selected from "
                    "the active database routing rule."
                ),
            },
        )

        routed_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    category = :category_name,
                    category_id = :category_id,
                    routed_desk_id = :desk_id,
                    assigned_officer_id = NULL,
                    status = 'ROUTED',
                    updated_at = NOW()
                WHERE ticket_id = :ticket_id
                  AND status = 'CLASSIFIED'
                RETURNING
                    ticket_number,
                    category,
                    category_id,
                    priority,
                    confidence,
                    status
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
                "category_name": route["category_name"],
                "category_id": route["category_id"],
                "desk_id": route["desk_id"],
            },
        ).mappings().first()

        if routed_ticket is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ticket state changed during routing.",
            )

        db.execute(
            text(
                """
                INSERT INTO public.query_status_history (
                    ticket_id,
                    changed_by_service,
                    previous_status,
                    new_status,
                    change_note
                )
                VALUES (
                    :ticket_id,
                    'processing_pipeline',
                    'CLASSIFIED',
                    'ROUTED',
                    :change_note
                )
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
                "change_note": (
                    f"Routed to {route['department_name']} "
                    f"using rule {route['rule_code']}."
                ),
            },
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
                    'TICKET_ROUTED',
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
                        "rule_code": route["rule_code"],
                        "category_code": route["category_code"],
                        "department": route["department_name"],
                        "desk": route["desk_name"],
                        "target_role": route["target_role"],
                    }
                ),
            },
        )

        db.commit()

        return {
            **dict(routed_ticket),
            "rule_id": route["rule_id"],
            "rule_code": route["rule_code"],
            "department_id": route["department_id"],
            "department_name": route["department_name"],
            "desk_id": route["desk_id"],
            "desk_code": route["desk_code"],
            "desk_name": route["desk_name"],
            "target_role": route["target_role"],
            "assignment_method": assignment_method,
        }

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket routing failed.",
        ) from exc

    finally:
        db.close()