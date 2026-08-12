---
phase: P0
task_id: T026
task_name: search-url
trace_id: T026-P0-20260625
created: 2026-06-25
---

# P0 任务简报 — T026 search-url

## task

**一句话（工程视角）**：EntryListView header 加 search input（防抖 300ms 同步 `?q=`，按 Enter 立即触发，按 Esc 清空），与现有 `?owner=` tab 共存。

**详细**：

将搜索功能 URL 化，让搜索结果可分享 / 可书签 / 可链接。

**当前状态**：
- 后端 `list_entries` 已支持 `q` query param（FTS5 搜索）
- 前端 EntryListView **无 search input UI**（无显式搜索入口）

**本任务做**：
1. EntryListView header 加 search input（搜索框）
2. 输入时实时/防抖更新 URL（`/explore?q=keyword`）
3. 搜索结果高亮（可选，P1 决定）
4. URL 同步：tab 切换 + search 切换都用 `router.replace` 避免历史栈污染

**关键决策**：
- 搜索 = `/explore?q=xxx`（不开独立 `/search` 路由）
- 搜索与 tab 可组合：`/explore?q=keyword&owner=me`（看自己的搜索结果）
- 用户页（`/users/:username`）也可搜索：`/users/alice?q=keyword`

## user_decisions

1. **位置**：EntryListView header 加 search input
2. **URL 形态**：`/explore?q=xxx`（不开独立路由）
3. **搜索体验**：实时/防抖（P1 决定具体 debounce 时长，默认 300ms）
4. **搜索后端**：复用 FTS5，**不**改后端
5. **搜索范围**：默认全局搜索（公开 entry），与 tab 组合时是 tab 范围内搜索
6. **不做搜索历史 / 搜索建议 / 搜索热词**（"锦上添花"不做）
7. **不做搜索结果分页的特殊样式**（沿用现有 entry 卡片）

## known_risks

- **FTS5 已有**：后端 FTS5 在 `entry_service.py:354-370` 已实现，本任务不碰后端
- **搜索 + tab 组合**：URL query 参数组合要保持一致
  - `/explore?owner=me` + 输入搜索 → `/explore?owner=me&q=keyword`
  - 清空搜索 → `/explore?owner=me`（保留 owner）
- **搜索 + 分页**：分页参数 `page` 与 `q` 共存时要正确（`/explore?q=foo&page=2`）
- **防抖与 router 同步**：避免每次按键都改 URL（防抖 300ms）
- **搜索为空**：URL `/explore?q=NoResults` 后端返空列表，前端显示"No entries found"
- **特殊字符转义**：FTS5 查询有特殊语法，前端需做基础转义（`"` 等），或依赖后端 try/except 静默吞掉
- **CSP 兼容**：search input 是普通 HTML input，不引入内联事件
- **响应式**：移动端 search input 要全宽
- **回车提交**：按 Enter 立即触发（不等待防抖）；按 Esc 清空
- **搜索框 focus 时全局快捷键**：与 T021 zen mode 的 f 键无冲突（f 是详情页快捷键）
- **与 T025 并发**：T026 改 EntryListView 加 search input，T025 也改 EntryListView 加 banner + owner prop。**需协调**避免同时改 EntryListView 主体

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

## pruning_tendency

**激进** — T026 是纯前端小活（后端 FTS5 已有），无后端改动、无安全风险。P3 单元测试轻量（防抖测试繁琐可省），P1 BDD 简明（5-6 条即可）。P6 端到端必做（验证 URL 同步、清空、tab 组合）。

## phase_hint

[P1, P2, P3, P4, P5, P6]（执行期决定裁剪）

**裁剪倾向参考**（不写死）：
- **P3 单元测试轻量**：search input 的 URL 同步逻辑可测，但防抖测试较繁琐，可省
- **P6 端到端必做**：搜索 → URL 更新 → 结果展示 → 清空 → URL 移除

## 范围声明

**本任务做**：
- ① `EntryListView.vue` header 加 search input
  - input 绑定到 `?q=` query
  - 防抖 300ms 触发 `router.replace`
  - 按 Enter 立即触发
  - 按 Esc 清空
  - mount/route 变化时从 URL 读 `q` 填入 input
- ② URL 同步逻辑：与现有 `?owner=` 同步共处
  - `setOwner()` 同时保留/更新 `?q=`
  - `setQuery()` 同时保留/更新 `?owner=`
  - 用 `router.replace` 避免历史栈污染
- ③ 搜索结果展示：沿用现有 entry 卡片，**不**加高亮（P1 决定是否需要）
- ④ 验证：`vue-tsc` + `npm run build` + Playwright

**本任务不做**：
- 后端改动（FTS5 已有）
- 独立 `/search` 路由
- 搜索历史 / 建议 / 热词
- 搜索结果高亮（默认不做，P1 决定）
- 搜索语法（AND/OR/引号）—— FTS5 支持但前端不暴露
- 移动端专门样式（沿用桌面端响应式）
- 搜索防抖时长配置（写死 300ms）

## coordination

- **T024 必须先**：EntryListView 路径移到 `/explore` 后 T026 才能改
- **T025 与 T026 并发风险**：两个都改 EntryListView 主体。**协调方案**：
  - 选项 A：T025 完成后 T026 再开始（串行）
  - 选项 B：T025 改 header / T026 也改 header，**冲突高**
  - **推荐选项 A**（T025 完成后 T026 再开始，依赖链：T025 → T026）
- **T022 重构 P4**：在 T025/T026 完成后启
- **T021**：不动 EntryDetailView，不冲突

## 验收量化条件

- ✅ EntryListView header 有 search input
- ✅ 输入关键词 → 防抖 300ms 后 URL 更新为 `/explore?q=keyword`
- ✅ 按 Enter 立即更新 URL
- ✅ 按 Esc 清空 input + URL 移除 `?q=`
- ✅ 访问 `/explore?q=keyword` 直接显示搜索结果
- ✅ 搜索与 tab 组合：访问 `/explore?owner=me&q=keyword` 显示自己的搜索结果
- ✅ 搜索与用户页组合：访问 `/users/alice?q=keyword` 显示 alice 的搜索结果
- ✅ 清空 input 后 URL 正确（保留 `owner=` 如果有）
- ✅ 分页与搜索组合：`/explore?q=foo&page=2` 正确加载第 2 页
- ✅ 搜索为空时显示"No entries found"
- ✅ 浏览器后退/前进不影响 search input
- ✅ `npx vue-tsc --noEmit` 0 错误
- ✅ `npm run build` 成功
- ✅ 86 + 16 现有测试仍全绿

## 预期成果

| 指标 | 当前 | 目标 |
|------|------|------|
| search input UI | 无 | 新增 |
| URL 化搜索 | 无 | ✅ |
| 搜索可分享 | ❌ | ✅（`/explore?q=xxx`） |
| 搜索 + tab 组合 | ❌ | ✅（`?owner=&q=`） |
| 搜索 + 分页 | ❌ | ✅ |
| 搜索 + 用户页 | ❌ | ✅ |
| 前端测试 | 86 | +2-3 |
