from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Path,
    Query,
    Response,
    status,
)

from app.api.v1.endpoints.student_drafts import (
    router as student_drafts_router,
)
from app.api.v1.endpoints.ticket_attachments import (
    router as ticket_attachments_router,
)
from app.core.rbac import require_role
from app.core.service_auth import require_email_intake_service
from app.schemas.student_ticket import StudentTicketFilters, StudentTicketPage
from app.schemas.student_ticket_detail import (
    StudentTicketDetailFilters,
    StudentTicketDetails,
)
from app.schemas.ticket import TicketCreate, TicketCreateResponse
from app.services.processing_pipeline_service import process_ticket_pipeline
from app.services.student_ticket_detail_service import get_student_ticket_details
from app.services.student_ticket_service import get_student_tickets
from app.services.ticket_service import create_ticket, get_assigned_tickets
from app.services.ticket_workflow_service import (
    approve_or_reassign_ticket,
    get_hod_dashboard_stats,
    resolve_ticket,
    start_ticket,
)


router = APIRouter()

router.include_router(student_drafts_router)
router.include_router(ticket_attachments_router)


@router.get(
    "",
    response_model=StudentTicketPage,
    summary="Get the current student's ticket history",
)
def student_ticket_history(
    response: Response,
    filters: Annotated[StudentTicketFilters, Query()],
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> StudentTicketPage:
    response.headers["Cache-Control"] = "no-store"
    return get_student_tickets(current_user, filters)


@router.post(
    "",
    response_model=TicketCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new student query",
)
def submit_ticket(
    ticket_data: TicketCreate,
    background_tasks: BackgroundTasks,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> TicketCreateResponse:
    ticket = create_ticket(
        current_user=current_user,
        ticket_data=ticket_data,
    )

    background_tasks.add_task(
        process_ticket_pipeline,
        ticket["ticket_number"],
    )

    return TicketCreateResponse(**ticket)


@router.post(
    "/email-ingest",
    deprecated=True,
    dependencies=[Depends(require_email_intake_service)],
    summary="Retired prototype email endpoint",
)
def ingest_email_ticket() -> None:
    raise HTTPException(
        status_code=410,
        detail=(
            "This endpoint is retired. "
            "Use the email-intake/simulate endpoint."
        ),
    )


@router.get(
    "/assigned-to-me",
    summary="Get tickets assigned to current officer",
)
def assigned_to_me(
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF")
    ),
) -> list[dict[str, Any]]:
    return get_assigned_tickets(current_user)


@router.patch(
    "/{ticket_number}/start",
    summary="Start work on an assigned ticket",
)
def start_assigned_ticket(
    ticket_number: str,
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF")
    ),
) -> dict[str, Any]:
    return start_ticket(
        ticket_number=ticket_number,
        current_user=current_user,
    )


@router.patch(
    "/{ticket_number}/resolve",
    summary="Resolve an assigned ticket",
)
def resolve_assigned_ticket(
    ticket_number: str,
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF")
    ),
) -> dict[str, Any]:
    return resolve_ticket(
        ticket_number=ticket_number,
        current_user=current_user,
    )


@router.get(
    "/hod/dashboard",
    summary="Get HOD dashboard stats and queues",
)
def get_hod_dashboard(
    current_user: dict[str, Any] = Depends(require_role("HOD")),
) -> dict[str, Any]:
    return get_hod_dashboard_stats(current_user)


@router.patch(
    "/{ticket_number}/hod-action",
    summary="HOD actions: Approve, Reject, or Reassign",
)
def perform_hod_action(
    ticket_number: str,
    action: str,
    new_officer_id: str | None = None,
    current_user: dict[str, Any] = Depends(require_role("HOD")),
) -> dict[str, Any]:
    return approve_or_reassign_ticket(
        ticket_number=ticket_number,
        action=action,
        new_officer_id=new_officer_id,
        current_user=current_user,
    )


@router.get(
    "/{ticket_number}",
    response_model=StudentTicketDetails,
    summary="Get the current student's ticket details and status history",
)
def student_ticket_details(
    response: Response,
    ticket_number: Annotated[str, Path(min_length=1, max_length=50)],
    filters: Annotated[StudentTicketDetailFilters, Query()],
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> StudentTicketDetails:
    response.headers["Cache-Control"] = "no-store"

    return get_student_ticket_details(
        current_user,
        ticket_number,
        filters,
    )