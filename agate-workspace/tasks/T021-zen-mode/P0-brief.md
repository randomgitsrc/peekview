---
phase: P0
task_id: T021
task_name: zen-mode
trace_id: T021-P0-20260624
created: 2026-06-24
---

# P0 任务简报 — T021 zen-mode

## task

为详情页（EntryDetailView）增加"专注模式"（zen mode）：按 `f` 键隐藏所有页面 chrome（顶部栏 + 左侧文件树 + 右侧 TOC + 底部移动操作条），只留主体内容区吃满视口；按 `Esc` 或再次按 `f` 退出，恢复全部 UI 且**状态零丢失**。

类比浏览器 F11 隐藏浏览器 chrome，本功能隐藏 PeekView 自身页面 chrome；两者正交可叠加（F11 + zen = 真正沉浸）。不调用浏览器 Fullscreen API，纯 CSS 隐藏实现。

## user_decisions

1. **快捷键**：`f` 键进入（焦点非输入框时），Web 应用惯例，无浏览器功能键冲突
2. **侧边栏**：左侧文件树 + 右侧 TOC 一并隐藏
3. **范围**：仅详情页（EntryDetailView），列表页/API Keys 页不做
4. **退出**：`Esc`（模态退出惯例）+ 再次按 `f` toggle
5. **隐藏策略（硬约束）**：必须 CSS 隐藏（`display:none`），禁止 `v-if` 销毁组件——退出后状态必须完整恢复

## known_risks

- **状态可恢复性（用户明确强调，最高优先级）**：进入 zen 模式必须用 CSS 隐藏而非销毁。文件树展开状态、TOC 滚动位置、content-area 阅读进度、HtmlViewer iframe 已加载内容，退出 zen 后必须全部保留。若用 `v-if` 销毁重建，状态全丢——文件树折回、滚动归零、iframe 重载。**实现铁律：只 `display:none`，不 `v-if`**
- **content-area 滚动位置不能动**：zen 模式只隐藏周边 chrome，主体布局不变。若隐藏 header 导致 content-area 高度变化引发重排，用户阅读位置会跳动。需保证 content-area 自身滚动容器与滚动位置在 zen 切换前后不动（或显式保存恢复）
- **全局键盘焦点判断**：`f` 键全局监听必须排除 `input`/`textarea`/`contenteditable`/`[contenteditable=true]`，否则用户在 LoginDialog 输入框打字会误触发 zen。这是全局快捷键最常见 bug 源，必须有测试覆盖
- **与 T020 并发改同一文件**：T020（svg-codeblock-viewer）正在改 EntryDetailView.vue 加 SVG 工具栏，本任务也改 EntryDetailView.vue。两个并行任务改同一文件高概率 git 冲突。需协调：(a) 改动区域隔离（T020 动模板内容区/CSS，T021 动根容器 class + header/aside + 全局监听），或 (b) 串行化（T021 等 T020 合并后再启）。P2 必须明确隔离策略
- **概念/命名冲突**：T020 的"全屏/缩放"是**单个内容块**（SVG/mermaid 代码块）放大；本任务是**页面级**专注模式。两者实现无关但命名易混。本任务统一用 `zen-mode`（专注模式），T020 用 `block-fullscreen`，文档与代码变量均按此区分
- **HtmlViewer iframe 高度重算**：HTML 文件用 iframe 渲染，zen 模式隐藏 header 后若父容器高度变化，iframe 是否正确重填需验证（不应触发 iframe 重新加载）
- **移动端无 `f` 键**：zen 模式桌面键盘专属，移动端不触发（无物理字母键）。但移动端 `mobile-actions` 底部栏在 zen 时仍应隐藏（若用户通过其他途径进入）——实际上移动端无法进入 zen，此条降级为"不适用"

## executor_env

- platform: opencode
- has_task_tool: true
- has_local_runtime: true
- network: full

## env_constraints

- debug_env:
  - 后端调试：`make debug`（127.0.0.1:8888，独立数据目录 /tmp/peekview-debug/，PEEKVIEW_DEBUG_MODE=1 自动隔离）
  - 后端测试：`cd backend && .venv/bin/python -m pytest tests/`（用 backend/.venv，editable v0.1.65）
  - 前端测试：`cd frontend-v3 && ./node_modules/.bin/vitest run`（非 npx vitest；vitest v1 不支持 --tb=short）
  - 前端构建：`cd frontend-v3 && npm run build`（自动复制到 static/）
  - **严禁** pip3 install --break-system-packages -e .（AGENTS.md 铁律 5）
  - **严禁** 用 CLI 创建测试 entry（AGENTS.md 铁律 8），只通过 debug backend HTTP API
  - **严禁** 直接 sqlite3 操作生产数据库（AGENTS.md 铁律 6）

## pruning_tendency

偏轻量，但保留关键验收。理由：纯前端单文件为主（EntryDetailView.vue + 少量 CSS），逻辑清晰（一个 ref + 全局键盘监听 + CSS class 切换）。但有两个不可省的点：

- **P3 值得做（轻）**：全局键盘焦点判断有明确边界用例（input/textarea/contenteditable 内不触发、焦点在按钮上触发、zen 态下再按 f 退出、Esc 退出），抽成纯函数 `shouldHandleZenShortcut(event)` 可单元测试，防回归
- **P6 必做**：Playwright 实跑验证——(a) 按 f 进入 zen 后 header/aside/mobile-actions 不可见，(b) content-area 仍可见且滚动位置未变，(c) Esc 退出后全部恢复且文件树展开状态/滚动位置保留，(d) 在 LoginDialog 输入框打字不误触

可裁剪：
- **P7 一致性检查可跳**：单文件改动无跨文件一致性需求
- **P8 按需**：前端改动需 `npm run build` + 重新发版（bump version），但可与后续任务合并发版

## phase_hint

[P1, P2, P3, P4, P5, P6]（P7 跳，P8 待定）

## 范围声明

**本任务做**：
- 详情页 `f` 键进入 zen 模式（隐藏 .detail-header + .file-sidebar + .toc-sidebar + .mobile-actions）
- `Esc` / 再按 `f` 退出，恢复全部 UI
- 焦点判断：input/textarea/contenteditable 内不触发
- CSS 隐藏实现，保证退出后状态零丢失

**本任务不做**：
- 浏览器 Fullscreen API 调用（不替用户进浏览器全屏，用户自行 F11）
- 列表页 / API Keys 页 / HomeView 的 zen 模式
- 移动端 zen 触发（无物理字母键）
- 进入/退出的 toast 提示或动画过渡（保持纯粹，P1 若认为必要可 SCOPE+）
- T020 的单内容块全屏（独立任务，本任务不碰）

## coordination

- **T020 协调**：本任务与 T020 均改 EntryDetailView.vue。P2 阶段必须确认 T020 当前进展，约定改动区域隔离或串行顺序，避免 git 冲突。命名约定：本任务 `zen-mode`，T020 `block-fullscreen`
