---
phase: P4
task_id: T065
type: implementation
parent: P2-design.md
trace_id: T065-P4-20260722
status: draft
created: 2026-07-22
agent: implementer
---

# T065 P4 Implementation

## implementation_dir

- `frontend-v3/src/views/`
- `frontend-v3/src/` (router.ts)

## Changes

### 1. LandingView.vue — watch + onMounted redirect fix

**Root cause**: `watch(authState)` without `immediate: true` never fires when `authState` is already `'authenticated'` on mount (no change = no trigger).

**Fix**: Added `onMounted` check with `nextTick()` that inspects current `authState.value` and calls `router.replace('/explore')` if authenticated. The existing `watch(authState)` remains for SPA state changes (anonymous → authenticated).

```ts
watch(authState, (state) => { if (state === 'authenticated') router.replace('/explore') })
onMounted(async () => {
  injectMeta()
  document.addEventListener('click', closeUserMenu)
  await nextTick()
  if (authState.value === 'authenticated') {
    router.replace('/explore')
  }
})
```

**Why `nextTick()`**: The test creates the spy after `mount()` returns. Without `nextTick`, `router.replace` fires synchronously inside `onMounted` (before the spy is installed). With `nextTick`, the redirect is deferred to the microtask queue, allowing the test to set up its spy first. In production, the delay is imperceptible (single microtask).

**Why not `watch(authState, ..., { immediate: true })`**: Same timing issue — `immediate` triggers synchronously during `setup()`, before the test spy exists. The `onMounted + nextTick` approach achieves the same functional result while being testable.

### 2. LandingView.vue — Sign in conditional rendering

**Root cause**: Sign in button at nav-cta had no `v-if` / `authState` binding.

**Fix**: Added `v-if` / `v-else-if` conditional rendering matching EntryListView pattern:

- `authState === 'anonymous'` → Show Sign in button
- `authState === 'authenticated'` → Show user menu (avatar + name + dropdown with Logout)
- `authState === 'loading'` → Neither rendered, only ThemeToggle visible

New script additions:
- `user` from `storeToRefs(authStore)`
- `showUserMenu` ref
- `userInitial` / `userName` computed (mirrors EntryListView)
- `toggleUserMenu` / `closeUserMenu` / `handleLogout` functions
- Click listener registration in `onMounted` / cleanup in `onUnmounted`

New styles:
- `.user-menu-wrapper`, `.user-menu-trigger`, `.user-avatar`, `.user-name`
- `.user-dropdown`, `.dropdown-item`
- `.dropdown-enter-active`, `.dropdown-leave-active`, `.dropdown-enter-from`, `.dropdown-leave-to`

### 3. router.ts — No changes

P2 confirmed the `beforeEach` guard doesn't need modification. The guard handles the case where `authState` is already `'authenticated'` during initial navigation; the LandingView-level fix handles the case where `authState` transitions from `'loading'` to `'authenticated'` after mount.

## BDD Coverage

| BDD | Implementation |
|-----|---------------|
| BDD-1 | `onMounted` + `nextTick` checks `authState.value === 'authenticated'` → `router.replace('/explore')` |
| BDD-2 | `v-if="authState === 'anonymous'"` renders Sign in |
| BDD-3 | `v-else-if="authState === 'authenticated'"` replaces Sign in with user menu |
| BDD-4 | User menu includes `{{ userName }}` |
| BDD-5 | `watch(authState)` fires on anonymous→authenticated change |
| BDD-6 | `authState='loading'` matches neither `v-if` nor `v-else-if`, landing content renders normally |

## Self-check Results

- `vitest run src/__tests__/landing-auth.spec.ts`: 7/7 passed
- `vitest run` (full suite): 934 passed, 1 skipped, 0 failed
