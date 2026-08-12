---
phase: P4
task_id: T065
type: review
parent: P4-implementation.md
trace_id: T065-P4-review-20260722
status: approved
created: 2026-07-22
agent: design-review
---

# T065 P4 Design Review

## Summary

P4 implementation faithfully delivers P2's fix for both root causes (redirect timing + Sign in conditional rendering), with one documented deviation from P2's chosen approach (方案 A → 方案 C hybrid). The deviation is justified by testability concerns and is functionally equivalent.

## Deviation Analysis

### P2 chose 方案 A: `watch(authState, ..., { immediate: true })`
### P4 implemented 方案 C hybrid: `onMounted + nextTick` + `watch(authState)` (no immediate)

| Aspect | P2 方案 A | P4 实际 | Verdict |
|--------|----------|---------|---------|
| Full-page-load redirect | `watch immediate` fires during `setup()` | `onMounted` + `nextTick` checks `authState.value` | Functionally equivalent; deferred to microtask instead of synchronous |
| SPA login redirect | `watch` (immediate covers this too) | `watch(authState)` without `immediate` | Identical — no immediate needed for state *changes* |
| Single vs dual path | Single path (watch immediate covers both) | Dual path (onMounted + watch) | P2 noted this as 方案 C's "语义略冗余" but acceptable |
| Testability | P4 doc explains: `immediate` fires synchronously in `setup()`, before test spy installation | `nextTick` defers to microtask, spy can be installed after `mount()` | Justified — a real constraint, not preference |

**Verdict: APPROVED deviation.** The implementer documented the reason clearly in P4-implementation.md:39-41. The functional outcome is identical (redirect happens), the timing difference is imperceptible in production (single microtask), and the testability gain is real. P2 itself listed 方案 C as a viable alternative with "低" risk.

## Sign-in Conditional Rendering — Consistency Check

Compared LandingView.vue implementation against EntryListView.vue reference pattern:

| Element | EntryListView | LandingView | Match |
|---------|--------------|-------------|-------|
| `v-if="authState === 'anonymous'"` | Line 9 | Line 19 | ✅ |
| `v-else-if="authState === 'authenticated'"` | Line 12 | Line 22 | ✅ |
| `.user-menu-wrapper` | Yes | Yes | ✅ |
| `.user-menu-trigger` with avatar+name | Yes | Yes | ✅ |
| `Transition name="dropdown"` | Yes | Yes | ✅ |
| `showUserMenu` ref | Yes | Yes | ✅ |
| `toggleUserMenu` / `closeUserMenu` | Yes | Yes | ✅ |
| `handleLogout` | Yes (with toast) | Yes (no toast) | ✅ Acceptable — LandingView has no toast import |
| `userInitial` / `userName` computed | Lines 367-374 | Lines 207-214 | ✅ Identical logic |
| `storeToRefs(authStore)` for `user` | Yes | Yes | ✅ |
| Click listener in `onMounted` / cleanup in `onUnmounted` | Lines 386-387 | Lines 248-256 | ✅ |
| `admin-badge` in menu | EntryListView has it | LandingView omits it | ✅ Correct — admin badge is only meaningful on explore page |

## Style Consistency

LandingView uses hardcoded pixel values (e.g., `gap:8px`, `padding:4px 12px`) while EntryListView uses design system variables (e.g., `var(--space-2)`, `var(--space-3)`). This is **consistent with LandingView's existing style convention** — the entire LandingView component uses hardcoded values, not design tokens. The new user-menu styles follow the same convention. No inconsistency introduced.

## Visual/Interaction Issues

```
[INTERACTION] Dropdown close-on-outside-click shares same closeUserMenu
  文件：LandingView.vue:220-224  问题：与 EntryListView 实现一致，无问题  Fix：N/A

[VISUAL] No admin-badge on LandingView user menu
  文件：LandingView.vue:23-33  问题：LandingView 不显示 admin badge — 符合预期，landing page 不需要 admin 标识  Fix：N/A
```

No BLOCKER or CRITICAL issues found.

## Scope Check

- `router.ts`: No changes ✅ (matches P2 and P4-implementation.md declaration)
- No files modified outside declared `implementation_dir` ✅
- No scope creep detected ✅

## BDD Coverage Verification

| BDD | P2 Mapping | P4 Implementation | Covered |
|-----|-----------|------------------|---------|
| BDD-1 | watch immediate → redirect | onMounted + nextTick → redirect | ✅ |
| BDD-2 | v-if anonymous → Sign in | Line 19-21 | ✅ |
| BDD-3 | v-else-if authenticated → user menu | Line 22-34 | ✅ |
| BDD-4 | userName in menu | Line 26 | ✅ |
| BDD-5 | watch covers SPA login | Line 247 | ✅ |
| BDD-6 | loading → neither rendered | v-if/v-else-if skip loading | ✅ |

## Conclusion

**Status: APPROVED**

The implementation correctly addresses both root causes. The deviation from P2's 方案 A (watch immediate) to 方案 C hybrid (onMounted + nextTick) is documented, justified by testability, and functionally equivalent. The Sign-in conditional rendering matches the EntryListView pattern faithfully, adapted appropriately for LandingView's context (no admin badge, no toast, hardcoded style values consistent with existing convention). No out-of-scope changes, no visual/interaction blockers.
