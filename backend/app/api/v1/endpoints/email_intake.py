from fastapi import APIRouter, BackgroundTasks, Depends, Response, status

from app.core.service_auth import require_email_intake_service
from app.schemas.email_intake import (
    SimulatedEmailCreate,
    SimulatedEmailResponse,
)
from app.services.email_intake_service import create_email_ticket
from app.services.processing_pipeline_service import process_ticket_pipeline


router = APIRouter(
    dependencies=[Depends(require_email_intake_service)],
)


@router.get(
    "/auth-check",
    summary="Verify the email intake credential without creating a ticket",
)
def email_intake_auth_check(response: Response) -> dict[str, str]:
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok", "service": "EMAIL_INTAKE"}


@router.post(
    "/simulate",
    response_model=SimulatedEmailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Receive prototype email intake from an authenticated service",
)
def simulate_email_intake(
    email_data: SimulatedEmailCreate,
    background_tasks: BackgroundTasks,
) -> SimulatedEmailResponse:
    ticket = create_email_ticket(email_data)

    background_tasks.add_task(
        process_ticket_pipeline,
        ticket["ticket_number"],
    )

    return SimulatedEmailResponse(**ticket)