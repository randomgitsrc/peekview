# P1 Progress — T075-structured-data-viewer

trace_id: T075-P1-20260731
agent: analyst
started: 2026-07-31

---

## Step 0: Inputs read

- [x] P1-dispatch-context-analyst.md
- [x] analyst.md (role definition)
- [x] P0-brief.md
- [x] AGENTS.md (project conventions — read via system prompt)

## Step 1: Reading input file 1/8 — P0-brief.md

Task: 结构化数据富渲染（TableView + TreeView + 源码/渲染切换 + 格式检测修正）

Key points from P0:
- A. TableView (CSV/TSV): TanStack Table v8 headless, 复用 Pagination.vue, 列排序/筛选/横向滚动/动态列宽, >50000行截断
- B. TreeView (JSON/YAML/XML): 递归树, 展开/折叠, 类型标签, 路径搜索, 点击复制值, >2MB截断
- C. 源码/渲染切换: 统一机制, 渲染优先, 文件切换时重置, Markdown补缺口
- D. 格式检测修正: language.py 扩展名映射 + useEntryDetailComputed.ts 检测属性

不做: Markdown内嵌code block渲染, 编码检测, Code内置搜索, 虚拟滚动
risk=medium


## Step 2: Reading input file 2/8 — EntryDetailContent.vue

Key findings:
- Render dispatch: isHtml → HtmlViewer, isMarkdown → MarkdownViewer, isImage → ImageViewer, else → CodeViewer (fallback)
- isMarkdown/isHtml/isImage/isBinary props come from parent (useEntryDetailComputed)
- No source/render toggle mechanism currently exists
- New renderers (TableView, TreeView) would slot into the v-if/v-else-if chain between isImage and the CodeViewer fallback
- Props interface: slug, activeFile, fileContent, fileLoading, fileError, wrapEnabled, canWrap, isMultiFile
- No "view mode" prop exists — source/render toggle needs a new prop or internal state

## Step 3: Reading input file 3/8 — useEntryDetailComputed.ts

Key findings:
- Detection props: isMarkdown (language==='markdown'), isHtml (language==='html'), isImage (mime-based + isBinary), isBinary
- New detection props needed: isCsv, isTsv, isJson, isYaml, isXml — all based on activeFile.language
- copyContent/downloadFile already exist — can be reused for truncation download
- tocHeadings only for markdown — TreeView/Table don't need TOC
- siblingFileIds only for HTML — not relevant
- scrollToHeading only for markdown — not relevant
- No "view mode" state exists — source/render toggle state needs to be added (either here or in EntryDetailView)

## Step 4: Reading input file 4/8 — Pagination.vue

Key findings:
- Props: page, perPage, total, maxVisible
- Emits: update:page
- Computes totalPages internally from total/perPage
- Has page jumper (Go to page input)
- Uses DESIGN.md CSS vars (var(--bg-secondary), var(--border-color), etc.)
- Wait — these CSS vars don't match DESIGN.md naming (which uses --c-surface, --c-border). This component might be using old var names. Need to check DESIGN.md.
- For TableView reuse: Pagination needs total rows count as 'total', current page as 'page', page size as 'perPage'. The perPage selector (50/100/500) is NOT in Pagination.vue — needs to be added by TableView.


## Step 5: Reading input file 5/8 — CodeViewer.vue

Key findings:
- Props: content, filename, language, wrap, canWrap, loading
- Uses useShiki for syntax highlighting
- No view mode toggle built in — it's a pure rendering component
- Can be reused as the 'source view' for CSV/TSV/JSON/YAML/XML/markdown
- For markdown source view, would pass language='markdown' + content
- For CSV source, language='csv' (already in PLAIN_TEXT_LANGS — no Shiki highlighting, just plain text)

## Step 6: Reading input file 6/8 — MarkdownViewer.vue

Key findings:
- Only renders markdown (no source toggle currently)
- Has diagram blocks (DiagramBlock), headings, code block copy buttons, link click handlers, footnotes, front-matter, KaTeX
- Emits: headings, navigate-file
- No source view mode exists — need to add toggle
- Rich CSS (github-markdown-css overrides for dark mode)
- The source/render toggle for Markdown would wrap MarkdownViewer in a container that also has CodeViewer with language=markdown

## Step 7: Reading input file 7/8 — language.py

Key findings:
- .csv → 'csv' (line 68)
- .tsv → 'csv' (line 69) ⚠️ SAME language value as .csv! This is a problem — frontend can't distinguish CSV from TSV by language alone
- .json → 'json' (line 45)
- .yaml → 'yaml' (line 43)
- .yml → 'yaml' (line 44)
- .xml → 'xml' (line 41)
- csv is in PLAIN_TEXT_LANGS (no Shiki highlighting)
- All 6 extensions ARE already mapped — but .tsv maps to 'csv' not 'tsv'

IMPLICATION: If .tsv → language='csv', frontend cannot detect TSV format from language field. Need either:
  a) Change .tsv → 'tsv' in language.py, OR
  b) Frontend detects TSV from filename extension instead of language field
P0 says '后端 language.py 确认对 .csv/.tsv/.json/.yaml/.yml/.xml 的 language 返回值，如缺失，补充扩展名 → language 映射'. The .tsv mapping exists but is wrong (maps to 'csv' not 'tsv'). This is the '修正' part of task D.


## Step 8: Reading input file 8/8 — DESIGN.md

Key findings:
- Content Viewers: CodeViewer (Shiki), MarkdownViewer, DiagramBlock, ImageViewer, HtmlViewer — new TableView/TreeView to be added
- Icon library: Lucide (lucide-vue-next)
- CSS tokens: semantic aliases (--bg-*, --text-*, --border-*, --accent-*) in component code; primitives (--c-*) only in variables.css
- 4px base grid for spacing/radii
- Dual-theme (dark/light) — must test both
- Touch targets minimum 44px
- z-index scale: base 0, sticky 10, drawer 100/101, modal 200/210, toast 300
- Toggle buttons use .toggle-btn class with .active state
- Icon buttons use .icon-btn class
- Pagination.vue uses OLD CSS var names (--bg-secondary, --border-color) — these are semantic aliases that DO exist in variables.css (confirmed by DESIGN.md semantic alias mapping)

## Additional investigation: useViewMode.ts

Existing useViewMode.ts is for grid/list view on explore page (localStorage 'peekview-view-mode'). NOT related to source/render toggle. New composable needed.

## Additional investigation: DiagramBlock source toggle pattern

DiagramBlock has isCodeMode ref, toggleView() function, and '查看源码' button on error. Toggle is internal to the component (not lifted to parent). This is a per-component pattern, not a unified mechanism.

The new unified source/render toggle (task C) should be at the EntryDetailContent level, not per-component, because:
1. It needs to work for ALL rich-render formats (Markdown, CSV, TSV, JSON, YAML, XML)
2. File switch should reset to render view (state at parent level)
3. Toggle button position is in the toolbar/header area (above content)

## Additional investigation: language.py .tsv mapping

.tsv → 'csv' (line 69). This means:
- Backend returns language='csv' for BOTH .csv and .tsv files
- Frontend cannot distinguish CSV from TSV by language field alone
- P0 task D says '确认/补充扩展名映射' — the mapping exists but is incorrect for .tsv
- Fix: change .tsv → 'tsv' in language.py, add 'tsv' to PLAIN_TEXT_LANGS if needed for Shiki

## Additional investigation: EntryDetailView architecture

- EntryDetailView.vue is the top-level view
- It uses useEntryDetailComputed for format detection (isMarkdown, isHtml, isImage, isBinary)
- Passes these as props to EntryDetailContent.vue
- EntryDetailContent.vue dispatches to HtmlViewer/MarkdownViewer/ImageViewer/CodeViewer
- EntryDetailHeader.vue has the toolbar (actions-area with toggle-btn/icon-btn)
- EntryDetailMobileBar.vue has mobile toolbar
- The source/render toggle button would go in EntryDetailHeader (desktop) and EntryDetailMobileBar (mobile)
- Toggle state would live in EntryDetailView and be passed down as prop

## Dependencies check needed
- TanStack Table v8: not yet installed (npm)
- js-yaml: not yet installed (npm)


## Step 9: Additional investigation — test infrastructure

- Frontend tests: vitest + jsdom, composables tests in src/composables/__tests__/, component tests in src/components/__tests__/
- No useEntryDetailComputed test exists yet — new detection props (isCsv/isTsv/isJson/isYaml/isXml) need tests
- Backend test_language.py exists, tests detect_language for .json/.yaml/.yml — but NO test for .csv/.tsv mapping
  - Need to add test for .tsv → 'tsv' (after fix from 'csv')
  - Need to add test for .csv → 'csv'
- Pagination.spec.ts exists — can extend for TableView pagination integration

## Step 10: Summary of implicit needs identified

1. .tsv language mapping bug: .tsv → 'csv' (should be 'tsv') — frontend can't distinguish CSV/TSV
2. Source/render toggle state management: no existing mechanism for unified toggle (DiagramBlock has per-component toggle, useViewMode is for grid/list)
3. Toggle button placement: needs to go in EntryDetailHeader (desktop) + EntryDetailMobileBar (mobile) — both need modification
4. File switch resets toggle: state must live in EntryDetailView (parent of both header and content)
5. Markdown source view: MarkdownViewer has no source toggle — needs wrapping or conditional render
6. Pagination reuse: Pagination.vue has page/perPage/total props but no perPage selector — TableView needs to add page size selector separately
7. CSV parse edge cases: quoted fields with commas, newlines in quotes, BOM, double-quote escaping — frontend parser must handle these
8. YAML security: must use SAFE_SCHEMA to prevent !!python/object arbitrary code execution
9. XML XXE: DOMParser naturally prevents XXE (no external entity resolution in browser DOMParser) — zero dependency
10. Large data truncation: >50000 rows (CSV/TSV) and >2MB (JSON/YAML/XML) — truncation + download button
11. Dark/light theme: all new components must work in both themes (DESIGN.md requirement)
12. Mobile responsive: table horizontal scroll, tree expand/collapse, toggle button on mobile bar
13. Dependencies: TanStack Table v8 + js-yaml not yet installed — npm install + Vite bundle
14. Download button for truncated data: reuse downloadFile from useEntryDetailComputed (already exists)

## Capability assessment

- browser-vision: needed for P6 visual verification (screenshots of table/tree/toggle)
  - vision-engine skill available
  - playwright-cdp skill available for screenshots
  - status: available
- No external network needed (all deps via npm)
- No GAP capabilities identified

## PROD_TOUCHED check
[PROD_NOT_TOUCHED]

