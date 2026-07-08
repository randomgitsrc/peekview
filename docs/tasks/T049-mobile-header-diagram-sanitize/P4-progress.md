# P4 Progress

## Step 1: Backend Config + CLI (2026-07-08)
- [x] config.py: Added `PeekDiagram(BaseSettings)` with `sanitize_enabled: bool = True`
- [x] config.py: Registered `diagram: PeekDiagram` field in `PeekConfig`
- [x] config_router.py: Added `PublicDiagramConfig` + `GET /api/v1/config/diagram` endpoint
- [x] cli.py: Added `diagram.sanitize_enabled` to SUPPORTED_CONFIG_KEYS, CONFIG_KEYS_HELP, type conversion (with bool validation), _get_default, _DESC, _SECTION_ORDER

## Step 2: Frontend API Client (2026-07-08)
- [x] api/types.ts: Added `DiagramConfigResponse` interface
- [x] api/client.ts: Added `getDiagramConfig()` method

## Step 3: Diagram Sanitize Module (2026-07-08)
- [x] Created `utils/diagramSanitize.ts` with registerRule/sanitize/sanitizeWithRetry
- [x] Built-in rules: mermaid (arrow normalize, heuristic whitespace), plantuml (@start/@end, heuristic whitespace), svg (quotes, close tags)

## Step 4: Error UI (2026-07-08)
- [x] useMermaid.ts: Added `suppressErrors: true` to initialize
- [x] MermaidRenderer.vue: Clean `#dmermaid-{id}` in catch + exportPng catch
- [x] DiagramBlock.vue: Unified error UI with engine name, collapsible details, view source button
- [x] PlantUmlRenderer.vue: Emit signature updated, passes error payload (no auto code mode)
- [x] SvgRenderer.vue: Emit signature updated

## Step 5: Mobile Header (2026-07-08)
- [x] EntryDetailView.vue: visibleTags/remainingTagCount real computation, scroll listener (rAF throttled), onMounted check, resize recompute, a11y attributes
- [x] layout.css: position:sticky, mobile max-height, CSS transition, prefers-reduced-motion

## Step 6: DiagramBlock Integration (2026-07-08)
- [x] DiagramBlock.vue: onMounted get diagramConfig, sanitize before render, retry on error (with retrying guard)

## Verification (2026-07-08)
- [x] Backend diagram config tests: 11/11 ✅
- [x] Frontend diagramSanitize unit tests: 17/17 ✅
- [x] All existing backend tests: 90/90 ✅
- [x] All existing frontend tests: 702/703 (1 skipped) ✅
- [x] vue-tsc --noEmit: ✅
