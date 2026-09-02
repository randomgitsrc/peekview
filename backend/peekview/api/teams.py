"""Team management API routes (TPV0095).

All unprivileged access returns 404 (uniform anti-enumeration, same as a
non-existent team): detail read = owner or member; management = owner only;
self-exit = member; admin does NOT take over team management.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from peekview.auth import require_auth
from peekview.models import (
    MemberAddRequest,
    TeamCreateRequest,
    TeamRenameRequest,
    User,
)


def _get_team_service(request: Request):
    return request.app.state.team_service


router = APIRouter(prefix="/api/v1/teams", tags=["teams"])


@router.post("", status_code=201)
async def create_team(
    data: TeamCreateRequest,
    request: Request,
    current_user: User = Depends(require_auth),
):
    return _get_team_service(request).create_team(data.name, current_user.id)


@router.get("")
async def list_teams(
    request: Request,
    current_user: User = Depends(require_auth),
):
    return _get_team_service(request).list_teams(current_user.id)


@router.get("/{slug}")
async def get_team(
    slug: str,
    request: Request,
    current_user: User = Depends(require_auth),
):
    return _get_team_service(request).get_team(slug, current_user.id)


@router.patch("/{slug}")
async def rename_team(
    slug: str,
    data: TeamRenameRequest,
    request: Request,
    current_user: User = Depends(require_auth),
):
    return _get_team_service(request).rename_team(slug, data.name, current_user.id)


@router.delete("/{slug}", status_code=204)
async def delete_team(
    slug: str,
    request: Request,
    current_user: User = Depends(require_auth),
):
    _get_team_service(request).delete_team(slug, current_user.id)
    return None


@router.post("/{slug}/members", status_code=201)
async def add_member(
    slug: str,
    data: MemberAddRequest,
    request: Request,
    current_user: User = Depends(require_auth),
):
    return _get_team_service(request).add_member(slug, data.username, current_user.id)


@router.delete("/{slug}/members/{user_id}")
async def remove_member(
    slug: str,
    user_id: int,
    request: Request,
    current_user: User = Depends(require_auth),
):
    return _get_team_service(request).remove_member(slug, user_id, current_user.id)


@router.post("/{slug}/leave")
async def leave_team(
    slug: str,
    request: Request,
    current_user: User = Depends(require_auth),
):
    _get_team_service(request).leave_team(slug, current_user.id)
    return {"ok": True}
