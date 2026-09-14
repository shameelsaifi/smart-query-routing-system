from secrets import compare_digest
from typing import Annotated

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from app.core.config import settings


email_intake_header = APIKeyHeader(
    name="X-Email-Intake-Key",
    scheme_name="EmailIntakeKey",
    description="Server-to-server credential for email intake.",
    auto_error=False,
)


def require_email_intake_service(
    api_key: Annotated[str | None, Security(email_intake_header)],
) -> str:
    secret = settings.email_intake_api_key
    expected = secret.get_secret_value() if secret else ""

    if len(expected) < 32 or expected != expected.strip():
        raise HTTPException(
            status_code=503,
            detail="Email intake authentication is not configured.",
            headers={"Cache-Control": "no-store"},
        )

    if not api_key or not compare_digest(
        api_key.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing email intake key.",
            headers={
                "WWW-Authenticate": "APIKey",
                "Cache-Control": "no-store",
            },
        )

    return "EMAIL_INTAKE"