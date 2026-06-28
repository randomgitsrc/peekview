# P1 进度日志 — T024 landing-page

## Step 1: 读取输入文件
- [x] P0-brief.md — 任务简报：/ 改 LandingView，/explore 迁 EntryListView，beforeEach 守卫，SEO，4要素Landing
- [x] router.ts — 当前路由：/→EntryListView, /:slug→EntryDetailView, /settings/apikeys→ApiKeyListView, /:pathMatch(.*)*→NotFoundView (T023 catch-all)
- [x] EntryListView.vue — 643行，含header(h1 "PeekView" + Login按钮 + 用户菜单 + ThemeToggle)，entry网格，分页，footer(GitHub/PyPI/npm + tagline + version/copyright)
- [x] EntryDetailView.vue — 696行，goBack() 和 handleDelete() 均 `router.push('/')`，SEO meta 通过 watch 注入 link[rel=alternate]
- [x] auth.ts — authState: loading|authenticated|anonymous，initializing ref 控制，fetchMe() 在 main.ts mount前调用
- [x] client.ts — PeekAPI class，listEntries() 已有 perPage 参数
- [x] entry.ts store — loadEntries() 支持 ListEntriesParams

## Step 2: 分析隐式依赖

### API 后端
- `GET /api/v1/entries` 无 `is_public` 查询参数，但**匿名用户请求时后端自动过滤为 is_public=True 的 entries**
- 现有 API 已满足 LandingView 需求：直接调用 `api.listEntries({ perPage: 4 })` 即可获得至多4个公开entry
- 无需等 T025 后端改造

### 前端
- App.vue: router-view 带 fade transition，无其他全局组件影响
- main.ts: fetchMe() 在 app.mount() 前调用，authState 在 mount 时通常已 resolved
- vite.config.ts: 无 head 管理插件，SEO meta 需用 DOM 操作方式（与 EntryDetailView 的 link 注入一致）
- package.json: 无 @unhead/vue / vue-meta 等包
- CSS 变量体系：`--bg-primary`, `--text-primary`, `--accent-color` 等，LandingView 需复用
- 响应式断点：768px (mobile), 640px (small mobile)
- ThemeToggle 独立组件，LandingView 可复用
- LoginDialog 独立组件，LandingView 可复用

### 路由兼容性
- `/explore` 是静态路由，必须在 `/:slug` 之前注册，否则会被 catch
- EntryDetailView 内 `router.push('/')` 有2处：goBack() / handleDelete()，需改为 `/explore`
- `/:slug`, `/settings/apikeys`, catch-all 不受影响
- 无其他组件 hardcode `router.push('/')`

### 安全
- CSP `script-src 'self' 'unsafe-eval'` — LandingView 不引入 inline scripts，兼容
- 无新增认证/权限逻辑

### 多端
- MCP/CLI/API 无变更需求

## Step 3: BDD 草案 (8条)
1. 匿名用户看 Landing (hero + 示例 + CTA + footer)
2. 已登录用户 / → 自动跳 /explore（无闪烁）
3. authState===loading 时不触发跳转（等 fetchMe 完成）
4. /explore 显示 EntryListView（与迁前 / 行为一致）
5. 空公开 entry 时显示 fallback 消息
6. SEO meta 注入: title + description + og:title + og:description
7. EntryDetailView back/delete 导航到 /explore
8. /:slug /settings/apikeys 不回归

## Step 4: 待确认项
- 无 NEED_CONFIRM 项。需求明确，所有隐式依赖的技术解方向清晰。
