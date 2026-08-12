# PeekView E2E Test Plan

> Covers all user interaction paths against a debug server at http://127.0.0.1:8888
> Run via: `make debug-test` from project root

---

## Test Suite 1: Basic Functionality

- TC-001: Health check (`GET /health` → 200)
- TC-002: Homepage loads
- TC-003: Create and view code entry

## Test Suite 2: Mermaid Diagrams

- TC-010: Mermaid diagram renders and fills container
- TC-011: Mermaid code/diagram toggle preserves chart
- TC-012: Mermaid fullscreen fills window

## Test Suite 3: Pagination

- TC-020: Pagination shows page numbers (22+ entries)
- TC-021: Page navigation works

## Test Suite 4: Theme

- TC-030: Theme toggle works (data-theme attribute changes)

## Test Suite 5: Mobile

- TC-040: Mobile layout (375x812 — no sidebars, mobile actions visible)
- TC-041: Single file hides Files button on mobile
- TC-042: Multi file shows Files button with count

## Test Suite 6: Authentication

- TC-050: Login button visible when anonymous
- TC-051: Login dialog opens and registers
- TC-052: Private entry invisible to anonymous, visible to owner
- TC-053: Card shows owner actions for owned entries
- TC-054: Visibility toggle works on card
- TC-055: Logout clears session (token removed from localStorage)

## Test Suite 7: All/Mine Tabs

- TC-060: Owner tabs visible when authenticated
- TC-061: Mine tab filters to own entries
- TC-062: Owner tabs hidden when anonymous

## Test Suite 8: API Key Management

- TC-070: API Keys link in user menu dropdown
- TC-071: API Keys page loads at `/settings/apikeys`
- TC-072: Create API key via UI (name + expiry, full key shown once)
- TC-073: API key can create entries (X-API-Key header, owner_id bound)
- TC-074: Revoke API key (confirm dialog, key removed from list)

---

## Running Tests

```bash
# From project root — full debug flow
make debug-build && make debug-start && make debug-test

# Or manually from frontend-v3/
BASE_URL=http://127.0.0.1:8888 npx playwright test

# With UI mode
BASE_URL=http://127.0.0.1:8888 npx playwright test --ui

# Single test file
BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/debug-server.spec.ts
```

## Test Results

- Screenshots: `/tmp/e2e-results/*.png`
- Playwright report: `frontend-v3/playwright-report/`
