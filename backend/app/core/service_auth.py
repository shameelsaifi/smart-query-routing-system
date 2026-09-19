from secrets import compare_digest
from typing import Annotated

from fastapi import (
    HTTPException,
    Security,
)
from fastapi.security import APIKeyHeader

from app.core.config import settings


email_intake_header = APIKeyHeader(
    name="X-Email-Intake-Key",
    scheme_name="EmailIntakeKey",
    description=(
        "Server-to-server credential "
        "for email intake."
    ),
    auto_error=False,
)


email_delivery_header = APIKeyHeader(
    name="X-Email-Delivery-Key",
    scheme_name="EmailDeliveryKey",
    description=(
        "Server-to-server credential "
        "for outbound email delivery."
    ),
    auto_error=False,
)


def _validate_service_key(
    provided: str | None,
    expected_secret,
    *,
    service_name: str,
) -> None:
    expected = (
        expected_secret.get_secret_value()
        if expected_secret
        else ""
    )

    if (
        len(expected) < 32
        or expected != expected.strip()
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                f"{service_name} "
                "authentication is not configured."
            ),
            headers={
                "Cache-Control": "no-store",
            },
        )

    if (
        not provided
        or not compare_digest(
            provided.encode("utf-8"),
            expected.encode("utf-8"),
        )
    ):
        raise HTTPException(
            status_code=401,
            detail=(
                f"Invalid or missing "
                f"{service_name.lower()} key."
            ),
            headers={
                "WWW-Authenticate": "APIKey",
                "Cache-Control": "no-store",
            },
        )


def require_email_intake_service(
    api_key: Annotated[
        str | None,
        Security(
            email_intake_header
        ),
    ],
) -> str:
    _validate_service_key(
        api_key,
        settings.email_intake_api_key,
        service_name="Email intake",
    )

    return "EMAIL_INTAKE"


def require_email_delivery_service(
    api_key: Annotated[
        str | None,
        Security(
            email_delivery_header
        ),
    ],
) -> str:
    _validate_service_key(
        api_key,
        settings.email_delivery_api_key,
        service_name="Email delivery",
    )

    return "EMAIL_DELIVERY"