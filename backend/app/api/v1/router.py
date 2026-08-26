from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    desk_access,
    email_intake,
    health,
    tickets,
)


api_router = APIRouter()

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["Health"],
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"],
)

api_router.include_router(
    desk_access.router,
    prefix="/desks",
    tags=["Desk Access"],
)

api_router.include_router(
    tickets.router,
    prefix="/tickets",
    tags=["Tickets"],
)

api_router.include_router(
    email_intake.router,
    prefix="/email-intake",
    tags=["Email Intake"],
)