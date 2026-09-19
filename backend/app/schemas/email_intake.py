from pydantic import BaseModel, Field


class SimulatedEmailCreate(BaseModel):
    gmail_message_id: str = Field(
        min_length=1,
        max_length=255,
    )

    sender_email: str = Field(
        min_length=3,
        max_length=255,
    )

    subject: str = Field(
        min_length=1,
        max_length=200,
    )

    message: str = Field(
        min_length=1,
        max_length=5000,
    )


class SimulatedEmailResponse(BaseModel):
    ticket_id: str
    ticket_number: str

    gmail_message_id: str

    sender_email: str
    subject: str
    message: str

    source: str
    status: str

    duplicate: bool