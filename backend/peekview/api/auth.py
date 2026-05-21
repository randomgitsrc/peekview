"""Authentication API endpoints."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from peekview.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_auth,
)
from peekview.api.rate_limit import limiter
from peekview.database import get_engine
from peekview.exceptions import InvalidCredentialsError, RegistrationError
from peekview.models import (
    RESERVED_USERNAMES,
    AuthResponse,
    User,
    UserLogin,
    UserRegister,
    UserResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", status_code=201)
@limiter.limit("10/minute")
async def register(data: UserRegister, request: Request) -> AuthResponse:
    """Register a new user.

    First user can always register (even if allow_registration=False).
    Returns REGISTRATION_FAILED (400) on failure to prevent username enumeration.
    """
    engine = request.app.state.engine
    config = request.app.state.config

    # Check if registration is allowed
    with Session(engine) as session:
        user_count = session.exec(select(User)).first()

        # First user exception: always allowed (and will be admin)
        is_first_user = user_count is None
        if not is_first_user and not config.auth.allow_registration:
            from peekview.exceptions import PeekError

            class RegistrationDisabledError(PeekError):
                status_code = 403
                error_code = "REGISTRATION_DISABLED"

            raise RegistrationDisabledError("Registration is disabled")

    # Validate reserved usernames
    if data.username.lower() in RESERVED_USERNAMES:
        raise RegistrationError("Registration failed. Please try a different username.")

    # Hash password
    password_hash = hash_password(data.password)

    # Create user (first user is automatically admin)
    user = User(
        username=data.username,
        password_hash=password_hash,
        display_name=data.display_name,
        is_admin=is_first_user,
    )

    try:
        with Session(engine) as session:
            session.add(user)
            session.commit()
            session.refresh(user)
    except IntegrityError:
        # Username already taken — return generic error to prevent enumeration
        raise RegistrationError("Registration failed. Please try a different username.")

    # Generate JWT
    from peekview.auth import _load_or_generate_secret_key

    secret_key = _load_or_generate_secret_key(config.auth.secret_key)
    token = create_access_token(user.id, secret_key, config.auth.token_expire_days)

    return AuthResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at,
        ),
    )


@router.post("/login")
@limiter.limit("10/minute")
async def login(data: UserLogin, request: Request) -> AuthResponse:
    """Login with username and password.

    Returns INVALID_CREDENTIALS (401) on failure (generic, prevents enumeration).
    """
    engine = request.app.state.engine
    config = request.app.state.config

    with Session(engine) as session:
        user = session.exec(
            select(User).where(User.username == data.username)
        ).first()

    # Generic error: don't reveal whether username exists or password is wrong
    if user is None or not user.is_active:
        raise InvalidCredentialsError("Invalid username or password")

    from peekview.auth import verify_password

    if not verify_password(data.password, user.password_hash):
        raise InvalidCredentialsError("Invalid username or password")

    # Generate JWT
    from peekview.auth import _load_or_generate_secret_key

    secret_key = _load_or_generate_secret_key(config.auth.secret_key)
    token = create_access_token(user.id, secret_key, config.auth.token_expire_days)

    return AuthResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at,
        ),
    )


@router.post("/logout", status_code=204)
async def logout():
    """Logout (no server-side action — client clears token)."""
    return None


@router.get("/me")
async def get_me(user: User = Depends(require_auth)) -> UserResponse:
    """Get current authenticated user info."""
    return UserResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
    )