---
phase: P8
task_id: T059
type: release
parent: P7-consistency.md
trace_id: T059-P8-20260720
status: verified
created: 2026-07-20
agent: releaser
---

# P8 Release — T059 Markdown Extensions

## Version Bump

- **bump_type**: patch
- **Version change**: 0.9.1 → 0.9.2
- **Git tag**: v0.9.2

## CHANGELOG Update

- Content under `## [Unreleased]` moved to `## [0.9.2] - 2026-07-20`
- Entry: "Markdown 扩展：KaTeX 数学公式（行内 `$...$` + 块级 `$$...$$`）、任务列表 checkbox（`- [x]`/`- [ ]`）、脚注（`[^1]`）、上标/下标（`x^2^`/`H~2~O`）"
- CHANGELOG amended into bump-version commit

## P5 Gate Re-run Results

| Gate | Result | Details |
|------|--------|---------|
| Frontend vitest | 892 passed, 20 failed | 20 failures all in ShareDialog.spec.ts (pre-existing T058 issue, not T059) |
| Frontend vue-tsc | 0 errors | Clean |
| Backend pytest | 936 passed, 2 skipped | Clean |

All T059-relevant tests pass. ShareDialog failures are pre-existing and unrelated.

## Temporary Resources for Main Agent Cleanup

- Debug backend running on `:8888`
- Test data in `/tmp/peekview-debug/` (slug: `mdext`)
- Playwright CDP connection to Chrome `:18800`

## Next Steps (Manual)

1. `make pre-publish-quick` — quick publish check
2. `make publish` — PyPI publish
3. `git push && git push origin v0.9.2` — push code + tag
4. Upgrade production: `pipx upgrade peekview && sudo systemctl restart peekview`
