# T028 P2 Progress Log

## 2026-06-29 Input Reading

### P0-brief key takeaways
- Debug env: `make debug` (:8888, /tmp/peekview-debug/)
- Typecheck gate: `cd frontend-v3 && npx vue-tsc --noEmit`
- Build gate: `make build-frontend`
- Patch release: v0.3.1

### P1-requirements key takeaways
- 10 requirements (R1-R10), 12 BDD scenarios
- D1: Old tokens must be aliased (18 components not in scope)
- D2: --bg-primary is NOT 1:1 — page bg vs card bg need different new tokens
- F1: .stage token promotion may conflict with LandingView
- F2: layout.css must be in scope for migration
- F3/F4/F5: a11y focus ring, touch device hover, prefers-reduced-motion
- 7 shared components: BaseButton, BaseTag, BaseBadge, SearchInput, EmptyState, EntryListRow, PageHeader
- Phases: P1-P6,P8 (P7 skipped)

### DESIGN.md analysis
- Token naming gap: LandingView uses `--c-panel`/`--c-panel2`/`--c-border2`/`--c-muted`/`--c-faint`/`--c-accent2`/`--glow-color`, but DESIGN.md uses `--c-surface`/`--c-surface-lower`/`--c-border-strong`/`--c-text-secondary`/`--c-text-tertiary`/`--c-accent-secondary`/`--c-glow`
- Need to rename LandingView tokens to match DESIGN.md canonical names during promotion

### Source code analysis
- variables.css: 29 old tokens (light + dark), 0 --c-* tokens
- LandingView: declares 10 --c-* tokens + 2 gradient + 7 --pw-* tokens inside `.stage` scope
- layout.css: 16 old token usages — MUST be migrated
- base.css: 22 old token usages — NOT in scope (global base styles, used by all)
- code.css: 14 usages — NOT in scope (code highlighting)
- markdown.css: 13 usages — NOT in scope (markdown rendering)

### Old token usage counts (outside variables.css)
- EntryListView.vue: 64
- ApiKeyListView.vue: 30
- EntryDetailView.vue: 17
- NotFoundView.vue: 6
- layout.css: 16
- Non-scope components (18): BannerBar(5), ConfirmDialog(15), DiagramBlock(29), FileTree(3), FilterChip(4), HtmlViewer(11), ImageViewer(11), LoginDialog(16), MarkdownViewer(12), Pagination(18), ShareDialog(24), ShareManagementPanel(19), Toast(9), TocNav(4), TreeNodeItem(7), MermaidRenderer(10), SvgRenderer(10), PlantUmlRenderer(10)

### D2 --bg-primary mapping analysis
- Page background (entry-list, apikey-page): → `--c-bg`
- Card/dialog/dropdown background: → `--c-surface`
- Button background: → `--c-surface` (not --c-bg)

## 2026-06-29 Design Decisions

### Token naming: LandingView → DESIGN.md canonical
| LandingView .stage | DESIGN.md canonical | Notes |
|---|---|---|
| --c-bg | --c-bg | Same |
| --c-panel | --c-surface | Rename |
| --c-panel2 | --c-surface-lower | Rename |
| --c-border | --c-border | Same |
| --c-border2 | --c-border-strong | Rename |
| --c-text | --c-text | Same |
| --c-muted | --c-text-secondary | Rename |
| --c-faint | --c-text-tertiary | Rename |
| --c-accent | --c-accent | Same |
| --c-accent2 | --c-accent-secondary | Rename |
| --c-hero-grad | --c-hero-grad | Landing-only, keep |
| --c-cta-grad | --c-cta-grad | Landing-only, keep |
| --glow-color | --c-glow | Rename |
| --pw-* | --pw-* | Landing-only, keep |

### base.css scope decision
base.css uses 22 old tokens (global reset, scrollbar, buttons, links). These are shared across ALL pages including LandingView. Two options:
1. Migrate base.css to --c-* tokens → All pages benefit, but LandingView must work
2. Leave base.css → Inconsistent global styles

Decision: **Migrate base.css**. Since we're promoting --c-* to global, base.css can use them. The .stage scope in LandingView will still override for LandingView-specific visual tweaks if needed (but with token alignment, no override needed).

### layout.css scope
layout.css is imported by EntryDetailView.vue. It uses 16 old tokens. Must migrate.

### Non-scope CSS files
- code.css (14 usages) → NOT in scope. Used by CodeViewer which is not being refactored.
- markdown.css (13 usages) → NOT in scope. Used by MarkdownViewer which is not being refactored.

These will continue working via old token aliases.

## 2026-06-29 P2 Design Complete

### Output
- `/home/kity/oclab/peekview/docs/tasks/T028-frontend-design-system-refactor/P2-design.md` (643 lines)

### Key design decisions
1. Token promotion: LandingView `.stage` → `variables.css` `[data-theme]`, with canonical name renames
2. Old token aliasing: 29 old tokens → `var(--c-*)` references in `[data-theme]` blocks
3. D2 handling: `--bg-primary` alias = `var(--c-bg)` (page bg), manual override to `var(--c-surface)` for card/dialog contexts
4. New utility tokens: `--c-tag-bg`, `--c-badge-{public,private,shared}-bg` for BaseTag/BaseBadge
5. base.css + layout.css in scope (not just pages)
6. LandingView: delete non-scoped `.stage` rules, rename tokens in scoped, keep Landing-only tokens in scoped `.stage`
7. 4 implementation phases: tokens → components → pages → cleanup
8. No [SCOPE+] discovered during design
