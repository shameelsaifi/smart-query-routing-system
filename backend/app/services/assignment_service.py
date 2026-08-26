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
                    ticket_id,
                    ticket_number,
                    routed_desk_id,
                    status
                FROM public.tickets
                WHERE ticket_number = :ticket_number
                LIMIT 1
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

        if ticket["routed_desk_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticket must be routed before officer assignment.",
            )

        officer = db.execute(
            text(
                """
                SELECT
                    user_id,
                    full_name,
                    email,
                    role,
                    desk_id
                FROM public.users
                WHERE desk_id = :desk_id
                  AND role = 'DEPARTMENT_STAFF'
                  AND is_active = TRUE
                  AND is_available = TRUE
                ORDER BY created_at ASC
                LIMIT 1
                """
            ),
            {
                "desk_id": ticket["routed_desk_id"],
            },
        ).mappings().first()

        if officer is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No available officer found for this desk.",
            )

        assigned_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    assigned_officer_id = :officer_id,
                    updated_at = NOW()
                WHERE ticket_number = :ticket_number
                RETURNING
                    ticket_number,
                    category,
                    priority,
                    confidence,
                    status
                """
            ),
            {
                "officer_id": officer["user_id"],
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        desk = db.execute(
            text(
                """
                SELECT
                    desk_code,
                    desk_name
                FROM public.accounts_desks
                WHERE desk_id = :desk_id
                LIMIT 1
                """
            ),
            {
                "desk_id": ticket["routed_desk_id"],
            },
        ).mappings().first()

        db.commit()

        return {
            **dict(assigned_ticket),
            "desk_code": desk["desk_code"],
            "desk_name": desk["desk_name"],
            "assigned_officer": officer["full_name"],
        }

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Officer assignment failed.",
        ) from exc

    finally:
        db.close()