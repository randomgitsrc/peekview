---
phase: P2
task_id: T065
type: design
parent: P1-requirements.md
trace_id: T065-P2-20260722
status: draft
created: 2026-07-22
agent: architect
---

# T065 登录状态 Bug - 方案设计

## 根因确认

两个独立根因：

1. **beforeEach 时序**：`app.use(router)` 触发初始路由解析时 `fetchMe` 尚未完成，`authState='loading'`，守卫不重定向。组件挂载时 `authState` 已为 `'authenticated'`，watch 无变化不触发。
2. **Sign in 无条件渲染**：`LandingView.vue:19` 的 Sign in 按钮无 `v-if` / `authState` 绑定。

时序链（main.ts）：
```
app.use(router)       → beforeEach runs, authState='loading', no redirect
authStore.fetchMe()   → initializing=false, authState→'authenticated'
app.mount('#app')     → LandingView mounts, authState already 'authenticated'
                        watch(authState) sees no change → no redirect
```

## 候选方案

### 方案 A：watch immediate + Sign in 条件渲染

**修复①**：LandingView 的 `watch(authState)` 加 `{ immediate: true }`，在 watch 注册时立即检查当前值。

```ts
// LandingView.vue
watch(authState, (state) => { if (state === 'authenticated') router.replace('/explore') }, { immediate: true })
```

**修复②**：Sign in 按钮加 `v-if`，参照 EntryListView.vue:9-12 模式。

```html
<div class="nav-cta">
  <template v-if="authState === 'anonymous'">
    <button class="btn btn-ghost btn-sm" @click="showLogin = true">Sign in</button>
  </template>
  <template v-else-if="authState === 'authenticated'">
    <div class="user-menu-wrapper">
      <button class="user-menu-trigger" @click="toggleUserMenu">
        <span class="user-avatar">{{ userInitial }}</span>
        <span class="user-name">{{ userName }}</span>
      </button>
    </div>
  </template>
  <ThemeToggle />
</div>
```

**优点**：
- 改动最小（1 行 watch 改动 + 模板条件渲染），风险低
- 不动 router.ts，不影响其他路由的守卫行为
- `immediate: true` 是 Vue 惯用模式，语义清晰
- fetchMe 完成后才 mount → immediate 触发时 authState 已确定，无闪烁

**缺点**：
- 修复只发生在组件层，守卫层仍对 `loading` 态不重定向。若未来其他组件也依赖 `beforeEach` 重定向，需重复处理
- 用户菜单逻辑在 LandingView 中重复了 EntryListView 的模式

### 方案 B：beforeEach 等待 fetchMe + Sign in 条件渲染

**修复①**：router.ts beforeEach 等待 `authStore.initializing` 变为 false 后再判断。

```ts
router.beforeEach(async (to, _from) => {
  if (to.path === '/') {
    const authStore = useAuthStore()
    if (authStore.initializing) {
      await until(authStore.initializing).toBe(false)
    }
    if (authStore.authState === 'authenticated') {
      return '/explore'
    }
  }
})
```

（`until` 来自 `@vueuse/core` 或手写 `watch` + `Promise` 实现）

**修复②**：同方案 A 的 Sign in 条件渲染。

**优点**：
- 从守卫层根治，任何已认证用户访问 `/` 都会被重定向，不依赖组件行为
- 语义更正：守卫负责路由保护，组件负责渲染

**缺点**：
- 需引入 `@vueuse/core` 或手写等待逻辑，增加依赖
- beforeEach 变异步 → 所有导航在 `initializing` 期间被阻塞，可能影响其他路由的首屏渲染速度
- 当前项目 `@vueuse/core` 未在 `package.json` 中，手写方案增加复杂度
- 守卫异步等待与 `app.use(router)` + `fetchMe` + `app.mount` 的时序交互需额外验证

### 方案 C：onMounted 检查 + Sign in 条件渲染

**修复①**：LandingView 的 `onMounted` 中主动检查 authState 并重定向。

```ts
onMounted(() => {
  injectMeta()
  if (authState.value === 'authenticated') {
    router.replace('/explore')
  }
})
```

同时保留 watch（无 immediate）处理从匿名态登录的跳转。

**修复②**：同方案 A 的 Sign in 条件渲染。

**优点**：
- 简单直接，无额外依赖
- onMounted 时 fetchMe 已完成，authState 已确定
- 与 watch 互补：onMounted 处理全页加载，watch 处理 SPA 内状态变化

**缺点**：
- onMounted + watch 两条路径做同一件事，语义略冗余
- 若 onMounted 和 watch 同时触发（理论上不会，因为 immediate=false），可能重复 replace（但 `router.replace` 重复调用无害）

## 权衡与选择

| 维度 | 方案 A (watch immediate) | 方案 B (beforeEach async) | 方案 C (onMounted) |
|------|-------------------------|--------------------------|-------------------|
| 改动量 | 小（~15行） | 中（~20行 + 依赖） | 小（~15行） |
| 根治层 | 组件层 | 守卫层 | 组件层 |
| 额外依赖 | 无 | @vueuse/core 或手写 | 无 |
| 风险 | 低 | 中（异步守卫时序） | 低 |
| 语义 | watch immediate 是 Vue 惯用 | 守卫负责重定向更正 | onMounted 直观 |
| 重复路径 | 单一路径（watch immediate 覆盖全页加载 + SPA 登录） | 单一路径（守卫统一处理） | 双路径（onMounted + watch） |

**选择：方案 A（watch immediate + Sign in 条件渲染）**

理由：
1. 改动最小、风险最低、无额外依赖
2. `watch(authState, ..., { immediate: true })` 是 Vue 标准模式，单一跳转路径覆盖全页加载和 SPA 登录两个场景
3. 当前 beforeEach 对 `loading` 态不重定向是正确的（BDD-6 要求 fetchMe 期间 landing 正常渲染），不需要修改守卫
4. 方案 B 的异步守卫引入复杂度和潜在副作用，收益不足以抵消风险
5. 方案 C 的双路径冗余不如方案 A 的单路径清晰

## Sign in 条件渲染详细设计

参照 EntryListView.vue:9-12 的认证态 UI 模式：

```html
<div class="nav-cta">
  <template v-if="authState === 'anonymous'">
    <button class="btn btn-ghost btn-sm" @click="showLogin = true">Sign in</button>
  </template>
  <template v-else-if="authState === 'authenticated'">
    <div class="user-menu-wrapper">
      <button class="user-menu-trigger" @click="toggleUserMenu">
        <span class="user-avatar">{{ userInitial }}</span>
        <span class="user-name">{{ userName }}</span>
      </button>
      <Transition name="dropdown">
        <div v-if="showUserMenu" class="user-dropdown">
          <button class="dropdown-item" @click="handleLogout">Logout</button>
        </div>
      </Transition>
    </div>
  </template>
  <ThemeToggle />
</div>
```

需新增的 script 逻辑：
- `userInitial` / `userName` computed（复用 EntryListView 的模式）
- `showUserMenu` ref + `toggleUserMenu` / `closeUserMenu` 函数
- `handleLogout` 函数
- `onMounted` / `onUnmounted` 注册/移除 click listener

需新增的 style：
- `.user-menu-wrapper` / `.user-menu-trigger` / `.user-avatar` / `.user-name` / `.user-dropdown` / `.dropdown-item` / dropdown transition

（样式从 EntryListView.vue 复制，适配 LandingView 的设计系统变量）

## BDD 覆盖映射

| BDD | 方案覆盖 |
|-----|---------|
| BDD-1: 已认证全页加载重定向 | watch immediate 触发 `router.replace('/explore')` |
| BDD-2: 匿名态 Sign in 可见 | `v-if="authState === 'anonymous'"` |
| BDD-3: 已认证态 Sign in 不可见 | `v-else-if="authState === 'authenticated'"` 替换为用户菜单 |
| BDD-4: 已认证态可见用户标识 | 用户菜单含 `userName` |
| BDD-5: 匿名登录后跳转不回归 | watch（无 immediate 时）仍覆盖 anonymous→authenticated 变化；加 immediate 不影响此路径 |
| BDD-6: fetchMe 期间正常渲染 | `authState='loading'` 时两个 template 都不渲染（v-if/v-else-if 都不匹配），只显示 ThemeToggle；landing 首屏内容正常 |

## 四字段

```yaml
packages:
  - frontend-v3/src/views/LandingView.vue
  - frontend-v3/src/router.ts

domains:
  - frontend

ui_affected: true

gate_commands:
  P5: "cd frontend-v3 && npx vitest run"
  P5_e2e: "E2E_SPEC=e2e/landing-auth.spec.ts make debug-test"
```

## files_to_read

P4 implementer 需参考的文件：

1. `frontend-v3/src/views/LandingView.vue` — 主要修改文件
2. `frontend-v3/src/views/EntryListView.vue` — 认证态 UI 模式参照（user-menu 样式 + 逻辑）
3. `frontend-v3/src/stores/auth.ts` — authState computed 定义
4. `frontend-v3/src/router.ts` — beforeEach 守卫（确认不需要修改）

## env_constraints

无新增约束。P0-brief 的环境约束仍然适用：
- debug 环境用 `make debug-restart`（127.0.0.1:8888）
- 前端改动需 `make build-frontend` 后生效

## minimal_validation

纯 Vue 响应式逻辑 + 模板条件渲染，不依赖浏览器安全模型或外部系统行为，无需最小验证。

## 风险评估

- **watch immediate + router.replace 重复调用**：全页加载时 immediate 回调和 mount 后可能的二次触发。但 `authState` 从 `'authenticated'` 不再变化，watch 不会二次触发。immediate 回调中 `router.replace('/explore')` 只执行一次。安全。
- **loading 态 UI**：`authState='loading'` 时 Sign in 和用户菜单都不渲染，只显示 ThemeToggle。这是可接受的——loading 态极短（fetchMe 通常 <100ms），且 BDD-6 要求 landing 首屏内容正常渲染即可。
- **登录后跳转回归**：watch immediate 不会破坏匿名→认证的 SPA 跳转路径。immediate 只在注册时触发一次，后续 authState 变化仍由 watch 正常捕获。
