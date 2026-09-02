"""Shared API-layer helper functions (deduplicated).

These helpers were previously duplicated across entries.py, files.py, and auth.py.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from fastapi import Request

from peekview.models import API_KEY_PREFIX, User

logger = logging.getLogger(__name__)

_SEARCH_ENGINES = {"google.", "bing.", "duckduckgo.", "baidu.", "yahoo.", "yandex.", "sogou."}
_SOCIAL_PLATFORMS = {"twitter.", "x.com", "facebook.", "linkedin.", "reddit.", "weibo.", "github.com"}


def _detect_channel(request: Request, slug: str | None = None) -> str:
    source = request.headers.get("X-PeekView-Source", "").lower()
    if source == "mcp":
        return "mcp"
    if "share=" in str(request.url.query):
        return "share"
    if slug:
        cookie_name = f"peekview_share_{slug}"
        if request.cookies.get(cookie_name):
            return "share"
    return "api"


def _classify_source(referer: str | None, request_host: str | None) -> str:
    if not referer:
        return "direct"
    try:
        ref_host = urlparse(referer).hostname or ""
        ref_host_lower = ref_host.lower()
    except Exception:
        return "other"

    if request_host:
        req_host_lower = request_host.lower().split(":")[0]
        if ref_host_lower == req_host_lower:
            return "internal"
    if any(engine in ref_host_lower for engine in _SEARCH_ENGINES):
        return "search"
    if any(social in ref_host_lower for social in _SOCIAL_PLATFORMS):
        return "social"
    return "other"


async def _record_read_async(
    app_state: Any,
    entry_id: int | None,
    entry_owner_id: int | None,
    action: str,
    channel: str,
    reader_id: int | None,
    reader_ip: str | None,
    request: Request | None = None,
) -> None:
    """Record a read event asynchronously (fire-and-forget)."""
    source = "direct"
    if request:
        referer = request.headers.get("Referer")
        host = request.base_url.hostname
        source = _classify_source(referer, host)
    try:
        app_state.read_tracking_service.record_read(
            entry_id=entry_id,
            entry_owner_id=entry_owner_id,
            action=action,
            channel=channel,
            reader_id=reader_id,
            reader_ip=reader_ip,
            source=source,
        )
    except Exception as e:
        logger.warning("Failed to record read event: %s", e)


def _looks_like_jwt(token: str) -> bool:
    """Heuristic: JWTs have 3 base64url-encoded segments separated by dots."""
    return len(token.split(".")) == 3


def _is_global_api_key_auth(request: Request, current_user: User | None) -> bool:
    """Check if request is authenticated via global master API key (no user binding).

    Only returns True when the presented key equals the server-configured master
    API key (read at request time from app.state.config so runtime changes and
    CLI/debug setups are honored). The presented header wins over any cookie/JWT
    identity (header > cookie per auth priority); presenting the master key IS the
    credential, so a match grants global read regardless of a lingering cookie.
    User-level API keys (pv_ prefix) are never global.
    """
    server_cfg = getattr(request.app.state.config, "server", None)
    master_key = getattr(server_cfg, "api_key", "") or ""
    if not master_key:
        return False

    x_key = request.headers.get("X-API-Key", "")
    if x_key and not x_key.startswith(API_KEY_PREFIX):
        return x_key == master_key

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        if not _looks_like_jwt(token) and not token.startswith(API_KEY_PREFIX):
            return token == master_key
    # Backward-compatible bare Authorization header (non-JWT, non-pv_) — the
    # value must equal the configured master key.
    elif auth and not auth.startswith("Bearer "):
        return auth == master_key

    return False
