from typing import (
    Annotated,
    Any,
)

from fastapi import (
    APIRouter,
    Depends,
    Query,
    Response,
    status,
)

from app.core.rbac import require_role

from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementItem,
    AnnouncementListResponse,
)

from app.services.admin_dashboard_service import (
    get_admin_dashboard_stats,
)

from app.services.admin_report_service import (
    build_admin_excel_report,
    build_admin_pdf_report,
)

from app.services.announcement_service import (
    create_announcement,
    get_announcements,
)

from app.api.v1.endpoints.admin_users import (
    router as admin_users_router,
)

from app.api.v1.endpoints.admin_management import (
    router as admin_management_router,
)


router = APIRouter()

router.include_router(
    admin_users_router
)

router.include_router(
    admin_management_router
)


admin_dependency = require_role(
    "ADMIN",
)


@router.get(
    "/dashboard",
    summary=(
        "Get system-wide "
        "administrator analytics"
    ),
)
def admin_dashboard(
    response: Response,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> dict[str, Any]:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return get_admin_dashboard_stats(
        current_user
    )


@router.get(
    "/announcements",
    response_model=AnnouncementListResponse,
    summary=(
        "Get recent administrator "
        "announcements"
    ),
)
def list_announcements(
    response: Response,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),

    limit: Annotated[
        int,
        Query(
            ge=1,
            le=50,
        ),
    ] = 20,
) -> AnnouncementListResponse:
    response.headers[
        "Cache-Control"
    ] = "no-store"

    return AnnouncementListResponse(
        items=get_announcements(
            current_user,
            limit,
        )
    )


@router.post(
    "/announcements",
    response_model=AnnouncementItem,
    status_code=status.HTTP_201_CREATED,
    summary=(
        "Publish an administrator "
        "announcement"
    ),
)
def publish_announcement(
    data: AnnouncementCreate,

    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> AnnouncementItem:
    return AnnouncementItem.model_validate(
        create_announcement(
            current_user,
            data,
        )
    )


@router.get(
    "/reports/excel",
    summary=(
        "Export administrative "
        "report as Excel"
    ),
)
def export_excel_report(
    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> Response:
    report = build_admin_excel_report(
        current_user
    )

    return Response(
        content=report["content"],

        media_type=(
            "application/vnd.openxmlformats-"
            "officedocument.spreadsheetml.sheet"
        ),

        headers={
            "Content-Disposition": (
                'attachment; filename="'
                + report["filename"]
                + '"'
            ),
            "Cache-Control":
                "no-store",
        },
    )


@router.get(
    "/reports/pdf",
    summary=(
        "Export administrative "
        "report as PDF"
    ),
)
def export_pdf_report(
    current_user: dict[str, Any] = Depends(
        admin_dependency
    ),
) -> Response:
    report = build_admin_pdf_report(
        current_user
    )

    return Response(
        content=report["content"],

        media_type="application/pdf",

        headers={
            "Content-Disposition": (
                'attachment; filename="'
                + report["filename"]
                + '"'
            ),
            "Cache-Control":
                "no-store",
        },
    )