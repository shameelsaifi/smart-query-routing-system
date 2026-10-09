from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class HodAuditLogItem(BaseModel):
    audit_id: UUID
    event_sequence: int

    actor_user_id: UUID | None = None
    actor_name: str | None = None
    actor_email: str | None = None
    actor_role: str | None = None
    actor_service: str | None = None

    action: str

    entity_type: str
    entity_id: UUID | None = None

    ticket_number: str | None = None

    outcome: str

    old_values: dict[str, Any] | None = None
    new_values: dict[str, Any] | None = None

    details: dict[str, Any] = Field(
        default_factory=dict,
    )

    created_at: datetime


class HodAuditLogListResponse(BaseModel):
    items: list[HodAuditLogItem]

    total: int = Field(
        ge=0,
    )

    page: int = Field(
        ge=1,
    )

    page_size: int = Field(
        ge=1,
    )

    total_pages: int = Field(
        ge=0,
    )