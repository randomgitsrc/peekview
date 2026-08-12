---
phase: P1
task_id: T081-resizable-sidebars
type: problems
parent: P0-brief.md
trace_id: T081-P1-20260804
status: draft
created: 2026-08-04
agent: analyst
---

# P1 需求基线：详情页侧边栏可拖拽调整宽度

## 1. 需求复述

详情页（EntryDetailContent.vue）的三栏布局中，左侧 file-sidebar 和右侧 toc-sidebar 当前使用固定宽度（scoped 硬编码 200px / 240px）。用户在浏览含长文件名或长标题的 entry 时，侧边栏内容被截断，无法看清完整名称。

**需求**：在桌面端（≥1024px）为两个侧边栏各添加一个可拖拽的 resize handle，允许用户自由调整宽度；宽度值持久化到 localStorage，刷新后恢复；移动端（<1024px）不显示 handle（已有 drawer 机制）。

**前提**：现有宽度定义存在双源冲突——`EntryDetailContent.vue` scoped 样式硬编码的 `200px`/`240px` 覆盖了 `variables.css` 定义的 `--sidebar-width: 260px` / `--toc-width: 240px` CSS 变量。必须先统一到 CSS 变量，JS 才能动态控制宽度。

## 2. 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---------|------------|
| IM-1 | 移除 scoped 硬编码宽度，统一到 CSS 变量 | JS 动态修改 `--sidebar-width` / `--toc-width` 才能生效；scoped 硬编码的 specificity 更高，会覆盖变量赋值 |
| IM-2 | 拖拽期间禁用 content-area 的 user-select | 否则鼠标拖拽过内容区时会选中文字，视觉抖动 |
| IM-3 | mousemove 事件用 requestAnimationFrame 节流 | 高频 mousemove 直接写 CSS 变量会导致主线程阻塞，拖拽卡顿 |
| IM-4 | localStorage 值校验 + clamp | 非法值（NaN、负数、超范围字符串）不能直接写入 CSS 变量，否则布局崩溃 |
| IM-5 | resize handle 的 z-index 不干扰 drawer/modal | handle 在侧边栏边缘，z-index 应低于 drawer overlay(100) 和 modal(200)，避免拖拽时遮挡弹出层 |
| IM-6 | 侧边栏条件渲染（v-if）时 handle 也不显示 | file-sidebar 在 `!isFileTreeOpen \|\| !isMultiFile` 时不渲染；toc-sidebar 在 `!isTocOpen \|\| !isMarkdown \|\| sourceViewMode \|\| tocHeadings.length === 0` 时不渲染。handle 应随侧边栏一起消失 |
| IM-7 | handle 需可见 focus 指示器 + aria 属性 | DESIGN.md §10 要求所有交互元素有 focus ring；handle 是可交互元素 |
| IM-8 | min/max clamp 边界 | 防止用户拖到 0px（侧边栏消失）或占满屏幕（内容区消失） |
| IM-9 | 拖拽期间不触发 content-area 滚动 | mousemove 事件可能触发滚动行为，需阻止 |
| IM-10 | 双击 handle 重置默认宽度 | P0-brief 列为风险项。双击 reset 是 splitter 交互的标准预期，纳入实现 |

### 维度检查

- **数据**：无后端数据变更。localStorage 新增两个 key（`peekview-sidebar-width`、`peekview-toc-width`），不影响已有数据。
- **前端**：有显示/交互变化（resize handle 出现、侧边栏宽度可变）。
- **多端**：MCP / CLI / API 不涉及，纯前端任务。
- **边界**：空值（localStorage 无值）→ 用 CSS 变量默认值；极值（拖到屏幕边缘）→ clamp 到 min/max；并发（多 tab 同时拖拽）→ 最后写入的 tab 胜出，可接受。
- **兼容**：不破坏现有行为——默认宽度不变（移除 scoped 硬编码后回退到 variables.css 的 260px/240px），zen mode 不受影响（display:none 与 width 正交）。

## 3. BDD 验收条件

### 拖拽改变宽度

#### BDD-01: 拖拽 file-sidebar 右边缘 handle 改变左栏宽度
- Given 桌面端（≥1024px）详情页，file-sidebar 可见
- When 用户按住 file-sidebar 右边缘的 resize handle 并向右拖拽 50px
- Then file-sidebar 的实际宽度比拖拽前增加 50px（误差 ±2px）

#### BDD-02: 拖拽 toc-sidebar 左边缘 handle 改变右栏宽度
- Given 桌面端（≥1024px）详情页，toc-sidebar 可见
- When 用户按住 toc-sidebar 左边缘的 resize handle 并向左拖拽 30px
- Then toc-sidebar 的实际宽度比拖拽前增加 30px（误差 ±2px）

### 宽度边界 clamp

#### BDD-03: 拖拽超出最大宽度时 clamp 到上限
- Given 桌面端详情页，file-sidebar 当前宽度 260px，最大宽度限制为 500px
- When 用户向右拖拽 handle 超过最大宽度限制
- Then file-sidebar 宽度固定在上限值（500px），不超过上限

#### BDD-04: 拖拽超出最小宽度时 clamp 到下限
- Given 桌面端详情页，toc-sidebar 当前宽度 240px，最小宽度限制为 150px
- When 用户向右拖拽 handle 超过最小宽度限制（使宽度趋近 0）
- Then toc-sidebar 宽度固定在下限值（150px），不低于下限

### localStorage 持久化与恢复

#### BDD-05: 拖拽后刷新页面，宽度从 localStorage 恢复
- Given 桌面端详情页，用户将 file-sidebar 拖拽至 350px
- When 用户刷新页面
- Then file-sidebar 宽度为 350px

#### BDD-06: localStorage 中存储非法值时回退到 CSS 变量默认值
- Given localStorage 中 `peekview-sidebar-width` 的值为 `"abc"`（非法字符串）
- When 用户打开详情页
- Then file-sidebar 宽度为 variables.css 中 `--sidebar-width` 的默认值（260px）

#### BDD-07: localStorage 中存储超出 clamp 范围的值时回退到默认值
- Given localStorage 中 `peekview-toc-width` 的值为 `"9999"`（超出上限）
- When 用户打开详情页
- Then toc-sidebar 宽度为 variables.css 中 `--toc-width` 的默认值（240px）

### 移动端不显示 handle

#### BDD-08: 视口宽度 <1024px 时不显示 resize handle
- Given 视口宽度为 800px（平板/移动端）
- When 用户打开详情页
- Then 页面中不渲染任何 resize handle 元素

### Zen mode 兼容

#### BDD-09: 进入 zen mode 后 resize handle 不可见
- Given 桌面端详情页，侧边栏和 handle 可见
- When 用户按 `f` 键进入 zen mode
- Then resize handle 随侧边栏一起消失

### 侧边栏条件渲染联动

#### BDD-10: file-sidebar 条件渲染关闭时 handle 不显示
- Given 单文件 entry（isMultiFile=false），file-sidebar 不渲染
- When 用户打开详情页
- Then file-sidebar 的 resize handle 不渲染

#### BDD-11: toc-sidebar 条件渲染关闭时 handle 不显示
- Given 非 markdown 文件或 source view 模式，toc-sidebar 不渲染
- When 用户打开详情页
- Then toc-sidebar 的 resize handle 不渲染

### 拖拽期间交互约束

#### BDD-12: 拖拽期间内容区文字不被选中
- Given 桌面端详情页，用户开始拖拽 resize handle
- When 拖拽过程中鼠标经过 content-area
- Then content-area 中的文字不被高亮选中

#### BDD-13: 拖拽期间不触发内容区滚动
- Given 桌面端详情页，content-area 有滚动内容
- When 用户拖拽 resize handle
- Then content-area 不发生滚动位移

### 双击 reset

#### BDD-14: 双击 file-sidebar handle 重置为默认宽度
- Given 桌面端详情页，file-sidebar 宽度已被拖拽至 350px
- When 用户双击 file-sidebar 的 resize handle
- Then file-sidebar 宽度恢复为 `--sidebar-width` 默认值（260px）

#### BDD-15: 双击 toc-sidebar handle 重置为默认宽度
- Given 桌面端详情页，toc-sidebar 宽度已被拖拽至 180px
- When 用户双击 toc-sidebar 的 resize handle
- Then toc-sidebar 宽度恢复为 `--toc-width` 默认值（240px）

### 可访问性

#### BDD-16: resize handle 可通过键盘聚焦
- Given 桌面端详情页，resize handle 可见
- When 用户按 Tab 键导航至 resize handle
- Then handle 显示可见的 focus 指示器（focus ring）

## 4. 待确认清单

[NO_NEED_CONFIRM]

所有需求方向明确，P0-brief 已充分定义任务范围和约束。双击 reset（IM-10）在 P0 中列为风险但表述为"需明确是否纳入"——根据 splitter 交互标准预期，纳入实现，不标记 NEED_CONFIRM。如评审认为不应纳入，可在 review 阶段删除 BDD-14/BDD-15。

## 5. 裁剪说明

```yaml
risk_level: low
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
P1_simplified: false
follows_existing_pattern: [useViewMode.ts, useResponsiveLayout.ts]
```

**阶段裁剪理由**：

- **P1**：不可裁剪（核心阶段）。完整执行——任务涉及交互行为，需完整 BDD 基线。
- **P2**：保留，可简化。`follows_existing_pattern`：CSS 变量 + composable 模式已有先例（useViewMode.ts），1 候选方案即可。
- **P3**：保留。drag 交互有边界条件需测试：min/max clamp、双击 reset、mousemove 性能、user-select 禁用、条件渲染联动。
- **P4**：保留。代码实现。
- **P5**：保留。vitest 单测 + 测试环境隔离验证。
- **P6**：不可跳。UI 交互任务，必须 Playwright 实跑验证拖拽效果（P0-brief 明确声明）。
- **P7**：保留。多文件改动（EntryDetailContent.vue + 新 composable + variables.css + layout.css），需一致性检查。
- **P8**：保留。发布准备。

## 6. 范围声明

```yaml
domains:
  - frontend
packages:
  - frontend-v3/src/components/EntryDetailContent.vue
  - frontend-v3/src/composables/useSidebarResize.ts (新建)
  - frontend-v3/src/styles/variables.css
  - frontend-v3/src/styles/layout.css
  - frontend-v3/src/views/EntryDetailView.vue (可能需要传递 resize 状态)
```

**说明**：
- `domains: [frontend]` — 纯前端任务，不涉及 backend/mcp/cli/security
- `EntryDetailContent.vue` — 移除 scoped 硬编码宽度，添加 resize handle 元素
- `useSidebarResize.ts` — 新建 composable，遵循 useViewMode.ts 模式（load/save + clamp 校验）
- `variables.css` — 可能需要新增 min/max 变量（如 `--sidebar-width-min`/`--sidebar-width-max`）
- `layout.css` — 可能需要 resize handle 的全局样式
- `EntryDetailView.vue` — 可能需要协调 resize 状态与 zen mode / 侧边栏开关的联动

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-drag-interaction
    why: P6 验收需要 Playwright 实跑验证拖拽 resize 交互效果
    available:
      - "playwright-cdp skill（CDP 连接 Chrome 151 :18800，可模拟 mouse down/move/up 拖拽）"
    status: available

  - need: viewport-responsive-testing
    why: P6 验收需要验证 <1024px 不显示 handle、≥1024px 显示 handle
    available:
      - "playwright-cdp skill（可设置 viewport 宽度模拟不同屏幕）"
    status: available

  - need: keyboard-accessibility-testing
    why: P6 验收 BDD-16 需要验证 handle 可通过 Tab 键聚焦
    available:
      - "playwright-cdp skill（可模拟 Tab 键并检查 focus 状态）"
    status: available
```

**环境状态**：[PROD_NOT_TOUCHED]
