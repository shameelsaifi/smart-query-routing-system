import json
import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


CATEGORY_KEYWORDS = {
    "Fee Verification & Billing": {
        "fee": 4,
        "fees": 4,
        "fee challan": 8,
        "challan": 7,
        "payment verification": 8,
        "payment": 3,
        "paid": 3,
        "billing": 7,
        "invoice": 6,
        "voucher": 6,
        "dues": 5,
    },

    "Scholarship": {
        "scholarship": 10,
        "financial aid": 9,
        "financial assistance": 9,
        "merit scholarship": 9,
        "need based": 8,
        "stipend": 7,
    },

    "Refunds": {
        "refund": 10,
        "refunded": 10,
        "reimbursement": 9,
        "money back": 8,
        "overpayment": 8,
        "excess payment": 8,
    },

    "Examination/Result": {
        "result": 7,
        "exam result": 10,
        "examination result": 10,
        "rechecking": 9,
        "recheck": 9,
        "grade correction": 9,
        "marks": 6,
        "dmc": 8,
        "result correction": 10,
    },

    "Course/Academic": {
        "course": 5,
        "course content": 9,
        "assignment": 7,
        "lecture": 7,
        "syllabus": 8,
        "academic guidance": 8,
        "quiz": 5,
        "course outline": 8,
    },

    "Attendance": {
        "attendance": 10,
        "marked absent": 10,
        "attendance correction": 10,
        "attendance record": 9,
        "absence record": 8,
    },

    "Degree/Records": {
        "degree": 7,
        "degree verification": 10,
        "transcript": 10,
        "academic record": 9,
        "academic records": 9,
        "record verification": 8,
    },

    "Enrollment": {
        "enrollment": 10,
        "enrolment": 10,
        "registration": 7,
        "enrollment deadline": 10,
        "enrolment deadline": 10,
        "enrollment confirmation": 10,
        "course registration": 8,
    },

    "IT/Technical": {
        "portal": 8,
        "portal login": 10,
        "lms": 10,
        "login issue": 9,
        "login problem": 9,
        "email account": 8,
        "university email": 8,
        "software": 6,
        "technical issue": 8,
        "lab computer": 8,
        "password reset": 8,
    },
}


URGENT_PRIORITY_KEYWORDS = [
    "critical",
    "emergency",
    "account hacked",
    "security breach",
    "deadline today",
    "last date today",
]


HIGH_PRIORITY_KEYWORDS = [
    "urgent",
    "immediately",
    "as soon as possible",
    "deadline",
    "last date",
    "blocked",
    "penalty",
    "overdue",
    "cannot access",
]


LOW_PRIORITY_KEYWORDS = [
    "general information",
    "general inquiry",
    "please guide",
    "how can i",
    "how do i",
    "when will",
    "information only",
]


def contains_keyword(
    text_value: str,
    keyword: str,
) -> bool:
    pattern = rf"\b{re.escape(keyword)}\b"

    return re.search(
        pattern,
        text_value,
        flags=re.IGNORECASE,
    ) is not None


def classify_query(
    subject: str,
    message: str,
) -> dict[str, Any]:
    combined_text = f"{subject} {message}".lower()

    scores: dict[str, int] = {}

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0

        for keyword, weight in keywords.items():
            if contains_keyword(
                combined_text,
                keyword,
            ):
                score += weight

        scores[category] = score

    ordered = sorted(
        scores.items(),
        key=lambda item: item[1],
        reverse=True,
    )

    best_category, best_score = ordered[0]
    second_score = ordered[1][1]

    if best_score == 0:
        best_category = "General"
        confidence = 35.0

    elif best_score == second_score:
        best_category = "General"
        confidence = 50.0

    else:
        score_margin = best_score - second_score

        confidence = min(
            96.0,
            68.0
            + (best_score * 1.8)
            + (min(score_margin, 6) * 2.0),
        )

        if best_score < 5:
            confidence = min(confidence, 74.0)

        elif score_margin <= 1:
            confidence = min(confidence, 72.0)

    if any(
        contains_keyword(
            combined_text,
            keyword,
        )
        for keyword in URGENT_PRIORITY_KEYWORDS
    ):
        priority = "URGENT"

    elif any(
        contains_keyword(
            combined_text,
            keyword,
        )
        for keyword in HIGH_PRIORITY_KEYWORDS
    ):
        priority = "HIGH"

    elif any(
        contains_keyword(
            combined_text,
            keyword,
        )
        for keyword in LOW_PRIORITY_KEYWORDS
    ):
        priority = "LOW"

    else:
        priority = "MEDIUM"

    return {
        "category": best_category,
        "priority": priority,
        "confidence": round(confidence, 2),
    }


def classify_ticket(
    ticket_number: str,
) -> dict[str, Any]:
    db = SessionLocal()

    try:
        ticket = db.execute(
            text(
                """
                SELECT
                    ticket_id,
                    ticket_number,
                    subject,
                    message,
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
                    "Only a PENDING ticket can receive "
                    "initial classification."
                ),
            )

        result = classify_query(
            subject=ticket["subject"],
            message=ticket["message"],
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
                "category_name": result["category"],
            },
        ).mappings().first()

        if category is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The fallback classifier selected a "
                    "category that is not active."
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
                    status = 'CLASSIFIED',
                    updated_at = NOW()
                WHERE ticket_id = :ticket_id
                  AND status = 'PENDING'
                RETURNING
                    ticket_id,
                    ticket_number,
                    subject,
                    category,
                    category_id,
                    priority,
                    confidence,
                    status
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
                "category": category["category_name"],
                "category_id": category["category_id"],
                "priority": result["priority"],
                "confidence": result["confidence"],
            },
        ).mappings().first()

        if updated_ticket is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ticket state changed during classification.",
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
                    "Ticket classified by rule-based fallback."
                ),
            },
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
                    'TICKET_CLASSIFIED_FALLBACK',
                    'TICKET',
                    :ticket_id,
                    CAST(:details AS jsonb)
                )
                """
            ),
            {
                "ticket_id": ticket["ticket_id"],
                "details": json.dumps(
                    {
                        "category": result["category"],
                        "priority": result["priority"],
                        "confidence": result["confidence"],
                    }
                ),
            },
        )

        db.commit()

        return dict(updated_ticket)

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket classification failed.",
        ) from exc

    finally:
        db.close()