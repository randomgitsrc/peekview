"""Star management API routes — my stars list + batch removal."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from peekview.api.rate_limit import entries_rate_limit, limiter
from peekview.auth import require_auth
from peekview.models import StarBatchRemoveRequest, User

router = APIRouter(prefix="/api/v1/stars", tags=["stars"])


@router.get("")
@limiter.shared_limit(entries_rate_limit, scope="entries_write", override_defaults=False)
async def list_my_stars(
    request: Request,
    filter: str = Query("all", description="all | active | expiring | expired"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_auth),
):
    """List the current user's stars: live entries + tombstone cards."""
    return request.app.state.star_service.list_starred(
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        star_filter=filter,
    )


@router.delete("")
@limiter.shared_limit(entries_rate_limit, scope="entries_write", override_defaults=False)
async def remove_stars(
    request: Request,
    body: StarBatchRemoveRequest,
    current_user: User = Depends(require_auth),
):
    """Batch-remove stars by entry_ids (also clears orphaned tombstones)."""
    removed = request.app.state.star_service.unstar_batch(current_user.id, body.entry_ids)
    return {"removed": removed}
