# PeekView Design System

This document records **design decisions** — why we chose these rules and what they are. Implementation details (token values, pixel specs, CSS variable names) live in code. When a component's padding changes, this document should not.

**Single source of truth for tokens**: `frontend-v3/src/styles/variables.css`
**Single source of truth for component specs**: component `.vue` files

---

## 1. Visual Theme & Atmosphere

PeekView is a **developer-native, self-hosted rendering layer** for AI agent output. The interface should feel like a polished developer tool: precise, trustworthy, and slightly technical — not like a consumer app or a generic SaaS dashboard.

### Key Attributes
- **Clean**: No visual noise. Every element earns its place.
- **Technical**: Monospace for code, file paths, IDs, and meta.
- **Focused**: Clear visual hierarchy; the content (code, docs, diagrams) is the star.
- **Trustworthy**: Stable layouts, consistent spacing, accessible contrast.
- **Dual-theme**: Neither theme feels like an afterthought.

### Density
- **Marketing surfaces** (landing): generous whitespace, large type, centered composition.
- **Functional surfaces** (explore, detail, settings): medium density, compact but breathable, information-forward.

### Signature Elements
- Hero gradient text on the landing page.
- Monospace eyebrows with a glowing dot.
- Subtle blue radial glow behind the landing hero.
- Faint CSS grid background on the landing page only.

---

## 2. Color Roles

This section defines what each color *means* and *why*. The complete token registry with exact values lives in `frontend-v3/src/styles/variables.css`.

### Primary Accents
| Role | Token | Usage |
|------|-------|-------|
| Primary accent | `--c-accent` | CTAs, links, active states |
| Secondary accent / hover | `--c-accent-secondary` | Hover states, emphasis |
| Glow | `--c-glow` | Primary button shadow, focus rings |

### Neutral Surfaces
| Role | Token | Semantic Alias | Usage |
|------|-------|---------------|-------|
| Page background | `--c-bg` | `--bg-primary` | Deepest layer |
| Card / panel surface | `--c-surface` | `--bg-secondary` | Elevated containers |
| Nested surface / input | `--c-surface-lower` | `--bg-tertiary` | Recessed areas, code blocks |
| Subtle border | `--c-border` | `--border-color` | Dividers |
| Strong border | `--c-border-strong` | — | Button borders, focused outlines |

### Text
| Role | Token | Semantic Alias | Usage |
|------|-------|---------------|-------|
| Primary text | `--c-text` | `--text-primary` | Body, headings |
| Secondary text | `--c-text-secondary` | `--text-secondary` | Descriptions, labels |
| Tertiary text | `--c-text-tertiary` | `--text-tertiary` | Meta, placeholders, disabled |
| Text on accent | — | `--text-on-accent` | White text on colored backgrounds |

### Semantic Status
| Role | Color Token | Background Token | Usage |
|------|------------|-----------------|-------|
| Success | `--c-success` | `--success-bg` | Success, active, copied |
| Warning | `--c-warning` | `--warning-bg` | Warnings, expired |
| Error | `--c-error` | `--error-bg` | Errors, delete actions |

### Color Proportions
- **60%** background / surface
- **30%** text
- **10%** accent and status

> **Token registry**: All token values (dark and light) are defined in `frontend-v3/src/styles/variables.css`. This section defines the color roles, token names, and semantic alias mapping only.

---

## 3. Typography Rules

### Font Families
- **Primary UI**: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`
- **Monospace**: `'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace`

### Type Scale

| Name | Size | Weight | Font | Usage |
|------|------|--------|------|-------|
| Hero Display | 76px / 48px mobile | 700 | UI | Main landing headline (gradient) |
| Section Headline | 38px / 28px mobile | 700 | UI | Section titles |
| Page Title | 28px | 600 | UI | View titles (Explore, Settings) |
| Card Title | 18px | 600 | UI | Card and list-item titles |
| Hero Body | 19px | 400 | UI | Hero description |
| Body Large | 17px | 400 | UI | Lead paragraphs |
| Body | 14px | 400 | UI | Default text |
| Caption | 13px | 400 | UI | Helper text |
| Eyebrow | 12px | 500 | Mono | Uppercase section labels |
| Code / Command | 13px | 400 | Mono | Commands, file paths, inline code |
| Meta | 12px | 400 | Mono | Timestamps, IDs, version strings |

### Gradient Text
- Hero headline uses a vertical gradient from bright to muted text color.

---

## 4. Layout Principles

### Base Unit
- **4px**. All padding, margins, gaps, and sizes should be multiples of 4px (except 1px borders).

> **Spacing tokens** (`--space-1` through `--space-7`) and **layout dimension tokens** (`--header-height`, `--sidebar-width`, `--toc-width`) are defined in `frontend-v3/src/styles/variables.css`.

### Container
- **Max width**: 1120px for marketing; 1280px for functional views.
- **Padding**: 32px desktop, 16px mobile.
- **Centered** with `margin: 0 auto`.
- **Exception**: the detail page's `.content-area` intentionally uses `var(--space-3) var(--space-2)` (12px/8px) on mobile instead of the 16px general rule — kept deliberately tight because `MarkdownViewer` and `EntryMetaTagsBar` each add their own inner padding on top of it (see "Markdown Body Spacing (Mobile)" and "Meta Tags Bar (Mobile)" below), bringing the effective total inset to 24px. This is a scoped, deliberate override, not a violation of the general container rule.

### Grid
- **Landing page**: centered hero; 2-column feature cards; 3-column format cards.
- **Explore page**: responsive card grid, 1-3 columns depending on viewport.
- **Detail page**: three-pane layout on desktop (file tree + viewer + TOC), single column on mobile.

### Z-Index Scale
| Layer | Z-index | Usage |
|-------|---------|-------|
| Base content | 0 | Normal flow |
| Sticky elements / tooltips | 10 | Sticky headers, icon-btn tooltips |
| Drawer overlay / Dropdowns | 100 | Drawer backdrop, overflow menu dropdown |
| Drawer panel | 101 | Drawer content |
| Modal backdrop | 200 | Dialog backdrop |
| Modal content | 210 | Dialog content |
| Toasts | 300 | Toast notifications |

---

## 5. Depth & Elevation

### Elevation Hierarchy
| Element | Elevation behavior |
|---------|-------------------|
| Primary button | Glow shadow (`--c-glow`) |
| Interactive card hover | Lift + shadow increase |
| Panel / card | Medium shadow |
| Modal | Deep shadow + backdrop |
| Preview window (landing only) | Deepest shadow |

> **Shadow tokens** (`--shadow-sm`, `--shadow-md`) are defined in `frontend-v3/src/styles/variables.css`.

---

## 6. Component & Pattern Rules

This section defines which components exist, what variants they support, and behavioral rules. Pixel-level specs belong in component code.

### Buttons
- All buttons use `BaseButton` component. Variants: **primary**, **secondary**, **ghost**, **danger**. Sizes: default, small. No new variants without design review.
- Primary buttons have a glow shadow effect.
- When `href` prop is provided, renders as `<a>` with button styling.

### Icon Buttons
- Use `.icon-btn` (square) or `.toggle-btn` (with active state). Tooltip on hover.
- Toggle badge: small dot indicator on top-right corner.
- Selection rule: a persistent-state icon action (has an on/off state the user needs to perceive, e.g. wrap toggle, source view toggle) uses `.toggle-btn`; a stateless one-shot action (e.g. copy) uses `.icon-btn`; any action with a text label uses `BaseButton`. Do not invent new button variants (e.g. a bespoke `.bottom-btn`) to sidestep this rule — see "Buttons" above ("No new variants without design review").

### Tags
- Use `BaseTag` component. Clickable tags must navigate to `/explore?tags=<encoded>`. Non-clickable tags only on entry detail page.
- When `href` prop is provided, renders as `<a>` with tag styling.

### Status Badges
- Use `BaseBadge`. Variants: **public**, **private**, **shared**, **archived**, **expired**.

### Filter Chips
- Use `FilterChip`. Pill shape (border-radius: 999px). Dismissable.

### Modals / Dialogs
- Use `ConfirmDialog` or custom modal. Must have `alertdialog` role when confirming destructive actions.

### Toast Notifications
- Position top-center, auto-dismiss 3s (error toasts stay until manually dismissed). Full border colored by type. Use `useToast` composable.

### Overflow Menus
- Dropdown on desktop, bottom sheet on mobile. Use `OverflowMenu` component.

### File Tree
- `FileTree` component on desktop, drawer on mobile.

### TOC Navigation
- `TocNav` component on desktop, drawer on mobile.

### Content Viewers
- `CodeViewer` (Shiki), `MarkdownViewer`, `DiagramBlock`, `ImageViewer`, `HtmlViewer`.

### Entry Display
- `EntryCard` (grid view), `EntryListRow` (list view).
- Hover-reveal owner actions on desktop, **always visible on touch**.
- Archived entries: dimmed (opacity 0.6).

### Cards
- Interactive cards: hover border-color accent, lift, shadow increase, 250ms transition.

### Tabs
- Explore filter tabs: flat filter row (All / Mine / Teams / Archived / Starred), horizontally scrollable on narrow viewports (<768px, `overflow-x: auto`, no wrap/stacking), each tab's tap target ≥44px tall. Tab bar carries `role="tablist"` semantics with arrow-key navigation.
- Other tabbed sections (e.g. Settings) may use stacked vertical sections on mobile as appropriate.

### Search
- Search input with left-aligned icon, clear button when value present.

### Entry State Banners
- Expired / archived: warning-surface background with appropriate icon.

### Zen Mode
- Keyboard shortcut `f` to enter, `Escape` to exit. Hides all chrome — only content area remains at full width.

### Navigation & Auth State
- Anonymous: "Sign in" button. Primary variant on marketing pages, secondary on functional pages (desktop), ghost on functional pages (mobile).
- Authenticated: avatar + username trigger → user menu (Settings, Teams, Logout). Admin badge pill when `is_admin`.
- Same menu content across all pages.

### Drawers (Mobile)
- File tree: left drawer. TOC: right drawer. Overlay backdrop, swipe-to-dismiss.

### Meta Tags Bar (Mobile)
- On mobile detail page, the metadata/tags bar (`EntryMetaTagsBar`) is a normal in-flow element rendered as the first child of `.content-area`, scrolling together with the viewer content. Visibility is determined purely by scroll position in the document flow — no independent show/hide toggle bound to scroll direction.
- Content wraps naturally (`flex-wrap: wrap`) rather than forcing a single line with horizontal scroll — the bar grows taller instead of clipping or scrolling horizontally when username + timestamp + read count + visibility badge + tags exceed the viewport width. Padding: `var(--space-4) var(--space-4)` (16px/16px).

### Markdown Body Spacing (Mobile)
- Desktop: `.markdown-body` uses `padding: var(--space-5)` (24px), centered with `max-width: 900px`.
- Mobile (≤640px): `.markdown-body` has `margin: 0; padding: var(--space-4)` (16px). This stacks with `.content-area`'s mobile horizontal padding (`var(--space-2)`, 8px) for a total inset of 24px per side, deliberately restored after the zero-padding version produced a cramped, edge-to-edge reading experience. Using padding only (no margin) avoids the triple-layer stacking (content-area + margin + padding, ~40px) that a margin-based approach would reintroduce, since `.content-area` is not a flex container and adjacent block-level margins would collapse unpredictably.

### HTML Viewer Security
- Sandboxed iframe: `sandbox="allow-scripts allow-forms"` — **no `allow-same-origin`**. Opaque origin cannot access main page credentials.

---

## 7. Iconography

- **Library**: Lucide (`lucide-vue-next`).
- **Style**: Line icons, 1.5-2px stroke, rounded caps.
- **Sizes**: 16px (inline), 18px (compact buttons), 20px (buttons/lists), 24px (navigation), 48px (hero/empty states).
- **Color rules**: default inherit `--c-text`; active/selected `--c-accent`; decorative/meta `--c-text-tertiary`; success/error use semantic colors.

---

## 8. Motion

### Transition Speeds
- **Fast** (150ms): color, background, border changes
- **Medium** (250ms): transform, shadow, opacity
- **Slow** (350ms): modal/overlay appearance

### Motion Preferences
- Respect `prefers-reduced-motion: reduce` — disable transforms and shimmers.

> **Transition tokens** (`--transition-fast`, `--transition-medium`) are defined in `frontend-v3/src/styles/variables.css`.

---

## 9. Responsive Behavior

### Breakpoints
| Name | Range | Layout |
|------|-------|--------|
| Mobile | <= 640px | Single column, bottom bars, drawers |
| Tablet | 641px-1023px | Hybrid: some sidebars hidden, some visible |
| Desktop | >= 1024px | Full multi-pane layout |

### Rules
- Multi-column grids collapse to 1 column on mobile.
- Navigation: hide secondary links on mobile, keep brand + theme toggle + primary CTA.
- Touch targets: minimum 44px.
- Hover-only action buttons must be visible on touch devices.
- Detail page: file tree → dropdown selector on mobile; TOC → right drawer on mobile; primary actions → fixed bottom bar on mobile (`position: fixed; bottom: 0`, `padding: var(--space-1) var(--space-3)` with `padding-bottom: calc(var(--space-1) + env(safe-area-inset-bottom, 0px))` — additive rather than replacing the base padding, so padding-top and padding-bottom stay symmetric (4px/4px) on devices without a safe area, and gain the safe-area inset on top of the 4px base where one exists; `.content-area` reserves matching bottom clearance via `--mobile-bar-height`).
- Sticky headers on mobile: translucent background + backdrop blur.
- Overflow menus: dropdown on desktop, bottom sheet on mobile.
- Settings: horizontal tabs on desktop, stacked sections on mobile.

### Scroll Architecture

- Detail page `.content-area` is the **sole vertical scroll container**.
- Viewer components (MarkdownViewer, CodeViewer) must **not** declare `overflow-y: auto` or `height: 100%` — content flows naturally and `.content-area` handles scrolling.
- CodeViewer retains `overflow-x: auto` for horizontal code scrolling.
- HtmlViewer and ImageViewer are exceptions: they use `height: 100%; overflow: hidden` to fill `.content-area` without stealing scroll (iframe/image internal scroll is isolated).
- `scroll-margin-top: 80px` on headings is calibrated for `.content-area` as the scroll container (matches sticky header height).

---

## 10. Accessibility

- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text.
- All interactive elements must have visible focus indicators.
- Use semantic HTML: `<nav>`, `<main>`, `<section>`, `<button>` for actions.
- Form inputs must have associated `<label>` or `aria-label`.
- Color alone must not convey meaning; pair with icons or text.
- Respect `prefers-reduced-motion`.
- Confirm dialogs use `alertdialog` role with `aria-labelledby`.

---

## 11. Content Guidelines

### Terminology
| Use | Don't use |
|-----|-----------|
| Sign in | Login |
| Entry | Snippet, Page |
| Settings | Profile, Account |
| API Keys | Tokens, Credentials |

### Dates & Times
- Relative time ("5m ago") for recent entries.
- Absolute date for older entries.

### Error Messages
- Describe what happened + what to do. Never just "Error" or a raw code.

---

## 12. Do's and Don'ts

### Do
- Use semantic alias tokens (`--bg-*`, `--text-*`, `--border-*`, `--accent-*`) in component code. Primitive tokens (`--c-*`) are for defining semantic aliases in `variables.css` only.
- Follow the 4px base grid for spacing, sizing, and radii.
- Test every change in both dark and light themes.
- Use monospace for code, commands, file paths, IDs, and eyebrows.
- Keep functional views compact and scannable.
- Add visible focus rings for keyboard users.
- Use Lucide icons consistently.

### Don't
- Use hard-coded hex colors outside the token system.
- Use `color-mix()` in component styles — prefer pre-defined tokens.
- Duplicate token values or component specs in DESIGN.md — `variables.css` and component code are the single source of truth.
- Add playful illustrations, emojis in primary UI, or decorative gradients beyond the hero.
- Break the dark-theme-first assumption.
- Use spacing values that are not multiples of 4px (except 1px borders).
- Animate content entrances in data-dense views.
- Use color alone to indicate status.
