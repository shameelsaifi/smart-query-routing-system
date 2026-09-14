from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel


class UserRole(StrEnum):
    STUDENT = "STUDENT"
    INSTRUCTOR = "INSTRUCTOR"
    DEPARTMENT_STAFF = "DEPARTMENT_STAFF"
    HOD = "HOD"
    ADMIN = "ADMIN"


class ApplicationUserResponse(BaseModel):
    user_id: UUID
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    is_available: bool
    auto_reply_message: str | None = None
    department_id: UUID | None = None
    department_name: str | None = None
    desk_id: UUID | None = None
    desk_code: str | None = None
    desk_name: str | None = None