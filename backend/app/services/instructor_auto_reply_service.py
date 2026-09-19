from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal


def _gmail_sender_email() -> str:
    sender = (
        getattr(
            settings,
            "gmail_sender_email",
            "",
        )
        or ""
    ).strip().lower()

    if not sender:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Gmail sender account is not configured."
            ),
        )

    return sender


def create_instructor_leave_auto_reply(
    ticket_number: str,
) -> dict[str, Any]:
    """
    Create and queue one predefined instructor leave
    acknowledgement for a routed ticket.

    The acknowledgement is created only when:

    - the ticket is still ROUTED;
    - no officer/instructor is currently assigned;
    - the current routing rule targets INSTRUCTOR;
    - an active instructor in that routed department
      is currently unavailable;
    - that instructor has a non-empty predefined
      auto_reply_message.

    Important:
    AUTO_REPLY never changes the ticket status and
    therefore cannot resolve the ticket.
    """

    try:
        with SessionLocal.begin() as db:
            # Lock the ticket so two processing attempts
            # cannot create duplicate auto replies.
            ticket = db.execute(
                text(
                    """
                    SELECT
                        t.ticket_id::text
                            AS ticket_id,

                        t.ticket_number,
                        t.student_id::text
                            AS student_id,

                        t.status,

                        t.assigned_officer_id::text
                            AS assigned_officer_id,

                        qa.department_id::text
                            AS department_id,

                        qa.desk_id::text
                            AS desk_id,

                        r.target_role

                    FROM public.tickets t

                    LEFT JOIN public.query_assignments qa
                      ON qa.ticket_id = t.ticket_id
                     AND qa.is_current = TRUE

                    LEFT JOIN public.routing_rules r
                      ON r.rule_id = qa.rule_id

                    WHERE t.ticket_number =
                          :ticket_number

                    FOR UPDATE OF t
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

            # This helper is intentionally a no-op when
            # the ticket no longer qualifies.
            if ticket["status"] != "ROUTED":
                return {
                    "created": False,
                    "reason": "TICKET_NOT_ROUTED",
                    "ticket_number": ticket_number,
                }

            if (
                ticket["assigned_officer_id"]
                is not None
            ):
                return {
                    "created": False,
                    "reason": "TICKET_ALREADY_ASSIGNED",
                    "ticket_number": ticket_number,
                }

            if ticket["target_role"] != "INSTRUCTOR":
                return {
                    "created": False,
                    "reason": "NOT_INSTRUCTOR_ROUTE",
                    "ticket_number": ticket_number,
                }

            if not ticket["department_id"]:
                return {
                    "created": False,
                    "reason": "NO_ROUTED_DEPARTMENT",
                    "ticket_number": ticket_number,
                }

            # Idempotency:
            # the migration also enforces this through
            # uq_responses_ticket_auto_reply.
            existing = db.execute(
                text(
                    """
                    SELECT
                        response_id::text
                            AS response_id,

                        delivery_status

                    FROM public.responses

                    WHERE ticket_id =
                          CAST(
                              :ticket_id
                              AS UUID
                          )

                      AND response_type =
                          'AUTO_REPLY'

                    LIMIT 1
                    """
                ),
                {
                    "ticket_id": ticket["ticket_id"],
                },
            ).mappings().first()

            if existing is not None:
                return {
                    "created": False,
                    "reason": "AUTO_REPLY_ALREADY_EXISTS",
                    "ticket_number": ticket_number,
                    "response_id": (
                        existing["response_id"]
                    ),
                    "delivery_status": (
                        existing["delivery_status"]
                    ),
                }

            # Assignment service already skips users whose
            # is_available is FALSE. Here we locate one such
            # instructor only to use their predefined leave
            # acknowledgement.
            instructor = db.execute(
                text(
                    """
                    SELECT
                        u.user_id::text
                            AS user_id,

                        u.full_name,
                        u.email,
                        u.auto_reply_message

                    FROM public.users u

                    WHERE u.role = 'INSTRUCTOR'

                      AND u.is_active = TRUE

                      AND u.is_available = FALSE

                      AND u.department_id =
                          CAST(
                              :department_id
                              AS UUID
                          )

                      AND (
                            CAST(
                                :desk_id
                                AS UUID
                            ) IS NULL

                            OR u.desk_id =
                               CAST(
                                   :desk_id
                                   AS UUID
                               )
                      )

                      AND u.auto_reply_message
                          IS NOT NULL

                      AND btrim(
                          u.auto_reply_message
                      ) <> ''

                    ORDER BY
                        u.created_at ASC,
                        u.user_id ASC

                    LIMIT 1
                    """
                ),
                {
                    "department_id": (
                        ticket["department_id"]
                    ),
                    "desk_id": ticket["desk_id"],
                },
            ).mappings().first()

            if instructor is None:
                return {
                    "created": False,
                    "reason": (
                        "NO_LEAVE_AUTO_REPLY_AVAILABLE"
                    ),
                    "ticket_number": ticket_number,
                }

            student = db.execute(
                text(
                    """
                    SELECT
                        email

                    FROM public.users

                    WHERE user_id =
                          CAST(
                              :student_id
                              AS UUID
                          )

                      AND is_active = TRUE

                    LIMIT 1
                    """
                ),
                {
                    "student_id": ticket["student_id"],
                },
            ).mappings().first()

            if student is None:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "The ticket student account "
                        "could not be found."
                    ),
                )

            recipient_email = (
                student["email"]
                or ""
            ).strip().lower()

            if not recipient_email:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "The ticket student has no "
                        "email address."
                    ),
                )

            message = (
                instructor["auto_reply_message"]
                or ""
            ).strip()

            if not message:
                return {
                    "created": False,
                    "reason": (
                        "NO_LEAVE_AUTO_REPLY_AVAILABLE"
                    ),
                    "ticket_number": ticket_number,
                }

            sender_email = _gmail_sender_email()

            event_at = db.execute(
                text(
                    "SELECT clock_timestamp()"
                )
            ).scalar_one()

            response = db.execute(
                text(
                    """
                    INSERT INTO public.responses (
                        ticket_id,
                        response_type,
                        responder_id,
                        final_response_text,
                        approval_status,
                        approved_at,
                        delivery_status,
                        recipient_email,
                        gmail_account_email,
                        revision,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        CAST(
                            :ticket_id
                            AS UUID
                        ),
                        'AUTO_REPLY',
                        CAST(
                            :responder_id
                            AS UUID
                        ),
                        :message,
                        'APPROVED',
                        :event_at,
                        'QUEUED',
                        :recipient_email,
                        :gmail_account_email,
                        1,
                        :event_at,
                        :event_at
                    )
                    RETURNING
                        response_id::text
                            AS response_id,

                        response_type,
                        approval_status,
                        delivery_status,
                        recipient_email
                    """
                ),
                {
                    "ticket_id": ticket["ticket_id"],
                    "responder_id": (
                        instructor["user_id"]
                    ),
                    "message": message,
                    "recipient_email": (
                        recipient_email
                    ),
                    "gmail_account_email": (
                        sender_email
                    ),
                    "event_at": event_at,
                },
            ).mappings().first()

            if response is None:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Instructor leave auto-reply "
                        "could not be created."
                    ),
                )

            delivery_job = db.execute(
                text(
                    """
                    INSERT INTO
                        public.email_delivery_jobs (
                            response_id,
                            ticket_id,
                            job_status,
                            available_at,
                            created_at,
                            updated_at
                        )
                    VALUES (
                        CAST(
                            :response_id
                            AS UUID
                        ),
                        CAST(
                            :ticket_id
                            AS UUID
                        ),
                        'QUEUED',
                        :event_at,
                        :event_at,
                        :event_at
                    )
                    RETURNING
                        delivery_job_id::text
                            AS delivery_job_id,

                        job_status
                    """
                ),
                {
                    "response_id": (
                        response["response_id"]
                    ),
                    "ticket_id": ticket["ticket_id"],
                    "event_at": event_at,
                },
            ).mappings().first()

            if delivery_job is None:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Instructor leave email "
                        "delivery job could not "
                        "be created."
                    ),
                )

            return {
                "created": True,
                "reason": "AUTO_REPLY_QUEUED",
                "ticket_number": ticket_number,
                "response_id": (
                    response["response_id"]
                ),
                "response_type": (
                    response["response_type"]
                ),
                "delivery_status": (
                    response["delivery_status"]
                ),
                "delivery_job_id": (
                    delivery_job[
                        "delivery_job_id"
                    ]
                ),
                "job_status": (
                    delivery_job["job_status"]
                ),
                "recipient_email": (
                    recipient_email
                ),
                "instructor_id": (
                    instructor["user_id"]
                ),
                "instructor_name": (
                    instructor["full_name"]
                ),
            }

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Instructor leave auto-reply "
                "could not be prepared."
            ),
        ) from exc