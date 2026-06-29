---
phase: P4
task_id: T029-card-list-layout-polish
type: implementation
parent: P1-requirements.md
trace_id: T029-P4-20260630
status: draft
created: 2026-06-30
---

# T029 P4 Implementation Changes

## Changed Files

### 1. frontend-v3/src/components/EntryCard.vue

**Template changes:**
- Separated `card-meta` div into two: `card-meta-text` (meta line) and `card-tags` (tags line)
- Tags now use `visibleTags` (sliced to TAG_LIMIT=3) instead of `entry.tags`
- Added `v-if="entry.tags.length"` on card-tags div (0 tags = no render)
- Added `<span class="tag-overflow">+{{ remainingTagCount }}</span>` when remainingTagCount > 0

**Script changes:**
- Added `TAG_LIMIT = 3` constant
- Added `visibleTags` computed: `props.entry.tags.slice(0, TAG_LIMIT)`
- Added `remainingTagCount` computed: `Math.max(0, props.entry.tags.length - TAG_LIMIT)`

**Style changes:**
- Removed `.card-meta` (was flex wrap containing tags + meta text)
- `.card-meta-text`: added `margin-bottom: var(--space-2)` (standalone line)
- New `.card-tags`: flex wrap, gap, margin-bottom (replaces tag portion of old .card-meta)
- New `.tag-overflow`: matches BaseTag style (bg, radius, padding, font) with `--c-text-tertiary` color

### 2. frontend-v3/src/components/EntryListRow.vue

**Template changes:**
- `entry-meta-row` now contains only `<span class="entry-meta">{{ metaText }}</span>`
- New `entry-tags-row` div (v-if="entry.tags.length") with `visibleTags` + `tag-overflow`

**Script changes:**
- Added `TAG_LIMIT = 3`, `visibleTags`, `remainingTagCount` (same as EntryCard)

**Style changes:**
- `.entry-meta-row`: removed `gap` and `flex-wrap` (only contains text now)
- New `.entry-tags-row`: flex wrap, gap, margin-top (same as old .entry-meta-row but for tags only)
- New `.tag-overflow`: same style as EntryCard's

### 3. frontend-v3/src/styles/layout.css

**`.detail-header` changes:**
- `align-items: center` → `align-items: flex-start` (allows title to expand vertically)
- `padding: 0 var(--space-4)` → `padding: var(--space-3) var(--space-4)` (vertical breathing room)
- `height: var(--header-height)` → `min-height: var(--header-height)` (auto-expand for 2-line titles)

**`.detail-header .title` changes:**
- Removed `white-space: nowrap; text-overflow: ellipsis`
- Added `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden`
- Added `padding: var(--space-1) 0` (vertical centering within header)

**`.detail-header .detail-logo` changes:**
- Added `align-self: center` (stays centered when title is multi-line)

**`.detail-header .actions` changes:**
- Added `align-self: center; flex-shrink: 0` (stays centered, never wraps)

### 4. frontend-v3/src/styles/variables.css

No changes. `--header-height: 56px` kept as-is; `detail-header` now uses `min-height` instead of `height`.

## BDD Coverage Mapping

| AC | Covered By |
|----|-----------|
| AC-1 Card tag fold (desktop) | EntryCard: TAG_LIMIT=3, visibleTags, remainingTagCount |
| AC-2 Card tag fold (mobile) | Same logic applies; visual testing needed at 640px |
| AC-3 List row tag fold | EntryListRow: TAG_LIMIT=3, visibleTags, remainingTagCount |
| AC-4 Tag fold boundary ≤ threshold | Math.max(0, ...) ensures no +0 |
| AC-5 Tag fold boundary 0 tags | v-if="entry.tags.length" hides entire row |
| AC-6 Card meta reorder | EntryCard: title → card-meta-text → card-tags → card-footer |
| AC-7 List row meta reorder | EntryListRow: title → summary → entry-meta-row → entry-tags-row; badge right |
| AC-8 Detail title 2-line | layout.css: line-clamp:2, min-height |
| AC-9 Detail title short | min-height preserves 56px baseline |
| AC-10 Header buttons not squeezed | align-self:center + flex-shrink:0 on actions |
