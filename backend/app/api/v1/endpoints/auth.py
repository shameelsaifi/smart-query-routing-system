from typing import Any

from fastapi import APIRouter, Depends

from app.core.auth import get_authenticated_supabase_user
from app.core.rbac import get_current_application_user
from app.schemas.auth import ApplicationUserResponse
from app.services.auth_service import provision_application_user


router = APIRouter()


@router.post(
    "/provision",
    response_model=ApplicationUserResponse,
    summary="Provision an approved application user",
)
def provision_user(
    supabase_user: dict[str, Any] = Depends(get_authenticated_supabase_user),
) -> dict[str, Any]:
    return provision_application_user(supabase_user)


@router.get(
    "/me",
    response_model=ApplicationUserResponse,
    summary="Get the current verified application profile",
)
def current_profile(
    current_user: dict[str, Any] = Depends(get_current_application_user),
) -> dict[str, Any]:
    return current_user