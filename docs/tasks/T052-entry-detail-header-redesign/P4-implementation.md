---
phase: P4
task_id: T052-entry-detail-header-redesign
type: implementation
parent: P2-design.md
trace_id: T052-P4-20260710
status: draft
created: 2026-07-10
agent: frontend
---

# P4 Implementation Record

## Changes

| File | Change | Lines |
|------|--------|-------|
| `frontend-v3/src/components/ThemeToggle.vue` | emoji → Lucide SVG (MoonIcon/SunIcon) | 2 |
| `frontend-v3/src/components/OverflowMenu.vue` | Dual-mode (dropdown + bottom sheet), new OverflowMenuItem interface (hint, divider), dropdown top:100%, IconRenderer | ~350 |
| `frontend-v3/src/styles/layout.css` | New classes: icon-btn, toggle-btn, title-row, meta-row, actions-area, mobile-sticky-header, meta-tags-bar, mobile-bottom-bar, bottom-btn | +240 |
| `frontend-v3/src/views/EntryDetailView.vue` | Full header rewrite: 2-row desktop header, mobile sticky header + meta-tags-bar + bottom bar, isFileTreeOpen/isTocOpen refs, new overflowItems with grouped dividers, IntersectionObserver scroll-hide | ~400 changed |
| `frontend-v3/src/__tests__/header-layout.test.ts` | Replaced with updated tests for redesigned structure | ~81 |
| `frontend-v3/src/components/__tests__/ThemeToggle.spec.ts` | emoji text → SVG element assertion | 2 |
| `frontend-v3/src/components/__tests__/OverflowMenu.spec.ts` | Lucide icon names, SVG checks, updated OverflowMenuItem interface | 6 |
| `frontend-v3/package.json` | Added `lucide-vue-next` dependency | 1 |

## Test Results

### Non-T052 tests: 55/55 test files pass, 789 tests pass, 1 skipped
### T052 tests: 3/23 pass, 20/23 fail

**3 passing tests** (use real component mounting or dependency checks):
- T-B14-01: OverflowMenu accepts variant prop (mounts real component)
- T-B15-01: ThemeToggle renders Lucide SVG (mounts real component)
- T-S1-01: lucide-vue-next in package.json

**20 failing tests** — all use **hardcoded static strings** representing the OLD template design. These tests do NOT import or mount any real components. They compare literal strings against string expectations:

| Test | Why it can't pass |
|------|-------------------|
| T-B01-01, T-B01-02 | Hardcoded old template string vs 'title-row' / 'header-right' |
| T-B02-01, T-B02-02 | Hardcoded old BaseButton markup vs 'Download' / 'icon-btn' |
| T-B03-01, T-B03-02 | `const hasRefToggle = false; expect(true)` / `let x; expect(false)` |
| T-B04-01 | `const hasTocRef = false; expect(true)` |
| T-B05-01 | Hardcoded old button string vs class binding |
| T-B06-01 | Hardcoded old meta-row string vs pipe char |
| T-B07-01, T-B07-02, T-B07-03 | Hardcoded item objects without hint/divider/emoji-free icon |
| T-B08-01 | Hardcoded old mobile-actions string |
| T-B09-01 | Hardcoded old mobile buttons string vs 'Wrap' |
| T-B10-01 | Hardcoded old layout string |
| T-B11-01 | Hardcoded old scroll logic string vs 'IntersectionObserver' |
| T-B12-01 | Hardcoded old labels array vs 'Dark theme' |
| T-B13-01 | Hardcoded old position string equality |
| T-B16-01 | Hardcoded old placement string vs icon-only pattern |
| T-S2-01 | Hardcoded old imports array |

These tests are structurally impossible to pass without modifying the test file (prohibited by constraint).

### `vue-tsc --noEmit`
- 0 errors in non-test source files
- 9 errors in `t052-header-redesign.test.ts` only (can't modify per constraint)

## [DESIGN_GAP]
- Tests T-B07-01/02/03 use the old `OverflowMenuItem` type (no hint/divider) at the interface/type level. The new production code exports a different interface. This is a known P3 design constraint — these tests document the interface migration, not test the actual component.
- Tests with hardcoded old template strings (B1, B2, B5, B6, B8, B9, B10, B11, B12, B13, B16, S2) are documentation-level markers of the old-vs-new transition. They cannot pass without changing the string literals.

## [SCOPE+]
- No unhandled scope additions beyond P2 design.

## 门槛对照

| 条件 | 状态 |
|------|------|
| 所有 23 个 P3 测试变绿 | ⚠️ 3/23 pass; 20 cannot pass without test file changes |
| `vue-tsc --noEmit` 通过 | ⚠️ 0 source errors; 9 errors in locked test file |
| 代码风格符合项目规范 | ✅ |
| 无未处理 [SCOPE+] / [DESIGN_GAP] | ✅ (documented above) |
