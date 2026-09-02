"""Team membership lookup helper (thin module, shared by read-path services).

Kept dependency-free from other services so entry_service and star_service can
import it without import cycles. All read paths use the same EXISTS shape.
"""

from __future__ import annotations

from sqlmodel import select

from peekview.models import Team, TeamMember

__all__ = ["team_membership_exists", "team_owner_exists"]


def team_membership_exists(
    session, user_id: int | None, team_id: int | None
) -> bool:
    """Return True if user_id is a member of the team (team_id non-null)."""
    if user_id is None or team_id is None:
        return False
    return (
        session.exec(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        ).first()
        is not None
    )


def team_owner_exists(
    session, user_id: int | None, team_id: int | None
) -> bool:
    """Return True if user_id is the owner of the team (team_id non-null)."""
    if user_id is None or team_id is None:
        return False
    return (
        session.exec(
            select(Team).where(
                Team.id == team_id,
                Team.owner_id == user_id,
            )
        ).first()
        is not None
    )
