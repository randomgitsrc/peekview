"""API Key management service — create, list, revoke, verify."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

from peekview.database import get_engine
from peekview.exceptions import ForbiddenError, NotFoundError, ValidationError
from peekview.models import (
    API_KEY_PREFIX,
    ApiKey,
    ApiKeyCreateResponse,
    ApiKeyResponse,
    hash_api_key,
)
from peekview.services.file_service import parse_expires_in

logger = logging.getLogger(__name__)

MAX_ACTIVE_KEYS_PER_USER = 10


def get_apikey_service(app: Any) -> "ApiKeyService":
    """Get or create ApiKeyService from app.state (singleton per app)."""
    if not hasattr(app.state, "apikey_service"):
        from peekview.config import PeekConfig

        config = getattr(app.state, "config", None) or PeekConfig()
        engine = getattr(app.state, "engine", None) or get_engine(config.db_path)
        app.state.apikey_service = ApiKeyService(engine=engine)
    return app.state.apikey_service


class ApiKeyService:
    """Business logic for API key management."""

    def __init__(self, engine: Any) -> None:
        self.engine = engine

    def create_api_key(
        self,
        user_id: int,
        name: str,
        expires_in: str | None = None,
    ) -> ApiKeyCreateResponse:
        """Create a new API key for a user.

        Returns the plaintext key only once. The stored hash cannot be reversed.
        """
        # Check active key limit
        active_count = self.count_active_keys(user_id)
        if active_count >= MAX_ACTIVE_KEYS_PER_USER:
            raise ValidationError(
                f"Maximum {MAX_ACTIVE_KEYS_PER_USER} active API keys per user"
            )

        # Parse expiry
        expires_at = None
        if expires_in:
            delta = parse_expires_in(expires_in)
            if delta is not None:
                expires_at = datetime.now(timezone.utc) + delta

        # Generate key: pv_ + 32 bytes random
        raw_key = API_KEY_PREFIX + secrets.token_urlsafe(24)
        key_prefix = raw_key[:8]
        key_hash = hash_api_key(raw_key)

        api_key = ApiKey(
            user_id=user_id,
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            expires_at=expires_at,
        )

        with Session(self.engine) as session:
            session.add(api_key)
            session.commit()
            session.refresh(api_key)
            key_id = api_key.id
            created_at = api_key.created_at

        return ApiKeyCreateResponse(
            id=key_id,
            name=name,
            key=raw_key,
            key_prefix=key_prefix,
            expires_at=expires_at,
            created_at=created_at,
        )

    def list_api_keys(self, user_id: int) -> list[ApiKeyResponse]:
        """List all API keys for a user (no secret, no hash)."""
        with Session(self.engine) as session:
            keys = session.exec(
                select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc())
            ).all()

        return [
            ApiKeyResponse(
                id=k.id,
                name=k.name,
                key_prefix=k.key_prefix,
                expires_at=k.expires_at,
                last_used_at=k.last_used_at,
                created_at=k.created_at,
            )
            for k in keys
        ]

    def count_active_keys(self, user_id: int) -> int:
        """Count active (non-expired) keys for a user."""
        now = datetime.now(timezone.utc)
        with Session(self.engine) as session:
            # Use naive UTC for SQLite comparison
            now_naive = now.replace(tzinfo=None)
            count = session.exec(
                select(func.count(ApiKey.id)).where(
                    ApiKey.user_id == user_id,
                    (ApiKey.expires_at == None) | (ApiKey.expires_at > now_naive),  # noqa: E711
                )
            ).one()
        return count

    def revoke_api_key(
        self,
        key_id: int,
        user_id: int,
        is_admin: bool = False,
    ) -> None:
        """Revoke (delete) an API key. Only owner or admin can revoke."""
        with Session(self.engine) as session:
            api_key = session.exec(
                select(ApiKey).where(ApiKey.id == key_id)
            ).first()

            if api_key is None:
                raise NotFoundError(f"API key not found: {key_id}")

            if not is_admin and api_key.user_id != user_id:
                raise ForbiddenError("Cannot revoke another user's API key")

            session.delete(api_key)
            session.commit()

    def cleanup_expired_keys(self, user_id: int) -> int:
        """Delete all expired keys for a user. Returns count deleted."""
        now = datetime.now(timezone.utc)
        now_naive = now.replace(tzinfo=None)
        with Session(self.engine) as session:
            expired = session.exec(
                select(ApiKey).where(
                    ApiKey.user_id == user_id,
                    ApiKey.expires_at != None,  # noqa: E711
                    ApiKey.expires_at <= now_naive,
                )
            ).all()
            count = len(expired)
            for k in expired:
                session.delete(k)
            session.commit()
        return count

    def verify_api_key(self, key_value: str) -> tuple[Any | None, ApiKey | None]:
        """Verify an API key value.

        Returns (User, ApiKey) if valid, (None, None) if not.
        """
        from peekview.models import User

        key_hash = hash_api_key(key_value)
        now = datetime.now(timezone.utc)

        with Session(self.engine) as session:
            api_key = session.exec(
                select(ApiKey).where(ApiKey.key_hash == key_hash)
            ).first()

            if api_key is None:
                return None, None

            # Check expiry (handle offset-naive datetimes from SQLite)
            if api_key.expires_at:
                expires_at = api_key.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at < now:
                    logger.warning(
                        "Expired API key used: prefix=%s, user_id=%s",
                        api_key.key_prefix,
                        api_key.user_id,
                    )
                    return None, None

            # Check bound user is active
            user = session.exec(
                select(User).where(User.id == api_key.user_id)
            ).first()
            if user is None or not user.is_active:
                return None, None

            # Throttled last_used_at update (every 5 minutes)
            last_used = api_key.last_used_at
            if last_used and last_used.tzinfo is None:
                last_used = last_used.replace(tzinfo=timezone.utc)
            if last_used is None or (now - last_used).total_seconds() > 300:
                api_key.last_used_at = now.replace(tzinfo=None)
                session.add(api_key)

            # Expunge user before commit so commit's expiry doesn't detach it
            session.expunge(user)
            session.commit()
            return user, api_key
