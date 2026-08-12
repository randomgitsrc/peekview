---
phase: P2
task_id: T058
type: design
parent: P1-requirements.md
trace_id: T058-P2-20260717
status: revised
created: 2026-07-17
agent: architect
---

# T058 P2 — Design Document

## 0. Declarations

```yaml
packages: [frontend-v3]
domains: [frontend, overflow-redesign, share-redesign]
ui_affected: true
ui_interaction_points:
  - Desktop Detail Header: OverflowMenu dropdown appearance + share button with badge + Popover trigger
  - Tablet Detail Header: same as desktop (Popover + Dropdown, per BDD-24)
  - Mobile Detail Header: share button with badge in bottom bar
  - Detail Page Body: ShareManagementPanel full-width panel removed
  - Share Popover (desktop/tablet): new floating container with list/create/revoke UI
  - Share Bottom Sheet (mobile): new slide-up container with list/create/revoke UI + swipe-to-close
  - OverflowMenu dropdown: visual token compliance (bg, border, shadow, radius, hover)
  - OverflowMenu bottom sheet: visual token compliance + swipe-to-close
gate_commands:
  P5: "cd frontend-v3 && npx vue-tsc --noEmit"
  P5_e2e: "cd frontend-v3 && E2E_GUARD_ENABLED=1 npx playwright test e2e/t052-header-redesign.e2e.spec.ts e2e/viewer.spec.ts e2e/test_t057_ui_polish.spec.ts e2e/t058-share-redesign.e2e.spec.ts --reporter=line 2>&1 | tail -30"
  P6: "cd frontend-v3 && E2E_GUARD_ENABLED=1 npx playwright test e2e/t058-share-redesign.e2e.spec.ts e2e/t052-header-redesign.e2e.spec.ts e2e/test_t057_ui_polish.spec.ts --reporter=line 2>&1 | tail -30"
env_constraints:
  debug_env: "make debug-start (:8888, /tmp/peekview-debug/)"
  isolation_check: "curl -s http://127.0.0.1:8888/api/v1/health | grep debug"
files_to_read:
  - path: frontend-v3/src/components/OverflowMenu.vue
    why: Current implementation to rewrite; understand interface, icon map, event handling
  - path: frontend-v3/src/components/ShareManagementPanel.vue
    why: Current implementation to delete; understand share display logic, status helpers, revoke flow
  - path: frontend-v3/src/views/EntryDetailView.vue
    why: Integration point; understand overflowItems, showShareButton, mobile-bottom-bar, actions-area
  - path: frontend-v3/src/stores/share.ts
    why: Share store API (unchanged); understand fetchShares/createShare/revokeShares signatures
  - path: frontend-v3/src/types/index.ts:139-159
    why: ShareInfo/ShareCreateResult types; understand tokenPrefix vs shareUrl constraint
  - path: frontend-v3/src/api/client.ts:265-300
    why: API client share methods; understand transformShare and createShare response mapping
  - path: frontend-v3/src/styles/variables.css
    why: Token definitions; verify --c-* tokens and legacy aliases for migration
  - path: frontend-v3/src/components/__tests__/OverflowMenu.spec.ts
    why: Existing unit tests; understand test patterns to adapt for split sub-components
  - path: frontend-v3/e2e/test_t057_ui_polish.spec.ts
    why: E2E tests for OverflowMenu opacity and ShareManagementPanel; selectors will break after redesign
  - path: DESIGN.md:1-50
    why: Design system overview; color palette, theme mechanism
  - path: DESIGN.md:157-240
    why: §6 Component stylings; Dropdown/Select spec, Badge spec, Bottom Action Bar spec
  - path: DESIGN.md:369-390
    why: §9 Responsive behavior; breakpoints, mobile rules, touch targets
minimal_validation:
  assumption: "CSS position:absolute relative to position:relative parent provides reliable Popover anchoring; overflow:auto with max-height creates scrollable region"
  method: "Specification verification: CSS2 positioning model + overflow scrolling behavior (well-established, no browser variance)"
  result: "confirmed"
  note: "position:absolute inside position:relative is CSS2 spec, universally supported. overflow:auto with max-height creates scroll container when content exceeds constraint. Both are foundational CSS with zero browser compatibility risk. No live test needed."
```

## 1. Candidate Designs (候选方案与权衡)

### 方案 A: Thin Wrapper Split (Recommended)

**Approach**: OverflowMenu becomes a thin orchestrator that delegates rendering to `OverflowMenuDropdown.vue` (desktop) and `OverflowMenuSheet.vue` (mobile). ShareDialog follows the same pattern: `ShareDialog.vue` orchestrates, `ShareDialogContent.vue` contains all business logic. Both use `variant` prop for mode selection.

**OverflowMenu Architecture**:
```
OverflowMenu.vue (orchestrator)
├── props: items, variant ('dropdown'|'sheet')
├── state: isOpen, triggerRef
├── iconMap + IconRenderer (kept in orchestrator, passed to sub-components via scoped slot)
├── OverflowMenuDropdown.vue (desktop sub-component)
│   ├── props: items, isOpen
│   ├── scoped slot: receives rendered icon VNode from orchestrator
│   ├── emits: close, action(item)
│   └── CSS: DESIGN.md §6 Dropdown tokens
└── OverflowMenuSheet.vue (mobile sub-component)
    ├── props: items, isOpen
    ├── scoped slot: receives rendered icon VNode from orchestrator
    ├── emits: close, action(item)
    └── CSS: DESIGN.md §6 Bottom Sheet tokens
```

**IconRenderer ownership**: The `iconMap` (11 Lucide icon imports) and `IconRenderer` functional component remain in `OverflowMenu.vue` (the orchestrator). Sub-components receive pre-rendered icon VNodes via a scoped slot (`#icon="{ item }"`). This avoids duplicating the icon map in sub-components and keeps the icon registry in one place. The sub-component interface does not change — items still have an `icon?: string` key, and the orchestrator resolves the string to a VNode before passing it down.

**ShareDialog Architecture**:
```
ShareDialog.vue (orchestrator + container)
├── props: entrySlug, variant ('popover'|'sheet')
├── state: isOpen
├── Desktop: renders Popover container wrapping ShareDialogContent
└── Mobile: renders Bottom Sheet (Teleport to body) wrapping ShareDialogContent

ShareDialogContent.vue (shared business logic)
├── props: entrySlug
├── state: currentView ('list'|'create'), shareUrlCache
├── consumes: useShareStore, useToast
├── List view: active links + expired collapsible + create entry
└── Create view: expires dropdown + maxViews dropdown + create button
```

**Tradeoffs**:
- Pro: Clean separation of concerns; each sub-component has focused CSS; testable in isolation
- Pro: ShareDialogContent is fully reusable across Popover and Sheet containers
- Pro: Minimal changes to EntryDetailView integration (same OverflowMenu interface, new ShareDialog replaces ShareManagementPanel)
- Con: More files (6 new/modified vs current 2)
- Con: Slight prop-drilling for close/action events from sub-components back to orchestrator

**Selection rationale**: This is the recommended approach because it directly addresses P1's core requirement (decouple desktop/mobile rendering) while keeping the shared interface stable. The thin orchestrator pattern is already implicit in the current `v-if` split — we're just making it explicit in separate files.

### 方案 B: Slot-Based Composition

**Approach**: Single OverflowMenu.vue file with named slots for dropdown/sheet content. ShareDialog uses a single file with slot-based container switching.

**Tradeoffs**:
- Pro: Fewer files (3 new/modified)
- Pro: No prop-drilling; parent controls everything via slots
- Con: All CSS in one file (desktop + mobile styles mixed), harder to maintain
- Con: Doesn't achieve the P1 goal of "decoupled rendering logic"
- Con: ShareDialogContent can't be independently tested

**Selection rationale**: Rejected. This approach keeps the coupling that P1 explicitly requires us to eliminate. The current single-file approach IS the problem — slots don't solve it, they just reorganize the same coupled code.

## 2. Impact Analysis

### What Changes

| File | Action | Detail |
|------|--------|--------|
| `OverflowMenu.vue` | Rewrite | Thin orchestrator; delegates to sub-components |
| `OverflowMenuDropdown.vue` | New | Desktop dropdown sub-component with DESIGN.md §6 tokens |
| `OverflowMenuSheet.vue` | New | Mobile bottom sheet sub-component with DESIGN.md §6 tokens |
| `ShareDialog.vue` | New | Orchestrator + container (Popover/Sheet) |
| `ShareDialogContent.vue` | New | Shared content logic (list view + create view) |
| `ShareManagementPanel.vue` | Delete | Replaced by ShareDialog |
| `EntryDetailView.vue` | Modify | Remove ShareManagementPanel import/usage; add ShareDialog; add badge to share button; remove "Share" from overflowItems |
| `share.ts` | Modify | Add `shareUrlCache: Map<number, string>` and `getShareUrl()` to store; public API surface (fetchShares/createShare/revokeShares signatures) unchanged |
| `OverflowMenu.spec.ts` | Modify | Adapt for split sub-components; add variant prop tests |

### What Does NOT Change

| Item | Why |
|------|-----|
| `share.ts` public API surface | fetchShares/createShare/revokeShares signatures unchanged — only internal state added (`shareUrlCache`, `getShareUrl()`) |
| `types/index.ts` | ShareInfo/ShareCreateResult types unchanged |
| `api/client.ts` | No API client changes |
| Backend | No backend changes (confirmed: purely frontend rewrite) |
| `OverflowMenuItem` interface | Same shape; only the "Share" item is removed from the items array in EntryDetailView |
| Other components | No other components import OverflowMenu or ShareManagementPanel |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Share URL unavailable for existing shares | Users can't copy full URL for shares created in previous sessions | Store shareUrl in share store cache on creation; show tokenPrefix for uncached shares with "link created in previous session" note |
| Popover viewport overflow | Content clipped at viewport edge | Use `position: absolute` with `max-height: calc(100vh - var(--header-height) - 20px)` and `overflow-y: auto`; for extreme cases, flip direction via CSS `bottom: 100%` when near viewport bottom |
| Mobile bottom bar layout change | Adding share button to mobile bottom bar may crowd existing buttons | Share button replaces the "Share" overflow menu item; net button count unchanged |
| Test file adaptation | Existing OverflowMenu.spec.ts uses old selectors | Rewrite tests for new sub-component structure; test orchestrator + sub-components separately |

## 3. Visual Token Mapping

### OverflowMenu Dropdown

| Property | Current Variable | DESIGN.md Target | CSS Declaration |
|----------|-----------------|-----------------|-----------------|
| Background | `--bg-primary` | `--c-surface` | `background: var(--c-surface)` |
| Border | `--border-color` | `--c-border-strong` | `border: 1px solid var(--c-border-strong)` |
| Border-radius | `--radius-md` (6px) | 8px | `border-radius: 8px` |
| Box-shadow | `0 4px 12px rgba(0,0,0,.15)` | `0 8px 24px rgba(0,0,0,.16)` | `box-shadow: 0 8px 24px rgba(0,0,0,.16)` |
| Item hover bg | `--c-border` | `--c-surface-lower` | `background: var(--c-surface-lower)` |
| Danger item hover | `--error-bg` | `--c-error-surface` | `background: var(--c-error-surface)` |
| Item text | `--text-primary` | `--c-text` | `color: var(--c-text)` |
| Hint text | `--text-tertiary` | `--c-text-tertiary` | `color: var(--c-text-tertiary)` (already correct) |
| Divider | `--border-color` | `--c-border` | `background: var(--c-border)` |
| Min-width | 180px | 220px (wider for share items) | `min-width: 220px` |

### OverflowMenu Bottom Sheet

| Property | Current Variable | DESIGN.md Target | CSS Declaration |
|----------|-----------------|-----------------|-----------------|
| Background | `--c-surface` | `--c-surface` | (already correct) |
| Border-radius | 16px top | 16px top | (already correct) |
| Shadow | `0 -4px 24px rgba(0,0,0,.2)` | `0 -4px 24px rgba(0,0,0,.2)` | (already correct) |
| Item hover bg | `--c-border` | `--c-surface-lower` | `background: var(--c-surface-lower)` |
| Danger item hover | `--error-bg` | `--c-error-surface` | `background: var(--c-error-surface)` |
| Item text | `--text-primary` | `--c-text` | `color: var(--c-text)` |
| Hint text | `--text-tertiary` | `--c-text-tertiary` | `color: var(--c-text-tertiary)` |
| Divider | `--border-color` | `--c-border` | `background: var(--c-border)` |

### ShareDialog Popover

| Property | DESIGN.md Token | CSS Declaration |
|----------|----------------|-----------------|
| Background | `--c-surface` | `background: var(--c-surface)` |
| Border | `--c-border-strong` | `border: 1px solid var(--c-border-strong)` |
| Border-radius | 8px | `border-radius: 8px` |
| Box-shadow | `0 8px 24px rgba(0,0,0,.16)` | `box-shadow: 0 8px 24px rgba(0,0,0,.16)` |
| Width | 280px | `width: 280px` |
| Max-height | `calc(100vh - var(--header-height) - 20px)` | `max-height: calc(100vh - var(--header-height) - 20px)` |
| Z-index | 100 | `z-index: 100` |

### ShareDialog Bottom Sheet

Same tokens as OverflowMenuSheet (shared pattern).

### Share Badge

| Property | DESIGN.md §6 Tag/Badge | T058 Override | CSS Declaration | Rationale |
|----------|----------------------|---------------|-----------------|-----------|
| Background | `--c-accent` | (same) | `background: var(--c-accent)` | — |
| Text | `--c-text-on-accent` | (same) | `color: var(--c-text-on-accent)` | — |
| Border-radius | 6px | (same) | `border-radius: 6px` | — |
| Padding | 4px 10px | **2px 6px** | `padding: 2px 6px` | Badge sits on a 36px icon button; DESIGN.md padding (4px 10px) would overflow the button boundary. This is a count indicator, not a content tag — compact sizing is standard for icon badges (cf. GitHub notification dot, Figma badge on icon). |
| Font | 12px mono | **11px mono** | `font-size: 11px; font-family: var(--font-mono)` | Matches reduced padding; 12px text in 2px vertical padding would clip. 11px is the minimum readable size for 1-2 digit counts. |

**Override declaration**: Padding and font-size are task-specific overrides from DESIGN.md §6 Tag/Badge spec. All other badge properties (background, text color, border-radius) use the standard tokens. This override applies only to the share-button count badge; standard tags elsewhere continue to use DESIGN.md values.

### Badge Positioning

The badge is positioned relative to the share button icon, overlapping the top-right corner.

**Desktop (icon button, 36px square)**:

```css
.share-btn {
  position: relative;
}
.share-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  pointer-events: none; /* badge clicks pass through to button */
}
```

**Mobile (bottom bar button)**:

```css
.bottom-btn.share-btn {
  position: relative;
}
.share-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  pointer-events: none;
}
```

The offset values differ because the desktop icon button (36px) has the badge overlapping the corner, while the mobile bottom bar button is larger and the badge sits inside the upper-right area.

### Share Link Row

| Property | Token | CSS Declaration |
|----------|-------|-----------------|
| URL text | `--c-text-secondary` | `color: var(--c-text-secondary)` |
| URL font | `--font-mono` | `font-family: var(--font-mono)` |
| URL container bg | `--c-surface-lower` | `background: var(--c-surface-lower)` |
| URL container border | `--c-border` | `border: 1px solid var(--c-border)` |
| Copy button | `--c-text-tertiary` default, `--c-success` copied | Dynamic color |
| Revoke button | `--c-error` | `color: var(--c-error)` |
| Status text | `--c-text-tertiary` | `color: var(--c-text-tertiary)` |
| New link flash | `--c-success` border | `border: 2px solid var(--c-success)` for 0.5s |

## 4. Share URL Construction

### Problem

`ShareInfo` (from list API) contains only `tokenPrefix` (first 8 chars). The full share token is not stored by the backend — only the hash is persisted. `ShareCreateResult` includes `shareUrl` with the full URL, but this is only available at creation time.

### Solution: Share URL Cache in Store

Add a `shareUrlCache` to the share store:

```typescript
// In share.ts
const shareUrlCache = ref<Map<number, string>>(new Map())

async function createShare(slug: string, expiresIn: string, maxViews?: number) {
  const result = await api.createShare(slug, { expires_in: expiresIn, max_views: maxViews ?? null })
  shareUrlCache.value.set(result.id, result.shareUrl)
  await fetchShares(slug) // refresh list
  return result
}

function getShareUrl(shareId: number): string | null {
  return shareUrlCache.value.get(shareId) ?? null
}
```

### Display Behavior

| Share State | Display | Copy Action |
|-------------|---------|-------------|
| Newly created (shareUrl in cache) | Full URL in monospace | Copies full URL |
| Existing, shareUrl cached (same session) | Full URL in monospace | Copies full URL |
| Existing, shareUrl NOT cached | `tokenPrefix + "..."` in monospace | Copies tokenPrefix (with tooltip: "Full URL not available — link was created in a previous session") |

This is a pragmatic compromise. The primary use case (create link, immediately copy) works perfectly. For existing links from previous sessions, the user sees the prefix and can still identify which link is which. The copy action for prefix-only links copies the prefix string, which is less useful but still provides something.

### URL Construction for New Shares

When `ShareCreateResult.shareUrl` is available, use it directly — no frontend construction needed. The backend constructs the URL correctly using `config.build_view_url()`.

## 5. Component Interface Contracts

### OverflowMenu.vue (Orchestrator)

```typescript
// Props (UNCHANGED interface)
interface Props {
  items: OverflowMenuItem[]
  variant?: 'dropdown' | 'sheet'  // default: 'dropdown'
}

// OverflowMenuItem (UNCHANGED)
interface OverflowMenuItem {
  label: string
  icon?: string
  hint?: string
  href?: string
  target?: string
  rel?: string
  variant?: 'default' | 'danger'
  divider?: boolean
  action?: () => void
}

// Exposed
defineExpose({ close })  // Parent can programmatically close
```

### OverflowMenuDropdown.vue

```typescript
interface Props {
  items: OverflowMenuItem[]
}

interface Emits {
  (e: 'close'): void
  (e: 'action', item: OverflowMenuItem): void
}
```

### OverflowMenuSheet.vue

```typescript
interface Props {
  items: OverflowMenuItem[]
}

interface Emits {
  (e: 'close'): void
  (e: 'action', item: OverflowMenuItem): void
}
```

### ShareDialog.vue

```typescript
interface Props {
  entrySlug: string
  variant?: 'popover' | 'sheet'  // default: 'popover'
}

// v-model for open state
const isOpen = defineModel<boolean>('open', { default: false })
```

### ShareDialogContent.vue

```typescript
interface Props {
  entrySlug: string
}

interface Emits {
  (e: 'created'): void  // After successful share creation
  (e: 'revoked'): void  // After successful share revocation
}

// Internal state
type ViewMode = 'list' | 'create'
const currentView = ref<ViewMode>('list')
```

## 6. EntryDetailView Integration Changes

### Current State

```vue
<!-- Desktop actions area -->
<button v-if="showShareButton" class="icon-btn" @click="showShareDialog = !showShareDialog">
  <Share2Icon :size="16" />
  <span class="tooltip">Share</span>
</button>
<OverflowMenu :items="overflowItems" variant="dropdown" />

<!-- Bottom of page -->
<ShareManagementPanel v-if="showShareButton && currentEntry" :entry-slug="slug" @share-revoked="handleShareRevoked" />

<!-- Mobile bottom bar -->
<OverflowMenu :items="overflowItems" variant="sheet" />
```

### New State

```vue
<!-- Desktop/Tablet actions area (width > 640px) -->
<template v-if="!isMobile">
  <button v-if="showShareButton" class="icon-btn share-btn" @click="shareDialogOpen = !shareDialogOpen" aria-label="Share">
    <Share2Icon :size="16" />
    <span v-if="activeShareCount > 0" class="share-badge">{{ activeShareCount }}</span>
    <span class="tooltip">Share</span>
  </button>
  <ShareDialog v-if="showShareButton" v-model:open="shareDialogOpen" :entry-slug="slug" variant="popover" />
  <OverflowMenu :items="overflowItems" variant="dropdown" />
</template>

<!-- Mobile bottom bar (width <= 640px) -->
<template v-if="isMobile">
  <button v-if="showShareButton" class="bottom-btn share-btn" @click="shareDialogOpen = true" aria-label="Share">
    <Share2Icon :size="14" />
    <span v-if="activeShareCount > 0" class="share-badge">{{ activeShareCount }}</span>
  </button>
  <ShareDialog v-if="showShareButton" v-model:open="shareDialogOpen" :entry-slug="slug" variant="sheet" />
  <OverflowMenu :items="overflowItems" variant="sheet" />
</template>
```

### Changes to overflowItems

Remove the "Share" item from the computed array. The share button is now a separate element.

```typescript
// REMOVE this block from overflowItems:
if (showShareButton.value) {
  items.push({
    label: 'Share',
    icon: 'share-2',
    hint: 'Create share link',
    action: () => { showShareDialog.value = true },
  })
}
```

### Badge Reactivity

```typescript
const shareStore = useShareStore()

const activeShareCount = computed(() => {
  return shareStore.shares.filter(s => s.revokedAt === null && !isShareExpired(s)).length
})

function isShareExpired(share: ShareInfo): boolean {
  if (!share.expiresAt) return false
  return new Date(share.expiresAt) <= new Date()
}
```

The share store's `fetchShares` is called when ShareDialog opens (inside ShareDialogContent's setup). The badge count updates reactively because `shareStore.shares` is a reactive ref.

### Removed Elements

- `ShareManagementPanel` import and usage
- `showShareDialog` ref (replaced by `shareDialogOpen`)
- `handleShareRevoked` handler (no longer needed; ShareDialogContent handles internally)
- "Share" item in `overflowItems`

## 7. Responsive Breakpoint Alignment (BDD-24)

### Current State

`EntryDetailView` uses `isDesktop = window.innerWidth >= 768` to switch between desktop and mobile layouts. This does not align with DESIGN.md §9 breakpoints (mobile <= 640px, tablet 641-1024px, desktop > 1024px).

### Resolution

T058 introduces the three-breakpoint model in `EntryDetailView` for the share/overflow components:

```typescript
// Replace isDesktop with a three-tier reactive breakpoint
const viewportWidth = ref(window.innerWidth)
window.addEventListener('resize', () => { viewportWidth.value = window.innerWidth })

const isMobile = computed(() => viewportWidth.value <= 640)
const isTablet = computed(() => viewportWidth.value > 640 && viewportWidth.value <= 1024)
const isDesktop = computed(() => viewportWidth.value > 1024)
```

**Tablet behavior (641-1024px)**: Uses Popover mode for ShareDialog (`variant="popover"`) and Dropdown mode for OverflowMenu (`variant="dropdown"`). This is identical to desktop behavior per BDD-24. The mobile bottom bar is NOT shown on tablet.

**Template update**:

```vue
<!-- Desktop/Tablet actions area -->
<template v-if="!isMobile">
  <button v-if="showShareButton" class="icon-btn share-btn" ...>
    <Share2Icon :size="16" />
    <span v-if="activeShareCount > 0" class="share-badge">{{ activeShareCount }}</span>
  </button>
  <ShareDialog v-if="showShareButton" v-model:open="shareDialogOpen" :entry-slug="slug" variant="popover" />
  <OverflowMenu :items="overflowItems" variant="dropdown" />
</template>

<!-- Mobile bottom bar -->
<template v-if="isMobile">
  <button v-if="showShareButton" class="bottom-btn share-btn" ...>
    <Share2Icon :size="14" />
    <span v-if="activeShareCount > 0" class="share-badge">{{ activeShareCount }}</span>
  </button>
  <ShareDialog v-if="showShareButton" v-model:open="shareDialogOpen" :entry-slug="slug" variant="sheet" />
  <OverflowMenu :items="overflowItems" variant="sheet" />
</template>
```

**Scope note**: The three-breakpoint model is introduced for the share/overflow components only. Other conditional rendering in `EntryDetailView` (e.g., file tree sidebar) that currently uses `isDesktop` may be updated as a follow-up, but T058 only rewrites the share/overflow branch to use the new breakpoints.

## 8. Popover Positioning Strategy

### Desktop Popover

The Popover uses `position: absolute` relative to the share button's parent container (which has `position: relative`).

```css
.share-popover {
  position: absolute;
  top: calc(100% + 4px);  /* 4px gap below trigger */
  right: 0;
  width: 280px;
  max-height: calc(100vh - var(--header-height) - 20px);
  overflow-y: auto;
  z-index: 100;
}
```

### Viewport Edge Handling

When the share button is near the bottom of the viewport, the Popover should flip upward:

```css
.share-popover.flip-up {
  top: auto;
  bottom: calc(100% + 4px);
}
```

The flip logic is determined by checking if the Popover would overflow the viewport bottom:

```typescript
function updatePosition() {
  if (!triggerRef.value || !popoverRef.value) return
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const availableBelow = window.innerHeight - triggerRect.bottom
  const popoverHeight = popoverRef.value.scrollHeight
  if (availableBelow < Math.min(popoverHeight, 400)) {
    flipUp.value = true
  } else {
    flipUp.value = false
  }
}
```

This is called when the Popover opens and on window resize.

### Mobile Bottom Sheet

No positioning logic needed — the Sheet is fixed to the bottom of the viewport via `position: fixed; bottom: 0; left: 0; right: 0;`.

### Swipe-to-Close Gesture (BDD-15)

Both `OverflowMenuSheet` and `ShareDialog` bottom sheet support swipe-to-close via touch gesture.

**Touch event handling**:

```typescript
// In each Sheet component
const sheetRef = ref<HTMLElement>()
const dragOffsetY = ref(0)
const isDragging = ref(false)
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY
  isDragging.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const deltaY = e.touches[0].clientY - touchStartY
  if (deltaY > 0) {
    dragOffsetY.value = deltaY
  } else {
    dragOffsetY.value = 0
  }
}

function onTouchEnd() {
  isDragging.value = false
  if (dragOffsetY.value >= 50) {
    emit('close')
  }
  dragOffsetY.value = 0
}
```

**Threshold**: 50px downward displacement triggers close. Upward swipes are ignored (deltaY < 0 resets offset to 0).

**Animation**: During drag, the sheet translates via `transform: translateY(${dragOffsetY}px)` with `transition: none` (follows finger). On release, if threshold met, the sheet animates out with `transition: transform 200ms ease-out; transform: translateY(100%)`. If threshold not met, it snaps back with `transition: transform 200ms ease-out; transform: translateY(0)`.

**CSS**:

```css
.bottom-sheet {
  transition: transform 200ms ease-out;
}
.bottom-sheet.dragging {
  transition: none;
}
.bottom-sheet.closing {
  transition: transform 200ms ease-out;
  transform: translateY(100%);
}
```

**Applicable to**: `OverflowMenuSheet.vue` and `ShareDialog` sheet variant. Both share the same gesture logic (can be extracted to a composable `useSwipeToClose` if desired, but this is an implementation detail).

**Overscroll guard**: If the sheet body is scrollable, the swipe-to-close gesture only activates when `scrollTop === 0` and the swipe direction is downward. This prevents accidental close when the user is scrolling through a long share list.

### Popover Focus Management (BDD-23)

The ShareDialog Popover implements a **soft focus trap**: Tab cycles through interactive elements inside the Popover, and when focus would exit the Popover (Tab past the last element or Shift+Tab before the first), the Popover closes and focus returns to the share button trigger.

**Implementation**:

```typescript
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emitClose()
    triggerRef.value?.focus()
    return
  }
  if (e.key === 'Tab') {
    const focusable = popoverRef.value?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      emitClose()
      triggerRef.value?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      emitClose()
      triggerRef.value?.focus()
    }
  }
}
```

**On open**: First interactive element receives focus automatically. This ensures keyboard users can immediately interact with the Popover content.

**OverflowMenuDropdown focus**: Same soft focus trap pattern. Tab past the last item closes the dropdown and returns focus to the trigger button.

### Popover Scroll Behavior

When the parent page scrolls while the Popover is open, the Popover closes. This prevents the Popover from becoming visually detached from its trigger.

**Implementation**: Add a scroll listener on `window` when the Popover opens; remove on close.

```typescript
onMounted(() => {
  window.addEventListener('scroll', emitClose, true) // capture phase to catch nested scrolls
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', emitClose, true)
})
```

The `true` (capture) flag ensures the listener catches scroll events from any nested scrollable container, not just the window.

## 9. View Switching in ShareDialogContent

### State Machine

```
[Closed] --open--> [List View] --click "Create"--> [Create View]
                     ^                                |
                     |----click "Back" / create success|
```

### View Switching Animation

View switching between list and create is **instant** (no transition animation). Rationale: the Popover/Sheet container is small (280px / 60-70% screen height), and a slide/fade animation would add visual noise for a simple two-state toggle. The content swap is immediate, matching the pattern of tab-like content switching in compact containers. The Popover/Sheet open/close animations (slide-up for Sheet, fade-in for Popover) are separate and remain animated.

### List View Content

1. Header: "Share Links" title + close button
2. Loading state: spinner/skeleton
3. Empty state: "No active share links" + "Create share link" primary button
4. Active links: list of link rows (URL/prefix + copy + status + revoke)
5. Expired links: collapsible section "Expired links (N)" with reduced opacity items
6. Footer: "+ Create new link" text button

### Create View Content

1. Header: "← Back" + "Create Link" title + close button
2. Expires in dropdown: 1h / 1d / 7d (default) / 30d / Never
3. Max views dropdown: Unlimited (default) / 10 / 50 / 100
4. "Create link" primary button

### Create Success Flow

1. API call succeeds → store shareUrl in cache
2. Switch to list view
3. New link appears at top of active list
4. New link row has `--c-success` border flash (0.5s animation)
5. Badge count increments (reactive via store)

### Revoke Flow

1. Click revoke button → immediate API call (no confirmation)
2. On success: toast "Link revoked"
3. Link moves to expired/revoked section (or disappears if section collapsed)
4. Badge count decrements (reactive via store, since revokeShares calls fetchShares)

## 10. P3 Testable Behavior Contracts

### OverflowMenu Orchestrator

| Contract | Test |
|----------|------|
| Renders trigger button | `find('.overflow-trigger').exists()` |
| Toggle opens/closes | Click trigger → dropdown/sheet visible; click again → hidden |
| `variant='dropdown'` renders OverflowMenuDropdown | Click trigger → `.overflow-dropdown` exists |
| `variant='sheet'` renders OverflowMenuSheet | Click trigger → `.bottom-sheet` exists |
| Click outside closes dropdown | Dispatch outside click → dropdown hidden |
| Escape closes | Dispatch Escape → hidden, focus returns to trigger |
| `close()` exposed method works | Call `close()` → dropdown hidden |
| aria-expanded toggles | Open → `aria-expanded="true"`; close → `false` |

### OverflowMenuDropdown

| Contract | Test |
|----------|------|
| Renders items with correct count | `findAll('.overflow-item').length === items.length` |
| Item click emits `action` event | Click item → `action` emitted with correct item |
| `<a>` for href items | Item with href renders `<a>` tag |
| `<button>` for action items | Item without href renders `<button>` tag |
| `item-danger` class for danger variant | Danger item has `item-danger` class |
| Icon rendered when item has icon | Item with icon has SVG child |
| Divider rendered | Item with `divider: true` renders divider element |
| Close button emits `close` | (N/A — dropdown closes via orchestrator click-outside) |

### OverflowMenuSheet

| Contract | Test |
|----------|------|
| Renders items with correct count | Same as dropdown |
| Drag handle visible | `.sheet-drag-handle` exists |
| Close button emits `close` | Click close button → `close` emitted |
| Backdrop click emits `close` | Click backdrop → `close` emitted |
| Item min-height 48px | Computed style `minHeight === '48px'` |

### ShareDialog

| Contract | Test |
|----------|------|
| `variant='popover'` renders Popover container | Open → `.share-popover` exists |
| `variant='sheet'` renders Sheet container | Open → `.share-bottom-sheet` exists |
| v-model:open toggles visibility | Set `open=true` → container visible; `open=false` → hidden |
| Close on Escape | Dispatch Escape → `open` becomes false |
| Close on outside click (popover) | Click outside → `open` becomes false |
| Close on backdrop click (sheet) | Click backdrop → `open` becomes false |

### ShareDialogContent

| Contract | Test |
|----------|------|
| Fetches shares on mount | `shareStore.fetchShares` called with correct slug |
| Shows loading state | While `shareStore.loading === true` → loading indicator visible |
| Shows empty state | 0 shares → "No active share links" + create button visible |
| Shows active links | Active shares → link rows visible with correct count |
| Shows expired collapsible | Expired shares → "Expired links (N)" section visible |
| Copy button triggers clipboard | Click copy → `navigator.clipboard.writeText` called |
| Copy icon changes to check | After copy → check icon visible, reverts after 1.5s |
| Revoke button calls store | Click revoke → `shareStore.revokeShares` called |
| Revoke shows toast | After revoke success → toast shown |
| Create view switch | Click "Create share link" → create form visible |
| Create with defaults | Click "Create link" → `createShare` called with '7d', null |
| Create success switches to list | After create → list view visible, new link at top |
| Create failure shows error toast | After create failure → error toast shown |
| Back button returns to list | Click "← Back" → list view visible |
| Emits `created` on success | After create → `created` emitted |
| Emits `revoked` on success | After revoke → `revoked` emitted |

### Badge Reactivity

| Contract | Test |
|----------|------|
| Badge shows active count | 2 active shares → badge text "2" |
| Badge hidden when 0 | 0 active shares → badge not rendered |
| Badge updates on revoke | Revoke 1 → badge text "1" |
| Badge updates on create | Create 1 → badge text increments |

## 11. [SCOPE+] Findings

### [SCOPE+] Share URL unavailable for existing shares

**Discovery**: `ShareInfo` from the list API contains only `tokenPrefix` (8 chars). The full share token is never stored by the backend — only the SHA-256 hash is persisted. This means the frontend cannot construct the full share URL for shares created in previous sessions.

**Must-do reason**: P0-brief and P1 BDD-07 assume the full share URL is displayable for all shares. Without the full token, this is impossible for existing shares.

**Resolution**: Add `shareUrlCache` to the share store. Newly created shares have their `shareUrl` cached. For existing shares without cached URLs, display `tokenPrefix + "..."` instead of the full URL. The copy button for prefix-only links copies the prefix string with a tooltip explaining the limitation.

**Impact**: BDD-07 needs refinement — "full share URL is displayed" applies only when the URL is available (newly created or cached from same session). For uncached shares, `tokenPrefix + "..."` is displayed instead.

**Packages affected**: frontend-v3 only (no backend change)

## 12. Completion Criteria

Implementation is complete when:

1. `npx vue-tsc --noEmit` passes with zero errors
2. `npm run build` succeeds
3. OverflowMenu dropdown uses all DESIGN.md §6 tokens (verified by CSS inspection)
4. OverflowMenu bottom sheet uses all DESIGN.md §6 tokens
5. ShareManagementPanel.vue is deleted
6. ShareDialog + ShareDialogContent render correctly in both Popover and Sheet modes
7. Share button badge shows active count and updates reactively
8. "Share" item removed from OverflowMenu items
9. All existing OverflowMenu.spec.ts tests pass (adapted for new structure)
10. Light theme: dropdown/Popover backgrounds are opaque white (no transparency)
11. Dark theme: dropdown/Popover backgrounds are `#121822`
12. Swipe-to-close gesture works on both OverflowMenuSheet and ShareDialog Sheet (BDD-15)
13. Tablet viewport (641-1024px) uses Popover/Dropdown mode (BDD-24)
14. Popover closes on parent page scroll
15. Popover soft focus trap: Tab past last element closes Popover and returns focus to trigger
16. Badge positioned at top-right corner of share button with specified offsets
17. T058 E2E spec (`e2e/t058-share-redesign.e2e.spec.ts`) passes
18. Updated `test_t057_ui_polish.spec.ts` passes with new selectors
