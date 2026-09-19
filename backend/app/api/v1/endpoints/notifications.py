from typing import Annotated, Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Path,
    Query,
    Response,
)

from app.core.rbac import require_role
from app.schemas.notification import (
    MarkAllNotificationsReadResponse,
    NotificationItem,
    NotificationListResponse,
    NotificationUnreadCount,
)
from app.services.notification_service import (
    get_user_notifications,
    get_user_unread_count,
    mark_all_notifications_read,
    mark_notification_read,
)


router = APIRouter()


notification_user_dependency = require_role(
    "STUDENT",
    "INSTRUCTOR",
    "DEPARTMENT_STAFF",
    "HOD",
    "ADMIN",
)


@router.get(
    "",
    response_model=NotificationListResponse,
    summary=(
        "Get the current user's "
        "in-app notifications"
    ),
)
def list_notifications(
    response: Response,

    current_user: dict[str, Any] = Depends(
        notification_user_dependency
    ),

    limit: Annotated[
        int,
        Query(
            ge=1,
            le=100,
        ),
    ] = 50,
) -> NotificationListResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return NotificationListResponse(
        **get_user_notifications(
            current_user,
            limit,
        )
    )


@router.get(
    "/unread-count",
    response_model=NotificationUnreadCount,
    summary=(
        "Get the current user's "
        "unread notification count"
    ),
)
def unread_notification_count(
    response: Response,

    current_user: dict[str, Any] = Depends(
        notification_user_dependency
    ),
) -> NotificationUnreadCount:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return NotificationUnreadCount(
        **get_user_unread_count(
            current_user
        )
    )


@router.patch(
    "/read-all",
    response_model=MarkAllNotificationsReadResponse,
    summary=(
        "Mark all current user "
        "notifications as read"
    ),
)
def read_all_notifications(
    response: Response,

    current_user: dict[str, Any] = Depends(
        notification_user_dependency
    ),
) -> MarkAllNotificationsReadResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return MarkAllNotificationsReadResponse(
        **mark_all_notifications_read(
            current_user
        )
    )


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationItem,
    summary=(
        "Mark one current user "
        "notification as read"
    ),
)
def read_notification(
    response: Response,

    notification_id: Annotated[
        UUID,
        Path(),
    ],

    current_user: dict[str, Any] = Depends(
        notification_user_dependency
    ),
) -> NotificationItem:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return NotificationItem(
        **mark_notification_read(
            notification_id,
            current_user,
        )
    )