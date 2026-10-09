import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import warm_database_pool
from app.services.sla_escalation_worker import (
    sla_escalation_worker_loop,
)
from app.services.ticket_processing_worker import (
    processing_worker_loop,
)


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker_tasks: list[asyncio.Task] = []

    try:
        await asyncio.to_thread(
            warm_database_pool
        )
        logger.info(
            "Database connection pool warmed successfully."
        )

    except SQLAlchemyError:
        logger.exception(
            "Database warm-up failed. "
            "Application startup will continue."
        )

    if settings.processing_worker_enabled:
        worker_tasks.append(
            asyncio.create_task(
                processing_worker_loop(),
                name="ticket-processing-worker",
            )
        )

    if settings.sla_escalation_worker_enabled:
        worker_tasks.append(
            asyncio.create_task(
                sla_escalation_worker_loop(),
                name="sla-escalation-worker",
            )
        )

    try:
        yield

    finally:
        for task in worker_tasks:
            task.cancel()

        for task in worker_tasks:
            try:
                await task

            except asyncio.CancelledError:
                pass


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Backend API for the Smart Query Routing "
        "and Email Automation System."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    api_router,
    prefix=settings.api_v1_prefix,
)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "message": settings.app_name,
        "documentation": "/docs",
    }
