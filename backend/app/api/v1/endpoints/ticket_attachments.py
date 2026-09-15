import asyncio
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    Request,
    Response,
)
from pydantic import UUID4
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.requests import ClientDisconnect

from app.core.rbac import require_role
from app.services.attachment_storage_service import MAX_ATTACHMENT_BYTES
from app.services.ticket_attachment_service import (
    check_attachment_access,
    download_student_attachment,
    get_student_attachments,
    remove_student_attachment,
    upload_student_attachment,
)


router = APIRouter(prefix="/{ticket_number}/attachments")

TicketNumber = Annotated[str, Path(min_length=1, max_length=50)]
ExpectedRevision = Annotated[int, Query(ge=1, le=2147483646)]

MAX_MULTIPART_BYTES = MAX_ATTACHMENT_BYTES + 65536


async def read_bounded_body(request: Request) -> bytes:
    content_encoding = request.headers.get(
        "content-encoding", "identity",
    ).strip().lower()

    if content_encoding != "identity":
        raise HTTPException(415, "Encoded upload requests are not supported.")

    content_type = request.headers.get(
        "content-type", "",
    ).split(";", 1)[0].strip().lower()

    if content_type != "multipart/form-data":
        raise HTTPException(415, "Upload the file as multipart form data.")

    declared_length = request.headers.get("content-length")

    if declared_length is not None:
        if (
            len(declared_length) > 20
            or not declared_length.isascii()
            or not declared_length.isdigit()
        ):
            raise HTTPException(400, "Invalid upload request length.")

        if int(declared_length) > MAX_MULTIPART_BYTES:
            raise HTTPException(413, "Each attachment must be 5 MB or smaller.")

    payload = bytearray()

    try:
        async with asyncio.timeout(45):
            async for chunk in request.stream():
                if len(payload) + len(chunk) > MAX_MULTIPART_BYTES:
                    raise HTTPException(
                        413,
                        "Each attachment must be 5 MB or smaller.",
                    )

                payload.extend(chunk)

    except TimeoutError as exc:
        raise HTTPException(
            408,
            "The upload took too long. Please retry.",
        ) from exc

    except ClientDisconnect as exc:
        raise HTTPException(
            400,
            "The upload connection was interrupted.",
        ) from exc

    return bytes(payload)


@router.get(
    "",
    summary="List attachments for the current student's ticket",
)
def list_attachments(
    response: Response,
    ticket_number: TicketNumber,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    return get_student_attachments(current_user, ticket_number)


@router.put(
    "/{attachment_id}",
    summary="Upload or retry an attachment on a saved student draft",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "properties": {
                            "file": {
                                "type": "string",
                                "format": "binary",
                            }
                        },
                    }
                }
            },
        }
    },
)
async def upload_attachment(
    request: Request,
    response: Response,
    ticket_number: TicketNumber,
    attachment_id: UUID4,
    expected_revision: ExpectedRevision,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"

    # Authorize the ticket before reading the uploaded body.
    await run_in_threadpool(
        check_attachment_access,
        current_user,
        ticket_number,
    )

    body = await read_bounded_body(request)
    delivered = False

    async def receive() -> dict[str, Any]:
        nonlocal delivered

        if delivered:
            return {
                "type": "http.request",
                "body": b"",
                "more_body": False,
            }

        delivered = True
        return {
            "type": "http.request",
            "body": body,
            "more_body": False,
        }

    bounded_request = Request(request.scope, receive)

    async with bounded_request.form(
        max_files=1,
        max_fields=0,
        max_part_size=1024,
    ) as form:
        parts = list(form.multi_items())

        if (
            len(parts) != 1
            or parts[0][0] != "file"
            or not isinstance(parts[0][1], UploadFile)
        ):
            raise HTTPException(
                422,
                "Send exactly one file using the 'file' form field.",
            )

        uploaded_file = parts[0][1]
        file_name = uploaded_file.filename or ""
        declared_type = uploaded_file.content_type
        content = await uploaded_file.read(MAX_ATTACHMENT_BYTES + 1)

        if len(content) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(
                413,
                "Each attachment must be 5 MB or smaller.",
            )

    return await run_in_threadpool(
        upload_student_attachment,
        current_user,
        ticket_number,
        attachment_id,
        expected_revision,
        file_name,
        declared_type,
        content,
    )


@router.get(
    "/{attachment_id}/download",
    summary="Download an attachment belonging to the current student",
    response_class=Response,
)
def download_attachment(
    ticket_number: TicketNumber,
    attachment_id: UUID4,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> Response:
    attachment, content = download_student_attachment(
        current_user,
        ticket_number,
        attachment_id,
    )

    extension = {
        "application/pdf": ".pdf",
        "image/png": ".png",
        "image/jpeg": ".jpg",
    }[attachment["mime_type"]]

    encoded_name = quote(attachment["file_name"], safe="")

    return Response(
        content=content,
        media_type=attachment["mime_type"],
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": (
                f'attachment; filename="attachment{extension}"; '
                f"filename*=UTF-8''{encoded_name}"
            ),
        },
    )


@router.delete(
    "/{attachment_id}",
    summary="Remove or retry removal of an attachment from a saved draft",
)
def remove_attachment(
    response: Response,
    ticket_number: TicketNumber,
    attachment_id: UUID4,
    expected_revision: ExpectedRevision,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"

    return remove_student_attachment(
        current_user,
        ticket_number,
        attachment_id,
        expected_revision,
    )