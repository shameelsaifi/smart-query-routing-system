from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


def _notification_user_id(
    current_user: dict[str, Any],
) -> str:
    try:
        return str(
            UUID(
                str(
                    current_user[
                        "user_id"
                    ]
                )
            )
        )

    except (
        KeyError,
        TypeError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=401,
            detail=(
                "Authenticated user "
                "identity is invalid."
            ),
        ) from exc


def get_user_notifications(
    current_user: dict[str, Any],
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    user_id = _notification_user_id(
        current_user
    )

    db = SessionLocal()

    try:
        items = db.execute(
            text(
                """
                SELECT
                    n.notification_id::text
                        AS notification_id,

                    n.ticket_id::text
                        AS ticket_id,

                    t.ticket_number,

                    n.response_id::text
                        AS response_id,

                    n.event_key,
                    n.notification_type,

                    n.title,
                    n.message,

                    (
                        n.read_at
                        IS NOT NULL
                    ) AS is_read,

                    n.read_at,
                    n.created_at,
                    n.sent_at

                FROM public.notifications n

                LEFT JOIN public.tickets t
                  ON t.ticket_id =
                     n.ticket_id

                WHERE n.recipient_user_id =
                      CAST(
                          :user_id
                          AS UUID
                      )

                  AND n.channel =
                      'IN_APP'

                  AND n.delivery_status =
                      'SENT'

                ORDER BY
                    n.created_at DESC,
                    n.notification_id DESC

                LIMIT :limit
                OFFSET :offset
                """
            ),
            {
                "user_id":
                    user_id,

                "limit":
                    limit,

                "offset":
                    offset,
            },
        ).mappings().all()

        summary = db.execute(
            text(
                """
                SELECT
                    COUNT(*)::int
                        AS total,

                    COUNT(*) FILTER (
                        WHERE read_at
                              IS NULL
                    )::int
                        AS unread_count

                FROM public.notifications

                WHERE recipient_user_id =
                      CAST(
                          :user_id
                          AS UUID
                      )

                  AND channel =
                      'IN_APP'

                  AND delivery_status =
                      'SENT'
                """
            ),
            {
                "user_id":
                    user_id,
            },
        ).mappings().first()

        return {
            "items": [
                dict(item)
                for item in items
            ],
            "total": (
                summary["total"]
                if summary
                else 0
            ),
            "unread_count": (
                summary["unread_count"]
                if summary
                else 0
            ),
        }

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Notifications could "
                "not be loaded."
            ),
        ) from exc

    finally:
        db.close()


def get_user_unread_count(
    current_user: dict[str, Any],
) -> dict[str, int]:
    user_id = _notification_user_id(
        current_user
    )

    db = SessionLocal()

    try:
        unread_count = db.execute(
            text(
                """
                SELECT
                    COUNT(*)::int
                        AS unread_count

                FROM public.notifications

                WHERE recipient_user_id =
                      CAST(
                          :user_id
                          AS UUID
                      )

                  AND channel =
                      'IN_APP'

                  AND delivery_status =
                      'SENT'

                  AND read_at
                      IS NULL
                """
            ),
            {
                "user_id":
                    user_id,
            },
        ).scalar_one()

        return {
            "unread_count":
                unread_count,
        }

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unread notification "
                "count could not be loaded."
            ),
        ) from exc

    finally:
        db.close()


def mark_notification_read(
    notification_id: UUID,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    user_id = _notification_user_id(
        current_user
    )

    db = SessionLocal()

    try:
        notification = db.execute(
            text(
                """
                WITH updated AS (
                    UPDATE
                        public.notifications

                    SET read_at =
                        COALESCE(
                            read_at,
                            NOW()
                        )

                    WHERE notification_id =
                          CAST(
                              :notification_id
                              AS UUID
                          )

                      AND recipient_user_id =
                          CAST(
                              :user_id
                              AS UUID
                          )

                      AND channel =
                          'IN_APP'

                      AND delivery_status =
                          'SENT'

                    RETURNING
                        notification_id,
                        ticket_id,
                        response_id,

                        event_key,
                        notification_type,

                        title,
                        message,

                        read_at,
                        created_at,
                        sent_at
                )

                SELECT
                    u.notification_id::text
                        AS notification_id,

                    u.ticket_id::text
                        AS ticket_id,

                    t.ticket_number,

                    u.response_id::text
                        AS response_id,

                    u.event_key,
                    u.notification_type,

                    u.title,
                    u.message,

                    TRUE
                        AS is_read,

                    u.read_at,
                    u.created_at,
                    u.sent_at

                FROM updated u

                LEFT JOIN public.tickets t
                  ON t.ticket_id =
                     u.ticket_id
                """
            ),
            {
                "notification_id":
                    str(notification_id),

                "user_id":
                    user_id,
            },
        ).mappings().first()

        if notification is None:
            db.rollback()

            raise HTTPException(
                status_code=404,
                detail=(
                    "Notification not found "
                    "or not accessible."
                ),
            )

        db.commit()

        return dict(
            notification
        )

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Notification could "
                "not be updated."
            ),
        ) from exc

    finally:
        db.close()


def mark_all_notifications_read(
    current_user: dict[str, Any],
) -> dict[str, int]:
    user_id = _notification_user_id(
        current_user
    )

    db = SessionLocal()

    try:
        result = db.execute(
            text(
                """
                UPDATE
                    public.notifications

                SET read_at = NOW()

                WHERE recipient_user_id =
                      CAST(
                          :user_id
                          AS UUID
                      )

                  AND channel =
                      'IN_APP'

                  AND delivery_status =
                      'SENT'

                  AND read_at
                      IS NULL
                """
            ),
            {
                "user_id":
                    user_id,
            },
        )

        updated_count = (
            result.rowcount
            if result.rowcount
            is not None
            else 0
        )

        db.commit()

        return {
            "updated_count":
                max(
                    updated_count,
                    0,
                ),
        }

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Notifications could "
                "not be updated."
            ),
        ) from exc

    finally:
        db.close()