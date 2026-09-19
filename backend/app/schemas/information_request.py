from datetime import datetime
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class InformationRequestCreate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    message: str = Field(
        min_length=1,
        max_length=5000,
    )

    @field_validator("message")
    @classmethod
    def clean_message(
        cls,
        value: str,
    ) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "Information request cannot be empty."
            )

        return cleaned


class InformationRequestView(BaseModel):
    response_id: UUID

    ticket_number: str
    ticket_status: str

    response_type: str

    recipient_email: str

    message: str

    approval_status: str
    delivery_status: str

    revision: int

    approved_at: datetime