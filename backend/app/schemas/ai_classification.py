from typing import Literal

from pydantic import BaseModel, Field


class AIClassificationResult(BaseModel):
    intent: str

    category: Literal[
        "Fee Verification & Billing",
        "Scholarship",
        "Refunds",
    ]

    priority: Literal[
        "LOW",
        "MEDIUM",
        "HIGH",
    ]

    suggested_department: Literal[
        "Fee & Billing Desk",
        "Scholarship Desk",
        "Refunds Desk",
    ]

    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
    )

    summary: str

    draft_reply: str

    requires_manual_review: bool