from fastapi import APIRouter, BackgroundTasks, status

from app.schemas.email_intake import (
    SimulatedEmailCreate,
    SimulatedEmailResponse,
)
from app.services.email_intake_service import create_email_ticket
from app.services.processing_pipeline_service import (
    process_ticket_pipeline,
)


router = APIRouter()


@router.post(
    "/simulate",
    response_model=SimulatedEmailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Simulate incoming student email",
)
async def simulate_email_intake(
    email_data: SimulatedEmailCreate,
    background_tasks: BackgroundTasks,
) -> SimulatedEmailResponse:
    ticket = create_email_ticket(email_data)

    background_tasks.add_task(
        process_ticket_pipeline,
        ticket["ticket_number"],
    )

    return SimulatedEmailResponse(**ticket)