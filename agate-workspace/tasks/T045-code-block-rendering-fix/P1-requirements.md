---
phase: P1
task_id: T045-code-block-rendering-fix
type: problems
trace_id: T045-P1-20260701
status: draft
agent: analyst
created: 2026-07-01
parent: P0-brief.md
risk_level: low
P1_simplified: true
---

# T045 Code Block Rendering Fix — 需求基线

## 需求复述

修复代码块渲染的三个视觉问题：(1) Markdown 代码块 zebra stripe 背景只衬在文字宽度而非整行；(2) odd/even 行配色差值太小，视觉上几乎看不出区分；(3) Markdown 代码块和 Diagram code mode 没有行号，与文件查看器 CodeViewer 不一致。

## 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| 1 | `highlightCode` 改为含行号后，DiagramBlock 的 `codeViewHtml` DOM 结构同步变化，DiagramBlock CSS（`.diagram-code .line:nth-child(even)`）需兼容新结构 | `codeViewHtml` 的 DOM 直接来自 `highlightCode` 输出，结构变了 CSS 选择器可能失效 |
| 2 | mermaid/plantuml code mode 当前用 `escapeHtml()` 渲染，无 `.line` 元素，zebra CSS 不生效；加行号需同步生成 `.line` 包裹结构 | 不加 `.line` 则 zebra 规则空转，行号和 zebra 是一体的 |
| 3 | MarkdownViewer 的 `[data-theme='dark'] .markdown-body pre *` 规则强制 `background: transparent !important`，会覆盖 `.line:nth-child(even)` 的 zebra 背景，zebra 选择器优先级必须高于 `pre *` | 这是子问题 1 的根因：`pre *` 的 `!important` 把 zebra 的 `!important` 打平，但 `.line:nth-child(even)` 的特异性不够 |
| 4 | 配色调整需在 dark/light 双主题下都验证可辨识度 | P0-brief 已列为 known_risk |
| 5 | 行号列在 Markdown 代码块和 Diagram code mode 中需与 CodeViewer 的行号样式一致（字体、颜色、对齐方式） | 同一应用内代码块行号风格应统一，否则视觉割裂 |
| 6 | `highlightCode` 改为输出行号后，Markdown 代码块 `<pre>` 内的 DOM 从纯 `<code>...</code>` 变为 `<div class="code-container">...</div>`，DOMPurify 白名单需包含新元素/属性 | DOMPurify 会过滤未白名单的标签/属性，结构变更可能导致行号被清除 |

## BDD 验收条件

### BDD-1: Zebra stripe 整行背景（Markdown 代码块）

```
Given 一个含多行代码的 Markdown 代码块
When  页面在 dark 或 light 主题下渲染
Then  每个偶数行的背景色横向铺满代码块容器整行宽度（非仅文字宽度）
```

### BDD-2: Zebra stripe 整行背景（Diagram code mode）

```
Given 一个 Mermaid/SVG/PlantUML 图表切换到 code mode
When  页面在 dark 或 light 主题下渲染
Then  每个偶数行的背景色横向铺满代码区域整行宽度
```

### BDD-3: Zebra 配色可辨识

```
Given 代码块在 dark 主题下渲染
When  观察 odd 行与 even 行的背景色
Then  odd 与 even 行色差 ≥ 8% 亮度差异（肉眼可辨识）

Given 代码块在 light 主题下渲染
When  观察 odd 行与 even 行的背景色
Then  odd 与 even 行色差 ≥ 8% 亮度差异（肉眼可辨识）
```

### BDD-4: Markdown 代码块显示行号

```
Given 一个含 3 行代码的 Markdown 代码块
When  页面渲染完成
Then  代码块左侧显示行号列，依次为 1、2、3
  And 行号样式（字体、颜色、对齐）与 CodeViewer 的行号一致
```

### BDD-5: Diagram code mode 显示行号

```
Given 一个 Mermaid 图表切换到 code mode
When  页面渲染完成
Then  代码区域左侧显示行号列
  And 行号样式与 CodeViewer 的行号一致
```

```
Given 一个 SVG 图表切换到 code mode
When  页面渲染完成
Then  代码区域左侧显示行号列（XML 高亮 + 行号）
```

```
Given 一个 PlantUML 图表切换到 code mode
When  页面渲染完成
Then  代码区域左侧显示行号列
```

### BDD-6: CodeViewer 行为不变

```
Given 文件查看器 CodeViewer 打开任意代码文件
When  页面渲染完成
Then  行号、zebra stripe、高亮行为与修改前完全一致（无回归）
```

## 待确认清单

无。三个子问题的方向明确：
- 子问题 1：`.line` 需 `display: block`（根因清晰）
- 子问题 2：拉大 odd/even 差值（P0-brief 已给出两个选项：拉大差值或去掉 zebra；取拉大差值，因去掉 zebra 是去除功能而非修复）
- 子问题 3：`highlightCode` 需补行号（方案唯一）

## 裁剪说明

```yaml
phases: [P1, P2, P4, P5, P6]
skipped:
  P3:
    reason: >
      CSS display 属性修改 + highlightCode 补行号生成的改动，
      不涉及新业务逻辑或 API 变更。
      子问题 1 是单行 CSS 修复（.line display:block），
      子问题 2 是 CSS 变量值调整，
      子问题 3 是复用现有 highlight() 的行号逻辑。
      P6 的 BDD 验收 + 视觉验证可覆盖回归风险，
      不需要独立的 TDD 红灯-绿灯周期。
  P7:
    reason: 单端改动（仅 frontend），无跨端一致性风险
  P8:
    reason: 纯视觉 bug 修复，无 API/schema/配置变更，不涉及发布
```

## 范围声明

```yaml
packages: [frontend-v3]
domains: [frontend]
ui_affected:
  - MarkdownViewer.vue（zebra stripe 整行 + 行号渲染）
  - DiagramBlock.vue（code mode 行号渲染）
  - CodeViewer.vue（回归验证，无改动）
  - variables.css（--bg-code-even 色值调整）
  - code.css（zebra stripe 样式）
```

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证 zebra stripe 整行铺满 + 行号显示 + 配色可辨识
    available:
      - playwright-cdp skill
      - vision-analyst（agate 内置执行角色）
    status: available
```
