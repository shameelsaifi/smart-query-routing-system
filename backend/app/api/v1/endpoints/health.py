from fastapi import APIRouter

from app.core.config import settings


router = APIRouter()


@router.get("", summary="Check backend health")
async def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }