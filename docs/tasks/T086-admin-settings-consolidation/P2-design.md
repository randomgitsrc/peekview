---
phase: P2
task_id: T086-admin-settings-consolidation
type: design
parent: P1-requirements.md
trace_id: T086-P2-20260807
status: draft
created: 2026-08-07
agent: architect
---

# P2-design — T086 admin/settings 信息架构收敛

## 0. 方案探索方法论（场景类型：设计模式，follows_existing_pattern）

任务信号：`SettingsView.vue` 已有 `?tab=` 机制（profile/security/apikeys）+ `/settings/apikeys` → `/settings?tab=apikeys` 的 redirect 先例（router.ts:22-25）。这是"设计模式需适配"场景，按方法论列 2-3 个候选模式、各写适配思路、选适配成本最低者。

探索的 3 个可能方向：

1. **完全复用现有 tab 机制**（跟随 `tabs`/`validTabs`/`activeTab` computed 模式，新增 `user-manager` 作为第 4 个 tab，仅在渲染层加 `isAdmin` 条件）——适配成本：低（现有 computed 结构只需从静态数组改成按 `isAdmin` 过滤的 computed 数组，其余逻辑不变）
2. **独立权限化路由 + 组件级 guard**（保留一个专属 `/settings/users` 子路由，用 `beforeEnter` 做组件级校验，而非纯 tab 状态)——适配成本：中高，且与 P0 已拍板的"合并进 tab、不做 redirect"决策冲突（会重新引入一个新路由，等于没有真正合并）
3. **在 SettingsView 外新建一个独立的"管理员专区"组件（不进 tab-nav，仅登录后按钮跳转显示/隐藏一个浮层）**——适配成本高，破坏"与 Profile/Security/API Keys 并列"的 BDD-4 硬性要求（tab-nav 必须可见"用户管理"选项），且引入了 settings 页面之外的新交互模式，不跟随现有约定

**选定方向 1**，理由：
- P0 已拍板"完全合并"+"tab 可见性用 isAdmin 判断"，方向 1 是唯一同时满足两点拍板决策、且不引入新路由/新交互范式的方案
- 方向 2 在语义上等于换了个 URL 保留独立入口，与"删除 /admin、不做 redirect"的拍板目标矛盾，被排除
- 方向 3 无法满足 BDD-4（tab-nav 必须显示"用户管理"选项，与其余三个 tab 并列），被排除
- `follows_existing_pattern: [frontend-v3/src/views/SettingsView.vue]`，P1 已声明单候选方案即可，此处仅需 1 个候选方案（下方"候选方案"即方向 1 的具体实现设计）

## 1. 候选方案（唯一方案，follows_existing_pattern）

### 方案一：tab computed 化 + 三处统一 isAdmin 判断 + UserMenu 动态落地 tab

**核心改动点**：把 `SettingsView.vue` 的静态 `tabs` 数组改为按 `isAdmin` 过滤的 `computed`，`validTabs`/`activeTab` getter 加入 `user-manager` 但对非 admin 强制回退 `profile`，移动端堆叠区块给 user-manager 区块显式套 `v-if="isAdmin"`。三处判断（桌面 tab-nav / 移动端堆叠 / tab 内容回退）全部读同一个 `const { isAdmin } = storeToRefs(authStore)`（来源：`frontend-v3/src/stores/auth.ts:17` 的 `isAdmin = computed(() => user.value?.isAdmin ?? false)`）。

**权衡**：
- 优点：改动集中在 `SettingsView.vue` 一个文件的渲染逻辑，`UserManagerTab.vue` 本身零权限判断代码（内容迁移即可，权限完全由宿主容器负责，符合单一职责）；`tabs` 从静态数组变 computed 是 Vue 惯用模式，无框架层面风险
- 风险：`tabs` 从静态数组变 computed 后，模板 `v-for="tab in tabs"` 仍然工作（Vue 模板自动解包 computed ref），但需要implementer 注意不能漏改 `TabName` 类型定义（否则 TS 编译期不会报出遗漏 `user-manager` 分支的问题）
- 工作量：中等，7 个文件级改动点（与 P1 范围声明一致），但每个文件改动范围明确，无交叉耦合

**选择理由**：这是 follows_existing_pattern 场景下唯一探索出的、同时满足 P0 拍板决策 + BDD-4/5/6/11/13/14 全部约束的方案，见 §0 排除方向 2/3 的理由。

## 2. 影响域分析

**改什么**：
- `router.ts`：删除 `/admin` 路由定义（L27-31）+ 死代码分支 `if (to.meta.requiresAdmin)`（L92-95），按 P1 SUGGEST 采纳一并清理
- `SettingsView.vue`：`tabs` 数组 → computed 过滤；`validTabs` 加 `user-manager`；`activeTab` getter 加 isAdmin 回退；`tab-content` 加一个 `v-else-if` 分支；`mobile-stacked` 加一个 `v-if="isAdmin"` 区块
- `UserMenu.vue`：`navigateToSettings()` 按 `isAdmin` 动态选择跳转 query（`user-manager` vs `apikeys`），新增稳定测试标识
- 新建 `UserManagerTab.vue`：从 `AdminView.vue` 迁移全部脚本逻辑（用户列表/分页/禁用启用/升级降级/重置密码/删除/自我保护），模板/样式做宿主适配（去掉整页容器 padding，改用 tab 内容惯用的 `page-title-bar` 结构）
- 删除 `AdminView.vue`
- `e2e/admin.spec.ts`：8 个 test() 迁移 URL + 选择器；BDD-14/15 语义重写为 404 断言；新增 BDD-11/12（UserMenu 入口）
- `t080-admin-route-guard.test.ts`：原地重写（不新建删旧），5 个 it 迁移为测试 `SettingsView` 的 `activeTab` 回退逻辑（不再自建 mock router）

**不改什么**：
- 后端 `/api/v1/admin/*` 全部不动（`require_admin` 依赖保留，纵深防御第二层不变）
- `AdminView.vue` 依赖的通用组件（`OverflowMenu`/`Pagination`/`ConfirmDialog`/`PasswordResetDialog`/`BaseBadge`/`EmptyState`）不改
- `ProfileTab.vue`/`SecurityTab.vue`/`ApiKeySettingsTab.vue` 三个既有 tab 组件的内部逻辑不改
- CSS 变量不做强制重命名（旧命名是新命名的完整别名层，迁移时组件样式直接沿用即可正确渲染；是否顺手换新命名是 implementer 可选的风格统一，非功能要求）

**风险在哪**：
- **权限边界不一致风险**（本任务核心风险）：若三处判断不复用同一 `isAdmin` 数据源，可能出现"tab-nav 隐藏了按钮，但 activeTab 回退逻辑忘了加判断"这类不同步 bug。缓解：本设计强制三处读同一个 `storeToRefs(authStore).isAdmin`，且 P3 需为这三处各写红灯用例
- **移动端多实例挂载放大**（已确认为现状既有模式，非本任务引入的新问题类别，但范围因本任务扩大）：`SettingsView.vue` 当前对 Profile/Security/API Keys 三个 tab 组件采用"桌面 tab-content 挂载当前 tab 一份 + 移动端 mobile-stacked 无条件挂载全部三份"的模式（`.desktop-only`/`.mobile-only` 是 CSS 媒体查询切换 `display`，不是 JS 条件渲染，两组 DOM 节点在任何视口下都同时存在于文档中）。加入 `UserManagerTab` 后，只要当前用户是 admin，无论桌面端实际停留在哪个 tab，`mobile-stacked` 区块都会常驻挂载一份 `UserManagerTab`（受 `v-if="isAdmin"` 保护，非 admin 不受影响），意味着 admin 每次打开 `/settings`（无论查看哪个 tab）都会多触发一次 `api.listUsers` 请求。这是现状模式的自然延伸而非新引入的 bug 类别，本任务不改变这一既有架构（改动仅限权限判断，不涉及性能重构），故不在本任务 BDD 范围内，此处仅记录供后续 backlog 参考
- **TS 类型遗漏风险**：`TabName` 类型和 `tabs`/`validTabs` 若有一处漏加 `user-manager`，`vue-tsc --noEmit`（CI 强制）会报错——这是好事（编译期兜底），但 implementer 需要注意四处（`tabs` computed / `validTabs` / `TabName` 类型 / `tab-content` v-else-if 分支）保持同步

## 3. 详细设计

### 3.1 `router.ts`

删除：
```ts
{
  path: '/admin',
  name: 'admin',
  component: () => import('./views/AdminView.vue'),
  meta: { requiresAdmin: true },
},
```
以及 `beforeEach` 中：
```ts
if (to.meta.requiresAdmin) {
  if (authStore.authState !== 'authenticated') return '/'
  if (!authStore.isAdmin) return '/explore'
}
```
`to.meta.requiresAdmin` 是对 vue-router 默认 `RouteMeta`（`Record<string|number|symbol, unknown>`）的 untyped 访问，项目内无类型增强声明文件，删除后不遗留悬空类型引用，`vue-tsc` 不受影响（已 grep 确认全项目仅 `router.ts` 和 `t080-admin-route-guard.test.ts` 引用 `requiresAdmin`，后者由本任务同步重写）。

删除后 `/admin` 落到 catch-all `path: '/:pathMatch(.*)*'` → `NotFoundView.vue`，天然满足 BDD-8/9/10（一律 404，不重定向）。

### 3.2 `SettingsView.vue`

```ts
import { storeToRefs } from 'pinia'
import UserManagerTab from '@/components/settings/UserManagerTab.vue'

const { isAdmin } = storeToRefs(authStore)

const validTabs = ['profile', 'security', 'apikeys', 'user-manager'] as const
type TabName = typeof validTabs[number]

const tabs = computed(() => {
  const base: { key: TabName; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'security', label: 'Security' },
    { key: 'apikeys', label: 'API Keys' },
  ]
  if (isAdmin.value) base.push({ key: 'user-manager', label: '用户管理' })
  return base
})

const activeTab = computed<TabName>({
  get: () => {
    const tab = route.query.tab as string
    if (tab === 'user-manager' && !isAdmin.value) return 'profile'
    return validTabs.includes(tab as TabName) ? (tab as TabName) : 'profile'
  },
  set: (tab: TabName) => {
    router.replace({ query: { tab } })
  },
})
```

模板：
```html
<div class="tab-content desktop-only">
  <ProfileTab v-if="activeTab === 'profile'" />
  <SecurityTab v-else-if="activeTab === 'security'" />
  <ApiKeySettingsTab v-else-if="activeTab === 'apikeys'" />
  <UserManagerTab v-else-if="activeTab === 'user-manager'" />
</div>

<div class="mobile-stacked mobile-only">
  <section class="mobile-section">
    <h2 class="mobile-section-title">Profile</h2>
    <ProfileTab />
  </section>
  <section class="mobile-section">
    <h2 class="mobile-section-title">Security</h2>
    <SecurityTab />
  </section>
  <section class="mobile-section">
    <h2 class="mobile-section-title">API Keys</h2>
    <ApiKeySettingsTab />
  </section>
  <section v-if="isAdmin" class="mobile-section">
    <h2 class="mobile-section-title">用户管理</h2>
    <UserManagerTab />
  </section>
</div>
```

三处判断显式对照：
| 判断点 | BDD | 实现 |
|---|---|---|
| 桌面 tab-nav 按钮渲染 | BDD-4/5 | `tabs` computed 过滤（非 admin 数组中不存在该项 → `v-for` 不生成按钮，DOM 中不存在，非样式隐藏） |
| 移动端堆叠区块渲染 | BDD-13/14 | `v-if="isAdmin"` 包裹整个 `<section>`（非 admin 时该 section 及子组件完全不挂载，DOM 不存在） |
| tab 内容回退 | BDD-6 | `activeTab` getter 显式判断 `tab === 'user-manager' && !isAdmin.value` 时返回 `'profile'`（非 admin 手动拼 query 也拿不到 user-manager 内容） |

三者共用同一个 `isAdmin`（来自 `storeToRefs(authStore).isAdmin`，见 §2 数据源）。

### 3.3 `UserManagerTab.vue`（新建）

从 `AdminView.vue` 原样迁移 `<script setup>` 全部逻辑（`fetchUsers`/`getMenuItems`/`doDisable`/`doEnable`/`doPromote`/`doDemote`/`doDelete`/`handlePwdConfirm`/自我保护相关状态，末尾 `fetchUsers()` 立即调用保留——tab 组件在被 `v-if`/`v-else-if` 挂载时才会执行，语义等价于原来路由跳转时挂载即拉取）。

模板调整：
- 根元素 class 从 `admin-view` 改为 `user-manager-tab`，加 `data-testid="user-manager-content"`（跟随 `ApiKeySettingsTab.vue` 的 `data-testid="apikeys-content"` 命名惯例，见 `frontend-v3/src/components/settings/ApiKeySettingsTab.vue:2`）
- 顶部标题区从 `<div class="admin-header"><h1>用户管理</h1></div>` 改为跟随 `ApiKeySettingsTab.vue` 的 `page-title-bar`/`page-title` 结构（`<div class="page-title-bar"><h1 class="page-title">用户管理</h1></div>`），与同级 tab 组件视觉风格一致
- 内部 `data-testid`（`admin-user-list`/`admin-user-row`/`pagination` 等）**保持不变**，不重命名——这些 testid 语义仍准确描述"用户列表/用户行"，且 `e2e/admin.spec.ts` 大量选择器依赖它们，保持不变可最小化 E2E 迁移 diff（迁移只改 URL 和顶层导航方式，不改内部选择器）
- 样式：直接沿用原 `AdminView.vue` 的 CSS（旧变量命名是新变量的别名层，功能等价）；`page-title-bar`/`page-title` 相关样式若与 `ApiKeySettingsTab.vue` 重复可考虑抽取，但非本任务强制要求（YAGNI，不预先重构未被要求的样式复用）

### 3.4 `UserMenu.vue`

```ts
function navigateToSettings() {
  showUserMenu.value = false
  router.push(isAdmin.value ? '/settings?tab=user-manager' : '/settings?tab=apikeys')
}
```

**关键设计约束（P1-review Advisory Note 硬性要求）**：无论入口 UI 形式如何简化，admin 点击后的落地 query 必须是 `tab=user-manager`。本方案采纳 P1 SUGGEST-3（复用现有 "Settings" 按钮，不新增平行按钮），但**不弱化落地 tab 要求**——按钮文案保持 "Settings" 不变（不新增按钮，不新增视觉入口），仅让同一个按钮的跳转目标按 `isAdmin` 分支，满足 BDD-11（admin 点击后到达 `/settings?tab=user-manager` 且显示用户管理内容）与 BDD-12（非 admin 菜单中不出现任何指向用户管理的选项——因为按钮文案、行为对非 admin 而言与现状完全一致，不新增任何"用户管理"相关文案或选项）。

新增测试标识：`<button class="dropdown-item" data-testid="user-menu-settings-item" @click="navigateToSettings">Settings</button>`（供 E2E BDD-11/12 用稳定选择器定位，而非依赖文案匹配）。

### 3.5 `e2e/admin.spec.ts`

- 全文件 `${BASE_URL}/admin` → `${BASE_URL}/settings?tab=user-manager`（先 `adminLogin()` 再 `page.goto`，与现状一致，只换 URL）
- 6 个 viewport 循环内的 test（BDD-01/02/06/12/20/21）：URL 替换后，内部选择器（`.admin-user-row`/`[data-testid="admin-user-row"]` 等）不变，因为 §3.3 设计保持了这些 testid
- BDD-14 重写：非 admin 登录后访问 `${BASE_URL}/admin` → 断言 `page.url()` 落在 404 页（可用 `NotFoundView.vue` 的稳定选择器或断言 URL 仍为 `/admin`——因为不重定向，需先确认 `NotFoundView.vue` 是否有 `data-testid`，若没有则 implementer 在 P4 阶段按需加一个，供该测试和 BDD-10 共用断言方式；这属于测试可测性的最小必要补充，不视为设计缺口）
- BDD-15 重写：未登录访问 `/admin` → 同上断言 404，不再等待 `waitForURL('**/')`
- 新增 BDD-11（UserMenu admin 入口）：admin 登录 → 打开 UserMenu → 点击 `[data-testid="user-menu-settings-item"]` → 断言落地 `/settings?tab=user-manager` 且 `[data-testid="user-manager-content"]` 可见
- 新增 BDD-12（UserMenu 非 admin 无入口）：非 admin 登录 → 打开 UserMenu → 断言不存在任何包含"用户管理"文案的菜单项（`user-menu-settings-item` 本身仍存在，因为是复用的 Settings 按钮，但断言其点击后落地 `apikeys` tab 而非 `user-manager`，或断言菜单内不存在独立的"用户管理"专属按钮——即断言"没有新增的用户管理选项"，而非断言"Settings 按钮不存在"）

### 3.6 `t080-admin-route-guard.test.ts`（原地重写，按 P1 SUGGEST 采纳）

不再自建 mock router（因为路由级 `requiresAdmin` guard 已删除，测试对象本身消失）。重写为直接测试 `SettingsView.vue` 的 `activeTab` computed 回退逻辑，通过 `@vue/test-utils` 挂载 `SettingsView`（或直接单测抽出的 computed 逻辑，若 implementer 认为挂载整个 SettingsView 成本过高，可考虑把 `activeTab`/`tabs` 的过滤逻辑抽成可独立测试的纯函数——这是 P4 实现细节，本设计不强制具体测试手段，只要求覆盖以下断言点）：
- 5 个 it 迁移映射（按 P1-review Correction Note 实际 5 个用例，非 P1-requirements 声称的 4 个）：
  - `test_bdd_14` → 已登录非 admin 访问 `?tab=user-manager` → `activeTab === 'profile'`（对应 BDD-6）
  - `test_bdd_14b` → 已登录 admin 访问 `?tab=user-manager` → `activeTab === 'user-manager'`（对应 BDD-4 的反面验证：admin 能拿到该 tab）
  - `test_bdd_15`/`test_bdd_15b`/`test_bdd_15c` → 未登录/loading 状态相关：由于 `/settings` 路由级守卫已经处理未登录场景（BDD-7，不进入 `SettingsView` 内部），这三个用例的"未登录"分支在新架构下不再需要在 `SettingsView` 内部测——**若 implementer 发现无处可迁移，应在 P4 用 `[DESIGN_GAP: t080 的 15b/15c 是 loading→resolve 时序测试，路由级迁移后是否还需要在 router.ts 层面保留，还是彻底移除]` 标注**，P7 会审查此决策

标题/`describe` 块名沿用 `BDD-14`/`BDD-15` 编号（P1 SUGGEST 要求保留可追溯性），内部 `it` 描述文案按新语义改写。

## 4. UI 测试标识清单（新增/复用）

| 标识 | 位置 | 状态 |
|---|---|---|
| `tab-user-manager` | `SettingsView.vue` tab-nav 按钮（`:data-testid="`tab-${tab.key}`"` 自动生成，无需手改） | 复用现有机制，自动派生 |
| `user-manager-content` | `UserManagerTab.vue` 根元素 | 新增 |
| `admin-user-list` / `admin-user-row` / `pagination` / `user-badge` | `UserManagerTab.vue` 内部（迁移自 `AdminView.vue`） | 保持不变 |
| `user-menu-settings-item` | `UserMenu.vue` dropdown 按钮 | 新增 |
| `settings-page` | `SettingsView.vue` 根元素（已存在） | 不变 |

## 5. 四字段声明

```yaml
packages:
  - peekview   # frontend-v3 构建产物打包进 backend/peekview/static/，随 peekview 包一起发版；本任务不涉及 mcp_server

domains:
  - frontend

ui_affected: true
# 需 E2E 覆盖的交互点：
#   - 桌面 tab-nav 按钮可见性（admin 可见"用户管理"/非 admin 不可见）
#   - 移动端堆叠区块可见性（同上，≤640px）
#   - /admin 访问结果（一律 404，不重定向）
#   - UserMenu 入口点击后的落地 tab（admin → user-manager，非 admin → apikeys）
#   - user-manager tab 内的用户管理操作（禁用/启用/升级/降级/重置密码/删除/自我保护）

gate_commands:
  P3: "cd frontend-v3 && npx vitest run src/__tests__/t080-admin-route-guard.test.ts"
  P3_formatter: "vitest.sh"
  P5: "make test-frontend"
  P5_formatter: "vitest.sh"
  P5_e2e: "E2E_SPEC=e2e/admin.spec.ts make debug-test"
  P6_typecheck: "make typecheck"
  project_module: "src/"
```

## 6. env_constraints（确认/细化 P0-brief）

```yaml
env_constraints:
  debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离，改前端后必须先 make build-frontend 或用 make debug-quick 一步到位）；单测 make test-frontend（vitest 非 watch）；typecheck: make typecheck（CI 强制）；E2E: E2E_SPEC=e2e/admin.spec.ts make debug-test（需先 make debug-start）"
  isolation_check: "P5/P6 跑 E2E 前确认 BASE_URL 指向 127.0.0.1:8888（admin.spec.ts 已有 beforeAll 硬编码拒绝 :8080/prod 的安全检查，L10-16，无需额外新增）"
  prod_isolation: "严禁触碰 :8080 与 ~/.peekview/，本任务零后端改动，理论上不涉及数据库写入，但 E2E 仍必须走 debug backend"
```

## 7. files_to_read（供 P4 implementer）

```yaml
files_to_read:
  - path: frontend-v3/src/router.ts
    why: 删除 /admin 路由定义(L27-31)和死代码分支(L92-95)，改动点明确定位
  - path: frontend-v3/src/views/SettingsView.vue
    why: 全文件改动——tabs/validTabs/activeTab/tab-content/mobile-stacked 五处联动
  - path: frontend-v3/src/views/AdminView.vue
    why: 迁移源，script 全部逻辑原样搬到 UserManagerTab.vue
  - path: frontend-v3/src/components/settings/ApiKeySettingsTab.vue:1-40
    why: 参照 page-title-bar/page-title 结构惯例 + data-testid 命名惯例（{tab}-content）
  - path: frontend-v3/src/components/UserMenu.vue
    why: navigateToSettings() 按 isAdmin 分支改造，新增 data-testid
  - path: frontend-v3/src/stores/auth.ts:17
    why: isAdmin 权威来源（computed(() => user.value?.isAdmin ?? false)），三处判断+UserMenu 均从此复用，不得各自重新实现判断逻辑
  - path: frontend-v3/e2e/admin.spec.ts
    why: 8 个既有 test() 的 URL/断言迁移基线 + 新增 BDD-11/12 的写法参照 adminLogin() helper
  - path: frontend-v3/src/__tests__/t080-admin-route-guard.test.ts
    why: 原地重写目标文件，5 个 it 的迁移映射见 §3.6
  - path: frontend-v3/src/views/NotFoundView.vue
    why: BDD-8/9/10 需要断言"落地 404 页"，检查该组件是否已有可用于断言的稳定标识，没有则按需补充（最小化新增）
```

## 8. minimal_validation

```yaml
minimal_validation:
  assumption: "纯代码逻辑，无外部系统依赖"
  method: "未做浏览器/外部系统的最小验证脚本；本任务全部改动是 Vue 组件条件渲染（v-if/v-for computed 过滤）+ vue-router 路由表删除 + Pinia store 复用，均为已在本代码库内验证过的既有框架能力（SettingsView.vue 当前已在用 v-if/v-else-if tab 切换和 computed getter/setter 模式，只是从静态数组改为按条件过滤的 computed 数组，机制不变）"
  result: "not_needed"
  note: |
    依赖的内部函数/数据转换：
    - authStore.isAdmin（frontend-v3/src/stores/auth.ts:17，Pinia computed，纯前端状态派生，无网络请求）
    - route.query.tab（vue-router 内建响应式 query 读取，SettingsView.vue 现状已在用）
    - Vue 3 v-if 条件渲染语义（官方文档明确保证：v-if 为 false 时元素及其子树不创建/挂载到 DOM，与仅用 CSS display:none 隐藏有本质区别）——BDD-5/9/10/14 对"DOM 不存在"而非"样式隐藏"的要求，直接依赖此 Vue 官方保证的框架行为，本代码库内 SettingsView.vue 当前 desktop-only/mobile-only 已经证明了 v-if/v-else-if 链式渲染在本项目 build 链路（Vite + Vue 3）下工作正常，无需额外验证
    未做验证的原因：不涉及浏览器安全模型（无 iframe/CSP/postMessage 等）、不涉及外部库的边界能力（不引入新依赖）、不涉及跨系统交互（后端零改动）——符合 architect.md 定义的"纯代码逻辑"豁免条件
```

## 9. 实现完成的标志（Definition of Done，供 P3/P5 使用）

- [ ] `router.ts` 不再含 `/admin` 路由和 `requiresAdmin` 分支；访问 `/admin`（任意角色）落到 `NotFoundView`
- [ ] `SettingsView.vue` 的 `tabs`/`validTabs`/`activeTab`/mobile-stacked 四处联动完成，`isAdmin` 均来自 `storeToRefs(authStore)`，无独立判断逻辑
- [ ] `UserManagerTab.vue` 存在，功能与原 `AdminView.vue` 完全对等（列表/分页/6 种操作/自我保护）
- [ ] `AdminView.vue` 已删除
- [ ] `UserMenu.vue` 的 Settings 入口按 `isAdmin` 动态落地 `user-manager`/`apikeys`，非 admin 无新增可见选项
- [ ] `e2e/admin.spec.ts` 8 个既有场景 + 新增 BDD-11/12，`E2E_SPEC=e2e/admin.spec.ts make debug-test` 全绿（desktop+mobile）
- [ ] `t080-admin-route-guard.test.ts` 原地重写完成，`make test-frontend` 全绿，且文件内无任何断言依赖已删除的路由级 `requiresAdmin`
- [ ] `make typecheck` 通过（`TabName`/`tabs`/`validTabs` 四处同步无遗漏）
- [ ] grep 全项目确认无遗留 `/admin` 前端跳转硬编码（排除 router.ts 已删除的定义本身和 `client.ts` 后端路径）——对应 BDD-17
