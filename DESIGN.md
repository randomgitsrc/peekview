# PeekView Design System

## Agent Quick Reference

**Project context**: Vue 3 + Vite + TypeScript. Scoped `<style>` blocks preferred; global tokens live in `frontend-v3/src/styles/variables.css`. No Tailwind. Lucide icons via `lucide-vue-next`.

**Base unit**: 4px. **Fonts**: Inter (UI), JetBrains Mono (code/meta). **Icon library**: Lucide.

**Theme switcher**: `data-theme="dark"` / `data-theme="light"` on `<html>`. All color tokens are theme-aware.

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

## 2. Color Palette & Roles

### Primary Accents
| Role | Dark | Light |
|------|------|-------|
| Primary accent | `#4d8dff` | `#0969da` |
| Secondary accent / hover | `#76a6ff` | `#0550ae` |
| Glow | `rgba(77,141,255,.20)` | `rgba(9,105,218,.10)` |

### Neutral Surfaces
| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--c-bg` | `#0a0d13` | `#f6f8fa` | Page background |
| `--c-surface` | `#121822` | `#ffffff` | Cards, modals, panels |
| `--c-surface-lower` | `#0e131b` | `#eef0f3` | Nested surfaces, inputs, code blocks |
| `--c-border` | `rgba(255,255,255,.08)` | `rgba(0,0,0,.08)` | Subtle dividers |
| `--c-border-strong` | `rgba(255,255,255,.13)` | `rgba(0,0,0,.13)` | Button borders, focused outlines |

### Text
| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--c-text` | `#e9eef4` | `#1f2328` | Primary text |
| `--c-text-secondary` | `#9aa7b4` | `#656d76` | Descriptions, labels |
| `--c-text-tertiary` | `#6a7682` | `#8c959f` | Meta, placeholders, disabled |

### Semantic Status
| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--c-success` | `#7ee787` | `#1a7f37` | Success, active, copied |
| `--c-warning` | `#febc2e` | `#9a6700` | Warnings |
| `--c-error` | `#ff7b72` | `#cf222e` | Errors, delete actions |

### Color Proportions
- **60%** background / surface
- **30%** text
- **10%** accent and status

### Specialized Preview Window Tokens
These describe the embedded "PeekView window" mockup on the landing page only:

| Token | Dark | Light | Role |
|-------|------|-------|------|
| `--pw-bg` | `#0d1117` | `#ffffff` | Window background |
| `--pw-bar` | `#161b22` | `#f3f4f6` | Title bar |
| `--pw-tree` | `#11161e` | `#f9fafb` | File tree |
| `--pw-border` | `rgba(255,255,255,.08)` | `rgba(0,0,0,.08)` | Window border |
| `--pw-text` | `#e9eef4` | `#1f2328` | Preview text |
| `--pw-meta` | `#6a7682` | `#8c959f` | Preview meta |
| `--pw-muted` | `#9aa7b4` | `#656d76` | Preview muted |

---

## 3. Typography Rules

### Font Families
- **Primary UI**: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`
- **Monospace**: `'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace`

### Type Scale

| Name | Size | Weight | Line Height | Letter Spacing | Font | Usage |
|------|------|--------|-------------|----------------|------|-------|
| Hero Display | 76px / 48px mobile | 700 | 1.02 | -0.035em | UI | Main landing headline (gradient) |
| Section Headline | 38px / 28px mobile | 700 | 1.1 | -0.025em | UI | Section titles |
| Page Title | 28px | 600 | 1.2 | -0.02em | UI | View titles (Explore, Settings) |
| Card Title | 18px | 600 | 1.3 | -0.01em | UI | Card and list-item titles |
| Hero Body | 19px | 400 | 1.6 | -0.01em | UI | Hero description |
| Body Large | 17px | 400 | 1.6 | 0 | UI | Lead paragraphs |
| Body | 14px | 400 | 1.6 | 0 | UI | Default text |
| Caption | 13px | 400 | 1.5 | 0 | UI | Helper text |
| Eyebrow | 12px | 500 | 1 | 0.18em | Mono | Uppercase section labels |
| Code / Command | 13px | 400 | 1.75 | 0 | Mono | Commands, file paths, inline code |
| Meta | 12px | 400 | 1.5 | 0 | Mono | Timestamps, IDs, version strings |

### Gradient Text
- **Hero headline**: `linear-gradient(180deg, #ffffff 30%, #b9c6d4 100%)` on dark; `linear-gradient(180deg, #1f2328 30%, #656d76 100%)` on light.
- Implementation: `background-clip: text` + `-webkit-text-fill-color: transparent`.

---

## 4. Layout Principles

### Base Unit & Spacing
- **Base unit**: 4px.
- **Spacing scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128px.
- All padding, margins, gaps, and sizes should be multiples of 4px (except 1px borders).

### Container
- **Max width**: 1120px for marketing; 1280px for functional views.
- **Padding**: 32px desktop, 16px mobile.
- **Centered** with `margin: 0 auto`.

### Grid
- **Landing page**: centered hero; 2-column feature cards; 3-column format cards.
- **Explore page**: responsive card grid, 1–3 columns depending on viewport.
- **Detail page**: two-pane layout on desktop (file tree + viewer), single column on mobile.

### Z-Index Scale
| Layer | Z-index |
|-------|---------|
| Base content | 0–10 |
| Sticky headers | 50 |
| Dropdowns / popovers | 100 |
| Modal backdrop | 200 |
| Modal content | 210 |
| Toasts | 300 |

---

## 5. Depth & Elevation

| Element | Shadow / Elevation |
|---------|-------------------|
| Primary button | `0 6px 20px var(--c-glow)` |
| Interactive card hover | `0 6px 20px rgba(0,0,0,.08)` + `translateY(-2px)` |
| Panel / card | `0 4px 12px rgba(0,0,0,.06)` |
| Modal | `0 24px 48px rgba(0,0,0,.24)` + backdrop `rgba(0,0,0,.5)` |
| Preview window (landing only) | `0 40px 90px -30px rgba(0,0,0,.3)` |

---

## 6. Component Stylings

### Button

**Primary**
- Background: `--c-accent`; text: white
- Height: 40px; padding: 0 18px; radius: 8px
- Font: 14px / 600 / UI font
- Shadow: `0 6px 20px var(--c-glow)`
- Hover: background `--c-accent-secondary`
- Focus: `outline: 2px solid var(--c-accent-secondary); outline-offset: 2px`
- Disabled: opacity 0.5, cursor not-allowed

**Secondary / Ghost**
- Background: transparent; text: `--c-text`
- Border: 1px solid `--c-border-strong`
- Hover: background `--c-border`; border-color `--c-text-tertiary`

**Danger**
- Background: `--c-error`; text: white
- Hover: darken 10%

**Small**
- Height: 34px; padding: 0 14px; font: 13px

**Icon Button**
- 36px square; radius 8px; centered icon; transparent bg; hover `--c-border`

### Eyebrow
- Inline-flex, gap 10px
- Dot: 6px circle, `--c-accent`, subtle glow
- Text: 12px / uppercase / 0.18em spacing / mono / `--c-accent-secondary`

### Card / Panel
- Background: `--c-surface`
- Border: 1px solid `--c-border-strong`
- Border-radius: 14px
- Padding: 24px (default), 32px (large)
- Interactive cards: hover border-color `--c-accent`, lift 2px, 250ms transition

### List Item
- Padding: 16px
- Border-bottom: 1px solid `--c-border`
- Hover: background `--c-surface-lower`
- Title: 16px / weight 600; meta: 13px / `--c-text-tertiary`

### Tag / Badge
- Background: `rgba(77,141,255,.14)` dark / `rgba(9,105,218,.1)` light
- Text: `--c-accent-secondary`
- Radius: 6px; padding: 4px 10px
- Font: 12px mono

### Status Badge
| State | Background | Text |
|-------|------------|------|
| Public | `rgba(126,231,135,.15)` | `--c-success` |
| Private | `rgba(255,123,114,.15)` | `--c-error` |
| Shared | `rgba(254,188,46,.15)` | `--c-warning` |

### Command Line Snippet
- Background: `--c-surface-lower`; border: 1px solid `--c-border-strong`
- Radius: 8px; height: 40px; padding: 0 8px 0 16px
- Font: 13.5px mono; prompt `$`: `--c-accent-secondary`
- Copy button: 26px square; `--c-text-tertiary`; hover `--c-text` on `--c-border`

### Input / Textarea
- Background: `--c-surface-lower`; border: 1px solid `--c-border`
- Radius: 8px; padding: 10px 12px; font: 14px
- Focus: border-color `--c-accent`; ring `0 0 0 3px var(--c-glow)`
- Placeholder: `--c-text-tertiary`

### Search Input
- Same as Input, but with left-aligned search icon (16px, `--c-text-tertiary`)
- Clear button on the right when value present

### Select / Dropdown
- Same as Input for trigger
- Dropdown panel: `--c-surface`, border `--c-border-strong`, radius 8px, shadow `0 8px 24px rgba(0,0,0,.16)`
- Option hover: `--c-surface-lower`

### Tabs
- Horizontal row of text tabs
- Active: text `--c-text`, bottom border 2px `--c-accent`
- Inactive: text `--c-text-secondary`, hover `--c-text`
- Gap between tabs: 24px

### File Tree
- Background: `--c-surface-lower`
- Item: padding 8px 12px, radius 6px, mono 13px
- Hover: `--c-border` background
- Active: background `rgba(77,141,255,.14)`, text `--c-accent`
- Chevron / folder icon: `--c-text-tertiary`

### Action Bar
- Background: `--c-surface`; border-bottom: 1px solid `--c-border`
- Padding: 12px 24px
- Left: title/breadcrumbs; right: action buttons

### Modal / Dialog
- Backdrop: `rgba(0,0,0,.5)` with blur(4px)
- Content: `--c-surface`, radius 14px, padding 24px, max-width 480px
- Header: title 18px / 600; close button top-right
- Footer: right-aligned buttons

### Toast
- Background: `--c-surface`; border: 1px solid `--c-border-strong`
- Radius: 10px; padding: 14px 16px
- Shadow: `0 12px 28px rgba(0,0,0,.2)`
- Position: bottom-right, stacked with 12px gap
- Success accent border-left: 3px `--c-success`
- Error accent border-left: 3px `--c-error`

### Empty State
- Centered, max-width 480px
- Icon: 48px Lucide, `--c-text-tertiary`
- Heading: 20px / 600
- Description: 14px `--c-text-secondary`
- CTA: primary button below

### Skeleton
- Background: `--c-border`; radius 6px
- Shimmer animation: gradient sweep from `--c-border` to `--c-surface-lower` and back
- Use for loading lists and cards

### Entry List Row
- Full-width row inside a bordered panel
- Desktop: `grid-template-columns: 1fr auto`, title/summary/tags on left, badge + actions on right
- Mobile (<= 640px): single column, badge + actions row below the content
- Padding: 16px 24px; border-bottom: 1px solid `--c-border`
- Hover: background `--c-surface-lower`
- Title: 16px / 600; summary: 14px `--c-text-secondary` (single-line truncate); tags + date inline below
- **Important**: hover-only action buttons must always be visible on touch devices

### Entry Meta Row
- Inline-flex with 8px gap
- Avatar: 28px circle, `--c-accent` bg, white text, mono font
- Text: 13px `--c-text-secondary`
- Separator: 3px dot, `--c-text-tertiary`
- Combine: avatar + username + dot + timestamp + dot + badge

### Stats Bar
- Grid with equal columns; border-top: 1px solid `--c-border`
- Stat value: 18px / 700 / mono
- Stat label: 11px uppercase / 0.08em spacing / `--c-text-tertiary`
- Use for file counts, views, downloads

### Sticky Header (Mobile)
- Height: 56px; padding: 0 12px
- Background: `rgba(10,13,19,.85)` dark / `rgba(246,248,250,.9)` light
- `backdrop-filter: blur(12px)`
- Border-bottom: 1px solid `--c-border`
- Left: back button; center: truncated title; right: action icon

### File Dropdown / Selector
- Trigger: full-width row, padding 10px 16px, `--c-surface` bg, border-bottom
- Left: chevron icon (rotates when open); center: current filename (mono); right: file count
- Panel: `--c-surface-lower`, max-height 240px, scrollable
- Item: padding 12px 16px, mono 13px, `--c-text-secondary`; active/hover: accent bg + color

### Bottom Action Bar (Mobile)
- Fixed to bottom; safe-area-inset aware
- Padding: 10px 16px; gap: 10px
- Buttons: 44px height, flex 1, radius 10px
- Primary + Ghost pair recommended

### Floating Action Button (FAB)
- 44px circle; `--c-surface`; border `--c-border-strong`
- Shadow: `0 4px 16px rgba(0,0,0,.2)`
- Position: bottom-right with margin from viewport edges
- Use for single global actions (e.g., theme toggle)

---

## 7. Iconography

- **Library**: Lucide (`lucide-vue-next`).
- **Style**: Line icons, 1.5–2px stroke, rounded caps.
- **Sizes**:
  - 16px: inline text, input icons
  - 20px: buttons, list items
  - 24px: navigation, empty states
  - 48px: hero/feature illustrations
- **Color rules**:
  - Default: inherit `--c-text`
  - Active/selected: `--c-accent`
  - Decorative/meta: `--c-text-tertiary`
  - Success/error: `--c-success` / `--c-error`

---

## 8. Motion

### Transitions
- **Fast**: 150ms ease (color, background, border)
- **Medium**: 250ms ease (transform, shadow, opacity)
- **Slow**: 350ms ease (modal/overlay appearance)

### Interactions
- **Button hover**: background-color change 150ms
- **Card hover**: translateY(-2px) + shadow 250ms
- **Link hover**: color change 150ms
- **Focus ring**: instant, no transition

### Loading
- **Skeleton shimmer**: 1.5s infinite linear gradient animation
- **Spinner**: rotate 360deg over 1s linear infinite

### Motion Preferences
- Respect `prefers-reduced-motion: reduce` by disabling transforms and shimmers.

---

## 9. Responsive Behavior

### Breakpoints
- Mobile: <= 640px
- Tablet: 641px–1024px
- Desktop: > 1024px

### Rules
- Hero display: 48px on mobile, 76px desktop
- Page title: 24px mobile, 28px desktop
- Section headline: 28px mobile, 38px desktop
- Container padding: 16px mobile, 32px desktop
- Multi-column grids collapse to 1 column on mobile
- Navigation: hide secondary links on mobile, keep brand + theme toggle + primary CTA
- Touch targets: minimum 44px
- Entry list rows collapse from horizontal to vertical stack on mobile
- Hover-only action buttons must be visible on touch devices
- Detail page: file tree becomes a dropdown selector on mobile
- Detail page: primary actions move to a fixed bottom bar on mobile
- Sticky headers on mobile use translucent background + backdrop blur

---

## 10. Accessibility

- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text.
- All interactive elements must have visible focus indicators.
- Use semantic HTML: `<nav>`, `<main>`, `<section>`, `<button>` for actions.
- Form inputs must have associated `<label>` or `aria-label`.
- Color alone must not convey meaning; pair with icons or text.
- Respect `prefers-reduced-motion`.

---

## 11. Do's and Don'ts

### Do
- ✅ Use `--c-*` token variables for every color.
- ✅ Follow the 4px base grid for spacing, sizing, and radii.
- ✅ Test every change in both dark and light themes.
- ✅ Use monospace for code, commands, file paths, IDs, and eyebrows.
- ✅ Keep functional views compact and scannable.
- ✅ Add visible focus rings for keyboard users.
- ✅ Use Lucide icons consistently.

### Don't
- ❌ Use hard-coded hex colors outside the token system.
- ❌ Add playful illustrations, emojis in primary UI, or decorative gradients beyond the hero.
- ❌ Break the dark-theme-first assumption.
- ❌ Use spacing values that are not multiples of 4px (except 1px borders).
- ❌ Animate content entrances in data-dense views.
- ❌ Use color alone to indicate status.

---

## 12. Page Patterns

### Landing Page
- Full-width dark background with subtle glow + grid.
- Centered hero with gradient headline, monospace eyebrow, command-line CTA.
- 2-column "two front doors" cards (CLI + MCP).
- 3-column format showcase cards with hover lift.
- Footer with minimal links.

### Explore / List Page
- Light `--c-bg` background.
- Sticky action bar at top with page title, meta, and primary CTA.
- Search input + filter chips + sort dropdown.
- Either a card grid (1–3 columns) or an entry list inside a bordered panel.
- Entry list row: title/summary/tags on left, badge + actions on right; collapses to stacked layout on mobile.
- Each entry: title, summary, tags, visibility badge, timestamp, owner.
- Empty state when no results.

### Detail Page
**Desktop:**
- Two-pane layout: file tree (240px) + viewer.
- Action bar with entry title, visibility, copy link, download.
- Tabbed or stacked viewer for the selected file.
- Rendered output takes full remaining width.

**Mobile:**
- Sticky translucent header with back button, truncated title, share action.
- Entry header card: title, summary, author meta row, tags, stats bar.
- File dropdown selector instead of persistent file tree.
- Viewer with copy/raw actions.
- Fixed bottom action bar for primary actions (copy link, download).
- Optional floating action button for global toggles (theme).

### Settings / API Keys
- Card-based layout with grouped sections.
- Form inputs, primary save action, danger delete action.
- List of keys with copy/revoke actions.

---

## 13. Agent Prompt Guide

### General Prompt
> Build a [component/page] for PeekView using DESIGN.md. Use Vue 3 scoped CSS, `--c-*` tokens, Inter + JetBrains Mono fonts, and Lucide icons. Support dark and light themes. Keep spacing on the 4px grid, body text 14px, border-radius 6–14px. Primary accent `#4d8dff` dark / `#0969da` light.

### Functional View Prompt
> Make it compact and scannable. Use `--c-surface` cards with `--c-border-strong` borders, 16–24px padding, and hover lift. No hero gradients or background glow.

### Landing/Marketing Prompt
> Use the hero gradient text, centered layout, subtle radial glow, monospace eyebrow, and generous whitespace. One primary CTA with glow shadow.

### Component Request Prompt
> Build a [Button/Card/Modal/Toast/etc.] component matching DESIGN.md §6. Include default, hover, focus, active, and disabled states. Use only `--c-*` tokens.
