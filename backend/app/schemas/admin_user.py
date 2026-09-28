from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)


UserRole = Literal[
    "STUDENT",
    "INSTRUCTOR",
    "DEPARTMENT_STAFF",
    "HOD",
    "ADMIN",
]


class AdminUserCreate(BaseModel):
    email: str = Field(
        min_length=3,
        max_length=255,
    )

    full_name: str = Field(
        min_length=1,
        max_length=150,
    )

    role: UserRole

    department_id: UUID | None = None

    desk_id: UUID | None = None


    @field_validator("email")
    @classmethod
    def normalize_email(
        cls,
        value: str,
    ) -> str:
        cleaned = value.strip().lower()

        if (
            "@" not in cleaned
            or cleaned.startswith("@")
            or cleaned.endswith("@")
        ):
            raise ValueError(
                "A valid email address is required."
            )

        return cleaned


    @field_validator("full_name")
    @classmethod
    def normalize_name(
        cls,
        value: str,
    ) -> str:
        cleaned = " ".join(
            value.split()
        )

        if not cleaned:
            raise ValueError(
                "Full name is required."
            )

        return cleaned


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )

    role: UserRole | None = None

    department_id: UUID | None = None

    desk_id: UUID | None = None

    is_active: bool | None = None


    @field_validator("full_name")
    @classmethod
    def normalize_name(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = " ".join(
            value.split()
        )

        if not cleaned:
            raise ValueError(
                "Full name cannot be empty."
            )

        return cleaned


class AdminManagedUser(BaseModel):
    approved_user_id: UUID

    user_id: UUID | None = None

    email: str

    full_name: str

    role: UserRole

    is_active: bool

    is_provisioned: bool

    is_available: bool | None = None

    department_id: UUID | None = None

    department_name: str | None = None

    desk_id: UUID | None = None

    desk_code: str | None = None

    desk_name: str | None = None

    created_at: datetime


class AdminUserListResponse(BaseModel):
    items: list[AdminManagedUser]

    total: int = Field(
        ge=0,
    )


class AdminDepartmentOption(BaseModel):
    department_id: UUID

    department_name: str


class AdminDeskOption(BaseModel):
    desk_id: UUID

    desk_code: str

    desk_name: str

    department_id: UUID


class AdminUserOptionsResponse(BaseModel):
    roles: list[UserRole]

    departments: list[
        AdminDepartmentOption
    ]

    desks: list[
        AdminDeskOption
    ]