from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


def start_ticket(
    ticket_number: str,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    officer_id = current_user.get("user_id")

    if not officer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user profile is incomplete.",
        )

    db = SessionLocal()

    try:
        ticket = db.execute(
            text(
                """
                SELECT
                    ticket_number,
                    assigned_officer_id::text AS assigned_officer_id,
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

        if ticket["assigned_officer_id"] != officer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This ticket is not assigned to you.",
            )

        if ticket["status"] != "ROUTED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only routed tickets can be moved "
                    "to in-progress."
                ),
            )

        updated_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    status = 'IN_PROGRESS',
                    updated_at = NOW()
                WHERE ticket_number = :ticket_number
                RETURNING
                    ticket_number,
                    subject,
                    category,
                    priority,
                    confidence,
                    status
                """
            ),
            {
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        db.commit()

        return dict(updated_ticket)

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket status could not be updated.",
        ) from exc

    finally:
        db.close()


def resolve_ticket(
    ticket_number: str,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    officer_id = current_user.get("user_id")

    if not officer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user profile is incomplete.",
        )

    db = SessionLocal()

    try:
        ticket = db.execute(
            text(
                """
                SELECT
                    ticket_number,
                    assigned_officer_id::text AS assigned_officer_id,
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

        if ticket["assigned_officer_id"] != officer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This ticket is not assigned to you.",
            )

        if ticket["status"] != "IN_PROGRESS":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only in-progress tickets can be resolved."
                ),
            )

        updated_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    status = 'RESOLVED',
                    updated_at = NOW()
                WHERE ticket_number = :ticket_number
                RETURNING
                    ticket_number,
                    subject,
                    category,
                    priority,
                    confidence,
                    status
                """
            ),
            {
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        db.commit()

        return dict(updated_ticket)

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket could not be resolved.",
        ) from exc

    finally:
        db.close()