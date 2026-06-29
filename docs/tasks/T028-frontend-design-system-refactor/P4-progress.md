# T028 P4 Progress

## Phase 1: Token Infrastructure

### Step 1: variables.css ✅
- Replaced old per-theme token declarations with `--c-*` primary tokens + old token aliases (var() references)
- Dark theme: 17 `--c-*` tokens + 29 old token aliases
- Light theme: 17 `--c-*` tokens + 29 old token aliases
- `:root` spacing/typography/radius/transition/layout preserved unchanged

### Step 2: LandingView.vue ✅
- Deleted non-scoped `<style>` block containing `.stage` and `[data-theme="light"] .stage` (old `--c-*` declarations + Landing-only tokens)
- Moved Landing-only tokens (`--c-hero-grad`, `--c-cta-grad`, `--pw-*`) into `<style scoped>` `.stage` selector
- Scoped style token replacements: `--c-panel`→`--c-surface`, `--c-panel2`→`--c-surface-lower`, `--c-border2`→`--c-border-strong`, `--c-muted`→`--c-text-secondary`, `--c-faint`→`--c-text-tertiary`, `--c-accent2`→`--c-accent-secondary`, `--glow-color`→`--c-glow`
- Inline v-html strings also updated with canonical token names

### Step 3: base.css ✅
- 22 old token references replaced with `--c-*` tokens
- Key changes: `--bg-primary`→`--c-bg`, `--text-primary`→`--c-text`, `--bg-secondary`→`--c-surface`, `--border-color`→`--c-border`, `--accent-color`→`--c-accent`, etc.

### Step 4: layout.css ✅
- 16 old token references replaced with `--c-*` tokens
- Key D2 fixes: `.content-area` bg→`--c-bg` (page-level), `.drawer` bg→`--c-surface` (panel), `.detail-header` bg→`--c-surface` (panel)
- `.drawer-overlay` bg→hardcoded `rgba(0,0,0,.5)` per spec

## Phase 2: Shared Components

### Step 5: BaseButton.vue ✅
- Props: variant (primary/secondary/ghost/danger), size (default/small), disabled, type
- Classes: btn-{variant}, btn-{default|small}, btn-disabled, btn-focus-ring
- Emits click (blocked when disabled)
- Focus ring: outline 2px solid --c-accent-secondary, offset 2px
- Reduced motion support

### Step 6: BaseTag.vue ✅
- Pure display component with default slot
- Root class: base-tag
- Uses --c-tag-bg, --c-accent-secondary, 6px radius

### Step 7: BaseBadge.vue ✅
- Props: status (public/private/shared), default 'public'
- Root class: base-badge, status class: badge-{status}
- Uses --c-badge-*-bg + --c-success/--c-error/--c-warning
- Displays status text

### Step 8: SearchInput.vue ✅
- Props: modelValue, placeholder (default 'Search...')
- Emits: update:modelValue, clear, keydown
- Clear button with aria-label="Clear", shown only when value present
- Left search icon (SVG), focus ring with --c-glow
- Wrapper class: search-input-wrapper

### Step 9: EmptyState.vue ✅
- Props: icon (default 'Inbox'), heading, description, ctaLabel
- Emits: cta
- Root class: empty-state
- Icon mapping: Inbox, Search, FileX, FolderX, Database, AlertCircle
- CTA uses BaseButton primary
- .empty-state-icon, .empty-state-heading, .empty-state-description, .empty-state-cta

### Step 10: EntryListRow.vue ✅
- Props: entry (Entry), isOwner, currentUsername
- Emits: navigate, toggleVisibility, delete
- Slots: actions
- Root class: entry-list-row
- Uses BaseTag for tags, BaseBadge for visibility
- Keyboard support: Enter/Space triggers navigate
- Touch: hover-only actions always visible on touch devices
- data-action="toggle-visibility" and data-action="delete" for test selectors

### Step 11: PageHeader.vue ✅
- Props: title, backTo, backLabel (default 'Back')
- Slots: meta, actions
- Root class: page-header
- .page-header-title, .back-link (router-link)
- Uses --c-surface bg, --c-border bottom border

## Phase 3 — NotFoundView (completed)
- Replaced `.home-link` with `BaseButton variant="secondary"`
- Token migration: `--text-primary` → `--c-text`, `--text-secondary` → `--c-text-secondary`, `--accent-color` → removed (BaseButton handles), `--border-color` → removed (BaseButton handles)
- Added `background: var(--c-bg)` to root container
- Changed from `<router-link>` to `BaseButton` + `router.push()` (BaseButton is a `<button>`, not `<a>`)
- Added `useRouter` import

## Phase 3 — EntryListView (completed)
- Header: Replaced `.list-header` with `PageHeader` component; `.logo-link` → PageHeader title+backTo; `.search-box`/`.search-input` → `SearchInput` v-model; `.btn-login` → `BaseButton variant="ghost"`
- Entry grid: Replaced `.entry-card` cards with `EntryListRow` inside `.entry-panel` (bg: --c-surface, border: --c-border-strong, radius: 14px)
- Empty state: Replaced `.empty` with `EmptyState` component (icon="Search")
- Loading/error: Renamed to `.loading-state`/`.error-state` using --c-* tokens
- All scoped styles migrated from old tokens to --c-* tokens
- D2: `.entry-list bg` → `--c-bg`; `.user-dropdown bg` → `--c-surface`; `.card-action-btn bg` → removed (EntryListRow handles)
- F4: EntryListRow handles @media (hover: hover) for action buttons
- Footer: Token migration only (--border-color → --c-border, --text-tertiary → --c-text-tertiary, etc.)
- Search: v-model on SearchInput + watch on searchQuery triggers debounced search; @keydown handles Enter/Escape
- Removed onSearchInput (replaced by watch), removed .search-box/.search-input/.entry-card/.card-body/.card-actions/.entry-meta styles

## Phase 3 — EntryDetailView (completed)
- Replaced all `.btn`/`.btn-sm`/`.btn-danger` buttons with `BaseButton` component (variant=secondary/primary/ghost/danger, size=small)
- Active state (Wrap button): BaseButton variant="primary" when wrapEnabled, variant="secondary" when not
- "Raw" link: `<a class="raw-link">` with self-contained secondary button styles (not wrapped BaseButton — invalid HTML)
- Removed all scoped `.btn`/`.btn-sm`/`.btn-danger`/`.btn.active` styles (handled by BaseButton)
- Token migration in scoped styles: `--accent-color` → `--c-accent`, `--text-secondary` → `--c-text-secondary`, `--text-tertiary` → `--c-text-tertiary`, `--bg-secondary` → `--c-surface`, `--error-text` → `--c-error`
- Removed global `<style>` block for `.detail-header .back-btn` (already in layout.css)
- Kept global `<style>` block for `.desktop-only` media query (affects layout.css elements)
- Added `import BaseButton` and `raw-link` style (secondary button appearance for `<a>`)
- Removed unused `formatRelativeTime` and `formatExpiresIn`/`isExpiringSoon` imports from EntryListView (EntryListRow handles its own metadata)
- layout.css already migrated to --c-* tokens (Phase 1)

## Phase 3 — ApiKeyListView (completed)
- Page header: Replaced `.page-header`/`.header-left`/`.back-link` with `PageHeader` component (back-to="/", back-label="← Back")
- Create Key button: `BaseButton variant="primary"`
- Empty state: Replaced `.empty` with `EmptyState` component (icon="Database", cta-label="Create Key")
- Key cards: Token migration — `--bg-secondary` → `--c-surface`, `--border-color` → `--c-border-strong`, radius 12px → 14px
- Revoke button: `BaseButton size="small" variant="danger"`
- Cleanup button: `BaseButton variant="secondary"`
- Dialog buttons: All `.btn-primary`/`.btn-secondary` → `BaseButton variant="primary"/"secondary"` with `:disabled`
- Dialog: `--bg-primary` → `--c-surface` (D2), `--border-color` → `--c-border-strong`, radius 12px → 14px
- Dialog form fields: `--bg-primary` → `--c-surface-lower`, `--border-color` → `--c-border`, focus ring → `--c-accent`
- Key display: `--bg-tertiary` → `--c-surface-lower`
- All scoped styles migrated to --c-* tokens
- D2: `.apikey-page bg` → `--c-bg`; `.dialog bg` → `--c-surface`; `.key-card bg` → `--c-surface`
- Removed all `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-danger`/`.btn-sm` scoped styles
- Added BaseBadge for expired key status (status="private" = red badge)
