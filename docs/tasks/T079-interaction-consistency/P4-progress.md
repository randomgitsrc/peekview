## P4 implementer — 输入文件读取

### implementer.md 角色文件
- P4 实现：让 P3 红灯变绿，不改测试
- 最小实现原则，不擅自扩大范围
- DESIGN_GAP / SCOPE+ / SCOPE_GAP / CLARIFY 标注规则
- 分阶段落盘

### P4-dispatch-context
- 目标：AuthButton + UserMenu 组件 + 修改三个页面 + 移除 Explore + tag 改 BaseTag
- SCOPE_RESOLVED: Settings URL = /settings?tab=apikeys，文案 "Settings"
- 门槛：P3 红灯全绿 + 零回归 + typecheck 通过

### P0-brief
- 4 处不一致：登录按钮 variant/文案、用户菜单项、Explore 冗余、tag 不可点击
- 后端无改动

### P2-design
- AuthButton: pageType prop (marketing|functional)，matchMedia 检测 mobile
- UserMenu: 直接消费 authStore，emit logout
- LandingView: AuthButton marketing + UserMenu
- EntryListView: AuthButton functional + UserMenu @logout
- EntryDetailHeader: AuthButton functional + UserMenu + 移除 Explore + tag 改 BaseTag

### P3 测试文件读取
- AuthButton.spec.ts: 9 tests — marketing→primary, functional desktop→secondary, mobile→ghost, emits sign-in, size=small
- UserMenu.spec.ts: 15 tests — trigger render, dropdown Settings+Logout, admin badge, logout emit, settings navigate, outside click close, toggle, user initial
- T079-entry-detail-header.spec.ts: 19 tests — desktop secondary, mobile ghost, UserMenu when authenticated, no Explore, BaseTag tags, Chinese tag encoding, admin badge

## P4 implementer — 源文件读取完成

### BaseButton.vue
- variant: primary|secondary|ghost|danger
- size: default|small
- href 渲染 `<a>`，否则 `<button>`
- emit: click

### BaseTag.vue
- href prop + navigate emit
- `<a v-if="href" @click.prevent="$emit('navigate', href)">` or `<span>`

### auth.ts
- useAuthStore: user, authState, isAdmin, logout()
- storeToRefs for reactive destructuring

### ThemeToggle.vue (参照模式)
- 自包含组件，直接读 store，不需 prop 传递

### EntryCard.vue (navigateToTag 参照)
- `:href="'/explore?tags=' + encodeURIComponent(tag)"`
- `@navigate="navigateToTag"` → `router.push(href)`

### LandingView.vue
- nav-cta 区域 (lines 18-36): BaseButton primary "Sign in" + 内联 user-menu
- script (208-257): userInitial, userName, toggleUserMenu, closeUserMenu, handleLogout
- onMounted: document.addEventListener('click', closeUserMenu)
- onUnmounted: removeEventListener

### EntryListView.vue
- explore-actions (8-29): BaseButton ghost "Login" + 内联 user-menu with admin badge
- script (378-416): navigateToApiKeys, toggleUserMenu, closeUserMenu, handleLogout (重置 archived + toast)
- onMounted/onUnmounted: closeUserMenu listener
- CSS (610-692): user-menu-wrapper, trigger, avatar, name, dropdown, admin-badge, dropdown-item

### EntryDetailHeader.vue
- mobile-sticky-header (3-9): `<a class="mobile-signin-link" @click="$emit('open-login')">Sign in</a>`
- desktop actions-area (41-44): BaseButton primary "Sign in" + router-link to="/explore" Explore (CompassIcon)
- meta-row (58): `<span class="meta-tag">{{ tag }}</span>` (v-for tags)
- meta-tags-bar (69): same span.meta-tag pattern
- script: inject ZenModeKey, IsMobileKey; imports CompassIcon
- CSS: mobile-signin-link, meta-tag


## P4 implementer — 代码实现完成

### 新建文件
1. `frontend-v3/src/components/AuthButton.vue` — pageType prop, matchMedia mobile 检测, BaseButton wrapper
2. `frontend-v3/src/components/UserMenu.vue` — 直接消费 authStore, Settings + Logout dropdown, admin badge, emit logout

### 修改文件
3. `frontend-v3/src/views/LandingView.vue` — AuthButton marketing + UserMenu @logout; 移除内联 user-menu 代码和 CSS
4. `frontend-v3/src/views/EntryListView.vue` — AuthButton functional + UserMenu @logout; 移除内联 user-menu 代码和 CSS; 移除 onUnmounted import
5. `frontend-v3/src/components/EntryDetailHeader.vue` — AuthButton functional + UserMenu; 移除 Explore router-link + CompassIcon; tag 改 BaseTag + navigateToTag; 移除 mobile-signin-link + meta-tag CSS

### 实现决策
- UserMenu 的 handleLogout 先调 authStore.logout() 再 emit('logout')，父组件监听做额外处理
- EntryDetailHeader 不传 @logout 给 UserMenu（无额外 logout 逻辑需要）
- AuthButton 用 matchMedia 检测 mobile（不依赖 inject IsMobileKey，因为 LandingView/EntryListView 不在 provide 链中）


## P4 implementer — 自查结果

### 自查命令
```
npx vitest run src/components/__tests__/AuthButton.spec.ts src/components/__tests__/UserMenu.spec.ts src/components/__tests__/T079-entry-detail-header.spec.ts
make typecheck
npx vitest run --reporter=dot  (全量回归)
```

### typecheck: PASS

### 新增测试结果
- AuthButton.spec.ts: 9/9 PASS ✓
- UserMenu.spec.ts: 0/16 PASS (16 FAIL) ✗ — vi.mock hoisting bug
- T079-entry-detail-header.spec.ts: 17/22 PASS (5 FAIL) ✗

### T079 失败分类
1. BDD-05 desktop secondary: `header.find('button')` 返回 copy 按钮而非 AuthButton（copy 按钮在 DOM 中先于 AuthButton）
2. BDD-06 mobile ghost: 已修复（mobile-override prop）→ PASS
3. BDD-09/10 `:has-text()`: jsdom 不支持 `:has-text()` 伪类，测试选择器无效
4. Admin badge: `vi.doMock` 不会更新已导入模块的缓存

### UserMenu.spec.ts 全部失败原因
- `vi.mock('@/stores/auth', factory)` 在 `mountUserMenu` 函数内部调用
- vitest 1.6.1 将所有 vi.mock 调用提升到文件顶部（hoisting）
- 提升后 factory 闭包引用 `authStoreMock`（函数参数），在文件加载时为 undefined
- 无法在组件代码中修复此问题

### 全量回归结果
- 1094 passed | 31 failed | 1 skipped (原基线 1078 passed + 1 skipped)
- 31 failed = 16 UserMenu + 4 T079 + 11 t067回归

### t067 回归分析（11 failures）
- BDD-1/2/3: 检查 `.actions-area .btn-primary` — P2 设计要求 desktop variant 从 primary 改为 secondary
- BDD-1/2: 检查 `.mobile-signin-link` — P2 设计要求移除 mobile-signin-link，改用 AuthButton
- BDD-6: 检查 Explore 导航链接 — P2 设计要求移除 Explore 按钮
- BDD-11/12: 检查 `.btn-primary` 和 `.mobile-signin-link` — 同上

### DESIGN_GAP 声明

[DESIGN_GAP: P2 设计要求 AuthButton desktop variant 改为 secondary，但 t067 测试检查 `.actions-area .btn-primary`。测试断言与 P1 BDD-05 矛盾。t067 测试需更新为检查 `.btn-secondary`。]

[DESIGN_GAP: P2 设计要求移除 `.mobile-signin-link`，改用 AuthButton 组件，但 t067 测试检查 `.mobile-signin-link` 存在性。测试断言与 P1 BDD-06 矛盾。t067 测试需更新为检查 AuthButton。]

[DESIGN_GAP: P2 设计要求移除 Explore 按钮，但 t067 BDD-6 测试检查 Explore 导航链接存在。测试断言与 P1 BDD-13 矛盾。t067 测试需更新或删除。]

[DESIGN_GAP: UserMenu.spec.ts 在函数内部使用 vi.mock('@/stores/auth', factory)，vitest 1.6.1 将 vi.mock 提升到文件顶部，导致 factory 闭包引用的 authStoreMock（函数参数）为 undefined。需改用 vi.hoisted 模式。]

[DESIGN_GAP: EntryDetailHeader admin badge 测试使用 vi.doMock 重新 mock auth store，但 vi.doMock 不会更新已导入模块的缓存。UserMenu 在文件加载时已导入 @/stores/auth（使用初始 mock），vi.doMock 不影响已缓存模块。]

[DESIGN_GAP: T079 BDD-05 测试使用 `header.find('button')` 查找 AuthButton，但 .detail-header 中 copy 按钮在 AuthButton 之前渲染。测试应使用 `.btn-secondary` 或 `.base-button` 选择器而非 `button`。]

[DESIGN_GAP: T079 BDD-09/10 测试使用 `button:has-text("Sign in")` 选择器，这是 Playwright 特有语法，jsdom 不支持。应改用 @vue/test-utils 的 text-based 查找或 CSS 选择器。]


## P4 implementer — 实现完成

### 产出文件
1. /home/kity/oclab/peekview/docs/tasks/T079-interaction-consistency/P4-implementation.md
2. frontend-v3/src/components/AuthButton.vue (新建)
3. frontend-v3/src/components/UserMenu.vue (新建)
4. frontend-v3/src/views/LandingView.vue (修改)
5. frontend-v3/src/views/EntryListView.vue (修改)
6. frontend-v3/src/components/EntryDetailHeader.vue (修改)

### 实现状态
- typecheck: PASS ✓
- AuthButton.spec.ts: 9/9 PASS ✓
- UserMenu.spec.ts: 0/16 PASS (vi.mock hoisting bug) ✗
- T079-entry-detail-header.spec.ts: 17/22 PASS (5 DESIGN_GAP) ✗
- t067 回归: 10 failures (P2 设计变更导致的预期回归)

### 关键偏离
- AuthButton 添加了 mobileOverride prop (P2 未指定)，用于 EntryDetailHeader 传入 isMobile 值
- 使用 string 类型而非 boolean 避免 Vue boolean casting 问题

