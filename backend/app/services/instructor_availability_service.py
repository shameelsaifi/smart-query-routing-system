import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.schemas.instructor_availability import (
    InstructorAvailabilityUpdate,
)


def update_instructor_availability(
    current_user: dict[str, Any],
    data: InstructorAvailabilityUpdate,
) -> dict[str, Any]:
    try:
        with SessionLocal.begin() as db:
            existing = db.execute(
                text(
                    """
                    SELECT
                        user_id::text AS user_id,
                        role,
                        is_active,
                        is_available,
                        auto_reply_message
                    FROM public.users
                    WHERE user_id =
                          CAST(:user_id AS UUID)
                    FOR UPDATE
                    """
                ),
                {
                    "user_id": str(
                        current_user["user_id"]
                    ),
                },
            ).mappings().first()

            if existing is None:
                raise HTTPException(
                    404,
                    "Application user was not found.",
                )

            if (
                existing["role"]
                != "INSTRUCTOR"
            ):
                raise HTTPException(
                    403,
                    (
                        "Only instructors can manage "
                        "instructor availability."
                    ),
                )

            if not existing["is_active"]:
                raise HTTPException(
                    403,
                    "This instructor account is inactive.",
                )

            new_auto_reply = (
                None
                if data.is_available
                else data.auto_reply_message
            )

            no_change = (
                existing["is_available"]
                == data.is_available
                and
                existing[
                    "auto_reply_message"
                ]
                == new_auto_reply
            )

            if no_change:
                result = dict(
                    current_user
                )

                result["is_available"] = (
                    existing[
                        "is_available"
                    ]
                )

                result[
                    "auto_reply_message"
                ] = existing[
                    "auto_reply_message"
                ]

                return result

            event_at = db.execute(
                text(
                    "SELECT clock_timestamp()"
                )
            ).scalar_one()

            updated = db.execute(
                text(
                    """
                    UPDATE public.users
                    SET
                        is_available =
                            :is_available,

                        auto_reply_message =
                            :auto_reply_message

                    WHERE user_id =
                          CAST(
                              :user_id
                              AS UUID
                          )

                    RETURNING
                        user_id::text
                            AS user_id,
                        is_available,
                        auto_reply_message
                    """
                ),
                {
                    "user_id": str(
                        current_user[
                            "user_id"
                        ]
                    ),
                    "is_available": (
                        data.is_available
                    ),
                    "auto_reply_message": (
                        new_auto_reply
                    ),
                },
            ).mappings().first()

            if updated is None:
                raise HTTPException(
                    500,
                    (
                        "Instructor availability "
                        "could not be updated."
                    ),
                )

            old_values = {
                "is_available": (
                    existing[
                        "is_available"
                    ]
                ),
                "auto_reply_message": (
                    existing[
                        "auto_reply_message"
                    ]
                ),
            }

            new_values = {
                "is_available": (
                    updated[
                        "is_available"
                    ]
                ),
                "auto_reply_message": (
                    updated[
                        "auto_reply_message"
                    ]
                ),
            }

            db.execute(
                text(
                    """
                    INSERT INTO public.audit_logs (
                        actor_user_id,
                        action,
                        entity_type,
                        entity_id,
                        old_values,
                        new_values,
                        created_at
                    )
                    VALUES (
                        CAST(
                            :actor_id
                            AS UUID
                        ),
                        'INSTRUCTOR_AVAILABILITY_UPDATED',
                        'USER',
                        CAST(
                            :user_id
                            AS UUID
                        ),
                        CAST(
                            :old_values
                            AS JSONB
                        ),
                        CAST(
                            :new_values
                            AS JSONB
                        ),
                        :event_at
                    )
                    """
                ),
                {
                    "actor_id": str(
                        current_user[
                            "user_id"
                        ]
                    ),
                    "user_id": str(
                        current_user[
                            "user_id"
                        ]
                    ),
                    "old_values": json.dumps(
                        old_values,
                        default=str,
                    ),
                    "new_values": json.dumps(
                        new_values,
                        default=str,
                    ),
                    "event_at": event_at,
                },
            )

            result = dict(
                current_user
            )

            result["is_available"] = (
                updated[
                    "is_available"
                ]
            )

            result[
                "auto_reply_message"
            ] = updated[
                "auto_reply_message"
            ]

            return result

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "Instructor availability "
                "could not be updated. "
                "Please try again."
            ),
        ) from exc