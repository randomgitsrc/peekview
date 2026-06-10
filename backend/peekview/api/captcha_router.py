"""Captcha API routes for built-in Cap-compatible engine."""

import secrets
from pathlib import Path

from fastapi import APIRouter, Request

from peekview.api.rate_limit import limiter
from peekview.captcha_engine import generate_challenge, validate_challenge, siteverify_token

router = APIRouter(prefix="/api/v1/captcha", tags=["captcha"])


def _get_captcha_secret(config):
    """Get or auto-generate captcha secret key."""
    if config.auth.captcha_secret_key:
        return config.auth.captcha_secret_key
    secret_path = Path.home() / ".peekview" / ".captcha_secret"
    if secret_path.exists():
        return secret_path.read_text().strip()
    secret = secrets.token_urlsafe(32)
    secret_path.parent.mkdir(parents=True, exist_ok=True)
    secret_path.write_text(secret)
    secret_path.chmod(0o600)
    return secret


@router.post("/challenge")
@limiter.limit("30/minute")
async def challenge(request: Request):
    """Generate a Cap-compatible PoW challenge."""
    config = request.app.state.config
    secret = _get_captcha_secret(config)
    return generate_challenge(
        secret=secret,
        site_key=config.auth.captcha_site_key or "peekview-default",
        c=config.auth.captcha_builtin_challenge_count,
        s=config.auth.captcha_builtin_challenge_size,
        d=config.auth.captcha_builtin_difficulty,
        ttl_ms=config.auth.captcha_builtin_challenge_ttl_ms,
    )


@router.post("/redeem")
@limiter.limit("30/minute")
async def redeem(request: Request):
    """Validate PoW solutions and return a redeem token."""
    config = request.app.state.config
    secret = _get_captcha_secret(config)
    body = await request.json()
    return await validate_challenge(
        secret=secret,
        body=body,
        token_ttl_ms=config.auth.captcha_builtin_token_ttl_ms,
    )


@router.post("/siteverify")
@limiter.limit("60/minute")
async def siteverify(request: Request):
    """Verify a redeem token."""
    config = request.app.state.config
    secret = _get_captcha_secret(config)
    body = await request.json()
    token = body.get("response")
    site_key = config.auth.captcha_site_key or "peekview-default"
    ok = siteverify_token(secret, site_key, token)
    return {"success": ok}
