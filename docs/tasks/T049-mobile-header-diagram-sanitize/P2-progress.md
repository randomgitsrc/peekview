=== P2 Progress: T049-mobile-header-diagram-sanitize ===
Started reading input files.

## Files read
- P0-brief.md — 4 sub-domains, environment constraints, known risks
- P1-requirements.md — 23 BDDs, 22 IA items, current status documented
- EntryDetailView.vue — `visibleTags` returns all, `remainingTagCount=0`, no scroll listener, `.header-tags` flex-wrap
- DiagramBlock.vue — error UI just "Failed to render diagram", PlantUML error → code mode, Mermaid/SVG error → hasError
- MermaidRenderer.vue — renderDiagram catch emits error but no DOM cleanup, exportPng also calls mermaid.render()
- PlantUmlRenderer.vue — render catch emits renderError (no payload), DiagramBlock switches to code mode
- SvgRenderer.vue — DOMPurify sanitize, empty result → renderError
- useMermaid.ts — mermaid.initialize() without suppressErrors
- usePlantUML.ts — has validateSource but no sanitize
- useMarkdown.ts — builds DiagramBlockData from fence blocks, no sanitization pass
- config.py — PeekConfig with nested PeekAuth/PeekServer etc., `captcha_enabled` is a pattern
- config_router.py — GET /api/v1/config/captcha and /limits follow same pattern
- cli.py — SUPPORTED_CONFIG_KEYS tuple, config_set type conversion, CONFIG_KEYS_HELP
- layout.css — .detail-header uses flex-shrink:0, no position:sticky, no max-height on header-tags
- api/client.ts — has getEntry, getFileContent etc, no getDiagramConfig yet
- api/types.ts — no diagram config type yet
- types/index.ts — DiagramBlockData, MarkdownBlock types
- MarkdownViewer.vue — renders blocks via DiagramBlock, calls useMarkdown.render()
