from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path

from app.core.rbac import require_role
from app.schemas.information_request import (
    InformationRequestCreate,
    InformationRequestView,
)
from app.schemas.ticket_response import (
    TicketResponseApprove,
    TicketResponseDraftUpdate,
    TicketResponseView,
)
from app.services.information_exchange_service import (
    get_information_exchange,
)
from app.services.ticket_response_service import (
    approve_ticket_response,
    create_information_request,
    get_ticket_response,
    save_ticket_response,
)


router = APIRouter()

TicketNumber = Annotated[
    str,
    Path(min_length=1, max_length=50),
]


@router.get(
    "/{ticket_number}/information-exchange",
    summary=(
        "Get delivered information requests and "
        "student follow-up replies"
    ),
)
def information_exchange(
    ticket_number: TicketNumber,
    current_user: dict[str, Any] = Depends(
        require_role(
            "STUDENT",
            "DEPARTMENT_STAFF",
            "INSTRUCTOR",
        )
    ),
) -> dict[str, Any]:
    return get_information_exchange(
        current_user,
        ticket_number,
    )


@router.get(
    "/{ticket_number}/response",
    response_model=TicketResponseView,
    summary=(
        "Get the assigned ticket's "
        "final response workspace"
    ),
)
def get_response_workspace(
    ticket_number: TicketNumber,
    current_user: dict[str, Any] = Depends(
        require_role(
            "DEPARTMENT_STAFF",
            "INSTRUCTOR",
            "HOD",
        )
    ),
) -> TicketResponseView:
    return TicketResponseView.model_validate(
        get_ticket_response(
            ticket_number,
            current_user,
        )
    )


@router.put(
    "/{ticket_number}/response",
    response_model=TicketResponseView,
    summary=(
        "Save or update the final "
        "response draft"
    ),
)
def save_response_workspace(
    ticket_number: TicketNumber,
    data: TicketResponseDraftUpdate,
    current_user: dict[str, Any] = Depends(
        require_role(
            "DEPARTMENT_STAFF",
            "INSTRUCTOR",
            "HOD",
        )
    ),
) -> TicketResponseView:
    return TicketResponseView.model_validate(
        save_ticket_response(
            ticket_number,
            current_user,
            data,
        )
    )


@router.post(
    "/{ticket_number}/response/approve",
    response_model=TicketResponseView,
    summary=(
        "Approve a reviewed final response"
    ),
)
def approve_response_workspace(
    ticket_number: TicketNumber,
    data: TicketResponseApprove,
    current_user: dict[str, Any] = Depends(
        require_role(
            "DEPARTMENT_STAFF",
            "INSTRUCTOR",
            "HOD",
        )
    ),
) -> TicketResponseView:
    return TicketResponseView.model_validate(
        approve_ticket_response(
            ticket_number,
            current_user,
            data,
        )
    )


@router.post(
    "/{ticket_number}/information-request",
    response_model=InformationRequestView,
    summary=(
        "Request additional information "
        "from the student"
    ),
)
def request_more_information(
    ticket_number: TicketNumber,
    data: InformationRequestCreate,
    current_user: dict[str, Any] = Depends(
        require_role(
            "DEPARTMENT_STAFF",
            "INSTRUCTOR",
        )
    ),
) -> InformationRequestView:
    return InformationRequestView.model_validate(
        create_information_request(
            ticket_number,
            current_user,
            data.message,
        )
    )
