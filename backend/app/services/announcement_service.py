from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.schemas.announcement import (
    AnnouncementCreate,
)
from app.services.ticket_access_service import (
    load_ticket_actor,
)


def create_announcement(
    current_user: dict[str, Any],
    data: AnnouncementCreate,
) -> dict[str, Any]:
    try:
        with SessionLocal.begin() as db:
            actor = load_ticket_actor(
                db,
                current_user,
                "ADMIN",
            )

            event_at = db.execute(
                text(
                    """
                    SELECT clock_timestamp()
                    """
                )
            ).scalar_one()

            announcement = db.execute(
                text(
                    """
                    INSERT INTO public.announcements (
                        title,
                        message,
                        audience,
                        created_by_user_id,
                        recipient_count,
                        is_active,
                        created_at
                    )
                    VALUES (
                        :title,
                        :message,
                        :audience,
                        CAST(:actor_id AS UUID),
                        0,
                        TRUE,
                        :event_at
                    )
                    RETURNING
                        announcement_id::text
                            AS announcement_id,
                        title,
                        message,
                        audience,
                        created_by_user_id::text
                            AS created_by_user_id,
                        recipient_count,
                        is_active,
                        created_at
                    """
                ),
                {
                    "title": data.title,
                    "message": data.message,
                    "audience": data.audience,
                    "actor_id": actor["user_id"],
                    "event_at": event_at,
                },
            ).mappings().one()

            announcement_data = dict(
                announcement
            )

            event_key = (
                "announcement:"
                + announcement_data[
                    "announcement_id"
                ]
            )

            notification_rows = db.execute(
                text(
                    """
                    INSERT INTO public.notifications (
                        ticket_id,
                        response_id,
                        recipient_user_id,
                        event_key,
                        notification_type,
                        title,
                        message,
                        channel,
                        delivery_status,
                        recipient_email,
                        gmail_account_email,
                        gmail_message_id,
                        failure_reason,
                        read_at,
                        created_at,
                        sent_at
                    )

                    SELECT
                        NULL,
                        NULL,
                        u.user_id,
                        :event_key,
                        'ANNOUNCEMENT',
                        :title,
                        :message,
                        'IN_APP',
                        'SENT',
                        NULL,
                        NULL,
                        NULL,
                        NULL,
                        NULL,
                        :event_at,
                        :event_at

                    FROM public.users u

                    WHERE u.is_active = TRUE

                      AND (
                          :audience = 'ALL'

                          OR (
                              :audience = 'STUDENTS'
                              AND u.role = 'STUDENT'
                          )

                          OR (
                              :audience = 'STAFF'
                              AND u.role IN (
                                  'DEPARTMENT_STAFF',
                                  'INSTRUCTOR'
                              )
                          )

                          OR (
                              :audience = 'HODS'
                              AND u.role = 'HOD'
                          )
                      )

                    ON CONFLICT ON CONSTRAINT
                        notifications_event_unique
                    DO NOTHING

                    RETURNING
                        notification_id
                    """
                ),
                {
                    "event_key": event_key,
                    "title": data.title,
                    "message": data.message,
                    "audience": data.audience,
                    "event_at": event_at,
                },
            ).all()

            recipient_count = len(
                notification_rows
            )

            db.execute(
                text(
                    """
                    UPDATE public.announcements

                    SET recipient_count =
                        :recipient_count

                    WHERE announcement_id =
                        CAST(
                            :announcement_id
                            AS UUID
                        )
                    """
                ),
                {
                    "recipient_count":
                        recipient_count,
                    "announcement_id":
                        announcement_data[
                            "announcement_id"
                        ],
                },
            )

            db.execute(
                text(
                    """
                    INSERT INTO public.audit_logs (
                        actor_user_id,
                        actor_service,
                        action,
                        entity_type,
                        entity_id,
                        outcome,
                        old_values,
                        new_values,
                        details
                    )
                    VALUES (
                        CAST(
                            :actor_id
                            AS UUID
                        ),

                        NULL,

                        'ANNOUNCEMENT_CREATED',

                        'ANNOUNCEMENT',

                        CAST(
                            :announcement_id
                            AS UUID
                        ),

                        'SUCCESS',

                        NULL,

                        jsonb_build_object(
                            'title',
                            CAST(
                                :title
                                AS TEXT
                            ),

                            'audience',
                            CAST(
                                :audience
                                AS TEXT
                            ),

                            'recipient_count',
                            CAST(
                                :recipient_count
                                AS INTEGER
                            )
                        ),

                        jsonb_build_object(
                            'broadcast_channel',
                            'IN_APP'
                        )
                    )
                    """
                ),
                {
                    "actor_id":
                        actor["user_id"],

                    "announcement_id":
                        announcement_data[
                            "announcement_id"
                        ],

                    "title":
                        data.title,

                    "audience":
                        data.audience,

                    "recipient_count":
                        recipient_count,
                },
            )

            announcement_data[
                "recipient_count"
            ] = recipient_count

            announcement_data[
                "created_by_name"
            ] = actor.get(
                "full_name"
            )

            announcement_data[
                "created_by_email"
            ] = actor.get(
                "email"
            )

            return announcement_data

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Announcement could not "
                "be published."
            ),
        ) from exc


def get_announcements(
    current_user: dict[str, Any],
    limit: int = 20,
) -> list[dict[str, Any]]:
    try:
        with SessionLocal() as db:
            load_ticket_actor(
                db,
                current_user,
                "ADMIN",
            )

            rows = db.execute(
                text(
                    """
                    SELECT
                        a.announcement_id::text
                            AS announcement_id,

                        a.title,
                        a.message,
                        a.audience,

                        a.recipient_count,
                        a.is_active,

                        a.created_by_user_id::text
                            AS created_by_user_id,

                        creator.full_name
                            AS created_by_name,

                        creator.email
                            AS created_by_email,

                        a.created_at

                    FROM public.announcements a

                    JOIN public.users creator
                      ON creator.user_id =
                         a.created_by_user_id

                    ORDER BY
                        a.created_at DESC,
                        a.announcement_id DESC

                    LIMIT :limit
                    """
                ),
                {
                    "limit": limit,
                },
            ).mappings().all()

            return [
                dict(row)
                for row in rows
            ]

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Announcements are "
                "temporarily unavailable."
            ),
        ) from exc