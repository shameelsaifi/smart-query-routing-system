from datetime import datetime
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class EmailDeliveryQueueResponse(BaseModel):
    response_id: UUID
    ticket_number: str
    delivery_job_id: UUID

    delivery_status: str
    job_status: str

    attempt_count: int
    max_attempts: int


class EmailDeliveryClaimResponse(BaseModel):
    delivery_job_id: UUID
    lease_token: UUID

    response_id: UUID
    ticket_id: UUID

    ticket_number: str
    response_type: str

    recipient_email: str
    gmail_account_email: str

    subject: str
    body: str

    attempt_count: int
    max_attempts: int

    lease_expires_at: datetime


class EmailDeliverySentCallback(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    lease_token: UUID

    gmail_message_id: str = Field(
        min_length=1,
        max_length=255,
    )

    gmail_thread_id: str | None = Field(
        default=None,
        max_length=255,
    )

    @field_validator(
        "gmail_message_id",
        "gmail_thread_id",
    )
    @classmethod
    def clean_identifier(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        if not cleaned:
            return None

        return cleaned


class EmailDeliveryFailedCallback(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    lease_token: UUID

    failure_reason: str = Field(
        min_length=1,
        max_length=2000,
    )

    @field_validator(
        "failure_reason",
    )
    @classmethod
    def clean_failure_reason(
        cls,
        value: str,
    ) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "Failure reason cannot be empty."
            )

        return cleaned


class EmailDeliveryCallbackResponse(BaseModel):
    delivery_job_id: UUID
    response_id: UUID
    ticket_number: str

    delivery_status: str
    job_status: str

    attempt_count: int
    max_attempts: int

    retry_scheduled: bool = False

    sent_at: datetime | None = None