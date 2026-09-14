from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


TicketStatus = Literal[
    "DRAFT", "PENDING", "CLASSIFIED", "ROUTED", "IN_PROGRESS",
    "NEEDS_INFORMATION", "ESCALATED", "RESOLVED", "CLOSED",
]


class StudentTicketFilters(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    page: int = Field(default=1, ge=1, le=100000)
    page_size: int = Field(default=10, ge=1, le=50)
    search: str = Field(default="", max_length=100)
    status: TicketStatus | None = None
    source: Literal["WEB", "EMAIL"] | None = None


class StudentTicketItem(BaseModel):
    ticket_id: str
    ticket_number: str
    subject: str
    status: TicketStatus
    source: Literal["WEB", "EMAIL"]
    category: str | None
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] | None
    department_name: str | None
    desk_name: str | None
    created_at: datetime
    submitted_at: datetime | None
    updated_at: datetime


class StudentTicketPage(BaseModel):
    items: list[StudentTicketItem]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=50)
    total_pages: int = Field(ge=1)