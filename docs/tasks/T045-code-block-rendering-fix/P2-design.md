---
phase: P2
task_id: T045-code-block-rendering-fix
type: design
trace_id: T045-P2-20260701
status: draft
agent: architect
created: 2026-07-01
parent: P1-requirements.md
---

# T045 Code Block Rendering Fix — 方案设计

## 影响域分析

### 改什么

| 文件 | 改动 | 理由 |
|------|------|------|
| `useShiki.ts` | `highlightCode()` 补行号生成，输出结构与 `highlight()` 一致 | B05-B08：Markdown/Diagram 代码块需行号 |
| `useMarkdown.ts` | Diagram codeViewHtml 改用 `highlightCode()`（mermaid/plantuml 也走 Shiki）；DOMPurify 白名单补 `div`/`span` 的 class 属性 | B05-B08 + 隐含需求 #2：mermaid/plantuml 当前用 `escapeHtml()` 无 `.line` 结构 |
| `MarkdownViewer.vue` | 新增 `.line { display: block }` 规则；修复 zebra 选择器优先级（覆盖 `pre * transparent`） | B01 + 隐含需求 #3：根因修复 |
| `DiagramBlock.vue` | `.diagram-code` 区域适配新 DOM 结构（`.code-container` + `.line-numbers` + `.line`） | B02 + 隐含需求 #1：DOM 结构变化 |
| `variables.css` | `--bg-code-even` 色值调整（dark: `#1c2536`, light: `#d4d9e2`） | B03-B04：≥8% HSL 亮度差异 |
| `code.css` | 无改动（CodeViewer 已正确） | B09：无回归 |

### 不改什么

- `CodeViewer.vue` — 行号/zebra 已正常，不触碰
- `code.css` — CodeViewer 的 `.code-body :deep(.line)` 规则已正确
- Shiki 主题/语言加载逻辑 — 不涉及
- 后端 — 纯前端视觉修复

### 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| `highlightCode()` 输出结构变化 → MarkdownViewer/DiagramBlock CSS 选择器失效 | zebra + 行号样式丢失 | P6 视觉验证覆盖 |
| DOMPurify 过滤新 DOM 元素（`.code-container`/`.line-numbers`/`.line-number`） | 行号被清除 | `div`/`span` 是 DOMPurify 默认允许标签，class 属性默认保留；需验证 |
| `pre * { background: transparent !important }` 优先级问题 | zebra 背景仍被覆盖 | 选择器特异性必须高于 `pre *`（详见方案 §1） |
| DiagramBlock mermaid/plantuml 改走 Shiki 高亮 → 加载延迟 | code mode 切换卡顿 | Shiki 已在 `useMarkdown.render()` 中异步调用，DiagramBlock 只消费结果，无额外延迟 |

## 改动方案

### §1 Zebra stripe 整行背景（B01-B02）

**根因**：MarkdownViewer 的 `[data-theme='dark'] .markdown-body pre * { background-color: transparent !important }` (line 246-249) 把所有 `pre` 子元素的背景强制透明，`.line:nth-child(even)` 的 zebra 背景被覆盖。

**修复**：

1. **`.line` 设为 `display: block`**：Shiki 输出的 `.line` 是 `<span>`（inline），背景只覆盖文字宽度。加 `display: block` 使背景铺满整行。

2. **zebra 选择器优先级提升**：当前 zebra 规则 `.markdown-body .code-block-wrapper .line:nth-child(even)` 特异性为 (0,2,1)，而 `pre *` 特异性为 (0,0,1) 但有 `!important`。zebra 也有 `!important`（dark 模式），但 `pre *` 的 `!important` 把特异性打平后按源码顺序，`pre *` 在后面所以赢。

   **方案**：将 zebra 规则移到 `pre * transparent` 规则**之后**，并确保选择器特异性足够。具体：
   - 删除当前 line 252-258 的 zebra 规则
   - 在 `pre * transparent` 规则块**之后**新增：
     ```css
     .markdown-body .code-block-wrapper pre .line:nth-child(even) {
       background-color: var(--bg-code-even) !important;
     }
     [data-theme='dark'] .markdown-body .code-block-wrapper pre .line:nth-child(even) {
       background-color: var(--bg-code-even) !important;
     }
     ```
   - 选择器 `.code-block-wrapper pre .line:nth-child(even)` 特异性 (0,3,2) > `pre *` (0,0,1)，加上 `!important`，确保覆盖。

3. **`.line { display: block }` 规则**：在 MarkdownViewer 的非 scoped style 中新增：
   ```css
   .markdown-body .code-block-wrapper .line {
     display: block;
   }
   ```

4. **DiagramBlock zebra**：当前 `.diagram-block .diagram-code .line:nth-child(even)` (line 336-338) 在 `highlightCode` 改为输出 `.code-container` 后，`.line` 的父元素从 `<code>` 变为 `<pre><code>`，`:nth-child` 仍生效（`.line` 是 `<code>` 的直接子元素，`nth-child` 计数不受外层影响）。但需确认 DiagramBlock 没有 `pre * transparent` 覆盖问题 — 已确认 DiagramBlock 无此规则，无需额外处理。

### §2 配色调整（B03-B04）

**当前值**：
- Dark: `--bg-code: #0e131b`, `--bg-code-even: #131920` — HSL 亮度差 2.4%
- Light: `--bg-code: #eef0f3`, `--bg-code-even: #e8ebef` — HSL 亮度差 2.0%

**新值**（≥8% HSL 亮度差异）：
- Dark: `--bg-code-even: #1c2536` — HSL L=16.1%, 与 odd(8.0%) 差 8.1% ✅
- Light: `--bg-code-even: #d4d9e2` — HSL L=85.9%, 与 odd(94.3%) 差 8.4% ✅

**改动位置**：`variables.css` line 61 (dark) 和 line 116 (light)。

**验证方法**：P6 截图对比 dark/light 主题下 odd/even 行可辨识度。

### §3 行号生成（B05-B08）

**根因**：`highlightCode()` 只调用 `codeToHtml()` 返回裸 `<pre><code>...</code></pre>`，无行号。`highlight()` 额外调用 `renderLineNumbers()` 并包裹在 `.code-container` 中。

**方案**：修改 `highlightCode()` 使其输出与 `highlight()` 相同的 `.code-container` 结构（含行号），但**不改变函数签名**。

```typescript
async function highlightCode(
  code: string,
  lang: string,
  theme: 'github-dark' | 'github-light'
): Promise<string> {
  const highlighter = await getHighlighter()
  const effectiveLang = await ensureLanguage(highlighter, lang)

  const html = highlighter.codeToHtml(code, {
    lang: effectiveLang,
    theme
  })

  const lineNumbersHtml = renderLineNumbers(code)
  return `<div class="code-container">${lineNumbersHtml}${html}</div>`
}
```

**影响分析**：

1. **MarkdownViewer**：`highlightCode()` 的返回值从 `<pre>...</pre>` 变为 `<div class="code-container"><div class="line-numbers">...</div><pre>...</pre></div>`。`buildCodeBlockWrapper()` 将其嵌入 `.code-block-wrapper`，DOM 层级变为：
   ```
   .code-block-wrapper
     .code-block-header
     .code-container
       .line-numbers
         .line-number × N
       pre.shiki
         code
           .line × N
   ```
   需要为 `.code-block-wrapper` 内的 `.code-container`/`.line-numbers`/`.line-number` 添加样式（复用 `code.css` 的布局模式）。

2. **DiagramBlock**：`codeViewHtml` 从 `<pre class="shiki"><code>...</code></pre>` 变为 `<div class="code-container">...</div>`。DiagramBlock 的 `.diagram-code` CSS 需适配新结构。

3. **Mermaid/PlantUML code mode**：当前用 `escapeHtml()` 渲染，无 `.line` 元素。改为调用 `highlightCode(code, lang, theme)`：
   - Mermaid: `highlightCode(code, 'mermaid', theme)` — Shiki 已加载 mermaid 语言
   - PlantUML: `highlightCode(code, 'text', theme)` — PlantUML 无 Shiki 语法，回退 text
   - 这样 mermaid/plantuml code mode 也有 `.line` 结构 + 行号 + 语法高亮（mermaid）

4. **DOMPurify**：`div`/`span` 是默认允许标签，`class`/`aria-hidden` 属性默认保留。`div.code-container`、`div.line-numbers`、`span.line-number` 均可通过 DOMPurify。**无需修改 DOMPurify 配置**。

### §4 MarkdownViewer 行号样式

MarkdownViewer 的代码块在 `.code-block-wrapper` 内，行号样式需与 CodeViewer 一致。复用 `code.css` 的布局模式，在 MarkdownViewer 的非 scoped style 中新增：

```css
.markdown-body .code-block-wrapper .code-container {
  display: flex;
  background: var(--bg-code);
}

.markdown-body .code-block-wrapper .line-numbers {
  flex-shrink: 0;
  padding: var(--space-4) 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  text-align: right;
  user-select: none;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

.markdown-body .code-block-wrapper .line-number {
  display: block;
  padding: 0 var(--space-3);
  color: var(--text-tertiary);
  min-width: 3ch;
  height: 1.6em;
}

.markdown-body .code-block-wrapper pre {
  flex: 1;
  margin: 0;
  padding: var(--space-4);
  background: transparent !important;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

.markdown-body .code-block-wrapper code {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
  display: flex;
  flex-direction: column;
}
```

Dark 模式下行号列背景和边框需额外覆盖：
```css
[data-theme='dark'] .markdown-body .code-block-wrapper .line-numbers {
  background: #161b22;
  border-right-color: #30363d;
}
```

### §5 DiagramBlock 行号样式

DiagramBlock 的 `.diagram-code` 区域需适配 `.code-container` 结构：

```css
.diagram-block .diagram-code .code-container {
  display: flex;
  background: var(--bg-code);
}

.diagram-block .diagram-code .line-numbers {
  flex-shrink: 0;
  padding: var(--space-3) 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  text-align: right;
  user-select: none;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

.diagram-block .diagram-code .line-number {
  display: block;
  padding: 0 var(--space-3);
  color: var(--text-tertiary);
  min-width: 3ch;
  height: 1.6em;
}

.diagram-block .diagram-code pre {
  flex: 1;
  margin: 0;
  padding: var(--space-3);
  background: transparent !important;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
}

.diagram-block .diagram-code code {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  line-height: 1.6;
  display: flex;
  flex-direction: column;
}

.diagram-block .diagram-code .line {
  display: block;
  height: 1.6em;
}
```

Zebra 选择器更新（适配 `.code-container` 内的 `.line`）：
```css
.diagram-block .diagram-code .line:nth-child(even) {
  background-color: var(--bg-code-even);
}
```
此规则无需改动 — `.line` 仍是 `<code>` 的直接子元素，`:nth-child` 计数正确。

### §6 useMarkdown.ts Diagram codeViewHtml 改造

当前代码 (line 272-277)：
```typescript
if (codeBlock.lang === 'svg') {
  codeViewHtml = '<pre class="shiki"><code>' + await highlightCode(codeBlock.code, 'xml', theme) + '</code></pre>'
} else {
  codeViewHtml = '<pre class="shiki"><code>' + escapeHtml(codeBlock.code) + '</code></pre>'
}
```

改为：
```typescript
if (codeBlock.lang === 'svg') {
  codeViewHtml = await highlightCode(codeBlock.code, 'xml', theme)
} else if (codeBlock.lang === 'mermaid') {
  codeViewHtml = await highlightCode(codeBlock.code, 'mermaid', theme)
} else {
  codeViewHtml = await highlightCode(codeBlock.code, 'text', theme)
}
```

`highlightCode()` 现在返回完整的 `.code-container` 结构，无需外层 `<pre><code>` 包裹。

## BDD 覆盖映射

| BDD | 方案节 | 关键改动 |
|-----|--------|----------|
| B01 Zebra 整行（Markdown） | §1 | `.line { display: block }` + zebra 选择器优先级提升 |
| B02 Zebra 整行（Diagram） | §1+§5 | DiagramBlock `.line { display: block }` + `.code-container` 适配 |
| B03 Zebra 对比度（dark） | §2 | `--bg-code-even: #1c2536` (HSL diff 8.1%) |
| B04 Zebra 对比度（light） | §2 | `--bg-code-even: #d4d9e2` (HSL diff 8.4%) |
| B05 Markdown 行号 | §3+§4 | `highlightCode()` 补行号 + MarkdownViewer 行号样式 |
| B06 Mermaid 行号 | §3+§6 | mermaid 改走 `highlightCode('mermaid')` |
| B07 SVG 行号 | §3+§6 | SVG 已走 `highlightCode('xml')`，自动获得行号 |
| B08 PlantUML 行号 | §3+§6 | plantuml 改走 `highlightCode('text')` |
| B09 CodeViewer 无回归 | — | `highlight()` 未改，`code.css` 未改，`--bg-code-even` 色值变化是改善非破坏 |

## 实现完成标志

1. `highlightCode()` 输出含 `.code-container` + `.line-numbers` + `.line-number` 结构
2. Markdown 代码块：偶数行背景横向铺满整行，dark/light 主题下 odd/even 可辨识
3. Diagram code mode（mermaid/svg/plantuml）：偶数行背景铺满 + 左侧行号列
4. CodeViewer 行为与修改前完全一致
5. `cd frontend-v3 && npx vue-tsc --noEmit` 通过
6. `cd frontend-v3 && ./node_modules/.bin/vitest run` 通过

## minimal_validation

```yaml
minimal_validation:
  assumption: "DOMPurify 默认允许 div/span 及其 class 属性，.code-container/.line-numbers/.line-number 不会被过滤"
  method: "在 useMarkdown.svg.spec.ts 中新增测试：highlightCode() 输出经 DOMPurify.sanitize 后仍含 .code-container 和 .line-number"
  result: not_needed
  note: "div/span 是 HTML 基础标签，DOMPurify 默认允许；class 属性默认保留。P5 vitest 可覆盖验证"
```

## 声明字段

```yaml
packages: [peekview]
domains: [frontend]
ui_affected: true
ui_affected_details:
  - MarkdownViewer.vue（zebra stripe 整行 + 行号渲染）
  - DiagramBlock.vue（code mode 行号渲染 + zebra 整行）
  - CodeViewer.vue（zebra 配色变化，无结构改动）
  - variables.css（--bg-code-even 色值调整）
gate_commands:
  P5:
    - "cd frontend-v3 && ./node_modules/.bin/vitest run"
    - "cd frontend-v3 && npx vue-tsc --noEmit"
  P6:
    - "cd frontend-v3 && npx vue-tsc --noEmit"
env_constraints:
  debug_env: "make debug (127.0.0.1:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' — 确认 debug DB 独立"
files_to_read:
  - path: frontend-v3/src/composables/useShiki.ts
    why: "highlightCode() 补行号 — 核心改动点"
  - path: frontend-v3/src/composables/useMarkdown.ts:14-27
    why: "buildCodeBlockWrapper 结构 + Diagram codeViewHtml 生成逻辑"
  - path: frontend-v3/src/composables/useMarkdown.ts:260-313
    why: "render() 中 code block 处理 + DOMPurify 配置"
  - path: frontend-v3/src/components/MarkdownViewer.vue:246-258
    why: "pre * transparent 规则 + zebra 规则 — 需重排优先级"
  - path: frontend-v3/src/components/DiagramBlock.vue:322-338
    why: ".diagram-code CSS — 需适配 .code-container 结构"
  - path: frontend-v3/src/styles/variables.css:59-62
    why: "--bg-code-even 色值 — dark 主题"
  - path: frontend-v3/src/styles/variables.css:114-116
    why: "--bg-code-even 色值 — light 主题"
  - path: frontend-v3/src/styles/code.css:54-111
    why: "CodeViewer 行号/zebra 样式参考 — MarkdownViewer/DiagramBlock 复用此布局模式"
```
