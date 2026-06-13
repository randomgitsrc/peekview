"""Admin routes — system statistics and cleanup operations."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from peekview.auth import require_admin
from peekview.models import AdminCleanupResponse, AdminStatsResponse, User

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
