"""Shared data-builder helpers for TPV0095 team-visibility backend tests.

Only factory functions live here (no pytest fixtures — each test file defines
its own client fixture). Team/TeamMember are imported lazily inside functions
so the module imports cleanly while the target models are UNIMPLEMENTED (P3).

[PROD_NOT_TOUCHED] — helpers only run against isolated create_app instances.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import select

from peekview.models import Entry, User


def now_utc():
    return datetime.now(timezone.utc)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


async def register_user(client, username, password="testpass123"):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 201, f"Register {username} failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def get_user(session, username):
    return session.exec(select(User).where(User.username == username)).first()


def make_team(app, session, slug, name, owner_id, member_ids=()):
    """Create Team + TeamMember rows directly (owner + optional members)."""
    from peekview.models import Team, TeamMember

    team = Team(
        slug=slug,
        name=name,
        owner_id=owner_id,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    session.add(team)
    session.commit()
    session.refresh(team)
    for uid in member_ids:
        session.add(TeamMember(team_id=team.id, user_id=uid, joined_at=now_utc()))
    session.commit()
    session.refresh(team)
    return team


def make_team_member(app, session, team_id, user_id):
    from peekview.models import TeamMember

    session.add(TeamMember(team_id=team_id, user_id=user_id, joined_at=now_utc()))
    session.commit()


def make_entry_direct(
    app,
    session,
    *,
    slug,
    summary="Test",
    is_public=True,
    status="active",
    owner_id=None,
    team_id=None,
    archived_at=None,
    expires_at=None,
):
    entry = Entry(
        slug=slug,
        summary=summary,
        is_public=is_public,
        status=status,
        owner_id=owner_id,
        team_id=team_id,
        archived_at=archived_at,
        expires_at=expires_at,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def make_admin(app, session, username="adminuser"):
    user = session.exec(select(User).where(User.username == username)).first()
    if user and not user.is_admin:
        user.is_admin = True
        session.add(user)
        session.commit()


def add_live_star(session, entry_id, user_id):
    from peekview.models import EntryStar

    session.add(EntryStar(entry_id=entry_id, user_id=user_id, created_at=now_utc()))
    session.commit()
