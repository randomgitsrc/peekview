---
phase: P2
task_id: T030-frontend-interaction-enhancements
type: design
parent: P1-requirements.md
trace_id: T030-P2-20260630
status: draft
created: 2026-06-30
---

# T030 Design: Zebra Stripe + Mobile Overflow Menu

## Declarations

```yaml
packages:
  - peekview-frontend

domains:
  - frontend

ui_affected:
  - CodeViewer.vue (zebra stripe on .line elements)
  - MarkdownViewer.vue (code block zebra stripe)
  - DiagramBlock.vue (code view zebra stripe)
  - EntryDetailView.vue (overflow menu + mobile-actions restructure)
  - OverflowMenu.vue (new component)
  - variables.css (--bg-code-odd / --bg-code-even)
  - code.css (zebra stripe rules)

gate_commands:
  P5: "cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20"
  P5_e2e: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20"
  P6: "cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20"

env_constraints:
  debug_env: "make debug (127.0.0.1:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries'"

files_to_read:
  - path: frontend-v3/src/styles/variables.css
    why: Add --bg-code-odd / --bg-code-even to both theme blocks
  - path: frontend-v3/src/styles/code.css
    why: Add zebra stripe rules for CodeViewer .line elements
  - path: frontend-v3/src/components/CodeViewer.vue
    why: Verify scoped style import and :deep() usage pattern
  - path: frontend-v3/src/components/MarkdownViewer.vue:100-250
    why: Add zebra stripe rules for .code-block-wrapper .line elements
  - path: frontend-v3/src/components/DiagramBlock.vue:270-340
    why: Add zebra stripe rules for .diagram-code .line elements
  - path: frontend-v3/src/views/EntryDetailView.vue:198-288
    why: Restructure mobile-actions with OverflowMenu
  - path: frontend-v3/src/styles/layout.css:86-107
    why: Modify .mobile-actions layout for overflow pattern
  - path: frontend-v3/src/components/BaseButton.vue
    why: Understand href vs button rendering for OverflowMenu items

minimal_validation:
  assumption: "Shiki outputs <span class='line'> as direct children of <code>, enabling nth-child(even) zebra targeting"
  method: "Node.js script calling shiki.codeToHtml() and inspecting output structure"
  result: "confirmed"
  note: "Verified: .line spans are the only children of <code>. nth-child index = line index. No intermediate wrapper elements."
```

## §1 Enhancement A: Zebra Stripe

### 1.1 Design Goal

Add subtle alternating row background colors to all code rendering contexts (CodeViewer, MarkdownViewer code blocks, DiagramBlock code view) without affecting inline code, Mermaid render, or HTML iframe content.

### 1.2 Approach: Pure CSS nth-child + Custom Properties

**Why this approach**:
- Shiki outputs `<span class="line">` per code line as direct children of `<code>` (verified by minimal validation)
- `nth-child(even)` on `.line` elements requires zero JS changes
- CSS custom properties enable theme-aware colors with automatic switching via `[data-theme]`
- No Shiki configuration changes needed

**Why NOT other approaches**:
- Shiki `transformers.lineNotation` — adds per-line class names (`.line-1`, `.line-2`), but requires Shiki API changes and is overkill when `nth-child` suffices
- JS-based row striping — unnecessary complexity, race conditions with async highlighting
- Background on `<pre>` with linear-gradient — doesn't work with variable line heights (wrap mode)

### 1.3 CSS Variable Design

Add to `variables.css` in both theme blocks:

```css
/* Dark theme */
[data-theme="dark"] {
  --bg-code-odd: var(--bg-code);        /* #0e131b — unchanged, backward compatible */
  --bg-code-even: #131920;              /* subtle shift, ~3% lighter */
}

/* Light theme */
[data-theme="light"] {
  --bg-code-odd: var(--bg-code);        /* #eef0f3 — unchanged, backward compatible */
  --bg-code-even: #e8ebef;              /* subtle shift, ~2% darker */
}
```

**Design rationale**:
- Odd lines use existing `--bg-code` for zero visual change on existing pages
- Even lines get a subtle shift — enough to distinguish rows, not enough to distract from syntax highlighting
- Dark theme: lighter even rows (dark backgrounds need "add light" for contrast)
- Light theme: darker even rows (light backgrounds need "add shadow" for contrast)
- Difference is intentionally minimal (~3% luminance shift) to avoid interfering with syntax color perception

### 1.4 Selector Rules

**CodeViewer** (in `code.css`):

```css
.code-body :deep(.line:nth-child(even)) {
  background-color: var(--bg-code-even);
}
```

- Scoped to `.code-body` (CodeViewer's content area)
- `:deep()` needed because `.line` is inside `v-html` content (scoped CSS boundary)
- `.line` elements are inside `<code>` which is inside `<pre>` — line numbers are in a separate sibling `<div class="line-numbers">`, so zebra cannot bleed into line numbers (A-AC4)

**MarkdownViewer** (in `MarkdownViewer.vue` unscoped `<style>`):

```css
.markdown-body .code-block-wrapper .line:nth-child(even) {
  background-color: var(--bg-code-even);
}
```

- Scoped to `.code-block-wrapper` — only fenced code blocks, not inline code
- Inline code (`code:not(pre code)`) has no `.line` children, so automatically excluded (A-AC5)
- Unscoped style needed because MarkdownViewer renders via `v-html`

**DiagramBlock** (in `DiagramBlock.vue` unscoped `<style>`):

```css
.diagram-block .diagram-code .line:nth-child(even) {
  background-color: var(--bg-code-even);
}
```

- Scoped to `.diagram-code` — only the code view, not the diagram render view
- Diagram render (Mermaid/SVG/PlantUML) has no `.line` elements

### 1.5 Wrap Mode Compatibility (A-AC6)

Wrap mode already sets `.line { height: auto; min-height: 1.6em }` in `code.css:115-120`. Background-color on `.line` elements automatically covers the full rendered height — no additional CSS needed.

The `background-color` property on a `display: block` element covers its entire content box, including when content wraps to multiple visual lines.

### 1.6 Theme Switching (A-AC4)

CSS variables under `[data-theme]` selectors automatically update when the theme attribute changes. No JS needed — the existing theme toggle mechanism already swaps `[data-theme]` on the root element.

### 1.7 Exclusions Verified

| Context | Why excluded | Mechanism |
|---------|-------------|-----------|
| Inline code | No `.line` children | `code:not(pre code)` has no `.line` spans |
| HTML render iframe | Isolated document | iframe has independent CSS, no access to parent variables |
| Mermaid/SVG render | No `.line` elements | Rendered SVG/canvas, not Shiki HTML |
| Line numbers column | Separate DOM subtree | `.line-numbers` is sibling of `<pre>`, not ancestor of `.line` |

### 1.8 BDD Coverage Map

| AC | Covered by | Verification |
|----|-----------|-------------|
| A-AC1 | `.code-body :deep(.line:nth-child(even))` | Playwright screenshot CodeViewer |
| A-AC2 | `.markdown-body .code-block-wrapper .line:nth-child(even)` | Playwright screenshot MarkdownViewer |
| A-AC3 | `.diagram-block .diagram-code .line:nth-child(even)` | Playwright screenshot DiagramBlock code view |
| A-AC4 | CSS variables under `[data-theme]` selectors | Playwright: toggle theme, re-screenshot |
| A-AC5 | Inline code has no `.line` children | Playwright: verify inline code bg unchanged |
| A-AC6 | `.line { height: auto }` + `background-color` covers full height | Playwright: wrap mode screenshot |
| A-AC7 | iframe isolation (no CSS inheritance) | By design — no action needed |

## §2 Enhancement B: Mobile Overflow Menu

### 2.1 Design Goal

Replace the horizontal-scroll mobile actions bar with a fixed set of primary buttons + an overflow dropdown for secondary actions, ensuring all buttons remain accessible without horizontal scrolling.

### 2.2 Primary/Secondary Button Classification

**Primary buttons** (always visible in action bar):

| Button | Why primary |
|--------|------------|
| Files (N) | Primary navigation for multi-file entries |
| Wrap | High-frequency toggle for code files |
| Copy | Most common action on any content |

**Secondary buttons** (folded into overflow menu):

| Button | Why secondary |
|--------|--------------|
| 🌐/🔒 Visibility | Owner-only, infrequent |
| Share | Owner-only, infrequent |
| 🗑️ Delete | Owner-only, destructive, infrequent |
| Download | Lower frequency than copy |
| Raw | Technical/agent use, lower frequency |
| Pack | Multi-file download, lower frequency |
| TOC | Alternative to sidebar, lower frequency |

**Rationale**: The 3 primary buttons fit comfortably in any mobile viewport (≥320px). All secondary buttons are either owner-only (contextual) or lower-frequency operations. This classification ensures the most common actions are one-tap while rarely-used actions are two-taps (open menu + tap item).

### 2.3 OverflowMenu Component

**File**: `frontend-v3/src/components/OverflowMenu.vue`

**Props**:

```typescript
interface OverflowMenuItem {
  label: string
  icon?: string
  href?: string
  target?: string
  rel?: string
  variant?: 'default' | 'danger'
  action?: () => void
}

defineProps<{
  items: OverflowMenuItem[]
}>()
```

**Template structure**:

```html
<div class="overflow-menu" ref="menuRef">
  <button
    class="overflow-trigger"
    :class="{ 'is-open': isOpen }"
    @click="toggle"
    aria-haspopup="true"
    :aria-expanded="isOpen"
  >
    ⋯
  </button>
  <div
    v-if="isOpen"
    class="overflow-dropdown"
    role="menu"
  >
    <template v-for="item in items" :key="item.label">
      <a
        v-if="item.href"
        :href="item.href"
        :target="item.target"
        :rel="item.rel"
        class="overflow-item"
        :class="{ 'item-danger': item.variant === 'danger' }"
        role="menuitem"
        @click="close"
      >
        <span v-if="item.icon" class="item-icon">{{ item.icon }}</span>
        {{ item.label }}
      </a>
      <button
        v-else
        class="overflow-item"
        :class="{ 'item-danger': item.variant === 'danger' }"
        role="menuitem"
        @click="handleAction(item)"
      >
        <span v-if="item.icon" class="item-icon">{{ item.icon }}</span>
        {{ item.label }}
      </button>
    </template>
  </div>
</div>
```

**Behavior**:

```typescript
const isOpen = ref(false)
const menuRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
  triggerRef.value?.focus()
}

function handleAction(item: OverflowMenuItem) {
  close()
  item.action?.()
}

// Click-outside
function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    close()
  }
}

// Escape key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
```

**Key design decisions**:
- `<a>` vs `<button>` rendering matches BaseButton pattern (B-AC3: Raw button preserves href behavior)
- `v-if="isOpen"` for dropdown (not CSS display toggle) — cleaner, no stale DOM
- Focus returns to trigger on close (B-AC4: Escape key focus management)
- `role="menu"` / `role="menuitem"` for accessibility

### 2.4 Dropdown Positioning

The mobile actions bar is at the **bottom** of the viewport. The dropdown must open **upward** (above the trigger):

```css
.overflow-dropdown {
  position: absolute;
  bottom: 100%;      /* Open upward */
  right: 0;
  margin-bottom: 4px;
  min-width: 160px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}
```

This mirrors the DiagramBlock dropdown pattern but inverted (bottom-up instead of top-down).

### 2.5 Touch Target Compliance (B-AC6)

```css
.overflow-trigger {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.overflow-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 44px;
  padding: 12px 16px;
  font-size: var(--font-sm);
  color: var(--text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
}
```

### 2.6 Mobile Actions Restructure

**Before** (current `EntryDetailView.vue:198-288`):
```html
<div class="mobile-actions">
  <!-- ALL buttons as direct children, horizontal scroll -->
</div>
```

**After**:
```html
<div class="mobile-actions">
  <!-- Primary buttons (always visible) -->
  <BaseButton v-if="entryStore.isMultiFile" ...>Files (N)</BaseButton>
  <BaseButton v-if="entryStore.canWrap" ...>Wrap</BaseButton>
  <BaseButton v-if="entryStore.canCopy" ...>Copy</BaseButton>
  
  <!-- Overflow menu (secondary buttons) -->
  <OverflowMenu :items="overflowItems" />
</div>
```

**`overflowItems` computed property**:

```typescript
const overflowItems = computed(() => {
  const items: OverflowMenuItem[] = []
  if (entryStore.currentEntry && authStore.isOwner(entryStore.currentEntry.ownerId)) {
    items.push({
      label: entryStore.currentEntry.isPublic ? 'Make Private' : 'Make Public',
      icon: entryStore.currentEntry.isPublic ? '🔒' : '🌐',
      action: handleToggleVisibility,
    })
    if (showShareButton.value) {
      items.push({ label: 'Share', action: () => { showShareDialog.value = true } })
    }
    items.push({
      label: 'Delete',
      icon: '🗑️',
      variant: 'danger',
      action: confirmDeleteEntry,
    })
  }
  if (entryStore.canDownload) {
    items.push({ label: 'Download', action: downloadFile })
  }
  if (entryStore.currentEntry) {
    items.push({
      label: 'Raw',
      href: `/api/v1/entries/${entryStore.currentEntry.slug}/raw`,
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  }
  if (entryStore.canPack && entryStore.currentEntry) {
    items.push({ label: 'Pack', action: downloadPack })
  }
  if (showTocButton.value) {
    items.push({ label: 'TOC', action: () => { showTocDrawer.value = true } })
  }
  return items
})
```

### 2.7 Layout CSS Changes

**`layout.css` — `.mobile-actions`**:

```css
.mobile-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--c-surface);
  border-top: 1px solid var(--c-border);
  height: var(--header-height);
  flex-shrink: 0;
  /* REMOVE: overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; */
  /* REMOVE: ::-webkit-scrollbar { display: none; } */
}
```

Remove horizontal scroll properties — the overflow menu eliminates the need for scrolling.

### 2.8 Desktop Behavior (B-AC5)

No changes to desktop layout. `.mobile-actions { display: none }` at `min-width: 1024px` remains unchanged. The OverflowMenu component is never rendered on desktop.

### 2.9 BDD Coverage Map

| AC | Covered by | Verification |
|----|-----------|-------------|
| B-AC1 | Primary buttons + OverflowMenu replace horizontal scroll | Playwright: mobile viewport, verify no horizontal overflow |
| B-AC2 | `toggle()` + `handleClickOutside()` | Playwright: click trigger → menu opens; click outside → closes |
| B-AC3 | `<a>` rendering for href items, `action()` callback for click items | Playwright: click Raw → new tab; click Delete → confirm dialog |
| B-AC4 | `handleKeydown` Escape handler + focus return | Playwright: open menu → press Escape → menu closes, trigger focused |
| B-AC5 | `.mobile-actions { display: none }` at desktop | Playwright: desktop viewport, verify no overflow menu |
| B-AC6 | `min-height: 44px` on `.overflow-item` and `.overflow-trigger` | Playwright: measure menu item height |

## §3 Impact Analysis

### 3.1 What Changes

| File | Change | Risk |
|------|--------|------|
| `variables.css` | Add `--bg-code-odd` / `--bg-code-even` to both themes | Low — additive, no existing variable modified |
| `code.css` | Add `.line:nth-child(even)` rule | Low — targets only Shiki `.line` elements inside `.code-body` |
| `MarkdownViewer.vue` | Add `.code-block-wrapper .line:nth-child(even)` rule | Low — scoped to code blocks, inline code unaffected |
| `DiagramBlock.vue` | Add `.diagram-code .line:nth-child(even)` rule | Low — scoped to code view only |
| `OverflowMenu.vue` | New component | Medium — new component, needs testing |
| `EntryDetailView.vue` | Restructure mobile-actions, add overflowItems computed | Medium — changes mobile layout |
| `layout.css` | Remove scroll properties from `.mobile-actions` | Low — simplification |

### 3.2 What Does NOT Change

- Shiki configuration or output (no `transformers` or API changes)
- Backend API or data model
- MCP server
- Desktop layout or behavior
- HTML render iframe content
- BaseButton component
- Theme toggle mechanism
- Zen mode behavior

### 3.3 Risks

| Risk | Mitigation |
|------|-----------|
| Zebra colors too prominent, distracting from syntax | Use minimal luminance shift (~3%); P6 visual verification |
| `nth-child(even)` miscounts if Shiki adds non-`.line` children | Verified: `.line` spans are the only children of `<code>` |
| OverflowMenu dropdown clipped by viewport edge | `bottom: 100%` opens upward; `min-width: 160px` fits mobile |
| Delete confirmation dialog blocked by overflow menu | `close()` called before `confirmDeleteEntry()`, menu closes first |
| OverflowMenu items order varies by entry state | `overflowItems` computed dynamically from current state — always correct |

## §4 Implementation Plan

### Step 1: CSS Variables (variables.css)
Add `--bg-code-odd` and `--bg-code-even` to both `[data-theme="dark"]` and `[data-theme="light"]` blocks.

### Step 2: Zebra Stripe CSS (code.css + MarkdownViewer + DiagramBlock)
Add `nth-child(even)` background rules for all three rendering contexts.

### Step 3: OverflowMenu Component
Create `OverflowMenu.vue` with props, template, behavior (click-outside, Escape, focus management), and styles.

### Step 4: EntryDetailView Restructure
- Add `overflowItems` computed property
- Replace secondary buttons in `.mobile-actions` with `<OverflowMenu>`
- Remove horizontal scroll CSS from `layout.css`

### Step 5: Visual Verification
- Build frontend (`make build-frontend`)
- Start debug server (`make debug-start`)
- Playwright screenshots for all BDD ACs

## §5 Completion Criteria

1. `--bg-code-odd` and `--bg-code-even` defined in both theme blocks in `variables.css`
2. Zebra stripe visible in CodeViewer, MarkdownViewer code blocks, and DiagramBlock code view
3. No zebra on inline code, HTML iframe, or Mermaid/SVG render
4. Zebra adapts to wrap mode (full line height coverage)
5. Theme toggle switches zebra colors correctly
6. Mobile actions bar shows primary buttons + overflow trigger, no horizontal scroll
7. Overflow menu opens/closes with click, click-outside, and Escape
8. Overflow menu items preserve full functionality (href links, confirm dialogs)
9. Desktop layout unchanged
10. All menu items and trigger button meet 44px touch target minimum
11. `npx vue-tsc --noEmit` passes
12. `vitest run` passes
