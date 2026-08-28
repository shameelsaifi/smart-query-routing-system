from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.core.rbac import require_role
from app.schemas.ticket import TicketCreate, TicketCreateResponse
from app.services.processing_pipeline_service import (
    process_ticket_pipeline,
)
from app.services.ticket_service import (
    create_ticket,
    get_assigned_tickets,
)
from app.services.ticket_workflow_service import (
    resolve_ticket,
    start_ticket,
    get_hod_dashboard_stats,
    approve_or_reassign_ticket,
)


router = APIRouter()


@router.post(
    "",
    response_model=TicketCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new student query",
)
async def submit_ticket(
    ticket_data: TicketCreate,
    background_tasks: BackgroundTasks,
    current_user: dict[str, Any] = Depends(
        require_role("STUDENT")
    ),
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


@router.get(
    "/assigned-to-me",
    summary="Get tickets assigned to current officer",
)
async def assigned_to_me(
    current_user: dict[str, Any] = Depends(
        require_role("DEPARTMENT_STAFF")
    ),
) -> list[dict[str, Any]]:
    return get_assigned_tickets(current_user)


@router.patch(
    "/{ticket_number}/start",
    summary="Start work on an assigned ticket",
)
async def start_assigned_ticket(
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
async def resolve_assigned_ticket(
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
    summary="Get comprehensive HOD dashboard stats and queues",
)
async def get_hod_dashboard(
    current_user: dict[str, Any] = Depends(require_role("HOD"))
) -> dict[str, Any]:
    return get_hod_dashboard_stats(current_user)

@router.patch(
    "/{ticket_number}/hod-action",
    summary="HOD actions: Approve, Reject, or Reassign",
)
async def perform_hod_action(
    ticket_number: str,
    action: str, 
    new_officer_id: str = None,
    current_user: dict[str, Any] = Depends(require_role("HOD"))
) -> dict[str, Any]:
    return approve_or_reassign_ticket(
        ticket_number=ticket_number, 
        action=action.upper(), 
        new_officer_id=new_officer_id, 
        current_user=current_user
    )    