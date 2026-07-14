---
phase: P1
task_id: T057
type: requirements
parent: P0-brief.md
trace_id: T057-P1-20260714
status: draft
created: 2026-07-14
agent: analyst
risk_level: medium
packages:
  - frontend-v3
domains:
  - ui-polish
  - share-ux
phases: [P1, P2, P3, P4, P5, P6, P8]
coupling_checklist: [ui-ux: checked, no-backend-change: checked]
跳过风险: "P7 裁剪风险评估：UI 纯前端改动，无数据模型或后端契约变动，无一致性风险。"
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证交互行为
    available:
      - "vision-analyst"
      - "playwright-cdp"
    status: available
    requires_minimal_validation: true
---

# T057 P1 需求基线 (Requirements Baseline)

## 1. 需求复述 (Requirements Restatement)

本任务旨在对 PeekView 的核心 UI/UX 进行精细化打磨与重构，重点解决以下两个核心组件的布局、对齐、视觉和交互逻辑问题：

### 需求 1: OverflowMenu (桌面端布局优化)
- **现状与问题**：
  - 桌面端 OverflowMenu（在 Detail Header 的 Actions Area 中）在 Light 模式下，Dropdown 面板的背景色由于透明或半透明设置导致透传下方的页面元素，视觉效果非常杂乱。
  - Dropdown 内的所有菜单项对齐不统一（居中与左对齐混合），Icon 与 Text 的间距不一致，缺乏标准化 Padding。
- **重构目标**：
  - 修复 Dropdown 面板背景色，统一使用不透明的 `--c-surface`（Light 模式为纯白 `#ffffff`，Dark 模式为 `#121822`），杜绝页面内容透传。
  - 标准化菜单项布局，强制采用 Flex 布局且 `align-items: center`，所有菜单项严格左对齐（`justify-content: flex-start`）。
  - 统一菜单项的 Padding 为 `8px 12px`，保持 Icon 和文字间距的精确统一。
  - 统一使用 `lucide-vue-next` 提供的高质量 line 图标，严格契合 `DESIGN.md`。

### 需求 2: ShareManagementPanel 与 ShareDialog (合二为一重设计为 Popover)
- **现状与问题**：
  - 目前分享功能被分割为两个割裂的组件：创建分享链接使用全屏模态弹窗 `ShareDialog.vue`，而查看和管理已生成分享链接则在详情页面最下方渲染一个通栏块级面板 `ShareManagementPanel.vue`。
  - 底部通栏设计粗糙，与页面主体交互割裂，极度不直观，不利于多端适配。
- **重构目标**：
  - **组件融合**：完全弃用底部全屏通栏 `ShareManagementPanel.vue` 和传统的 `ShareDialog.vue` 模态弹窗。
  - **上下文 Popover**：在桌面端，将两者完全融合成一个紧贴“分享”按钮（Detail Header 中的 Share 按钮）的 Popover (气泡弹层) 组件。
  - **单层极简交互状态机**：
    - **无活跃分享时**：直接显示创建分享链接的表单。用户可配置过期时间（Expires In，默认 7 Days，支持 1h/24h/7d/30d/Permanent）及可选最大使用次数（Max Uses），并提供一键一键“生成分享链接”按钮。
    - **生成成功后（临时状态）**：显示生成的完整分享链接（只读文本框 + 复制图标按钮），并显示高亮警示文案：“请立即复制分享链接 — 关闭后将无法再次查看！”以及“完成/确定”按钮。
    - **有活跃分享时**：不显示创建表单，而是直接显示当前活跃分享链接的详情行（包含脱敏的 Token Prefix `pv_sh_xxxx...`，已使用次数/上限，过期状态）+ 链接复制图标按钮 + 行尾垃圾桶图标 `[ 撤销分享 ] (trash-2)` 按钮。点击撤销后，无缝切回无活跃分享状态。
  - **多端响应式适配**：在移动端，由于头部隐藏，应将绝对定位的 Popover 自适应过渡为具有暗色遮罩和毛玻璃效果的居中模态弹窗（或底部 Sheet 抽屉），保证触控交互体验。

---

## 2. 隐含需求识别 (Implicit Requirements Identification)

通过分析现有代码和设计系统，我们识别出以下在技术实现中必须解决的隐含依赖：

1. **分享状态轮询/自动同步 (Share State Auto-Sync)**:
   - **为什么必须**：当 Popover 被打开时，必须即时调用 `shareStore.fetchShares(slug)` 刷新分享链接列表。当用户在 Popover 内一键撤销分享或生成新分享后，必须立即刷新本地 store 状态，保证组件数据与服务端绝对同步。
2. **生成的完整 URL 复制安全反馈 (Copy Security Feedback)**:
   - **为什么必须**：由于后端出于安全考量不会存储明文 secret token（仅存储 token 盐值哈希），生成的完整 URL 只能在创建成功瞬间返回一次。用户一旦关闭 Popover，完整 URL 将永久丢失。
   - **解决方案**：Popover 创建成功界面必须提供不可修改的 `<input readonly>`，点击复制图标时需成功调用 Clipboard API，并向用户提供极其明显的视觉复制反馈（如“已复制 / Copied!”及 Toast 提示），且必须有强警告信息告知。
3. **Outside Click & Escape 自动关闭监听器管理 (Outside Click & Escape Management)**:
   - **为什么必须**：Popover 组件需要监听全局的 click 事件和 keydown 键盘事件，在用户点击 Popover 外部或按下 Escape 键时平滑关闭 Popover。
   - **解决方案**：必须在组件挂载 (`onMounted`) 时注册监听器，在卸载 (`onUnmounted`) 时严格移除监听器，防范潜在的内存泄漏及多余 CPU 消耗。
4. **Z-Index 规范隔离 (Z-Index Isolation)**:
   - **为什么必须**：根据 `DESIGN.md` §4 中定义的 Z-Index 规范，弹出式下拉菜单/Popovers 的 Z-index 必须统一为 `100`。如果是移动端自适应弹层/遮罩，其 backdrop 必须为 `200`，Content 必须为 `210`。不可出现由于层级冲突导致被旁边元素遮挡的问题。
5. **DOM 结构挂载安全与 Teleport 选区 (Teleport Selectors)**:
   - **为什么必须**：Popover 如果嵌套在 Detail Header 内部，由于父容器可能存在 `overflow: hidden` 或 `transform` 等 CSS 属性，可能导致绝对定位弹窗被裁剪或定位偏差。
   - **解决方案**：对于移动端自适应 Modal 变体，必须使用 `<Teleport to="body">` 渲染 Backdrop 和面板容器，避免排版树污染和遮挡。

---

## 3. BDD 验收条件 (BDD Acceptance Criteria)

### BDD-1: OverflowMenu 视觉与布局重构
- **Given** 桌面端视口（屏幕宽度 >= 1024px），在 Light 模式或 Dark 模式下访问 Entry 详情页
- **When** 点击 Detail Header 区域中的 OverflowMenu 触发按钮展开 Dropdown 下拉面板
- **Then** Dropdown 面板 `.overflow-dropdown` 必须具有不透明的背景色 `background: var(--c-surface)` (Light 为 `#ffffff`, Dark 为 `#121822`)
- **Then** 所有菜单项 `.overflow-item` 的 Padding 必须标准化为 `8px 12px`，且 Icon 与文字通过 `gap` 统一对齐
- **Then** 所有菜单项元素必须采用 Flex 布局，且强制左对齐 `justify-content: flex-start` 和垂直居中 `align-items: center`

### BDD-8: 网络异常与前端容错 (Error Handling)
- **Given** Share Popover 处于打开状态，用户进行创建或撤销操作
- **When** 后端接口返回 401 (Unauthorized), 403 (Forbidden), 或 500 (Internal Error)
- **Then** 前端必须捕获该异常，不在 Popover 内显示乱码，而是显示友好的错误提示（如 "Action failed, please try again."），并保留当前状态以便用户重试
- **Then** 在 401 情况下，应引导用户跳转到登录页面

### BDD-9: 边界场景处理 (Edge Cases)
- **Given** 分享列表包含过长 URL 或 Token
- **When** 显示在 Popover 内
- **Then** URL 必须支持 CSS 截断 (`text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`)，确保不溢出 Popover 面板边界
- **Given** 无任何活跃分享，且网络请求延迟较高
- **When** 打开 Share Popover
- **Then** 必须显示 Loading 状态（如 skeleton screen 或加载图标），避免空白界面
- **Given** 分享列表数据请求返回为空数组
- **When** 打开 Share Popover
- **Then** 应该友好地引导用户进行首次创建，而不是显示空白面板

### BDD-10: 旧版缓存兼容性 (Compatibility)
- **Given** 用户当前浏览器存在旧版静态资源缓存
- **Then** 建议采用在 `index.html` 或前端部署流程中注入版本号/哈希值的方式，确保用户强制刷新后能加载最新 JS/CSS 组件；若检测到组件渲染异常，系统应在控制台提示用户尝试手动硬刷新 (Hard Refresh)

### BDD-2: Share Popover - 初始状态 (无活跃分享)
- **Given** 桌面端视口下，当前 entry 为私有（Private）且当前用户为 Owner，且当前 entry **无任何活跃分享链接**
- **When** 用户点击 Detail Header 区域中的 Share 按钮
- **Then** 紧贴该 Share 按钮下方弹出 Share Popover 面板 `.share-popover`
- **Then** 面板内直接呈现创建分享链接表单，包含 "Expires in" 过期时间下拉选择框（默认选中 "7 Days"）和 "Max uses (optional)" 最大使用次数数字输入框
- **Then** 面表内显示一键 "Create Link" 的 Primary 样式行动按钮，不展示任何活跃链接行

### BDD-3: Share Popover - 分享链接创建与复制 (临时状态)
- **Given** 桌面端视口下，Share Popover 处于创建分享表单界面
- **When** 用户配置完时间，并点击 "Create Link" 按钮
- **Then** 接口成功响应创建结果，Popover 界面无缝切换至结果展示状态
- **Then** 结果状态必须在文本框内完整展示生成的 `shareUrl`，并配有一键复制（Copy）按钮和橙色高亮警示文字：“Copy the URL now — it won't be shown again!”
- **Then** 点击一键复制按钮后，系统必须成功将完整 URL 写入剪贴板，并在页面上弹出成功 Toast 消息
- **Then** 此时 store 中的 active shares 数量自动累加，在关闭或点击完成按钮后，Popover 更新为展示活跃分享列表

### BDD-4: Share Popover - 活跃分享列表展现
- **Given** 桌面端视口下，当前 entry 拥有一条或多条**活跃的分享链接**
- **When** 用户点击 Share 按钮展开 Popover 面板
- **Then** 面板直接展示活跃分享链接行，显示脱敏的 Token Prefix `pv_sh_xxxx...`，以及已使用次数、过期截止提示
- **Then** 每条活跃链接行尾必须包含一键复制按钮和一键 `[ 撤销分享 ] (trash-2)` 红色危急按钮
- **Then** 创建表单输入框和一键 "Create Link" 按钮在活跃分享列表中不再默认显示

### BDD-5: Share Popover - 一键撤销分享链接
- **Given** 桌面端视口下，Share Popover 正处于展现活跃分享列表界面
- **When** 用户点击行尾垃圾桶图标 `[ 撤销分享 ] (trash-2)` 按钮
- **Then** 系统无缝发起 Revoke 接口请求，当前分享链接被成功注销
- **Then** Popover 自动刷新活跃列表数据。若此 entry 已经没有剩余活跃分享链接，Popover 自动无缝切回无活跃分享时的“创建表单”初始界面

### BDD-6: Share Popover - 自动关闭交互行为
- **Given** 桌面端视口下，Share Popover 面板处于展开状态（无论是创建界面、结果界面或列表界面）
- **When** 用户点击 Popover 面板外部的任何位置，或者按下键盘的 Escape 键
- **Then** Share Popover 面板必须立即被销毁关闭，从页面 DOM 结构中移除或设置为隐藏

### BDD-7: Share Popover - 移动端响应式适配 (Responsive Adaptation)
- **Given** 移动端视口（屏幕宽度 <= 640px），用户访问 Private Entry 详情页
- **When** 用户点击底部导航栏 Mobile Bottom Bar 中的 OverflowMenu 并选择 "Share" 动作
- **Then** 系统不采用 absolute 浮动气泡，而是以 Teleport 方式将分享面板作为**居中模态弹窗 (Centered Modal)** 挂载于 body 顶层
- **Then** 该移动端弹窗必须配备黑色半透明背景遮罩（z-index: 200，支持 `backdrop-filter: blur(4px)`），且右上角带有明显的 X 关闭按钮
- **Then** 弹窗内承载的所有分享配置、生成、展示、一键复制、活跃链接列表展示和一键撤销功能在移动触屏上 100% 可用且自适应排版

---

## 4. 待确认清单 (To Be Confirmed List)

*(经详细技术排查和需求质疑，本任务的所有功能范围与交互逻辑均已完全明确，待确认清单保持清零。)*

---

## 5. 裁剪说明 (Pruning Decisions)

基于 `P0-brief.md` 的裁剪倾向及对本任务复杂度的评估：

| 阶段 | 状态 | 裁剪理由 |
|------|------|----------|
| **P0** | 保留 | 任务简报和约束设定已由主 Agent 完成。 |
| **P1** | 保留 | 本阶段（需求分析）核心必经，用于质疑需求并产出 BDD 验收。 |
| **P2** | 保留 | 方案设计层核心必经，用于确定 Popover 的定位逻辑与组件重构方案。 |
| **P3** | 保留 | 测试设计（TDD 行为契约设定），确保在真正开始编码前定义好单元测试规范。 |
| **P4** | 保留 | 代码编写与样式重构。 |
| **P5** | 保留 | 运行技术验证（单元测试 + 编译通过 + 数据隔离测试）。 |
| **P6** | 保留 | **不可裁剪**。UI/UX 改进必须通过 E2E/Playwright 录像/实跑，并在 desktop 与 mobile 下截图，借助 `@vision-helper` 确认最终视觉质量。 |
| **P7** | 裁剪 | **可裁剪**。由于本重构完全为纯前端 UI/UX 与样式优化，无任何后端、CLI 或 MCP 包的接口联动或数据格式变更，不涉及任何跨包交叉引用风险，裁剪 P7 一致性交叉审查可大幅提升开发效能。 |
| **P8** | 保留 | 发布准备与最终 CHANGELOG 写入归集。 |

---

## 6. 范围声明 (Scope Statement)

### 涉及的 Packages
- `frontend-v3` (PeekView 前端单页应用包)

### 涉及的 Domains
- `ui-polish`：OverflowMenu 布局修正、对齐样式标准化、Dropdown 背景不透明化。
- `share-ux`：ShareManagementPanel 与 ShareDialog 的废弃与合并重构，上下文定位 Popover 气泡、单层交互状态机设计、移动端响应式 modal/sheet 转化。

---

## 7. 能力需求声明 (Capability Requirements)

### capability_requirements
- need: browser-vision
  why: P6 验收需要启动真实浏览器多分辨率运行，捕获 UI 截图并执行高保真视觉效果审计。
  available:
    - "vision-analyst (agate 内置执行角色，首选)"
    - "playwright-cdp skill (CDP 模式连接 Chrome，首选)"
    - "@vision-helper (Vision 视觉分析子代理，配合首选)"
  status: available
  requires_minimal_validation: true

- need: local-runtime
  why: 运行 `npx vue-tsc --noEmit` 进行前端 TypeScript 静态类型检查，以及运行单元测试。
  available:
    - "本地 Node.js 18+ / TS 开发工具链"
  status: available
