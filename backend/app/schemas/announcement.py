from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)


AnnouncementAudience = Literal[
    "ALL",
    "STUDENTS",
    "STAFF",
    "HODS",
]


class AnnouncementCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=200,
    )

    message: str = Field(
        min_length=1,
        max_length=5000,
    )

    audience: AnnouncementAudience

    @field_validator(
        "title",
        "message",
    )
    @classmethod
    def clean_text(
        cls,
        value: str,
    ) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "Value cannot be empty."
            )

        return cleaned


class AnnouncementItem(BaseModel):
    announcement_id: str

    title: str
    message: str
    audience: AnnouncementAudience

    recipient_count: int

    is_active: bool

    created_by_user_id: str

    created_by_name: str | None = None
    created_by_email: str | None = None

    created_at: datetime


class AnnouncementListResponse(BaseModel):
    items: list[AnnouncementItem]