"""Cap captcha verification wrapper.

Cap is a self-hosted, open-source CAPTCHA alternative to reCAPTCHA.
See https://capjs.js.org/ for details.

Architecture:
- Frontend embeds <cap-widget> web component
- Widget solves PoW + browser instrumentation challenges
- On solve, widget emits `cap-token` (or fills hidden form field)
- Frontend sends cap-token to PeekView backend
- Backend forwards to Cap standalone /siteverify
- Cap standalone returns { success: true/false }
- Backend propagates result to user as 401 CAPTCHA_INVALID/REQUIRED
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from peekview.exceptions import (
    CaptchaConfigError,
    CaptchaInvalidError,
    CaptchaRequiredError,
)

logger = logging.getLogger(__name__)


@dataclass
class CaptchaConfig:
    """Server-side captcha configuration (subset of PeekAuth)."""

    enabled: bool
    site_key: str
    secret_key: str
    verify_url: str
    exempt_first_user: bool = True


def _config_to_dataclass(auth_config) -> CaptchaConfig:
    """Convert PeekAuth section to CaptchaConfig dataclass.

    Args:
        auth_config: PeekAuth settings instance

    Returns:
        CaptchaConfig dataclass

    Raises:
        CaptchaConfigError: If captcha is enabled but required fields are missing
    """
    enabled = getattr(auth_config, "captcha_enabled", False)
    site_key = getattr(auth_config, "captcha_site_key", "")
    secret_key = getattr(auth_config, "captcha_secret_key", "")
    verify_url = getattr(auth_config, "captcha_verify_url", "")
    exempt = getattr(auth_config, "captcha_exempt_first_user", True)

    if enabled:
        missing = []
        if not site_key:
            missing.append("captcha_site_key")
        if not secret_key:
            missing.append("captcha_secret_key")
        if not verify_url:
            missing.append("captcha_verify_url")
        if missing:
            raise CaptchaConfigError(
                f"Captcha is enabled but missing config: {', '.join(missing)}"
            )

    return CaptchaConfig(
        enabled=enabled,
        site_key=site_key,
        secret_key=secret_key,
        verify_url=verify_url.rstrip("/"),
        exempt_first_user=exempt,
    )


async def verify_captcha_token(
    token: str | None,
    site_key: str,
    secret_key: str,
    verify_url: str,
    timeout: float = 5.0,
) -> bool:
    """Verify a Cap captcha token against the Cap standalone server.

    Args:
        token: The cap-token from the frontend widget
        site_key: The Cap site key (used in verify URL)
        secret_key: The Cap secret key (used in POST body)
        verify_url: The Cap standalone base URL
        timeout: HTTP timeout in seconds

    Returns:
        True if Cap says success, False otherwise

    Raises:
        CaptchaRequiredError: If token is empty/None
        Any other exception: Network errors etc. (caller may want to handle)
    """
    if not token:
        raise CaptchaRequiredError("Captcha token is required")

    verify_endpoint = f"{verify_url}/{site_key}/siteverify"
    logger.debug("Verifying captcha token at %s", verify_endpoint)

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            verify_endpoint,
            json={"secret": secret_key, "response": token},
        )
        resp.raise_for_status()
        data = resp.json()

    return bool(data.get("success", False))


# Alias for simpler imports / tests
verify_captcha = verify_captcha_token


async def enforce_captcha(
    token: str | None,
    auth_config,
    is_first_user: bool = False,
) -> None:
    """Enforce captcha check based on config and exempt rules.

    Args:
        token: Captcha token from request (may be None)
        auth_config: PeekAuth settings instance
        is_first_user: True if this is the first user (admin) being created

    Raises:
        CaptchaConfigError: Captcha enabled but config missing
        CaptchaRequiredError: Captcha enabled, no exempt, but token missing
        CaptchaInvalidError: Captcha token rejected by Cap
    """
    cfg = _config_to_dataclass(auth_config)

    if not cfg.enabled:
        return  # captcha disabled, no-op

    # First user exempt (admin setup convenience)
    if cfg.exempt_first_user and is_first_user:
        logger.info("Captcha bypassed for first user (admin setup)")
        return

    if not token:
        raise CaptchaRequiredError("Captcha token is required")

    success = await verify_captcha_token(
        token=token,
        site_key=cfg.site_key,
        secret_key=cfg.secret_key,
        verify_url=cfg.verify_url,
    )
    if not success:
        raise CaptchaInvalidError("Captcha verification failed")
