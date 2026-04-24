# Peek MVP — Adversarial Design Review (UI/UX)

> Reviewer: Independent Design Reviewer  
> Date: 2026-04-18  
> Documents reviewed: Implementation plan, requirements spec, tech design, test plan, CEO strategic review  
> Scope: Component architecture, state management, routing, accessibility, responsiveness, theming, interaction flows, error/loading states, information architecture, CSS architecture, Shiki integration, markdown rendering, mobile design

---

## 1. Shiki Integration Creates a New Highlighter Instance Per File — Performance Catastrophe

**Severity: CRITICAL**

The `CodeViewer.vue` component calls `createHighlighter()` inside `onMounted()` for **every single file render**. Each `createHighlighter()` call loads WASM, initializes the Shiki engine, and loads language grammars. This means:

- Viewing an entry with 5 files = 5 full WASM initializations
- Each initialization is ~50-100ms of CPU time + WASM download
- Switching between files destroys the old component and creates a new one, triggering the cycle again
- The `langs: [props.language || 'text']` parameter means each instance only loads ONE language — if the user views a Python file then a TypeScript file, the highlighter is recreated from scratch

The design doc (§12.3) explicitly says "按需加载" (load on demand) but the implementation creates and discards highlighters with no caching or sharing.

**Fix:** Create a singleton highlighter at the app level (in a composable or provide/inject). Load themes and languages on demand into the shared instance. The `useTheme.ts` composable is the right place — it should own the highlighter lifecycle:

```typescript
// composables/useShiki.ts
let highlighterPromise: Promise<Highlighter> | null = null

export function useShiki() {
  async function getHighlighter() {
    if (!highlighterPromise) {
      highlighterPromise = createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: [], // load dynamically
      })
    }
    const hl = await highlighterPromise
    return hl
  }
  return { getHighlighter }
}
```

Then in CodeViewer, load the needed language into the existing highlighter via `hl.loadLanguage(lang)` before rendering.

---

## 2. File Content Fetching Uses the Download Endpoint — Will Trigger Browser Downloads, Not Render Content

**Severity: CRITICAL**

The CEO review already identified this as a backend API issue (missing content endpoint), but the *frontend design* compounds it:

```typescript
// EntryView.vue, line 4021
async function fetchFileContent() {
  const resp = await fetch(downloadUrl.value)
  fileContent.value = await resp.text()
}
```

The `downloadUrl` points to `/api/v1/entries/{slug}/files/{file_id}` which returns `Content-Disposition: attachment`. While `fetch()` ignores Content-Disposition and will get the text, there are two design problems:

1. The download endpoint returns `application/octet-stream` for ALL files — there's no Content-Type discrimination. Markdown files get returned as binary blobs, not `text/markdown`.
2. The `api.client.ts` `downloadFile()` method returns a URL string, not a fetch promise. This means the API client doesn't actually fetch content — the view bypasses the API layer entirely and does raw `fetch()`. This breaks the abstraction and makes error handling inconsistent.

**Fix:** Add a `fetchFileContent(slug, fileId)` method to the API client that calls a dedicated content endpoint (or the existing endpoint with `?inline=true`). The API client should handle Content-Type negotiation and error parsing consistently. The view should never do raw `fetch()` outside the API layer.

---

## 3. FileTree Is Not a Tree — It's a Flat List That Ignores Directory Structure

**Severity: HIGH**

The `FileTree.vue` component renders files as a flat list:

```vue
<div class="tree-item" v-for="file in files" :key="file.id"
     @click="$emit('select', file)">
  <span class="file-name">{{ file.path || file.filename }}</span>
</div>
```

This directly contradicts the requirements (US-01: "多文件保留目录结构，前端渲染为目录树") and the design doc (§12.1: "📁 目录树 ├ src/ │ └ a.py └ b.md"). The component:

- Renders `src/main.py` as the literal string "src/main.py" — no indentation, no folder expansion
- Has no concept of directories, nesting, or expand/collapse
- Shows ALL files at once — no way to collapse directories
- The `getFileIcon()` function uses emoji fallbacks (🐍, 📜, 📘) instead of proper SVG icon sets — these render inconsistently across platforms

The test plan (§4.1, FileTree.vue) includes `test_render_tree_structure()` and `test_deep_nested_structure()`, but the implementation can't pass these tests.

**Fix:** Implement a proper recursive tree component. Transform the flat `FileResponse[]` into a tree structure client-side:

```typescript
interface TreeNode {
  name: string
  path: string
  children: TreeNode[]
  file?: FileResponse  // leaf nodes only
}

function buildTree(files: FileResponse[]): TreeNode[] { ... }
```

Use a recursive `TreeFolder` sub-component for directories with expand/collapse state. Use an icon library (e.g., VS Code Codicons via `@iconify/vue`) instead of emoji.

---

## 4. Theme System Has No Flash of Unstyled Content (FOUC) on Page Load

**Severity: HIGH**

The `ThemeToggle.vue` component reads theme preference in `onMounted()`:

```typescript
onMounted(() => {
  const saved = localStorage.getItem('peek-theme')
  if (saved) {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme()
})
```

This means:
1. The HTML renders first with `:root` (light) CSS variables
2. Then Vue mounts
3. Then `onMounted` fires
4. Then `data-theme="dark"` is applied

Users with dark mode preference see a **white flash** for ~50-200ms on every page load and navigation. This is especially jarring because code blocks in `github-light` theme on a `--bg-primary: #ffffff` background then flip to `github-dark` on `--bg-primary: #0d1117`.

**Fix:** Move theme detection to a blocking `<script>` in `index.html` that runs before Vue mounts:

```html
<script>
  const t = localStorage.getItem('peek-theme')
  const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
</script>
```

The Vue component should read the initial state from `document.documentElement.getAttribute('data-theme')` rather than re-computing.

---

## 5. CSS Architecture: Redundant Theme Files and Missing Design Tokens

**Severity: HIGH**

The plan creates three CSS files:
- `variables.css` — `:root` with light values
- `light.css` — `[data-theme="light"]` with **identical values** to `:root`
- `dark.css` — `[data-theme="dark"]` with dark values

This is wrong on multiple levels:

1. **Redundancy:** `variables.css` and `light.css` have identical declarations. If someone changes a color in one but not the other, they diverge.
2. **No fallback:** If `data-theme` attribute is missing (before JS runs), which set applies? `:root` applies, but if `light.css` overrides `:root` with `[data-theme="light"]`, the specificity is higher and could cause unexpected behavior.
3. **Missing tokens:** The variable set has no spacing scale, no font size scale, no border radius scale, no shadow tokens, no z-index scale. Every component invents its own values: `8px` padding here, `12px` there, `24px` elsewhere. No design system coherence.
4. **No transition on theme change:** When toggling themes, all colors switch instantly with no `transition`. This is visually jarring.
5. **Code block theming gap:** Shiki renders its own inline styles for token colors (e.g., `color: #79c0ff`). These are hardcoded per-theme and don't use CSS variables. The dual-theme approach (`themes: { dark: 'github-dark', light: 'github-light' }`) requires Shiki to output both themes in the HTML with CSS media queries. But the plan uses `data-theme` attribute, not `prefers-color-scheme` — so Shiki's built-in dual-theme switching **won't work** without custom CSS to toggle visibility.

**Fix:**
- Use `:root` for light, `[data-theme="dark"]` for dark only. Remove `light.css`.
- Add design tokens: spacing scale (`--space-1` through `--space-8`), font sizes, radii, shadows, z-index layers.
- Add `transition: background-color 0.2s, color 0.2s, border-color 0.2s` on `:root`.
- For Shiki dual-theme, add CSS: `[data-theme="dark"] .shiki.github-light { display: none; } [data-theme="light"] .shiki.github-dark { display: none; }` or configure Shiki to use CSS variables mode.

---

## 6. Dual-Theme Shiki Rendering Is Broken with `data-theme` Attribute

**Severity: HIGH**

When Shiki renders with dual themes:

```typescript
highlighter.codeToHtml(code, {
  lang: 'python',
  themes: { dark: 'github-dark', light: 'github-light' },
})
```

It outputs HTML with two `<span>` layers controlled by `@media (prefers-color-scheme: dark)` and `@media (prefers-color-scheme: light)`. This **only responds to OS-level color scheme preference**, not to the `data-theme` attribute the app uses for manual theme switching. If a user manually toggles to dark mode but their OS is set to light, the code blocks will render in the wrong theme.

**Fix:** After Shiki renders, post-process the HTML to replace `@media (prefers-color-scheme: dark/light)` with CSS classes controlled by `data-theme`:

```css
[data-theme="dark"] .shiki.github-light { display: none; }
[data-theme="light"] .shiki.github-dark { display: none; }
```

Or use Shiki's CSS variables mode (`cssVariablePrefix: '--shiki-'`) which generates `style="color: var(--shiki-color)"` tokens, then map `--shiki-*` variables in your theme CSS. This is the recommended approach and avoids the media query problem entirely.

---

## 7. EntryView Has No URL-Based File Selection — Deep Linking Is Broken

**Severity: HIGH**

The design doc (§11) specifies routes:
- `/view/:slug?file=main.py` — locate to a specific file
- `/view/:slug#L5-L10` — locate to specific lines

The implementation ignores the `file` query parameter entirely:

```typescript
// EntryView.vue — after fetching entry, always selects first file
if (entry.value.files.length > 0) {
  activeFile.value = entry.value.files[0]
  await fetchFileContent()
}
```

This means:
- Sharing a link to a specific file doesn't work — recipients always see the first file
- Browser back/forward doesn't restore file selection
- The `?file=` query parameter in the requirements is completely non-functional

**Fix:** Read `route.query.file` on mount and match it to the file list:

```typescript
function selectInitialFile() {
  const queryFile = route.query.file as string
  if (queryFile) {
    const match = entry.value.files.find(f => 
      f.path === queryFile || f.filename === queryFile
    )
    if (match) { activeFile.value = match; return }
  }
  activeFile.value = entry.value.files[0]
}
```

Update the URL when files change: `router.replace({ query: { file: activeFile.value.path || activeFile.value.filename } })`.

---

## 8. No Accessibility (a11y) Considerations Anywhere

**Severity: HIGH**

The entire frontend has zero accessibility design:

1. **No ARIA attributes:** FileTree items have no `role="treeitem"`, no `aria-selected`, no `aria-expanded` for directories. The search input has no `aria-label`. Buttons have no `aria-pressed` states.
2. **No keyboard navigation:** FileTree items are `<div>` with `@click` — not focusable, not keyboard-activatable. No `Tab`/`Enter`/`Space`/`Arrow` key support. Pagination buttons work but the entry cards are `div` with `@click` — not accessible via keyboard.
3. **No focus management:** When a file is selected in the tree, focus stays in the tree. The code display area is not announced. No `aria-live` regions for dynamic content changes.
4. **No screen reader support:** The copy button shows "✓" vs "📋" — no `aria-label` to communicate state. The wrap toggle shows "↩" vs "→" — meaningless to screen readers.
5. **No skip navigation:** There's no way to skip from the header to the main content.
6. **Color contrast:** The dark theme uses `--text-secondary: #8b949e` on `--bg-primary: #0d1117` — this is 4.6:1 contrast ratio, which passes WCAG AA for normal text but fails for small text (the plan uses `13px` throughout).
7. **Motion sensitivity:** No `prefers-reduced-motion` consideration for any transitions.

**Fix:** Add at minimum:
- `role="tree"` / `role="treeitem"` / `aria-selected` to FileTree
- Use `<button>` instead of `<div @click>` for interactive elements
- Add `aria-label` to all icon-only buttons
- Add `aria-live="polite"` to the file display area
- Verify all interactive elements are keyboard-focusable and -activatable
- Add `@media (prefers-reduced-motion: reduce)` to disable transitions

---

## 9. Mobile/Responsive Design Is Not Implemented — Only Mentioned in Requirements

**Severity: HIGH**

The requirements (US-07) specify:
- "内容区自适应屏幕宽度"
- "目录树折叠为抽屉/菜单"
- "Markdown 大纲折叠"
- "代码区支持左右滑动"

The implementation has:
- Fixed `max-width: 1200px` on EntryView and `max-width: 900px` on IndexView — no mobile breakpoints
- The FileTree sidebar uses `display: flex` with no responsive fallback — on mobile it renders as a tiny column next to code
- No CSS media queries for mobile anywhere in the plan
- No hamburger menu, no slide-out drawer, no bottom sheet pattern
- Code blocks have `overflow-x: auto` (good) but no touch-scroll indicators or horizontal scroll hints
- The `EntryView` layout `display: flex` with `FileTree` beside `file-display` will squish both columns on mobile

**Fix:** Add responsive breakpoints:

```css
/* EntryView mobile */
@media (max-width: 768px) {
  .entry-content { flex-direction: column; }
  .file-tree { 
    border-right: none; 
    border-bottom: 1px solid var(--border-color);
    max-height: 40vh;
    overflow-y: auto;
  }
}
```

For the FileTree, implement a mobile drawer pattern: on mobile, show a "Files" button that opens a slide-out overlay. Use `@media` queries or a `useBreakpoint()` composable.

---

## 10. State Management Is Scattered — No Composable Reuse

**Severity: MEDIUM**

The plan defines two composables:
- `useTheme.ts` — theme logic
- `useEntry.ts` — entry data fetching

But neither is actually used in the implementation. The views do all state management inline:
- `IndexView.vue` manages `entries`, `searchQuery`, `page`, `total`, `totalPages`, `debounceTimer` directly
- `EntryView.vue` manages `entry`, `activeFile`, `fileContent`, `loading`, `error` directly
- `ThemeToggle.vue` manages its own `isDark` state instead of using `useTheme`

Problems:
1. **No shared state:** If the user navigates from IndexView → EntryView → back, the index page refetches from scratch. No entry data is cached.
2. **Theme state is duplicated:** ThemeToggle manages theme independently. If another component needs to know the theme (e.g., CodeViewer for Shiki), there's no shared reactive source.
3. **`useEntry.ts` is declared but never implemented:** It's in the file structure but no code is provided. The views bypass it entirely.
4. **No global error handling:** Each view has its own `try/catch` with `console.error`. There's no centralized error state, no toast/notification system, no retry mechanism.

**Fix:** Implement `useEntry.ts` as a shared composable with a simple cache:

```typescript
const entryCache = new Map<string, { data: EntryResponse, timestamp: number }>()

export function useEntry() {
  const entry = ref<EntryResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  async function fetchEntry(slug: string, maxAge = 30_000) {
    const cached = entryCache.get(slug)
    if (cached && Date.now() - cached.timestamp < maxAge) {
      entry.value = cached.data; return
    }
    loading.value = true; error.value = null
    try {
      entry.value = await api.getEntry(slug)
      entryCache.set(slug, { data: entry.value, timestamp: Date.now() })
    } catch (e: any) {
      error.value = e.message
    } finally { loading.value = false }
  }
  return { entry, loading, error, fetchEntry }
}
```

Implement `useTheme.ts` as a shared reactive singleton with `provide/inject` or a module-level ref.

---

## 11. Markdown Rendering Has No TOC, No Code Block Highlighting, No Copy Button

**Severity: HIGH**

The `MarkdownViewer.vue` component is a minimal markdown-it wrapper that:
1. **Renders no Table of Contents** — despite TocNav.vue being in the component list and the design doc (§12.2) showing a TOC panel
2. **No syntax highlighting for code blocks** — markdown-it renders `<code>` blocks as plain text. The plan mentions Shiki for markdown code blocks but the implementation doesn't use it
3. **No copy button for code blocks** — US-06 requires "Markdown 内代码块右上角有一键复制按钮"
4. **No table overflow handling** — the design doc says "超出宽度支持左右拖动" but the CSS only does `width: 100%; border-collapse: collapse` — wide tables will overflow and break layout
5. **No Mermaid rendering** — despite being in package.json dependencies and the design doc specifying it

The `MarkdownViewer` in the plan is a ~30-line component that can't meet the requirements. A production-ready markdown renderer for a code display tool needs significantly more infrastructure.

**Fix:** Implement a proper markdown pipeline:
1. Use `markdown-it` with plugins: `markdown-it-anchor` (for heading IDs), `markdown-it-toc-done-right` (for TOC generation)
2. Post-process code blocks with Shiki (using the shared highlighter)
3. Inject copy buttons into code blocks via a post-render DOM manipulation or a custom markdown-it plugin
4. Add `overflow-x: auto` and `display: block` to table wrappers
5. For Mermaid, dynamically import `mermaid` and render after DOM mount, with error fallback

---

## 12. Error States Are Text-Only Strings — No Visual Design

**Severity: MEDIUM**

Both views display errors as plain text:

```vue
<div v-if="loading" class="loading">Loading...</div>
<div v-else-if="error" class="error">{{ error }}</div>
```

Problems:
1. **No visual hierarchy:** Loading and error states have the same styling (`text-align: center; padding: 48px; color: var(--text-secondary)`)
2. **No error illustration or icon:** Users see a blank page with "Failed to load entry" — no indication of what went wrong or what to do
3. **No retry mechanism:** The error is a dead end. No "Try again" button.
4. **No 404-specific state:** A 404 (entry not found) shows the same generic error as a 500 (server error). Different errors need different UX responses.
5. **No error categorization:** The API client throws a generic `Error` with just a message string. The error code from the API (`NOT_FOUND`, `INTERNAL_ERROR`) is lost — the frontend can't distinguish error types.
6. **No loading skeleton/skeleton screen:** Just the string "Loading..." — no visual indication of what's being loaded or where content will appear.

**Fix:**
- Create an `ErrorDisplay.vue` component with: error icon/illustration, contextual message, retry button, and different variants for 404/network/500
- Add loading skeleton components that mirror the expected layout
- Preserve the API error code in the thrown error object:

```typescript
class PeekApiError extends Error {
  constructor(public code: string, message: string) { super(message) }
}
// In client.ts:
if (!resp.ok) {
  const err = await resp.json()
  throw new PeekApiError(err.error.code, err.error.message)
}
```

---

## 13. Component Granularity — Missing Components and Over-Condensed Views

**Severity: MEDIUM**

The plan lists 10 components but the implementation creates only 4 (CodeViewer, MarkdownViewer, FileTree, ThemeToggle). The following components from the design are missing or inlined:

| Component | Status | Problem |
|-----------|--------|---------|
| `SearchBar.vue` | **Inlined into IndexView** | Search logic (debounce, query, tag filter) is mixed with list rendering |
| `EntryCard.vue` | **Inlined into IndexView** | Card rendering, tag display, date formatting all inline |
| `ActionBar.vue` | **Not implemented** | Copy/download/zip buttons are scattered — copy is in CodeViewer, download is inline in EntryView |
| `TocNav.vue` | **Not implemented** | TOC navigation for markdown completely absent |
| `ImageViewer.vue` | **Not implemented** | Images would fall through to BinaryViewer (download link) |
| `BinaryViewer.vue` | **Inlined as a `<div>`** | No component, just inline HTML in EntryView |

Meanwhile, `IndexView.vue` is ~60 lines of template + ~40 lines of script + ~20 lines of CSS — it's doing too much. The search input, debounce logic, entry card rendering, pagination, and empty state should be decomposed.

**Fix:** Extract components as designed:
- `SearchBar.vue` — handles input, debounce, clear, emits search events
- `EntryCard.vue` — renders a single entry with tags, date, status
- `ActionBar.vue` — copy, download, zip buttons with loading/disabled states
- `BinaryViewer.vue` — download link with file size, mime type
- `ImageViewer.vue` — inline image with error fallback

---

## 14. IndexView Search Has No Tag Filtering UI

**Severity: MEDIUM**

The requirements (US-04) specify "支持按标签过滤" and the API supports `?tags=python`. But the IndexView only has a text search input — no tag filter UI:

```vue
<input v-model="searchQuery" placeholder="Search..." @input="debouncedSearch" class="search-input" />
```

There's no way to:
- See available tags
- Select tags to filter by
- Combine search + tag filter
- Clear tag filters

The `api.listEntries()` supports `tags` parameter but it's never called with it.

**Fix:** Add tag filtering UI. Two approaches:
1. **Simple:** Show tags as clickable chips above/below the search input. When clicked, add to active filters. Show active filters as dismissible chips.
2. **Dropdown:** Add a tag dropdown/popover that lists available tags with checkboxes.

For MVP, fetch popular tags from the entries data (extract from the list response) and render as clickable chips.

---

## 15. SPA Routing Will 404 on Direct URL Access in Production

**Severity: MEDIUM**

The router uses `createWebHistory()` (HTML5 history mode). In production, FastAPI serves static files. When a user navigates to `/view/my-slug` directly (or refreshes the page), the browser sends `GET /view/my-slug` to FastAPI. FastAPI has no route for this — it returns a 404.

The test plan mentions `test_spa_fallback_routing()` but the implementation has no catch-all route in FastAPI to serve `index.html` for SPA routes.

**Fix:** In `main.py`, add a catch-all route after the API routes:

```python
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# After API routes
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    return FileResponse("static/index.html")
```

---

## 16. CodeViewer Fallback Rendering Has XSS Vulnerability

**Severity: MEDIUM**

The CodeViewer fallback (when Shiki fails) manually builds HTML:

```typescript
highlighted.value = '<pre>' + lines.map((line, i) =>
  `<span class="line-number">${i + 1}</span> ${escapeHtml(line)}`
).join('\n') + '</pre>'
```

This HTML is then rendered via `v-html="highlighted"`. While `escapeHtml()` escapes the line content, the overall approach is fragile:

1. The `escapeHtml` function only handles `&`, `<`, `>` — it doesn't escape `"`, `'`, or backticks, which could break out of the HTML context in edge cases
2. The approach of building HTML strings and using `v-html` is inherently risky — any missed escape becomes an XSS vector
3. Code content from user-uploaded files is untrusted — it could contain crafted payloads

**Fix:** Use Vue's template rendering instead of `v-html` for the fallback:

```vue
<div class="code-content" :class="{ wrap }">
  <pre v-if="highlighted" v-html="highlighted"></pre>
  <pre v-else>
    <div v-for="(line, i) in content.split('\n')" :key="i" class="code-line">
      <span class="line-number">{{ i + 1 }}</span>
      <span class="line-content">{{ line }}</span>
    </div>
  </pre>
</div>
```

This way, the fallback path uses Vue's automatic escaping and never touches `v-html`.

---

## 17. No Loading State for File Content — User Sees Stale Content During Switches

**Severity: MEDIUM**

When a user clicks a different file in the FileTree, `watch(activeFile, fetchFileContent)` triggers. But during the fetch:

1. The CodeViewer/MarkdownViewer still shows the **previous file's content**
2. There's no loading indicator on file switch
3. If the fetch fails, `fileContent.value` remains as the previous file's content — now showing wrong content

```typescript
async function fetchFileContent() {
  if (!activeFile.value || activeFile.value.is_binary) return
  try {
    const resp = await fetch(downloadUrl.value)
    fileContent.value = await resp.text()
  } catch {
    fileContent.value = ''  // Silently clears — better than showing wrong content, but still bad UX
  }
}
```

**Fix:** Add a `fileLoading` ref and clear content immediately on file switch:

```typescript
const fileLoading = ref(false)

async function fetchFileContent() {
  fileContent.value = ''  // Clear immediately — don't show stale content
  fileLoading.value = true
  try {
    const resp = await fetch(downloadUrl.value)
    fileContent.value = await resp.text()
  } catch {
    // Show error in file display area
  } finally {
    fileLoading.value = false
  }
}
```

Add a loading skeleton in the template for the file display area.

---

## 18. API Client Doesn't Handle Non-JSON Error Responses

**Severity: MEDIUM**

```typescript
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, { ... })
  if (!resp.ok) {
    const err: PeekError = await resp.json()  // Crashes if response is not JSON
    throw new Error(err.error?.message || `HTTP ${resp.status}`)
  }
  return resp.json()
}
```

If the server returns HTML (e.g., a 502 from a reverse proxy), or if `resp.json()` fails, the error handler itself throws an unhelpful `SyntaxError: Unexpected token < in JSON`. The user sees a cryptic error message.

**Fix:**

```typescript
if (!resp.ok) {
  let message = `HTTP ${resp.status}`
  try {
    const body = await resp.json()
    message = body.error?.message || message
  } catch { /* not JSON, use default message */ }
  throw new Error(message)
}
```

---

## 19. Pagination UX Is Minimal — No Page Numbers, No Total Count Display

**Severity: LOW**

The pagination is just `← 1 / 5 →`:

```vue
<div class="pagination" v-if="totalPages > 1">
  <button @click="page--" :disabled="page <= 1">←</button>
  <span>{{ page }} / {{ totalPages }}</span>
  <button @click="page++" :disabled="page >= totalPages">→</button>
</div>
```

Missing:
- No clickable page numbers — users must click through one at a time
- Arrow characters `←`/`→` are not accessible (screen readers read them as "left arrow" not "previous page")
- No total items display (e.g., "Showing 1-20 of 142 entries")
- No ability to jump to a specific page
- The `totalPages` calculation is fragile: `Math.ceil(resp.total / resp.per_page)` — if `per_page` is 0 or undefined, this produces `Infinity` or `NaN`

**Fix:** Use accessible button labels (`aria-label="Previous page"`), add total count display, and add page number buttons for small page counts.

---

## 20. MarkdownViewer Creates a New markdown-it Instance Per Render

**Severity: LOW**

```typescript
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})
```

This creates a new MarkdownIt instance every time the component is instantiated. While MarkdownIt is lightweight, this is wasteful and prevents plugin registration (plugins are added to a specific instance). When the user switches between markdown files, the old instance is destroyed and a new one is created.

**Fix:** Create the MarkdownIt instance at module level:

```typescript
const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
// Add plugins here once
```

---

## Summary Scorecard

| Dimension | Score (1-10) | Key Issue |
|-----------|-------------|-----------|
| Component architecture | 4 | Missing 6 components; views are over-condensed |
| State management | 3 | Composables declared but unused; no caching; no shared state |
| Routing & navigation | 4 | No deep linking; SPA fallback missing; URL params ignored |
| Accessibility | 1 | Zero a11y — no ARIA, no keyboard nav, no screen reader support |
| Responsive/mobile | 2 | Only mentioned in requirements; zero responsive CSS |
| Theme system | 3 | FOUC on load; redundant CSS files; Shiki dual-theme broken |
| Error & loading states | 3 | Text-only errors; no retry; no skeleton; stale file content |
| Information architecture | 5 | Entry list → detail flow works; tag filtering missing; TOC missing |
| CSS architecture | 3 | No design tokens; no spacing scale; no transitions on theme change |
| Shiki integration | 2 | Per-file highlighter creation; dual-theme broken; no fallback to CSS vars |
| Markdown pipeline | 3 | No TOC; no code highlighting; no copy buttons; no Mermaid |
| Interaction flows | 5 | Basic flows work; file switching has no loading state; copy feedback works |

**Overall: 3.2 / 10**

The frontend plan produces a visually functional prototype but has critical gaps in three areas: (1) Shiki integration is fundamentally broken — per-instance creation and dual-theme mismatch mean code highlighting will be slow and wrong, (2) mobile/responsive is entirely absent despite being a stated requirement, and (3) accessibility is zero. The component architecture is declared but not implemented, with too much logic crammed into two view components.

---

## Top 5 Priority Fixes (Before Building the Frontend)

1. **Fix Shiki integration** — singleton highlighter, CSS variables mode, lazy language loading (blocks all code display)
2. **Fix the file content endpoint** — add `/content` endpoint or `?inline=true` parameter; route through API client (blocks all file rendering)
3. **Implement responsive layout** — mobile breakpoints, FileTree drawer, code block horizontal scrolling (required by US-07)
4. **Add FOUC-free theme system** — inline script in index.html, remove redundant light.css, add Shiki CSS variable integration (affects every page load)
5. **Implement FileTree as an actual tree** — recursive directory structure, expand/collapse, keyboard navigation (required by US-01, core to the product's value proposition)
