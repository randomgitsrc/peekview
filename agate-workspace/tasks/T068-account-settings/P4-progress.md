# P4 Progress

## 2026-07-23 — Input reading complete

All files_to_read from P2-design.md have been read. Key findings:

### Backend
- `api/auth.py:186-248`: GET /me at L186, DELETE /me at L199, POST /change-password at L228
- `models.py:101-145`: User model with display_name (nullable, max_length=64) already exists
- `models.py:725-728`: ChangePasswordRequest at L725, UpdateProfileRequest goes after it
- `auth.py:1-30`: require_auth imported from peekview.models (User), used as Depends(require_auth)

### Frontend
- `router.ts`: 5 routes, beforeEach guard at L58 only checks `/` → `/explore` redirect
- `stores/auth.ts`: authStore with user, authState, login/register/logout/fetchMe — needs updateProfile
- `api/client.ts`: No changePassword method yet — needs to be added
- `ApiKeyListView.vue`: Full 491-line component with header, page-content, dialogs
- `EntryListView.vue:375-378`: navigateToApiKeys() pushes '/settings/apikeys' — needs update
- `types/index.ts:103-118`: User type with displayName field already exists

### Test expectations
- Backend: 16 tests in test_auth_me.py (PATCH /me auth, validation, update, change-password session)
- Frontend: 19 tests in t068-account-settings.spec.ts using data-testid selectors
- Frontend tests mock useToast with show/success/error methods
- Frontend tests mock api.changePassword and api.updateProfile
- SettingsView must have data-testid="settings-page" (hidden when anonymous)
- Profile tab: data-testid="profile-username" (readonly), "profile-display-name", "profile-role", "profile-member-since", "profile-save"
- Security tab: data-testid="tab-security", "security-old-password", "security-new-password", "security-confirm-password", "security-submit"
- API Keys tab: data-testid="tab-apikeys", "apikeys-content"

## 2026-07-23 — Implementation complete

### Backend changes
- models.py: Added UpdateProfileRequest schema (display_name: str | None = None, max_length=64)
- api/auth.py: Added PATCH /me endpoint (require_auth, trim, empty→null, commit, return UserResponse)
- All 16 backend tests pass

### Frontend changes
- SettingsView.vue: Single-page tab component with auth guard, tab↔URL sync, mobile stacked layout
- ProfileTab.vue: Display name edit + readonly fields (username/role/member since)
- SecurityTab.vue: Change password form with frontend validation + submit protection
- ApiKeySettingsTab.vue: Extracted from ApiKeyListView (no header), all features preserved
- router.ts: /settings route + /settings/apikeys redirect + auth guard
- stores/auth.ts: updateProfile() action
- api/client.ts: updateProfile() + changePassword() methods
- useToast.ts: success() + error() convenience methods
- EntryListView.vue: navigateToApiKeys path updated to /settings?tab=apikeys

### Self-check results
- Backend: 16/16 passed
- Frontend T068: 19/19 passed
- Frontend full: 997 passed, 1 skipped
- ruff: passed
- vue-tsc: 0 errors in impl code

### DESIGN_GAP reported
- useToast success/error convenience methods added (test mock expected them)
