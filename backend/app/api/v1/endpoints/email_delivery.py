from typing import Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Response,
    status,
)

from app.core.rbac import require_role
from app.core.service_auth import (
    require_email_delivery_service,
)
from app.schemas.email_delivery import (
    EmailDeliveryCallbackResponse,
    EmailDeliveryClaimResponse,
    EmailDeliveryFailedCallback,
    EmailDeliveryQueueResponse,
    EmailDeliverySentCallback,
)
from app.services.email_delivery_service import (
    claim_next_email_delivery,
    mark_email_delivery_failed,
    mark_email_delivery_sent,
    queue_response_delivery,
)


router = APIRouter()


@router.get(
    "/auth-check",
    summary=(
        "Verify the outbound email "
        "delivery service credential"
    ),
)
def email_delivery_auth_check(
    response: Response,
    _service: str = Depends(
        require_email_delivery_service
    ),
) -> dict[str, str]:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return {
        "status": "ok",
        "service": "EMAIL_DELIVERY",
    }


@router.post(
    "/responses/{response_id}/queue",
    response_model=EmailDeliveryQueueResponse,
    summary=(
        "Queue an approved response "
        "for Gmail delivery"
    ),
)
def queue_email_response(
    response_id: UUID,
    current_user: dict[str, Any] = Depends(
        require_role(
            "DEPARTMENT_STAFF",
            "INSTRUCTOR",
        )
    ),
) -> EmailDeliveryQueueResponse:
    return EmailDeliveryQueueResponse.model_validate(
        queue_response_delivery(
            response_id,
            current_user,
        )
    )


@router.post(
    "/claim",
    response_model=EmailDeliveryClaimResponse,
    responses={
        204: {
            "description": (
                "No delivery job is ready."
            ),
        },
    },
    summary=(
        "Lease the next queued email "
        "delivery job"
    ),
)
def claim_email_delivery(
    _service: str = Depends(
        require_email_delivery_service
    ),
):
    result = claim_next_email_delivery()

    if result is None:
        return Response(
            status_code=status.HTTP_204_NO_CONTENT
        )

    return EmailDeliveryClaimResponse.model_validate(
        result
    )


@router.post(
    "/jobs/{delivery_job_id}/sent",
    response_model=EmailDeliveryCallbackResponse,
    summary=(
        "Record successful Gmail delivery"
    ),
)
def email_delivery_sent(
    delivery_job_id: UUID,
    data: EmailDeliverySentCallback,
    _service: str = Depends(
        require_email_delivery_service
    ),
) -> EmailDeliveryCallbackResponse:
    return EmailDeliveryCallbackResponse.model_validate(
        mark_email_delivery_sent(
            delivery_job_id,
            data,
        )
    )


@router.post(
    "/jobs/{delivery_job_id}/failed",
    response_model=EmailDeliveryCallbackResponse,
    summary=(
        "Record failed Gmail delivery"
    ),
)
def email_delivery_failed(
    delivery_job_id: UUID,
    data: EmailDeliveryFailedCallback,
    _service: str = Depends(
        require_email_delivery_service
    ),
) -> EmailDeliveryCallbackResponse:
    return EmailDeliveryCallbackResponse.model_validate(
        mark_email_delivery_failed(
            delivery_job_id,
            data,
        )
    )