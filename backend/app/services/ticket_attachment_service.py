import hashlib
import json
import re
import unicodedata
from contextlib import contextmanager
from typing import Any, Iterator
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.schemas.student_draft import DraftSubmit
from app.services.attachment_storage_service import (
    ALLOWED_ATTACHMENT_TYPES,
    ATTACHMENT_BUCKET,
    MAX_ATTACHMENT_BYTES,
    AttachmentStorage,
    StorageError,
    StorageObjectNotFound,
)
from app.services.student_draft_service import submit_student_draft
from app.services.ticket_access_service import load_ticket_actor


MAX_ATTACHMENTS_PER_TICKET = 5

ATTACHMENT_COLUMNS = """
    attachment_id::text AS attachment_id,
    ticket_id::text AS ticket_id,
    uploaded_by_user_id::text AS uploaded_by_user_id,
    storage_bucket,
    file_name,
    file_path,
    mime_type,
    file_size,
    content_sha256,
    upload_state,
    uploaded_at,
    removed_at
"""

PUBLIC_ATTACHMENT_FIELDS = (
    "attachment_id",
    "file_name",
    "mime_type",
    "file_size",
    "upload_state",
    "uploaded_at",
)

EXTENSION_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}

STORAGE_EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
}


@contextmanager
def attachment_transaction() -> Iterator[Session]:
    try:
        with SessionLocal.begin() as db:
            db.execute(text("SET LOCAL lock_timeout = '5s'"))
            yield db

    except SQLAlchemyError as exc:
        sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)

        if sqlstate == "55P03":
            raise HTTPException(
                409,
                "This ticket is busy. Wait for the current operation and retry.",
            ) from exc

        if sqlstate == "23505":
            raise HTTPException(
                409,
                "This upload identifier is already in use. Refresh the attachments.",
            ) from exc

        raise HTTPException(
            503,
            "Attachments are temporarily unavailable. Please retry.",
        ) from exc

    except StorageError as exc:
        raise HTTPException(
            503,
            "Attachment storage is temporarily unavailable. "
            "Refresh the attachments and retry the pending action.",
        ) from exc


def validate_attachment_file(
    file_name: str,
    declared_type: str | None,
    content: bytes,
) -> tuple[str, str, str]:
    if not content:
        raise HTTPException(422, "The selected file is empty.")

    if len(content) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(413, "Each attachment must be 5 MB or smaller.")

    name = unicodedata.normalize("NFC", file_name).strip()

    if not name or len(name) > 255:
        raise HTTPException(
            422,
            "The file name must contain between 1 and 255 characters.",
        )

    if (
        name in {".", ".."}
        or name.endswith(".")
        or any(character in name for character in '/\\:<>"|?*')
        or any(
            unicodedata.category(character).startswith("C")
            for character in name
        )
    ):
        raise HTTPException(
            422,
            "The file name contains unsupported characters.",
        )

    dot_position = name.rfind(".")
    extension = name[dot_position:].lower() if dot_position >= 0 else ""
    mime_type = EXTENSION_TYPES.get(extension)

    if mime_type is None:
        raise HTTPException(422, "Only PDF, PNG, JPG and JPEG files are allowed.")

    claimed_type = (declared_type or "").split(";", 1)[0].strip().lower()

    if claimed_type not in {"", "application/octet-stream", mime_type}:
        raise HTTPException(
            422,
            "The file type does not match its extension.",
        )

    # Signature checks identify the expected format.
    # They are not a complete document parser or a malware scan.
    if mime_type == "application/pdf":
        signature_matches = (
            re.match(rb"%PDF-(?:1\.[0-7]|2\.0)(?:\s|$)", content) is not None
            and b"%%EOF" in content[-1024:]
        )
    elif mime_type == "image/png":
        signature_matches = (
            len(content) >= 45
            and content.startswith(b"\x89PNG\r\n\x1a\n")
            and content[12:16] == b"IHDR"
            and content.endswith(b"\x00\x00\x00\x00IEND\xaeB`\x82")
        )
    else:
        signature_matches = (
            len(content) >= 4
            and content.startswith(b"\xff\xd8\xff")
            and content.endswith(b"\xff\xd9")
        )

    if not signature_matches:
        raise HTTPException(
            422,
            "The file contents do not match a supported file format.",
        )

    return name, mime_type, hashlib.sha256(content).hexdigest()


def owned_ticket(
    db: Session,
    current_user: dict[str, Any],
    ticket_number: str,
    *,
    write: bool,
) -> tuple[dict[str, Any], dict[str, Any]]:
    actor = load_ticket_actor(db, current_user, "STUDENT")
    lock_clause = "FOR UPDATE OF t" if write else "FOR SHARE OF t"

    row = db.execute(
        text("""
            SELECT
                t.ticket_id::text AS ticket_id,
                t.ticket_number,
                t.source,
                t.status,
                t.draft_revision
            FROM public.tickets t
            WHERE t.ticket_number = :ticket_number
              AND t.student_id = CAST(:student_id AS UUID)
        """ + lock_clause),
        {
            "ticket_number": ticket_number,
            "student_id": actor["user_id"],
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(404, "Ticket not found or not accessible.")

    return actor, dict(row)


def require_editable_draft(ticket: dict[str, Any]) -> None:
    if ticket["status"] != "DRAFT" or ticket["source"] != "WEB":
        raise HTTPException(
            409,
            "Attachments can only be changed on a saved web draft.",
        )


def require_revision(ticket: dict[str, Any], expected_revision: int) -> None:
    if ticket["draft_revision"] != expected_revision:
        raise HTTPException(
            409,
            "This draft changed. Reload it before changing attachments.",
        )


def load_attachment(
    db: Session,
    ticket_id: str,
    attachment_id: str,
) -> dict[str, Any] | None:
    row = db.execute(
        text("""
            SELECT
        """ + ATTACHMENT_COLUMNS + """
            FROM public.query_attachments
            WHERE ticket_id = CAST(:ticket_id AS UUID)
              AND attachment_id = CAST(:attachment_id AS UUID)
        """),
        {
            "ticket_id": ticket_id,
            "attachment_id": attachment_id,
        },
    ).mappings().first()

    return dict(row) if row is not None else None


def public_attachment(attachment: dict[str, Any]) -> dict[str, Any]:
    return {
        field: attachment[field]
        for field in PUBLIC_ATTACHMENT_FIELDS
    }


def bump_draft_revision(db: Session, ticket_id: str) -> int:
    revision = db.execute(
        text("""
            UPDATE public.tickets
            SET
                draft_revision = draft_revision + 1,
                updated_at = clock_timestamp()
            WHERE ticket_id = CAST(:ticket_id AS UUID)
              AND status = 'DRAFT'
              AND draft_revision < 2147483646
            RETURNING draft_revision
        """),
        {"ticket_id": ticket_id},
    ).scalar_one_or_none()

    if revision is None:
        raise HTTPException(
            409,
            "This draft cannot be changed. Reload the ticket.",
        )

    return revision


def audit_attachment(
    db: Session,
    actor_id: str,
    attachment: dict[str, Any],
    previous_state: str | None,
    action: str,
) -> None:
    new_values = {
        "attachment_id": attachment["attachment_id"],
        "file_name": attachment["file_name"],
        "mime_type": attachment["mime_type"],
        "file_size": attachment["file_size"],
        "upload_state": attachment["upload_state"],
    }

    old_values = (
        {
            "attachment_id": attachment["attachment_id"],
            "upload_state": previous_state,
        }
        if previous_state is not None
        else None
    )

    db.execute(
        text("""
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
                'TICKET',
                CAST(:ticket_id AS UUID),
                CAST(:old_values AS JSONB),
                CAST(:new_values AS JSONB),
                clock_timestamp()
            )
        """),
        {
            "actor_id": actor_id,
            "action": action,
            "ticket_id": attachment["ticket_id"],
            "old_values": (
                json.dumps(old_values)
                if old_values is not None
                else None
            ),
            "new_values": json.dumps(new_values),
        },
    )


def mutation_result(
    attachment: dict[str, Any],
    revision: int,
) -> dict[str, Any]:
    return {
        "attachment": public_attachment(attachment),
        "draft_revision": revision,
    }


def check_attachment_access(
    current_user: dict[str, Any],
    ticket_number: str,
) -> None:
    with attachment_transaction() as db:
        owned_ticket(db, current_user, ticket_number, write=False)


def get_student_attachments(
    current_user: dict[str, Any],
    ticket_number: str,
) -> dict[str, Any]:
    with attachment_transaction() as db:
        _, ticket = owned_ticket(
            db, current_user, ticket_number, write=False,
        )

        rows = db.execute(
            text("""
                SELECT
            """ + ATTACHMENT_COLUMNS + """
                FROM public.query_attachments
                WHERE ticket_id = CAST(:ticket_id AS UUID)
                  AND upload_state <> 'REMOVED'
                ORDER BY uploaded_at, attachment_id
            """),
            {"ticket_id": ticket["ticket_id"]},
        ).mappings().all()

        return {
            "ticket_number": ticket["ticket_number"],
            "ticket_status": ticket["status"],
            "draft_revision": ticket["draft_revision"],
            "items": [public_attachment(dict(row)) for row in rows],
            "max_files": MAX_ATTACHMENTS_PER_TICKET,
            "max_file_size": MAX_ATTACHMENT_BYTES,
            "allowed_mime_types": list(ALLOWED_ATTACHMENT_TYPES),
        }


def confirm_stored_content(
    storage: AttachmentStorage,
    attachment: dict[str, Any],
    content: bytes,
) -> None:
    if attachment["storage_bucket"] != ATTACHMENT_BUCKET:
        raise StorageError("Unexpected attachment bucket.")

    try:
        stored = storage.download(attachment["file_path"])
    except StorageObjectNotFound:
        try:
            storage.upload_new(
                attachment["file_path"],
                content,
                attachment["mime_type"],
            )
        except StorageError:
            # An upload response may be lost after Storage accepted the file.
            # Confirm the immutable object before deciding that it failed.
            stored = storage.download(attachment["file_path"])
        else:
            stored = storage.download(attachment["file_path"])

    if (
        len(stored) != attachment["file_size"]
        or hashlib.sha256(stored).hexdigest()
        != attachment["content_sha256"]
    ):
        raise StorageError("Stored attachment content could not be verified.")


def upload_student_attachment(
    current_user: dict[str, Any],
    ticket_number: str,
    attachment_id: UUID,
    expected_revision: int,
    file_name: str,
    declared_type: str | None,
    content: bytes,
) -> dict[str, Any]:
    name, mime_type, digest = validate_attachment_file(
        file_name, declared_type, content,
    )
    upload_id = str(attachment_id)

    # Commit a reservation before contacting Storage.
    # A failed Storage call therefore leaves a recoverable database record.
    with attachment_transaction() as db:
        actor, ticket = owned_ticket(
            db, current_user, ticket_number, write=True,
        )
        attachment = load_attachment(db, ticket["ticket_id"], upload_id)

        if attachment is not None:
            if (
                attachment["file_name"] != name
                or attachment["mime_type"] != mime_type
                or attachment["file_size"] != len(content)
                or attachment["content_sha256"] != digest
            ):
                raise HTTPException(
                    409,
                    "Retry this upload with the same file, "
                    "or select the new file as a separate attachment.",
                )

            if attachment["upload_state"] == "READY":
                return mutation_result(
                    attachment, ticket["draft_revision"],
                )

            if attachment["upload_state"] in {"REMOVING", "REMOVED"}:
                raise HTTPException(
                    409,
                    "This attachment was removed or is being removed. "
                    "Select the file again to start a new upload.",
                )

            require_editable_draft(ticket)

        else:
            require_editable_draft(ticket)
            require_revision(ticket, expected_revision)

            active_count = db.execute(
                text("""
                    SELECT count(*)
                    FROM public.query_attachments
                    WHERE ticket_id = CAST(:ticket_id AS UUID)
                      AND upload_state <> 'REMOVED'
                """),
                {"ticket_id": ticket["ticket_id"]},
            ).scalar_one()

            if active_count >= MAX_ATTACHMENTS_PER_TICKET:
                raise HTTPException(
                    409,
                    f"A draft can contain at most "
                    f"{MAX_ATTACHMENTS_PER_TICKET} attachments.",
                )

            storage_path = (
                f"tickets/{ticket['ticket_id']}/"
                f"{upload_id}{STORAGE_EXTENSIONS[mime_type]}"
            )

            row = db.execute(
                text("""
                    INSERT INTO public.query_attachments (
                        attachment_id,
                        ticket_id,
                        uploaded_by_user_id,
                        storage_bucket,
                        file_name,
                        file_path,
                        mime_type,
                        file_size,
                        content_sha256,
                        upload_state
                    )
                    VALUES (
                        CAST(:attachment_id AS UUID),
                        CAST(:ticket_id AS UUID),
                        CAST(:actor_id AS UUID),
                        :storage_bucket,
                        :file_name,
                        :file_path,
                        :mime_type,
                        :file_size,
                        :content_sha256,
                        'PENDING'
                    )
                    RETURNING
                """ + ATTACHMENT_COLUMNS),
                {
                    "attachment_id": upload_id,
                    "ticket_id": ticket["ticket_id"],
                    "actor_id": actor["user_id"],
                    "storage_bucket": ATTACHMENT_BUCKET,
                    "file_name": name,
                    "file_path": storage_path,
                    "mime_type": mime_type,
                    "file_size": len(content),
                    "content_sha256": digest,
                },
            ).mappings().one()

            attachment = dict(row)
            bump_draft_revision(db, ticket["ticket_id"])
            audit_attachment(
                db,
                actor["user_id"],
                attachment,
                None,
                "TICKET_ATTACHMENT_RESERVED",
            )

    # The ticket lock serializes completion, removal and draft submission.
    with attachment_transaction() as db:
        actor, ticket = owned_ticket(
            db, current_user, ticket_number, write=True,
        )
        attachment = load_attachment(db, ticket["ticket_id"], upload_id)

        if attachment is None:
            raise HTTPException(404, "Attachment not found.")

        if attachment["upload_state"] == "READY":
            return mutation_result(attachment, ticket["draft_revision"])

        if attachment["upload_state"] != "PENDING":
            raise HTTPException(
                409,
                "This upload has been cancelled or is being removed.",
            )

        require_editable_draft(ticket)

        with AttachmentStorage() as storage:
            confirm_stored_content(storage, attachment, content)

        row = db.execute(
            text("""
                UPDATE public.query_attachments
                SET
                    upload_state = 'READY',
                    uploaded_at = clock_timestamp()
                WHERE attachment_id = CAST(:attachment_id AS UUID)
                RETURNING
            """ + ATTACHMENT_COLUMNS),
            {"attachment_id": upload_id},
        ).mappings().one()

        attachment = dict(row)
        revision = bump_draft_revision(db, ticket["ticket_id"])
        audit_attachment(
            db,
            actor["user_id"],
            attachment,
            "PENDING",
            "TICKET_ATTACHMENT_UPLOADED",
        )

        return mutation_result(attachment, revision)


def download_student_attachment(
    current_user: dict[str, Any],
    ticket_number: str,
    attachment_id: UUID,
) -> tuple[dict[str, Any], bytes]:
    with attachment_transaction() as db:
        _, ticket = owned_ticket(
            db, current_user, ticket_number, write=False,
        )
        attachment = load_attachment(
            db, ticket["ticket_id"], str(attachment_id),
        )

        if attachment is None or attachment["upload_state"] != "READY":
            raise HTTPException(404, "Attachment not found or not available.")

        if attachment["storage_bucket"] != ATTACHMENT_BUCKET:
            raise HTTPException(503, "Attachment storage is unavailable.")

        with AttachmentStorage() as storage:
            content = storage.download(attachment["file_path"])

        if (
            len(content) != attachment["file_size"]
            or hashlib.sha256(content).hexdigest()
            != attachment["content_sha256"]
        ):
            raise HTTPException(
                503,
                "The attachment could not be verified. Please try again later.",
            )

        return public_attachment(attachment), content


def remove_student_attachment(
    current_user: dict[str, Any],
    ticket_number: str,
    attachment_id: UUID,
    expected_revision: int,
) -> dict[str, Any]:
    upload_id = str(attachment_id)

    with attachment_transaction() as db:
        actor, ticket = owned_ticket(
            db, current_user, ticket_number, write=True,
        )
        attachment = load_attachment(db, ticket["ticket_id"], upload_id)

        if attachment is None:
            raise HTTPException(404, "Attachment not found.")

        if attachment["upload_state"] == "REMOVED":
            return {
                "attachment_id": upload_id,
                "removed": True,
                "draft_revision": ticket["draft_revision"],
            }

        require_editable_draft(ticket)

        if attachment["upload_state"] != "REMOVING":
            require_revision(ticket, expected_revision)
            previous_state = attachment["upload_state"]

            row = db.execute(
                text("""
                    UPDATE public.query_attachments
                    SET upload_state = 'REMOVING'
                    WHERE attachment_id = CAST(:attachment_id AS UUID)
                    RETURNING
                """ + ATTACHMENT_COLUMNS),
                {"attachment_id": upload_id},
            ).mappings().one()

            attachment = dict(row)
            bump_draft_revision(db, ticket["ticket_id"])
            audit_attachment(
                db,
                actor["user_id"],
                attachment,
                previous_state,
                "TICKET_ATTACHMENT_REMOVING",
            )

    with attachment_transaction() as db:
        actor, ticket = owned_ticket(
            db, current_user, ticket_number, write=True,
        )
        attachment = load_attachment(db, ticket["ticket_id"], upload_id)

        if attachment is None:
            raise HTTPException(404, "Attachment not found.")

        if attachment["upload_state"] == "REMOVED":
            return {
                "attachment_id": upload_id,
                "removed": True,
                "draft_revision": ticket["draft_revision"],
            }

        require_editable_draft(ticket)

        if attachment["upload_state"] != "REMOVING":
            raise HTTPException(409, "Reload the attachments before retrying.")

        if attachment["storage_bucket"] != ATTACHMENT_BUCKET:
            raise StorageError("Unexpected attachment bucket.")

        with AttachmentStorage() as storage:
            storage.remove(attachment["file_path"])

            try:
                storage.download(attachment["file_path"])
            except StorageObjectNotFound:
                pass
            else:
                raise StorageError("Attachment removal is not yet confirmed.")

        row = db.execute(
            text("""
                UPDATE public.query_attachments
                SET
                    upload_state = 'REMOVED',
                    removed_at = clock_timestamp()
                WHERE attachment_id = CAST(:attachment_id AS UUID)
                RETURNING
            """ + ATTACHMENT_COLUMNS),
            {"attachment_id": upload_id},
        ).mappings().one()

        attachment = dict(row)
        revision = bump_draft_revision(db, ticket["ticket_id"])
        audit_attachment(
            db,
            actor["user_id"],
            attachment,
            "REMOVING",
            "TICKET_ATTACHMENT_REMOVED",
        )

        return {
            "attachment_id": upload_id,
            "removed": True,
            "draft_revision": revision,
        }


def submit_draft_with_attachments(
    current_user: dict[str, Any],
    ticket_number: str,
    data: DraftSubmit,
) -> tuple[dict[str, Any], bool]:
    try:
        return submit_student_draft(
            current_user,
            ticket_number,
            data,
        )
    except HTTPException as exc:
        original = getattr(exc.__cause__, "orig", None)
        diagnostic = getattr(original, "diag", None)

        if (
            exc.status_code == 503
            and getattr(diagnostic, "constraint_name", None)
            == "sq_ticket_attachments_complete"
        ):
            raise HTTPException(
                409,
                "Finish or remove pending attachments before "
                "submitting this draft.",
            ) from exc

        raise