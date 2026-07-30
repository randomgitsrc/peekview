---
phase: P2
task_id: T079-interaction-consistency
type: design
parent: P1-requirements.md
trace_id: T079-P2-20260731
status: draft
created: 2026-07-31
agent: architect
---

# P2 Design — T079: 交互一致性修复

## 影响域分析

### 改什么

| 文件 | 改动 |
|------|------|
| `frontend-v3/src/components/AuthButton.vue` | **新建**。匿名态登录按钮共享组件，封装 variant 规则 |
| `frontend-v3/src/components/UserMenu.vue` | **新建**。认证态用户菜单共享组件，封装 dropdown + admin badge |
| `frontend-v3/src/views/LandingView.vue` | 替换内联 auth UI 为 AuthButton + UserMenu；移除重复的 toggleUserMenu/closeUserMenu/handleLogout/userInitial/userName |
| `frontend-v3/src/views/EntryListView.vue` | 替换内联 auth UI 为 AuthButton + UserMenu；修正 variant (ghost→secondary/ghost by breakpoint)；修正文案 (Login→Sign in)；修正菜单项 (API Keys→Settings) |
| `frontend-v3/src/components/EntryDetailHeader.vue` | 替换登录按钮为 AuthButton；添加 UserMenu（认证态）；移除 Explore 按钮；tag 改为 BaseTag |
| `frontend-v3/src/components/__tests__/AuthButton.spec.ts` | **新建**。单元测试 |
| `frontend-v3/src/components/__tests__/UserMenu.spec.ts` | **新建**。单元测试 |

### 不改什么

- `BaseButton.vue` / `BaseTag.vue` — 已有组件，直接复用，不修改
- `auth.ts` store — 接口不变，UserMenu 直接消费
- `EntryDetailView.vue` — 已正确传递 authState 和 @open-login，不需改动（EntryDetailHeader 的改动在内部）
- 后端 — 无改动
- `EntryCard.vue` / `EntryListRow.vue` — tag 已正确使用 BaseTag（T076 已修），不涉及

### 风险

1. **LandingView 认证态瞬时可见**：认证后立即 redirect 到 /explore，但 redirect 前的渲染帧需显示 UserMenu。UserMenu 组件直接读 authStore，无需额外 prop 传递，redirect 前自然渲染。
2. **EntryDetailHeader 布局回归**：移除 Explore 按钮后 actions-area 间距变化。action-sep 分隔线需检查是否多余。方案：移除 Explore 按钮及其前的 action-sep。
3. **UserMenu 在不同页面的 logout 副作用**：EntryListView 的 handleLogout 有额外逻辑（重置 archived filter、toast）。方案：UserMenu emit `logout` 事件，父组件可监听做额外处理；UserMenu 内部只调 authStore.logout()。
4. **EntryDetailHeader 的 isMobile inject**：AuthButton 需要知道 mobile/desktop 来选 variant。EntryDetailHeader 已 inject IsMobileKey，可传递给 AuthButton。

## 候选方案

### follows_existing_pattern 声明

```yaml
follows_existing_pattern:
  - frontend-v3/src/components/BaseTag.vue   # T076 已建立的可点击 tag 模式
  - frontend-v3/src/components/BaseButton.vue # 已有的 variant 按钮模式
  - frontend-v3/src/components/ThemeToggle.vue # 已有的自包含 header 子组件模式
```

理由：DESIGN.md §6 已定义全部规则，BaseButton/BaseTag 组件已存在且在 EntryCard/EntryListRow 中验证过可点击 tag 模式。AuthButton 和 UserMenu 是对现有内联代码的提取重构 + 规则对齐，不引入新设计模式。按 architect 角色规范，follows_existing_pattern 可只写 1 个候选方案。

### 方案 A（唯一候选）：共享组件提取 + 规则对齐

#### AuthButton.vue

**职责**：封装匿名态登录按钮，按 DESIGN.md §6 规则自动选择 variant。

**Props**：

```typescript
defineProps<{
  pageType: 'marketing' | 'functional'
}>()
```

**Variant 规则**（封装 DESIGN.md §6）：

| pageType | device | variant |
|----------|--------|---------|
| marketing | any | primary |
| functional | desktop (≥641px) | secondary |
| functional | mobile (≤640px) | ghost |

**设备检测**：
- LandingView 和 EntryListView 没有 inject IsMobileKey（那是 EntryDetail 专用的）。
- 方案：AuthButton 内部使用 `window.matchMedia('(max-width: 640px)')` 检测 mobile，与 DESIGN.md §9 断点一致。
- 用 `ref` + `matchMedia.addEventListener('change', ...)` 在 onMounted/onUnmounted 管理监听器。
- **为什么不 inject**：IsMobileKey 是 EntryDetail 的 provide/inject 链，LandingView 和 EntryListView 不在链中。matchMedia 是更通用的方案，三个页面统一使用。

**Template**：

```vue
<BaseButton :variant="resolvedVariant" size="small" @click="$emit('sign-in')">Sign in</BaseButton>
```

**Emits**：

```typescript
defineEmits<{
  'sign-in': []
}>()
```

**Resolved variant computed**：

```typescript
const isMobile = ref(false)
const resolvedVariant = computed(() => {
  if (props.pageType === 'marketing') return 'primary'
  return isMobile.value ? 'ghost' : 'secondary'
})
```

#### UserMenu.vue

**职责**：封装认证态用户菜单（avatar + username + admin badge + dropdown: Settings, Logout）。

**直接消费 authStore**（不自含 state 传递）：
- `useAuthStore()` → `user`, `isAdmin`, `logout()`
- `storeToRefs` → `user`, `isAdmin`

**内部 state**：
- `showUserMenu: ref(false)` — dropdown 开关
- `userInitial: computed` — user.displayName/username 首字母
- `userName: computed` — user.displayName/username

**行为**：
- `toggleUserMenu()` — 切换 dropdown
- `closeUserMenu(e: MouseEvent)` — 外部点击关闭，检查 `.user-menu-wrapper`
- `handleLogout()` — 关闭 dropdown + authStore.logout() + emit('logout')
- `navigateToSettings()` — router.push('/settings?tab=apikeys') + 关闭 dropdown

**Emits**：

```typescript
defineEmits<{
  logout: []
}>()
```

父组件可监听 `@logout` 做额外处理（EntryListView 需重置 archived filter + toast）。不监听则无副作用。

**Template 结构**（与现有内联实现一致，迁移 CSS）：

```vue
<div class="user-menu-wrapper">
  <button class="user-menu-trigger" @click="toggleUserMenu">
    <span class="user-avatar">{{ userInitial }}</span>
    <span class="user-name">{{ userName }}</span>
    <span v-if="isAdmin" class="admin-badge">admin</span>
  </button>
  <Transition name="dropdown">
    <div v-if="showUserMenu" class="user-dropdown">
      <button class="dropdown-item" @click="navigateToSettings">Settings</button>
      <button class="dropdown-item" @click="handleLogout">Logout</button>
    </div>
  </Transition>
</div>
```

**CSS**：从 EntryListView 迁移 `.user-menu-*`, `.user-dropdown`, `.dropdown-*`, `.admin-badge` 样式。LandingView 的样式略有不同（用 `var(--c-border-strong)` vs EntryListView 用 `var(--c-border-strong)` + `var(--c-surface-lower)`），取 EntryListView 版本（更完整，含 admin badge）。

#### 各页面改造

**LandingView.vue**：
- `<BaseButton variant="primary" size="small" @click="showLogin = true">Sign in</BaseButton>` → `<AuthButton page-type="marketing" @sign-in="showLogin = true" />`
- 内联 user-menu block → `<UserMenu @logout="handleLogout" />`
- 移除：showUserMenu ref, toggleUserMenu, closeUserMenu, handleLogout（改为 UserMenu emit 监听）, userInitial, userName
- 保留：showLogin ref（LoginDialog 用）
- handleLogout 简化为：可选 toast（LandingView 当前无 toast，不需监听 @logout）
- 移除 document.addEventListener('click', closeUserMenu) 在 onMounted/onUnmounted

**EntryListView.vue**：
- `<BaseButton variant="ghost" @click="showLogin = true">Login</BaseButton>` → `<AuthButton page-type="functional" @sign-in="showLogin = true" />`
- 内联 user-menu block → `<UserMenu @logout="handleLogout" />`
- 移除：showUserMenu, toggleUserMenu, closeUserMenu, userInitial, userName, navigateToApiKeys
- handleLogout 保留额外逻辑（重置 archived filter + toast），监听 UserMenu 的 @logout
- 移除 document.addEventListener('click', closeUserMenu) 在 onMounted/onUnmounted

**EntryDetailHeader.vue**：
- 移动端：`<a class="mobile-signin-link" @click="$emit('open-login')">Sign in</a>` → `<AuthButton page-type="functional" @sign-in="$emit('open-login')" />`
  - AuthButton 内部 matchMedia 检测到 mobile → variant="ghost"
  - 需要调整 CSS：mobile-sticky-header 中 AuthButton 的布局适配（当前 mobile-signin-link 是纯文本链接）
- 桌面端：`<BaseButton variant="primary" size="small" @click="$emit('open-login')">Sign in</BaseButton>` → `<AuthButton page-type="functional" @sign-in="$emit('open-login')" />`
  - AuthButton 内部 matchMedia 检测到 desktop → variant="secondary"
- 认证态：在 actions-area 添加 `<UserMenu />`（替换原 anonymous BaseButton 位置）
  - `v-if="authState === 'authenticated'"` → `<UserMenu />`
  - `v-else-if="authState === 'anonymous'"` → `<AuthButton page-type="functional" @sign-in="$emit('open-login')" />`
- 移除 Explore 按钮：删除 `<router-link to="/explore" class="icon-btn" title="Explore">...CompassIcon...</router-link>`
  - 检查前方的 action-sep：Explore 按钮前没有 action-sep（action-sep 在 OverflowMenu 后，AuthButton/Explore 在其后）。移除 Explore 后 action-sep 仍在 OverflowMenu 和 AuthButton/UserMenu 之间，布局不变。
- tag 改为 BaseTag：
  - `<span class="meta-tag">{{ tag }}</span>` → `<BaseTag :href="'/explore?tags=' + encodeURIComponent(tag)" @navigate="navigateToTag">{{ tag }}</BaseTag>`
  - meta-row 和 meta-tags-bar 两处都要改
  - 添加 `navigateToTag(href: string)` 函数：`router.push(href)`（需 import useRouter）
  - 移除 `.meta-tag` CSS（改用 BaseTag 自带样式）
  - import BaseTag

## [SCOPE+] 检查

无新发现。P1 需求基线完整覆盖所有改动点。

## 四字段声明

```yaml
packages:
  - frontend-v3
domains:
  - frontend
ui_affected: true
ui_interaction_points:
  - "Landing 匿名态：AuthButton primary variant 'Sign in'"
  - "Landing 认证态：UserMenu dropdown (Settings + Logout + admin badge)"
  - "Explore 匿名态桌面：AuthButton secondary 'Sign in'"
  - "Explore 匿名态移动：AuthButton ghost 'Sign in'"
  - "Explore 认证态：UserMenu dropdown (Settings + Logout + admin badge)"
  - "Detail 匿名态桌面：AuthButton secondary 'Sign in'"
  - "Detail 匿名态移动：AuthButton ghost 'Sign in'"
  - "Detail 认证态：UserMenu dropdown (Settings + Logout + admin badge)"
  - "Detail 桌面端：无 Explore 按钮"
  - "Detail tag 点击跳转 /explore?tags=<encoded>"
gate_commands:
  P3: "docs/tasks/T079-interaction-consistency/p3-runner.sh"
  P5: "make test-frontend"
  P5_e2e: "E2E_SPEC=e2e/auth-consistency.spec.ts make debug-test"
  P6: "cd frontend-v3 && npx vitest run --reporter=dot"
env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）；make test-frontend（vitest 非 watch）；make typecheck（vue-tsc）"
  isolation_check: "make debug-verify-isolation（验证 /tmp/peekview-debug/ 数据隔离）；前端单测 make test-frontend 不涉及后端"
```

## files_to_read

```yaml
files_to_read:
  - path: frontend-v3/src/components/BaseButton.vue
    why: AuthButton 内部使用 BaseButton，需了解 variant/size/href props 和 emits
  - path: frontend-v3/src/components/BaseTag.vue
    why: EntryDetailHeader tag 改造直接使用 BaseTag，需了解 href prop + navigate emit 模式
  - path: frontend-v3/src/components/EntryCard.vue:39-45
    why: navigateToTag + BaseTag href 用法的参照实现（T076 模式）
  - path: frontend-v3/src/stores/auth.ts
    why: UserMenu 直接消费 authStore（user, isAdmin, logout），需了解 store API
  - path: frontend-v3/src/views/LandingView.vue:7-37
    why: 替换目标——nav-cta 区域的内联 auth UI（匿名 + 认证态）
  - path: frontend-v3/src/views/LandingView.vue:193-257
    why: 移除目标——script 中的 toggleUserMenu/closeUserMenu/handleLogout/userInitial/userName + onMounted/onUnmounted 的 closeUserMenu 监听
  - path: frontend-v3/src/views/EntryListView.vue:8-29
    why: 替换目标——explore-actions 区域的内联 auth UI
  - path: frontend-v3/src/views/EntryListView.vue:378-416
    why: 移除目标——navigateToApiKeys/toggleUserMenu/closeUserMenu/handleLogout/userInitial/userName
  - path: frontend-v3/src/components/EntryDetailHeader.vue:1-71
    why: 改造目标——模板中的 auth 按钮、Explore 按钮、tag span
  - path: frontend-v3/src/components/EntryDetailHeader.vue:73-130
    why: 改造目标——script 中的 props/emits/inject，需添加 useRouter + navigateToTag
  - path: frontend-v3/src/components/ThemeToggle.vue
    why: 参照模式——自包含 header 子组件（直接读 store，不需 prop 传递 auth state）
  - path: frontend-v3/src/composables/entryDetailKeys.ts
    why: IsMobileKey 的定义（确认 inject key 名称）
```

## minimal_validation

```yaml
minimal_validation:
  assumption: "纯代码逻辑，无外部系统依赖"
  method: "不涉及浏览器安全模型/外部库核心能力/跨系统交互。改动为：1) Vue 组件提取重构（内联代码→共享组件）；2) BaseButton variant 值替换（primary→secondary/ghost）；3) BaseTag 替换 span（复用 T076 已验证模式）；4) 删除冗余 router-link。依赖的内部函数：authStore.logout()（已有）、router.push()（已有）、matchMedia (标准 Web API，DESIGN.md §9 断点 640px)。"
  result: "not_needed"
  note: "纯前端组件重构 + 规则对齐。matchMedia 是标准 API，不需要最小验证。BaseTag 可点击模式已在 EntryCard/EntryListRow (T076) 中验证可行。"
```

## 实现完成标志

1. `AuthButton.vue` 和 `UserMenu.vue` 组件存在，props/emits 符合上述设计
2. LandingView、EntryListView、EntryDetailHeader 中无内联 user-menu 代码（toggleUserMenu/closeUserMenu/userInitial/userName 全部移除）
3. EntryDetailHeader 中无 CompassIcon import 和 Explore router-link
4. EntryDetailHeader 中 tag 使用 `<BaseTag>` 而非 `<span class="meta-tag">`
5. `make test-frontend` 通过（含新增 AuthButton.spec.ts + UserMenu.spec.ts）
6. `make typecheck` 通过
7. `make build-frontend` 成功构建
