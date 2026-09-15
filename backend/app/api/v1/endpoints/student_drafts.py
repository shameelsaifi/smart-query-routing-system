from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Path,
    Response,
    status,
)

from app.core.rbac import require_role
from app.schemas.student_draft import (
    DraftCreate,
    DraftSubmit,
    DraftUpdate,
    StudentDraftRecord,
    StudentDraftSubmission,
)
from app.schemas.ticket import TicketCreateResponse
from app.services.processing_pipeline_service import process_ticket_pipeline
from app.services.student_draft_service import (
    create_student_draft,
    get_student_draft,
    update_student_draft,
)
from app.services.ticket_attachment_service import submit_draft_with_attachments


router = APIRouter(prefix="/drafts")

TicketNumber = Annotated[str, Path(min_length=1, max_length=50)]


@router.post(
    "",
    response_model=StudentDraftRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Save a new student query draft",
)
def create_draft(
    data: DraftCreate,
    response: Response,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> StudentDraftRecord:
    draft, created_now = create_student_draft(current_user, data)

    response.headers["Cache-Control"] = "no-store"
    response.status_code = (
        status.HTTP_201_CREATED if created_now else status.HTTP_200_OK
    )

    return draft


@router.get(
    "/{ticket_number}",
    response_model=StudentDraftRecord,
    summary="Get the current student's saved web query",
)
def get_draft(
    response: Response,
    ticket_number: TicketNumber,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> StudentDraftRecord:
    response.headers["Cache-Control"] = "no-store"
    return get_student_draft(current_user, ticket_number)


@router.patch(
    "/{ticket_number}",
    response_model=StudentDraftRecord,
    summary="Update a saved student draft",
)
def update_draft(
    data: DraftUpdate,
    response: Response,
    ticket_number: TicketNumber,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> StudentDraftRecord:
    response.headers["Cache-Control"] = "no-store"

    return update_student_draft(
        current_user,
        ticket_number,
        data,
    )


@router.post(
    "/{ticket_number}/submit",
    response_model=StudentDraftSubmission,
    summary="Submit a saved student draft",
)
def submit_draft(
    data: DraftSubmit,
    response: Response,
    background_tasks: BackgroundTasks,
    ticket_number: TicketNumber,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> StudentDraftSubmission:
    response.headers["Cache-Control"] = "no-store"

    ticket, submitted_now = submit_draft_with_attachments(
        current_user,
        ticket_number,
        data,
    )

    if submitted_now:
        background_tasks.add_task(
            process_ticket_pipeline,
            ticket["ticket_number"],
        )

    return StudentDraftSubmission(
        ticket=TicketCreateResponse(**ticket),
        submitted_now=submitted_now,
    )