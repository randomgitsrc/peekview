"""Share link business logic — create, verify, revoke, cookie management."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, update
from sqlmodel import Session, select

from peekview.config import PeekConfig
from peekview.exceptions import ForbiddenError, NotFoundError, ValidationError
from peekview.models import (
    Entry,
    EntryShare,
    ShareCreateResponse,
    ShareListResponse,
    ShareResponse,
)
from peekview.services.file_service import parse_expires_in

logger = logging.getLogger(__name__)

MAX_SHARES_PER_ENTRY = 50
PERMANENT_COOKIE_MAX_AGE = 8640000  # 100 days


class ShareService:
    """Business logic for share link operations."""

    def __init__(self, engine: Any, config: PeekConfig | None = None):
        self.engine = engine
        self.config = config

    def create_share(
        self,
        slug: str,
        current_user_id: int,
        expires_in: str = "7d",
        max_views: int | None = None,
        is_admin: bool = False,
    ) -> ShareCreateResponse:
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            if not is_admin and entry.owner_id != current_user_id:
                raise ForbiddenError("Only the entry owner can create share links")

            if entry.is_public:
                raise ValidationError("Public entries don't need share links")

            if entry.status == "archived":
                raise ValidationError("Cannot create share for archived entry")

            now = datetime.now(timezone.utc)
            if entry.expires_at:
                entry_exp = entry.expires_at.replace(tzinfo=timezone.utc) if entry.expires_at.tzinfo is None else entry.expires_at
                if entry_exp <= now:
                    raise ValidationError("Cannot create share for expired entry")

            active_count = session.exec(
                select(func.count()).select_from(EntryShare).where(
                    EntryShare.entry_id == entry.id,
                    EntryShare.revoked_at == None,  # noqa: E711
                )
            ).one()
            if active_count >= MAX_SHARES_PER_ENTRY:
                raise ValidationError(
                    f"Maximum share links reached ({MAX_SHARES_PER_ENTRY})"
                )

            token = secrets.token_urlsafe(12)
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            token_prefix = token[:8]

            expires_at = None
            if expires_in and expires_in.strip() and expires_in != "0":
                delta = parse_expires_in(expires_in)
                if delta is not None:
                    expires_at = now + delta

            share = EntryShare(
                entry_id=entry.id,
                token_hash=token_hash,
                token_prefix=token_prefix,
                expires_at=expires_at,
                max_views=max_views,
                view_count=0,
                created_by=current_user_id,
            )
            session.add(share)
            session.commit()
            session.refresh(share)

            share_url = self._build_share_url(slug, token)

            return ShareCreateResponse(
                id=share.id,
                token_prefix=share.token_prefix,
                share_url=share_url,
                expires_at=share.expires_at,
                max_views=share.max_views,
                view_count=share.view_count,
                created_by=share.created_by,
                created_at=share.created_at,
                revoked_at=share.revoked_at,
            )

    def list_shares(
        self,
        slug: str,
        current_user_id: int,
        is_admin: bool = False,
    ) -> ShareListResponse:
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            if not is_admin and entry.owner_id != current_user_id:
                raise ForbiddenError("Only the entry owner can list share links")

            shares = session.exec(
                select(EntryShare)
                .where(EntryShare.entry_id == entry.id)
                .order_by(EntryShare.created_at.desc())
            ).all()

            share_responses = [
                ShareResponse(
                    id=s.id,
                    token_prefix=s.token_prefix,
                    expires_at=s.expires_at,
                    max_views=s.max_views,
                    view_count=s.view_count,
                    created_by=s.created_by,
                    created_at=s.created_at,
                    revoked_at=s.revoked_at,
                )
                for s in shares
            ]

            return ShareListResponse(
                shares=share_responses,
                total=len(share_responses),
            )

    def revoke_shares(
        self,
        slug: str,
        current_user_id: int,
        share_ids: list[int],
        is_admin: bool = False,
    ) -> int:
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            if not is_admin and entry.owner_id != current_user_id:
                raise ForbiddenError("Only the entry owner can revoke share links")

            now = datetime.now(timezone.utc)
            shares_to_revoke = session.exec(
                select(EntryShare).where(
                    EntryShare.entry_id == entry.id,
                    EntryShare.id.in_(share_ids),
                    EntryShare.revoked_at == None,  # noqa: E711
                )
            ).all()

            for s in shares_to_revoke:
                s.revoked_at = now
                session.add(s)

            session.commit()
            return len(shares_to_revoke)

    def verify_share_token(
        self,
        entry_id: int,
        token: str,
    ) -> EntryShare | None:
        computed_hash = hashlib.sha256(token.encode()).hexdigest()

        with Session(self.engine) as session:
            share = session.exec(
                select(EntryShare).where(
                    EntryShare.token_hash == computed_hash,
                    EntryShare.revoked_at == None,  # noqa: E711
                )
            ).first()

            if not share:
                return None

            if share.entry_id != entry_id:
                return None

            now = datetime.now(timezone.utc)

            if share.expires_at:
                share_exp = share.expires_at.replace(tzinfo=timezone.utc) if share.expires_at.tzinfo is None else share.expires_at
                if share_exp <= now:
                    return None

            if share.max_views is not None and share.view_count >= share.max_views:
                return None

            stmt = (
                update(EntryShare)
                .where(EntryShare.id == share.id, EntryShare.revoked_at == None)  # noqa: E711
                .values(view_count=EntryShare.view_count + 1)
            )
            session.exec(stmt)
            session.commit()
            session.refresh(share)

            return share

    def verify_share_cookie(
        self,
        entry_id: int,
        token_prefix: str,
    ) -> EntryShare | None:
        now = datetime.now(timezone.utc)

        with Session(self.engine) as session:
            share = session.exec(
                select(EntryShare).where(
                    EntryShare.entry_id == entry_id,
                    EntryShare.token_prefix == token_prefix,
                    EntryShare.revoked_at == None,  # noqa: E711
                )
            ).first()

            if not share:
                return None

            if share.expires_at:
                share_exp = share.expires_at.replace(tzinfo=timezone.utc) if share.expires_at.tzinfo is None else share.expires_at
                if share_exp <= now:
                    return None

            if share.max_views is not None and share.view_count >= share.max_views:
                return None

            return share

    def revoke_all_for_entry(self, entry_id: int, session: Session | None = None) -> int:
        def _do(s: Session) -> int:
            now = datetime.now(timezone.utc)
            active_shares = s.exec(
                select(EntryShare).where(
                    EntryShare.entry_id == entry_id,
                    EntryShare.revoked_at == None,  # noqa: E711
                )
            ).all()
            for share in active_shares:
                share.revoked_at = now
                s.add(share)
            return len(active_shares)

        if session is not None:
            return _do(session)

        with Session(self.engine) as s:
            result = _do(s)
            s.commit()
            return result

    def build_share_cookie_params(
        self,
        slug: str,
        token_prefix: str,
        expires_at: datetime | None,
        is_secure: bool = False,
    ) -> dict:
        now = datetime.now(timezone.utc)
        if expires_at:
            share_exp = expires_at.replace(tzinfo=timezone.utc) if expires_at.tzinfo is None else expires_at
            max_age = int((share_exp - now).total_seconds())
            if max_age < 0:
                max_age = 0
        else:
            max_age = PERMANENT_COOKIE_MAX_AGE

        return {
            "key": f"peekview_share_{slug}",
            "value": token_prefix,
            "path": "/",
            "httponly": True,
            "samesite": "lax",
            "max_age": max_age,
            "secure": is_secure,
        }

    def clear_share_cookie_params(self, slug: str) -> dict:
        return {
            "key": f"peekview_share_{slug}",
            "value": "",
            "path": "/",
            "httponly": True,
            "samesite": "lax",
            "max_age": 0,
        }

    def _build_share_url(self, slug: str, token: str) -> str:
        if self.config:
            base_url = self.config.build_view_url(slug)
        else:
            base_url = f"/{slug}"
        return f"{base_url}?share={token}"
