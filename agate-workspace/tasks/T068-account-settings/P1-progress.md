
## P1 analyst progress — 2026-07-23

### Input file readings

1. **P0-brief.md** — Task brief with 5 fields complete. Key: new /settings page (3 tabs), PATCH /auth/me backend, ApiKeyListView migration, auth guard needed. Mechanism cross: backend + frontend ≥2 subsystems → full agate.

2. **auth.py** — Existing endpoints: GET /me (L186), DELETE /me (L199), POST /change-password (L228). change-password does NOT invalidate JWT (only stores user_id in token, no password hash reference). Pattern: require_auth dependency, HTTPException for errors, Session-based DB access.

3. **models.py** — User model (L111) already has display_name: str | None = Field(default=None, max_length=64). UserResponse (L616) includes display_name. ChangePasswordRequest (L725) exists. No UpdateProfile/ProfileUpdate schema exists yet — PATCH /auth/me needs a new request schema.

4. **router.ts** — /settings/apikeys route at L30, no auth guard. beforeEach only handles / → /explore redirect for authenticated users. No guard for /settings/*.

5. **ApiKeyListView.vue** — Full self-contained page (491 lines) with: header, key list, create dialog, revoke confirm, cleanup expired. Uses api client, authStore, toast. All functionality must be preserved in migration.

6. **auth.ts store** — user ref, fetchMe(), authState computed. No updateProfile method yet. fetchMe can refresh user after PATCH.

### Key findings

- **change-password does NOT invalidate token**: JWT only contains user_id + expiry. Password change doesn't affect token validity. No re-login needed after password change.
- **No auth guard on /settings/apikeys**: Current page relies on implicit assumption user is logged in. New /settings MUST add explicit guard.
- **EntryListView:377**: `router.push('/settings/apikeys')` — must update to `/settings?tab=apikeys` for backward compat, plus add 302 redirect for old route.
- **display_name field exists in model**: No DB migration needed. Just need new Pydantic schema + API endpoint.
- **User TypeScript type already has displayName**: No type changes needed on frontend.


### P1-requirements.md written

- 14 BDD conditions (BDD-01 through BDD-14)
- 14 implicit requirements identified across data/frontend/multi-endpoint/boundary/compatibility dimensions
- [NO_NEED_CONFIRM] — change-password token behavior confirmed (does NOT invalidate), no ambiguous business decisions
- risk_level: medium
- phases: [P1, P2, P3, P4, P5, P6, P8]
- capability_requirements: browser-vision (available), mobile-viewport-testing (available)
- Key resolution: change-password does NOT invalidate JWT (token only contains user_id + expiry), so no re-login needed after password change

