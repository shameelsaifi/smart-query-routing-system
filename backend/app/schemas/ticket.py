from pydantic import BaseModel, Field


class TicketCreate(BaseModel):
    subject: str = Field(
        min_length=1,
        max_length=200,
    )

    message: str = Field(
        min_length=1,
        max_length=5000,
    )


class TicketCreateResponse(BaseModel):
    ticket_id: str
    ticket_number: str
    subject: str
    message: str
    source: str
    status: str