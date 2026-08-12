---
phase: P1
task_id: T065
type: problems
parent: P0-brief.md
trace_id: T065-P1-20260722
status: draft
created: 2026-07-22
agent: analyst
---

# T065 登录状态 Bug - 需求基线

## 需求复述

修复 Landing 页两个登录状态相关 bug：

1. **已认证用户访问 `/` 不跳转 `/explore`**：已登录用户刷新或直接访问 landing 页时，`beforeEach` 守卫因 `authState` 仍为 `'loading'` 而不重定向；LandingView 挂载后 `authState` 已是 `'authenticated'`，watch 无变化不触发跳转
2. **已认证用户看到 Sign in 按钮**：LandingView.vue:19 的 Sign in 按钮无条件渲染，无 `v-if` / `authState` 绑定

## 实跑复现证据

### 症状①：不跳转（仅页面刷新场景可复现）

- **场景**：已认证用户在 `/explore` -> 浏览器地址栏输入 `/` -> 回车（全页刷新）
- **结果**：用户留在 `/`，Sign in 按钮可见
- **SPA 内导航不可复现**：`router.push('/')` -> `beforeEach` 正确重定向到 `/explore`
- **登录对话框登录不可复现**：从匿名态登录 -> `authState` 从 `'anonymous'` 变为 `'authenticated'` -> watch 触发 -> 正确跳转 `/explore`
- **根因**：`app.use(router)` 在 `fetchMe()` 之前触发初始路由解析，`beforeEach` 看到 `authState='loading'` 不重定向；LandingView 挂载时 `authState` 已是 `'authenticated'`，watch 检测不到变化

### 症状②：Sign in 不消失（所有已认证场景可复现）

- **场景**：已认证用户在 landing 页
- **结果**：Sign in 按钮始终可见，无任何 auth 条件绑定
- **根因**：`LandingView.vue:19` 无条件渲染 `<button>Sign in</button>`，没有 `v-if="authState === 'anonymous'"`

### 因果关系

两个症状同根但独立：
- 若仅修好跳转（症状①），已认证用户不会再停留在 landing，Sign in 问题在 landing 上不可见--但用户通过浏览器后退等方式仍可能回到 landing 看到 Sign in
- Sign in 条件渲染（症状②）是独立缺失，不论跳转是否工作都需要修

## 隐含需求识别

| 维度 | 隐含需求 | 为什么必须 |
|------|----------|-----------|
| 数据 | `authState` 状态机（loading/authenticated/anonymous）的迁移时机必须可观测 | 全页加载时 loading->authenticated 迁移发生在路由守卫之后，是症状①的根因数据流 |
| 前端 | Landing 页 Sign in 按钮在已认证态应替换为用户信息/登出操作 | 与 EntryListView 行为一致（匿名->Login，认证->用户菜单），否则用户在 landing 无法登出 |
| 前端 | 全页加载时已认证用户必须被重定向到 /explore | `app.use(router)` 触发初始路由解析时 `fetchMe` 未完成，守卫看到 `authState='loading'` 不重定向；无论用何种机制，全页加载的已认证用户最终须落到 /explore |
| 前端 | LandingView 的 `watch(authState)` 需处理 `authState` 在挂载前已为 `'authenticated'` 的情况 | 页面刷新时 watch 设置时 authState 已是 `'authenticated'`，无变化不触发 |
| 边界 | `authState='loading'` 时 landing 页应正常渲染（不闪跳转） | `fetchMe` 期间 `initializing=true`，若守卫把 `loading` 当 `anonymous` 放行则正确 |
| 边界 | token 过期（`peekview:auth-expired` 事件）场景不在本任务范围 | token 过期触发 `authState -> anonymous`，属既有登出流程；landing 在匿名态的渲染由 BDD-2 覆盖，无需重复 |
| 兼容 | 登录对话框登录（匿名->认证）的跳转行为不能被破坏 | 当前 watch 在此场景正常工作，修复不应引入回归 |
| 多端 | 无 MCP/CLI/后端改动需求 | 纯前端 bug |

## BDD 验收条件

### BDD-1: 已认证用户全页加载 / 被重定向到 /explore

```
Given 用户已认证（浏览器存有有效 token，authState 将变为 'authenticated'）
When 用户全页加载 / （地址栏输入并回车，或刷新当前页）
Then 页面最终 URL 为 /explore
```

### BDD-2: Landing 页 Sign in 按钮仅在匿名态可见

```
Given 用户未登录（authState = 'anonymous'）
When 用户访问 /
Then Sign in 按钮可见
```

### BDD-3: Landing 页已认证态不显示 Sign in

```
Given 用户已登录（authState = 'authenticated'）
When 用户访问 /（无论是否被重定向）
Then Sign in 按钮不可见
```

### BDD-4: 已认证用户在 landing 页可见用户标识

```
Given 用户已登录（authState = 'authenticated'）且在 / 页面
When 页面渲染导航栏
Then 导航区域渲染了包含用户名（userName）的认证态元素
```

### BDD-5: 匿名用户登录后正确跳转（不回归）

```
Given 用户未登录（authState = 'anonymous'）且在 / 页面
When 用户通过 LoginDialog 登录成功（authState 变为 'authenticated'）
Then 用户被导航到 /explore
```

### BDD-6: fetchMe 期间 landing 页正常渲染

```
Given 用户首次访问 / 且 fetchMe 尚未完成（authState = 'loading'）
When 页面渲染
Then landing 页 DOM 包含首屏内容（logo 元素），且当前 URL 为 /（未重定向到 /explore）
```

## 待确认清单

无待确认项。所有隐含需求方向明确。

## 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P8]
P3_skip: false
P3_retained_reason: "risk_level=medium，agate 规则要求 P3 走 TDD 红灯。TDD 覆盖：已认证全页加载重定向（BDD-1）、Sign in 显隐（BDD-2/3）、匿名登录跳转不回归（BDD-5）"
P7_skip: true
P7_skip_reason: "仅 2 个文件改动，无跨文件一致性风险；已确认与 EntryListView 认证 UI 模式一致，T067（详情页 Sign in 绑定）边界在 P2 切分"
coupling_checklist: [auth-state-binding: checked, router-guard: checked, cross-task-boundary: checked]
跳过风险: "低--2 文件改动无跨文件一致性风险；耦合点已逐项检查"
P8_retained_reason: "bugfix 需版本 bump + CHANGELOG 记录；P0 hint 未含 P8 但发布流程要求"
```

## 范围声明

```yaml
domains:
  - frontend

packages:
  - frontend-v3/src/views/LandingView.vue
  - frontend-v3/src/router.ts

risk_level: medium

risk_justification: |
  - beforeEach 守卫时序修复需确保不破坏 SPA 内导航和匿名用户流程
  - Sign in 条件渲染需与 EntryListView 的认证 UI 模式对齐
  - 登录对话框登录（匿名->认证）跳转行为不能回归

ui_affected: true
```

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要 Playwright 实跑截图验证交互行为（Sign in 显隐、跳转）
    available:
      - "playwright-cdp skill（已注入）"
      - "@vision-helper（若可调用，作为补充）"
    status: available
```

## P1_simplified: true

本任务为明确的 bug 修复（条件渲染缺失 + 守卫时序），适用小任务降级模式。实际改动行数在 P2 估算。
