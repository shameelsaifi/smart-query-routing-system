import hashlib
import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.student_draft import (
    DraftContent,
    DraftCreate,
    DraftSubmit,
    DraftUpdate,
    StudentDraftRecord,
)
from app.services.ticket_access_service import (
    load_ticket_actor,
    record_ticket_change,
)


DRAFT_COLUMNS = """
    ticket_id::text AS ticket_id,
    ticket_number,
    subject,
    message,
    source,
    status,
    created_at,
    updated_at,
    submitted_at,
    draft_revision,
    draft_request_id::text AS draft_request_id,
    draft_request_hash
"""


def _content_hash(data: DraftContent) -> str:
    content = json.dumps(
        [data.subject, data.message],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _same_content(
    ticket: dict[str, Any],
    data: DraftContent | DraftSubmit,
) -> bool:
    return (
        ticket["subject"] == data.subject
        and ticket["message"] == data.message
    )


def _owned_web_ticket(
    db: Session,
    student_id: str,
    ticket_number: str,
    *,
    for_update: bool = False,
) -> dict[str, Any]:
    lock_clause = " FOR UPDATE" if for_update else ""

    row = db.execute(
        text(
            "SELECT " + DRAFT_COLUMNS + """
                FROM public.tickets
                WHERE student_id = CAST(:student_id AS UUID)
                  AND ticket_number = :ticket_number
                  AND source = 'WEB'
            """ + lock_clause
        ),
        {
            "student_id": student_id,
            "ticket_number": ticket_number,
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(404, "Ticket not found or not accessible.")

    return dict(row)


def create_student_draft(
    current_user: dict[str, Any],
    data: DraftCreate,
) -> tuple[StudentDraftRecord, bool]:
    try:
        with SessionLocal.begin() as db:
            actor = load_ticket_actor(db, current_user, "STUDENT")
            fingerprint = _content_hash(data)

            row = db.execute(
                text("""
                    INSERT INTO public.tickets (
                        student_id,
                        subject,
                        message,
                        source,
                        status,
                        submitted_at,
                        draft_revision,
                        draft_request_id,
                        draft_request_hash
                    )
                    VALUES (
                        CAST(:student_id AS UUID),
                        :subject,
                        :message,
                        'WEB',
                        'DRAFT',
                        NULL,
                        1,
                        CAST(:request_id AS UUID),
                        :request_hash
                    )
                    ON CONFLICT (student_id, draft_request_id)
                    WHERE draft_request_id IS NOT NULL
                    DO NOTHING
                    RETURNING
                """ + DRAFT_COLUMNS),
                {
                    "student_id": actor["user_id"],
                    "subject": data.subject,
                    "message": data.message,
                    "request_id": str(data.request_id),
                    "request_hash": fingerprint,
                },
            ).mappings().first()

            created_now = row is not None

            if row is None:
                row = db.execute(
                    text(
                        "SELECT " + DRAFT_COLUMNS + """
                            FROM public.tickets
                            WHERE student_id = CAST(:student_id AS UUID)
                              AND draft_request_id = CAST(:request_id AS UUID)
                            FOR UPDATE
                        """
                    ),
                    {
                        "student_id": actor["user_id"],
                        "request_id": str(data.request_id),
                    },
                ).mappings().first()

                if row is None:
                    raise HTTPException(
                        503,
                        "Draft save could not be confirmed. Please retry.",
                    )

                if row["draft_request_hash"] != fingerprint:
                    raise HTTPException(
                        409,
                        "This draft was already saved with different content. "
                        "Open it from My Tickets before editing.",
                    )

            ticket = dict(row)

            if created_now:
                record_ticket_change(
                    db,
                    actor["user_id"],
                    None,
                    ticket,
                    "TICKET_DRAFT_CREATED",
                    "Student saved a web query draft.",
                    ticket["created_at"],
                )

            result = StudentDraftRecord.model_validate(ticket)

        return result, created_now

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            "Draft save is temporarily unavailable. Please retry.",
        ) from exc


def get_student_draft(
    current_user: dict[str, Any],
    ticket_number: str,
) -> StudentDraftRecord:
    try:
        with SessionLocal() as db:
            actor = load_ticket_actor(db, current_user, "STUDENT")
            ticket = _owned_web_ticket(
                db,
                actor["user_id"],
                ticket_number,
            )
            return StudentDraftRecord.model_validate(ticket)

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            "Draft details are temporarily unavailable. Please retry.",
        ) from exc


def update_student_draft(
    current_user: dict[str, Any],
    ticket_number: str,
    data: DraftUpdate,
) -> StudentDraftRecord:
    try:
        with SessionLocal.begin() as db:
            actor = load_ticket_actor(db, current_user, "STUDENT")
            before = _owned_web_ticket(
                db,
                actor["user_id"],
                ticket_number,
                for_update=True,
            )

            if before["status"] != "DRAFT":
                raise HTTPException(
                    409,
                    "This ticket has already been submitted. "
                    "Reload it to open its ticket details.",
                )

            if before["draft_revision"] != data.expected_revision:
                # A retry of the same completed save has no further effect.
                if (
                    before["draft_revision"] == data.expected_revision + 1
                    and _same_content(before, data)
                ):
                    return StudentDraftRecord.model_validate(before)

                raise HTTPException(
                    409,
                    "This draft changed in another request or tab. "
                    "Reload the draft before saving again.",
                )

            if _same_content(before, data):
                return StudentDraftRecord.model_validate(before)

            row = db.execute(
                text("""
                    UPDATE public.tickets
                    SET subject = :subject,
                        message = :message,
                        draft_revision = draft_revision + 1,
                        updated_at = clock_timestamp()
                    WHERE ticket_id = CAST(:ticket_id AS UUID)
                      AND status = 'DRAFT'
                    RETURNING
                """ + DRAFT_COLUMNS),
                {
                    "ticket_id": before["ticket_id"],
                    "subject": data.subject,
                    "message": data.message,
                },
            ).mappings().one()

            after = dict(row)

            record_ticket_change(
                db,
                actor["user_id"],
                before,
                after,
                "TICKET_DRAFT_UPDATED",
                "Student updated a saved draft.",
                after["updated_at"],
            )

            result = StudentDraftRecord.model_validate(after)

        return result

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            "Draft update is temporarily unavailable. Please retry.",
        ) from exc


def submit_student_draft(
    current_user: dict[str, Any],
    ticket_number: str,
    data: DraftSubmit,
) -> tuple[dict[str, Any], bool]:
    if not data.subject.strip() or not data.message.strip():
        raise HTTPException(422, "Subject and message are required.")

    try:
        with SessionLocal.begin() as db:
            actor = load_ticket_actor(db, current_user, "STUDENT")
            before = _owned_web_ticket(
                db,
                actor["user_id"],
                ticket_number,
                for_update=True,
            )

            if before["status"] != "DRAFT":
                # Replaying a completed submission must not schedule AI again.
                if (
                    before["submitted_at"] is not None
                    and before["draft_revision"] == data.expected_revision + 1
                    and _same_content(before, data)
                ):
                    return before, False

                raise HTTPException(
                    409,
                    "This ticket has already been submitted. "
                    "Reload it to open its ticket details.",
                )

            if before["draft_revision"] != data.expected_revision:
                raise HTTPException(
                    409,
                    "This draft changed in another request or tab. "
                    "Reload it before submitting.",
                )

            row = db.execute(
                text("""
                    UPDATE public.tickets
                    SET subject = :subject,
                        message = :message,
                        status = 'PENDING',
                        submitted_at = clock_timestamp(),
                        updated_at = clock_timestamp(),
                        draft_revision = draft_revision + 1
                    WHERE ticket_id = CAST(:ticket_id AS UUID)
                      AND status = 'DRAFT'
                    RETURNING
                """ + DRAFT_COLUMNS),
                {
                    "ticket_id": before["ticket_id"],
                    "subject": data.subject,
                    "message": data.message,
                },
            ).mappings().one()

            after = dict(row)

            record_ticket_change(
                db,
                actor["user_id"],
                before,
                after,
                "TICKET_SUBMITTED",
                "Student submitted a saved web query draft.",
                after["submitted_at"],
            )

        return after, True

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            "Draft submission could not be confirmed. Please retry.",
        ) from exc