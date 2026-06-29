# T029 P4 Progress

## Input Read
- P0-brief.md: 3 items (tag fold, meta reorder, detail title 2-line), debug_env confirmed
- P1-requirements.md: 10 BDD ACs, tag threshold=3, +N pure static, packages=frontend-v3
- PAUSED-resolution.md: +N 纯静态无交互, tag 阈值 3
- EntryCard.vue: tags+metaText in same div, need to separate
- EntryListRow.vue: tags+meta in same row, need to separate
- layout.css: detail-header uses height: var(--header-height), need min-height
- variables.css: --header-height: 56px used in 6 places, only detail-header needs change
- BaseTag.vue: inline-flex, bg=--c-tag-bg, color=--c-accent-secondary, padding 4px 10px

## File 1: EntryCard.vue - DONE
- Template: separated tags from metaText into card-meta-text + card-tags divs
- Added tag overflow (+N) span with tag-overflow class
- Script: added TAG_LIMIT=3, visibleTags computed (slice 0..3), remainingTagCount computed
- Style: replaced .card-meta with .card-meta-text (standalone) + .card-tags (flex wrap) + .tag-overflow (matches BaseTag style with tertiary color)

## File 2: EntryListRow.vue - DONE
- Template: separated tags from entry-meta-row into own entry-tags-row div
- Added tag overflow (+N) span with tag-overflow class
- Script: added TAG_LIMIT=3, visibleTags, remainingTagCount
- Style: .entry-meta-row now only contains .entry-meta; new .entry-tags-row for tags + overflow; .tag-overflow same as EntryCard

## File 3: layout.css - DONE
- .detail-header: height → min-height, padding 0 → var(--space-3) top/bottom, align-items center → flex-start
- .detail-header .title: removed white-space:nowrap + text-overflow:ellipsis, added line-clamp:2 + -webkit-box + padding
- .detail-header .detail-logo: added align-self:center to stay centered when title is 2-line
- .detail-header .actions: added align-self:center + flex-shrink:0 to prevent wrapping

## File 4: variables.css - NO CHANGE
- --header-height: 56px kept as-is; detail-header now uses min-height instead of height, other consumers still need fixed height
