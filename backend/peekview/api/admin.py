"""Admin routes — system statistics and cleanup operations."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from peekview.auth import require_admin
from peekview.models import (
    AdminCleanupResponse,
    AdminStatsResponse,
    ResetPasswordRequest,
    User,
    UserResponse,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    request: Request,
    admin: User = Depends(require_admin),
) -> AdminStatsResponse:
    return request.app.state.admin_service.get_stats()


@router.post("/cleanup", response_model=AdminCleanupResponse)
async def cleanup_expired_entries(
    request: Request,
    admin: User = Depends(require_admin),
) -> AdminCleanupResponse:
    return request.app.state.admin_service.cleanup_expired()


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    request: Request,
    username: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
) -> list[UserResponse]:
    return request.app.state.admin_service.list_users(
        username=username, page=page, per_page=per_page
    )


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    request: Request,
    admin: User = Depends(require_admin),
) -> None:
    try:
        request.app.state.admin_service.delete_user(
            user_id=user_id, current_user_id=admin.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    data: ResetPasswordRequest,
    request: Request,
    admin: User = Depends(require_admin),
) -> dict:
    new_password = request.app.state.admin_service.reset_password(
        user_id=user_id, new_password=data.new_password
    )
    return {"new_password": new_password}
