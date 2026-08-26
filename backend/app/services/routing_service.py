from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


CATEGORY_TO_DESK = {
    "Fee Verification & Billing": "FEE_BILLING",
    "Scholarship": "SCHOLARSHIP",
    "Refunds": "REFUNDS",
}


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

        category = ticket["category"]

        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticket must be classified before routing.",
            )

        desk_code = CATEGORY_TO_DESK.get(category)

        if desk_code is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No routing rule exists for this category.",
            )

        desk = db.execute(
            text(
                """
                SELECT
                    desk_id,
                    desk_code,
                    desk_name
                FROM public.accounts_desks
                WHERE desk_code = :desk_code
                  AND is_active = TRUE
                LIMIT 1
                """
            ),
            {
                "desk_code": desk_code,
            },
        ).mappings().first()

        if desk is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Routing desk not found.",
            )

        routed_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    routed_desk_id = :desk_id,
                    status = 'ROUTED',
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
                "desk_id": desk["desk_id"],
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        db.commit()

        return {
            **dict(routed_ticket),
            "desk_code": desk["desk_code"],
            "desk_name": desk["desk_name"],
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