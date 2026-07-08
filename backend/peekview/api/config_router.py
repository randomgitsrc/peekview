"""Public configuration endpoint for frontend bootstrap.

Exposes captcha-related public config (site_key, endpoint URL, enabled flag)
without leaking the secret_key. Frontend uses this to decide whether to
render the <cap-widget> and to know which site_key/endpoint to use.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/config", tags=["config"])


class PublicCaptchaConfig(BaseModel):
    """Public captcha config — NO secret_key here."""

    enabled: bool
    site_key: str
    endpoint: str
    mode: str  # "builtin" | "external"


@router.get("/captcha", response_model=PublicCaptchaConfig)
async def get_captcha_config(request: Request) -> PublicCaptchaConfig:
    """Return public captcha config for frontend bootstrap.

    Never includes secret_key (server-side only).
    Auto-detects builtin vs external mode based on verify_url.
    """
    config = request.app.state.config
    auth = config.auth

    # Auto-detect mode based on verify_url
    mode = "builtin"
    verify_url = getattr(auth, "captcha_verify_url", "")
    if verify_url and verify_url.strip() and verify_url != "http://localhost:3000":
        mode = "external"

    return PublicCaptchaConfig(
        enabled=getattr(auth, "captcha_enabled", False),
        site_key=getattr(auth, "captcha_site_key", ""),
        endpoint="/api/v1/captcha" if mode == "builtin" else verify_url,
        mode=mode,
    )


class PublicLimitsConfig(BaseModel):
    """Public limits config — safe to expose (no secrets)."""

    default_expires_in: str
    max_file_size: int
    max_entry_files: int
    max_entry_size: int
    max_slug_length: int
    max_summary_length: int


class PublicDiagramConfig(BaseModel):
    """Public diagram config — safe to expose (no secrets)."""

    sanitize_enabled: bool


@router.get("/diagram", response_model=PublicDiagramConfig)
async def get_diagram_config(request: Request) -> PublicDiagramConfig:
    """Return public diagram config for frontend."""
    config = request.app.state.config
    return PublicDiagramConfig(
        sanitize_enabled=config.diagram.sanitize_enabled,
    )


@router.get("/limits", response_model=PublicLimitsConfig)
async def get_limits_config(request: Request) -> PublicLimitsConfig:
    """Return public limits configuration for frontend/MCP consumption.

    These values are safe to expose. No authentication required.
    Frontend uses this to pre-fill creation forms.
    MCP can read this to generate accurate tool descriptions.
    """
    limits = request.app.state.config.limits
    return PublicLimitsConfig(
        default_expires_in=limits.default_expires_in,
        max_file_size=limits.max_file_size,
        max_entry_files=limits.max_entry_files,
        max_entry_size=limits.max_entry_size,
        max_slug_length=limits.max_slug_length,
        max_summary_length=limits.max_summary_length,
    )
