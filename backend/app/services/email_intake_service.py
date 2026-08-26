from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.schemas.email_intake import SimulatedEmailCreate


def create_email_ticket(
    email_data: SimulatedEmailCreate,
) -> dict[str, Any]:
    sender_email = email_data.sender_email.strip().lower()
    subject = email_data.subject.strip()
    message = email_data.message.strip()

    if not sender_email or not subject or not message:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Sender email, subject and message are required.",
        )

    db = SessionLocal()

    try:
        student = db.execute(
            text(
                """
                SELECT
                    user_id,
                    email,
                    full_name,
                    role
                FROM public.users
                WHERE email = :email
                  AND role = 'STUDENT'
                  AND is_active = TRUE
                LIMIT 1
                """
            ),
            {
                "email": sender_email,
            },
        ).mappings().first()

        if student is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sender is not an approved active student.",
            )

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
                    :student_id,
                    :subject,
                    :message,
                    'EMAIL',
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
                "student_id": student["user_id"],
                "subject": subject,
                "message": message,
            },
        ).mappings().first()

        if ticket is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email ticket could not be created.",
            )

        db.commit()

        return {
            **dict(ticket),
            "sender_email": sender_email,
        }

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email intake failed.",
        ) from exc

    finally:
        db.close()