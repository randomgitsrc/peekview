---
phase: P8
task_id: T058-overflow-share-redesign
type: release
parent: P7-consistency.md
trace_id: T058-P8-20260717
status: draft
created: 2026-07-17
agent: releaser
---

# T058 P8 — Release Preparation

## bump_type: minor

## Version Change

| Package | Old | New |
|---------|-----|-----|
| peekview (backend+frontend) | 0.8.0 | 0.9.0 |
| mcp_server | 0.9.2 | 0.9.2 (unchanged) |

## Rationale

T058 is a UI refactoring + new feature task (OverflowMenu thin wrapper split, ShareDialog Popover/Sheet dual-mode, share badge, swipe-to-close, responsive breakpoint alignment). Per semver, minor bump for backward-compatible new features and significant UI restructuring.

## packages (from P2-design.md)

- `frontend-v3` only (no backend, no MCP changes)

## CHANGELOG Update

[Unreleased] T058 entries moved under [0.9.0] heading.

## P5 Gate Re-run

- `npx vue-tsc --noEmit`: 0 errors (PASS)
- `npx vitest run`: 876 passed, 1 skipped (PASS)

## Temporary Resources

| Resource | Location | Notes |
|----------|----------|-------|
| Debug server | :8888 | `make debug-start` |
| Debug data dir | /tmp/peekview-debug/ | Isolated from production |

## Known Defects (carried from P7)

| ID | Severity | Description |
|----|----------|-------------|
| BUG-1 | Medium | ShareDialog.handleClickOutside closes same-click-opened Popover (share button is previous sibling, not child) |
| BUG-2 | Low/Design | showShareButton only for private entries; public entries cannot create share links |

## Release Checklist

- [x] P8-release.md created with bump_type
- [x] CHANGELOG.md updated (Unreleased -> 0.9.0)
- [x] bump-version executed (0.8.0 -> 0.9.0)
- [x] P5 gate re-run (vue-tsc 0 errors + vitest 876 pass)
- [x] git tag v0.9.0 created
- [ ] `make publish` (manual, by user)
