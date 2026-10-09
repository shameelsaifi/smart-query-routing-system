from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal


SUCCESSFUL_AI_STATUSES = {
    "SUCCESS",
    "MANUAL_REVIEW_REQUIRED",
}

FAILED_AI_STATUSES = {
    "FAILED",
    "INVALID_OUTPUT",
}


def _configured(
    value: Any,
) -> bool:
    if value is None:
        return False

    if hasattr(
        value,
        "get_secret_value",
    ):
        value = value.get_secret_value()

    return bool(
        str(value).strip()
    )


def _integration_item(
    *,
    integration_id: str,
    name: str,
    description: str,
    status: str,
    status_label: str,
    configured: bool,
    detail: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": integration_id,
        "name": name,
        "description": description,
        "status": status,
        "status_label": status_label,
        "configured": configured,
        "detail": detail,
        "metadata": metadata or {},
    }


def get_admin_integration_status(
    current_user: dict[str, Any],
) -> dict[str, Any]:
    del current_user

    checked_at = datetime.now(
        timezone.utc
    )

    database_available = False
    database_checked_at = None

    latest_ai = None
    latest_ai_success = None

    latest_gmail_delivery = None
    latest_delivery_callback = None

    try:
        with SessionLocal() as db:
            database_checked_at = (
                db.execute(
                    text(
                        """
                        SELECT
                            clock_timestamp()
                        """
                    )
                ).scalar_one()
            )

            database_available = True

            latest_ai = (
                db.execute(
                    text(
                        """
                        SELECT
                            ai_log_id::text
                                AS ai_log_id,

                            operation_type,

                            processing_method,

                            model_name,

                            processing_status,

                            response_time_ms,

                            error_message,

                            created_at

                        FROM public.ai_processing_logs

                        WHERE processing_method =
                              'GEMINI_AI'

                        ORDER BY
                            created_at DESC,
                            ai_log_id DESC

                        LIMIT 1
                        """
                    )
                )
                .mappings()
                .first()
            )

            latest_ai_success = (
                db.execute(
                    text(
                        """
                        SELECT
                            ai_log_id::text
                                AS ai_log_id,

                            operation_type,

                            processing_method,

                            model_name,

                            processing_status,

                            response_time_ms,

                            created_at

                        FROM public.ai_processing_logs

                        WHERE processing_method =
                              'GEMINI_AI'

                          AND processing_status IN (
                              'SUCCESS',
                              'MANUAL_REVIEW_REQUIRED'
                          )

                        ORDER BY
                            created_at DESC,
                            ai_log_id DESC

                        LIMIT 1
                        """
                    )
                )
                .mappings()
                .first()
            )

            latest_gmail_delivery = (
                db.execute(
                    text(
                        """
                        SELECT
                            response_id::text
                                AS response_id,

                            recipient_email,

                            gmail_account_email,

                            gmail_message_id,

                            gmail_thread_id,

                            delivery_status,

                            sent_at

                        FROM public.responses

                        WHERE delivery_status =
                              'SENT'

                          AND sent_at IS NOT NULL

                        ORDER BY
                            sent_at DESC,
                            response_id DESC

                        LIMIT 1
                        """
                    )
                )
                .mappings()
                .first()
            )

            latest_delivery_callback = (
                db.execute(
                    text(
                        """
                        SELECT
                            event_sequence,

                            action,

                            outcome,

                            created_at

                        FROM public.audit_logs

                        WHERE actor_service =
                              'EMAIL_DELIVERY'

                          AND action IN (
                              'EMAIL_DELIVERY_SENT',
                              'EMAIL_DELIVERY_FAILED'
                          )

                        ORDER BY
                            event_sequence DESC

                        LIMIT 1
                        """
                    )
                )
                .mappings()
                .first()
            )

    except SQLAlchemyError:
        database_available = False

    gemini_configured = (
        _configured(
            settings.gemini_api_key
        )
        and _configured(
            settings.gemini_model
        )
    )

    if not gemini_configured:
        gemini_status = (
            "NOT_CONFIGURED"
        )
        gemini_status_label = (
            "Not configured"
        )
        gemini_detail = (
            "Gemini credentials or model "
            "configuration is missing."
        )

    elif (
        latest_ai is not None
        and latest_ai[
            "processing_status"
        ]
        in FAILED_AI_STATUSES
        and (
            latest_ai_success is None
            or latest_ai[
                "created_at"
            ]
            > latest_ai_success[
                "created_at"
            ]
        )
    ):
        gemini_status = "DEGRADED"
        gemini_status_label = "Degraded"
        gemini_detail = (
            "The latest recorded Gemini "
            "processing attempt did not "
            "complete successfully."
        )

    elif latest_ai_success is not None:
        gemini_status = "OPERATIONAL"
        gemini_status_label = "Operational"
        gemini_detail = (
            "Recent Gemini AI processing "
            "completed successfully."
        )

    else:
        gemini_status = "CONFIGURED"
        gemini_status_label = "Configured"
        gemini_detail = (
            "Gemini credentials and model "
            "are configured, but no successful "
            "Gemini activity is recorded yet."
        )

    gmail_sender_email = getattr(
        settings,
        "gmail_sender_email",
        None,
    )

    email_delivery_key = getattr(
        settings,
        "email_delivery_api_key",
        None,
    )

    gmail_configured = (
        _configured(
            gmail_sender_email
        )
        and _configured(
            email_delivery_key
        )
    )

    if not gmail_configured:
        gmail_status = (
            "NOT_CONFIGURED"
        )
        gmail_status_label = (
            "Not configured"
        )
        gmail_detail = (
            "Gmail sender or email-delivery "
            "service configuration is missing."
        )

    elif latest_gmail_delivery is not None:
        gmail_status = "OPERATIONAL"
        gmail_status_label = "Operational"
        gmail_detail = (
            "A successful Gmail delivery "
            "is recorded by SmartQuery."
        )

    else:
        gmail_status = "CONFIGURED"
        gmail_status_label = "Configured"
        gmail_detail = (
            "Gmail delivery configuration "
            "is present, but no successful "
            "delivery is recorded yet."
        )

    email_intake_key = getattr(
        settings,
        "email_intake_api_key",
        None,
    )

    n8n_configured = (
        _configured(
            email_delivery_key
        )
        and _configured(
            email_intake_key
        )
    )

    if not n8n_configured:
        n8n_status = (
            "NOT_CONFIGURED"
        )
        n8n_status_label = (
            "Not configured"
        )
        n8n_detail = (
            "Service credentials required "
            "by the automation workflows "
            "are incomplete."
        )

    elif latest_delivery_callback is not None:
        n8n_status = "OPERATIONAL"
        n8n_status_label = "Operational"
        n8n_detail = (
            "Recent authenticated email "
            "workflow callback activity "
            "is recorded."
        )

    else:
        n8n_status = "CONFIGURED"
        n8n_status_label = "Configured"
        n8n_detail = (
            "Automation service credentials "
            "are configured, but no delivery "
            "callback activity is recorded yet."
        )

    supabase_configured = (
        _configured(
            settings.database_url
        )
        and _configured(
            settings.supabase_url
        )
        and _configured(
            settings.supabase_publishable_key
        )
    )

    if database_available:
        database_status = "HEALTHY"
        database_status_label = "Healthy"
        database_detail = (
            "PostgreSQL connection verified "
            "successfully."
        )

    elif supabase_configured:
        database_status = "UNAVAILABLE"
        database_status_label = (
            "Unavailable"
        )
        database_detail = (
            "Supabase configuration is "
            "present, but the database "
            "connection check failed."
        )

    else:
        database_status = (
            "NOT_CONFIGURED"
        )
        database_status_label = (
            "Not configured"
        )
        database_detail = (
            "Required Supabase/PostgreSQL "
            "configuration is missing."
        )

    return {
        "checked_at": checked_at,
        "integrations": [
            _integration_item(
                integration_id="gemini",
                name="Gemini / LangChain",
                description=(
                    "AI classification and "
                    "response drafting"
                ),
                status=gemini_status,
                status_label=(
                    gemini_status_label
                ),
                configured=(
                    gemini_configured
                ),
                detail=gemini_detail,
                metadata={
                    "model":
                        settings.gemini_model,

                    "last_activity_at": (
                        latest_ai[
                            "created_at"
                        ]
                        if latest_ai
                        else None
                    ),

                    "last_processing_status": (
                        latest_ai[
                            "processing_status"
                        ]
                        if latest_ai
                        else None
                    ),

                    "last_operation_type": (
                        latest_ai[
                            "operation_type"
                        ]
                        if latest_ai
                        else None
                    ),

                    "last_response_time_ms": (
                        latest_ai[
                            "response_time_ms"
                        ]
                        if latest_ai
                        else None
                    ),
                },
            ),

            _integration_item(
                integration_id="gmail",
                name="Gmail",
                description=(
                    "Inbound and outbound "
                    "email workflow"
                ),
                status=gmail_status,
                status_label=(
                    gmail_status_label
                ),
                configured=(
                    gmail_configured
                ),
                detail=gmail_detail,
                metadata={
                    "sender_email":
                        gmail_sender_email,

                    "last_sent_at": (
                        latest_gmail_delivery[
                            "sent_at"
                        ]
                        if latest_gmail_delivery
                        else None
                    ),

                    "last_recipient": (
                        latest_gmail_delivery[
                            "recipient_email"
                        ]
                        if latest_gmail_delivery
                        else None
                    ),

                    "gmail_account_email": (
                        latest_gmail_delivery[
                            "gmail_account_email"
                        ]
                        if latest_gmail_delivery
                        else None
                    ),
                },
            ),

            _integration_item(
                integration_id="n8n",
                name="n8n",
                description=(
                    "Workflow automation and "
                    "Gmail delivery"
                ),
                status=n8n_status,
                status_label=(
                    n8n_status_label
                ),
                configured=(
                    n8n_configured
                ),
                detail=n8n_detail,
                metadata={
                    "last_callback_at": (
                        latest_delivery_callback[
                            "created_at"
                        ]
                        if latest_delivery_callback
                        else None
                    ),

                    "last_callback_action": (
                        latest_delivery_callback[
                            "action"
                        ]
                        if latest_delivery_callback
                        else None
                    ),

                    "last_callback_outcome": (
                        latest_delivery_callback[
                            "outcome"
                        ]
                        if latest_delivery_callback
                        else None
                    ),
                },
            ),

            _integration_item(
                integration_id=(
                    "supabase_postgresql"
                ),
                name=(
                    "Supabase PostgreSQL"
                ),
                description=(
                    "Primary application "
                    "data store"
                ),
                status=database_status,
                status_label=(
                    database_status_label
                ),
                configured=(
                    supabase_configured
                ),
                detail=database_detail,
                metadata={
                    "database_checked_at":
                        database_checked_at,

                    "supabase_url_configured":
                        _configured(
                            settings.supabase_url
                        ),

                    "publishable_key_configured":
                        _configured(
                            settings
                            .supabase_publishable_key
                        ),

                    "secret_key_configured":
                        _configured(
                            settings
                            .supabase_secret_key
                        ),
                },
            ),
        ],
    }