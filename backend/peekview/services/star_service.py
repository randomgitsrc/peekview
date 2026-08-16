"""Star business logic — star/unstar, star counts, star list, tombstone cleanup.

Stars act as "exemption tokens" that pause the archive-deletion countdown.
entry_id is a plain integer (no FK) so stars survive entry deletion; when an
entry is deleted while starred, the stars are bound to a tombstone via
tombstone_id (set by EntryService._delete_with_tombstone in the same transaction).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import delete as sa_delete
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from peekview.exceptions import NotFoundError
from peekview.models import (
    CountdownInfo,
    Entry,
    EntryStar,
    EntryStatus,
    EntryTombstone,
    StarItem,
    StarListResponse,
    StarResponse,
    TombstoneResponse,
    User,
)

logger = logging.getLogger(__name__)


def _naive_utc(dt: datetime) -> datetime:
    """Normalize a datetime to naive UTC (matching the archive_delete_at storage)."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def find_live_star(session, entry_id: int, user_id: int) -> EntryStar | None:
    """Return the user's live (non-tombstone-bound) star on an entry, if any."""
    if user_id is None:
        return None
    return session.exec(
        select(EntryStar).where(
            EntryStar.entry_id == entry_id,
            EntryStar.user_id == user_id,
            EntryStar.tombstone_id.is_(None),
        )
    ).first()


def find_star(session, entry_id: int, user_id: int) -> EntryStar | None:
    """Return the user's star on an entry (live or tombstone-bound), if any."""
    if user_id is None:
        return None
    return session.exec(
        select(EntryStar).where(
            EntryStar.entry_id == entry_id,
            EntryStar.user_id == user_id,
        )
    ).first()


def count_live_stars(session, entry_id: int) -> int:
    """Number of live stars on an entry (tombstone-bound stars excluded)."""
    return session.exec(
        select(func.count()).select_from(EntryStar).where(
            EntryStar.entry_id == entry_id,
            EntryStar.tombstone_id.is_(None),
        )
    ).one()


def build_countdown(entry: Entry, is_starred: bool = False) -> CountdownInfo | None:
    """Countdown for archived entries; None for active entries.

    status: paused (starred → countdown frozen), running (deadline in future),
    expired (deadline reached/passed). Starred entries are exempt (P2 §4.4:
    星标时 status=paused) — the paused status takes priority over expired.
    """
    if entry.status != EntryStatus.ARCHIVED or entry.archive_delete_at is None:
        return None

    deadline = _naive_utc(entry.archive_delete_at)
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # BLOCKER-1: both naive UTC
    remaining_days = (deadline - now).total_seconds() / 86400.0

    if is_starred:
        status = "paused"  # INFO-1: 星标豁免优先于 expired/running
    elif remaining_days <= 0:
        status = "expired"
    else:
        status = "running"

    return CountdownInfo(
        status=status,
        remaining_days=max(remaining_days, 0.0),
        archive_delete_at=deadline,
    )


class StarService:
    """Business logic for star (bookmark) operations."""

    def __init__(self, engine):
        self.engine = engine

    # ---- core operations ----

    def star(self, entry_id: int, user_id: int) -> StarResponse:
        """Add a live star for (entry_id, user_id).

        Idempotent: an existing live star returns already_starred=True with the
        same count. Concurrent duplicate inserts hit the partial unique index
        (ux_live_star) → IntegrityError → rollback → re-read → created=False.
        Service-level entry existence check (CRITICAL-2 Fix C / INFO-5): the
        route's get_entry pre-check is the primary gate; this closes the window
        where the entry is deleted between pre-check and insert.
        """
        with Session(self.engine) as session:
            if session.get(Entry, entry_id) is None:
                raise NotFoundError(f"Entry not found: {entry_id}")
            existing = find_live_star(session, entry_id, user_id)
            if existing is not None:
                return StarResponse(
                    star_count=count_live_stars(session, entry_id),
                    is_starred=True,
                    already_starred=True,
                    created=False,
                    created_at=existing.created_at,
                )

            star = EntryStar(
                entry_id=entry_id,
                user_id=user_id,
                tombstone_id=None,
                created_at=datetime.now(timezone.utc),
            )
            session.add(star)
            try:
                session.commit()
            except IntegrityError:
                # Concurrent duplicate: unique index won. Re-read and report as
                # already starred instead of failing with 500.
                session.rollback()
                existing = find_live_star(session, entry_id, user_id)
                created_at = existing.created_at if existing else None
                return StarResponse(
                    star_count=count_live_stars(session, entry_id),
                    is_starred=True,
                    already_starred=True,
                    created=False,
                    created_at=created_at,
                )
            return StarResponse(
                star_count=count_live_stars(session, entry_id),
                is_starred=True,
                already_starred=False,
                created=True,
                created_at=star.created_at,
            )

    def unstar(self, entry_id: int, user_id: int) -> StarResponse:
        """Remove the user's star on an entry (live or tombstone-bound).

        If the removed star was the last reference to its tombstone, the
        tombstone is deleted too (BDD-13).
        """
        with Session(self.engine) as session:
            star = session.exec(
                select(EntryStar).where(
                    EntryStar.entry_id == entry_id,
                    EntryStar.user_id == user_id,
                )
            ).first()
            if star is None:
                return StarResponse(
                    star_count=count_live_stars(session, entry_id),
                    is_starred=False,
                    already_starred=False,
                )

            tombstone_id = star.tombstone_id
            session.delete(star)
            session.commit()

            if tombstone_id is not None:
                self._delete_tombstone_if_unreferenced(session, tombstone_id)

            return StarResponse(
                star_count=count_live_stars(session, entry_id),
                is_starred=False,
                already_starred=False,
            )

    def unstar_batch(self, user_id: int, entry_ids: list[int]) -> int:
        """Batch-remove stars for a user; cleans up tombstones with no refs."""
        if not entry_ids:
            return 0
        with Session(self.engine) as session:
            stars = session.exec(
                select(EntryStar).where(
                    EntryStar.user_id == user_id,
                    EntryStar.entry_id.in_(entry_ids),
                )
            ).all()
            tombstone_ids = {s.tombstone_id for s in stars if s.tombstone_id is not None}
            for s in stars:
                session.delete(s)
            session.commit()

            for tid in tombstone_ids:
                self._delete_tombstone_if_unreferenced(session, tid)

            return len(stars)

    # ---- read operations ----

    def get_star_count(self, entry_id: int) -> int:
        """Number of live stars on an entry."""
        with Session(self.engine) as session:
            return count_live_stars(session, entry_id)

    def is_starred(self, entry_id: int, user_id: int | None) -> bool:
        """Whether the user has a live star on the entry."""
        if user_id is None:
            return False
        with Session(self.engine) as session:
            return find_live_star(session, entry_id, user_id) is not None

    def has_star(self, entry_id: int, user_id: int | None) -> bool:
        """Whether the user has any star on the entry (live or tombstone-bound)."""
        if user_id is None:
            return False
        with Session(self.engine) as session:
            return find_star(session, entry_id, user_id) is not None

    def list_starred(
        self,
        user_id: int,
        page: int = 1,
        per_page: int = 20,
        star_filter: str = "all",
    ) -> StarListResponse:
        """List the user's stars: live entries + tombstone cards.

        Live entries are visibility-filtered (is_public OR own OR archived),
        consistent with the read path — entries that became private after being
        starred are hidden from the list while their star/countdown stay intact.
        """
        page = max(page, 1)
        per_page = min(max(per_page, 1), 100)
        offset = (page - 1) * per_page

        with Session(self.engine) as session:
            all_stars = session.exec(
                select(EntryStar)
                .where(EntryStar.user_id == user_id)
                .order_by(EntryStar.created_at.desc())
            ).all()

            items: list[StarItem] = []
            for star in all_stars:
                item = self._build_star_item(session, star, user_id)
                if item is None:
                    continue
                if not self._matches_filter(item, star_filter):
                    continue
                items.append(item)

            # INFO-6: batch resolve owner usernames for the listed items
            owner_ids = {
                item.owner_id
                for item in items
                if item.type == "entry" and item.owner_id is not None
            }
            username_map: dict[int, str] = {}
            if owner_ids:
                users = session.exec(select(User).where(User.id.in_(owner_ids))).all()
                username_map = {u.id: u.username for u in users}
            for item in items:
                if item.type == "entry" and item.owner_id is not None:
                    item.username = username_map.get(item.owner_id)

            total = len(items)
            return StarListResponse(
                items=items[offset : offset + per_page],
                total=total,
                page=page,
                per_page=per_page,
            )

    # ---- tombstones ----

    def cleanup_orphan_tombstones(self) -> int:
        """Delete tombstones no longer referenced by any star (safety net).

        Normally tombstones are deleted when their last star is removed; this
        sweeps stragglers (e.g. after a user deletion cascades their stars away).
        Also sweeps orphan live stars whose entry no longer exists (CRITICAL-2
        Fix B: delete↔star race leftovers — tombstone-bound rows are untouched).
        """
        with Session(self.engine) as session:
            result = session.exec(
                text(
                    "DELETE FROM entry_tombstones WHERE id NOT IN "
                    "(SELECT DISTINCT tombstone_id FROM entry_stars "
                    " WHERE tombstone_id IS NOT NULL)"
                )
            )
            tombstone_count = result.rowcount or 0
            session.exec(
                text(
                    "DELETE FROM entry_stars WHERE tombstone_id IS NULL "
                    "AND entry_id NOT IN (SELECT id FROM entries)"
                )
            )
            session.commit()
            return tombstone_count

    # ---- internals ----

    def _delete_tombstone_if_unreferenced(self, session, tombstone_id: int) -> None:
        remaining = session.exec(
            select(func.count()).select_from(EntryStar).where(
                EntryStar.tombstone_id == tombstone_id
            )
        ).one()
        if remaining == 0:
            session.exec(sa_delete(EntryTombstone).where(EntryTombstone.id == tombstone_id))
            session.commit()

    def _build_star_item(self, session, star: EntryStar, user_id: int) -> StarItem | None:
        """Build a StarItem for one star row, or None if it should be hidden."""
        if star.tombstone_id is not None:
            tombstone = session.get(EntryTombstone, star.tombstone_id)
            if tombstone is None:
                return None
            return StarItem(
                type="tombstone",
                entry_id=star.entry_id,
                slug=tombstone.slug,
                summary=tombstone.title,
                starred_at=star.created_at,
                tombstone=TombstoneResponse(
                    id=tombstone.id,
                    entry_id=tombstone.entry_id,
                    slug=tombstone.slug,
                    title=tombstone.title,
                    cover=tombstone.cover,
                    deleted_by=tombstone.deleted_by,
                    deleted_at=tombstone.deleted_at,
                    reason=tombstone.reason,
                ),
            )

        entry = session.get(Entry, star.entry_id)
        if entry is None:
            return None

        # Visibility filter consistent with the read path: public / own / archived.
        if not (
            entry.is_public
            or entry.owner_id == user_id
            or entry.status == EntryStatus.ARCHIVED
        ):
            return None

        countdown = build_countdown(entry, is_starred=True)
        return StarItem(
            type="entry",
            entry_id=entry.id,
            slug=entry.slug,
            summary=entry.summary,
            status=entry.status,
            is_public=entry.is_public,
            owner_id=entry.owner_id,
            username=None,  # batch-resolved in list_starred (INFO-6)
            starred_at=star.created_at,
            star_count=count_live_stars(session, entry.id),
            is_starred=True,
            expires_at=entry.expires_at,
            archived_at=entry.archived_at,
            countdown=countdown,
        )

    @staticmethod
    def _matches_filter(item: StarItem, star_filter: str) -> bool:
        if star_filter == "all":
            return True
        if star_filter == "expired":
            if item.type == "tombstone":
                return True
            return item.countdown is not None and item.countdown.status == "expired"
        if item.type == "tombstone":
            return False
        if star_filter == "active":
            if item.countdown is None:
                return True
            return item.countdown.status != "expired" and item.countdown.remaining_days >= 7
        if star_filter == "expiring":
            if item.countdown is None:
                return False
            return (
                item.countdown.status != "expired"
                and 0 < item.countdown.remaining_days < 7
            )
        return True
