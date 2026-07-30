"""Shared API-layer helper functions (deduplicated).

These helpers were previously duplicated across entries.py, files.py, and auth.py.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request

from peekview.models import API_KEY_PREFIX, User

logger = logging.getLogger(__name__)


async def _record_read_async(
    app_state: Any,
    entry_id: int | None,
    entry_owner_id: int | None,
    action: str,
    channel: str,
    reader_id: int | None,
    reader_ip: str | None,
) -> None:
    """Record a read event asynchronously (fire-and-forget)."""
    try:
        app_state.read_tracking_service.record_read(
            entry_id=entry_id,
            entry_owner_id=entry_owner_id,
            action=action,
            channel=channel,
            reader_id=reader_id,
            reader_ip=reader_ip,
        )
    except Exception as e:
        logger.warning("Failed to record read event: %s", e)


def _looks_like_jwt(token: str) -> bool:
    """Heuristic: JWTs have 3 base64url-encoded segments separated by dots."""
    return len(token.split(".")) == 3


def _is_global_api_key_auth(request: Request, current_user: User | None) -> bool:
    """Check if request is authenticated via global master API key (no user binding).

    Only returns True for global master key — it bypasses ownership checks.
    User-level API keys (pv_ prefix) have current_user set, treated like JWT.
    """
    if current_user is not None:
        return False

    x_key = request.headers.get("X-API-Key", "")
    if x_key and not x_key.startswith(API_KEY_PREFIX):
        return True

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        if not _looks_like_jwt(token) and not token.startswith(API_KEY_PREFIX):
            return True

    return False
