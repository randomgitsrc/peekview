# Verify: ThemeToggle.vue unit tests

## Goal
Create `frontend-v3/src/components/__tests__/ThemeToggle.spec.ts` with 5 cases:
light→🌙, dark→☀️, click→toggle, light title, dark title.

## Steps
- [x] Read ThemeToggle.vue, stores/theme.ts, FileTree.spec.ts (style ref)
- [x] Inspect pinia storeToRefs (confirmed works on plain store obj, no active pinia needed)
- [x] Create ThemeToggle.spec.ts (vi.hoisted for per-test theme control)
- [x] Run targeted: `vitest run src/components/__tests__/ThemeToggle.spec.ts` → 5 passed
- [x] Run full suite: `vitest run` → 18 files / 204 tests passed (no regression)
- [x] vue-tsc --noEmit → ThemeToggle.spec.ts clean (Toast.spec.ts error pre-existing, untouched)
- [x] git add + commit `test: add ThemeToggle.vue unit tests`
- [x] Return commit hash

## Notes
- Component imports storeToRefs from `pinia` (not @/stores/theme), so the
  storeToRefs field in the task's theme mock is dead code; real pinia
  storeToRefs handles the fake store fine.
- Using vi.hoisted + mutable currentTheme to switch light/dark per test
  (satisfies req #5: dark mock returns ref('dark')).
