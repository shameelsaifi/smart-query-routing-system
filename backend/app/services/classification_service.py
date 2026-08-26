import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


CATEGORY_KEYWORDS = {
    "Fee Verification & Billing": {
        "fee": 3,
        "fees": 3,
        "payment": 2,
        "paid": 2,
        "billing": 5,
        "invoice": 5,
        "voucher": 4,
        "challan": 4,
        "verification": 4,
        "verified": 4,
        "verify": 4,
        "dues": 3,
    },

    "Scholarship": {
        "scholarship": 10,
        "financial aid": 8,
        "financial assistance": 8,
        "merit": 5,
        "need based": 6,
        "stipend": 6,
        "funding": 4,
    },

    "Refunds": {
        "refund": 6,
        "refunded": 6,
        "reimbursement": 7,
        "return payment": 6,
        "money back": 7,
        "overpayment": 6,
        "excess payment": 6,
    },
}


HIGH_PRIORITY_KEYWORDS = [
    "urgent",
    "immediately",
    "as soon as possible",
    "deadline",
    "last date",
    "blocked",
    "penalty",
    "overdue",
]


LOW_PRIORITY_KEYWORDS = [
    "information",
    "general inquiry",
    "how can i",
    "when will",
    "please guide",
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

    best_category = max(
        scores,
        key=scores.get,
    )

    best_score = scores[best_category]

    if best_score == 0:
        best_category = "Fee Verification & Billing"
        confidence = 40.0
    else:
        confidence = min(
            96.0,
            70.0 + (best_score * 2.0),
        )

    if any(
        contains_keyword(combined_text, keyword)
        for keyword in HIGH_PRIORITY_KEYWORDS
    ):
        priority = "HIGH"

    elif any(
        contains_keyword(combined_text, keyword)
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

        result = classify_query(
            subject=ticket["subject"],
            message=ticket["message"],
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
                    subject,
                    category,
                    priority,
                    confidence,
                    status
                """
            ),
            {
                "ticket_number": ticket_number,
                "category": result["category"],
                "priority": result["priority"],
                "confidence": result["confidence"],
            },
        ).mappings().first()

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