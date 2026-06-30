# T045 P4 Progress

## Input files read
- [x] P2-design.md (full)
- [x] P1-requirements.md (full)
- [x] P0-brief.md (full)
- [x] useShiki.ts (full)
- [x] useMarkdown.ts:14-27, 260-313
- [x] MarkdownViewer.vue:1-50, 150-359
- [x] DiagramBlock.vue:1-179, 300-379
- [x] variables.css:59-62, 114-116
- [x] code.css:54-111

## Implementation steps
- [x] §3: useShiki.ts highlightCode() — added renderLineNumbers + .code-container wrapping
- [x] §6: useMarkdown.ts diagram codeViewHtml — mermaid/plantuml/svg all use highlightCode()
- [x] §2: variables.css --bg-code-even — dark #1c2536, light #d4d9e2
- [x] §1: MarkdownViewer.vue zebra — moved after pre*transparent, higher specificity + !important
- [x] §1: MarkdownViewer.vue .line { display: block }
- [x] §4: MarkdownViewer.vue line number styles (.code-container, .line-numbers, .line-number, pre, code)
- [x] §5: DiagramBlock.vue — full .diagram-code CSS rewrite for .code-container structure
- [x] vue-tsc --noEmit — PASS
- [x] vitest run — 637 passed, 1 skipped
