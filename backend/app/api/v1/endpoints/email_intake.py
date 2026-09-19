from fastapi import (
    APIRouter,
    Depends,
    Response,
    status,
)

from app.core.service_auth import (
    require_email_intake_service,
)
from app.schemas.email_intake import (
    SimulatedEmailCreate,
    SimulatedEmailResponse,
)
from app.services.email_intake_service import (
    create_email_ticket,
)


router = APIRouter(
    dependencies=[
        Depends(require_email_intake_service)
    ],
)


@router.get(
    "/auth-check",
    summary=(
        "Verify the email intake credential "
        "without creating a ticket"
    ),
)
def email_intake_auth_check(
    response: Response,
) -> dict[str, str]:
    response.headers["Cache-Control"] = "no-store"

    return {
        "status": "ok",
        "service": "EMAIL_INTAKE",
    }


@router.post(
    "/receive",
    response_model=SimulatedEmailResponse,
    status_code=status.HTTP_201_CREATED,
    summary=(
        "Receive an authenticated inbound email "
        "and create or return its ticket"
    ),
)
def receive_email_intake(
    email_data: SimulatedEmailCreate,
) -> SimulatedEmailResponse:
    ticket = create_email_ticket(
        email_data
    )

    return SimulatedEmailResponse(
        **ticket
    )


@router.post(
    "/simulate",
    response_model=SimulatedEmailResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def simulate_email_intake(
    email_data: SimulatedEmailCreate,
) -> SimulatedEmailResponse:
    """
    Backward-compatible prototype endpoint.

    New integrations should use /receive.
    """

    ticket = create_email_ticket(
        email_data
    )

    return SimulatedEmailResponse(
        **ticket
    )