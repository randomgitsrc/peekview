---
phase: P1
task_id: T058
type: review
parent: P1-requirements.md
trace_id: T058-P1R2-20260717
status: approved
created: 2026-07-17
agent: requirements-review
---

# P1 Requirements Review (R2) — T058

## Revision Check — R1 Issues Resolution

### BLOCKER

**B1** (ShareInfo 缺 shareUrl): **RESOLVED**. §2.1 now explicitly states the frontend will construct the full share URL from entry slug + share token + base URL (`{base_url}/{slug}?share={full_token}`), with no backend change required. Implicit need #1 in §2.6 table reflects this. BDD-07 Given clause now includes the URL assembly rule inline. The "No backend change required" claim in §2.3 is now consistent with the frontend-assembly approach.

### WARNING

**W1** (缺 danger hover BDD): **RESOLVED**. BDD-03 now has two When/Then branches — non-danger hover to `--c-surface-lower`, danger hover to `--c-error`-derived token (e.g., `--c-error-subtle`). Implicit need #9 also covers this.

**W2** (缺空状态 BDD): **RESOLVED**. BDD-21 added: "Given 0 active and 0 expired/revoked share links / When user opens share container / Then 'No active share links' message + 'Create share link' primary button visible". Implicit need #11 also covers this.

**W3** (缺 mobile share button BDD): **RESOLVED**. BDD-22 added: "Given mobile viewport / Then share button visible in mobile bottom bar / And badge shows active link count (hidden when 0)". Implicit need #8 also covers this.

**W4** (BDD-10 拆分): **RESOLVED**. BDD-10 split into BDD-10a (create view UI), BDD-10b (create success), BDD-10c (create failure). Each is independently verifiable at P6.

**W5** (BDD-13 max-height): **RESOLVED**. BDD-13 Then clause now includes "And the Popover max-height is `calc(100vh - header - 20px)`", matching P0-brief.

**W6** (§2.2 Badge reactivity 实现细节): **RESOLVED**. §2.2 now states "The share store's data must be the source of truth for the active count" — no mention of `computed activeCount` or `shares ref`. Implementation detail removed.

**W7** (缺 Popover 键盘导航 BDD): **RESOLVED**. BDD-23 added: Tab cycles through interactive elements, Enter on copy button copies URL, Escape closes Popover and returns focus. Implicit need #12 also covers this.

**W8** (缺 tablet viewport): **RESOLVED**. BDD-24 added: "Given tablet viewport (641px <= width <= 1024px) / Then Popover (280px) appears / And OverflowMenu uses dropdown variant". Implicit need #13 also covers this.

**W9** (P3 裁剪): **RESOLVED**. Phase tailoring now includes P3 with rationale: "TDD test-first required — OverflowMenu sub-component props/emits contracts, ShareDialogContent view-switching logic, badge reactivity, and keyboard navigation all have testable behavior contracts." Visual-only aspects excluded from P3 (covered by P5/P6).

### INFO

**I1** (测试文件适配): **RESOLVED**. §2.5 now explicitly mentions `OverflowMenu.spec.ts` unit test adaptation and E2E test file updates (`t052-header-redesign.e2e.spec.ts`, `test_t057_ui_polish.spec.ts`). Implicit need #10 also covers this.

**I2** (URL 截断描述): **RESOLVED**. BDD-07 now states "middle-truncated with `...`" with example `https://peek....com/abc?share=xA4b`, aligned with P0-brief.

## BDD 评审 (Full Re-evaluation)

### BDD-01: Dropdown background token
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-02: Dropdown border and shadow tokens
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-03: Menu item hover state
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **备注**: Now covers both non-danger and danger hover branches. Danger hover uses `--c-error`-derived token.

### BDD-04: Share item removed from OverflowMenu
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✓ 边界✗ 兼容✓

### BDD-05: Share button badge reflects active count
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **备注**: Mobile badge now covered by BDD-22; desktop badge covered here. Multi-platform dimension now satisfied.

### BDD-06: Loading state in share container
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✓ 边界✗ 兼容✓

### BDD-07: Active share link display
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **备注**: Given clause now includes URL assembly rule. Middle-truncation specified with example.

### BDD-08: Copy share link
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-09: Expired/revoked links collapsible section
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-10a: Create view UI
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-10b: Create share link success
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-10c: Create share link failure
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-11: Revoke share link (instant, no confirmation)
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-12: Popover open/close on desktop
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✓ 边界✗ 兼容✓

### BDD-13: Popover does not overflow viewport
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✓ 兼容✓
- **备注**: max-height value now specified: `calc(100vh - header - 20px)`.

### BDD-14: Bottom Sheet on mobile
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✓ 边界✗ 兼容✓

### BDD-15: Bottom Sheet close on mobile
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✓ 边界✗ 兼容✓

### BDD-16: Desktop dropdown is a separate sub-component
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-17: Mobile sheet is a separate sub-component
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-18: Light theme rendering
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-19: Dark theme rendering
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-20: Keyboard navigation in OverflowMenu
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-21: Empty state in share container
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓

### BDD-22: Mobile share button in bottom bar
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✓ 边界✗ 兼容✓

### BDD-23: Keyboard navigation in Share Popover/Sheet
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-24: Tablet viewport behavior
- **判定**: PASS (可二值)
- **覆盖维度**: 数据✗ 前端✓ 多端✓ 边界✓ 兼容✓

## 隐含需求覆盖

### 数据维度：覆盖
- Share URL assembly from frontend (implicit need #1) — resolved with explicit frontend-assembly approach
- No data migration (§2.1) — covered
- Default values for create (§2.4) — covered by BDD-10a
- Concurrent operations (§2.4) — covered as boundary condition

### 前端维度：覆盖
- Badge reactivity (#2) — BDD-05, BDD-22
- Popover positioning (#3) — BDD-13
- Loading state (#4) — BDD-06
- Error feedback (#5) — BDD-10c
- Empty state (#11) — BDD-21
- Scrollable content (§2.2) — BDD-13
- Danger hover token (#9) — BDD-03
- Keyboard navigation in Popover (#12) — BDD-23

### 多端维度：覆盖
- No backend change (§2.3) — confirmed
- No MCP/CLI change (§2.3) — confirmed
- Mobile share button with badge (#8) — BDD-22
- Tablet viewport (#13) — BDD-24
- Desktop Popover vs mobile Sheet — BDD-12/14

### 边界维度：覆盖
- All shares expired/revoked (§2.4) — BDD-09, BDD-21
- Single active share (§2.4) — BDD-07
- Many shares scroll (§2.4) — BDD-13
- Default values (§2.4) — BDD-10a
- Revoke without confirmation (§2.4) — BDD-11
- Popover close on outside click (§2.4) — BDD-12
- Concurrent operations (§2.4) — noted as eventual consistency

### 兼容维度：覆盖
- ShareManagementPanel deletion (§2.5) — covered
- OverflowMenu interface preservation (§2.5) — covered
- CSS variable migration (§2.5) — covered
- Test file adaptation (#10) — §2.5 + implicit need #10

## 裁剪评审

| Phase | Status | Rationale |
|-------|--------|-----------|
| P1 | Included | Requirements baseline |
| P2 | Included | Design required |
| P3 | Included | TDD test-first required — sub-component contracts, view-switching logic, badge reactivity, keyboard navigation have testable behavior contracts. Visual-only aspects excluded (P5/P6). **R1 W9 resolved.** |
| P4 | Included | Implementation |
| P5 | Included | Visual regression across themes/viewports |
| P6 | Included | Playwright real-run + screenshot verification mandatory |
| P7 | Skipped | Pure frontend, single package. P2 design-review covers component interface consistency as compensation. |
| P8 | Included | Build verification + version bump |

P3 inclusion is appropriate. The rationale correctly identifies testable behavior contracts (props/emits, view switching, badge reactivity, keyboard navigation) while excluding visual-only aspects. This aligns with agate WORKFLOW.md's default- default-retain principle.

## P1 纯净性

- §2.2 Badge reactivity: Implementation detail removed (R1 W6 resolved). Now states behavior only.
- §2.4 Concurrent operations: Still describes current behavior context. Acceptable as boundary condition background.
- BDD-16/BDD-17: Pixel values (18px icons, 36px/48px min height) come from P0-brief and DESIGN.md §9. Acceptable as requirements constraints, not design inventions.

## 结论

**status: approved**

All 12 R1 issues (1 BLOCKER, 9 WARNING, 2 INFO) are resolved. BDD count increased from 20 to 24 (BDD-10 split into 10a/10b/10c, new BDD-21/22/23/24). All 24 BDDs are binary-judgable. Implicit needs table expanded from 7 to 13 entries. P3 restored with appropriate rationale. No new issues identified in this review round.

### BDD Coverage Summary

BDD-01, BDD-02, BDD-03, BDD-04, BDD-05, BDD-06, BDD-07, BDD-08, BDD-09, BDD-10a, BDD-10b, BDD-10c, BDD-11, BDD-12, BDD-13, BDD-14, BDD-15, BDD-16, BDD-17, BDD-18, BDD-19, BDD-20, BDD-21, BDD-22, BDD-23, BDD-24 — all PASS (binary-judgable).

### Dimension Coverage

| Dimension | Status |
|-----------|--------|
| Data | Covered (URL assembly, no migration, defaults, concurrent) |
| Frontend | Covered (badge, positioning, loading, error, empty, scroll, danger hover, keyboard) |
| Multi-platform | Covered (no backend/MCP change, mobile button, tablet viewport, desktop/mobile split) |
| Boundary | Covered (empty/single/many/concurrent/defaults/instant-revoke/outside-click) |
| Compatibility | Covered (panel deletion, interface preservation, CSS migration, test adaptation) |
