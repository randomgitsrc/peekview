# T028 P1 Progress Log

## 2026-06-29 — Input Reading

### P0-brief.md
- Task: unify visual language across functional pages using DESIGN.md `--c-*` tokens
- 4 pages to refactor: EntryListView, EntryDetailView, ApiKeyListView, NotFoundView
- LandingView is the baseline, NOT to be modified
- Out of scope: routes, API, state management, backend, MCP
- 7 shared components to create: BaseButton, BaseTag, BaseBadge, SearchInput, EmptyState, EntryListRow, PageHeader
- P3 TDD: keep; P6 UI: keep; P8 version bump: consider patch

### DESIGN.md
- Complete `--c-*` token system defined (dark + light themes)
- Component specs: Button (primary/secondary/ghost/danger/small/icon), Tag/Badge, Input/Search, Card/Panel, List Item, File Tree, etc.
- LandingView uses `--c-*` tokens scoped to `.stage`; functional pages use `--bg-primary`/`--text-primary` etc. (old Primer tokens)
- Key token mapping gap: `--c-accent` vs `--accent-color`, `--c-bg` vs `--bg-primary`, `--c-surface` vs `--bg-secondary`, etc.

### variables.css
- Old tokens: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--border-color`, `--border-hover`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent-color`, `--accent-hover`, `--accent-light`
- New tokens NOT present in variables.css (only in LandingView's scoped `.stage`)
- Spacing/layout tokens are shared and unchanged

### Current Source Code Analysis
- **EntryListView**: 362+ old-token refs across views + components. Card grid layout, search, owner tabs, footer
- **EntryDetailView**: Two-pane desktop + mobile drawer layout. Uses `@import layout.css` (which has old tokens)
- **ApiKeyListView**: Simpler page, uses its own dialog/modal (not shared LoginDialog)
- **NotFoundView**: Very simple (3 elements), minimal effort
- **LandingView**: Uses `--c-*` tokens scoped to `.stage` class — needs to be lifted to `:root` / `[data-theme]`

### Critical Finding: Components NOT in P0 scope also use old tokens
- 18 components use `--bg-primary`/`--text-primary`/`--border-color`/`--accent-color`
- layout.css (imported by EntryDetailView) uses old tokens extensively
- This means: if old tokens are removed from variables.css, ALL components break
- Solution: either keep old tokens as aliases, OR migrate ALL components (scope creep risk)

### Key Token Mapping (old → new)
| Old | New |
|-----|-----|
| `--bg-primary` | `--c-bg` (page bg) or `--c-surface` (card bg) — context dependent |
| `--bg-secondary` | `--c-surface` (cards) or `--c-surface-lower` (inputs) — context dependent |
| `--bg-tertiary` | `--c-surface-lower` (hover) — or specific hover state |
| `--text-primary` | `--c-text` |
| `--text-secondary` | `--c-text-secondary` |
| `--text-tertiary` | `--c-text-tertiary` |
| `--accent-color` | `--c-accent` |
| `--accent-hover` | `--c-accent-secondary` |
| `--accent-light` | `rgba` accent tint (no direct 1:1) |
| `--border-color` | `--c-border` |
| `--border-hover` | `--c-border-strong` |
| `--error-color` | `--c-error` |
| `--tag-bg` | `rgba(77,141,255,.14)` / `rgba(9,105,218,.1)` |
| `--tag-text` | `--c-accent-secondary` |

### Not 1:1 mapping issue
`--bg-primary` maps to DIFFERENT new tokens depending on context:
- Page background → `--c-bg`
- Card background (currently `--bg-secondary`) → `--c-surface`
This is not a simple find-replace.

## 2026-06-29 — P1 Requirements Written

### Key Findings
1. **18 components outside P0 scope still use old tokens** — must keep old variables as aliases or expand migration scope
2. **`--bg-primary` is not 1:1 mappable** — maps to `--c-bg` (page) or `--c-surface` (card) depending on context
3. **layout.css is imported by EntryDetailView** and contains many old tokens — must be migrated too
4. **LandingView tokens scoped to `.stage`** — must be lifted to global `:root` / `[data-theme]` without breaking LandingView
5. **Only 1 hard-coded hex in functional pages** (EntryDetailView `#aaa` fallback) — low risk

### BDD Count: 12 scenarios
### NEED_CONFIRM Count: 4 items
### Phases: P1-P6 + P8 (skip P7 — single package)
