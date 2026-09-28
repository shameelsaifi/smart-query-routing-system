from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)


# ============================================================
# ADMIN QUERY MONITORING
# ============================================================


class AdminQueryItem(BaseModel):
    ticket_id: UUID
    ticket_number: str

    student_id: UUID
    student_name: str
    student_email: str

    subject: str
    source: str
    status: str

    category: str | None = None
    priority: str | None = None
    confidence: float | None = None

    department_id: UUID | None = None
    department_name: str | None = None

    desk_id: UUID | None = None
    desk_name: str | None = None

    assigned_officer_id: UUID | None = None
    assigned_officer_name: str | None = None

    requires_manual_review: bool

    created_at: datetime
    submitted_at: datetime | None = None
    updated_at: datetime
    sla_due_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None


class AdminQueryListResponse(BaseModel):
    items: list[AdminQueryItem]

    total: int = Field(
        ge=0,
    )

    page: int = Field(
        ge=1,
    )

    page_size: int = Field(
        ge=1,
    )

    total_pages: int = Field(
        ge=0,
    )


# ============================================================
# DEPARTMENTS
# ============================================================


class AdminDepartmentItem(BaseModel):
    department_id: UUID
    department_name: str
    department_email: str

    description: str | None = None

    is_active: bool
    created_at: datetime

    active_users: int = 0
    active_routing_rules: int = 0
    active_queries: int = 0


class AdminDepartmentListResponse(BaseModel):
    items: list[AdminDepartmentItem]
    total: int = Field(ge=0)


class AdminDepartmentCreate(BaseModel):
    department_name: str = Field(
        min_length=2,
        max_length=150,
    )

    department_email: str = Field(
        min_length=3,
        max_length=255,
    )

    description: str | None = Field(
        default=None,
        max_length=2000,
    )


    @field_validator(
        "department_name",
    )
    @classmethod
    def clean_name(
        cls,
        value: str,
    ) -> str:
        cleaned = " ".join(
            value.split()
        )

        if not cleaned:
            raise ValueError(
                "Department name is required."
            )

        return cleaned


    @field_validator(
        "department_email",
    )
    @classmethod
    def clean_email(
        cls,
        value: str,
    ) -> str:
        cleaned = (
            value.strip().lower()
        )

        if (
            "@" not in cleaned
            or cleaned.startswith("@")
            or cleaned.endswith("@")
        ):
            raise ValueError(
                "A valid department email is required."
            )

        return cleaned


    @field_validator(
        "description",
    )
    @classmethod
    def clean_description(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None


class AdminDepartmentUpdate(BaseModel):
    department_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    department_email: str | None = Field(
        default=None,
        min_length=3,
        max_length=255,
    )

    description: str | None = Field(
        default=None,
        max_length=2000,
    )

    is_active: bool | None = None


    @field_validator(
        "department_name",
    )
    @classmethod
    def clean_name(
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
                "Department name cannot be empty."
            )

        return cleaned


    @field_validator(
        "department_email",
    )
    @classmethod
    def clean_email(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = (
            value.strip().lower()
        )

        if (
            "@" not in cleaned
            or cleaned.startswith("@")
            or cleaned.endswith("@")
        ):
            raise ValueError(
                "A valid department email is required."
            )

        return cleaned


    @field_validator(
        "description",
    )
    @classmethod
    def clean_description(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None


# ============================================================
# ROUTING RULES
# ============================================================


RoutingTargetRole = Literal[
    "INSTRUCTOR",
    "DEPARTMENT_STAFF",
    "HOD",
]


class AdminRoutingRuleItem(BaseModel):
    rule_id: UUID
    rule_code: str

    category_id: UUID
    category_code: str
    category_name: str

    department_id: UUID
    department_name: str

    desk_id: UUID | None = None
    desk_code: str | None = None
    desk_name: str | None = None

    target_role: str

    rule_expression: dict[str, Any]

    priority_order: int

    is_active: bool
    created_at: datetime


class AdminRoutingRuleListResponse(BaseModel):
    items: list[AdminRoutingRuleItem]
    total: int = Field(ge=0)


class AdminRoutingRuleCreate(BaseModel):
    rule_code: str = Field(
        min_length=2,
        max_length=60,
    )

    category_id: UUID
    department_id: UUID
    desk_id: UUID | None = None

    target_role: RoutingTargetRole = (
        "DEPARTMENT_STAFF"
    )

    rule_expression: dict[str, Any] = Field(
        default_factory=dict,
    )

    priority_order: int = Field(
        default=1,
        ge=1,
    )

    is_active: bool = True


    @field_validator(
        "rule_code",
        mode="before",
    )
    @classmethod
    def normalize_code(
        cls,
        value,
    ) -> str:
        cleaned = (
            str(value)
            .strip()
            .upper()
            .replace(" ", "_")
            .replace("-", "_")
        )

        if (
            not cleaned
            or not cleaned[0].isalpha()
            or not all(
                char.isalnum()
                or char == "_"
                for char in cleaned
            )
        ):
            raise ValueError(
                "Rule code must contain only "
                "letters, numbers and underscores "
                "and must start with a letter."
            )

        return cleaned


class AdminRoutingRuleUpdate(BaseModel):
    rule_code: str | None = Field(
        default=None,
        min_length=2,
        max_length=60,
    )

    category_id: UUID | None = None
    department_id: UUID | None = None
    desk_id: UUID | None = None

    target_role: RoutingTargetRole | None = None

    rule_expression: dict[str, Any] | None = None

    priority_order: int | None = Field(
        default=None,
        ge=1,
    )

    is_active: bool | None = None


    @field_validator(
        "rule_code",
        mode="before",
    )
    @classmethod
    def normalize_code(
        cls,
        value,
    ):
        if value is None:
            return None

        cleaned = (
            str(value)
            .strip()
            .upper()
            .replace(" ", "_")
            .replace("-", "_")
        )

        if (
            not cleaned
            or not cleaned[0].isalpha()
            or not all(
                char.isalnum()
                or char == "_"
                for char in cleaned
            )
        ):
            raise ValueError(
                "Rule code must contain only "
                "letters, numbers and underscores "
                "and must start with a letter."
            )

        return cleaned


class AdminCategoryOption(BaseModel):
    category_id: UUID
    category_code: str
    category_name: str
    default_priority: str
    is_active: bool


class AdminDepartmentOption(BaseModel):
    department_id: UUID
    department_name: str
    is_active: bool


class AdminDeskOption(BaseModel):
    desk_id: UUID
    department_id: UUID

    desk_code: str
    desk_name: str

    is_active: bool


class AdminRoutingOptionsResponse(BaseModel):
    categories: list[AdminCategoryOption]
    departments: list[AdminDepartmentOption]
    desks: list[AdminDeskOption]


# ============================================================
# AUDIT LOGS
# ============================================================


class AdminAuditLogItem(BaseModel):
    audit_id: UUID
    event_sequence: int

    actor_user_id: UUID | None = None
    actor_name: str | None = None
    actor_email: str | None = None
    actor_service: str | None = None

    action: str
    entity_type: str
    entity_id: UUID | None = None

    outcome: str

    old_values: dict[str, Any] | None = None
    new_values: dict[str, Any] | None = None
    details: dict[str, Any]

    request_id: UUID | None = None
    ip_address: str | None = None

    created_at: datetime


class AdminAuditLogListResponse(BaseModel):
    items: list[AdminAuditLogItem]

    total: int = Field(
        ge=0,
    )

    page: int = Field(
        ge=1,
    )

    page_size: int = Field(
        ge=1,
    )

    total_pages: int = Field(
        ge=0,
    )