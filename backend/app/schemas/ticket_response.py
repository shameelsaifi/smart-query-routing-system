from datetime import datetime
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class TicketResponseDraftUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    final_response_text: str = Field(
        min_length=1,
        max_length=10000,
    )

    expected_revision: int | None = Field(
        default=None,
        ge=0,
    )

    @field_validator("final_response_text")
    @classmethod
    def clean_response_text(
        cls,
        value: str,
    ) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "Final response cannot be empty."
            )

        return cleaned


class TicketResponseApprove(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    expected_revision: int = Field(
        ge=1,
    )


class TicketResponseView(BaseModel):
    response_id: UUID | None = None

    ticket_number: str
    ticket_status: str

    response_type: str = "FINAL"

    recipient_email: str | None = None

    ai_draft_text: str | None = None
    final_response_text: str | None = None

    approval_status: str
    delivery_status: str

    revision: int

    approved_at: datetime | None = None
    sent_at: datetime | None = None

    editable: bool
    approvable: bool