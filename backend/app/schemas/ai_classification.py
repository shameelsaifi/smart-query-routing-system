from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


CategoryName = Literal[
    "Fee Verification & Billing",
    "Scholarship",
    "Refunds",
    "Examination/Result",
    "Course/Academic",
    "Attendance",
    "Degree/Records",
    "Enrollment",
    "IT/Technical",
    "General",
]

PriorityName = Literal[
    "LOW",
    "MEDIUM",
    "HIGH",
    "URGENT",
]

SuggestedDestination = Literal[
    "Fee & Billing Desk",
    "Scholarship Desk",
    "Refunds Desk",
    "Exam Department",
    "Academic Department",
    "Registrar Office",
    "IT Department",
    "Administration",
]


CATEGORY_DESTINATION_MAP = {
    "Fee Verification & Billing": "Fee & Billing Desk",
    "Scholarship": "Scholarship Desk",
    "Refunds": "Refunds Desk",
    "Examination/Result": "Exam Department",
    "Course/Academic": "Academic Department",
    "Attendance": "Academic Department",
    "Degree/Records": "Registrar Office",
    "Enrollment": "Registrar Office",
    "IT/Technical": "IT Department",
    "General": "Administration",
}


class AIClassificationResult(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    intent: str = Field(
        min_length=1,
        max_length=150,
    )

    category: CategoryName
    priority: PriorityName

    suggested_department: SuggestedDestination

    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
    )

    summary: str = Field(
        min_length=1,
        max_length=600,
    )

    draft_reply: str = Field(
        min_length=1,
        max_length=3000,
    )

    requires_manual_review: bool

    @model_validator(mode="after")
    def validate_classification(self):
        expected_destination = CATEGORY_DESTINATION_MAP[
            self.category
        ]

        if self.suggested_department != expected_destination:
            raise ValueError(
                "Suggested destination does not match "
                "the selected category."
            )

        if (
            self.confidence_score < 0.80
            or self.category == "General"
        ):
            self.requires_manual_review = True

        return self