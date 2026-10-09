from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    auth,
    desk_access,
    email_delivery,
    email_intake,
    health,
    hod_audit,
    notifications,
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
    notifications.router,
    prefix="/notifications",
    tags=["Notifications"],
)

api_router.include_router(
    admin.router,
    prefix="/admin",
    tags=["Administration"],
)

api_router.include_router(
    email_intake.router,
    prefix="/email-intake",
    tags=["Email Intake"],
)

api_router.include_router(
    email_delivery.router,
    prefix="/email-delivery",
    tags=["Email Delivery"],
)

api_router.include_router(
    hod_audit.router,
    prefix="/hod",
    tags=["HOD"],
)