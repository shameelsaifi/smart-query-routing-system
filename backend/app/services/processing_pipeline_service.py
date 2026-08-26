from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.services.ai_classification_service import (
    classify_query_with_ai,
)
from app.services.assignment_service import (
    assign_available_officer,
)
from app.services.classification_service import (
    classify_ticket,
)
from app.services.routing_service import route_ticket


MANUAL_REVIEW_CONFIDENCE_THRESHOLD = 80.0


def should_require_manual_review(
    classification: dict[str, Any],
) -> bool:
    if classification.get(
        "requires_manual_review",
        False,
    ):
        return True

    confidence = float(
        classification.get(
            "confidence",
            0.0,
        )
    )

    return (
        confidence
        < MANUAL_REVIEW_CONFIDENCE_THRESHOLD
    )


def save_processing_metadata(
    ticket_number: str,
    classification: dict[str, Any],
    requires_manual_review: bool,
) -> None:
    db = SessionLocal()

    try:
        db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    ai_intent = :ai_intent,
                    ai_summary = :ai_summary,
                    ai_draft_reply = :ai_draft_reply,
                    requires_manual_review = :requires_manual_review,
                    processing_method = :processing_method,
                    updated_at = NOW()
                WHERE ticket_number = :ticket_number
                """
            ),
            {
                "ticket_number": ticket_number,
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
                    requires_manual_review
                ),
                "processing_method": classification.get(
                    "processing_method"
                ),
            },
        )

        db.commit()

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI processing metadata could not be saved.",
        ) from exc

    finally:
        db.close()


def classify_ticket_with_ai(
    ticket_number: str,
) -> dict[str, Any]:
    db = SessionLocal()

    try:
        ticket = db.execute(
            text(
                """
                SELECT
                    ticket_number,
                    subject,
                    message
                FROM public.tickets
                WHERE ticket_number = :ticket_number
                LIMIT 1
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

        ai_result = classify_query_with_ai(
            subject=ticket["subject"],
            message=ticket["message"],
        )

        confidence_percent = round(
            ai_result.confidence_score * 100,
            2,
        )

        updated_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    category = :category,
                    priority = :priority,
                    confidence = :confidence,
                    status = 'CLASSIFIED',
                    updated_at = NOW()
                WHERE ticket_number = :ticket_number
                RETURNING
                    ticket_number,
                    category,
                    priority,
                    confidence,
                    status
                """
            ),
            {
                "ticket_number": ticket_number,
                "category": ai_result.category,
                "priority": ai_result.priority,
                "confidence": confidence_percent,
            },
        ).mappings().first()

        db.commit()

        return {
            **dict(updated_ticket),
            "intent": ai_result.intent,
            "suggested_department": (
                ai_result.suggested_department
            ),
            "summary": ai_result.summary,
            "draft_reply": ai_result.draft_reply,
            "requires_manual_review": (
                ai_result.requires_manual_review
            ),
            "processing_method": "GEMINI_AI",
        }

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI ticket classification failed.",
        ) from exc

    finally:
        db.close()


def process_ticket_pipeline(
    ticket_number: str,
) -> dict[str, Any]:
    try:
        classification = classify_ticket_with_ai(
            ticket_number
        )

    except HTTPException:
        raise

    except Exception:
        fallback_result = classify_ticket(
            ticket_number
        )

        classification = {
            **fallback_result,
            "intent": None,
            "suggested_department": None,
            "summary": None,
            "draft_reply": None,
            "requires_manual_review": (
                float(
                    fallback_result["confidence"]
                )
                < MANUAL_REVIEW_CONFIDENCE_THRESHOLD
            ),
            "processing_method": (
                "RULE_BASED_FALLBACK"
            ),
        }

    manual_review = should_require_manual_review(
        classification
    )

    save_processing_metadata(
        ticket_number=ticket_number,
        classification=classification,
        requires_manual_review=manual_review,
    )

    if manual_review:
        return {
            "ticket_number": ticket_number,
            "category": classification["category"],
            "priority": classification["priority"],
            "confidence": classification[
                "confidence"
            ],
            "intent": classification.get(
                "intent"
            ),
            "summary": classification.get(
                "summary"
            ),
            "draft_reply": classification.get(
                "draft_reply"
            ),
            "requires_manual_review": True,
            "processing_method": classification[
                "processing_method"
            ],
            "status": classification["status"],
            "desk_code": None,
            "desk_name": None,
            "assigned_officer": None,
        }

    routing = route_ticket(
        ticket_number
    )

    assignment = assign_available_officer(
        ticket_number
    )

    return {
        "ticket_number": ticket_number,
        "category": classification["category"],
        "priority": classification["priority"],
        "confidence": classification["confidence"],
        "intent": classification.get(
            "intent"
        ),
        "summary": classification.get(
            "summary"
        ),
        "draft_reply": classification.get(
            "draft_reply"
        ),
        "requires_manual_review": False,
        "processing_method": classification[
            "processing_method"
        ],
        "status": assignment["status"],
        "desk_code": routing["desk_code"],
        "desk_name": routing["desk_name"],
        "assigned_officer": assignment[
            "assigned_officer"
        ],
    }