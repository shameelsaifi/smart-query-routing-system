from typing import Any

from fastapi import (
    APIRouter,
    Depends,
)

from app.core.auth import (
    get_authenticated_supabase_user,
)
from app.core.rbac import (
    get_current_application_user,
    require_role,
)

from app.schemas.auth import (
    ApplicationUserResponse,
)
from app.schemas.instructor_availability import (
    InstructorAvailabilityUpdate,
)

from app.services.auth_service import (
    provision_application_user,
)
from app.services.instructor_availability_service import (
    update_instructor_availability,
)


router = APIRouter()


@router.post(
    "/provision",
    response_model=ApplicationUserResponse,
    summary=(
        "Provision an approved application user"
    ),
)
def provision_user(
    supabase_user: dict[str, Any] = Depends(
        get_authenticated_supabase_user
    ),
) -> dict[str, Any]:
    return provision_application_user(
        supabase_user
    )


@router.get(
    "/me",
    response_model=ApplicationUserResponse,
    summary=(
        "Get the current verified "
        "application profile"
    ),
)
def current_profile(
    current_user: dict[str, Any] = Depends(
        get_current_application_user
    ),
) -> dict[str, Any]:
    return current_user


@router.patch(
    "/me/availability",
    response_model=ApplicationUserResponse,
    summary=(
        "Update instructor availability "
        "and leave auto-reply"
    ),
)
def update_my_availability(
    data: InstructorAvailabilityUpdate,
    current_user: dict[str, Any] = Depends(
        require_role(
            "INSTRUCTOR"
        )
    ),
) -> dict[str, Any]:
    return update_instructor_availability(
        current_user,
        data,
    )