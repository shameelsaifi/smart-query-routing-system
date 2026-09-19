import json
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal
from app.schemas.email_delivery import (
    EmailDeliveryFailedCallback,
    EmailDeliverySentCallback,
)
from app.services.ticket_access_service import (
    load_ticket_actor,
    lock_accessible_ticket,
)


def _gmail_sender_email() -> str:
    sender = (
        settings.gmail_sender_email
        or ""
    ).strip().lower()

    if (
        not sender
        or "@" not in sender
        or sender != sender.lower()
    ):
        raise HTTPException(
            503,
            (
                "Gmail sender email is "
                "not configured correctly."
            ),
        )

    return sender


def _record_user_delivery_audit(
    db,
    *,
    actor_id: str,
    response_id: str,
    action: str,
    old_values: dict[str, Any] | None,
    new_values: dict[str, Any],
    event_at,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO public.audit_logs (
                actor_user_id,
                action,
                entity_type,
                entity_id,
                old_values,
                new_values,
                created_at
            )
            VALUES (
                CAST(:actor_id AS UUID),
                :action,
                'RESPONSE',
                CAST(:response_id AS UUID),
                CAST(:old_values AS JSONB),
                CAST(:new_values AS JSONB),
                :event_at
            )
            """
        ),
        {
            "actor_id": actor_id,
            "action": action,
            "response_id": response_id,
            "old_values": (
                json.dumps(
                    old_values,
                    default=str,
                )
                if old_values is not None
                else None
            ),
            "new_values": json.dumps(
                new_values,
                default=str,
            ),
            "event_at": event_at,
        },
    )


def _record_service_delivery_audit(
    db,
    *,
    response_id: str,
    action: str,
    old_values: dict[str, Any] | None,
    new_values: dict[str, Any],
    details: dict[str, Any] | None,
    event_at,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO public.audit_logs (
                actor_service,
                action,
                entity_type,
                entity_id,
                old_values,
                new_values,
                details,
                created_at
            )
            VALUES (
                'EMAIL_DELIVERY',
                :action,
                'RESPONSE',
                CAST(:response_id AS UUID),
                CAST(:old_values AS JSONB),
                CAST(:new_values AS JSONB),
                CAST(:details AS JSONB),
                :event_at
            )
            """
        ),
        {
            "action": action,
            "response_id": response_id,
            "old_values": (
                json.dumps(
                    old_values,
                    default=str,
                )
                if old_values is not None
                else None
            ),
            "new_values": json.dumps(
                new_values,
                default=str,
            ),
            "details": json.dumps(
                details or {},
                default=str,
            ),
            "event_at": event_at,
        },
    )


def queue_response_delivery(
    response_id: UUID,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    try:
        with SessionLocal.begin() as db:
            actor = load_ticket_actor(
                db,
                current_user,
                "DEPARTMENT_STAFF",
                "INSTRUCTOR",
            )

            response = db.execute(
                text(
                    """
                    SELECT
                        r.response_id::text
                            AS response_id,

                        r.ticket_id::text
                            AS ticket_id,

                        r.response_type,
                        r.approval_status,
                        r.delivery_status,

                        r.recipient_email,
                        r.gmail_account_email,

                        r.final_response_text,
                        r.failure_reason,

                        t.ticket_number

                    FROM public.responses r

                    JOIN public.tickets t
                      ON t.ticket_id =
                         r.ticket_id

                    WHERE r.response_id =
                          CAST(
                              :response_id
                              AS UUID
                          )

                    FOR UPDATE OF r
                    """
                ),
                {
                    "response_id": str(
                        response_id
                    ),
                },
            ).mappings().first()

            if response is None:
                raise HTTPException(
                    404,
                    "Response was not found.",
                )

            ticket = lock_accessible_ticket(
                db,
                response[
                    "ticket_number"
                ],
                actor,
            )

            if (
                str(ticket["ticket_id"])
                != response["ticket_id"]
            ):
                raise HTTPException(
                    404,
                    (
                        "Response was not found "
                        "or is not accessible."
                    ),
                )

            if (
                response[
                    "approval_status"
                ]
                != "APPROVED"
            ):
                raise HTTPException(
                    409,
                    (
                        "Only an approved response "
                        "can be queued for delivery."
                    ),
                )

            body = (
                response[
                    "final_response_text"
                ]
                or ""
            ).strip()

            if not body:
                raise HTTPException(
                    409,
                    (
                        "The approved response "
                        "has no final message body."
                    ),
                )

            if not response[
                "recipient_email"
            ]:
                raise HTTPException(
                    409,
                    (
                        "The response has no "
                        "recipient email."
                    ),
                )

            if (
                response[
                    "delivery_status"
                ]
                == "SENT"
            ):
                raise HTTPException(
                    409,
                    (
                        "This response has "
                        "already been sent."
                    ),
                )

            existing_job = db.execute(
                text(
                    """
                    SELECT
                        delivery_job_id::text
                            AS delivery_job_id,

                        job_status,
                        attempt_count,
                        max_attempts

                    FROM public.email_delivery_jobs

                    WHERE response_id =
                          CAST(
                              :response_id
                              AS UUID
                          )

                    FOR UPDATE
                    """
                ),
                {
                    "response_id": (
                        response[
                            "response_id"
                        ]
                    ),
                },
            ).mappings().first()

            if (
                response[
                    "delivery_status"
                ]
                == "QUEUED"
                and existing_job is not None
                and existing_job[
                    "job_status"
                ]
                in {
                    "QUEUED",
                    "LEASED",
                }
            ):
                return {
                    "response_id": (
                        response[
                            "response_id"
                        ]
                    ),
                    "ticket_number": (
                        response[
                            "ticket_number"
                        ]
                    ),
                    "delivery_job_id": (
                        existing_job[
                            "delivery_job_id"
                        ]
                    ),
                    "delivery_status": (
                        "QUEUED"
                    ),
                    "job_status": (
                        existing_job[
                            "job_status"
                        ]
                    ),
                    "attempt_count": (
                        existing_job[
                            "attempt_count"
                        ]
                    ),
                    "max_attempts": (
                        existing_job[
                            "max_attempts"
                        ]
                    ),
                }

            sender = (
                _gmail_sender_email()
            )

            event_at = db.execute(
                text(
                    "SELECT clock_timestamp()"
                )
            ).scalar_one()

            old_values = {
                "delivery_status": (
                    response[
                        "delivery_status"
                    ]
                ),
                "gmail_account_email": (
                    response[
                        "gmail_account_email"
                    ]
                ),
                "failure_reason": (
                    response[
                        "failure_reason"
                    ]
                ),
            }

            db.execute(
                text(
                    """
                    UPDATE public.responses
                    SET
                        delivery_status =
                            'QUEUED',

                        gmail_account_email =
                            :sender_email,

                        gmail_message_id =
                            NULL,

                        gmail_thread_id =
                            NULL,

                        sent_at =
                            NULL,

                        failure_reason =
                            NULL,

                        updated_at =
                            :event_at

                    WHERE response_id =
                          CAST(
                              :response_id
                              AS UUID
                          )
                    """
                ),
                {
                    "response_id": (
                        response[
                            "response_id"
                        ]
                    ),
                    "sender_email": (
                        sender
                    ),
                    "event_at": event_at,
                },
            )

            job = db.execute(
                text(
                    """
                    INSERT INTO
                        public.email_delivery_jobs (
                            response_id,
                            ticket_id,
                            job_status,
                            attempt_count,
                            max_attempts,
                            available_at,
                            lease_token,
                            leased_at,
                            lease_expires_at,
                            last_error,
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
                        0,
                        1,
                        :event_at,
                        NULL,
                        NULL,
                        NULL,
                        NULL,
                        :event_at,
                        :event_at
                    )

                    ON CONFLICT (
                        response_id
                    )
                    DO UPDATE SET
                        ticket_id =
                            EXCLUDED.ticket_id,

                        job_status =
                            'QUEUED',

                        attempt_count =
                            0,

                        max_attempts =
                            1,

                        available_at =
                            EXCLUDED.available_at,

                        lease_token =
                            NULL,

                        leased_at =
                            NULL,

                        lease_expires_at =
                            NULL,

                        last_error =
                            NULL,

                        updated_at =
                            EXCLUDED.updated_at

                    RETURNING
                        delivery_job_id::text
                            AS delivery_job_id,

                        job_status,
                        attempt_count,
                        max_attempts
                    """
                ),
                {
                    "response_id": (
                        response[
                            "response_id"
                        ]
                    ),
                    "ticket_id": (
                        response[
                            "ticket_id"
                        ]
                    ),
                    "event_at": event_at,
                },
            ).mappings().first()

            if job is None:
                raise HTTPException(
                    500,
                    (
                        "Email delivery job "
                        "could not be created."
                    ),
                )

            _record_user_delivery_audit(
                db,
                actor_id=actor[
                    "user_id"
                ],
                response_id=response[
                    "response_id"
                ],
                action=(
                    "EMAIL_DELIVERY_QUEUED"
                ),
                old_values=old_values,
                new_values={
                    "delivery_status": (
                        "QUEUED"
                    ),
                    "gmail_account_email": (
                        sender
                    ),
                    "failure_reason": None,
                },
                event_at=event_at,
            )

            return {
                "response_id": (
                    response[
                        "response_id"
                    ]
                ),
                "ticket_number": (
                    response[
                        "ticket_number"
                    ]
                ),
                "delivery_job_id": (
                    job[
                        "delivery_job_id"
                    ]
                ),
                "delivery_status": (
                    "QUEUED"
                ),
                "job_status": (
                    job[
                        "job_status"
                    ]
                ),
                "attempt_count": (
                    job[
                        "attempt_count"
                    ]
                ),
                "max_attempts": (
                    job[
                        "max_attempts"
                    ]
                ),
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "Email delivery could not "
                "be queued. Please try again."
            ),
        ) from exc


def _recover_expired_leases(
    db,
    event_at,
) -> None:
    db.execute(
        text(
            """
            UPDATE public.email_delivery_jobs
            SET
                job_status =
                    'QUEUED',

                available_at =
                    :event_at,

                lease_token =
                    NULL,

                leased_at =
                    NULL,

                lease_expires_at =
                    NULL,

                last_error =
                    'Previous delivery lease expired.',

                updated_at =
                    :event_at

            WHERE job_status =
                  'LEASED'

              AND lease_expires_at
                  <= :event_at

              AND attempt_count
                  < max_attempts
            """
        ),
        {
            "event_at": event_at,
        },
    )

    db.execute(
        text(
            """
            WITH exhausted AS (
                UPDATE
                    public.email_delivery_jobs
                SET
                    job_status =
                        'FAILED',

                    lease_token =
                        NULL,

                    leased_at =
                        NULL,

                    lease_expires_at =
                        NULL,

                    last_error =
                        (
                            'Delivery lease expired '
                            'after maximum attempts.'
                        ),

                    updated_at =
                        :event_at

                WHERE job_status =
                      'LEASED'

                  AND lease_expires_at
                      <= :event_at

                  AND attempt_count
                      >= max_attempts

                RETURNING
                    response_id
            )

            UPDATE public.responses r
            SET
                delivery_status =
                    'FAILED',

                gmail_message_id =
                    NULL,

                gmail_thread_id =
                    NULL,

                sent_at =
                    NULL,

                failure_reason =
                    (
                        'Delivery lease expired '
                        'after maximum attempts.'
                    ),

                updated_at =
                    :event_at

            WHERE r.response_id IN (
                SELECT response_id
                FROM exhausted
            )
            """
        ),
        {
            "event_at": event_at,
        },
    )


def claim_next_email_delivery(
) -> dict[str, Any] | None:
    try:
        with SessionLocal.begin() as db:
            event_at = db.execute(
                text(
                    "SELECT clock_timestamp()"
                )
            ).scalar_one()

            _recover_expired_leases(
                db,
                event_at,
            )

            row = db.execute(
                text(
                    """
                    SELECT
                        j.delivery_job_id::text
                            AS delivery_job_id,

                        j.response_id::text
                            AS response_id,

                        j.ticket_id::text
                            AS ticket_id,

                        j.attempt_count,
                        j.max_attempts,

                        r.response_type,
                        r.recipient_email,
                        r.gmail_account_email,
                        r.final_response_text,

                        t.ticket_number,
                        t.subject

                    FROM public.email_delivery_jobs j

                    JOIN public.responses r
                      ON r.response_id =
                         j.response_id

                     AND r.ticket_id =
                         j.ticket_id

                    JOIN public.tickets t
                      ON t.ticket_id =
                         j.ticket_id

                    WHERE j.job_status =
                          'QUEUED'

                      AND j.available_at
                          <= :event_at

                      AND r.delivery_status =
                          'QUEUED'

                      AND r.approval_status =
                          'APPROVED'

                    ORDER BY
                        j.available_at,
                        j.created_at,
                        j.delivery_job_id

                    FOR UPDATE OF j
                    SKIP LOCKED

                    LIMIT 1
                    """
                ),
                {
                    "event_at": event_at,
                },
            ).mappings().first()

            if row is None:
                return None

            lease = db.execute(
                text(
                    """
                    UPDATE public.email_delivery_jobs
                    SET
                        job_status =
                            'LEASED',

                        attempt_count =
                            attempt_count + 1,

                        lease_token =
                            gen_random_uuid(),

                        leased_at =
                            :event_at,

                        lease_expires_at =
                            (
                                :event_at
                                +
                                CAST(
                                    :lease_seconds
                                    AS INTEGER
                                )
                                * INTERVAL '1 second'
                            ),

                        updated_at =
                            :event_at

                    WHERE delivery_job_id =
                          CAST(
                              :delivery_job_id
                              AS UUID
                          )

                    RETURNING
                        lease_token::text
                            AS lease_token,

                        attempt_count,

                        max_attempts,

                        lease_expires_at
                    """
                ),
                {
                    "delivery_job_id": (
                        row[
                            "delivery_job_id"
                        ]
                    ),
                    "event_at": event_at,
                    "lease_seconds": (
                        settings
                        .email_delivery_lease_seconds
                    ),
                },
            ).mappings().first()

            if lease is None:
                raise HTTPException(
                    500,
                    (
                        "Email delivery job "
                        "could not be leased."
                    ),
                )

            subject_text = (
                row["subject"]
                or "University Query"
            ).strip()

            if (
                row["response_type"]
                == "INFORMATION_REQUEST"
            ):
                subject = (
                    "Additional information "
                    f"required [{row['ticket_number']}] "
                    f"{subject_text}"
                )

            else:
                subject = (
                    f"Re: [{row['ticket_number']}] "
                    f"{subject_text}"
                )

            return {
                "delivery_job_id": (
                    row[
                        "delivery_job_id"
                    ]
                ),
                "lease_token": (
                    lease[
                        "lease_token"
                    ]
                ),
                "response_id": (
                    row[
                        "response_id"
                    ]
                ),
                "ticket_id": (
                    row[
                        "ticket_id"
                    ]
                ),
                "ticket_number": (
                    row[
                        "ticket_number"
                    ]
                ),
                "response_type": (
                    row[
                        "response_type"
                    ]
                ),
                "recipient_email": (
                    row[
                        "recipient_email"
                    ]
                ),
                "gmail_account_email": (
                    row[
                        "gmail_account_email"
                    ]
                ),
                "subject": subject,
                "body": (
                    row[
                        "final_response_text"
                    ]
                ),
                "attempt_count": (
                    lease[
                        "attempt_count"
                    ]
                ),
                "max_attempts": (
                    lease[
                        "max_attempts"
                    ]
                ),
                "lease_expires_at": (
                    lease[
                        "lease_expires_at"
                    ]
                ),
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "Email delivery queue is "
                "temporarily unavailable."
            ),
        ) from exc


def _load_leased_job(
    db,
    delivery_job_id: UUID,
    lease_token: UUID,
):
    row = db.execute(
        text(
            """
            SELECT
                j.delivery_job_id::text
                    AS delivery_job_id,

                j.response_id::text
                    AS response_id,

                j.ticket_id::text
                    AS ticket_id,

                j.job_status,

                j.attempt_count,
                j.max_attempts,

                j.lease_token::text
                    AS lease_token,

                j.lease_expires_at,

                r.delivery_status,

                t.ticket_number

            FROM public.email_delivery_jobs j

            JOIN public.responses r
              ON r.response_id =
                 j.response_id

            JOIN public.tickets t
              ON t.ticket_id =
                 j.ticket_id

            WHERE j.delivery_job_id =
                  CAST(
                      :delivery_job_id
                      AS UUID
                  )

            FOR UPDATE OF j, r
            """
        ),
        {
            "delivery_job_id": str(
                delivery_job_id
            ),
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(
            404,
            "Email delivery job was not found.",
        )

    if row["job_status"] != "LEASED":
        raise HTTPException(
            409,
            (
                "Email delivery job is "
                "not currently leased."
            ),
        )

    if (
        row["lease_token"]
        != str(lease_token)
    ):
        raise HTTPException(
            409,
            "Email delivery lease token is invalid.",
        )

    return row


def mark_email_delivery_sent(
    delivery_job_id: UUID,
    data: EmailDeliverySentCallback,
) -> dict[str, Any]:
    try:
        with SessionLocal.begin() as db:
            job = _load_leased_job(
                db,
                delivery_job_id,
                data.lease_token,
            )

            event_at = db.execute(
                text(
                    "SELECT clock_timestamp()"
                )
            ).scalar_one()

            old_values = {
                "delivery_status": (
                    job[
                        "delivery_status"
                    ]
                ),
            }

            db.execute(
                text(
                    """
                    UPDATE public.responses
                    SET
                        delivery_status =
                            'SENT',

                        gmail_message_id =
                            :gmail_message_id,

                        gmail_thread_id =
                            :gmail_thread_id,

                        sent_at =
                            :event_at,

                        failure_reason =
                            NULL,

                        updated_at =
                            :event_at

                    WHERE response_id =
                          CAST(
                              :response_id
                              AS UUID
                          )
                    """
                ),
                {
                    "response_id": (
                        job[
                            "response_id"
                        ]
                    ),
                    "gmail_message_id": (
                        data.gmail_message_id
                    ),
                    "gmail_thread_id": (
                        data.gmail_thread_id
                    ),
                    "event_at": event_at,
                },
            )

            db.execute(
                text(
                    """
                    UPDATE public.email_delivery_jobs
                    SET
                        job_status =
                            'COMPLETED',

                        lease_token =
                            NULL,

                        leased_at =
                            NULL,

                        lease_expires_at =
                            NULL,

                        last_error =
                            NULL,

                        updated_at =
                            :event_at

                    WHERE delivery_job_id =
                          CAST(
                              :delivery_job_id
                              AS UUID
                          )
                    """
                ),
                {
                    "delivery_job_id": (
                        job[
                            "delivery_job_id"
                        ]
                    ),
                    "event_at": event_at,
                },
            )

            _record_service_delivery_audit(
                db,
                response_id=job[
                    "response_id"
                ],
                action=(
                    "EMAIL_DELIVERY_SENT"
                ),
                old_values=old_values,
                new_values={
                    "delivery_status": "SENT",
                    "sent_at": event_at,
                    "gmail_message_id": (
                        data.gmail_message_id
                    ),
                    "gmail_thread_id": (
                        data.gmail_thread_id
                    ),
                },
                details={
                    "delivery_job_id": (
                        job[
                            "delivery_job_id"
                        ]
                    ),
                    "attempt_count": (
                        job[
                            "attempt_count"
                        ]
                    ),
                },
                event_at=event_at,
            )

            return {
                "delivery_job_id": (
                    job[
                        "delivery_job_id"
                    ]
                ),
                "response_id": (
                    job[
                        "response_id"
                    ]
                ),
                "ticket_number": (
                    job[
                        "ticket_number"
                    ]
                ),
                "delivery_status": (
                    "SENT"
                ),
                "job_status": (
                    "COMPLETED"
                ),
                "attempt_count": (
                    job[
                        "attempt_count"
                    ]
                ),
                "max_attempts": (
                    job[
                        "max_attempts"
                    ]
                ),
                "retry_scheduled": False,
                "sent_at": event_at,
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "Sent email confirmation "
                "could not be recorded."
            ),
        ) from exc


def mark_email_delivery_failed(
    delivery_job_id: UUID,
    data: EmailDeliveryFailedCallback,
) -> dict[str, Any]:
    try:
        with SessionLocal.begin() as db:
            job = _load_leased_job(
                db,
                delivery_job_id,
                data.lease_token,
            )

            event_at = db.execute(
                text(
                    "SELECT clock_timestamp()"
                )
            ).scalar_one()

            retry_scheduled = (
                job["attempt_count"]
                < job["max_attempts"]
            )

            if retry_scheduled:
                retry_delay_seconds = min(
                    30
                    * (
                        2
                        ** max(
                            job[
                                "attempt_count"
                            ]
                            - 1,
                            0,
                        )
                    ),
                    300,
                )

                db.execute(
                    text(
                        """
                        UPDATE
                            public.email_delivery_jobs
                        SET
                            job_status =
                                'QUEUED',

                            available_at =
                                (
                                    :event_at
                                    +
                                    CAST(
                                        :retry_seconds
                                        AS INTEGER
                                    )
                                    * INTERVAL '1 second'
                                ),

                            lease_token =
                                NULL,

                            leased_at =
                                NULL,

                            lease_expires_at =
                                NULL,

                            last_error =
                                :failure_reason,

                            updated_at =
                                :event_at

                        WHERE delivery_job_id =
                              CAST(
                                  :delivery_job_id
                                  AS UUID
                              )
                        """
                    ),
                    {
                        "delivery_job_id": (
                            job[
                                "delivery_job_id"
                            ]
                        ),
                        "failure_reason": (
                            data.failure_reason
                        ),
                        "retry_seconds": (
                            retry_delay_seconds
                        ),
                        "event_at": event_at,
                    },
                )

                _record_service_delivery_audit(
                    db,
                    response_id=job[
                        "response_id"
                    ],
                    action=(
                        "EMAIL_DELIVERY_RETRY_SCHEDULED"
                    ),
                    old_values={
                        "delivery_status": (
                            job[
                                "delivery_status"
                            ]
                        ),
                    },
                    new_values={
                        "delivery_status": (
                            "QUEUED"
                        ),
                    },
                    details={
                        "delivery_job_id": (
                            job[
                                "delivery_job_id"
                            ]
                        ),
                        "failure_reason": (
                            data.failure_reason
                        ),
                        "attempt_count": (
                            job[
                                "attempt_count"
                            ]
                        ),
                        "retry_delay_seconds": (
                            retry_delay_seconds
                        ),
                    },
                    event_at=event_at,
                )

                return {
                    "delivery_job_id": (
                        job[
                            "delivery_job_id"
                        ]
                    ),
                    "response_id": (
                        job[
                            "response_id"
                        ]
                    ),
                    "ticket_number": (
                        job[
                            "ticket_number"
                        ]
                    ),
                    "delivery_status": (
                        "QUEUED"
                    ),
                    "job_status": (
                        "QUEUED"
                    ),
                    "attempt_count": (
                        job[
                            "attempt_count"
                        ]
                    ),
                    "max_attempts": (
                        job[
                            "max_attempts"
                        ]
                    ),
                    "retry_scheduled": True,
                    "sent_at": None,
                }

            db.execute(
                text(
                    """
                    UPDATE public.responses
                    SET
                        delivery_status =
                            'FAILED',

                        gmail_message_id =
                            NULL,

                        gmail_thread_id =
                            NULL,

                        sent_at =
                            NULL,

                        failure_reason =
                            :failure_reason,

                        updated_at =
                            :event_at

                    WHERE response_id =
                          CAST(
                              :response_id
                              AS UUID
                          )
                    """
                ),
                {
                    "response_id": (
                        job[
                            "response_id"
                        ]
                    ),
                    "failure_reason": (
                        data.failure_reason
                    ),
                    "event_at": event_at,
                },
            )

            db.execute(
                text(
                    """
                    UPDATE public.email_delivery_jobs
                    SET
                        job_status =
                            'FAILED',

                        lease_token =
                            NULL,

                        leased_at =
                            NULL,

                        lease_expires_at =
                            NULL,

                        last_error =
                            :failure_reason,

                        updated_at =
                            :event_at

                    WHERE delivery_job_id =
                          CAST(
                              :delivery_job_id
                              AS UUID
                          )
                    """
                ),
                {
                    "delivery_job_id": (
                        job[
                            "delivery_job_id"
                        ]
                    ),
                    "failure_reason": (
                        data.failure_reason
                    ),
                    "event_at": event_at,
                },
            )

            _record_service_delivery_audit(
                db,
                response_id=job[
                    "response_id"
                ],
                action=(
                    "EMAIL_DELIVERY_FAILED"
                ),
                old_values={
                    "delivery_status": (
                        job[
                            "delivery_status"
                        ]
                    ),
                },
                new_values={
                    "delivery_status": (
                        "FAILED"
                    ),
                    "failure_reason": (
                        data.failure_reason
                    ),
                },
                details={
                    "delivery_job_id": (
                        job[
                            "delivery_job_id"
                        ]
                    ),
                    "attempt_count": (
                        job[
                            "attempt_count"
                        ]
                    ),
                },
                event_at=event_at,
            )

            return {
                "delivery_job_id": (
                    job[
                        "delivery_job_id"
                    ]
                ),
                "response_id": (
                    job[
                        "response_id"
                    ]
                ),
                "ticket_number": (
                    job[
                        "ticket_number"
                    ]
                ),
                "delivery_status": (
                    "FAILED"
                ),
                "job_status": (
                    "FAILED"
                ),
                "attempt_count": (
                    job[
                        "attempt_count"
                    ]
                ),
                "max_attempts": (
                    job[
                        "max_attempts"
                    ]
                ),
                "retry_scheduled": False,
                "sent_at": None,
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "Failed email delivery result "
                "could not be recorded."
            ),
        ) from exc