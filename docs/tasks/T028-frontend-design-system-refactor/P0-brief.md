---
phase: P0
task_id: T028
task_name: frontend-design-system-refactor
type: brief
trace_id: T028-P0-20260629
created: 2026-06-29
status: draft
parent: user-request
---

# T028 Frontend Design System Refactor — P0 Brief

## 1. 任务简报

PeekView 前端当前存在视觉风格不统一的问题：
- LandingView（`frontend-v3/src/views/LandingView.vue`）有一套新的自定义设计系统（`--c-*` tokens、gradient hero、monospace eyebrows、glow/grid 背景）。
- 其他功能页面（EntryListView / EntryDetailView / ApiKeyListView / NotFoundView）仍使用旧的 GitHub Primer 风格 tokens（`--bg-primary` / `--text-secondary` / `--accent-color` 等），视觉上显得“原始”且与 landing page 脱节。

本任务目标：基于已制定的 `DESIGN.md`，将功能页面逐步重构为统一的新设计系统，同时保留所有现有行为和交互。

## 2. 目标

- 统一全站视觉语言，使功能页面与 LandingView 气质一致。
- 建立可复用的共享 UI 组件，避免样式重复。
- 保证双主题（dark/light）在所有页面正确工作。
- 保证移动端响应式体验。
- 不引入功能回归。

## 3. 范围

### In Scope
- `frontend-v3/src/styles/variables.css` — 整合新 tokens，保留旧变量兼容（或迁移后删除）。
- 共享组件创建（位于 `frontend-v3/src/components/`）：
  - `BaseButton.vue`
  - `BaseTag.vue`
  - `BaseBadge.vue`
  - `SearchInput.vue`
  - `EmptyState.vue`
  - `EntryListRow.vue`
  - `PageHeader.vue`（标题 + meta + actions）
- 页面重构：
  - `EntryListView.vue`（Explore 页面）
  - `EntryDetailView.vue`（详情页，含桌面/移动两种布局）
  - `ApiKeyListView.vue`
  - `NotFoundView.vue`
- 主题切换、响应式、无障碍焦点状态验证。

### Out of Scope
- LandingView 不重写（它已经是新设计系统的基准）。
- 不改路由、API 调用、状态管理逻辑。
- 不引入新的依赖（除已存在的 Lucide）。
- 不改后端、MCP Server。

## 4. 环境约束

- **开发模式**：使用 `make debug`（`:8888`，独立数据目录 `/tmp/peekview-debug/`）。
- **禁止**：停止/触碰 pipx 正式服务（`:8080`）。
- **测试数据**：通过 debug backend HTTP API 创建，不用 `peekview create` CLI。
- **类型检查**：每次页面改完后必须跑 `cd frontend-v3 && npx vue-tsc --noEmit`。
- **Lint**：后端 `cd backend && make lint`；前端无单独 lint target，靠 typecheck + 构建。
- **构建验证**：改完前端必须 `make build-frontend` 成功。

## 5. 已知风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 旧变量兼容不彻底导致部分组件颜色断裂 | 中 | 先保留旧变量别名，再全量 grep 替换后删除 |
| 重构过程中破坏现有响应式布局 | 中 | 每个页面在 mobile/tablet/desktop 三种宽度下手动验证 |
| 共享组件 API 设计不当导致多次返工 | 中 | P2 阶段评审组件接口，P3 写组件级测试 |
| EntryDetailView 两栏/下拉切换逻辑复杂 | 高 | 拆成子组件：FileTree.vue / FileDropdown.vue / ViewerPanel.vue |
| 类型检查不通过 | 中 | 每改一个文件跑一次 vue-tsc |

## 6. 裁剪倾向

- **P3 TDD**：保留。共享组件需要组件级测试（Vitest + Vue Test Utils）；页面级以手动验证为主，辅以关键交互的 e2e/playwright。
- **P6 UI 验收**：保留。必须 Playwright 截图对比 dark/light + 移动端。
- **P8 发布**：裁剪版本号 bump。本任务主要是视觉重构，不增加新功能，可考虑作为 patch 版本发布（如 v0.3.1），但需用户确认。

## 7. BDD 验收条件

```gherkin
Scenario: Explore 页面使用新设计系统
  Given 用户访问 /explore
  When 页面加载完成
  Then 页面背景使用 --c-bg
  And entry 列表使用 --c-surface 行 + --c-border 分隔线
  And 搜索框使用 --c-surface-lower + focus ring
  And dark/light 切换后颜色正确

Scenario: Entry Detail 桌面端两栏布局
  Given 用户访问某个 entry 详情页
  And 视口宽度 >= 1024px
  When 页面加载完成
  Then 左侧显示文件树（240px）
  And 右侧显示内容渲染区
  And 操作按钮使用 BaseButton

Scenario: Entry Detail 移动端下拉文件选择
  Given 用户访问某个 entry 详情页
  And 视口宽度 <= 640px
  When 页面加载完成
  Then 文件切换使用下拉选择器
  And 底部显示固定操作栏
  And 可以展开/收起文件列表

Scenario: 主题一致性
  Given 用户在 dark 主题下浏览所有重构页面
  When 切换到 light 主题
  Then 所有页面颜色 tokens 正确映射
  And 无 hard-coded 暗色/亮色残留
```

## 8. 方案建议

### 8.1 实施顺序
1. 整合 tokens 到 `variables.css`（新旧共存）。
2. 创建共享 UI 组件。
3. 重构 `EntryListView.vue`（相对简单，验证组件）。
4. 重构 `EntryDetailView.vue`（最复杂，拆分多个子组件）。
5. 重构 `ApiKeyListView.vue` 和 `NotFoundView.vue`。
6. 全量 dark/light + 响应式验证。

### 8.2 技术策略
- **重构而非重写**：保留现有 Vue SFC 结构、props、emits、API 调用，仅替换 template/style。
- **共享组件优先**：新组件先写 unit test，再在页面中使用。
- **渐进式迁移**：一个页面一个 PR/Commit，便于回滚。

## 9. 声明

| 项目 | 内容 |
|------|------|
| packages | `peekview` (frontend-v3 only) |
| domains | frontend, design-system, ui |
| ui_affected | yes — EntryListView, EntryDetailView, ApiKeyListView, NotFoundView, shared components |
| gate_commands | `cd frontend-v3 && npx vue-tsc --noEmit` <br> `make build-frontend` <br> `cd frontend-v3 && ./node_modules/.bin/vitest run` <br> Playwright screenshots for dark/light/mobile |
