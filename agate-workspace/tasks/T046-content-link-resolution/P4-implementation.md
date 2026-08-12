---
phase: P4
task_id: T046
type: implementation
parent: P2-design.md
trace_id: T046-P4-20260704
status: done
agent: implementer
created: 2026-07-04
---

# T046 Content Link Resolution — P4 Implementation

## New Files

| File | Description |
|------|-------------|
| `frontend-v3/src/utils/path-map.ts` | Pure utility: `normalizeRef`, `buildPathMap`, `resolvePath`, `PathMapEntry`, `PathMap` types |

## Modified Files

| File | Changes |
|------|---------|
| `frontend-v3/src/composables/useMarkdown.ts` | Added `pathMap`/`slug` params to `render()`; `rewriteHtmlRefs()` helper; image rule override (src→content URL); link_open rule override (href→view URL + data-peekview-file-id); post-DOMPurify DOM walk; `data-peekview-file-id` in DOMPurify ADD_ATTR |
| `frontend-v3/src/components/MarkdownViewer.vue` | Added `pathMap`/`slug` props; `navigate-file` emit; `handleLinkClick` event delegation; pass pathMap/slug to render(); watch pathMap/slug changes |
| `frontend-v3/src/views/EntryDetailView.vue` | Added `pathMap` computed (buildPathMap from entry.files); `handleNavigateFile` handler; pass pathMap/slug to MarkdownViewer; listen @navigate-file |
| `frontend-v3/src/components/__tests__/MarkdownViewer.spec.ts` | Updated render() call expectations (4 args instead of 2) |

## Key Implementation Decisions

1. **normalizeRef skips `/api/v1/entries/`** — prevents double-rewrite of already-resolved API URLs
2. **normalizeRef adds `ftp:` to skip list** — test TC-BPM-08 requires it
3. **Absolute path `/tmp/x.png` → basename only (priority=3)** — not treated as exact path match; filename entry (priority=2) wins when available
4. **suppressFilenameKey** — when a file has an exact path match (priority=1) whose basename equals the filename, the filename entry is suppressed to avoid same-key conflicts across files (TC-BPM-05)
5. **buildPathMap accepts `PathMapFile` interface** (id, path, filename) instead of full `File` type — allows test partial objects without type errors
6. **Post-DOMPurify DOM walk** runs after sanitize, so rewritten URLs bypass DOMPurify (safe: only generates `/api/v1/entries/...` and `/{slug}?file={id}`)
7. **P2 backend (html_render_service.py) deferred** — marked as optional enhancement per task spec
