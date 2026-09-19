from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    app_name: str = (
        "Smart Query Routing & "
        "Email Automation API"
    )

    app_version: str = "0.1.0"
    environment: str = "development"

    api_v1_prefix: str = "/api/v1"

    frontend_url: str = (
        "http://localhost:5173"
    )

    database_url: str

    supabase_url: str
    supabase_publishable_key: str

    supabase_secret_key: (
        SecretStr | None
    ) = None

    gemini_api_key: str

    gemini_model: str = (
        "gemini-3.6-flash"
    )

    ai_manual_review_threshold: float = Field(
        default=0.80,
        ge=0.0,
        le=1.0,
    )

    processing_worker_enabled: bool = True

    processing_worker_poll_seconds: float = Field(
        default=2.0,
        ge=0.5,
        le=60.0,
    )

    processing_worker_lease_seconds: int = Field(
        default=300,
        ge=30,
        le=3600,
    )

    processing_worker_retry_max_seconds: int = Field(
        default=300,
        ge=5,
        le=3600,
    )

    # SLA automatic escalation worker.
    sla_escalation_worker_enabled: bool = True

    sla_escalation_poll_seconds: float = Field(
        default=30.0,
        ge=1.0,
        le=3600.0,
    )

    # Inbound email intake authentication.
    email_intake_api_key: (
        SecretStr | None
    ) = None

    # Outbound Gmail / n8n delivery authentication.
    email_delivery_api_key: (
        SecretStr | None
    ) = None

    # Gmail account connected inside n8n.
    gmail_sender_email: (
        str | None
    ) = None

    # How long an n8n worker may own
    # a claimed delivery job.
    email_delivery_lease_seconds: int = Field(
        default=300,
        ge=30,
        le=1800,
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()