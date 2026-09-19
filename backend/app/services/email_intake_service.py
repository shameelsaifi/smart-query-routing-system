from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError,
)

from app.core.database import SessionLocal
from app.schemas.email_intake import (
    SimulatedEmailCreate,
)


def _load_existing_email_ticket(
    db,
    gmail_message_id: str,
) -> dict[str, Any] | None:
    ticket = db.execute(
        text(
            """
            SELECT
                t.ticket_id::text
                    AS ticket_id,

                t.ticket_number,

                t.inbound_message_id
                    AS gmail_message_id,

                u.email
                    AS sender_email,

                t.subject,
                t.message,
                t.source,
                t.status

            FROM public.tickets t

            JOIN public.users u
              ON u.user_id =
                 t.student_id

            WHERE t.source = 'EMAIL'

              AND t.inbound_message_id =
                  :gmail_message_id

            LIMIT 1
            """
        ),
        {
            "gmail_message_id":
                gmail_message_id,
        },
    ).mappings().first()

    if ticket is None:
        return None

    return {
        **dict(ticket),
        "duplicate": True,
    }


def create_email_ticket(
    email_data: SimulatedEmailCreate,
) -> dict[str, Any]:
    gmail_message_id = (
        email_data
        .gmail_message_id
        .strip()
    )

    sender_email = (
        email_data
        .sender_email
        .strip()
        .lower()
    )

    subject = (
        email_data
        .subject
        .strip()
    )

    message = (
        email_data
        .message
        .strip()
    )

    if (
        not gmail_message_id
        or not sender_email
        or not subject
        or not message
    ):
        raise HTTPException(
            status_code=(
                status
                .HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Gmail message ID, sender email, "
                "subject and message are required."
            ),
        )

    db = SessionLocal()

    try:
        existing_ticket = (
            _load_existing_email_ticket(
                db,
                gmail_message_id,
            )
        )

        if existing_ticket is not None:
            return existing_ticket

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

                  AND role =
                      'STUDENT'

                  AND is_active =
                      TRUE

                LIMIT 1
                """
            ),
            {
                "email":
                    sender_email,
            },
        ).mappings().first()

        if student is None:
            raise HTTPException(
                status_code=(
                    status
                    .HTTP_403_FORBIDDEN
                ),
                detail=(
                    "Sender is not an approved "
                    "active student."
                ),
            )

        ticket = db.execute(
            text(
                """
                INSERT INTO public.tickets (
                    student_id,
                    subject,
                    message,
                    source,
                    status,
                    inbound_message_id
                )
                VALUES (
                    :student_id,
                    :subject,
                    :message,
                    'EMAIL',
                    'PENDING',
                    :gmail_message_id
                )
                RETURNING
                    ticket_id::text
                        AS ticket_id,

                    ticket_number,

                    inbound_message_id
                        AS gmail_message_id,

                    subject,
                    message,
                    source,
                    status
                """
            ),
            {
                "student_id":
                    student["user_id"],

                "subject":
                    subject,

                "message":
                    message,

                "gmail_message_id":
                    gmail_message_id,
            },
        ).mappings().first()

        if ticket is None:
            raise HTTPException(
                status_code=(
                    status
                    .HTTP_500_INTERNAL_SERVER_ERROR
                ),
                detail=(
                    "Email ticket could not "
                    "be created."
                ),
            )

        db.commit()

        return {
            **dict(ticket),
            "sender_email":
                sender_email,
            "duplicate":
                False,
        }

    except IntegrityError as exc:
        db.rollback()

        # Another request may have created the
        # same Gmail message at the same time.
        existing_ticket = (
            _load_existing_email_ticket(
                db,
                gmail_message_id,
            )
        )

        if existing_ticket is not None:
            return existing_ticket

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Email intake could not "
                "be completed."
            ),
        ) from exc

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Email intake failed.",
        ) from exc

    finally:
        db.close()