from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class InstructorAvailabilityUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    is_available: bool

    auto_reply_message: str | None = Field(
        default=None,
        max_length=2000,
    )

    @field_validator(
        "auto_reply_message",
        mode="before",
    )
    @classmethod
    def clean_auto_reply(
        cls,
        value,
    ):
        if value is None:
            return None

        cleaned = str(value).strip()

        return cleaned or None

    @model_validator(
        mode="after",
    )
    def validate_leave_message(self):
        if self.is_available:
            self.auto_reply_message = None

        elif not self.auto_reply_message:
            raise ValueError(
                "Auto-reply message is required "
                "when the instructor is unavailable."
            )

        return self