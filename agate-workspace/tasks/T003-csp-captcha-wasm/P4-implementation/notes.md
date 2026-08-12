---
phase: P4
task_id: T003
task_name: csp-captcha-wasm
trace_id: T003-P4-20260612
created: 2026-06-12
---

## Implementation

**File changed:** `backend/peekview/main.py` (lines 139-158)

**Change:** CSP `connect-src` now conditionally includes `https://cdn.jsdelivr.net` only when `config.auth.captcha_enabled` is `True`.

**Logic:**
- Reads `request.app.state.config.auth.captcha_enabled` (default `False`) via `getattr` for safety
- If `captcha_enabled=True`: `connect-src 'self' https://cdn.jsdelivr.net`
- If `captcha_enabled=False`: `connect-src 'self'` (unchanged behavior)

**Config path:** `PEEKVIEW_AUTH__CAPTCHA_ENABLED` env var → `PeekAuth.captcha_enabled` (default: `False`)
