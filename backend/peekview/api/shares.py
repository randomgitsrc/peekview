"""Share link API routes — create, list, revoke."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from peekview.auth import require_auth
from peekview.models import ShareCreateRequest, ShareRevokeRequest, User


def _get_share_service(request: Request):
    return request.app.state.share_service


router = APIRouter(prefix="/api/v1/entries", tags=["shares"])


@router.post("/{slug}/shares", status_code=201)
async def create_share(
    slug: str,
    data: ShareCreateRequest,
    request: Request,
    current_user: User = Depends(require_auth),
):
    service = _get_share_service(request)
    is_admin = current_user.is_admin
    expires_in = data.expires_in or "7d"
    return service.create_share(
        slug=slug,
        current_user_id=current_user.id,
        expires_in=expires_in,
        max_views=data.max_views,
        is_admin=is_admin,
    )


@router.get("/{slug}/shares")
async def list_shares(
    slug: str,
    request: Request,
    current_user: User = Depends(require_auth),
):
    service = _get_share_service(request)
    is_admin = current_user.is_admin
    return service.list_shares(
        slug=slug,
        current_user_id=current_user.id,
        is_admin=is_admin,
    )


@router.post("/{slug}/shares/revoke")
async def revoke_shares(
    slug: str,
    data: ShareRevokeRequest,
    request: Request,
    current_user: User = Depends(require_auth),
):
    service = _get_share_service(request)
    is_admin = current_user.is_admin
    revoked_count = service.revoke_shares(
        slug=slug,
        current_user_id=current_user.id,
        share_ids=data.share_ids,
        is_admin=is_admin,
    )
    return {"revoked_count": revoked_count}
