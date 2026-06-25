---
phase: P0
task_id: T024
task_name: landing-page
trace_id: T024-P0-20260625
created: 2026-06-25
---

# P0 任务简报 — T024 landing-page

## task

解决"主页是 EntryListView"的硬伤 —— 将 `/` 从 EntryListView 改为 LandingView。

**LandingView 角色**：首次访问者入口 + 营销/SEO 价值。

- **未登录访问 `/`**：看 Landing 页（产品介绍、价值主张、示例、登录/注册 CTA）
- **已登录访问 `/`**：自动跳 `/explore`（已登录用户不需要 Landing）

**EntryListView 路由迁移**：
- 当前：`/` → EntryListView
- 改为：`/explore` → EntryListView
- router.ts 两处改动

## user_decisions

1. **产品定位**：只做"内容消费侧"，Landing 服务于"未登录访客转化为已登录用户"
2. **Landing 内容四要素**：
   - ① 价值主张（1-2 句话：什么、谁用）
   - ② 3-4 个公开 entry 示例（卡片样式）
   - ③ 登录/注册 CTA
   - ④ 链接到 GitHub / PyPI / MCP 文档（脚注式）
3. **已登录自动跳 `/explore`**：避免已登录用户看到 Landing（他们已经知道产品）
4. **不做 i18n**：保持英文
5. **不做 A/B 测试 / 多种 Landing**：保持单一版本

## known_risks

- **与 T023 顺序**：T023 必须先完成（404 兜底），T024 改 `/` 路由才安全
- **自动跳已登录**：要在 router 层面做（beforeEach 守卫），不能依赖 LandingView 内部 mounted 跳（避免闪烁）
- **示例 entry 数据来源**：从 `/api/v1/entries?is_public=true&per_page=4` 取最新 4 个公开 entry。LandingView 加载时拉一次
- **SEO meta**：Landing 是 SEO 入口，需要 `<title>` `<meta description>` `og:title` `og:description` `og:image` 等。参考现有 `EntryDetailView` 的 watch 注入 link rel="alternate" 模式
- **CSP 兼容**：Landing 是新页面，不引入内联事件，与现有 CSP 兼容
- **示例 entry 为空时**：如果全平台没公开 entry，Landing 显示"No public entries yet"提示，不显示空卡片
- **响应式**：桌面端和移动端都要可用，参考现有 EntryListView 的响应式断点（768px）
- **与 T025/T026 并发**：T024 不动 EntryListView 主体，但路由迁移后 EntryListView 移到 `/explore`，T025 改造 EntryListView 时需注意路径。**T025 必须等 T024 完成**

## executor_env

- platform: opencode
- has_task_tool: true
- has_local_runtime: true
- network: full

## env_constraints

- debug_env:
  - 前端测试：`cd frontend-v3 && ./node_modules/.bin/vitest run`
  - 前端构建：`cd frontend-v3 && npm run build`
  - 前端类型检查：`cd frontend-v3 && npx vue-tsc --noEmit`（CI 强制）
  - Playwright E2E：`make debug-test`（需 debug backend 运行）
  - **严禁** pip3 install --break-system-packages -e .（AGENTS.md 铁律 5）
  - **严禁** 用 CLI 创建测试 entry
  - **严禁** 直接 sqlite3 操作生产数据库

## phase_hint

[P1, P2, P3, P4, P5, P6]（执行期决定裁剪）

**裁剪倾向参考**（不写死）：
- P3 单元测试：LandingView 是新组件，可加 1 个 smoke 测试
- P6 端到端必做：验证"未登录看 Landing / 已登录跳 /explore / 路由 `/explore` 仍正常"

## 范围声明

**本任务做**：
- ① 新增 `frontend-v3/src/views/LandingView.vue`
  - Hero 段（产品名 + 价值主张 + Login/Register CTA）
  - 3-4 个公开 entry 示例（卡片，复用或简化 EntryCard 样式）
  - 脚注（GitHub / PyPI / MCP 文档链接）
  - SEO meta 注入（title / og:title / og:description）
- ② router.ts 改动：
  - `/` 改为 LandingView
  - 新增 `/explore` → EntryListView
  - 保留 `/:slug` `/settings/apikeys` 不变
  - 加 beforeEach 守卫：已登录用户访问 `/` 跳 `/explore`
- ③ api/client.ts（或 entry store）确保能从 `is_public=true&per_page=4` 拉公开 entry（T025 后端追加后会更顺；本任务先直接调 API 即可）
- ④ 验证：`vue-tsc` + `npm run build` + Playwright smoke

**本任务不做**：
- i18n（保持英文）
- A/B 测试（单一版本）
- 公开 entry 数量/排序配置（写死 4 个、按 created_at desc）
- 主题切换（沿用全局 ThemeToggle）
- 用户注册/登录表单（用现有 LoginDialog 弹窗，不在本任务做新表单）
- 服务条款 / 隐私政策页（产品不涉及敏感数据收集，暂不写）
- 替换现有 EntryListView 的样式（只移动路由）
- `/users/:username` 路由（T025 范围）

## coordination

- **T023 必须先**：T023 完成 404 兜底后，T024 才改 `/`
- **T025 依赖 T024**：T025 改造 EntryListView 时路径已从 `/` 移到 `/explore`
- **T026 依赖 T024**：T026 在 `/explore` 加 search input
- **T022 重构 P4**：不在 EntryListView 重构范围，不冲突
- **T021**：不动 EntryDetailView，不冲突

## 验收量化条件

- ✅ `LandingView.vue` 存在，< 200 行
- ✅ router.ts `/` → LandingView，`/explore` → EntryListView
- ✅ 未登录访问 `/` 显示 Landing（hero + 示例 + CTA）
- ✅ 已登录访问 `/` 自动跳 `/explore`
- ✅ 访问 `/explore` 显示 EntryListView（与 T024 前 `/` 行为一致）
- ✅ 访问 `/:slug` `/settings/apikeys` 不受影响
- ✅ LandingView SEO meta 注入：title/og:title/og:description
- ✅ `npx vue-tsc --noEmit` 0 错误
- ✅ `npm run build` 成功
- ✅ Playwright 验证：未登录看 Landing / 已登录跳 /explore

## 预期成果

| 指标 | 当前 | 目标 |
|------|------|------|
| `/` 路由 | EntryListView | LandingView |
| `/explore` 路由 | 不存在 | EntryListView |
| LandingView | 不存在 | 新增 < 200 行 |
| 路由总数 | 4 (T023 后) | 4（替换 1 个） |
| SEO 入口 | 无 | `/` 是有意义的 landing |
| 转化路径 | 无 | 未登录 → Landing → Login → 探索 |
