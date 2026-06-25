---
phase: P0
task_id: T025
task_name: user-page
trace_id: T025-P0-20260625
created: 2026-06-25
---

# P0 任务简报 — T025 user-page

## task

实现"看特定用户发布历史"的产品核心场景，包含 4 个紧密相关改动：

1. **新增 `/users/:username` 路由**（复用 EntryListView，不新组件）
2. **EntryListView 接受 `owner` prop**（已有 `setOwner` 逻辑扩展）
3. **EntryListView 当 `owner` prop 存在时显示 banner**（`@username 的发布内容` + Back to Home）
4. **EntryListView tab 状态同步到 query 参数**（`?owner=me` / `?owner=alice`）
5. **卡片 `@username` 包 router-link** → 跳 `/users/:username`（已登录点自己跳 `/explore?owner=me`）

**关键决策（已与用户确认）**：
- ❌ **没有 `/users/me` 路由**（避免 "me" 污染路由语义）
- ❌ **没有 `/mine` 路由**（看自己用 `/explore?owner=me`）
- ✅ URL 严格：路由 `:username` 必须是真 username

## user_decisions

1. **信息架构**：类比 GitHub（`/{user}` 看用户所有内容）
2. **`/users/:username` 复用 EntryListView**：不新组件，路由配置 1 项 + 1 prop
3. **后端 `list_entries` 接受 `owner=username`**：通过 User 表 join 查 `owner_id`
4. **未登录可见**：用户公开页未登录见 public entry（已与用户确认）
5. **banner + Back to Home**：解决"跳来跳去"感知
6. **tab URL 同步**：`/explore?owner=me` / `/explore?owner=alice` 可分享
7. **点自己用户名跳 `/explore?owner=me`**：避免重复 URL

## known_risks

- **后端 User join 性能**：当前 `list_entries` 只处理 `owner=me` 特殊值。加 `owner=username` 需要 join User 表查询 `user_id`。需考虑索引（`users.username` 应有 UNIQUE 索引，已确认）
- **大小写不敏感**：username 是否大小写不敏感？后端如何处理？需 P1 明确
- **不存在的 username**：`/users/random-nonexistent-user` 应显示什么？空 entry 列表 / 404？后端返空列表 = 显示"No entries from @random-nonexistent-user" + "User not found"提示
- **删除用户**：`/users/deleted-user` 应该 404 而不是显示空（避免泄露信息）
- **与 T024 顺序**：T024 必须先完成（EntryListView 路径移到 `/explore`），T025 才能扩展
- **CSP 兼容**：不引入新内联事件
- **响应式 banner**：移动端 banner 也要正常显示
- **router-link 嵌套**：卡片结构已有 router-link（整个卡片 clickable），username 包 router-link 会**嵌套 router-link**（HTML 不允许）。需要重构：要么只让 username 部分 clickable（停止事件冒泡），要么改用 button + programmatic navigate
- **tab URL 同步与 router push 冲突**：tab 切换时改 URL 不能触发 router reload 整个组件（用 `router.replace` 而非 `router.push`，避免历史栈污染）
- **banner 视觉一致性**：与现有 EntryListView 顶部 header 风格统一

## executor_env

- platform: opencode
- has_task_tool: true
- has_local_runtime: true
- network: full

## env_constraints

- debug_env:
  - 后端测试：`cd backend && .venv/bin/python -m pytest tests/`
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
- **P3 单元测试必做**：后端 `list_entries` 接受 `owner=username` 的逻辑（5-8 个测试覆盖：未登录/已登录/admin/不存在的 username/大小写）
- **P6 端到端必做**：用户公开页加载、tab URL 同步、卡片 click username、不存在用户处理

## 范围声明

### 后端

- ① `peekview/services/entry_service.py`：`list_entries` 扩展
  - 接受 `owner=username`（真 username 字符串）
  - 通过 `users` 表 join 查 `user_id`
  - 处理 username 不存在情况（返空列表，不是 404）
  - **大小写敏感性**（P1 决定：默认不敏感，统一 lowercase）
  - 已有 `owner=me` 逻辑保留
- ② `peekview/api/entries.py` 路由透传 `owner` query param（已支持，无需改）
- ③ `peekview/models.py` 检查 `User.username` UNIQUE 索引（应已存在）
- ④ 后端单测：5-8 个测试

### 前端

- ⑤ `router.ts` 新增：
  ```ts
  {
    path: '/users/:username',
    name: 'user-entries',
    component: EntryListView,
    props: (route) => ({ owner: route.params.username as string }),
  }
  ```
- ⑥ `EntryListView.vue` 改造：
  - 接受 `owner?: string` prop（与 URL query `?owner=` 同步）
  - 当 `owner` prop 存在时显示 banner（"@username 的发布内容" + Back to Home 按钮）
  - banner 模式下隐藏 tab（用户页不需要切 All/Mine）
  - tab 状态同步：`setOwner()` 同时调 `router.replace({ query: { owner: ... } })`
  - mount/route 变化时从 URL 读 owner
- ⑦ 卡片改造：`@username` 包 router-link
  - 解决嵌套 router-link：卡片整体不再 clickable，**只**让 username 部分 clickable（用 `@click.stop` 阻止冒泡或改 `<a>` 元素）
  - P1 决定具体方案
- ⑧ 已登录用户点自己用户名跳 `/explore?owner=me`（在卡片 username 链接上加判断）
- ⑨ 验证：`vue-tsc` + `npm run build` + Playwright

**本任务不做**：
- `/users/me` 路由
- `/mine` 路由
- 完整用户 Profile（粉丝/关注/简介/个人 bio 等）
- 用户头像
- 用户统计（entry 数量、加入时间等）
- 用户公开 API key 列表
- 重命名 username 后的 URL 重定向（先不考虑）
- 用户的"关注"功能（产品定位外）

## coordination

- **T024 必须先**：EntryListView 路径移到 `/explore` 后才能改造
- **T026 可与 T025 并行**：T026 改 EntryListView 加 search input，T025 改 EntryListView 加 banner + owner prop，**需协调**避免同时改 EntryListView 主体
- **T022 重构 P4**：在 T025/T026 完成后启（避免 EntryListView 周围文件多 agent 改冲突）
- **T021**：不动 EntryDetailView，不冲突
- **T023/T024**：T023/T024 完成后启 T025

## 验收量化条件

### 后端

- ✅ `list_entries(owner='alice')` 返 alice 的所有 entry（admin 看全部，已登录看 public+own，未登录看 public）
- ✅ `list_entries(owner='NonExistent')` 返空列表
- ✅ `list_entries(owner='ALICE')` 与 `owner='alice'` 行为一致（大小写不敏感，P1 决策）
- ✅ 已有 `owner='me'` 行为不变（回归保护）

### 前端

- ✅ 访问 `/users/alice` 显示 alice 的公开 entry 列表 + banner
- ✅ 访问 `/users/alice`（未登录）显示 alice 的 public entry
- ✅ 访问 `/users/NonExistent` 显示空列表 + "User not found" 提示
- ✅ 访问 `/explore?owner=me` tab 显示 Mine
- ✅ 访问 `/explore?owner=alice` tab 显示 All + 筛选 alice
- ✅ 访问 `/explore` tab 显示 All（默认）
- ✅ tab 切换 URL 同步（不污染历史栈）
- ✅ 卡片 username clickable → 跳 `/users/:username`
- ✅ 已登录用户点自己 username 跳 `/explore?owner=me`
- ✅ 嵌套 router-link 不出现（HTML 校验）
- ✅ `npx vue-tsc --noEmit` 0 错误
- ✅ `npm run build` 成功
- ✅ 86 + 16 现有测试仍全绿（行为保真）

## 预期成果

| 指标 | 当前 | 目标 |
|------|------|------|
| `/users/:username` 路由 | 不存在 | 新增 1 项 |
| `list_entries` 支持真 username | ❌ | ✅ |
| EntryListView banner 模式 | ❌ | ✅（owner prop 存在时显示） |
| EntryListView tab URL 同步 | ❌ | ✅（`?owner=`） |
| 卡片 username clickable | ❌ | ✅ |
| 后端测试 | 577 | +5-8 |
| 前端测试 | 86 | +3-5 |
| 加新场景成本 | 看特定用户无解 | URL 可分享 |
