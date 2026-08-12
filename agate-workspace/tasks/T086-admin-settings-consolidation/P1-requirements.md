---
phase: P1
task_id: T086-admin-settings-consolidation
type: requirements
parent: P0-brief.md
trace_id: T086-P1-20260807
status: draft
created: 2026-08-07
agent: analyst
---

# P1-requirements — T086 admin/settings 信息架构收敛

## 1. 需求复述

将当前独立的 `/admin`（`AdminView.vue`，仅管理员可访问、无 UI 入口、需手敲 URL）用户管理功能，完全迁移为 `/settings`（`SettingsView.vue`，已有 `?tab=` 机制）的第 4 个 tab（`?tab=user-manager`）：

1. 新建 `UserManagerTab.vue`，承载原 `AdminView.vue` 的全部功能（用户列表分页、禁用/启用、升级/降级管理员、重置密码、删除，及自我保护逻辑）
2. 删除 `/admin` 路由定义和 `AdminView.vue`；不做 redirect，旧书签直接落到 404（catch-all `NotFoundView`）
3. tab 可见性用 `isAdmin` 在 tab 级判断（非路由级）：admin 显示且可访问 user-manager tab；非 admin 即使手动拼 `?tab=user-manager` 也在 `SettingsView` 内部回退到 profile tab
4. `UserMenu.vue` 为 admin 角色新增可见入口，使 admin 不再需要手敲 URL 才能到达用户管理
5. 后端零改动，`/api/v1/admin/*` 全部保留

## 2. 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---|---|
| 1 | 移动端堆叠布局需要对 user-manager 区块加 `isAdmin` 条件渲染 | `SettingsView.vue` 的移动端视图（`.mobile-only`，≤640px）当前对 profile/security/apikeys 三个 tab 内容**无条件全部堆叠展示**（不经过 `activeTab` 单选逻辑）。若原样照搬这个模式加入 user-manager 区块而不加显式 `v-if="isAdmin"`，会导致移动端上所有登录用户（含非 admin）都能看到用户管理界面和数据——这是一个真实的权限边界漏洞，不是锦上添花 |
| 2 | 桌面端 tab-nav 需要对 user-manager 按钮加 `isAdmin` 条件渲染 | `tabs` 数组当前用 `v-for` 无条件渲染所有 tab 按钮；user-manager 按钮不能对非 admin 用户可见（否则暴露功能存在性，即使点击后被拦截也是信息泄露） |
| 3 | `SettingsView.vue` 的 `activeTab` computed 需要加 `isAdmin` 判断，不能只判断 `validTabs.includes(tab)` | 当前逻辑：只要 tab 名在 `validTabs` 里就直接采用。若把 `user-manager` 加入 `validTabs` 而不加权限判断，非 admin 手动访问 `?tab=user-manager` 会直接看到该 tab 内容，与 P0 已拍板的"回退 profile"矛盾 |
| 4 | `router.ts` 中 `router.beforeEach` 的 `to.meta.requiresAdmin` 判断分支，在 `/admin` 路由删除后成为死代码（不再有任何路由声明该 meta） | 不清理不会导致功能错误，但是死代码；是否清理留给 P2/P4 判断，P1 仅记录发现 |
| 5 | `src/__tests__/t080-admin-route-guard.test.ts`（vitest 单测）需要迁移或删除 | 该文件**不在 dispatch-context 的输入文件清单中**，但 grep 全项目确认它自建 mock router 专门测试 `/admin` 路由级 `requiresAdmin` guard（`BDD-14`/`BDD-15` 语义，4 个 `it`）。它是自包含的（自己定义路由表，不依赖真实 `router.ts`），因此路由删除后此文件仍会"通过"——但通过的是对已删除功能的验证，是误导性的测试债务，必须随本任务一并迁移为测试 tab 级 `isAdmin` 守卫逻辑，否则测试套件里会留下一个验证虚假前提的僵尸测试 |
| 6 | `e2e/admin.spec.ts` 需要整体迁移，且部分用例语义要变，不是单纯换 URL | 该文件实际含 8 个 `test()`（`BDD-01/02/06/12/14/15/20/21`，其中 6 个跑 desktop+mobile 两个 viewport），非 P0-brief 声称的 27 个（已核实用实际数字）。其中 `BDD-14`（非 admin 重定向到 `/explore`）和 `BDD-15`（未登录重定向到 `/`）测的是路由级守卫的**重定向**行为——`/admin` 删除后这两个场景的正确行为变成**一律 404**，不再有"重定向到 `/explore` 或 `/`"的区分，属于语义重写而非字符串替换 |
| 7 | UserMenu 入口的可发现性 | `UserMenu.vue` 当前 dropdown 只有 "Settings"（跳 `/settings?tab=apikeys`）和 "Logout" 两项；admin 角色只在触发按钮上显示一个静态徽章文字，没有任何可点击的管理入口。P0 已拍板"加显式入口"，但具体形式（新增按钮 vs 依赖 tab-nav 内可见）是实现细节，留给 P2 |
| 8 | `/settings` 路由本身的既有 guard（`to.path === '/settings'` 时要求 `authenticated`，否则重定向 `/`）已经覆盖了未登录用户访问 `?tab=user-manager` 的情况 | 未登录用户根本到不了 `SettingsView` 组件内部，会在路由级被拦截重定向到 `/`——这不是本任务需要新增的逻辑，是复用现状；需要在 BDD 里明确这一点，避免和"tab 级回退 profile"（仅针对已登录非 admin）混淆 |
| 9 | 无其他前端文件硬编码 `/admin` 路径跳转 | 已用 grep 核查全 `frontend-v3/src`：除 `router.ts` 路由定义本身和上述两个测试文件外，`src/api/client.ts` 中的 `/admin/users` 等是后端 API 路径（与前端路由无关，属预期不受影响），没有遗漏的其他前端跳转硬编码 |
| 10 | CSS 变量兼容性——已排查，非隐患 | `AdminView.vue` 用 `--text-primary`/`--bg-secondary`/`--border-color`/`--accent-color` 等旧命名，`SettingsView.vue` 用 `--c-text`/`--c-surface`/`--c-border`/`--c-accent` 新命名。核查 `variables.css` 第 65-98/129-162 行确认旧命名是完整定义的别名层（如 `--text-primary: var(--c-text)`），两套变量等价，迁移时组件样式可直接沿用，不构成视觉风险 |
| 11 | AdminView 依赖的通用组件不变 | `OverflowMenu`/`Pagination`/`ConfirmDialog`/`PasswordResetDialog`/`BaseBadge`/`EmptyState` 均是独立通用组件，迁移只改宿主容器，这些组件本身不需要改动 |

## 3. BDD 验收条件

### 功能对等：user-manager tab 内容与操作

#### BDD-1: admin 在 user-manager tab 看到完整用户列表
- Given 已登录的 admin 用户访问 `/settings?tab=user-manager`
- When 页面加载完成
- Then 页面显示分页的用户列表（每页用户数与原 `/admin` 页面一致），列表包含每个用户的用户名和状态徽章（admin/disabled）

#### BDD-2: admin 可在 user-manager tab 执行用户管理操作
- Given 已登录的 admin 用户在 `/settings?tab=user-manager`，列表中存在一个非自己的目标用户
- When admin 依次执行禁用、启用、升级管理员、降级、重置密码、删除中的任一操作并确认
- Then 对应操作成功执行（列表刷新反映新状态，或目标用户从列表消失），且行为与原 `/admin` 页面完全一致

#### BDD-3: admin 不能对自己执行破坏性操作
- Given 已登录的 admin 用户在 `/settings?tab=user-manager` 的列表中看到自己
- When admin 尝试对自己执行禁用、降级或删除操作
- Then 操作被拒绝，界面提示不能对自己执行该操作（自我保护逻辑与原 `/admin` 页面一致）

### 权限边界：tab 可见性与访问控制

#### BDD-4: admin 已登录访问 settings，tab 导航显示用户管理选项
- Given 已登录的 admin 用户访问 `/settings`
- When 页面加载完成
- Then 桌面端 tab 导航栏中可见"用户管理"选项，与 Profile/Security/API Keys 并列

#### BDD-5: 非 admin 已登录访问 settings，tab 导航不显示用户管理选项
- Given 已登录的非 admin 用户访问 `/settings`
- When 页面加载完成
- Then 桌面端 tab 导航栏中不出现"用户管理"选项（DOM 中不存在对应按钮，而非仅样式隐藏）

#### BDD-6: 非 admin 手动访问 user-manager tab 被回退到 profile
- Given 已登录的非 admin 用户
- When 该用户直接访问 `/settings?tab=user-manager`
- Then 页面显示 profile tab 的内容，不渲染任何用户管理相关数据或界面

#### BDD-7: 未登录访问 user-manager tab 沿用既有 settings 守卫
- Given 未登录用户
- When 访问 `/settings?tab=user-manager`
- Then 被重定向到 `/`（复用 `/settings` 现有的未登录守卫，不进入 SettingsView 内部）

### 路由删除：/admin 一律 404

#### BDD-8: admin 访问 /admin 返回 404
- Given 已登录的 admin 用户
- When 访问 `/admin`
- Then 页面显示 404（NotFound 页面），不渲染任何用户管理内容，URL 不被重定向

#### BDD-9: 非 admin 已登录访问 /admin 返回 404
- Given 已登录的非 admin 用户
- When 访问 `/admin`
- Then 页面显示 404，不发生到 `/explore` 的重定向（与旧行为不同，新行为一律 404）

#### BDD-10: 未登录访问 /admin 返回 404
- Given 未登录用户
- When 访问 `/admin`
- Then 页面显示 404，不发生到 `/` 的重定向（与旧行为不同，新行为一律 404）

### 入口发现

#### BDD-11: admin 可从 UserMenu 到达用户管理，无需手敲 URL
- Given 已登录的 admin 用户
- When 打开 UserMenu 下拉菜单
- Then 菜单中存在一个可点击项，点击后到达 `/settings?tab=user-manager` 且显示用户管理内容

#### BDD-12: 非 admin 的 UserMenu 不出现用户管理入口
- Given 已登录的非 admin 用户
- When 打开 UserMenu 下拉菜单
- Then 菜单中不出现任何指向用户管理的选项

### 移动端呈现

#### BDD-13: admin 在移动端可见用户管理区块
- Given 已登录的 admin 用户，视口宽度 ≤640px
- When 访问 `/settings`
- Then 堆叠布局中包含用户管理区块，且区块内容与桌面端 user-manager tab 一致

#### BDD-14: 非 admin 在移动端不出现用户管理区块
- Given 已登录的非 admin 用户，视口宽度 ≤640px
- When 访问 `/settings`
- Then 堆叠布局的 DOM 中不存在用户管理区块（不是折叠隐藏，是不渲染）

### 测试资产迁移

#### BDD-15: e2e/admin.spec.ts 全部既有场景在新路径下通过
- Given `e2e/admin.spec.ts` 中的 8 个既有测试场景（`BDD-01`/`02`/`06`/`12`/`20`/`21` 及重写后的 `14`/`15`）
- When 迁移为访问 `/settings?tab=user-manager`（而非 `/admin`）并调整 `BDD-14`/`BDD-15` 的断言为"404"而非"重定向"
- Then `make debug-test` 下全部通过（desktop + mobile 两个 viewport）

#### BDD-16: t080-admin-route-guard.test.ts 迁移为测试 tab 级守卫
- Given `src/__tests__/t080-admin-route-guard.test.ts` 当前测试的是已删除的路由级 `requiresAdmin` guard
- When 迁移为测试 `SettingsView` 内 `isAdmin` 判断下 `activeTab` 对 `user-manager` 的回退逻辑（对应 BDD-5/6）
- Then `make test-frontend` 下相关用例通过，且不再存在任何测试断言依赖已删除的 `/admin` 路由级守卫

### 遗留引用回归检查

#### BDD-17: 无遗留的前端 /admin 跳转引用
- Given 全项目 `frontend-v3/src` 代码
- When 排除 `router.ts` 自身的路由定义（本任务会删除）和 `src/api/client.ts` 的后端 API 路径（`/admin/users` 等，不受影响）
- Then 不存在其他文件中硬编码跳转到前端路由 `/admin` 的代码

## 4. 待确认清单

[NO_NEED_CONFIRM]

以下三点为技术性倾向项，不涉及业务方向判断，主 Agent 可直接采纳：

- `[SUGGEST: router.ts 中 to.meta.requiresAdmin 分支在 /admin 路由删除后成为死代码，建议 P4 一并清理（连同 meta.requiresAdmin 类型声明），理由：不引入额外风险，是同一次改动的自然收尾]`
- `[SUGGEST: src/__tests__/t080-admin-route-guard.test.ts 建议保留文件路径但重写内容为测试 tab 级守卫（而非新建独立文件后删除旧文件），理由：保留 BDD-14/15 编号的可追溯性，避免测试历史丢失]`
- `[SUGGEST: UserMenu.vue 的 admin 入口建议直接复用现有 "Settings" 跳转项（跳到 /settings 后 tab-nav 里天然可见 user-manager），而非新增一个平行的 "用户管理" 按钮，理由：跟随现有模式（P0 already declared follows_existing_pattern），减少入口数量，避免用户困惑于两个不同入口都能到设置页]`

## 5. 裁剪说明

不裁剪任何阶段。全部走 P0-P8：

- P0：已完成
- P1：本文件，不裁剪（核心阶段）
- P2：**不裁剪阶段本身**，但采纳 dispatch-context 的简化倾向——`follows_existing_pattern`（settings 已有 tab 机制 + redirect 先例），单候选方案即可，无需多方案对比
- P3：保留，需要红灯——tab 守卫逻辑（BDD-5/6）+ isAdmin 可见性（BDD-4/5/12/13/14）是本任务的核心风险点，medium risk 强制 TDD
- P4：正常实现
- P5：保留，全量测试套件（含迁移后的 t080-admin-route-guard.test.ts 和 admin.spec.ts）
- P6：**不裁剪**——UI 改动必须 Playwright 实跑 + 截图验证（BDD-4/5/6/8/9/10/13/14 均涉及可见性判断，无法靠代码审查确认）
- P7：保留——多文件改动（router.ts / SettingsView.vue / UserMenu.vue / 新建 UserManagerTab.vue / 删除 AdminView.vue / admin.spec.ts / t080-admin-route-guard.test.ts，共 7 个文件级改动点）
- P8：正常发布准备

```yaml
phases: [P0, P1, P2, P3, P4, P5, P6, P7, P8]
```

[BASELINE_CHANGE: 补充 check-gate.sh P2 解析所需的机器可读字段，不改变第 157 行已声明的裁剪意图]

```yaml
follows_existing_pattern: [frontend-v3/src/views/SettingsView.vue]
```

## 6. 范围声明

```yaml
domains:
  - frontend
  # backend: 不受影响，/api/v1/admin/* 全部保留原样，本任务不引入任何后端改动项

packages:
  - frontend-v3/src/router.ts                              # 删除 /admin 路由定义 + 死代码清理
  - frontend-v3/src/views/SettingsView.vue                 # tabs 数组、validTabs、activeTab 守卫、移动端堆叠区块
  - frontend-v3/src/views/AdminView.vue                     # 删除（内容迁出）
  - frontend-v3/src/components/settings/UserManagerTab.vue  # 新建（从 AdminView.vue 迁移）
  - frontend-v3/src/components/UserMenu.vue                 # 新增 admin 入口
  - frontend-v3/e2e/admin.spec.ts                            # 迁移 8 个测试场景到新路径
  - frontend-v3/src/__tests__/t080-admin-route-guard.test.ts # 迁移为 tab 级守卫测试

risk_level: medium
# 理由：涉及路由守卫从路由级迁移到组件级（权限边界不能漏），跨 7 个文件改动，
# 有 E2E + 单测双重测试资产需要语义级迁移（非字符串替换），但不触碰后端/数据库/schema
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: |
      P6 验收需要 Playwright 截图验证多个纯视觉/DOM 可见性判定的 BDD
      （BDD-4/5/12：tab-nav 按钮是否渲染；BDD-13/14：移动端堆叠区块是否渲染；
      BDD-8/9/10：/admin 访问后落地页面是否为 404 页面），
      这类"元素是否存在于视觉呈现中"的判定用代码断言可以做（DOM 查询），
      但设计一致性和跨 viewport 呈现需要人工/vision 辅助确认
    available:
      - "vision-engine skill（已注入，用于截图分析）"
      - "playwright-cdp skill（已注入，Chrome CDP :18800，AGENTS.md 已文档化标准流程）"
    status: available

  - need: e2e-test-runner
    why: BDD-15 需要在 debug backend（:8888）下实跑 make debug-test 验证迁移后的 E2E 用例
    available:
      - "make debug-test（Makefile target，已文档化于 AGENTS.md）"
    status: available

  - need: frontend-unit-test-runner
    why: BDD-16 需要 make test-frontend（vitest 非 watch 模式）验证迁移后的单测
    available:
      - "make test-frontend（Makefile target）"
    status: available
```

无 `status: GAP` 项，不阻塞推进。
