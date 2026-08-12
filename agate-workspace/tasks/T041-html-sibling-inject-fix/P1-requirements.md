---
phase: P1
task_id: T041-html-sibling-inject-fix
type: requirements
parent: P0-brief.md
trace_id: T041-P1-20260630
status: draft
created: 2026-06-30
---

# P1 Requirements — T041: HTML Sibling Injection Fix & Enhancement

## 1. Requirements Restatement

Fix 2 bugs and add 4 enhancements to the HTML sibling injection system (backend `html_render_service.py` + frontend `HtmlViewer.vue`):

| # | Type | Item | Summary |
|---|------|------|---------|
| 1 | Bug | sandbox 缺 allow-forms | `HtmlViewer.vue` iframe sandbox 缺 `allow-forms`，表单 submit 事件无法触发 |
| 2 | Bug | module script 注入失效 | `html_render_service.py` 跳过 `type="module"` script，导致 ES module JS 完全无法注入 |
| 3 | Enhancement | 警告文案修正 | 前端警告条声称"不支持多文件相对路径，资源不会加载"，但简单场景注入已正常工作 |
| 4 | Enhancement | CSS 内部引用注入 | 后端不解析 CSS 内的 `@import url()` 和 `background: url()` 引用 |
| 5 | Enhancement | SVG-as-img 注入 | `<img src="diagram.svg">` 中 SVG 是文本文件，不被识别为二进制资源 |
| 6 | Enhancement | ../ 路径归一化 | `normalize_ref("../style.css")` 返回 `../style.css`，无法匹配 sibling key `style.css` |

## 2. Implicit Requirements

### 2.1 Data
- No schema changes, no migration needed. Changes affect injection logic and iframe attributes only.

### 2.2 Frontend
- `HtmlViewer.vue`: sandbox attribute + warning text (same component, 2 changes)
- `countRelativePaths()`: warning count may decrease after backend improvements (CSS/JS injected → no longer "unsupported") — but the count logic is client-side DOM-based, independent of injection. No change needed.

### 2.3 Multi-end Sync
- No MCP/CLI/API sync needed. These are rendering-only changes (render endpoint + iframe display).

### 2.4 Edge Cases & Boundaries

| Edge Case | Impact | Handling |
|-----------|--------|----------|
| CSS `@import` circular reference | Infinite recursion | Recursive depth limit of 3 (per P0) + visited set to break cycles |
| CSS `url()` inside string literals (e.g. `content: "url(bg.png)"`) | Regex false positive | Use non-greedy regex with quote-awareness; accept minor false positive rate as documented risk |
| `../a/style.css` + `../b/style.css` both map to `style.css` basename | First-wins collision in `_sibling_keys` | First-wins (dict key assignment order); document as known limitation for flat-file scenarios |
| Inline module script with `import './dep.js'` | Relative import path cannot be resolved by BS4 static analysis | Hard limit — cannot fix. If HTML has `<script type="importmap">`, sibling JS can register. Otherwise warn. |
| SVG file containing `<script>` | XSS vector | sandbox iframe (`allow-scripts` without `allow-same-origin`) provides isolation. SVG content runs in opaque origin. Acceptable. |
| `allow-forms` + `allow-scripts` + CSP `form-action 'none'` browser consistency | Form submit fires JS event but no navigation | Well-supported in Chrome/Firefox/Safari. CSP takes precedence over sandbox for navigation. |

### 2.5 Compatibility
- `allow-forms` attribute: supported in all modern browsers (IE10+)
- `type="module"` on inline script: supported in Chrome 69+, Firefox 60+, Safari 10.1+
- `data:image/svg+xml` inline: supported in all modern browsers
- **No breaking changes** to existing injection behavior — all changes are additive or corrective

## 3. BDD Acceptance Criteria

### Bug 1: sandbox allow-forms

```gherkin
Given an HTML file containing <form><button type="submit">Go</button></form>
When the file is rendered in PeekView's iframe
Then the sandbox attribute includes "allow-forms"
And clicking the submit button triggers the form's submit event (JS can intercept)
And no actual navigation occurs (CSP form-action 'none' blocks it)
```

### Bug 2: module script injection

```gherkin
Given an HTML file with <script type="module" src="app.js">
And a sibling file "app.js" with ES module content
When the HTML is rendered with sibling injection
Then the original <script type="module" src="app.js"> is replaced with an inline <script type="module">
And the module script content is inlined (not appended as a second script)
And "app.js" is marked as used (not duplicated in unreferenced JS append)
```

```gherkin
Given an HTML file with <script type="importmap">...</script> followed by <script type="module" src="app.js">
When the HTML is rendered with sibling injection
Then the importmap script is preserved unchanged
And the module script is inlined with type="module" preserved
```

### Enhancement 3: Warning text

```gherkin
Given an HTML file with N local resource references
When the relative path warning is displayed
Then the text says "此 HTML 含 N 个本地资源引用，PeekView 将尝试自动注入。部分引用可能无法注入（如动态加载、嵌套 iframe 等）。"
And the text does NOT say "不支持" or "不会加载"
```

### Enhancement 4: CSS internal reference injection

```gherkin
Given an HTML file referencing <link rel="stylesheet" href="main.css">
And "main.css" contains @import url("theme.css");
And "theme.css" is a sibling file with body { background: #eee; }
When the HTML is rendered with sibling injection
Then the inlined <style> for main.css has @import url("theme.css") replaced with the content of theme.css
```

```gherkin
Given an HTML file referencing <link rel="stylesheet" href="main.css">
And "main.css" contains background-image: url("bg.png");
And "bg.png" is a sibling binary file
When the HTML is rendered with sibling injection
Then the inlined <style> for main.css has url("bg.png") replaced with a data URI for bg.png
```

```gherkin
Given CSS files with circular @import (A imports B, B imports A)
When the HTML is rendered with sibling injection
Then the CSS internal reference processing terminates (does not loop infinitely)
And the output contains at least the first level of replacement
```

### Enhancement 5: SVG-as-img injection

```gherkin
Given an HTML file with <img src="diagram.svg">
And "diagram.svg" is a text file (is_binary=false) with language="xml" or filename ending in .svg
When the HTML is rendered with sibling injection
Then the <img src> is replaced with data:image/svg+xml;charset=utf-8,{svg_content}
```

```gherkin
Given an HTML file with <img src="photo.png">
And "photo.png" is a binary file (is_binary=true)
When the HTML is rendered with sibling injection
Then the <img src> is replaced with the base64 data URI (existing behavior, unchanged)
```

### Enhancement 6: ../ path normalization

```gherkin
Given an HTML file with <link rel="stylesheet" href="../style.css">
And a sibling file with filename "style.css"
When the HTML is rendered with sibling injection
Then normalize_ref("../style.css") matches the sibling key "style.css"
And the CSS is inlined correctly
```

```gherkin
Given an HTML file with <script src="../js/app.js">
And a sibling file with path "js/app.js" and filename "app.js"
When the HTML is rendered with sibling injection
Then the script src matches via the basename fallback key "app.js"
And the JS is inlined correctly
```

## 4. Confirmation Items

No `[NEED_CONFIRM]` items. All requirements have clear direction from P0-brief with unambiguous technical resolution.

## 5. Pruning

| Phase | Included | Reason if skipped |
|-------|----------|-------------------|
| P1 | Yes | — |
| P2 | Yes | Backend injection logic modification (module script, CSS @import, SVG, path normalization) requires design review |
| P3 | Yes | TDD — injection logic is complex with multiple edge cases |
| P4 | Yes | — |
| P5 | Yes | pytest must pass, isolation verified |
| P6 | Yes | BDD acceptance must be verified; UI changes (sandbox, warning text) need visual confirmation |
| P7 | No | Changes span 2 files (1 backend service + 1 frontend component) with no cross-cutting consistency risk |
| P8 | No | No version bump needed — bug fix + enhancement, not a release milestone |

**phases: [P1, P2, P3, P4, P5, P6]**

## 6. Scope Declaration

```yaml
packages:
  - peekview (backend)
  - frontend-v3

domains:
  - backend: html_render_service.py (injection logic)
  - backend: tests/test_html_render.py (test coverage)
  - frontend: HtmlViewer.vue (sandbox + warning text)

ui_affected:
  - iframe sandbox attribute
  - relative path warning text content

security_affected: true
security_notes:
  - sandbox allow-forms adds form submit capability (mitigated by CSP form-action 'none')
  - SVG inline injection could contain <script> (mitigated by sandbox iframe opaque origin)
  - CSS @import regex replacement must not introduce injection vectors
```

## 7. Capability Requirements

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证 iframe 内表单交互 + module script 执行 + SVG 渲染
    available:
      - playwright-cdp skill
      - vision-analyzer skill
    status: available

  - need: sandbox-iframe-testing
    why: 验证 allow-forms + form-action 'none' 的交互行为
    available:
      - Playwright CDP (localhost:18800)
    status: available
    requires_minimal_validation: true
```
