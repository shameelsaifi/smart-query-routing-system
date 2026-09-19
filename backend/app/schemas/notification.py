from datetime import datetime

from pydantic import BaseModel, Field


class NotificationItem(BaseModel):
    notification_id: str

    ticket_id: str | None = None
    ticket_number: str | None = None
    response_id: str | None = None

    event_key: str
    notification_type: str

    title: str
    message: str

    is_read: bool
    read_at: datetime | None = None

    created_at: datetime
    sent_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationItem]

    total: int = Field(
        ge=0,
    )

    unread_count: int = Field(
        ge=0,
    )


class NotificationUnreadCount(BaseModel):
    unread_count: int = Field(
        ge=0,
    )


class MarkAllNotificationsReadResponse(BaseModel):
    updated_count: int = Field(
        ge=0,
    )