from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    Response,
    status,
)

from app.api.v1.endpoints.student_drafts import router as student_drafts_router
from app.api.v1.endpoints.ticket_attachments import router as ticket_attachments_router
from app.api.v1.endpoints.ticket_responses import router as ticket_responses_router

from app.core.rbac import require_role
from app.core.service_auth import require_email_intake_service

from app.schemas.student_ticket import StudentTicketFilters, StudentTicketPage
from app.schemas.student_ticket_detail import (
    StudentTicketDetailFilters,
    StudentTicketDetails,
)
from app.schemas.ticket import TicketCreate, TicketCreateResponse

from app.services.admin_escalation_service import (
    get_admin_escalation_options,
    get_admin_escalation_review,
    perform_admin_escalation_action,
)
from app.services.student_ticket_detail_service import get_student_ticket_details
from app.services.staff_escalation_service import escalate_ticket_to_hod
from app.services.student_ticket_service import get_student_tickets
from app.services.ticket_service import create_ticket, get_assigned_tickets
from app.services.ticket_workflow_service import (
    approve_or_reassign_ticket,
    get_hod_dashboard_stats,
    resolve_ticket,
    start_ticket,
)
from app.services.staff_report_service import (
    build_staff_excel_report,
    build_staff_pdf_report,
)

router = APIRouter()
router.include_router(student_drafts_router)
router.include_router(ticket_attachments_router)
router.include_router(ticket_responses_router)


@router.get("", response_model=StudentTicketPage,
            summary="Get the current student's ticket history")
def student_ticket_history(
    response: Response,
    filters: Annotated[StudentTicketFilters, Query()],
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> StudentTicketPage:
    response.headers["Cache-Control"] = "no-store"
    return get_student_tickets(current_user, filters)


@router.post("", response_model=TicketCreateResponse,
             status_code=status.HTTP_201_CREATED,
             summary="Submit a new student query")
def submit_ticket(
    ticket_data: TicketCreate,
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> TicketCreateResponse:
    ticket = create_ticket(current_user=current_user, ticket_data=ticket_data)
    return TicketCreateResponse(**ticket)


@router.post(
    "/email-ingest", deprecated=True,
    dependencies=[Depends(require_email_intake_service)],
    summary="Retired prototype email endpoint",
)
def ingest_email_ticket() -> None:
    raise HTTPException(
        status_code=410,
        detail="This endpoint is retired. Use the email-intake/simulate endpoint.",
    )


@router.get(
    "/assigned-to-me",
    summary="Get tickets assigned to the current staff member or instructor",
)
def assigned_to_me(
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF", "INSTRUCTOR")
    ),
) -> list[dict[str, Any]]:
    return get_assigned_tickets(current_user)


# Staff/Instructor scoped exports; these never call the Admin reporting service.
# Paths are static and placed before the generic /{ticket_number} details route.
@router.get("/reports/excel", summary="Export assigned staff queries as Excel")
def export_staff_excel(
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF", "INSTRUCTOR")
    ),
    search: str = Query(default="", max_length=200),
    source: str = Query(default="ALL", pattern="^(ALL|WEB|EMAIL)$"),
    priority: str = Query(default="ALL", pattern="^(ALL|LOW|MEDIUM|HIGH|URGENT)$"),
    status_filter: str = Query(
        default="OPEN", alias="status",
        pattern="^(ALL|OPEN|PENDING|CLASSIFIED|ROUTED|IN_PROGRESS|NEEDS_INFORMATION|ESCALATED|RESOLVED|CLOSED)$",
    ),
    sla_only: bool = Query(default=False),
) -> Response:
    filters = {
        "search": search, "source": source, "priority": priority,
        "status": status_filter, "sla_only": sla_only,
    }
    report = build_staff_excel_report(current_user, filters)
    return Response(
        content=report["content"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{report["filename"]}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/reports/pdf", summary="Export assigned staff queries as PDF")
def export_staff_pdf(
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF", "INSTRUCTOR")
    ),
    search: str = Query(default="", max_length=200),
    source: str = Query(default="ALL", pattern="^(ALL|WEB|EMAIL)$"),
    priority: str = Query(default="ALL", pattern="^(ALL|LOW|MEDIUM|HIGH|URGENT)$"),
    status_filter: str = Query(
        default="OPEN", alias="status",
        pattern="^(ALL|OPEN|PENDING|CLASSIFIED|ROUTED|IN_PROGRESS|NEEDS_INFORMATION|ESCALATED|RESOLVED|CLOSED)$",
    ),
    sla_only: bool = Query(default=False),
) -> Response:
    filters = {
        "search": search, "source": source, "priority": priority,
        "status": status_filter, "sla_only": sla_only,
    }
    report = build_staff_pdf_report(current_user, filters)
    return Response(
        content=report["content"],
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{report["filename"]}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/{ticket_number}/escalate",
    summary="Manually escalate an assigned query to the department HOD",
)
def escalate_assigned_ticket_to_hod(
    ticket_number: str,
    reason: Annotated[str, Query(min_length=5, max_length=500)],
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF", "INSTRUCTOR")
    ),
) -> dict[str, Any]:
    return escalate_ticket_to_hod(
        ticket_number=ticket_number, current_user=current_user, reason=reason,
    )


@router.patch("/{ticket_number}/start", summary="Start work on an assigned ticket")
def start_assigned_ticket(
    ticket_number: str,
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF", "INSTRUCTOR")
    ),
) -> dict[str, Any]:
    return start_ticket(ticket_number=ticket_number, current_user=current_user)


@router.patch("/{ticket_number}/resolve", summary="Resolve a ticket after successful final delivery")
def resolve_assigned_ticket(
    ticket_number: str,
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF", "INSTRUCTOR", "HOD")
    ),
) -> dict[str, Any]:
    return resolve_ticket(ticket_number=ticket_number, current_user=current_user)


@router.get("/admin/escalation-options", summary="Get active staff choices for Admin escalation reassignment")
def admin_escalation_options(
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
) -> dict[str, Any]:
    return get_admin_escalation_options(current_user)


@router.get("/{ticket_number}/admin-escalation-review", summary="Get the active Admin escalation for a query")
def admin_escalation_review(
    ticket_number: str,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
) -> dict[str, Any]:
    return get_admin_escalation_review(ticket_number, current_user)


@router.patch("/{ticket_number}/admin-action", summary="Admin escalation actions: Reassign or Override")
def perform_admin_action(
    ticket_number: str,
    action: str,
    new_officer_id: str | None = None,
    reason: str | None = None,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
) -> dict[str, Any]:
    return perform_admin_escalation_action(
        ticket_number, action, current_user, new_officer_id=new_officer_id, reason=reason,
    )


@router.get("/hod/dashboard", summary="Get HOD dashboard stats and queues")
def get_hod_dashboard(
    current_user: dict[str, Any] = Depends(require_role("HOD")),
) -> dict[str, Any]:
    return get_hod_dashboard_stats(current_user)


@router.patch("/{ticket_number}/hod-action", summary="HOD actions: Approve, Reject, Reassign, Override, or Escalate to Admin")
def perform_hod_action(
    ticket_number: str,
    action: str,
    new_officer_id: str | None = None,
    reason: str | None = None,
    current_user: dict[str, Any] = Depends(require_role("HOD")),
) -> dict[str, Any]:
    return approve_or_reassign_ticket(
        ticket_number=ticket_number, action=action, new_officer_id=new_officer_id,
        reason=reason, current_user=current_user,
    )


# Keep this generic ticket details route after all specific ticket routes.
@router.get(
    "/{ticket_number}", response_model=StudentTicketDetails,
    summary="Get the current student's ticket details and status history",
)
def student_ticket_details(
    response: Response,
    ticket_number: Annotated[str, Path(min_length=1, max_length=50)],
    filters: Annotated[StudentTicketDetailFilters, Query()],
    current_user: dict[str, Any] = Depends(require_role("STUDENT")),
) -> StudentTicketDetails:
    response.headers["Cache-Control"] = "no-store"
    return get_student_ticket_details(current_user, ticket_number, filters)
