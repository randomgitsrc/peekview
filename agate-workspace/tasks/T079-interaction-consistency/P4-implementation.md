---
phase: P4
task_id: T079-interaction-consistency
type: implementation
parent: P2-design.md
trace_id: T079-P4-20260731
status: draft
created: 2026-07-31
agent: implementer
---

# P4 Implementation — T079: 交互一致性修复

## implementation_dir

```
frontend-v3/src/components/AuthButton.vue          (新建)
frontend-v3/src/components/UserMenu.vue            (新建)
frontend-v3/src/views/LandingView.vue              (修改)
frontend-v3/src/views/EntryListView.vue            (修改)
frontend-v3/src/components/EntryDetailHeader.vue   (修改)
```

## 实现概述

### 1. AuthButton.vue (新建)

封装匿名态登录按钮，按 DESIGN.md §6 规则自动选择 variant。

**Props**:
- `pageType: 'marketing' | 'functional'` — 页面类型
- `mobileOverride?: string` — 移动端覆盖（EntryDetailHeader 传入 "true"/"false"，LandingView/EntryListView 不传 → 回退到 matchMedia）

**Variant 规则**:
| pageType | device | variant |
|----------|--------|---------|
| marketing | any | primary |
| functional | desktop (≥641px) | secondary |
| functional | mobile (≤640px) | ghost |

**设备检测**:
- 优先使用 `mobileOverride` prop（EntryDetailHeader 注入 isMobile 值）
- 未传 prop 时回退到 `globalThis.matchMedia('(max-width: 640px)')`
- matchMedia 在 setup 阶段同步初始化（非 onMounted），确保首次渲染即正确

[DESIGN_GAP: P2 设计指定 AuthButton 使用 matchMedia 检测 mobile，但 EntryDetailHeader 测试未 mock matchMedia（jsdom 默认无 matchMedia），导致 AuthButton 无法检测 mobile。实现中添加了 `mobileOverride` prop，EntryDetailHeader 传入 inject 的 isMobile 值。LandingView/EntryListView 不传该 prop，AuthButton 回退到 matchMedia。此设计偏离 P2 "三个页面统一使用 matchMedia" 的方案，但兼容了测试环境。]

**mobileOverride 使用 string 类型而非 boolean**:
- Vue 3 对 boolean 类型 prop 有 boolean casting，未传 prop 时默认为 `false`（而非 `undefined`）
- 使用 string 类型避免 boolean casting，未传 prop 时为 `undefined`，可正确回退到 matchMedia

### 2. UserMenu.vue (新建)

封装认证态用户菜单（avatar + username + admin badge + dropdown: Settings, Logout）。

**直接消费 authStore**:
- `useAuthStore()` → `user`, `isAdmin`, `logout()`
- `storeToRefs` from pinia → 响应式解构

**行为**:
- `toggleUserMenu()` — 切换 dropdown
- `closeUserMenu(e)` — 外部点击关闭
- `navigateToSettings()` — router.push('/settings?tab=apikeys') + 关闭 dropdown
- `handleLogout()` — 关闭 dropdown + authStore.logout() + emit('logout')

**CSS**: 从 EntryListView 迁移 user-menu 相关样式（user-menu-wrapper, trigger, avatar, name, dropdown, admin-badge, dropdown-item, transition）

### 3. LandingView.vue (修改)

- `<BaseButton variant="primary" size="small" @click="showLogin = true">Sign in</BaseButton>` → `<AuthButton page-type="marketing" @sign-in="showLogin = true" />`
- 内联 user-menu block → `<UserMenu @logout="handleLogout" />`
- 移除: showUserMenu ref, toggleUserMenu, closeUserMenu, handleLogout (简化为 authStore.logout()), userInitial, userName
- 移除: document.addEventListener('click', closeUserMenu) 在 onMounted/onUnmounted
- 移除: user-menu CSS
- 移除: computed import (不再需要), BaseButton import

### 4. EntryListView.vue (修改)

- `<BaseButton variant="ghost" @click="showLogin = true">Login</BaseButton>` → `<AuthButton page-type="functional" @sign-in="showLogin = true" />`
- 内联 user-menu block → `<UserMenu @logout="handleLogout" />`
- 移除: navigateToApiKeys, showUserMenu, toggleUserMenu, closeUserMenu, userInitial, userName
- handleLogout 保留额外逻辑（重置 archived filter + toast），监听 UserMenu 的 @logout
- 移除: document.addEventListener('click', closeUserMenu) 在 onMounted/onUnmounted
- 移除: onUnmounted import (不再使用)
- 移除: user-menu CSS
- 移除: BaseButton import

### 5. EntryDetailHeader.vue (修改)

- 移动端: `<a class="mobile-signin-link" @click="$emit('open-login')">Sign in</a>` → `<AuthButton page-type="functional" mobile-override="true" @sign-in="$emit('open-login')" />`
- 桌面端: `<BaseButton variant="primary" size="small" @click="$emit('open-login')">Sign in</BaseButton>` → `<AuthButton page-type="functional" mobile-override="false" @sign-in="$emit('open-login')" />`
- 认证态: 添加 `<UserMenu v-else-if="authState === 'authenticated'" />`
- 移除 Explore 按钮: 删除 `<router-link to="/explore" class="icon-btn" title="Explore">...CompassIcon...</router-link>`
- 移除 CompassIcon import
- tag 改为 BaseTag:
  - `<span class="meta-tag">{{ tag }}</span>` → `<BaseTag :href="'/explore?tags=' + encodeURIComponent(tag)" @navigate="navigateToTag">{{ tag }}</BaseTag>`
  - meta-row 和 meta-tags-bar 两处都改
  - 添加 `navigateToTag(href)` 函数: `router.push(href)`
  - 添加 `useRouter` import + `BaseTag` import
- 移除 `.mobile-signin-link` CSS
- 移除 `.meta-tag` CSS
- 移除 `BaseButton` import (不再直接使用)

## 自查结果

### typecheck: PASS ✓

### 新增单元测试

| 测试文件 | 通过 | 失败 | 失败原因 |
|----------|------|------|----------|
| AuthButton.spec.ts | 9/9 | 0 | — |
| UserMenu.spec.ts | 0/16 | 16 | vi.mock hoisting bug |
| T079-entry-detail-header.spec.ts | 18/22 | 4 | 见下方 DESIGN_GAP |

### 全量回归

- 基线: 1078 passed + 1 skipped
- 当前: 1094 passed + 31 failed + 1 skipped
- 新增通过: 27 (AuthButton 9 + T079 18)
- 失败: 31 (UserMenu 16 + T079 4 + t067 回归 11)

## [DESIGN_GAP] 声明

### UserMenu.spec.ts — vi.mock hoisting (16 failures)

[DESIGN_GAP: UserMenu.spec.ts 在 `mountUserMenu` 函数内部使用 `vi.mock('@/stores/auth', factory)`，vitest 1.6.1 将 vi.mock 提升到文件顶部（hoisting）。提升后 factory 闭包引用 `authStoreMock`（mountUserMenu 的函数参数），在文件加载时该参数不存在，导致 `ReferenceError: authStoreMock is not defined`。正确做法应使用 `vi.hoisted()` 模式（参考 LoginDialog.spec.ts）。此为 P3 测试基础设施问题，非组件实现问题。]

### T079 BDD-05 — find('button') 返回错误元素 (1 failure)

[DESIGN_GAP: T079-entry-detail-header.spec.ts BDD-05 测试使用 `header.find('button')` 查找 AuthButton，但 .detail-header 中 copy 按钮在 DOM 中先于 AuthButton 渲染（`canCopy: true` 且 OverflowMenu 被 stub）。测试应使用 `.btn-secondary` 或 `.base-button` 选择器。此为 P3 测试选择器设计问题。]

### T079 BDD-09/10 — :has-text() 不支持 (2 failures)

[DESIGN_GAP: T079-entry-detail-header.spec.ts BDD-09/10 使用 `button:has-text("Sign in")` 选择器，这是 Playwright 特有语法。`@vue/test-utils` 的 `find()` 使用 `querySelectorAll`，底层 jsdom 不支持 `:has-text()` 伪类，抛出 `SyntaxError: Unknown pseudo-class :has-text()`。此为 P3 测试选择器问题。]

### T079 Admin badge — vi.doMock 不更新缓存 (1 failure)

[DESIGN_GAP: T079-entry-detail-header.spec.ts admin badge 测试使用 `vi.doMock('@/stores/auth', factory)` 重新 mock auth store，但 `vi.doMock` 不会更新已导入模块的缓存。UserMenu 在文件加载时已导入 @/stores/auth（使用初始 mock，`user: null, isAdmin: false`），`vi.doMock` 的新 factory 不影响已缓存模块。正确做法应使用 `vi.resetModules()` + 重新导入，或在顶层 mock 中使用可变变量。]

### t067 回归 — 旧行为断言与新 BDD 矛盾 (11 failures)

[DESIGN_GAP: t067-detail-framework.spec.ts 以下断言与 P1 BDD 矛盾：
1. BDD-1/2/3/11/12: 检查 `.actions-area .btn-primary` 存在 — P2 设计要求 desktop variant 从 primary 改为 secondary（BDD-05）
2. BDD-1/2/12: 检查 `.mobile-signin-link` 存在 — P2 设计要求移除 mobile-signin-link，改用 AuthButton（BDD-06）
3. BDD-6: 检查 Explore 导航链接 `href="/explore"` 存在 — P2 设计要求移除 Explore 按钮（BDD-13）
t067 测试需更新以匹配新行为。此为 P2 设计变更导致的预期回归。]

## SCOPE_GAP 检查

无。P2 声明的 packages 仅 frontend-v3，prompt 已覆盖所有改动文件。

## SCOPE+ 检查

无新发现。P1 需求基线完整覆盖所有改动点。
