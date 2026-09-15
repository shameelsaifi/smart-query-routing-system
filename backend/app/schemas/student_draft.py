from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, UUID4, model_validator

from app.schemas.student_ticket import TicketStatus
from app.schemas.ticket import TicketCreate, TicketCreateResponse


class DraftContent(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    subject: str = Field(default="", max_length=200)
    message: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def require_some_content(self) -> Self:
        if not self.subject or not self.subject.strip():
            if not self.message or not self.message.strip():
                raise ValueError(
                    "Enter a subject or message before saving a draft."
                )
        return self


class DraftCreate(DraftContent):
    request_id: UUID4


class DraftUpdate(DraftContent):
    expected_revision: int = Field(ge=1, le=2147483646)


class DraftSubmit(TicketCreate):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    expected_revision: int = Field(ge=1, le=2147483646)


class StudentDraftRecord(BaseModel):
    ticket_id: str
    ticket_number: str
    subject: str
    message: str
    source: Literal["WEB"]
    status: TicketStatus
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
    draft_revision: int = Field(ge=1)


class StudentDraftSubmission(BaseModel):
    ticket: TicketCreateResponse
    submitted_now: bool