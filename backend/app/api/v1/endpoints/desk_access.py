from typing import Any

from fastapi import APIRouter, Depends

from app.core.rbac import require_desk


router = APIRouter()


@router.get("/fee-billing")
async def fee_billing_access(
    current_user: dict[str, Any] = Depends(
        require_desk("FEE_BILLING")
    ),
) -> dict[str, str]:
    return {
        "message": "Fee & Billing Desk access granted.",
        "desk": current_user["desk_name"],
    }


@router.get("/scholarship")
async def scholarship_access(
    current_user: dict[str, Any] = Depends(
        require_desk("SCHOLARSHIP")
    ),
) -> dict[str, str]:
    return {
        "message": "Scholarship Desk access granted.",
        "desk": current_user["desk_name"],
    }


@router.get("/refunds")
async def refunds_access(
    current_user: dict[str, Any] = Depends(
        require_desk("REFUNDS")
    ),
) -> dict[str, str]:
    return {
        "message": "Refunds Desk access granted.",
        "desk": current_user["desk_name"],
    }