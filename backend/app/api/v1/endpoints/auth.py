from typing import Any

from fastapi import APIRouter, Depends

from app.core.auth import get_authenticated_supabase_user
from app.services.auth_service import provision_application_user


router = APIRouter()


@router.post(
    "/provision",
    summary="Provision authenticated application user",
)
async def provision_user(
    supabase_user: dict[str, Any] = Depends(
        get_authenticated_supabase_user
    ),
) -> dict[str, Any]:
    return provision_application_user(supabase_user)