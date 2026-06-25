---
phase: P0
task_id: T023
task_name: page-basics
trace_id: T023-P0-20260625
created: 2026-06-25
---

# P0 任务简报 — T023 page-basics

## task

清理前端页面体系的两个**基础完整度**问题：

1. **删除 `views/HomeView.vue` 僵尸文件**：router.ts 未引用，是 v3 起步时的占位欢迎页（17 行），留着误导后人、占搜索结果、占 git 树
2. **添加 404 兜底路由** `NotFoundView`：vue-router 当前无 catch-all，未匹配路径行为未定义（实际可能跳到 `/` 或显示空白）。新增友好的 404 页（提示信息 + 返回首页按钮）

**这是 T024-T027 整批任务的基础**（依赖链根）。完成后路由体系才"完整"。

## user_decisions

1. **产品定位**：只做"内容消费侧"（访问/发现/分享），不做"内容生产侧 web 化"
2. **不引入新依赖**：用现有 vue/vue-router，无新包
3. **404 页保持轻量**：1 个 .vue 文件 + 路由配置 + 主页 + 返回按钮
4. **保持现有路由不变**：T023 不动 `/` `/:slug` `/settings/apikeys` 三个现有路由
5. **未登录可见决策**（已与用户确认）：
   - `/explore` 未登录见 public ✅
   - `/users/:username` 未登录见 public ✅
   - `/:slug` public 未登录可见 ✅

## known_risks

- **404 路由位置影响**：`/:pathMatch(.*)*` 必须放在路由表**最后**，否则会拦截 `/settings/apikeys` 等正常路径。vue-router 行为，但需在 P2 验证
- **HomeView 删除影响**：纯删除，理论上无影响。但需确认无测试/导入引用（grep `HomeView` 应为空，T021 时已确认无引用）
- **catch-all 与 T024 Landing 顺序**：T024 会把 `/` 改为 Landing。如果 T023 先做、T024 后做，过程中访问 `/` 仍会走 EntryListView（T023 不动 `/`），无中断风险
- **CSP 兼容性**：NotFoundView 是纯静态展示，不引入新内联事件，与现有 CSP 兼容

## executor_env

- platform: opencode
- has_task_tool: true
- has_local_runtime: true
- network: full

## env_constraints

- debug_env:
  - 前端测试：`cd frontend-v3 && ./node_modules/.bin/vitest run`
  - 前端构建：`cd frontend-v3 && npm run build`（自动复制到 static/）
  - 前端类型检查：`cd frontend-v3 && npx vue-tsc --noEmit`（CI 强制）
  - 后端测试：无需（本任务纯前端）
  - **严禁** pip3 install --break-system-packages -e .（AGENTS.md 铁律 5）
  - **严禁** 用 CLI 创建测试 entry
  - **严禁** 直接 sqlite3 操作生产数据库

## phase_hint

[P1, P2, P3, P4, P5, P6]（执行期根据 subagent 能力决定裁剪 P3/P5）

**裁剪倾向参考**（P0 阶段不写死）：
- T023 是小活，**P3 单元测试价值低**（无逻辑，仅 1 个组件 + 1 路由），可省
- **P6 端到端必做**（验证 404 路由 + 返回首页可用）
- **P1 BDD 简明**（3-4 条即可：删除文件、404 页存在、catch-all 生效、返回按钮工作）

## 范围声明

**本任务做**：
- ① 删除 `frontend-v3/src/views/HomeView.vue` 文件
- ② 新增 `frontend-v3/src/views/NotFoundView.vue`（友好 404 页）
  - 显示"Page not found"提示
  - "返回首页"按钮（router-link → `/`）
  - 可选：显示请求的 path
- ③ `frontend-v3/src/router.ts` 加 catch-all：
  ```ts
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./views/NotFoundView.vue'),
  }
  ```
- ④ 验证：grep `HomeView` 全仓为空（无引用残留）
- ⑤ 跑 `npx vue-tsc --noEmit` + `npm run build` 确认无破坏

**本任务不做**：
- 不动 `/` 路由（T024 才改 Landing）
- 不动其他现有路由
- 不改后端
- 不加 i18n（保持英文即可）
- 不加动画/过渡（保持极简）
- 不重定向"访问不存在 slug" 场景（那是 EntryDetailView 已有的 entry 加载错误处理，不归 404 页管）

## coordination

- **依赖链根**：T023 → T024（必须等 T023 完成才能做 T024）
- **T022 重构 P4 实施**：在 T025/T026 完成后启，不与 T023 冲突
- **T020 / T021**：不影响

## 验收量化条件

- ✅ `HomeView.vue` 文件不存在
- ✅ `NotFoundView.vue` 存在且 < 50 行
- ✅ router.ts 有 catch-all 路由
- ✅ `npx vue-tsc --noEmit` 0 错误
- ✅ `npm run build` 成功
- ✅ 访问 `/random-nonexistent-path` 显示 NotFoundView
- ✅ 访问 `/` `/settings/apikeys` `/{any-slug}` 仍正常

## 预期成果

| 指标 | 当前 | 目标 |
|------|------|------|
| `HomeView.vue` | 存在（17 行僵尸） | 删除 |
| `NotFoundView.vue` | 不存在 | 新增 < 50 行 |
| router 路由数 | 3 个 | 4 个 |
| 全仓 `HomeView` 引用 | 0（已确认） | 0 |
| 404 行为 | 未定义 | 友好 404 页 |
