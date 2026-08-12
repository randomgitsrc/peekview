---
phase: P2
task_id: T058
type: review
parent: P2-design.md
trace_id: T058-P2R2-20260717
status: approved
created: 2026-07-17
agent: plan-design-review
---

# T058 P2 — Design Review (Revision 2)

## Scoring (0-10)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Interaction state coverage | 9 | Loading/error/empty states covered; swipe-to-close now designed; scroll behavior specified |
| AI Slop risk | 8 | Token mapping precise; component interfaces well-defined; one internal contradiction on badge tokens |
| Mobile consideration | 9 | Swipe gesture designed; three-breakpoint model added; mobile share button specified |
| Accessibility | 8 | Focus trap specified for Popover; aria-expanded mentioned; focus return on Escape specified |

## 1. Revision Verification (R1-R11)

| # | Severity | Issue | Resolution in Revision | Verdict |
|---|----------|-------|----------------------|---------|
| R1 | CRITICAL | BDD-15 swipe-to-close not designed | Section 7 (lines 533-589): full swipe spec with touch handlers, 50px threshold, animation (transition:none during drag, 200ms ease-out on release), overscroll guard (scrollTop===0). Addendum R1 (lines 743-750) restates. | RESOLVED |
| R2 | CRITICAL | BDD-24 tablet viewport not addressed | Section 7 (lines 434-480): three-breakpoint model (isMobile<=640, isTablet 641-1024, isDesktop>1024). Tablet uses Popover/Dropdown (same as desktop). Addendum R2 (lines 752-760) restates. | RESOLVED |
| R3 | HIGH | test_t057_ui_polish.spec.ts omitted | Added to gate_commands (lines 30-31) and files_to_read (lines 52-53). | RESOLVED |
| R4 | HIGH | No T058-specific E2E test | e2e/t058-share-redesign.e2e.spec.ts added to P5_e2e and P6 gate_commands (lines 30-31). | RESOLVED |
| R5 | MEDIUM | Badge deviates from DESIGN.md without override declaration | Addendum R5 (lines 762-764): explicit override declaration with rationale (count indicator on icon button, not status badge). | RESOLVED |
| R6 | MEDIUM | BDD-23 focus management not specified | Addendum R6 (lines 766-775): focus moves to Popover on open, Tab cycles within (focus trap), Shift+Tab reverse, Escape closes and returns focus to trigger. | RESOLVED |
| R7 | MEDIUM | Popover scroll behavior not specified | Addendum R7 (lines 777-779): close Popover on parent page scroll; scrolling within Sheet body does NOT close it. | RESOLVED |
| R8 | MEDIUM | Badge CSS positioning not specified | Addendum R8 (lines 781-790): position:absolute, top:-4px, right:-4px, z-index:1, min-width:18px, height:18px. | RESOLVED (with new issue -- see Section 2) |
| R9 | LOW | IconRenderer ownership unspecified | Addendum R9 (lines 792-794): iconMap/IconRenderer stays in OverflowMenu.vue (parent), sub-components receive resolved icons via slot. | RESOLVED |
| R10 | LOW | View switching animation unspecified | Addendum R10 (lines 796-798): instant switch (no animation), with rationale. | RESOLVED |
| R11 | LOW | share.ts in both tables | Addendum R11 (lines 800-802): clarifies "public API surface unchanged, internal state added". | RESOLVED |

## 2. New Issue Introduced by Revision

### N1 [HIGH]: Badge Token Contradiction Between Section 3 and Addendum R8

Section 3 "Share Badge" (lines 210-216) specifies:

| Property | Token |
|----------|-------|
| Background | `--c-tag-bg` |
| Text | `--c-accent-secondary` |

Addendum R8 (lines 789) specifies:

| Property | Token |
|----------|-------|
| Background | `var(--c-accent)` |
| Color | `var(--c-text-on-accent)` (or white) |

These are fundamentally different visual treatments:
- Section 3: **soft/muted badge** (translucent accent background, accent-colored text) -- matches DESIGN.md Tag/Badge spec
- R8: **solid/pill badge** (opaque accent background, white text) -- matches a notification count badge pattern

Both are valid design choices for a count indicator, but they produce different visuals. The implementer cannot follow both. One must be chosen and the other removed.

**Recommendation**: The solid pill (`--c-accent` bg + `--c-text-on-accent` text) is the standard pattern for count badges on icon buttons (e.g., notification dots, unread counts). The soft tag style is for inline labels. R8's choice is more appropriate for a count badge on a share icon button. Section 3's token mapping should be updated to match R8, or R8 should be updated to match Section 3 -- but they must agree.

## 3. Residual Observations (non-blocking)

### 3.1 Badge Border in R8 vs R5

R8 specifies `border: 2px solid var(--c-surface)` for the badge. R5 does not mention a border. The border creates visual separation from the button edge, which is good. No conflict -- just noting R5's override declaration should ideally include the border specification for completeness.

### 3.2 Section Numbering

The document has two sections numbered "10": "P3 Testable Behavior Contracts" (line 632) and "[SCOPE+] Findings" (line 711). Minor formatting issue, not a design concern.

## 4. Verdict

**Status: needs-revision**

All 11 original review items (R1-R11) are resolved. However, the revision introduced a new HIGH-severity contradiction: Section 3 and Addendum R8 specify incompatible badge token sets (soft tag vs solid pill). This must be reconciled before the design proceeds to P3, as the implementer would otherwise have to guess which specification to follow.
