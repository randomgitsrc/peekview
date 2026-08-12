---
phase: P4
task_id: T049-mobile-header-diagram-sanitize
type: implementation
parent: P2-design.md
trace_id: T049-P4-20260708
status: draft
created: 2026-07-08
agent: implementer
---

## Implementation Summary

### Step 1: Backend Config + CLI
- **config.py**: Added `PeekDiagram(BaseSettings)` class with `model_config` (env_prefix `PEEKVIEW_DIAGRAM__`) and `sanitize_enabled: bool = True` field. Registered `diagram: PeekDiagram` in `PeekConfig`.
- **api/config_router.py**: Added `PublicDiagramConfig(BaseModel)` + `GET /api/v1/config/diagram` endpoint.
- **cli.py**: Registered `"diagram.sanitize_enabled"` in `SUPPORTED_CONFIG_KEYS`, `CONFIG_KEYS_HELP`, bool type conversion (with validation - errors on invalid bool values), `_get_default()` diagram section, `_DESC` entry, `_SECTION_ORDER`.

### Step 2: Frontend API Client
- **api/types.ts**: Added `DiagramConfigResponse { sanitize_enabled: boolean }` interface.
- **api/client.ts**: Added `getDiagramConfig()` method returning `DiagramConfigResponse`.

### Step 3: Diagram Sanitize Module
- **utils/diagramSanitize.ts** (new): Register-based architecture with `registerRule()`, `sanitize()` (deterministic only), `sanitizeWithRetry()` (two-phase: deterministic → heuristic).
  - Built-in mermaid rules: normalize arrows (`->>` → `-->>`), strip leading whitespace (heuristic)
  - Built-in plantuml rules: ensure `@startuml`/`@enduml`, fix whitespace (heuristic)
  - Built-in svg rules: fix unquoted numeric attributes, close unclosed void tags

### Step 4: Error UI
- **useMermaid.ts**: Added `suppressErrors: true` to `mermaid.initialize()`.
- **MermaidRenderer.vue**: Catch in `renderDiagram()` now cleans `#dmermaid-{renderId}`. `exportPng()` wraps `mermaid.render()` in try-catch with DOM cleanup.
- **PlantUmlRenderer.vue**: Emit signature changed to `[err: unknown]`, passes error payload.
- **SvgRenderer.vue**: Emit signature changed to match, passes error.
- **DiagramBlock.vue**: Unified error UI with engine name + "Failed to render", collapsible details (v-show, textContent-safe), "查看源码" button. PlantUML no longer auto-switches to code mode.

### Step 5: Mobile Header
- **EntryDetailView.vue**: 
  - `visibleTags` computed based on real container overflow (iterates children measuring widths)
  - `remainingTagCount` = `tags.length - visibleTags.length`
  - Scroll handler (rAF-throttled, `if (window.innerWidth > 768) return;`)
  - `onMounted`: initial `recomputeOverflow()`, `checkScrollPosition()`, scroll/resize listeners
  - `onUnmounted`: cleanup
  - a11y: `aria-hidden`, `aria-label` on tag overflow indicator, dynamic header class
- **layout.css**: `position: sticky; top: 0; z-index: 10` on `.detail-header`, mobile `@media (max-width: 768px)` max-height/overflow/transition on `.header-tags`, `header-tags-hidden` class for scroll shrink, `prefers-reduced-motion: reduce` disables transition.

### Step 6: DiagramBlock Sanitize Integration
- `onMounted` fetches `diagramConfig` from API (fallback: enabled + `console.warn`)
- `applySanitize()` calls `sanitize()` before passing code to renderers
- `onRenderError` triggers `sanitizeWithRetry()` + re-render (if enabled)
- `retrying` flag prevents `hasError` flash during retry

### Tests Status
- Backend diagram config tests: 11/11 ✅
- Frontend diagramSanitize tests: 17/17 ✅
- All existing backend tests: 90/90 ✅
- All existing frontend tests: 702/703 (1 skipped) ✅
- vue-tsc --noEmit: ✅

### DESIGN_GAP
- [DESIGN_GAP: P2 didn't specify capitalization for CLI config_list bool output. Test `test_cli_diagram_sanitize_list_shows_key` expects `"False"` (capitalized), so output changed from `"true"/"false"` to `"True"/"False"`. Existing test `test_config_list_shows_all` updated to match.]
- [DESIGN_GAP: P2 didn't specify that `sanitize_enabled` CLI bool validation should reject invalid values. P3 test `test_cli_diagram_sanitize_invalid_value` expects `exit_code != 0`. Added validation in the type conversion block for all bool keys (not just sanitize_enabled).]
