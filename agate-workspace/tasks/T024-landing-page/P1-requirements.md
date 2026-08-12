---
phase: P1
task_id: T024-landing-page
type: requirements
parent: P0-brief.md
status: draft
domains: [frontend]
ui_affected: true
---

# P1 需求基线 — T024 landing-page

## 1. 需求复述

将 PeekView 根路由 `/` 的视图从 EntryListView 改为新组件 LandingView，实现"未登录→Landing（转化入口），已登录→/explore（内容列表）"的双态路由行为。

**Landing 页内容四要素**（来自 P0 user_decisions）：
1. 价值主张（1-2 句：PeekView 是什么、谁用）
2. 3-4 个公开 entry 示例卡片（从 `GET /api/v1/entries?per_page=4` 拉取，匿名请求时后端自动过滤为 public entries）
3. 登录/注册 CTA（复用现有 LoginDialog）
4. 脚注链接（GitHub / PyPI / npm MCP Server）

**路由迁移**：EntryListView 从 `/` 迁到新路由 `/explore`。

**已登录守卫**：`router.beforeEach` 守卫检测已登录用户访问 `/` 时自动 `next('/explore')`。

**不做的**：i18n、A/B 测试、User 路由、EntryListView 样式改动、注册表单、服务条款。

## 2. 隐含需求识别

### 2.1 数据
- **API 数据源无需改造**：后端 `list_entries` 在匿名用户请求时已自动过滤 `is_public=True`，LandingView 直接调用 `api.listEntries({ perPage: 4 })` 即可。无需等待 T025 后端追加 `is_public` 查询参数。
- **无数据迁移**：纯前端改动，不涉及数据库 schema。

### 2.2 前端——路由顺序
- `/explore` 是静态路由，必须在路由数组 `/:slug` 之前注册。否则 Vue Router 会将 `explore` 当作 `:slug` 参数值匹配到 EntryDetailView。

### 2.3 前端——EntryDetailView 硬编码路径修复
- `EntryDetailView.vue` 的 `goBack()`（line 446）和 `handleDelete()`（line 382）均使用 `router.push('/')`。路由迁移后这两处指向 LandingView 而非 entry 列表页。这是**路由迁移的必然副作用**，必须同步修改为 `/explore`。

### 2.4 前端——auth 初始化竞态
- `main.ts` 在 `app.mount()` 前调用 `authStore.fetchMe()`，但 `fetchMe()` 是异步的。若用户在初始 HTTP 请求时已有 JWT cookie，`fetchMe()` 可能尚未完成时路由守卫已触发，此时 `authState === 'loading'`。
- beforeEach 守卫必须在 `authState === 'loading'` 时**不执行跳转**（放行），等待 auth 解析后由 App 重新导航或 auth watch 处理。否则会导致未认证用户看到 landing 前先被误判为"loading 中"而卡住，或已认证用户看到 landing 闪烁。

### 2.5 前端——SEO meta 注入方式
- 项目无 head 管理库（`@unhead/vue`、`vue-meta` 等），EntryDetailView 使用 `document.head.appendChild(link)` 的 DOM 操作方式注入 `<link rel="alternate">`。
- LandingView 的 SEO meta（`<title>`、`<meta name="description">`、`og:title`、`og:description`）必须采用一致的 DOM 操作注入方式（`onMounted` 注入，`onUnmounted` 清理），保持项目代码风格统一。

### 2.6 前端——CSP 兼容
- 现有 CSP 为 `script-src 'self' 'unsafe-eval'`。LandingView 不使用 `eval()`/`new Function()`，不引入内联事件处理器（使用 `@click` 而非 `onclick=`），不加载外部脚本。**CSP 无需修改**。

### 2.7 多端
- **无 MCP/CLI/API 变更需求**。LandingView 是纯前端渲染页面，对 MCP/CLI 透明。

### 2.8 边界
- **空公开 entry**：系统没有任何 public entry 时，LandingView 示例区域显示 "No public entries yet" 提示文字，不渲染空卡片容器。
- **API 请求失败**：加载示例 entry 失败时，LandingView 显示错误提示或降级为隐藏示例区域（不阻塞页面其余部分渲染）。
- **直接访问 `/explore`**：无需认证，匿名用户也可访问 EntryListView（与迁移前 `/` 行为一致——匿名用户看到公开 entries，无 All/Mine tabs）。
- **浏览器后退/前进**：已登录用户在 `/explore` 点后退到 `/` 应被守卫重定向回 `/explore`（此行为正常，非无限循环）。

### 2.9 兼容
- `/:slug` 路由行为不变（包括私有 entry 的 404 返回）
- `/settings/apikeys` 路由行为不变
- T023 catch-all `/:pathMatch(.*)*` → NotFoundView 不回归
- 应用版本号 `__APP_VERSION__` 仍在 footer 正常显示
- ThemeToggle 在 LandingView header 正常可用

## 3. BDD 验收条件

### BDD-1: 匿名用户看到 Landing 全貌
**Given** 当前用户未登录（authState === 'anonymous'）
**When** 访问 `/`
**Then** LandingView 渲染，包含：
- Hero 区域（产品名 "PeekView" + 价值主张文案）
- 示例 entry 卡片区域（至多 4 个，从 API 拉取公开 entries）
- 登录/注册 CTA 按钮
- 脚注链接（GitHub / PyPI / npm）
- ThemeToggle 可用

### BDD-2: 已登录用户自动跳转 /explore
**Given** 当前用户已登录（authState === 'authenticated'）
**When** 访问 `/`
**Then** 浏览器地址栏变为 `/explore`，页面渲染 EntryListView
**And** 不出现 LandingView 的任何内容闪烁

### BDD-3: auth 加载中不触发跳转
**Given** authState 为 'loading'（fetchMe 尚未完成）
**When** 访问 `/`
**Then** LandingView 正常渲染（不触发 beforeEach 跳转）
**And** 当 authState 变为 'authenticated' 后，守卫回调或后续导航将用户带到 `/explore`

### BDD-4: /explore 显示 EntryListView
**Given** 任意用户（匿名或已登录）
**When** 访问 `/explore`
**Then** EntryListView 正常渲染，包含：
- 标题 "PeekView"
- 登录按钮（匿名时）或用户菜单（已登录时）
- 公开 entry 卡片网格（已登录时额外有 All/Mine tabs）
- 分页器
- Footer（GitHub/PyPI/npm 链接 + 版本号）

### BDD-5: 无公开 entry 时的 fallback
**Given** 系统中没有任何 is_public=true 的 entry
**When** 匿名用户访问 `/`
**Then** 示例 entry 区域显示 "No public entries yet" 提示文字
**And** 其余 Landing 内容（hero、CTA、footer）正常渲染

### BDD-6: SEO meta 标签注入
**Given** 匿名用户访问 `/`
**When** 检查页面 `<head>` 元素
**Then** 存在以下标签：
- `<title>PeekView</title>`（与 index.html 静态标题一致或不冲突）
- `<meta name="description">` 含产品描述
- `<meta property="og:title">` 含 "PeekView"
- `<meta property="og:description">` 含产品描述

### BDD-7: EntryDetailView 导航目标修正
**Given** 用户正在查看某个 entry 详情页（EntryDetailView）
**When** 点击 back 按钮或删除当前 entry
**Then** 导航到 `/explore`（EntryListView），而非 LandingView

### BDD-8: 存量路由不回归
**Given** 任意用户
**When** 访问 `/:slug`（任意存在的 entry slug）、`/settings/apikeys`、或任意不存在的路径
**Then** 各路由渲染结果与 T024 改动前完全一致（EntryDetailView / ApiKeyListView / NotFoundView）

## 4. 待确认清单

无 `[NEED_CONFIRM]` 项。所有隐含依赖的技术解决方向在 P0 brief 中已明确或从现有代码可推导。

## 5. 裁剪说明

| 阶段 | 决策 | 理由 |
|------|------|------|
| P1 | 保留 | 需求基线文档（本文件） |
| P2 | **跳过** | 无方案歧义：1 新组件 + 2 路由替换 + 1 个 beforeEeach 守卫 + DOM 方式 SEO 注入。所有技术决策已有唯一解（复用 LoginDialog/ThemeToggle，跟随 EntryDetailView 的 DOM meta 注入模式，路由顺序 `explore` 在 `/:slug` 前）。无需方案设计文档 |
| P3 | **跳过** | P0 brief pruning_tendency="激进"且明确建议"1 个 smoke test 即可"。LandingView 是纯展示组件（无交互逻辑），beforeEach 守卫是纯控制流（分支简单）。单元测试价值密度低，可并入 P5 阶段做 build + typecheck 验证 |
| P4 | 保留 | 代码实现 |
| P5 | 保留 | 技术验证：`npx vue-tsc --noEmit` 0 error + `npm run build` 成功 |
| P6 | 保留 | BDD 端到端验收（Playwright）：验证 BDD-1/2/4/7/8 至少 5 条关键验收条件。UI 变更必须浏览器验证 |
| P7 | **跳过** | 改动文件数 ≤ 3（LandingView.vue + router.ts + EntryDetailView.vue goBack 修复），无需一致性检查 |
| P8 | 保留 | 前端版本号 bump（package.json + composer 或 CHANGELOG） |

## 6. 范围声明

```yaml
packages:
  - frontend-v3

domains:
  - frontend

ui_affected: true
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: unit-test-runner
    why: P5 阶段可能需要跑 vitest 验证无回归
    available:
      - vitest (devDependency, 已安装)
    status: available

  - need: type-checker
    why: P5 阶段跑 vue-tsc 验证类型正确
    available:
      - vue-tsc (devDependency, 已安装)
    status: available

  - need: build-tool
    why: P5 阶段验证 npm run build 成功（含 vue-tsc 前置检查）
    available:
      - vite (devDependency, 已安装)
    status: available

  - need: browser-vision
    why: P6 验收阶段需要 Playwright 实跑浏览器验证 BDD 条件
    available:
      - playwright-cdp skill（已注入，端口 18800）
      - @playwright/test (devDependency, 已安装)
    status: available
```

无 `CAPABILITY_GAP`。所有能力在当前环境均已具备。
