"""Team business logic — CRUD + member management (TPV0095).

Owner-only write operations raise NotFoundError for non-owners/members to keep
enumeration semantics uniform (same 404 as "team does not exist").
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from peekview.exceptions import NotFoundError, ValidationError
from peekview.models import (
    Team,
    TeamDetail,
    TeamMember,
    TeamMemberInfo,
    TeamsListResponse,
    TeamSummary,
    User,
)

TEAM_NAME_MAX = 64
SLUG_PATTERN = re.compile(r"^[a-z0-9_-]+$")


def _slugify(name: str) -> str:
    """Best-effort slug from a team name (lowercase, hyphens for spaces)."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "team"


class TeamService:
    """Business logic for team CRUD and membership."""

    def __init__(self, engine: Any):
        self.engine = engine

    def _resolve_team(self, session: Session, slug: str) -> Team:
        team = session.exec(select(Team).where(Team.slug == slug)).first()
        if not team:
            raise NotFoundError(f"Team not found: {slug}")
        return team

    def create_team(self, name: str, owner_id: int) -> TeamDetail:
        name = (name or "").strip()
        if not name:
            raise ValidationError("Team name is required")
        if len(name) > TEAM_NAME_MAX:
            raise ValidationError(f"Team name exceeds max length ({TEAM_NAME_MAX})")
        with Session(self.engine) as session:
            slug = _slugify(name)
            base_slug = slug
            n = 1
            while True:
                try:
                    team = Team(name=name, slug=slug, owner_id=owner_id)
                    session.add(team)
                    session.commit()
                    session.refresh(team)
                    break
                except IntegrityError:
                    session.rollback()
                    # owner-scope duplicate name vs global slug collision are
                    # indistinguishable here — probe which one happened.
                    duplicate_name = session.exec(
                        select(Team).where(Team.owner_id == owner_id, Team.name == name)
                    ).first()
                    if duplicate_name:
                        raise ValidationError(
                            f"You already have a team named '{name}'"
                        ) from None
                    slug = f"{base_slug}-{n}"
                    n += 1
            return self._build_detail(session, team)

    def get_team(self, slug: str, current_user_id: int, is_admin: bool = False) -> TeamDetail:
        """Team detail — owner or member only (404 otherwise)."""
        with Session(self.engine) as session:
            team = self._resolve_team(session, slug)
            if not is_admin and team.owner_id != current_user_id and not self._is_member(
                session, team.id, current_user_id
            ):
                raise NotFoundError(f"Team not found: {slug}")
            return self._build_detail(session, team)

    def list_teams(self, current_user_id: int) -> TeamsListResponse:
        """owned + joined partitions for the current user."""
        with Session(self.engine) as session:
            owned = session.exec(
                select(Team).where(Team.owner_id == current_user_id).order_by(Team.created_at)
            ).all()
            joined_teams = session.exec(
                select(Team)
                .join(TeamMember, TeamMember.team_id == Team.id)
                .where(
                    TeamMember.user_id == current_user_id,
                    Team.owner_id != current_user_id,
                )
                .order_by(Team.created_at)
            ).all()
            return TeamsListResponse(
                owned=[self._summary(session, t) for t in owned],
                joined=[self._summary(session, t) for t in joined_teams],
            )

    def rename_team(self, slug: str, name: str, current_user_id: int) -> TeamDetail:
        name = (name or "").strip()
        if not name:
            raise ValidationError("Team name is required")
        if len(name) > TEAM_NAME_MAX:
            raise ValidationError(f"Team name exceeds max length ({TEAM_NAME_MAX})")
        with Session(self.engine) as session:
            team = self._resolve_team(session, slug)
            self._assert_owner(team, current_user_id, slug)
            dup = session.exec(
                select(Team).where(Team.owner_id == current_user_id, Team.name == name)
            ).first()
            if dup and dup.id != team.id:
                raise ValidationError(f"You already have a team named '{name}'")
            team.name = name
            team.updated_at = datetime.now(timezone.utc)
            session.add(team)
            session.commit()
            session.refresh(team)
            return self._build_detail(session, team)

    def delete_team(self, slug: str, current_user_id: int) -> None:
        with Session(self.engine) as session:
            team = self._resolve_team(session, slug)
            self._assert_owner(team, current_user_id, slug)
            session.delete(team)
            session.commit()

    def add_member(self, slug: str, username: str, current_user_id: int) -> TeamDetail:
        with Session(self.engine) as session:
            team = self._resolve_team(session, slug)
            self._assert_owner(team, current_user_id, slug)
            user = session.exec(select(User).where(User.username == username)).first()
            if not user:
                raise NotFoundError(f"User not found: {username}")
            if user.id == team.owner_id:
                raise ValidationError("The team owner is already a member")
            existing = session.exec(
                select(TeamMember).where(
                    TeamMember.team_id == team.id, TeamMember.user_id == user.id
                )
            ).first()
            if existing:
                raise ValidationError(f"{username} is already a member")
            session.add(
                TeamMember(team_id=team.id, user_id=user.id, joined_at=datetime.now(timezone.utc))
            )
            session.commit()
            session.refresh(team)
            return self._build_detail(session, team)

    def remove_member(self, slug: str, member_user_id: int, current_user_id: int) -> TeamDetail:
        with Session(self.engine) as session:
            team = self._resolve_team(session, slug)
            self._assert_owner(team, current_user_id, slug)
            if member_user_id == team.owner_id:
                raise ValidationError("Cannot remove the team owner")
            membership = session.exec(
                select(TeamMember).where(
                    TeamMember.team_id == team.id, TeamMember.user_id == member_user_id
                )
            ).first()
            if not membership:
                raise NotFoundError(f"Member not found: {member_user_id}")
            session.delete(membership)
            session.commit()
            session.refresh(team)
            return self._build_detail(session, team)

    def leave_team(self, slug: str, current_user_id: int) -> None:
        """Self-exit a team. Owner cannot leave (must delete instead)."""
        with Session(self.engine) as session:
            team = self._resolve_team(session, slug)
            if team.owner_id == current_user_id:
                raise ValidationError("The team owner cannot leave; delete the team instead")
            membership = session.exec(
                select(TeamMember).where(
                    TeamMember.team_id == team.id, TeamMember.user_id == current_user_id
                )
            ).first()
            if not membership:
                raise NotFoundError(f"Team not found: {slug}")
            session.delete(membership)
            session.commit()

    def resolve_team_id(self, slug: str) -> int | None:
        """Resolve a team slug to its id, or None (no existence leak)."""
        with Session(self.engine) as session:
            team = session.exec(select(Team).where(Team.slug == slug)).first()
            return team.id if team else None

    def get_team_row(self, slug: str) -> Team | None:
        with Session(self.engine) as session:
            return session.exec(select(Team).where(Team.slug == slug)).first()

    def _is_member(self, session: Session, team_id: int, user_id: int) -> bool:
        return (
            session.exec(
                select(TeamMember).where(
                    TeamMember.team_id == team_id, TeamMember.user_id == user_id
                )
            ).first()
            is not None
        )

    def _assert_owner(self, team: Team, current_user_id: int, slug: str) -> None:
        if team.owner_id != current_user_id:
            raise NotFoundError(f"Team not found: {slug}")

    def _member_count(self, session: Session, team_id: int) -> int:
        return session.exec(
            select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team_id)
        ).one()

    def _summary(self, session: Session, team: Team) -> TeamSummary:
        return TeamSummary(
            slug=team.slug,
            name=team.name,
            member_count=self._member_count(session, team.id),
        )

    def _build_detail(self, session: Session, team: Team) -> TeamDetail:
        owner = session.exec(select(User).where(User.id == team.owner_id)).first()
        members_rows = session.exec(
            select(TeamMember, User)
            .join(User, User.id == TeamMember.user_id)
            .where(TeamMember.team_id == team.id)
            .order_by(TeamMember.joined_at)
        ).all()
        members = [TeamMemberInfo(id=u.id, username=u.username) for _tm, u in members_rows]
        return TeamDetail(
            slug=team.slug,
            name=team.name,
            member_count=len(members),
            owner_username=owner.username if owner else None,
            members=members,
        )
