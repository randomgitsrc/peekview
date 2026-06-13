"""Authentication service for PeekView.

Provides JWT token management, password hashing, and FastAPI dependencies
for user authentication.
"""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, Request
from jose import JWTError, jwt
import bcrypt as _bcrypt
from sqlmodel import Session, select

from peekview.database import get_engine
from peekview.models import API_KEY_PREFIX, User, hash_api_key

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
BCRYPT_ROUNDS = 12
SECRET_KEY_FILE = Path.home() / ".peekview" / ".secret_key"


def _load_or_generate_secret_key(config_secret: str = "") -> str:
    """Load secret key from file, or generate and persist one.

    Priority:
    1. Explicit config/env var (if non-empty)
    2. Persistent file at ~/.peekview/.secret_key (0600 permissions)
    3. Auto-generate and persist
    """
    if config_secret:
        return config_secret

    if SECRET_KEY_FILE.exists():
        try:
            key = SECRET_KEY_FILE.read_text().strip()
            if key:
                return key
        except OSError:
            pass

    # Generate new key and persist with 0600 permissions
    key = secrets.token_urlsafe(32)
    SECRET_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Atomic write with O_CREAT | O_EXCL to prevent race conditions
    try:
        fd = os.open(
            str(SECRET_KEY_FILE),
            os.O_CREAT | os.O_EXCL | os.O_WRONLY,
            0o600,
        )
        with os.fdopen(fd, "w") as f:
            f.write(key)
        logger.info("Generated and persisted new secret key to %s", SECRET_KEY_FILE)
    except OSError:
        # File already exists from race condition — read it instead
        key = SECRET_KEY_FILE.read_text().strip()

    return key


def hash_password(password: str) -> str:
    """Hash a password using bcrypt (rounds=12).

    Args:
        password: Plain-text password (max 72 bytes for bcrypt).

    Returns:
        bcrypt hash string.
    """
    salt = _bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return _bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hash: str) -> bool:
    """Verify a password against a bcrypt hash.

    Args:
        password: Plain-text password.
        hash: bcrypt hash string.

    Returns:
        True if password matches, False otherwise.
    """
    return _bcrypt.checkpw(password.encode("utf-8"), hash.encode("utf-8"))


def create_access_token(
    user_id: int,
    secret_key: str,
    expire_days: int = 7,
) -> str:
    """Create a JWT access token.

    Args:
        user_id: User ID to encode in token (stored as string per JWT spec).
        secret_key: JWT signing key.
        expire_days: Token validity in days.

    Returns:
        Encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "exp": now + timedelta(days=expire_days),
        "iat": now,
    }
    return jwt.encode(payload, secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str, secret_key: str) -> dict[str, Any] | None:
    """Decode and validate a JWT access token.

    Args:
        token: JWT string.
        secret_key: JWT signing key.

    Returns:
        Decoded payload dict, or None if token is invalid/expired.
    """
    try:
        payload = jwt.decode(token, secret_key, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def get_current_user(request: Request) -> User | None:
    """Extract current user from JWT or user-level API key, or None for anonymous.

    Priority:
    1. JWT from Authorization header (Bearer eyJ...)
    2. JWT from httpOnly cookie (peekview_token)
    3. User-level API key (X-API-Key: pv_... or Authorization: Bearer pv_...)
    4. None (anonymous, or global API key which has no user binding)
    """
    auth_header = request.headers.get("Authorization", "")
    x_api_key = request.headers.get("X-API-Key", "")

    # 1. JWT from Authorization header (highest priority)
    jwt_token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        if _looks_like_jwt(token):
            jwt_token = token

    # 2. JWT from httpOnly cookie (if no header JWT)
    if jwt_token is None:
        cookie_token = request.cookies.get("peekview_token")
        if cookie_token:
            jwt_token = cookie_token

    # Validate JWT (from header or cookie)
    if jwt_token is not None:
        config = request.app.state.config
        secret_key = _load_or_generate_secret_key(config.auth.secret_key)
        payload = decode_access_token(jwt_token, secret_key)
        if payload is not None:
            try:
                user_id = int(payload["sub"])
            except (ValueError, KeyError):
                pass
            else:
                engine = request.app.state.engine
                with Session(engine) as session:
                    user = session.exec(select(User).where(User.id == user_id)).first()
                    if user is not None and user.is_active:
                        return user

    # 3. User-level API key (pv_ prefix)
    key_value = x_api_key or (auth_header[7:] if auth_header.startswith("Bearer ") else "")
    if key_value and key_value.startswith(API_KEY_PREFIX):
        from peekview.services.apikey_service import ApiKeyService

        engine = request.app.state.engine
        service = ApiKeyService(engine=engine)
        user, _api_key_obj = service.verify_api_key(key_value)
        if user is not None:
            return user

    return None


def _looks_like_jwt(token: str) -> bool:
    """Heuristic: JWTs have 3 base64url-encoded segments separated by dots."""
    return len(token.split(".")) == 3


def require_auth(user: User | None = Depends(get_current_user)) -> User:
    """FastAPI dependency that requires authentication.

    Returns 401 if user is not authenticated.
    """
    if user is None:
        from peekview.exceptions import AuthenticationError

        raise AuthenticationError("Authentication required")
    return user


def require_admin(user: User = Depends(require_auth)) -> User:
    """FastAPI dependency that requires authenticated admin user.

    require_admin = "must be logged in AND must be admin".
    This is distinct from get_current_user + is_admin passed to service methods:
    - require_admin: for admin-only endpoints (e.g. GET /api/v1/admin/stats),
      non-admin gets 403 FORBIDDEN.
    - get_current_user + is_admin in service: for visibility filtering,
      non-admin sees filtered results (not 403).
    """
    if not user.is_admin:
        from peekview.exceptions import ForbiddenError

        raise ForbiddenError("Admin access required")
    return user