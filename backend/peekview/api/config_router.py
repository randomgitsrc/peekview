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
