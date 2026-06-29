---
phase: P1
task_id: T028
task_name: frontend-design-system-refactor
type: requirements
trace_id: T028-P1-20260629
created: 2026-06-29
status: draft
parent: T028-P0-20260629
---

# T028 Frontend Design System Refactor — P1 Requirements

## 1. 需求复述

PeekView 前端存在两套视觉 token 体系：
- **新体系**（`--c-*`）：LandingView 使用，定义在 DESIGN.md，dark/light 双主题完整
- **旧体系**（Primer 风格 `--bg-primary`/`--text-primary`/`--accent-color` 等）：4 个功能页面 + 18 个共享组件使用

本任务将功能页面逐步迁移到新 `--c-*` token 体系，创建 DESIGN.md 规定的共享 UI 组件，使全站视觉统一。**不改路由、API、状态管理、后端、MCP**。

### 结构化需求

| # | 需求 | 来源 |
|---|------|------|
| R1 | 将 `--c-*` token 体系从 LandingView 的 `.stage` 作用域提升到全局 `:root` / `[data-theme]`，供全站使用 | P0 §3 |
| R2 | 创建 7 个共享组件：BaseButton、BaseTag、BaseBadge、SearchInput、EmptyState、EntryListRow、PageHeader | P0 §3 |
| R3 | 重构 EntryListView 使用新 tokens + 共享组件 | P0 §3 |
| R4 | 重构 EntryDetailView 使用新 tokens + 共享组件（含桌面两栏 + 移动端下拉两种布局） | P0 §3 |
| R5 | 重构 ApiKeyListView 使用新 tokens + 共享组件 | P0 §3 |
| R6 | 重构 NotFoundView 使用新 tokens + 共享组件 | P0 §3 |
| R7 | dark/light 双主题在所有重构页面上正确工作 | P0 §2 |
| R8 | 移动端响应式（≤640px / 641–1024px / >1024px）在所有重构页面上正确工作 | P0 §2 |
| R9 | 不引入功能回归（所有现有交互/行为不变） | P0 §2 |
| R10 | 旧 token 迁移策略需兼容未被重构的 18 个组件 | 隐含发现 |

## 2. 隐含需求识别

### 数据维度
| ID | 隐含需求 | 为什么必须 |
|----|----------|-----------|
| D1 | 旧 CSS 变量不能立即删除——18 个不在重构范围内的组件仍依赖它们 | 若删除 `--bg-primary`/`--text-primary` 等，LoginDialog、ConfirmDialog、FileTree、CodeViewer、MarkdownViewer 等全部样式断裂。必须用别名映射或渐进迁移 |
| D2 | `--bg-primary` 到新 token 不是 1:1 映射——页面背景用 `--c-bg`，卡片背景用 `--c-surface` | 当前 `--bg-primary` 同时用于两种语义（页面背景 + 按钮背景），直接 find-replace 会把按钮背景错误地改成 `--c-bg`（页面级暗色），导致视觉断裂 |

### 前端维度
| ID | 隐含需求 | 为什么必须 |
|----|----------|-----------|
| F1 | LandingView 的 `.stage` 作用域 token 需要提升到全局，但 LandingView 自身样式不能回退 | LandingView 在 `.stage` 内声明了 `--c-bg`/`--c-panel` 等，若提升到全局，LandingView 的 scoped CSS 仍需正常工作。需验证 `.stage` 内的声明是否与全局冲突 |
| F2 | layout.css（EntryDetailView 通过 `@import` 引入）包含大量旧 token | layout.css 中 `.detail-header`/`.file-sidebar`/`.mobile-actions` 等均用 `--bg-secondary`/`--border-color`。若只改 EntryDetailView.vue 的 scoped style 而不改 layout.css，样式不一致 |
| F3 | 共享组件需要 a11y focus 状态（`outline: 2px solid var(--c-accent-secondary); outline-offset: 2px`） | DESIGN.md §6 Button 规定了 focus ring，当前旧按钮无 focus ring。共享组件必须实现键盘可访问的 focus 样式 |
| F4 | Touch device 上的 hover-only 操作按钮必须始终可见 | DESIGN.md §9 "Hover-only action buttons must be visible on touch devices"。当前 EntryListView 的 `.card-actions` 无此处理 |
| F5 | `prefers-reduced-motion` 支持 | DESIGN.md §8 规定尊重用户动画偏好。新组件的 transition/animation 需要对应的 media query |

### 多端维度
| ID | 隐含需求 | 为什么必须 |
|----|----------|-----------|
| M1 | 无多端影响 | 纯前端视觉重构，不改 API/CLI/MCP |

### 边界维度
| ID | 隐含需求 | 为什么必须 |
|----|----------|-----------|
| E1 | 空 entry 列表 / 空 API key 列表需要 EmptyState 组件 | DESIGN.md §6 规定了 EmptyState 规范，当前空列表只有纯文本 "No entries found" |
| E2 | EntryDetailView 单文件 entry 场景下不应显示 FileTree | 当前已有此逻辑（`showFileSidebar` 依赖 `isMultiFile`），重构后需保持 |

### 兼容维度
| ID | 隐含需求 | 为什么必须 |
|----|----------|-----------|
| C1 | 未在重构范围内的 18 个组件（LoginDialog、ConfirmDialog、Toast、Pagination、FileTree、TreeNodeItem、ThemeToggle、CodeViewer、MarkdownViewer、HtmlViewer、ImageViewer、DiagramBlock、BannerBar、FilterChip、TocNav、ActionBar、ShareDialog、ShareManagementPanel、SvgRenderer、MermaidRenderer、PlantUmlRenderer）必须继续正常工作 | 这些组件仍被重构页面使用（如 EntryListView 用 LoginDialog/ConfirmDialog，EntryDetailView 用 FileTree/CodeViewer 等） |
| C2 | `--space-*`/`--font-*`/`--radius-*`/`--transition-*`/`--header-height` 等非颜色 token 不变 | 这些 token 新旧体系一致，不需要迁移 |

## 3. BDD 验收条件

### 场景 1：Explore 页面使用新设计系统

```gherkin
Given 用户访问 /explore
When 页面加载完成
Then 页面背景使用 var(--c-bg)
And entry 卡片背景使用 var(--c-surface)
And 卡片边框使用 var(--c-border-strong)
And 搜索框使用 var(--c-surface-lower) 背景 + focus 时 border-color 为 var(--c-accent) + ring 为 0 0 0 3px var(--c-glow)
And entry 标题使用 var(--c-text) + 16px/600
And meta 文字使用 var(--c-text-secondary)
And 标签使用 var(--c-accent-secondary) 色
And hover-only 操作按钮在触控设备上始终可见（不被 hover 媒体查询隐藏）
```

### 场景 2：Entry Detail 桌面端两栏布局

```gherkin
Given 用户访问某个 entry 详情页
And 视口宽度 >= 1024px
When 页面加载完成
Then 左侧显示文件树（width: 240px）
And 文件树背景使用 var(--c-surface-lower)
And 文件树项 active 状态使用 rgba(77,141,255,.14) 背景 + var(--c-accent) 文字
And 右侧显示内容渲染区
And 操作按钮使用 BaseButton 组件
And header 背景使用 var(--c-surface) + border-bottom 使用 var(--c-border)
```

### 场景 3：Entry Detail 移动端下拉文件选择

```gherkin
Given 用户访问某个 entry 详情页
And 视口宽度 <= 640px
When 页面加载完成
Then 文件树侧栏不可见
And 存在文件下拉选择器（使用 var(--c-surface) 背景 + var(--c-border-strong) 边框）
And 底部显示固定操作栏（使用 var(--c-surface) 背景 + safe-area-inset）
And 操作栏按钮高度 >= 44px
```

### 场景 4：主题一致性

```gherkin
Given 用户在 dark 主题下浏览任意重构页面
When 切换到 light 主题
Then 所有 --c-* token 颜色正确映射到 light 主题值
And 页面无 hard-coded hex 颜色（# 开头的 6 位颜色值，除 LandingView 外）
And 文本对比度满足 WCAG AA（4.5:1 body text，3:1 large text）
```

### 场景 5：Token 全局提升与 LandingView 兼容

```gherkin
Given --c-* token 已从 LandingView 的 .stage 提升到全局 :root / [data-theme]
When 用户访问 LandingView (/)
Then LandingView 所有视觉效果与重构前完全一致
And .stage 内的局部 token 声明与全局声明无冲突
```

### 场景 6：共享组件存在且符合 DESIGN.md 规范

```gherkin
Given 共享组件已创建
When 检查组件实现
Then BaseButton 支持 primary/secondary/ghost/danger 变体 + small 尺寸 + disabled + focus ring
And BaseTag 使用 rgba(77,141,255,.14) 背景 + var(--c-accent-secondary) 文字 + 6px radius
And BaseBadge 支持 public/private/shared 三种状态色
And SearchInput 支持 left-aligned search icon + clear button + focus ring
And EmptyState 包含 icon(48px) + heading(20px/600) + description(14px/secondary) + CTA button
And EntryListRow 支持桌面 grid 布局 + 移动端 stacked 布局
And PageHeader 包含 title + meta + actions 区域
```

### 场景 7：旧组件兼容

```gherkin
Given 旧 token 仍在 variables.css 中（作为别名或原始值）
When 用户在重构后的页面上触发 LoginDialog / ConfirmDialog / FileTree / CodeViewer / Pagination
Then 这些组件的视觉与重构前一致（颜色、边框、间距无变化）
```

### 场景 8：a11y

```gherkin
Given 共享组件已创建
When 使用键盘 Tab 导航
Then 所有 BaseButton 实例有可见 focus ring（outline: 2px solid var(--c-accent-secondary); outline-offset: 2px）
And SearchInput 有可见 focus ring
And EntryListRow 可通过 Enter/Space 键激活导航
```

### 场景 9：prefers-reduced-motion

```gherkin
Given 用户系统设置 prefers-reduced-motion: reduce
When 浏览任意重构页面
Then 卡片 hover lift 动画不触发（无 translateY）
And 按钮 hover 仅有颜色变化无 transform
And 骨架屏 shimmer 动画不触发
```

### 场景 10：Api Key 页面

```gherkin
Given 用户访问 /settings/apikeys
When 页面加载完成
Then 页面背景使用 var(--c-bg)
And API Key 卡片使用 var(--c-surface) 背景 + var(--c-border-strong) 边框
And "Create Key" 按钮使用 BaseButton primary 变体
And "Revoke" 按钮使用 BaseButton danger 变体
And 创建对话框使用 var(--c-surface) 背景 + 14px radius
And empty state 使用 EmptyState 组件
```

### 场景 11：404 页面

```gherkin
Given 用户访问不存在的路径
When 404 页面加载
Then 页面使用 var(--c-bg) 背景
And 标题使用 var(--c-text)
And 路径显示使用 var(--c-text-secondary) + monospace 字体
And 返回链接使用 BaseButton secondary 变体
```

### 场景 12：构建与类型检查

```gherkin
Given 所有重构已完成
When 运行 cd frontend-v3 && npx vue-tsc --noEmit
Then 退出码为 0（无类型错误）
And 运行 make build-frontend 成功
And 运行 cd frontend-v3 && ./node_modules/.bin/vitest run 全部通过
```

## 4. 待确认清单

| # | 问题 | 标记 | 决策 |
|---|------|------|------|
| 1 | 旧 token 迁移策略：是保留旧变量作为别名映射到新 token（安全但冗余），还是一次性把 18 个不在范围内的组件也迁移到 `--c-*`（彻底但范围扩大） | `[NEED_CONFIRM]` → **已确认** | **别名映射**：保留旧变量作为新 token 的别名（`--bg-primary: var(--c-surface)` 等），18 个组件不在本任务范围，后续可渐进迁移 |
| 2 | ApiKeyListView 的 Create Key 对话框当前是自实现的（不用共享 LoginDialog/ConfirmDialog），重构时是否也改用共享 BaseButton / 共享 Dialog 组件，还是只替换 token？ | `[NEED_CONFIRM]` → **已确认** | **只替换 token + BaseButton**，不改对话框结构（P0 范围：不改路由/API/状态管理逻辑） |
| 3 | P0 裁剪倾向 P8 "patch 版本"——确认发布类型？ | `[NEED_CONFIRM]` → **已确认** | **v0.3.1 patch**：视觉重构无新功能 |
| 4 | EntryListView 的 footer 包含 GitHub/PyPI/npm SVG 图标（非 Lucide），重构后是否统一改用 Lucide 图标？ | `[NEED_CONFIRM]` → **已确认** | **保留现有 SVG**：图标替换不在 P0 范围，避免引入视觉变化 |

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P8]
```

| 阶段 | 跳过？ | 理由 |
|------|--------|------|
| P1 | — | 当前阶段 |
| P2 | 否 | 涉及 7 个共享组件的 API 设计 + 旧→新 token 映射策略 + LandingView 全局提升方案，需要设计评审 |
| P3 | 否 | 共享组件需要 Vitest + Vue Test Utils 测试；跳过理由不成立（非文档/配置，非 ≤3 行） |
| P4 | — | 实现 |
| P5 | 否 | 必须跑 typecheck + build + vitest |
| P6 | 否 | 涉及 UI 改动 + dark/light 双主题，P6 不可跳（裁剪风险维度：涉及 ≥2 个改动端） |
| P7 | 是 | 所有改动在 frontend-v3 单包内，无跨包一致性问题 |
| P8 | 待确认 | 视觉重构可能作为 patch 版本发布，需用户确认 |

## 6. 范围声明

```yaml
packages:
  - peekview (frontend-v3 only)
domains:
  - frontend
  - design-system
  - ui
ui_affected: true
ui_affected_detail:
  - EntryListView.vue
  - EntryDetailView.vue
  - ApiKeyListView.vue
  - NotFoundView.vue
  - variables.css (token 迁移)
  - layout.css (token 迁移)
  - 新增 7 个共享组件
  - LandingView.vue (仅 token 作用域调整，不改视觉)
gate_commands:
  P5:
    - "cd frontend-v3 && npx vue-tsc --noEmit"
    - "make build-frontend"
    - "cd frontend-v3 && ./node_modules/.bin/vitest run"
  P6:
    - Playwright screenshots: dark + light + mobile for each page
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证 dark/light 主题 + 移动端响应式在所有重构页面上的视觉效果
    available:
      - playwright-vision skill (已注入)
      - vision-analyzer skill (已注入)
    status: available

  - need: css-token-audit
    why: 需验证旧 token 完全迁移（grep 零残留），新 token 映射正确
    available:
      - grep/rg 工具 (内置)
    status: available

  - need: accessibility-audit
    why: 验证 focus ring + contrast ratio + prefers-reduced-motion
    available:
      - playwright-vision + manual keyboard test
    status: supplementable
    supplement_note: "Playwright 可验证 focus ring 可见性；contrast ratio 需人工或 axe-core 工具补充"

  - need: minimal_validation
    why: CSS token 映射正确性可在开发环境通过视觉验证确认
    requires_minimal_validation: true
```
