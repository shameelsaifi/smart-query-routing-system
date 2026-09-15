from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.student_ticket import StudentTicketItem, TicketStatus


class StudentTicketDetailFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    before_sequence: int | None = Field(
        default=None,
        ge=1,
        le=9223372036854775807,
    )


class StudentTicketRecord(StudentTicketItem):
    message: str
    sla_due_at: datetime | None
    resolved_at: datetime | None
    closed_at: datetime | None


class StudentTicketStatusEvent(BaseModel):
    history_id: str
    sequence: str
    previous_status: TicketStatus | None
    new_status: TicketStatus
    changed_at: datetime


class StudentTicketDetails(BaseModel):
    ticket: StudentTicketRecord
    history: list[StudentTicketStatusEvent]
    next_before_sequence: str | None = None