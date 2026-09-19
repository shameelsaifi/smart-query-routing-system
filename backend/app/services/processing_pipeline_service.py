import json
import time
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.ai_classification_service import (
    classify_query_with_ai,
)
from app.services.assignment_service import (
    assign_available_officer,
)
from app.services.classification_service import (
    classify_query,
)
from app.services.instructor_auto_reply_service import (
    create_instructor_leave_auto_reply,
)
from app.services.routing_service import route_ticket


class ProcessingLeaseLost(RuntimeError):
    pass


def _safe_error_message(error: Exception) -> str:
    value = str(error).strip()

    if not value:
        value = type(error).__name__

    return value[:2000]


def _assert_job_lease_in_session(
    db,
    job_id: UUID | None,
    lease_token: UUID | None,
) -> None:
    if job_id is None and lease_token is None:
        return

    if job_id is None or lease_token is None:
        raise ProcessingLeaseLost(
            "Incomplete processing-job lease information."
        )

    lease = db.execute(
        text(
            """
            UPDATE public.ticket_processing_jobs
            SET
                lease_expires_at =
                    NOW()
                    + (
                        :lease_seconds
                        * INTERVAL '1 second'
                    ),
                updated_at = NOW()
            WHERE job_id = :job_id
              AND job_status = 'RUNNING'
              AND lease_token = :lease_token
              AND lease_expires_at > NOW()
            RETURNING job_id
            """
        ),
        {
            "job_id": job_id,
            "lease_token": lease_token,
            "lease_seconds": (
                settings.processing_worker_lease_seconds
            ),
        },
    ).first()

    if lease is None:
        raise ProcessingLeaseLost(
            "Processing-job lease is no longer valid."
        )


def renew_processing_job_lease(
    job_id: UUID | None,
    lease_token: UUID | None,
) -> None:
    if job_id is None and lease_token is None:
        return

    db = SessionLocal()

    try:
        _assert_job_lease_in_session(
            db,
            job_id,
            lease_token,
        )
        db.commit()

    except ProcessingLeaseLost:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()
        raise RuntimeError(
            "Processing-job lease could not be renewed."
        ) from exc

    finally:
        db.close()


def _load_pipeline_state(
    ticket_number: str,
) -> dict[str, Any]:
    db = SessionLocal()

    try:
        row = db.execute(
            text(
                """
                SELECT
                    t.ticket_id,
                    t.ticket_number,
                    t.subject,
                    t.message,
                    t.category,
                    t.category_id,
                    t.priority,
                    t.confidence,
                    t.status,
                    t.ai_intent,
                    t.ai_summary,
                    t.ai_draft_reply,
                    t.requires_manual_review,
                    t.processing_method,
                    t.routed_desk_id,
                    t.assigned_officer_id,

                    qa.assignment_id,
                    qa.department_id,
                    qa.desk_id,
                    qa.rule_id,
                    qa.assignment_method,

                    r.target_role,

                    d.department_name,

                    desk.desk_code,
                    desk.desk_name,

                    officer.full_name
                        AS assigned_officer_name

                FROM public.tickets t

                LEFT JOIN public.query_assignments qa
                  ON qa.ticket_id = t.ticket_id
                 AND qa.is_current = TRUE

                LEFT JOIN public.routing_rules r
                  ON r.rule_id = qa.rule_id

                LEFT JOIN public.departments d
                  ON d.department_id = qa.department_id

                LEFT JOIN public.accounts_desks desk
                  ON desk.desk_id = qa.desk_id

                LEFT JOIN public.users officer
                  ON officer.user_id = t.assigned_officer_id

                WHERE t.ticket_number = :ticket_number
                LIMIT 1
                """
            ),
            {
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found.",
            )

        return dict(row)

    finally:
        db.close()


def _requires_manual_review(
    classification: dict[str, Any],
) -> bool:
    threshold_percent = (
        settings.ai_manual_review_threshold * 100.0
    )

    return bool(
        classification.get(
            "requires_manual_review",
            False,
        )
        or float(
            classification.get(
                "confidence",
                0.0,
            )
        )
        < threshold_percent
        or classification.get("category") == "General"
    )


def _run_classification(
    subject: str,
    message: str,
) -> tuple[
    dict[str, Any],
    dict[str, Any] | None,
]:
    start = time.perf_counter()

    try:
        ai_result = classify_query_with_ai(
            subject=subject,
            message=message,
        )

        elapsed_ms = int(
            (time.perf_counter() - start) * 1000
        )

        classification = {
            "intent": ai_result.intent,
            "category": ai_result.category,
            "priority": ai_result.priority,
            "suggested_department": (
                ai_result.suggested_department
            ),
            "confidence": round(
                ai_result.confidence_score * 100.0,
                2,
            ),
            "summary": ai_result.summary,
            "draft_reply": ai_result.draft_reply,
            "requires_manual_review": (
                ai_result.requires_manual_review
            ),
            "processing_method": "GEMINI_AI",
            "response_time_ms": elapsed_ms,
            "output_data": ai_result.model_dump(),
        }

        classification["requires_manual_review"] = (
            _requires_manual_review(classification)
        )

        return classification, None

    except Exception as exc:
        elapsed_ms = int(
            (time.perf_counter() - start) * 1000
        )

        ai_failure = {
            "error_type": type(exc).__name__,
            "error_message": _safe_error_message(exc),
            "response_time_ms": elapsed_ms,
        }

        fallback = classify_query(
            subject=subject,
            message=message,
        )

        classification = {
            "intent": None,
            "category": fallback["category"],
            "priority": fallback["priority"],
            "suggested_department": None,
            "confidence": fallback["confidence"],
            "summary": None,
            "draft_reply": None,
            "requires_manual_review": False,
            "processing_method": (
                "RULE_BASED_FALLBACK"
            ),
            "response_time_ms": 0,
            "output_data": {
                "category": fallback["category"],
                "priority": fallback["priority"],
                "confidence": fallback["confidence"],
            },
        }

        classification["requires_manual_review"] = (
            _requires_manual_review(classification)
        )

        classification["output_data"][
            "requires_manual_review"
        ] = classification[
            "requires_manual_review"
        ]

        return classification, ai_failure


def _persist_initial_classification(
    ticket_number: str,
    classification: dict[str, Any],
    ai_failure: dict[str, Any] | None,
    attempt_number: int,
    job_id: UUID | None,
    lease_token: UUID | None,
) -> dict[str, Any]:
    db = SessionLocal()

    try:
        _assert_job_lease_in_session(
            db,
            job_id,
            lease_token,
        )

        ticket = db.execute(
            text(
                """
                SELECT
                    ticket_id,
                    status
                FROM public.tickets
                WHERE ticket_number = :ticket_number
                LIMIT 1
                FOR UPDATE
                """
            ),
            {
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        if ticket is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found.",
            )

        if ticket["status"] != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Initial classification requires "
                    "a PENDING ticket."
                ),
            )

        category = db.execute(
            text(
                """
                SELECT
                    category_id,
                    category_name
                FROM public.query_categories
                WHERE category_name = :category_name
                  AND is_active = TRUE
                LIMIT 1
                """
            ),
            {
                "category_name": (
                    classification["category"]
                ),
            },
        ).mappings().first()

        if category is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Classification selected an inactive "
                    "or unknown category."
                ),
            )

        updated_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    category = :category,
                    category_id = :category_id,
                    priority = :priority,
                    confidence = :confidence,

                    ai_intent = :ai_intent,
                    ai_summary = :ai_summary,
                    ai_draft_reply = :ai_draft_reply,

                    requires_manual_review =
                        :requires_manual_review,

                    processing_method =
                        :processing_method,

                    status = 'CLASSIFIED',
                    updated_at = NOW()

                WHERE ticket_id = :ticket_id
                  AND status = 'PENDING'

                RETURNING
                    ticket_id,
                    ticket_number,
                    category,
                    category_id,
                    priority,
                    confidence,
                    status,
                    requires_manual_review,
                    processing_method
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
                "category": category["category_name"],
                "category_id": category["category_id"],
                "priority": classification["priority"],
                "confidence": (
                    classification["confidence"]
                ),
                "ai_intent": classification.get(
                    "intent"
                ),
                "ai_summary": classification.get(
                    "summary"
                ),
                "ai_draft_reply": classification.get(
                    "draft_reply"
                ),
                "requires_manual_review": (
                    classification[
                        "requires_manual_review"
                    ]
                ),
                "processing_method": (
                    classification[
                        "processing_method"
                    ]
                ),
            },
        ).mappings().first()

        if updated_ticket is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Ticket state changed during "
                    "classification."
                ),
            )

        db.execute(
            text(
                """
                INSERT INTO public.query_status_history (
                    ticket_id,
                    changed_by_service,
                    previous_status,
                    new_status,
                    change_note
                )
                VALUES (
                    :ticket_id,
                    'processing_pipeline',
                    'PENDING',
                    'CLASSIFIED',
                    :change_note
                )
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
                "change_note": (
                    "Initial query classification completed "
                    f"using "
                    f"{classification['processing_method']}."
                ),
            },
        )

        if ai_failure is not None:
            db.execute(
                text(
                    """
                    INSERT INTO public.ai_processing_logs (
                        ticket_id,
                        operation_type,
                        model_name,
                        detected_intent,
                        confidence_score,
                        output_data,
                        processing_status,
                        response_time_ms,
                        processing_method,
                        error_message,
                        attempt_number
                    )
                    VALUES (
                        :ticket_id,
                        'CLASSIFICATION',
                        :model_name,
                        NULL,
                        NULL,
                        '{}'::jsonb,
                        'FAILED',
                        :response_time_ms,
                        'GEMINI_AI',
                        :error_message,
                        :attempt_number
                    )
                    """
                ),
                {
                    "ticket_id": ticket["ticket_id"],
                    "model_name": (
                        settings.gemini_model
                    ),
                    "response_time_ms": (
                        ai_failure[
                            "response_time_ms"
                        ]
                    ),
                    "error_message": (
                        ai_failure[
                            "error_message"
                        ]
                    ),
                    "attempt_number": attempt_number,
                },
            )

        final_processing_status = (
            "MANUAL_REVIEW_REQUIRED"
            if classification[
                "requires_manual_review"
            ]
            else "SUCCESS"
        )

        db.execute(
            text(
                """
                INSERT INTO public.ai_processing_logs (
                    ticket_id,
                    operation_type,
                    model_name,
                    detected_intent,
                    confidence_score,
                    output_data,
                    processing_status,
                    response_time_ms,
                    processing_method,
                    error_message,
                    attempt_number
                )
                VALUES (
                    :ticket_id,
                    'CLASSIFICATION',
                    :model_name,
                    :detected_intent,
                    :confidence_score,
                    CAST(:output_data AS jsonb),
                    :processing_status,
                    :response_time_ms,
                    :processing_method,
                    NULL,
                    :attempt_number
                )
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
                "model_name": (
                    settings.gemini_model
                    if classification[
                        "processing_method"
                    ]
                    == "GEMINI_AI"
                    else None
                ),
                "detected_intent": (
                    classification.get("intent")
                ),
                "confidence_score": (
                    float(
                        classification[
                            "confidence"
                        ]
                    )
                    / 100.0
                ),
                "output_data": json.dumps(
                    classification[
                        "output_data"
                    ]
                ),
                "processing_status": (
                    final_processing_status
                ),
                "response_time_ms": (
                    classification.get(
                        "response_time_ms"
                    )
                ),
                "processing_method": (
                    classification[
                        "processing_method"
                    ]
                ),
                "attempt_number": attempt_number,
            },
        )

        audit_action = (
            "TICKET_CLASSIFIED_AI"
            if classification[
                "processing_method"
            ]
            == "GEMINI_AI"
            else "TICKET_CLASSIFIED_FALLBACK"
        )

        db.execute(
            text(
                """
                INSERT INTO public.audit_logs (
                    actor_service,
                    action,
                    entity_type,
                    entity_id,
                    details
                )
                VALUES (
                    'processing_pipeline',
                    :action,
                    'TICKET',
                    :ticket_id,
                    CAST(:details AS jsonb)
                )
                """
            ),
            {
                "action": audit_action,
                "ticket_id": ticket["ticket_id"],
                "details": json.dumps(
                    {
                        "category": (
                            classification[
                                "category"
                            ]
                        ),
                        "priority": (
                            classification[
                                "priority"
                            ]
                        ),
                        "confidence": (
                            classification[
                                "confidence"
                            ]
                        ),
                        "requires_manual_review": (
                            classification[
                                "requires_manual_review"
                            ]
                        ),
                        "processing_method": (
                            classification[
                                "processing_method"
                            ]
                        ),
                    }
                ),
            },
        )

        db.commit()

        return dict(updated_ticket)

    except ProcessingLeaseLost:
        db.rollback()
        raise

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Classification result could not "
                "be persisted."
            ),
        ) from exc

    finally:
        db.close()


def process_ticket_pipeline(
    ticket_number: str,
    *,
    attempt_number: int = 1,
    job_id: UUID | None = None,
    lease_token: UUID | None = None,
) -> dict[str, Any]:
    """
    Resume-safe initial processing.

    Supported recovery states:

    PENDING
        -> classify

    CLASSIFIED
        -> manual review OR route

    ROUTED
        -> assign available authorized user
        -> if an instructor route has no available
           instructor, queue predefined leave auto-reply

    Any later lifecycle state
        -> initial processing is already obsolete
    """

    state = _load_pipeline_state(
        ticket_number
    )

    if state["status"] == "PENDING":
        renew_processing_job_lease(
            job_id,
            lease_token,
        )

        classification, ai_failure = (
            _run_classification(
                subject=state["subject"],
                message=state["message"],
            )
        )

        renew_processing_job_lease(
            job_id,
            lease_token,
        )

        _persist_initial_classification(
            ticket_number=ticket_number,
            classification=classification,
            ai_failure=ai_failure,
            attempt_number=attempt_number,
            job_id=job_id,
            lease_token=lease_token,
        )

        state = _load_pipeline_state(
            ticket_number
        )

    if state["status"] == "CLASSIFIED":
        if state["requires_manual_review"]:
            return {
                "queue_outcome": "COMPLETED",
                "pipeline_status": (
                    "MANUAL_REVIEW_REQUIRED"
                ),
                "ticket_number": ticket_number,
                "status": state["status"],
                "category": state["category"],
                "priority": state["priority"],
                "confidence": state["confidence"],
                "processing_method": (
                    state["processing_method"]
                ),
                "requires_manual_review": True,
                "department_name": None,
                "desk_name": None,
                "assigned_officer": None,
                "auto_reply": None,
            }

        renew_processing_job_lease(
            job_id,
            lease_token,
        )

        route_ticket(
            ticket_number
        )

        state = _load_pipeline_state(
            ticket_number
        )

    if state["status"] == "ROUTED":
        renew_processing_job_lease(
            job_id,
            lease_token,
        )

        assignment = assign_available_officer(
            ticket_number
        )

        auto_reply = None

        if (
            assignment["assignment_status"]
            == "WAITING_FOR_AVAILABLE_OFFICER"
        ):
            auto_reply = (
                create_instructor_leave_auto_reply(
                    ticket_number
                )
            )

        state = _load_pipeline_state(
            ticket_number
        )

        return {
            "queue_outcome": "COMPLETED",
            "pipeline_status": assignment[
                "assignment_status"
            ],
            "ticket_number": ticket_number,
            "status": state["status"],
            "category": state["category"],
            "priority": state["priority"],
            "confidence": state["confidence"],
            "processing_method": (
                state["processing_method"]
            ),
            "requires_manual_review": (
                state[
                    "requires_manual_review"
                ]
            ),
            "department_name": (
                state["department_name"]
            ),
            "desk_name": state["desk_name"],
            "assigned_officer": (
                state[
                    "assigned_officer_name"
                ]
            ),
            "auto_reply": auto_reply,
        }

    return {
        "queue_outcome": "SKIPPED",
        "pipeline_status": "ALREADY_ADVANCED",
        "ticket_number": ticket_number,
        "status": state["status"],
        "category": state["category"],
        "priority": state["priority"],
        "confidence": state["confidence"],
        "processing_method": (
            state["processing_method"]
        ),
        "requires_manual_review": (
            state["requires_manual_review"]
        ),
        "department_name": (
            state["department_name"]
        ),
        "desk_name": state["desk_name"],
        "assigned_officer": (
            state["assigned_officer_name"]
        ),
        "auto_reply": None,
    }