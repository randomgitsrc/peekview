---
phase: P1
task_id: T021
task_name: zen-mode
type: requirements
parent: P0-brief.md
trace_id: T021-P1-20260625
status: draft
created: 2026-06-25
---

# P1 需求基线 — T021 zen-mode

## 1. 需求复述

为详情页（EntryDetailView）增加"专注模式"（zen mode）：用户按 `f` 键（焦点不在输入框时）隐藏页面 chrome（顶部 header + 左侧文件树 + 右侧 TOC + 底部移动操作条），只留主体内容区占满视口；按 `Esc` 或再次按 `f` 退出，恢复全部 UI 且**状态零丢失**。

核心约束：纯 CSS 隐藏（`display:none`），禁止 `v-if` 销毁组件。不调用浏览器 Fullscreen API。仅限桌面端详情页。

## 2. 隐含需求识别

### 2.1 v-if 侧边栏的隐藏策略（关键）

**现状**：`EntryDetailView.vue:98` 的 `<aside v-if="showFileSidebar">` 和 `:170` 的 `<aside v-if="showTocSidebar">` 均使用 `v-if` 条件渲染。P0-brief 要求"CSS 隐藏，禁止 v-if 销毁"——但侧边栏本身已经是 `v-if` 控制的。

**隐含需求**：zen 模式隐藏侧边栏时，不能依赖 `v-if=false` 销毁重建，必须在侧边栏已渲染的前提下用 CSS `display:none` 隐藏。这意味着：
- 若侧边栏本身未渲染（如单文件 entry 无 file-sidebar），zen 模式无需额外处理
- 若侧边栏已渲染（多文件 entry），zen 模式用 CSS class 强制 `display:none`，不触碰 `v-if` 条件
- 退出 zen 时移除 CSS class，侧边栏恢复可见，内部状态（FileTree 展开状态、滚动位置）完整保留

**为什么必须**：P0-brief 明确要求退出后"状态零丢失"，`v-if` 切换会销毁重建组件丢失状态。

### 2.2 全局键盘焦点判断需覆盖 Teleport 组件

**现状**：`LoginDialog` 使用 `<Teleport to="body">`，其 `<input>` 元素渲染在 `.entry-detail` DOM 树之外。`ConfirmDialog` 也可能有类似机制。

**隐含需求**：`f` 键监听的焦点排除逻辑必须基于 `document.activeElement` 全局判断，不能仅检查事件是否来自 `.entry-detail` 内部。排除规则：
- `document.activeElement` 为 `<input>` / `<textarea>` → 不触发
- `document.activeElement` 为 `contenteditable` / `[contenteditable=true]` 元素 → 不触发
- 其他元素（按钮、div、body）→ 正常触发

**为什么必须**：LoginDialog 的输入框在 DOM 树外但视觉上在页面中，用户在输入框打字时 `f` 键不应触发 zen，这是全局快捷键最常见 bug 源。

### 2.3 content-area 滚动位置保持

**现状**：`.content-area` 本身 `overflow: hidden`，实际滚动在其子组件内部——CodeViewer 的 `.code-body`（`overflow: auto`）、MarkdownViewer 的根容器（`overflow: auto`）、HtmlViewer 的 iframe（`overflow: auto`）。

**隐含需求**：zen 模式隐藏 header 后，`.detail-content` 获得更多垂直空间（`header-height`），`.content-area` 因 `flex:1` 自动扩展。但滚动容器是子组件而非 content-area 自身，因此：
- 子组件的 `scrollTop` 不受父容器高度变化影响（滚动偏移量相对于滚动容器）
- CSS 隐藏 header 不会触发子组件 DOM 重建，scrollTop 保持
- 需验证 HtmlViewer iframe 在父容器 CSS 尺寸变化时不会重新加载（CSS-only resize 不触发 iframe reload）

**为什么必须**：P0-brief 明确要求"content-area 滚动位置不能动"。

### 2.4 zen 状态生命周期

**隐含需求**：zen 状态为组件级 `ref`，不持久化（不存 URL hash、不存 localStorage）。生命周期：
- 页面刷新 → zen 状态重置为 off（组件重建）
- 路由导航离开详情页 → zen 状态随组件销毁
- 路由导航返回详情页 → zen 默认 off
- 组件内切换 slug（watch） → zen 状态保持不变

**为什么必须**：zen 是临时阅读状态，无需跨页面/跨会话持久化。URL hash 持久化会增加分享链接的复杂度（别人打开链接也进入 zen？），localStorage 持久化则在刷新后行为不直觉。

### 2.5 zen 与 block-fullscreen（T020）的独立性

**现状**：T020 的 block-fullscreen 是单个内容块（mermaid/SVG/PlantUML）的模态放大，通过组件内部按钮触发，渲染为模态覆盖层。zen mode 是页面级 chrome 隐藏。

**隐含需求**：两者可同时激活——zen 隐藏页面 chrome 后，用户仍可点击 mermaid 图表的放大按钮进入 block-fullscreen。退出 block-fullscreen 回到 zen 状态，退出 zen 回到正常状态。两者互不干扰，实现上无依赖关系。

**为什么必须**：用户可能先进入 zen 专注阅读，然后放大某个图表细看。

### 2.6 drawer 组件在 zen 模式下的处理

**现状**：移动端的 File Drawer 和 TOC Drawer 使用 `v-if="showFileDrawer"` / `v-if="showTocDrawer"` 控制，渲染为 fixed 定位的覆盖层。

**隐含需求**：zen 模式下不需要额外处理 drawer——移动端无法触发 zen（无 `f` 键），桌面端 drawer 不可见（由 CSS media query 控制）。若未来扩展 zen 触发方式（如按钮），需回访此条。

**为什么必须**：当前范围排除移动端 zen，drawer 与 zen 无交互。

## 3. BDD 验收条件

### BDD-01: 按 f 键进入 zen 模式

```
Given 用户在详情页，焦点不在 input/textarea/contenteditable 元素上
When  用户按下 f 键
Then  .detail-header 变为 display:none
  And .file-sidebar 变为 display:none（若已渲染）
  And .toc-sidebar 变为 display:none（若已渲染）
  And .mobile-actions 变为 display:none（若已渲染）
  And .content-area 保持可见并占满可用空间
```

### BDD-02: 按 Esc 退出 zen 模式

```
Given 用户处于 zen 模式
When  用户按下 Esc 键
Then  .detail-header 恢复可见
  And .file-sidebar 恢复可见（若 entry 为多文件）
  And .toc-sidebar 恢复可见（若当前文件为 markdown 且有标题）
  And .mobile-actions 恢复可见（若在移动端视口）
  And .content-area 恢复原始布局
```

### BDD-03: 再按 f 键 toggle 退出 zen 模式

```
Given 用户处于 zen 模式，焦点不在 input/textarea/contenteditable 元素上
When  用户按下 f 键
Then  zen 模式退出，效果与 BDD-02 相同
```

### BDD-04: 输入框焦点排除

```
Given 用户在详情页，焦点在 input 或 textarea 或 contenteditable 元素上（包括 LoginDialog 的输入框）
When  用户按下 f 键
Then  zen 模式不触发，f 字符正常输入
```

### BDD-05: 退出 zen 后状态零丢失（最高优先级）

```
Given 用户在详情页，文件树中有展开的文件夹，TOC 有滚动偏移，content-area 有滚动阅读位置
When  用户按 f 进入 zen 模式
  And 用户按 Esc 退出 zen 模式
Then  文件树的展开/折叠状态与进入 zen 前完全一致
  And TOC 的滚动位置与进入 zen 前一致（偏差 ≤ 2px）
  And content-area 的滚动位置与进入 zen 前一致（偏差 ≤ 2px）
```

### BDD-06: content-area 滚动位置不跳动

```
Given 用户在详情页，content-area 的子滚动容器有非零 scrollTop
When  用户按 f 进入 zen 模式
Then  子滚动容器的 scrollTop 在 zen 切换前后不变（偏差 ≤ 2px）
  And 无可见的内容跳动
```

### BDD-07: HtmlViewer iframe 不重载

```
Given 用户在详情页查看 HTML 文件，iframe 已完成加载
When  用户按 f 进入 zen 模式
  And 用户按 Esc 退出 zen 模式
Then  iframe 未重新加载（无新的网络请求到 render URL）
  And iframe 内的交互状态保持
```

### BDD-08: 非详情页不触发

```
Given 用户在列表页或 API Keys 页
When  用户按下 f 键
Then  无任何反应，zen 模式不可用
```

### BDD-09: zen 与 block-fullscreen 可共存

```
Given 用户处于 zen 模式，正在查看含 mermaid 图表的 markdown 文件
When  用户点击 mermaid 图表的放大按钮进入 block-fullscreen
Then  block-fullscreen 模态层正常显示
When  用户退出 block-fullscreen
Then  仍处于 zen 模式，页面 chrome 保持隐藏
```

### BDD-10: ConfirmDialog 打开时 f 键不触发 zen

```
Given 用户在详情页，删除确认对话框（ConfirmDialog）已打开
When  用户按下 f 键
Then  zen 模式不触发
```

### BDD-11: 单文件 entry 进入 zen

```
Given 用户在单文件 entry 的详情页（无文件树侧边栏）
When  用户按 f 进入 zen 模式
Then  .detail-header 和 .mobile-actions 隐藏
  And .content-area 占满视口
  And 无 JS 错误
```

## 4. 待确认清单

无 `[NEED_CONFIRM]` 项。所有隐含需求均有明确技术判断依据：
- zen 状态生命周期：组件级 ref，不持久化（符合临时阅读状态语义）
- v-if 侧边栏处理：CSS class 强制隐藏，不改变 v-if 逻辑（最安全路径）
- 移动端：不触发（P0-brief 明确排除）
- 焦点排除：`document.activeElement` 全局检查（技术最优解）

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6]
```

| 阶段 | 状态 | 理由 |
|------|------|------|
| P1 | ✅ 保留 | 本文档 |
| P2 | ✅ 保留 | 需设计：v-if 侧边栏的 CSS 隐藏策略、键盘监听挂载方式（onMounted + onUnmounted vs composable）、CSS class 命名约定、与 layout.css media query 的优先级交互。非纯实现层改动，方案需设计 |
| P3 | ✅ 保留 | 全局键盘焦点判断有明确边界用例（input/textarea/contenteditable 内不触发、按钮焦点触发、zen 态下再按 f 退出、Esc 退出），可抽纯函数 `shouldHandleZenShortcut(event)` 做单元测试防回归 |
| P4 | ✅ 保留 | 代码实现 |
| P5 | ✅ 保留 | 技术验证（pytest 全绿 + vitest 全绿） |
| P6 | ✅ 保留 | BDD 验收需 Playwright 实跑：状态零丢失、滚动位置保持、焦点排除。P0-brief 明确要求 P6 必做，涉及 UI 交互行为 |
| P7 | ⏭ 跳过 | 单文件为主（EntryDetailView.vue + layout.css），无跨文件一致性需求。P0-brief pruning_tendency 同意跳过 |
| P8 | ⏳ 待定 | 前端改动需 `npm run build` + 发版，但可与后续任务合并发版。P0-brief 标"按需" |

## 6. 范围声明

```yaml
packages:
  - frontend-v3

domains:
  - frontend

ui_affected:
  - EntryDetailView.vue（zen 状态 ref + 全局键盘监听 + CSS class 绑定）
  - layout.css（zen-mode CSS 规则）
  - 可能新增 composable: useZenMode 或内联在 EntryDetailView

packages_not_affected:
  - backend/peekview（纯前端功能，无 API 变更）
  - packages/mcp-server（MCP 不涉及 UI）
```

### 本任务做

- 详情页 `f` 键进入 zen 模式（隐藏 .detail-header + .file-sidebar + .toc-sidebar + .mobile-actions）
- `Esc` / 再按 `f` 退出，恢复全部 UI
- 焦点判断：input/textarea/contenteditable 内不触发（包括 Teleport 组件内的输入框）
- CSS 隐藏实现，保证退出后状态零丢失
- 对已渲染的 v-if 侧边栏，用 CSS class 强制 `display:none` 隐藏，不改变 v-if 条件

### 本任务不做

- 浏览器 Fullscreen API 调用
- 列表页 / API Keys 页 / HomeView 的 zen 模式
- 移动端 zen 触发（无物理字母键）
- zen 状态持久化（URL hash / localStorage）
- 进入/退出的 toast 提示或动画过渡
- T020 的单内容块全屏（独立任务）
- 将侧边栏从 `v-if` 改为 `v-show`（风险大于收益，CSS class 覆盖更安全）

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需 Playwright 截图验证 zen 模式下 UI 元素可见性、退出后状态恢复、滚动位置保持
    available:
      - playwright-vision skill（已注入，首选）
      - vision-analyst（agate 内置执行角色，作为补充）
    status: available

  - need: browser-keyboard-simulation
    why: P6 验收需 Playwright 模拟键盘事件（f 键、Esc 键、在 input 中输入 f）
    available:
      - Playwright keyboard API（playwright-vision skill 内置）
    status: available

  - need: minimal-validation
    why: 需验证 CSS display:none 切换不触发 iframe 重新加载、滚动位置在 flex 布局变化后保持等浏览器行为
    requires_minimal_validation: true
    available:
      - Playwright（可检测网络请求、scrollTop 值）
    status: available
```
