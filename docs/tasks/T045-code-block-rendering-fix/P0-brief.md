---
phase: P0
task_id: T045
task_name: code-block-rendering-fix
type: bug
trace_id: T045-P0-20260630
created: 2026-06-30
status: draft
agent: main
---

task: 代码块渲染三修复 — zebra stripe 整行背景 + 配色优化 + Markdown/Diagram 代码块补行号

## 1. Zebra stripe 只衬在文字下，不是整行

**现状**: `MarkdownViewer.vue` 的 zebra CSS 作用于 Shiki 的 `<span class="line">` 元素。`<span>` 是 inline，背景只覆盖文字宽度。

`CodeViewer.vue`（文件查看器）的 zebra 正常整行，因为 `code.css:109` 的 `.code-body :deep(.line:nth-child(even))` 作用在 `display: block` 上下文中。而 `MarkdownViewer.vue` 的 `pre *` transparent 覆盖可能干扰了 `.line` 的 display。

**修复**: 确保 `.line` 在 markdown 代码块中是 `display: block`。

## 2. 配色灰灰的，odd/even 差值太小

**当前值**:
- Dark: `--bg-code: #0e131b`, `--bg-code-even: #131920` — 差值 `#050505`
- Light: `--bg-code: #eef0f3`, `--bg-code-even: #e8ebef` — 差值 `#060604`

**修复**: 拉大 odd/even 对比度，或干脆去掉 zebra（VS Code 默认无 zebra）。

## 3. Markdown 代码块 + Diagram code mode 没有行号

**现状**: `useShiki.ts` 有两个函数：
- `highlight()` — 生成行号，被 `CodeViewer` 用
- `highlightCode()` — 不生成行号，被 `MarkdownViewer` 和 `DiagramBlock` 用

| 场景 | 函数 | 行号 |
|------|------|------|
| 文件查看器 (CodeViewer) | `highlight()` | ✅ 有 |
| Markdown 代码块 | `highlightCode()` | ❌ 无 |
| Diagram SVG code mode | `highlightCode('xml')` | ❌ 无 |
| Diagram Mermaid/PlantUML code mode | `escapeHtml()` | ❌ 无（甚至没高亮） |

**修复**: Markdown 代码块改用 `highlight()`（或让 `highlightCode` 也生成行号）；Diagram code mode 统一走 `highlight()` 或 `highlightCode()`。

## 改动域

- `frontend-v3/src/composables/useShiki.ts` — `highlightCode` 补行号生成
- `frontend-v3/src/components/MarkdownViewer.vue` — zebra stripe `.line { display: block }` + 配色调整
- `frontend-v3/src/components/DiagramBlock.vue` — code mode 补行号
- `frontend-v3/src/styles/variables.css` — `--bg-code-even` 调整（或删除 zebra）
- `frontend-v3/src/styles/code.css` — zebra 相关样式

known_risks:
  - 改 `highlightCode` 会影响所有 markdown 代码块的 DOM 结构，需回归测试
  - zebra 配色调整需在 dark/light 双主题下都测试
  - DiagramBlock 的 Mermaid/PlantUML code mode 当前是 `escapeHtml()`，加行号需改为 Shiki highlight 或手动渲染行号

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 适度裁剪 — 三个子问题方案明确，P3 可跳过（CSS 和 DOM 变更用 P6 视觉验证覆盖），P7 可跳过（单端改动）
