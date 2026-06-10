"""Rate limiting module using slowapi."""

import logging
from typing import Callable

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, swallow_errors=True)

# Dynamic rate limit provider for login/register
# Set by main.py after config is loaded
_login_rate_limit_provider: Callable[[], str] = lambda: "10/minute"


def login_rate_limit() -> str:
    """Dynamic rate limit for login/register endpoints.
    
    Called by slowapi at request time to get the current limit string.
    """
    return _login_rate_limit_provider()


def set_login_rate_limit(limit: str) -> None:
    """Update the login/register rate limit at runtime."""
    global _login_rate_limit_provider
    _login_rate_limit_provider = lambda: limit
    logger.info(f"Login rate limit set to {limit}")