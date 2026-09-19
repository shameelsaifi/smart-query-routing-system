import asyncio
import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.processing_pipeline_service import (
    ProcessingLeaseLost,
    process_ticket_pipeline,
)


logger = logging.getLogger(__name__)


def _safe_error_message(
    error: Exception,
) -> str:
    if isinstance(error, HTTPException):
        detail = error.detail

        if isinstance(detail, str):
            value = detail
        else:
            value = str(detail)

    else:
        value = str(error)

    value = value.strip()

    if not value:
        value = type(error).__name__

    return value[:2000]


def _recover_expired_jobs() -> int:
    db = SessionLocal()

    try:
        result = db.execute(
            text(
                """
                UPDATE public.ticket_processing_jobs
                SET
                    job_status = CASE
                        WHEN attempt_count < max_attempts
                            THEN 'RETRY'
                        ELSE 'FAILED'
                    END,

                    available_at = CASE
                        WHEN attempt_count < max_attempts
                            THEN NOW()
                                 + INTERVAL '5 seconds'
                        ELSE available_at
                    END,

                    lease_token = NULL,
                    lease_expires_at = NULL,

                    finished_at = CASE
                        WHEN attempt_count >= max_attempts
                            THEN NOW()
                        ELSE NULL
                    END,

                    last_error_code = 'LEASE_EXPIRED',

                    last_error_message =
                        'A worker lease expired before '
                        'processing completed.',

                    updated_at = NOW()

                WHERE job_status = 'RUNNING'
                  AND lease_expires_at <= NOW()
                """
            )
        )

        db.commit()
        return result.rowcount or 0

    except SQLAlchemyError:
        db.rollback()
        raise

    finally:
        db.close()


def _skip_obsolete_waiting_jobs() -> int:
    db = SessionLocal()

    try:
        result = db.execute(
            text(
                """
                UPDATE public.ticket_processing_jobs j
                SET
                    job_status = 'SKIPPED',
                    lease_token = NULL,
                    lease_expires_at = NULL,
                    finished_at = NOW(),
                    updated_at = NOW()
                FROM public.tickets t
                WHERE t.ticket_id = j.ticket_id
                  AND j.job_status IN (
                      'QUEUED',
                      'RETRY'
                  )
                  AND t.status NOT IN (
                      'PENDING',
                      'CLASSIFIED',
                      'ROUTED'
                  )
                """
            )
        )

        db.commit()
        return result.rowcount or 0

    except SQLAlchemyError:
        db.rollback()
        raise

    finally:
        db.close()


def _claim_next_job() -> dict[str, Any] | None:
    db = SessionLocal()
    lease_token = uuid4()

    try:
        job = db.execute(
            text(
                """
                WITH candidate AS (
                    SELECT
                        j.job_id
                    FROM public.ticket_processing_jobs j

                    JOIN public.tickets t
                      ON t.ticket_id = j.ticket_id

                    WHERE j.job_status IN (
                        'QUEUED',
                        'RETRY'
                    )
                      AND j.available_at <= NOW()
                      AND t.status IN (
                          'PENDING',
                          'CLASSIFIED',
                          'ROUTED'
                      )

                    ORDER BY
                        j.available_at ASC,
                        j.created_at ASC,
                        j.job_id ASC

                    FOR UPDATE OF j
                    SKIP LOCKED

                    LIMIT 1
                )

                UPDATE public.ticket_processing_jobs j
                SET
                    job_status = 'RUNNING',
                    attempt_count =
                        j.attempt_count + 1,

                    lease_token = :lease_token,

                    lease_expires_at =
                        NOW()
                        + (
                            :lease_seconds
                            * INTERVAL '1 second'
                        ),

                    last_started_at = NOW(),
                    finished_at = NULL,

                    last_error_code = NULL,
                    last_error_message = NULL,

                    updated_at = NOW()

                FROM candidate c

                WHERE j.job_id = c.job_id

                RETURNING
                    j.job_id,
                    j.ticket_id,
                    j.attempt_count,
                    j.max_attempts,
                    j.lease_token,
                    j.lease_expires_at
                """
            ),
            {
                "lease_token": lease_token,
                "lease_seconds": (
                    settings.processing_worker_lease_seconds
                ),
            },
        ).mappings().first()

        if job is None:
            db.commit()
            return None

        ticket_number = db.execute(
            text(
                """
                SELECT ticket_number
                FROM public.tickets
                WHERE ticket_id = :ticket_id
                LIMIT 1
                """
            ),
            {
                "ticket_id": job["ticket_id"],
            },
        ).scalar_one()

        db.commit()

        return {
            **dict(job),
            "ticket_number": ticket_number,
        }

    except SQLAlchemyError:
        db.rollback()
        raise

    finally:
        db.close()


def _complete_job(
    job_id: UUID,
    lease_token: UUID,
    outcome: str,
) -> bool:
    if outcome not in {
        "COMPLETED",
        "SKIPPED",
    }:
        raise ValueError(
            "Invalid processing-job completion outcome."
        )

    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                UPDATE public.ticket_processing_jobs
                SET
                    job_status = :outcome,

                    lease_token = NULL,
                    lease_expires_at = NULL,

                    finished_at = NOW(),

                    last_error_code = NULL,
                    last_error_message = NULL,

                    updated_at = NOW()

                WHERE job_id = :job_id
                  AND job_status = 'RUNNING'
                  AND lease_token = :lease_token

                RETURNING job_id
                """
            ),
            {
                "job_id": job_id,
                "lease_token": lease_token,
                "outcome": outcome,
            },
        ).first()

        db.commit()

        return row is not None

    except SQLAlchemyError:
        db.rollback()
        raise

    finally:
        db.close()


def _skip_missing_ticket(
    job_id: UUID,
    lease_token: UUID,
) -> bool:
    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                UPDATE public.ticket_processing_jobs
                SET
                    job_status = 'SKIPPED',

                    lease_token = NULL,
                    lease_expires_at = NULL,

                    finished_at = NOW(),

                    last_error_code =
                        'TICKET_NOT_FOUND',

                    last_error_message =
                        'The referenced ticket '
                        'could not be loaded.',

                    updated_at = NOW()

                WHERE job_id = :job_id
                  AND job_status = 'RUNNING'
                  AND lease_token = :lease_token

                RETURNING job_id
                """
            ),
            {
                "job_id": job_id,
                "lease_token": lease_token,
            },
        ).first()

        db.commit()
        return row is not None

    except SQLAlchemyError:
        db.rollback()
        raise

    finally:
        db.close()


def _record_job_failure(
    job_id: UUID,
    lease_token: UUID,
    error: Exception,
) -> bool:
    db = SessionLocal()

    try:
        job = db.execute(
            text(
                """
                SELECT
                    attempt_count,
                    max_attempts
                FROM public.ticket_processing_jobs
                WHERE job_id = :job_id
                  AND job_status = 'RUNNING'
                  AND lease_token = :lease_token
                LIMIT 1
                FOR UPDATE
                """
            ),
            {
                "job_id": job_id,
                "lease_token": lease_token,
            },
        ).mappings().first()

        if job is None:
            db.rollback()
            return False

        attempt_count = int(
            job["attempt_count"]
        )
        max_attempts = int(
            job["max_attempts"]
        )

        retry_allowed = (
            attempt_count < max_attempts
        )

        retry_delay = min(
            settings.processing_worker_retry_max_seconds,
            max(
                5,
                5 * (2 ** (attempt_count - 1)),
            ),
        )

        next_status = (
            "RETRY"
            if retry_allowed
            else "FAILED"
        )

        db.execute(
            text(
                """
                UPDATE public.ticket_processing_jobs
                SET
                    job_status = :job_status,

                    available_at = CASE
                        WHEN :retry_allowed
                        THEN
                            NOW()
                            + (
                                :retry_delay
                                * INTERVAL '1 second'
                            )
                        ELSE available_at
                    END,

                    lease_token = NULL,
                    lease_expires_at = NULL,

                    finished_at = CASE
                        WHEN :retry_allowed
                            THEN NULL
                        ELSE NOW()
                    END,

                    last_error_code = :error_code,
                    last_error_message = :error_message,

                    updated_at = NOW()

                WHERE job_id = :job_id
                """
            ),
            {
                "job_status": next_status,
                "retry_allowed": retry_allowed,
                "retry_delay": retry_delay,
                "error_code": (
                    type(error).__name__[:100]
                ),
                "error_message": (
                    _safe_error_message(error)
                ),
                "job_id": job_id,
            },
        )

        db.commit()
        return True

    except SQLAlchemyError:
        db.rollback()
        raise

    finally:
        db.close()


def process_one_available_job() -> bool:
    _recover_expired_jobs()
    _skip_obsolete_waiting_jobs()

    job = _claim_next_job()

    if job is None:
        return False

    job_id = job["job_id"]
    lease_token = job["lease_token"]
    ticket_number = job["ticket_number"]

    try:
        result = process_ticket_pipeline(
            ticket_number,
            attempt_number=job[
                "attempt_count"
            ],
            job_id=job_id,
            lease_token=lease_token,
        )

        outcome = result.get(
            "queue_outcome",
            "COMPLETED",
        )

        completed = _complete_job(
            job_id=job_id,
            lease_token=lease_token,
            outcome=outcome,
        )

        if not completed:
            logger.warning(
                "Processing job %s finished but its "
                "lease was no longer owned.",
                job_id,
            )

        else:
            logger.info(
                "Processing job %s completed for "
                "ticket %s with pipeline status %s.",
                job_id,
                ticket_number,
                result.get("pipeline_status"),
            )

        return True

    except ProcessingLeaseLost:
        logger.warning(
            "Processing job %s lost its lease "
            "while handling ticket %s.",
            job_id,
            ticket_number,
        )

        return True

    except HTTPException as exc:
        if exc.status_code == 404:
            _skip_missing_ticket(
                job_id,
                lease_token,
            )

        else:
            _record_job_failure(
                job_id,
                lease_token,
                exc,
            )

        logger.exception(
            "Processing job %s failed for ticket %s.",
            job_id,
            ticket_number,
        )

        return True

    except Exception as exc:
        _record_job_failure(
            job_id,
            lease_token,
            exc,
        )

        logger.exception(
            "Processing job %s failed for ticket %s.",
            job_id,
            ticket_number,
        )

        return True


async def processing_worker_loop() -> None:
    logger.info(
        "Ticket processing worker started."
    )

    try:
        while True:
            try:
                processed = await asyncio.to_thread(
                    process_one_available_job
                )

            except Exception:
                logger.exception(
                    "Unexpected processing-worker "
                    "iteration failure."
                )

                processed = False

            if not processed:
                await asyncio.sleep(
                    settings.processing_worker_poll_seconds
                )

            else:
                await asyncio.sleep(0)

    except asyncio.CancelledError:
        logger.info(
            "Ticket processing worker stopped."
        )
        raise