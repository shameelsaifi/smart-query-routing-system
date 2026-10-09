import json
import re
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
from app.services.ticket_access_service import (
    record_ticket_change,
)


TICKET_NUMBER_PATTERN = re.compile(
    r"\b[A-Z]{2,10}-\d{1,20}\b",
    re.IGNORECASE,
)


def _extract_ticket_number(
    subject: str,
) -> str | None:
    match = TICKET_NUMBER_PATTERN.search(
        subject,
    )

    if match is None:
        return None

    return match.group(0).upper()


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


def _load_existing_information_reply(
    db,
    gmail_message_id: str,
    student_id: str,
) -> dict[str, Any] | None:
    row = db.execute(
        text(
            """
            SELECT
                t.ticket_id::text
                    AS ticket_id,

                t.ticket_number,

                :gmail_message_id
                    AS gmail_message_id,

                student.email
                    AS sender_email,

                COALESCE(
                    a.details ->> 'subject',
                    t.subject
                ) AS subject,

                COALESCE(
                    a.details ->> 'message',
                    t.message
                ) AS message,

                'EMAIL'::text
                    AS source,

                t.status

            FROM public.audit_logs a

            JOIN public.tickets t
              ON t.ticket_id =
                 a.entity_id

            JOIN public.users student
              ON student.user_id =
                 t.student_id

            WHERE
                a.action =
                    'STUDENT_INFORMATION_REPLY_RECEIVED'

                AND a.entity_type =
                    'TICKET'

                AND a.details ->> 'gmail_message_id'
                    = :gmail_message_id

                AND t.student_id =
                    CAST(
                        :student_id
                        AS UUID
                    )

            ORDER BY
                a.created_at DESC,
                a.event_sequence DESC

            LIMIT 1
            """
        ),
        {
            "gmail_message_id":
                gmail_message_id,

            "student_id":
                student_id,
        },
    ).mappings().first()

    if row is None:
        return None

    return {
        **dict(row),
        "duplicate": True,
    }


def _load_student(
    db,
    sender_email: str,
):
    return db.execute(
        text(
            """
            SELECT
                user_id::text
                    AS user_id,

                email,
                full_name,
                role

            FROM public.users

            WHERE lower(email) =
                  :email

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


def _load_information_reply_ticket(
    db,
    student_id: str,
    ticket_number: str,
):
    return db.execute(
        text(
            """
            SELECT
                t.ticket_id::text
                    AS ticket_id,

                t.ticket_number,
                t.status,

                t.assigned_officer_id::text
                    AS assigned_officer_id,

                t.routed_desk_id::text
                    AS routed_desk_id,

                t.resolved_at,

                request.response_id::text
                    AS information_request_id,

                request.delivery_status
                    AS information_request_delivery_status

            FROM public.tickets t

            LEFT JOIN LATERAL (
                SELECT
                    r.response_id,
                    r.delivery_status

                FROM public.responses r

                WHERE
                    r.ticket_id =
                        t.ticket_id

                    AND r.response_type =
                        'INFORMATION_REQUEST'

                ORDER BY
                    r.created_at DESC,
                    r.response_id DESC

                LIMIT 1
            ) request
              ON TRUE

            WHERE
                t.ticket_number =
                    :ticket_number

                AND t.student_id =
                    CAST(
                        :student_id
                        AS UUID
                    )

            LIMIT 1

            FOR UPDATE OF t
            """
        ),
        {
            "student_id":
                student_id,

            "ticket_number":
                ticket_number,
        },
    ).mappings().first()


def _record_information_reply(
    db,
    *,
    actor_id: str,
    ticket_id: str,
    information_request_id: str | None,
    gmail_message_id: str,
    sender_email: str,
    subject: str,
    message: str,
    event_at,
) -> None:
    details = {
        "gmail_message_id":
            gmail_message_id,

        "sender_email":
            sender_email,

        "subject":
            subject,

        "message":
            message,

        "information_request_id":
            information_request_id,

        "channel":
            "GMAIL",
    }

    db.execute(
        text(
            """
            INSERT INTO public.audit_logs (
                actor_user_id,
                action,
                entity_type,
                entity_id,
                outcome,
                old_values,
                new_values,
                details,
                created_at
            )
            VALUES (
                CAST(
                    :actor_user_id
                    AS UUID
                ),

                'STUDENT_INFORMATION_REPLY_RECEIVED',

                'TICKET',

                CAST(
                    :ticket_id
                    AS UUID
                ),

                'SUCCESS',

                NULL,
                NULL,

                CAST(
                    :details
                    AS JSONB
                ),

                :event_at
            )
            """
        ),
        {
            "actor_user_id":
                actor_id,

            "ticket_id":
                ticket_id,

            "details":
                json.dumps(
                    details,
                    default=str,
                ),

            "event_at":
                event_at,
        },
    )


def _handle_information_reply(
    db,
    *,
    student: dict[str, Any],
    ticket_number: str,
    gmail_message_id: str,
    sender_email: str,
    subject: str,
    message: str,
) -> dict[str, Any] | None:
    ticket_row = (
        _load_information_reply_ticket(
            db,
            student["user_id"],
            ticket_number,
        )
    )

    if ticket_row is None:
        return None

    ticket = dict(
        ticket_row,
    )

    if (
        ticket["status"]
        != "NEEDS_INFORMATION"
    ):
        return None

    if (
        ticket[
            "information_request_id"
        ]
        is None
    ):
        return None

    if (
        ticket[
            "information_request_delivery_status"
        ]
        != "SENT"
    ):
        return None

    event_at = db.execute(
        text(
            "SELECT clock_timestamp()"
        )
    ).scalar_one()

    updated_row = db.execute(
        text(
            """
            UPDATE public.tickets

            SET
                status =
                    'IN_PROGRESS',

                updated_at =
                    :event_at

            WHERE
                ticket_id =
                    CAST(
                        :ticket_id
                        AS UUID
                    )

                AND status =
                    'NEEDS_INFORMATION'

            RETURNING
                ticket_id::text
                    AS ticket_id,

                ticket_number,
                status,

                assigned_officer_id::text
                    AS assigned_officer_id,

                routed_desk_id::text
                    AS routed_desk_id,

                resolved_at
            """
        ),
        {
            "ticket_id":
                ticket["ticket_id"],

            "event_at":
                event_at,
        },
    ).mappings().first()

    if updated_row is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "The ticket is no longer waiting "
                "for additional information."
            ),
        )

    updated_ticket = dict(
        updated_row,
    )

    record_ticket_change(
        db,
        student["user_id"],
        ticket,
        updated_ticket,
        "STUDENT_INFORMATION_RECEIVED",
        (
            "Student supplied the requested "
            "information through Gmail."
        ),
        event_at,
    )

    _record_information_reply(
        db,
        actor_id=student[
            "user_id"
        ],
        ticket_id=ticket[
            "ticket_id"
        ],
        information_request_id=ticket[
            "information_request_id"
        ],
        gmail_message_id=(
            gmail_message_id
        ),
        sender_email=(
            sender_email
        ),
        subject=subject,
        message=message,
        event_at=event_at,
    )

    return {
        "ticket_id":
            ticket["ticket_id"],

        "ticket_number":
            ticket["ticket_number"],

        "gmail_message_id":
            gmail_message_id,

        "sender_email":
            sender_email,

        "subject":
            subject,

        "message":
            message,

        "source":
            "EMAIL",

        "status":
            updated_ticket[
                "status"
            ],

        "duplicate":
            False,
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

    student = None

    try:
        existing_ticket = (
            _load_existing_email_ticket(
                db,
                gmail_message_id,
            )
        )

        if existing_ticket is not None:
            return existing_ticket

        student = _load_student(
            db,
            sender_email,
        )

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

        student = dict(
            student,
        )

        existing_reply = (
            _load_existing_information_reply(
                db,
                gmail_message_id,
                student["user_id"],
            )
        )

        if existing_reply is not None:
            return existing_reply

        referenced_ticket_number = (
            _extract_ticket_number(
                subject,
            )
        )

        if referenced_ticket_number:
            information_reply = (
                _handle_information_reply(
                    db,
                    student=student,
                    ticket_number=(
                        referenced_ticket_number
                    ),
                    gmail_message_id=(
                        gmail_message_id
                    ),
                    sender_email=(
                        sender_email
                    ),
                    subject=subject,
                    message=message,
                )
            )

            if information_reply is not None:
                db.commit()

                return information_reply

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
                    CAST(
                        :student_id
                        AS UUID
                    ),
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
                    student[
                        "user_id"
                    ],

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

        existing_ticket = (
            _load_existing_email_ticket(
                db,
                gmail_message_id,
            )
        )

        if existing_ticket is not None:
            return existing_ticket

        if student is not None:
            existing_reply = (
                _load_existing_information_reply(
                    db,
                    gmail_message_id,
                    student["user_id"],
                )
            )

            if existing_reply is not None:
                return existing_reply

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
            detail=(
                "Email intake failed."
            ),
        ) from exc

    finally:
        db.close()