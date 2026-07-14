"""Rate limiting module using slowapi."""

import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, swallow_errors=True)


def _login_limit_provider() -> str:
    return "10/minute"


def _captcha_limit_provider() -> str:
    return "60/minute"


def _entries_limit_provider() -> str:
    return "60/minute"


def login_rate_limit() -> str:
    """Dynamic rate limit for login/register endpoints."""
    return _login_limit_provider()


def captcha_rate_limit() -> str:
    """Dynamic rate limit for captcha endpoints."""
    return _captcha_limit_provider()


def entries_rate_limit() -> str:
    """Dynamic rate limit for entries write endpoints."""
    return _entries_limit_provider()


def set_login_rate_limit(limit: str) -> None:
    """Update the login/register rate limit at runtime."""
    global _login_limit_provider

    def _login_limit_provider():
        return limit

    logger.info(f"Login rate limit set to {limit}")


def set_captcha_rate_limit(limit: str) -> None:
    """Update the captcha endpoint rate limit at runtime."""
    global _captcha_limit_provider

    def _captcha_limit_provider():
        return limit

    logger.info(f"Captcha rate limit set to {limit}")


def set_entries_rate_limit(limit: str) -> None:
    """Update the entries write endpoints rate limit at runtime."""
    global _entries_limit_provider

    def _entries_limit_provider():
        return limit

    logger.info(f"Entries rate limit set to {limit}")
