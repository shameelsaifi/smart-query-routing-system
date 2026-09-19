from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)

from app.schemas.ai_classification import (
    CATEGORY_DESTINATION_MAP,
    CategoryName,
    SuggestedDestination,
)


class StudentGuidanceRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    subject: str = Field(
        min_length=1,
        max_length=200,
    )

    message: str = Field(
        min_length=1,
        max_length=5000,
    )


class StudentGuidanceResult(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    improved_subject: str = Field(
        min_length=1,
        max_length=200,
    )

    improved_message: str = Field(
        min_length=1,
        max_length=5000,
    )

    likely_category: CategoryName

    likely_destination: SuggestedDestination

    missing_information: list[str] = Field(
        default_factory=list,
        max_length=8,
    )

    guidance_note: str = Field(
        min_length=1,
        max_length=600,
    )

    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
    )

    @model_validator(mode="after")
    def validate_guidance(self):
        expected_destination = (
            CATEGORY_DESTINATION_MAP[
                self.likely_category
            ]
        )

        if (
            self.likely_destination
            != expected_destination
        ):
            raise ValueError(
                "Likely destination does not "
                "match the selected category."
            )

        cleaned_missing: list[str] = []

        for item in self.missing_information:
            cleaned = item.strip()

            if (
                cleaned
                and cleaned
                not in cleaned_missing
            ):
                cleaned_missing.append(
                    cleaned[:250]
                )

        self.missing_information = (
            cleaned_missing[:8]
        )

        return self