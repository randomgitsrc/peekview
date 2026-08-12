---
phase: P1
task_id: T030-frontend-interaction-enhancements
type: requirements
parent: P0-brief.md
trace_id: T030-P1-20260630
status: draft
created: 2026-06-30
---

# T030 Requirements Baseline

## 1. 需求复述

### Enhancement A: 代码行交替色（Zebra Stripe）

在代码查看器中，奇偶行使用不同的背景色，提升长代码的可读性。适用于：

- **CodeViewer**（独立代码文件查看，有行号）
- **MarkdownViewer** 中的代码块（fenced code block，无行号）
- **DiagramBlock** 的代码视图模式（Diagram/Code toggle 后的代码视图）

不适用于：

- Markdown inline code（`` `code` ``）
- HTML render iframe 内的内容
- Mermaid/PlantUML/SVG 的图表渲染视图

两套主题（dark/light）均需配色，且差异需微妙——不干扰代码语法高亮的辨识度。

### Enhancement B: 移动端底部操作栏溢出折叠（Overflow Menu）

详情页底部 `.mobile-actions` 栏当前使用 `overflow-x: auto` + 隐藏滚动条，按钮过多时用户需横向滑动才能发现，体验差。

改为：主操作按钮直接展示，次要操作折叠进 overflow menu（点击展开菜单/面板）。

## 2. 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| A1 | Zebra stripe 需要新增 CSS 变量（dark/light 各一组） | 现有 `--bg-code` 是统一背景色，zebra 需要奇偶两色，且两套主题对比度不同不能硬编码 |
| A2 | Wrap 模式下 zebra 必须适配变行高 | `wrap-enabled` 时 `.line` 高度为 `auto`，背景色需覆盖整行而非固定 `1.6em` |
| A3 | Markdown 代码块的 zebra 选择器需与 CodeViewer 分离处理 | MarkdownViewer 的代码块在 `.code-block-wrapper` 内，结构与 CodeViewer 的 `.code-container` 不同；Markdown 无行号列 |
| A4 | Zebra stripe 不得影响行号列的可读性 | CodeViewer 行号列 `.line-numbers` 有独立背景 `--bg-secondary`，zebra 只作用于代码行区域 |
| A5 | 主题切换时 zebra 配色实时跟随 | 现有主题切换机制通过 `[data-theme]` 属性 + CSS 变量实现，zebra 变量需挂载在同一选择器下 |
| B1 | Overflow menu 需要定义"主操作"vs"次要操作"的划分规则 | 不同 entry 状态（owner/anonymous）、文件类型（code/markdown/html/image）可显示的按钮集合不同，需明确哪些折叠哪些保留 |
| B2 | Overflow menu 需要关闭机制（click-outside + Escape） | 移动端无 hover，菜单打开后必须可关闭；现有 DiagramBlock dropdown 有 click-outside 但无 Escape |
| B3 | Overflow menu 内的按钮需保持完整功能（href 链接、emit 事件等） | 当前 `Raw` 按钮是 `<a>` 标签带 `href`，`Delete` 有确认弹窗，折叠后功能不能降级 |
| B4 | Overflow menu 的触控区域需满足移动端最小 44px 指引 | 移动端按钮/菜单项过小会导致误触 |

## 3. BDD 验收条件

### Enhancement A: Zebra Stripe

**A-AC1: CodeViewer 交替行背景色**
> Given 一个包含 ≥5 行代码的代码文件（CodeViewer 渲染）
> When 页面加载完成
> Then 奇数行（1,3,5…）背景色为 `--bg-code-odd`，偶数行（2,4,6…）背景色为 `--bg-code-even`，两色差异肉眼可辨

**A-AC2: MarkdownViewer 代码块交替行背景色**
> Given 一个 Markdown 文档包含 fenced code block（≥5 行）
> When 页面加载完成
> Then `.code-block-wrapper` 内的代码行同样显示奇偶交替背景色

**A-AC3: DiagramBlock 代码视图交替行背景色**
> Given 一个包含 Mermaid/PlantUML/SVG 图表的 Markdown
> When 点击 Diagram/Code toggle 切换到代码视图
> Then 代码视图中的行显示奇偶交替背景色

**A-AC4: Dark/Light 主题切换后 zebra 配色正确**
> Given 代码页当前为 light 主题且 zebra 可见
> When 切换到 dark 主题
> Then zebra 行色切换为 dark 主题对应值，对比度适当；再切回 light 恢复原色

**A-AC5: Inline code 不受 zebra 影响**
> Given Markdown 内容含 inline code（如 `` `var x` ``）
> When 页面渲染完成
> Then inline code 背景色为 `--bg-code`（不变），无交替行色

**A-AC6: Wrap 模式下 zebra 覆盖完整行高**
> Given 代码文件开启 Wrap 模式且存在长行折行
> When 页面渲染完成
> Then 折行行的背景色覆盖整个行高，与未折行行齐平

**A-AC7: HTML render iframe 不受影响**
> Given 一个 HTML 文件通过 iframe 渲染
> When 页面加载完成
> Then iframe 内代码块无 zebra stripe（iframe 独立样式不受主应用 CSS 影响）

### Enhancement B: Overflow Menu

**B-AC1: 移动端操作栏按钮不溢出屏幕**
> Given 移动端视口（≤768px）且当前 entry 有全部可用按钮（owner + code file）
> When 页面加载完成
> Then 底部操作栏可见按钮不超出屏幕宽度，多出的按钮收纳在 overflow menu 内

**B-AC2: Overflow menu 展开/关闭**
> Given 移动端操作栏有折叠的次要按钮
> When 点击 overflow 触发按钮
> Then 次要按钮以菜单/面板形式展开；再次点击或点击菜单外部区域则关闭

**B-AC3: Overflow menu 内按钮功能完整**
> Given overflow menu 已展开
> When 点击菜单内的 "Raw" 按钮
> Then 在新标签页打开 raw API 页面（与原行为一致）
> And 点击菜单内的 "Delete" 按钮
> Then 弹出删除确认弹窗（与原行为一致）

**B-AC4: Escape 键关闭 overflow menu**
> Given overflow menu 已展开
> When 按下 Escape 键
> Then 菜单关闭，焦点回到触发按钮

**B-AC5: 桌面端操作栏不受影响**
> Given 桌面端视口（≥1024px）
> When 查看详情页
> Then 头部操作栏布局与原行为一致，无 overflow menu

**B-AC6: Overflow menu 触控区域合规**
> Given 移动端 overflow menu 已展开
> Then 每个菜单项的触控高度 ≥ 44px

## 4. 待确认清单

无 `[NEED_CONFIRM]` 项。

- **主/次按钮划分**：采用自然划分（owner 操作 + 高频查看操作为主，低频下载/导出为次），无需业务判断确认。P2 设计阶段产出具体列表。
- **Overflow menu 交互模式**：推荐 dropdown（与现有 DiagramBlock 一致），P2 设计确认。

## 5. 裁剪说明

```
phases: [P1, P2, P3, P4, P5, P6]
```

| 跳过阶段 | 理由 |
|---------|------|
| P7 一致性检查 | 改动仅限前端 CSS + 组件，不跨包/backend/MCP，无一致性风险 |
| P8 发布准备 | 无 schema/API 变更，无需版本 bump；走常规发布流程即可 |

保留 P2：P0 标注保守裁剪倾向，两个增强项涉及新 CSS 变量体系扩展 + 新交互组件设计，方案需明确。

保留 P3：zebra stripe 涉及 CSS 选择器与 Shiki 输出结构的耦合，overflow menu 涉及移动端交互，TDD 有价值。

保留 P6：两个增强项均为 UI 变更，BDD 验收需 Playwright 截图验证。

## 6. 范围声明

```yaml
packages:
  - peekview-frontend  # frontend-v3/

domains:
  - frontend

ui_affected:
  - CodeViewer.vue (zebra stripe CSS)
  - MarkdownViewer.vue (markdown code block zebra CSS)
  - DiagramBlock.vue (code view zebra CSS)
  - EntryDetailView.vue (overflow menu component + mobile-actions restructure)
  - variables.css (新增 --bg-code-odd / --bg-code-even 变量)
  - code.css (zebra stripe rules)
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证 zebra stripe 配色效果和 overflow menu 交互行为
    available:
      - playwright-cdp skill
      - vision-analyzer skill
    status: available

  - need: mobile-emulation
    why: P6 验收 B-AC1/B-AC2/B-AC6 需要移动端视口模拟
    available:
      - playwright-cdp skill (CDP Emulation.setDeviceMetricsOverride)
    status: available
```
