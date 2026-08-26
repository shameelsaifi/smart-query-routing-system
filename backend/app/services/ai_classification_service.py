from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings
from app.schemas.ai_classification import AIClassificationResult


def classify_query_with_ai(
    subject: str,
    message: str,
) -> AIClassificationResult:
    model = ChatGoogleGenerativeAI(
        model="gemini-3.6-flash",
        google_api_key=settings.gemini_api_key,
    )

    structured_model = model.with_structured_output(
        schema=AIClassificationResult.model_json_schema(),
        method="json_schema",
    )

    prompt = f"""
You are the AI query classifier for a university Accounts Department.

Classify the student's query into exactly one of these categories:
- Fee Verification & Billing
- Scholarship
- Refunds

The suggested department must match the category:
- Fee Verification & Billing -> Fee & Billing Desk
- Scholarship -> Scholarship Desk
- Refunds -> Refunds Desk

Priority must be one of:
- LOW
- MEDIUM
- HIGH

Return a confidence score between 0.0 and 1.0.

Set requires_manual_review to true when:
- the query is ambiguous,
- no category clearly matches,
- multiple categories have similar relevance,
- or confidence is below 0.80.

Generate a short staff-readable summary.

Generate a concise professional draft reply for the student.
The draft reply is only a suggestion for officer review.
Do not claim that a payment, scholarship, or refund has already
been approved, processed, or completed unless the query itself
explicitly confirms that fact.

Student query:

Subject:
{subject}

Message:
{message}
"""

    result = structured_model.invoke(prompt)

    return AIClassificationResult.model_validate(result)