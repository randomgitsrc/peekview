"""Rate limiting module using slowapi."""

import logging
from collections.abc import Callable

from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, swallow_errors=True)

# Dynamic rate limit providers (set by main.py after config is loaded)
_login_limit_provider: Callable[[], str] = lambda: "10/minute"
_captcha_limit_provider: Callable[[], str] = lambda: "60/minute"


def login_rate_limit() -> str:
    """Dynamic rate limit for login/register endpoints."""
    return _login_limit_provider()


def captcha_rate_limit() -> str:
    """Dynamic rate limit for captcha endpoints."""
    return _captcha_limit_provider()


def set_login_rate_limit(limit: str) -> None:
    """Update the login/register rate limit at runtime."""
    global _login_limit_provider
    _login_limit_provider = lambda: limit
    logger.info(f"Login rate limit set to {limit}")


def set_captcha_rate_limit(limit: str) -> None:
    """Update the captcha endpoint rate limit at runtime."""
    global _captcha_limit_provider
    _captcha_limit_provider = lambda: limit
    logger.info(f"Captcha rate limit set to {limit}")
