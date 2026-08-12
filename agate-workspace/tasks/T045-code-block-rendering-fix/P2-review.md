---
phase: P2
task_id: T045-code-block-rendering-fix
type: review
trace_id: T045-P2-review-20260701
status: approved
agent: plan-design-review
created: 2026-07-01
parent: P2-design.md
---

# T045 P2 方案设计评审

## 评分维度

| 维度 | 评分 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 8/10 | loading/error 未显式提及，但 Shiki 异步加载已有既有机制，非新增风险 |
| AI Slop 风险 | 9/10 | 方案精确到选择器特异性计算和 HSL 数值，无模糊空间 |
| 移动端考虑 | 6/10 | 行号列在窄屏下的处理未提及（是否隐藏/折叠），存在溢出风险 |
| 可访问性 | 7/10 | `aria-hidden="true"` 已在 `renderLineNumbers` 中，行号不干扰屏幕阅读器；但 `.line { display: block }` 对 SR 的影响未评估 |

## BDD 覆盖检查

| BDD | 覆盖 | 备注 |
|-----|------|------|
| B01 Zebra 整行（Markdown） | ✅ | §1 完整覆盖：`display: block` + 选择器优先级提升 |
| B02 Zebra 整行（Diagram） | ✅ | §1+§5 覆盖，确认 DiagramBlock 无 `pre * transparent` 问题 |
| B03 Zebra 对比度（dark） | ✅ | §2 新值 `#1c2536`，HSL diff 8.1% |
| B04 Zebra 对比度（light） | ✅ | §2 新值 `#d4d9e2`，HSL diff 8.4% |
| B05 Markdown 行号 | ✅ | §3+§4，`highlightCode()` 补行号 + MarkdownViewer 行号样式 |
| B06 Mermaid 行号 | ✅ | §3+§6，改走 `highlightCode('mermaid')` |
| B07 SVG 行号 | ✅ | §3+§6，已走 `highlightCode('xml')`，自动获得行号 |
| B08 PlantUML 行号 | ✅ | §3+§6，改走 `highlightCode('text')` |
| B09 CodeViewer 无回归 | ✅ | `highlight()` 未改，`code.css` 未改，`--bg-code-even` 变化是改善 |

**9/9 BDD 全覆盖。**

## 关键评审发现

### 1. Zebra 选择器优先级方案 — 正确但有冗余

§1 提出将 zebra 规则移到 `pre * transparent` 之后，并用 `.code-block-wrapper pre .line:nth-child(even)` (0,3,2) + `!important` 覆盖 `pre *` (0,0,1) + `!important`。

**分析**：当双方都有 `!important` 时，按特异性决胜，(0,3,2) > (0,0,1)，zebra 必赢。源码顺序调整是额外保险但非必需。方案正确，无问题。

**但**：当前 light 模式 zebra 规则（line 252-254）没有 `!important`，而 `pre * transparent` 只在 `[data-theme='dark']` 下。P2 方案给 light 模式也加了 `!important`，这是安全的（不会与不存在的 light `pre *` 冲突），但属于过度声明。**非 BLOCKER，可接受。**

### 2. `highlightCode()` 输出结构变化 — DOMPurify 验证充分

§3.4 正确分析：`div`/`span` 是 DOMPurify 默认允许标签，`class` 属性默认保留。`aria-hidden` 在 DOMPurify 的 `ALLOW_ARIA_ATTR` 默认开启。

**但**：当前 DOMPurify 配置（useMarkdown.ts:306-309）用了 `ADD_ATTR` 和 `ADD_TAGS`，这是**白名单追加**模式，不改变默认允许集。`div.code-container`、`div.line-numbers`、`span.line-number` 均属默认允许，不会被过滤。**结论：无需修改 DOMPurify 配置，方案正确。**

### 3. DiagramBlock `codeViewHtml` 改造 — SVG 行号包裹问题

§6 将 SVG 从 `'<pre class="shiki"><code>' + highlightCode(...) + '</code></pre>'` 改为直接 `highlightCode(...)`。

**当前 `highlightCode()` 返回**：`<pre class="shiki"><code>...</code></pre>`（裸 Shiki 输出）。

**改造后 `highlightCode()` 返回**：`<div class="code-container"><div class="line-numbers">...</div><pre class="shiki"><code>...</code></pre></div>`。

旧代码外层包了 `<pre><code>`，内层 `highlightCode()` 也返回 `<pre><code>`，实际 DOM 是 `<pre><code><pre><code>...</code></pre></code></pre>`（嵌套 pre/code，不合法 HTML）。改造后消除了这个嵌套问题。**这是改善，非风险。**

### 4. Mermaid 语言加载 — 需确认

§6 提到 `highlightCode(code, 'mermaid', theme)`，但 `useShiki.ts` 的 `commonLangs` 列表中没有 mermaid，`LANG_IMPORT_MAP` 中也没有 mermaid。

**风险**：`ensureLanguage()` 找不到 mermaid 的 importer，会回退到 `'text'`。mermaid 语法高亮不会生效，但行号和 `.line` 结构仍正常。方案中已提到"Shiki 已加载 mermaid 语言"，但代码中未见。**需确认 Shiki 是否内置 mermaid 语法，或在 `LANG_IMPORT_MAP` 中补充。**

**严重度**：LOW — 回退 text 仍满足 B05/B06（行号显示），只是无语法高亮。不影响 zebra。但方案声称有高亮，与实际不符。

### 5. Dark 模式行号列硬编码色值

§4 中 dark 模式行号列背景用硬编码 `#161b22`，边框用 `#30363d`，而非 CSS 变量。这与 MarkdownViewer 其他 dark 覆盖规则（line 240-243, 269-270, 283-285）风格一致，都是硬编码。**与既有模式一致，可接受。**

### 6. 移动端行号列溢出 — 未提及

窄屏下 `.line-numbers` 固定宽度 + `flex-shrink: 0` 可能导致代码区域被挤压。CodeViewer 的 `code.css` 同样有此问题（未做响应式处理），所以 MarkdownViewer/DiagramBlock 复用相同模式是**一致的**，但这是一个既有缺陷而非 P2 引入的新问题。**非 BLOCKER。**

### 7. `buildCodeBlockWrapper` 结构兼容性

当前 `buildCodeBlockWrapper`（useMarkdown.ts:14-27）将 `highlighted` 直接嵌入 `.code-block-wrapper`。改造后 `highlighted` 从 `<pre>...</pre>` 变为 `<div class="code-container">...</div>`，嵌入后 DOM 为：

```
.code-block-wrapper
  .code-block-header
  .code-container
    .line-numbers
    pre.shiki
      code
        .line × N
```

§4 的 CSS 选择器 `.markdown-body .code-block-wrapper .code-container` 等能正确匹配。**无问题。**

### 8. `--bg-code-even` 变更对 CodeViewer 的影响

§2 修改 `--bg-code-even` 色值，CodeViewer 也使用此变量（code.css:110）。新值对比度更大，是改善。BDD-9 要求"行为与修改前完全一致"——配色变化是否算"不一致"？

**判定**：BDD-9 的意图是功能/结构无回归，配色改善是任务目标的一部分（B03/B04），不应视为 B09 的违反。方案在 BDD 映射表中已注明"色值变化是改善非破坏"。**合理。**

## 隐含需求覆盖

| # | 隐含需求 | 覆盖 |
|---|---------|------|
| 1 | DiagramBlock CSS 适配新 DOM | ✅ §5 |
| 2 | mermaid/plantuml 改走 highlightCode | ✅ §6 |
| 3 | zebra 选择器优先级高于 pre * | ✅ §1 |
| 4 | dark/light 双主题验证 | ✅ §2 + §4 dark 覆盖 |
| 5 | 行号样式与 CodeViewer 一致 | ✅ §4/§5 复用 code.css 布局模式 |
| 6 | DOMPurify 白名单 | ✅ §3.4 分析无需修改 |

## 边界条件检查

| 边界条件 | 是否考虑 | 备注 |
|---------|---------|------|
| 单行代码块（无 even 行） | ✅ | zebra 只影响 nth-child(even)，单行无 even 行，无副作用 |
| 空代码块 | ⚠️ | `renderLineNumbers('')` 会 split 出 `['']`，生成 1 个 line-number。`highlightCode('', lang, theme)` 的 `codeToHtml` 行为未确认。**低风险**，P5 vitest 可覆盖 |
| 超长行号（>999 行） | ⚠️ | `min-width: 3ch` 只够 1-999，1000+ 行行号列会自动撑宽（`display: block` + 内容宽度）。与 CodeViewer 行为一致，非新问题 |
| 代码块内 HTML 实体 | ✅ | Shiki `codeToHtml` 已处理转义，DOMPurify 二次清理 |
| `pre * transparent` 对 `.line-numbers` 的影响 | ✅ | `.line-numbers` 在 `pre` 外部（`.code-container` 的直接子元素），不受 `pre *` 影响 |

## 总结

方案设计完整、精确，9 条 BDD 全覆盖，6 条隐含需求全覆盖。核心改动（`highlightCode()` 补行号、zebra 选择器优先级、配色调整）逻辑清晰，风险分析到位。

**需关注项**（非 BLOCKER，实现时注意）：
1. mermaid 语言可能不在 Shiki 加载列表中，`highlightCode('mermaid')` 会回退 text，无语法高亮但行号正常
2. 空代码块的 `renderLineNumbers` 行为需 P5 验证

**评审结论**：**APPROVED**
