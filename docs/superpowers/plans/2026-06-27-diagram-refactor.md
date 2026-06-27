# Diagram Component Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 3 duplicate diagram components (1492 lines) + MarkdownViewer diagram event delegation (~500 lines script + ~720 lines CSS) into DiagramBlock + 3 renderers + useDiagramViewer composable, with zero behavior change from v0.2.3.

**Architecture:** useMarkdown returns structured blocks array (text/code/diagram). MarkdownViewer renders blocks with v-for - html blocks via v-html, diagram blocks via DiagramBlock. DiagramBlock manages header/toggle/dropdown/resize/code-mode and selects renderer via v-if/v-else-if. Each renderer (Mermaid/PlantUml/Svg) handles SVG rendering + pan-zoom + fullscreen modal, using useDiagramViewer composable for shared pan-zoom logic.

**Tech Stack:** Vue 3 + TypeScript + svg-pan-zoom + mermaid + plantuml.js + DOMPurify + Shiki + vitest

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `frontend-v3/src/composables/useDiagramViewer.ts` | Pan-zoom init/destroy/refresh/wheel/touch/resize composable |
| `frontend-v3/src/components/renderers/MermaidRenderer.vue` | Mermaid render + pan-zoom + touch + resize + fullscreen modal |
| `frontend-v3/src/components/renderers/PlantUmlRenderer.vue` | PlantUML render + pan-zoom + fullscreen modal (no touch/resize) |
| `frontend-v3/src/components/renderers/SvgRenderer.vue` | DOMPurify sanitize + pan-zoom (try-catch) + touch + resize + fullscreen modal + transparent PNG |
| `frontend-v3/src/components/DiagramBlock.vue` | Shell: header/toggle/dropdown/resize/code-mode + v-if/v-else-if renderer selection |
| `frontend-v3/src/composables/__tests__/useDiagramViewer.spec.ts` | Tests for pan-zoom composable |
| `frontend-v3/src/composables/__tests__/useMarkdown.blocks.spec.ts` | Tests for blocks structure output |

### Modified Files

| File | Purpose |
|------|---------|
| `frontend-v3/src/composables/useMarkdown.ts` | Change render() return type: MarkdownRenderResult to MarkdownBlocksResult with blocks array instead of html+sourcesMaps |
| `frontend-v3/src/components/MarkdownViewer.vue` | Switch to v-for blocks rendering; delete all diagram event delegation handlers, sourcesMaps, instances, render functions, and ~720 lines diagram CSS |
| `frontend-v3/src/types/index.ts` | Add DiagramBlockData and MarkdownBlock type definitions |
| `frontend-v3/src/composables/__tests__/useMarkdown.svg.spec.ts` | Update tests to match new blocks-based return format |

### Deleted Files

| File | Purpose |
|------|---------|
| `frontend-v3/src/components/MermaidDiagram.vue` | Replaced by MermaidRenderer.vue |
| `frontend-v3/src/components/PlantUmlDiagram.vue` | Replaced by PlantUmlRenderer.vue |
| `frontend-v3/src/components/SvgDiagram.vue` | Replaced by SvgRenderer.vue |

---

## Task 1: useMarkdown blocks 结构化

**Files:** `frontend-v3/src/types/index.ts`, `frontend-v3/src/composables/useMarkdown.ts`, `frontend-v3/src/composables/__tests__/useMarkdown.svg.spec.ts`, `frontend-v3/src/composables/__tests__/useMarkdown.blocks.spec.ts`

### Step 1.1: Add block type definitions to types/index.ts

- [ ] Append after the existing `TocHeading` interface in `frontend-v3/src/types/index.ts` (after line 58):

```ts
export type MarkdownBlockType = "html" | "diagram"

export interface HtmlBlock {
  type: "html"
  html: string
}

export interface DiagramBlockData {
  type: "diagram"
  lang: "mermaid" | "plantuml" | "svg"
  code: string
  codeViewHtml: string
  index: number
}

export type MarkdownBlock = HtmlBlock | DiagramBlockData

export interface MarkdownBlocksResult {
  blocks: MarkdownBlock[]
  headings: TocHeading[]
}
```

### Step 1.2: Rewrite useMarkdown.ts render() return type and logic

- [ ] Remove the local `MarkdownRenderResult` interface (lines 6-12) and replace import with types from `@/types`:

```ts
import type { TocHeading, MarkdownBlock, MarkdownBlocksResult } from "@/types"
```

- [ ] Remove `mermaidSources`, `plantumlSources`, `svgSources` local variables and all code that builds the diagram HTML blocks (the mermaid-block/plantuml-block/svg-block HTML generation in lines 232-329)

- [ ] Replace the second-pass loop (lines 230-356) with block-building logic. After markdown-it renders HTML with `<!--CODE_BLOCK_N-->` placeholders, split the HTML string by the placeholder pattern to create interleaved html/diagram blocks:

```ts
// Second pass: build blocks array from html + placeholders
const blocks: MarkdownBlock[] = []
const parts = html.split(/<!--CODE_BLOCK_(\d+)-->/)
// parts alternates: [html_segment, index_str, html_segment, ...]
for (let i = 0; i < parts.length; i++) {
  if (i % 2 === 0) {
    const segment = parts[i].trim()
    if (segment) {
      blocks.push({ type: "html", html: segment })
    }
  } else {
    const blockIdx = parseInt(parts[i])
    const codeBlock = codeBlocks[blockIdx]
    if (codeBlock.lang === "mermaid" || codeBlock.lang === "plantuml" || codeBlock.lang === "svg") {
      let codeViewHtml: string
      if (codeBlock.lang === "svg") {
        codeViewHtml = "<pre class=\"shiki\"><code>" + await highlightCode(codeBlock.code, "xml", theme) + "</code></pre>"
      } else {
        codeViewHtml = "<pre class=\"shiki\"><code>" + escapeHtml(codeBlock.code) + "</code></pre>"
      }
      blocks.push({
        type: "diagram",
        lang: codeBlock.lang as "mermaid" | "plantuml" | "svg",
        code: codeBlock.code,
        codeViewHtml,
        index: codeBlock.index,
      })
    } else {
      // Regular code block: highlight + wrap (same logic as current lines 331-355)
      try {
        const highlighted = await highlightCode(codeBlock.code, codeBlock.lang, theme)
        const wrappedCode = buildCodeBlockWrapper(codeBlock.lang, codeBlock.code, highlighted, escapeHtmlAttribute)
        blocks.push({ type: "html", html: wrappedCode })
      } catch (err) {
        const fallbackCode = buildFallbackCodeBlock(codeBlock.lang, codeBlock.code, escapeHtmlAttribute)
        blocks.push({ type: "html", html: fallbackCode })
      }
    }
  }
}
```

Note: Extract the code-block-wrapper HTML generation (lines 333-340 and 347-355) into helper functions `buildCodeBlockWrapper` and `buildFallbackCodeBlock` to avoid inline template duplication. The exact HTML output must match v0.2.3.

- [ ] Prepend front matter as html block if present (front matter HTML goes as the first html block in the blocks array)
- [ ] Run DOMPurify on all html blocks (same config as current lines 363-366). After building the blocks array, sanitize each html block:

```ts
for (const block of blocks) {
  if (block.type === "html") {
    block.html = DOMPurify.sanitize(block.html, {
      ADD_ATTR: ["data-action", "data-code", "data-line", "data-block-id", "data-index", "data-mode", "target", "rel"],
      ADD_TAGS: ["button"],
    })
  }
}
```
- [ ] Return `{ blocks, headings }` instead of `{ html, headings, mermaidSources, plantumlSources, svgSources }`
- [ ] Change the function return type from `Promise<MarkdownRenderResult>` to `Promise<MarkdownBlocksResult>`

### Step 1.3: Write blocks structure tests

- [ ] Create `frontend-v3/src/composables/__tests__/useMarkdown.blocks.spec.ts`:

```ts
import { describe, it, expect } from "vitest"
import { useMarkdown } from "../useMarkdown"

describe("useMarkdown blocks structure", () => {
  const { render } = useMarkdown()

  it("pure text generates single html block", async () => {
    const result = await render("Hello world", "github-light")
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe("html")
  })

  it("mermaid code block generates diagram block", async () => {
    const md = "\\" + "mermaid
graph TD
A-->B
" + "\\"
    const result = await render(md, "github-light")
    const d = result.blocks.find(b => b.type === "diagram")
    expect(d).toBeDefined()
    if (d && d.type === "diagram") {
      expect(d.lang).toBe("mermaid")
      expect(d.code).toContain("graph TD")
      expect(d.codeViewHtml).toContain("<pre")
    }
  })

  it("plantuml code block generates diagram block", async () => {
    const md = "\\" + "plantuml
@startuml
A -> B
@enduml
" + "\\"
    const result = await render(md, "github-light")
    const d = result.blocks.find(b => b.type === "diagram")
    expect(d).toBeDefined()
    if (d && d.type === "diagram") expect(d.lang).toBe("plantuml")
  })

  it("svg code block generates diagram block with xml highlighting", async () => {
    const md = "\\" + "svg
<svg xmlns="http://www.w3.org/2000/svg"><circle r="40"/></svg>
" + "\\"
    const result = await render(md, "github-light")
    const d = result.blocks.find(b => b.type === "diagram")
    expect(d).toBeDefined()
    if (d && d.type === "diagram") {
      expect(d.lang).toBe("svg")
      expect(d.codeViewHtml).toContain("class=\"shiki")
    }
  })

  it("html+diagram interleaving maintains document order", async () => {
    const md = "Before

" + "\\" + "mermaid
graph TD
A-->B
" + "\\" + "

After"
    const result = await render(md, "github-light")
    const types = result.blocks.map(b => b.type)
    expect(types).toContain("html")
    expect(types).toContain("diagram")
  })

  it("multiple diagram blocks are independent", async () => {
    const md = "\\" + "mermaid
graph TD
A-->B
" + "\\" + "

" + "\\" + "plantuml
@startuml
A -> B
@enduml
" + "\\"
    const result = await render(md, "github-light")
    expect(result.blocks.filter(b => b.type === "diagram")).toHaveLength(2)
  })

  it("no mermaidSources/plantumlSources/svgSources in result", async () => {
    const md = "\\" + "mermaid
graph TD
A-->B
" + "\\"
    const result = await render(md, "github-light")
    expect((result as any).mermaidSources).toBeUndefined()
    expect((result as any).plantumlSources).toBeUndefined()
    expect((result as any).svgSources).toBeUndefined()
  })
})
```

### Step 1.4: Update existing svg spec test

- [ ] Update `frontend-v3/src/composables/__tests__/useMarkdown.svg.spec.ts`:
  - Replace `result.html` assertions with `result.blocks` assertions
  - Replace `result.svgSources` with `result.blocks.filter(b => b.type === "diagram" && b.lang === "svg")`
  - Check `svgBlocks[0].code` instead of `Array.from(result.svgSources.values())[0]`

### Step 1.5: Run type check and tests

```bash
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && ./node_modules/.bin/vitest run src/composables/__tests__/useMarkdown.blocks.spec.ts src/composables/__tests__/useMarkdown.svg.spec.ts
```

---

## Task 2: useDiagramViewer composable

**Files:** `frontend-v3/src/composables/useDiagramViewer.ts`, `frontend-v3/src/composables/__tests__/useDiagramViewer.spec.ts`

### Step 2.1: Create useDiagramViewer.ts

- [ ] Create `frontend-v3/src/composables/useDiagramViewer.ts`

Export two functions: `useDiagramViewer` (main viewer pan-zoom) and `useModalPanZoom` (fullscreen modal pan-zoom).

**useDiagramViewer options:**
- `containerRef: Ref<HTMLElement | undefined>` - outer container for ResizeObserver + touch + refresh event
- `svgContainerRef: Ref<HTMLElement | undefined>` - element containing the SVG for pan-zoom init
- `maxZoom: number` (default 10)
- `minZoom: number` (default 0.1)
- `enableTouch: boolean` (default true)
- `enableResize: boolean` (default true)
- `refreshEventName: string` (default "diagram-refresh")

**Returns:** `initPanZoom`, `destroyPanZoom`, `refreshPanZoom`, `onWheel`, `setupTouchListeners`, `removeTouchListeners`, `setupResizeObserver`, `setupRefreshListener`, `cleanup`

**useModalPanZoom options:**
- `modalSvgWrapperRef: Ref<HTMLElement | undefined>`
- `maxZoom: number` (default 20)

**Returns:** `initModalPanZoom`, `destroyModalPanZoom`, `onWheelModal`, `zoomInModal`, `zoomOutModal`, `resetZoomModal`

**initPanZoom** (extracted from MermaidDiagram.vue lines 61-99):
1. Check svgContainerRef.value exists, find `svg` element inside
2. await nextTick()
3. Fix SVG dimensions: removeAttribute("width"/"height"), style.width/height/maxWidth/maxHeight = "100%"
4. Dynamically import svg-pan-zoom: `const svgPanZoom = (await import("svg-pan-zoom")).default`
5. Create instance with {zoomEnabled:true, controlIconsEnabled:false, fit:true, center:true, minZoom, maxZoom, panEnabled:true, mouseWheelZoomEnabled:false, preventMouseEventsDefault:false}
6. Try-catch wrapper (for SVG compatibility - SvgRenderer needs try-catch per spec #43)
7. Store panZoomInstance on containerRef.__panZoomInstance

**onWheel** (from MermaidDiagram.vue lines 333-341):
1. e.preventDefault()
2. delta = deltaY > 0 ? 0.9 : 1.1
3. currentZoom = panZoomInstance.getZoom()
4. newZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom * delta))
5. panZoomInstance.zoom(newZoom)

**Touch handlers** (from MermaidDiagram.vue lines 354-397, exact same logic):
- Module-level state: touchStartDistance, initialZoom, isDragging, startX, startY
- onTouchStart: 2 fingers -> calc distance + store initialZoom; 1 finger -> isDragging=true, store startX/startY
- onTouchMove: 2 fingers -> pinch zoom; 1 finger -> panBy({x:dx, y:dy})
- onTouchEnd: reset isDragging=false, touchStartDistance=0
- setupTouchListeners: add touchstart/touchmove/touchend if enableTouch, with {passive:false} for start/move
- removeTouchListeners: remove touch listeners

**setupResizeObserver** (from MermaidDiagram.vue lines 411-419):
- If enableResize and containerRef.value and "ResizeObserver" in window
- Observe containerRef, callback: panZoomInstance.resize() + fit() + center()

**setupRefreshListener** (from MermaidDiagram.vue lines 430-434):
- Add event listener for refreshEventName on containerRef -> refreshPanZoom()

**cleanup**: disconnect ResizeObserver, destroy panZoom, remove touch listeners

**useModalPanZoom**: Same SVG dimension fix + dynamic import + pan-zoom init pattern as main viewer, but maxZoom default 20. Try-catch on init too. Provides zoomInModal/zoomOutModal/resetZoomModal delegating to modalPanZoomInstance. onWheelModal same logic as onWheel but with modal maxZoom.

### Step 2.2: Write useDiagramViewer tests

- [ ] Create `frontend-v3/src/composables/__tests__/useDiagramViewer.spec.ts`:

Mock svg-pan-zoom with vi.mock. Test cases:
1. useDiagramViewer exports expected functions (initPanZoom, destroyPanZoom, refreshPanZoom, onWheel, cleanup)
2. onWheel calls preventDefault and delegates to panZoomInstance.zoom
3. useModalPanZoom exports modal functions (initModalPanZoom, destroyModalPanZoom, onWheelModal, zoomInModal, zoomOutModal, resetZoomModal)
4. enableTouch:false does not add touch listeners (verify with spyOn addEventListener)
5. enableResize:false does not add ResizeObserver

### Step 2.3: Run type check and tests

```bash
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && ./node_modules/.bin/vitest run src/composables/__tests__/useDiagramViewer.spec.ts
```

---

## Task 3: MermaidRenderer

**Files:** `frontend-v3/src/components/renderers/MermaidRenderer.vue`

### Step 3.1: Create renderers directory

```bash
mkdir -p frontend-v3/src/components/renderers
```

### Step 3.2: Create MermaidRenderer.vue

- [ ] Create `frontend-v3/src/components/renderers/MermaidRenderer.vue`

**Props:** `code: string`, `theme: "dark" | "light"`
**Emits:** `renderError` (when mermaid.render fails - DiagramBlock switches to code mode on error, spec #66)

**Template structure:**

Outer viewer:
```html
<div ref="containerRef" class="diagram-svg-container" @wheel="viewer.onWheel">
  <div ref="svgContainerRef" v-html="svgContent"></div>
</div>
```

Fullscreen modal (Teleport to body):
- Root: `class="diagram-modal"` (BLOCKER: must use diagram-modal prefix, not diagram-block, per spec R5)
- Content: `class="diagram-modal-content"`
- Toolbar: `class="diagram-modal-toolbar"`
- Title: `class="diagram-modal-title"` text "Mermaid Diagram"
- 5 toolbar buttons with `class="diagram-toolbar-btn"`: +, minus sign, counterclockwise arrow, download arrow, close button (close-btn has margin-left:var(--space-2), font-size:20px)
- SVG container: `class="diagram-modal-svg-container"` with @wheel="modal.onWheelModal"
- SVG wrapper: `class="diagram-svg-wrapper"` with v-html="svgContent"

Use the exact Unicode characters from MermaidDiagram.vue lines 18-22 for button text.

**Script key points:**

1. **mermaidCache** (R1): Module-level `const mermaidCache = new Map<string, string>()` at top of script setup. Key: `${theme}-${code}`. Same semantics as v0.2.3 MarkdownViewer mermaidCache.

2. **cancelled flag** (R2): `const cancelled = ref(false)`. Set `cancelled.value = true` in onUnmounted. Check after async render - if cancelled, return without updating svgContent.

3. **render ID** (M2): Use `crypto.randomUUID()` for render IDs: `mermaid-${crypto.randomUUID()}`

4. **renderDiagram()**: Check cache with key `${currentTheme}-${code}`. If hit, use cached SVG. If miss, call `renderMermaid(renderId, props.code, currentTheme)` and cache result. On error: console.error + emit("renderError"). Check cancelled.value before updating svgContent.

5. **exportPng()** (R3): Re-render with `mermaid.render("export-${crypto.randomUUID()}", props.code)` using **original code prop** (not svgContent). Apply br fix: svg.replace(/<br>/gi, "<br/>"). Parse with DOMParser, check parseError. Dimensions: viewBox (+20px padding) -> g.root getBBox (+40px padding) -> 800x600 fallback. Min size: max(w,100) x max(h,100). **White background**: ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,w,h). Return Blob.

6. **downloadPng()**: Call exportPng(), create download link. On failure: console.error + alert() (spec #58: Mermaid shows alert). Download filename: `mermaid-diagram-${index}.png`.

7. **Fullscreen**: openFullscreen -> isFullscreen=true + nextTick -> modal.initModalPanZoom(). closeFullscreen -> isFullscreen=false + modal.destroyModalPanZoom().

8. **useDiagramViewer**: enableTouch:true, enableResize:true, refreshEventName:"mermaid-refresh", maxZoom:10

9. **useModalPanZoom**: maxZoom:20

10. **Watch**: `watch(() => [props.code, props.theme], async () => { await renderDiagram(); await nextTick(); await viewer.initPanZoom() }, { immediate: true })`

11. **onMounted**: viewer.setupResizeObserver(), viewer.setupTouchListeners(), viewer.setupRefreshListener()

12. **onUnmounted**: cancelled.value=true, viewer.cleanup(), modal.destroyModalPanZoom()

13. **defineExpose**: { openFullscreen, closeFullscreen, refresh: () => viewer.refreshPanZoom(), exportPng, downloadPng }

### Step 3.3: Verify MermaidRenderer compiles

```bash
cd frontend-v3 && npx vue-tsc --noEmit
```

---

## Task 4: PlantUmlRenderer

**Files:** `frontend-v3/src/components/renderers/PlantUmlRenderer.vue`

### Step 4.1: Create PlantUmlRenderer.vue

- [ ] Create `frontend-v3/src/components/renderers/PlantUmlRenderer.vue`

**Props:** `code: string`, `theme: "dark" | "light"`
**Emits:** `renderError` (PlantUML error -> DiagramBlock switches to code mode, spec #66)

**Template:** Same structure as MermaidRenderer but modal title is "PlantUML Diagram". No resize handle (handled in DiagramBlock).

**Key differences from MermaidRenderer (spec behavior matrix):**

1. **No touch** (spec #50): enableTouch:false in useDiagramViewer
2. **No resize** (spec #48/#63): enableResize:false in useDiagramViewer
3. **No mermaidCache**: PlantUML has no cache (spec #67)
4. **ensureLoaded()** (spec #69): Call `await usePlantUML.ensureLoaded()` before render
5. **render()** (spec #70): Call `await usePlantUML.render(code, theme)` - returns SVG string
6. **cancelled flag** (R2/R4): Same pattern - cancelled.value=true in onUnmounted, check after async render and after ensureLoaded
7. **exportPng()** (R3): Re-render with `await usePlantUML.render(props.code, props.theme)`. No br fix. White background (ctx.fillStyle="#ffffff"). Dimension fallback: viewBox -> width/height attr -> 800x600 (spec #54). No getBBox fallback (v0.2.3 PlantUML does not have it).
8. **downloadPng()**: On failure: console.error only, no alert (spec #58)
9. **refreshEventName**: "plantuml-refresh"
10. **onMounted**: Only viewer.setupRefreshListener() - no touch, no resize
11. **Watch**: `watch(() => [props.code, props.theme], ...)` (PlantUML uses props.theme directly, not currentTheme from store - its render function takes theme as parameter)

**Script outline:**

```ts
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue"
import { useDiagramViewer, useModalPanZoom } from "@/composables/useDiagramViewer"
import * as usePlantUML from "@/composables/usePlantUML"

const props = defineProps<{ code: string; theme: "dark" | "light" }>()
const emit = defineEmits<{ renderError: [] }>()

const containerRef = ref<HTMLElement>()
const svgContainerRef = ref<HTMLElement>()
const modalSvgWrapperRef = ref<HTMLElement>()
const isFullscreen = ref(false)
const svgContent = ref("")
const cancelled = ref(false)

const viewer = useDiagramViewer({
  containerRef, svgContainerRef,
  maxZoom: 10, minZoom: 0.1,
  enableTouch: false, enableResize: false,
  refreshEventName: "plantuml-refresh",
})
const modal = useModalPanZoom({ modalSvgWrapperRef, maxZoom: 20 })

async function renderDiagram() {
  try {
    await usePlantUML.ensureLoaded()
    if (cancelled.value) return
    const svg = await usePlantUML.render(props.code, props.theme)
    if (cancelled.value) return
    svgContent.value = svg
  } catch (err) {
    console.error("PlantUML render failed:", err)
    if (cancelled.value) return
    emit("renderError")
  }
}
// ... openFullscreen, closeFullscreen, exportPng, downloadPng, refresh
```

### Step 4.2: Verify PlantUmlRenderer compiles

```bash
cd frontend-v3 && npx vue-tsc --noEmit
```

---

## Task 5: SvgRenderer

**Files:** `frontend-v3/src/components/renderers/SvgRenderer.vue`

### Step 5.1: Create SvgRenderer.vue

- [ ] Create `frontend-v3/src/components/renderers/SvgRenderer.vue`

**Props:** `code: string`, `theme: "dark" | "light"`
**Emits:** `renderError` (SVG error -> DiagramBlock shows error div, spec #66)

**Template:** Same structure as MermaidRenderer but modal title is "SVG Diagram". Template uses `v-html="sanitized"` instead of `v-html="svgContent"`.

**Key differences from MermaidRenderer (spec behavior matrix):**

0. **cancelled flag** (R2 consistency): `const cancelled = ref(false)`. Set in onUnmounted. SVG sanitize is sync but pan-zoom init is async - check cancelled after initPanZoom.

1. **DOMPurify sanitize** (M1): In onMounted and watch on code change, sanitize props.code:

```ts
const sanitized = ref("")
const hasError = ref(false)

function doSanitize() {
  const result = DOMPurify.sanitize(props.code, {
    ADD_ATTR: ["data-action", "data-code", "data-line", "data-block-id", "data-index", "data-mode", "target", "rel"],
    ADD_TAGS: ["button"],
  })
  if (!result || result.trim() === "") {
    hasError.value = true
    emit("renderError")
  } else {
    sanitized.value = result
    hasError.value = false
  }
}
```

2. **try-catch pan-zoom**: Already handled by useDiagramViewer (initPanZoom has try-catch).

3. **Transparent PNG** (spec #52): No ctx.fillRect. Canvas default alpha=0 is transparent. exportPng() uses sanitized.value directly (DOMPurified original SVG).

4. **Dimension fallback** (spec #54): viewBox -> width/height attr -> **400x300** (not 800x600, matching SvgDiagram.vue lines 186-189).

5. **Touch**: enableTouch:true (same as Mermaid, spec #50)
6. **Resize**: enableResize:true (same as Mermaid, spec #63)
7. **refreshEventName**: "svg-refresh"
8. **No re-render for PNG**: exportPng() uses sanitized.value directly - no engine re-render needed.
9. **downloadPng()**: On failure: console.error only (no alert, matching SvgDiagram.vue behavior). Download filename: `svg-diagram-${index}.png`.

**Script outline:**

```ts
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue"
import { useDiagramViewer, useModalPanZoom } from "@/composables/useDiagramViewer"
import DOMPurify from "dompurify"

const props = defineProps<{ code: string; theme: "dark" | "light" }>()
const emit = defineEmits<{ renderError: [] }>()

const containerRef = ref<HTMLElement>()
const svgContainerRef = ref<HTMLElement>()
const modalSvgWrapperRef = ref<HTMLElement>()
const isFullscreen = ref(false)
const sanitized = ref("")
const hasError = ref(false)

const viewer = useDiagramViewer({
  containerRef, svgContainerRef,
  maxZoom: 10, minZoom: 0.1,
  enableTouch: true, enableResize: true,
  refreshEventName: "svg-refresh",
})
const modal = useModalPanZoom({ modalSvgWrapperRef, maxZoom: 20 })

// doSanitize() function as above

watch(() => props.code, () => {
  doSanitize()
  nextTick(() => viewer.refreshPanZoom())
}, { immediate: true })

onMounted(() => {
  doSanitize()
  viewer.setupResizeObserver()
  viewer.setupTouchListeners()
  viewer.setupRefreshListener()
  nextTick(() => viewer.initPanZoom())
})

onUnmounted(() => {
  cancelled.value = true
  viewer.cleanup()
  modal.destroyModalPanZoom()
})

defineExpose({ openFullscreen, closeFullscreen, refresh: () => viewer.refreshPanZoom(), exportPng, downloadPng })
```

### Step 5.2: Verify SvgRenderer compiles

```bash
cd frontend-v3 && npx vue-tsc --noEmit
```

---

## Task 6: DiagramBlock

**Files:** `frontend-v3/src/components/DiagramBlock.vue`

### Step 6.1: Create DiagramBlock.vue

- [ ] Create `frontend-v3/src/components/DiagramBlock.vue`

**Props:** `block: DiagramBlockData`, `theme: "dark" | "light"`

**Template:**

```html
<div class="diagram-block" :data-type="block.lang" :data-index="block.index">
  <div class="diagram-header">
    <span class="diagram-label">{{ block.lang.toUpperCase() }}</span>
    <div class="diagram-header-actions">
      <button class="diagram-view-toggle" :class="{ 'code-active': isCodeMode }" @click="toggleView" title="Toggle Diagram/Code">
        <span class="toggle-icon">◫</span>
        <span class="toggle-text">{{ toggleText }}</span>
      </button>
      <button class="diagram-action-btn fullscreen-btn" @click="openFullscreen" title="Fullscreen">⧉</button>
      <div class="diagram-dropdown" ref="dropdownRef">
        <button class="diagram-action-btn menu-btn" @click="toggleMenu" title="More actions">⋯</button>
        <div class="diagram-dropdown-menu" :class="{ show: isMenuOpen }">
          <button @click="handleDownloadPng">⬇ Download PNG</button>
          <button @click="handleCopyCode">{{ copyButtonText }}</button>
        </div>
      </div>
    </div>
  </div>
  <div class="diagram-viewer" :class="{ 'is-active': !isCodeMode, 'resizing': isResizing }" v-show="!isCodeMode">
    <MermaidRenderer v-if="block.lang === 'mermaid'" ref="rendererRef" :code="block.code" :theme="theme" @render-error="onRenderError" />
    <PlantUmlRenderer v-else-if="block.lang === 'plantuml'" ref="rendererRef" :code="block.code" :theme="theme" @render-error="onRenderError" />
    <SvgRenderer v-else-if="block.lang === 'svg'" ref="rendererRef" :code="block.code" :theme="theme" @render-error="onRenderError" />
    <div v-if="block.lang !== 'plantuml'" class="diagram-resize-handle" @mousedown="startResize"></div>
  </div>
  <div class="diagram-code" :class="{ 'is-active': isCodeMode }" v-show="isCodeMode">
    <div v-html="block.codeViewHtml"></div>
  </div>
  <div v-if="hasError && block.lang !== 'plantuml'" class="diagram-error">
    Failed to render {{ block.lang === 'svg' ? 'SVG' : 'diagram' }}
  </div>
</div>
```

**Script logic:**

1. **toggleView** - behavior varies by lang (spec #14-15):
   - Mermaid/SVG: Toggle isCodeMode. When switching to code: toggleText becomes "Code", code-active class added. When switching back to diagram: toggleText becomes "Diagram", code-active class removed, call rendererRef.value.refresh() to reinit pan-zoom.
   - PlantUML: Toggle isCodeMode. **Do NOT change toggleText** (always "Diagram"). **Do NOT dispatch refresh**. Only toggle is-active classes.

2. **toggleText** computed:
   - Mermaid/SVG: `isCodeMode ? "Code" : "Diagram"`
   - PlantUML: Always "Diagram"

3. **toggleMenu** - behavior varies by lang (spec #29-30):
   - Mermaid/SVG: Close other open diagram-dropdown-menus (querySelectorAll + remove "show" class), then toggle this menu. Add click-outside listener to close (setTimeout 0 to avoid immediate close).
   - PlantUML: Just toggle this menu. No close-others, no click-outside.

4. **handleCopyCode** - behavior varies by lang (spec #60):
   - Mermaid/SVG: navigator.clipboard.writeText(block.code), show "Copied!" on the copy button for 2 seconds (change copyButtonText, setTimeout reset).
   - PlantUML: navigator.clipboard.writeText(block.code), console.log("PlantUML code copied") only (no visual feedback).

5. **handleDownloadPng**: Call rendererRef.value.downloadPng()

6. **openFullscreen**: Call rendererRef.value.openFullscreen()

7. **startResize** (spec #65, mermaid/svg only):
   - mousedown event -> track startY + startHeight from .diagram-viewer computed height
   - Add mousemove/mouseup listeners on document
   - On mousemove: newHeight = Math.max(200, startHeight + deltaY), set viewer.style.height, remove maxHeight, add .resizing class
   - On mouseup: clean up listeners, remove .resizing class

8. **onRenderError** (spec #66):
   - Mermaid/SVG: Set hasError=true, show error div
   - PlantUML: Switch to code mode (isCodeMode=true)

9. **defineExpose**: { openFullscreen, closeFullscreen, refresh, exportPng } - delegates to rendererRef

### Step 6.2: Verify DiagramBlock compiles

```bash
cd frontend-v3 && npx vue-tsc --noEmit
```

---

## Task 7: MarkdownViewer switch to v-for blocks

**Files:** `frontend-v3/src/components/MarkdownViewer.vue`

### Step 7.1: Update imports

- [ ] Remove these imports from MarkdownViewer.vue:
  - `import mermaid from "mermaid"` (line 10)
  - `import { useMermaid } from "@/composables/useMermaid"` (line 12)
  - `import * as usePlantUML from "@/composables/usePlantUML"` (line 13)
  - `import MermaidDiagram from "@/components/MermaidDiagram.vue"` (line 17)
  - `import PlantUmlDiagram from "@/components/PlantUmlDiagram.vue"` (line 18)
  - `import SvgDiagram from "@/components/SvgDiagram.vue"` (line 19)
  - `import DOMPurify from "dompurify"` (line 20 - no longer needed, moved to SvgRenderer)

- [ ] Add these imports:
  - `import DiagramBlock from "@/components/DiagramBlock.vue"`
  - `import type { MarkdownBlock, MarkdownBlocksResult } from "@/types"`

- [ ] Remove from vue imports: `h`, `render as vueRender` (no longer mounting components imperatively)

### Step 7.2: Replace template

- [ ] Replace the template with:

```html
<template>
  <div class="markdown-viewer">
    <slot name="toc" :headings="headings" />
    <div ref="contentRef" class="markdown-body">
      <template v-for="(block, i) in blocks" :key="i">
        <div v-if="block.type === 'html'" v-html="block.html"></div>
        <DiagramBlock v-else-if="block.type === 'diagram'" :block="block" :theme="theme" />
      </template>
    </div>
  </div>
</template>
```

### Step 7.3: Replace script logic

- [ ] Remove all diagram-specific state and functions:
  - `mermaidCache` (moved to MermaidRenderer module level)
  - `mermaidSourcesMap`, `plantumlSourcesMap`, `svgSourcesMap`
  - `mermaidInstances`, `plantumlInstances`, `svgInstances`
  - `renderToken` (replace with simple loading guard)
  - All diagram event delegation handlers: copyMermaidCode, downloadMermaidPng, toggleMermaidView, openMermaidFullscreen, toggleMermaidMenu, startResize/onResizeMove/onResizeEnd, handleDelegatedAction, handleDelegatedResize
  - All PlantUML handlers: togglePlantUmlView, openPlantUmlFullscreen, togglePlantUmlMenu, copyPlantUmlCode, downloadPlantUmlPng
  - All SVG handlers: toggleSvgView, openSvgFullscreen, toggleSvgMenu, copySvgCode, downloadSvgPng
  - All render functions: renderMermaidDiagrams, renderPlantUmlDiagrams, renderSvgBlocks
  - `renderContent` - replace with simplified version

- [ ] Keep: `copyCodeBlock` function (for non-diagram code blocks, still using event delegation via data-action="copy-code-block")

- [ ] Add new state:
  ```ts
  const blocks = ref<MarkdownBlock[]>([])
  let renderToken = 0  // Keep for content prop rapid-change debounce (spec R2: renderer-level cancelled handles component destroy, but MarkdownViewer-level token prevents stale blocks overwrite)
  ```

- [ ] Replace renderContent with:
  ```ts
  async function renderContent() {
    const myToken = ++renderToken
    isLoading.value = true
    try {
      const themeName = theme.value === "dark" ? "github-dark" : "github-light"
      const result: MarkdownBlocksResult = await render(props.content, themeName)
      if (myToken !== renderToken) return  // Stale render, discard
      headings.value = result.headings
      blocks.value = result.blocks
      emit("headings", result.headings)
    } catch (err) {
      if (myToken === renderToken) console.error("Markdown render failed:", err)
    } finally {
      if (myToken === renderToken) isLoading.value = false
    }
  }
  ```

- [ ] Keep the click handler for copy-code-block only:
  ```ts
  onMounted(() => {
    contentRef.value?.addEventListener("click", handleCodeBlockCopy)
  })
  onBeforeUnmount(() => {
    contentRef.value?.removeEventListener("click", handleCodeBlockCopy)
  })

  function handleCodeBlockCopy(e: MouseEvent) {
    const target = (e.target as Element).closest('[data-action="copy-code-block"]') as HTMLButtonElement | null
    if (!target) return
    copyCodeBlock(target)
  }
  ```

- [ ] Remove `renderedHtml` ref (no longer needed - blocks are rendered directly)

- [ ] Keep the watch on content/theme to trigger renderContent

### Step 7.4: Verify MarkdownViewer compiles

```bash
cd frontend-v3 && npx vue-tsc --noEmit
```

---

## Task 8: CSS migration

**Files:** `frontend-v3/src/components/DiagramBlock.vue` (non-scoped CSS), `frontend-v3/src/components/MarkdownViewer.vue` (remove diagram CSS)

This is the highest-risk task. T022 failed primarily because CSS was not migrated. Follow every constraint below exactly.

### Step 8.1: !important audit (BLOCKER prerequisite)

- [ ] Grep all !important rules in MarkdownViewer.vue:
  ```bash
  cd frontend-v3 && grep -n '!important' src/components/MarkdownViewer.vue
  ```

- [ ] For each !important rule, determine if it matches elements inside .diagram-block:
  - Rules starting with `.markdown-body` affect only elements under .markdown-body. DiagramBlock is a child of .markdown-body, so these rules DO apply.
  - Critical ones to evaluate:
    - `.markdown-body pre * { background-color: transparent !important }` - affects diagram-code pre children. Need counter-rule: `.diagram-block .diagram-code pre * { background-color: var(--bg-secondary) !important }`
    - `.markdown-body svg { max-width: 100% !important }` - may affect diagram SVG. Need to verify if .diagram-block .diagram-viewer svg specificity (0,2,1) can override. If not, add `.diagram-block .diagram-viewer svg { max-width: none !important }` (only if SVG needs unconstrained width)
    - Dark mode rules like `[data-theme='dark'] .markdown-body pre { background-color: #161b22 !important }` - affects diagram-code. Counter: `.diagram-block .diagram-code pre { background-color: var(--bg-secondary) !important }`

- [ ] Document findings as comments in DiagramBlock CSS

### Step 8.2: Migrate block/header/button/dropdown CSS to DiagramBlock

- [ ] From MarkdownViewer.vue non-scoped CSS, extract all .mermaid-* / .plantuml-* / .svg-* diagram rules and unify them into .diagram-* rules in DiagramBlock.vue non-scoped CSS block.

**BLOCKER constraint: All diagram CSS rules must use .diagram-block as root prefix** (spec R5). This raises specificity to (0,2,x), replacing the protection that scoped [data-v-xxx] provided.

**BLOCKER constraint: modal Teleport CSS must use .diagram-modal prefix** (spec R5). Modal elements are Teleported to body and are NOT under .diagram-block.

**Class mapping:**
- .mermaid-block / .plantuml-block / .svg-block -> .diagram-block
- .mermaid-header / .plantuml-header / .svg-header -> .diagram-header
- .mermaid-label / .plantuml-label / .svg-label -> .diagram-label
- .mermaid-header-actions / .plantuml-header-actions / .svg-header-actions -> .diagram-header-actions
- .mermaid-view-toggle / .plantuml-view-toggle / .svg-view-toggle -> .diagram-view-toggle
- .mermaid-action-btn / .plantuml-action-btn / .svg-action-btn -> .diagram-action-btn
- .mermaid-dropdown / .plantuml-dropdown / .svg-dropdown -> .diagram-dropdown
- .mermaid-dropdown-menu / .plantuml-dropdown-menu / .svg-dropdown-menu -> .diagram-dropdown-menu
- .mermaid-content / .plantuml-content / .svg-content -> split into .diagram-viewer (diagram-mode) and .diagram-code (code-mode)
- .mermaid-resize-handle / .svg-resize-handle -> .diagram-resize-handle
- .mermaid-error / .plantuml-error / .svg-error -> .diagram-error

**Unscoped class renaming (from scoped to non-scoped):**
- .modal-title -> .diagram-modal-title
- .toolbar-btn -> .diagram-toolbar-btn
- .svg-container (in viewer) -> .diagram-svg-container
- .svg-wrapper (in modal) -> .diagram-svg-wrapper

**CSS from MarkdownViewer.vue to migrate (lines 1020-1690):**

1. Block appearance (spec #1): .diagram-block { margin:1rem 0; border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden; background:var(--bg-secondary); }

2. Header (spec #2-5): .diagram-block .diagram-header, .diagram-block .diagram-label, .diagram-block .diagram-header-actions - same values as current .mermaid-header etc.

3. Toggle button (spec #12-17): .diagram-block .diagram-view-toggle with all sub-rules. .code-active style (spec #16).

4. Action buttons (spec #18-24): .diagram-block .diagram-action-btn

5. Dropdown (spec #25-31): .diagram-block .diagram-dropdown, .diagram-block .diagram-dropdown-menu, .diagram-block .diagram-dropdown-menu button

6. Content areas (spec #6-10): Split .mermaid-content into:
   - .diagram-block .diagram-viewer { position:relative; background:var(--bg-secondary); overflow:hidden; min-height:300px; height:400px; width:100%; }
   - .diagram-block .diagram-code { background:var(--bg-secondary); min-height:100px; width:100%; aspect-ratio:auto; }

7. Visibility toggle (spec #9): .diagram-block .diagram-viewer:not(.is-active), .diagram-block .diagram-code:not(.is-active) { visually-hidden styles }

8. Code-mode pre (spec #10): .diagram-block .diagram-code pre { margin:0; padding:var(--space-3); overflow-x:auto; background:var(--bg-secondary) !important; }

9. Resize handle (spec #63-65): .diagram-block .diagram-resize-handle with gradient background

10. .resizing rules (spec #65): .diagram-block .diagram-viewer.resizing { position:relative !important; } and .diagram-block .diagram-viewer.resizing .diagram-resize-handle { ... }

11. Error state (spec #66): .diagram-error with light/dark mode variants

12. Mobile responsive (spec #71-74):
    ```css
    @media (max-width: 768px) {
      .diagram-block .diagram-header { padding: 6px 10px; }
      .diagram-block .diagram-view-toggle .toggle-text { display: none; }
      .diagram-block[data-type="mermaid"] .diagram-view-toggle { padding: 4px 8px; }
      .diagram-block[data-type="mermaid"] .diagram-action-btn { width: 26px; height: 26px; font-size: 12px; }
      .diagram-block[data-type="mermaid"] .diagram-viewer { min-height: 150px; }
    }
    ```

**CSS from old component scoped styles to migrate (MermaidDiagram 479-598, PlantUmlDiagram 298-416, SvgDiagram 360-478):**

These are the viewer/modal styles. Migrate once into DiagramBlock non-scoped CSS:

13. Viewer container: .diagram-block .diagram-svg-container { width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:grab; }
    .diagram-block .diagram-svg-container:active { cursor:grabbing; }

14. SVG inside viewer: .diagram-block .diagram-svg-container svg { max-width:100%; max-height:100%; }

15. Modal overlay (spec #33): .diagram-modal { position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:1000; display:flex; align-items:center; justify-content:center; padding:var(--space-4); }

16. Modal content (spec #34): .diagram-modal .diagram-modal-content { width:100%; max-width:1400px; height:90vh; background:var(--bg-primary); border-radius:var(--radius-lg); overflow:hidden; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); }

17. Modal toolbar (spec #35): .diagram-modal .diagram-modal-toolbar { display:flex; align-items:center; gap:var(--space-2); padding:var(--space-3) var(--space-4); background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); }

18. Modal title (spec #36): .diagram-modal .diagram-modal-title { flex:1; font-weight:600; color:var(--text-primary); }

19. Toolbar buttons shared (spec #38): .diagram-block .diagram-toolbar-btn, .diagram-modal .diagram-toolbar-btn { display:flex; align-items:center; justify-content:center; width:32px; height:32px; padding:0; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); color:var(--text-primary); font-size:16px; cursor:pointer; transition:all var(--transition-fast); }

20. Toolbar buttons hover: .diagram-block .diagram-toolbar-btn:hover, .diagram-modal .diagram-toolbar-btn:hover { background:var(--bg-secondary); border-color:var(--border-hover); }

21. Close button (spec #39): .diagram-modal .diagram-toolbar-btn.close-btn { margin-left:var(--space-2); font-size:20px; }

22. Modal SVG container (spec #40): .diagram-modal .diagram-modal-svg-container { flex:1; overflow:hidden; display:flex; align-items:center; justify-content:center; background:var(--bg-secondary); cursor:grab; }
    .diagram-modal .diagram-modal-svg-container:active { cursor:grabbing; }

23. SVG wrapper: .diagram-modal .diagram-svg-wrapper { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
    .diagram-modal .diagram-svg-wrapper svg { max-width:100%; max-height:100%; }

### Step 8.3: Delete diagram CSS from MarkdownViewer.vue

- [ ] Remove from MarkdownViewer.vue non-scoped CSS (everything between the old "=== Mermaid Block Styles" comment and the "=== Front Matter Styles" comment, approximately lines 960-1989 minus front-matter/code-block-wrapper rules):
  - All .mermaid-* rules (lines 1020-1260)
  - All .plantuml-* rules (lines 1261-1453)
  - All .svg-* rules (lines 1455-1700)
  - All dead code: .mermaid-actions, .code-toggle-btn, .mermaid-view, .diagram-view, .code-view pre/code (lines 960-1018, 1744-1798)

- [ ] Keep in MarkdownViewer.vue non-scoped CSS:
  - Dark mode .markdown-body rules (lines 810-958)
  - Code block wrapper rules (lines 1801-1883)
  - Front matter rules (lines 1885-1989)

### Step 8.4: Verify CSS migration

```bash
cd frontend-v3 && npx vue-tsc --noEmit
```

---

## Task 9: Delete old components + type check + tests + build

**Files:** Delete MermaidDiagram.vue, PlantUmlDiagram.vue, SvgDiagram.vue

### Step 9.1: Delete old components

- [ ] Delete the three old component files:
  ```bash
  rm frontend-v3/src/components/MermaidDiagram.vue
  rm frontend-v3/src/components/PlantUmlDiagram.vue
  rm frontend-v3/src/components/SvgDiagram.vue
  ```

- [ ] Verify no other files import them:
  ```bash
  cd frontend-v3 && grep -r "MermaidDiagram\|PlantUmlDiagram\|SvgDiagram" src/ --include="*.ts" --include="*.vue"
  ```
  Should return no results (MarkdownViewer was updated in Task 7).

### Step 9.2: Run type check

```bash
cd frontend-v3 && npx vue-tsc --noEmit
```

Fix any type errors. Common issues:
- Import paths for new components
- Props type mismatches between DiagramBlock and renderers
- Missing type exports from types/index.ts

### Step 9.3: Run vitest

```bash
cd frontend-v3 && ./node_modules/.bin/vitest run
```

Fix any test failures. The main test files that need updating:
- `src/composables/__tests__/useMarkdown.svg.spec.ts` (updated in Task 1)
- `src/composables/__tests__/useMarkdown.blocks.spec.ts` (created in Task 1)
- `src/composables/__tests__/useDiagramViewer.spec.ts` (created in Task 2)

### Step 9.4: Build frontend

```bash
make build-frontend
```

This runs `npm run build` (which includes vue-tsc) and copies dist to backend/peekview/static/. If the build fails, check:
1. Import resolution for new components
2. CSS class name consistency between templates and non-scoped CSS
3. Any remaining references to old .mermaid-*/.plantuml-*/.svg-* classes

### Step 9.5: Final verification checklist

- [ ] `cd frontend-v3 && npx vue-tsc --noEmit` passes
- [ ] `cd frontend-v3 && ./node_modules/.bin/vitest run` passes
- [ ] `make build-frontend` passes
- [ ] No imports of MermaidDiagram/PlantUmlDiagram/SvgDiagram remain
- [ ] All diagram CSS uses .diagram-block or .diagram-modal as root prefix
- [ ] No .mermaid-*/.plantuml-*/.svg-* class names in any file (except dead code cleanup verification)
- [ ] MarkdownViewer.vue script section reduced from ~790 lines to ~60 lines
- [ ] MarkdownViewer.vue non-scoped CSS reduced from ~1180 lines to ~460 lines
