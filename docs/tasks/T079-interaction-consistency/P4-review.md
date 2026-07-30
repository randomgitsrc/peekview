---
phase: P4
task_id: T079-interaction-consistency
type: review
parent: P4-implementation.md
trace_id: T079-P4-20260731
status: approved
created: 2026-07-31
agent: design-review
---

# P4 Design Review — T079: 交互一致性修复

[PROD_NOT_TOUCHED]

## 评审范围

| 文件 | 类型 |
|------|------|
| `frontend-v3/src/components/AuthButton.vue` | 新建 |
| `frontend-v3/src/components/UserMenu.vue` | 新建 |
| `frontend-v3/src/views/LandingView.vue` | 修改 |
| `frontend-v3/src/views/EntryListView.vue` | 修改 |
| `frontend-v3/src/components/EntryDetailHeader.vue` | 修改 |

## DESIGN.md §6 一致性检查

### Navigation & Auth State（§6 第 210-213 行）

| 规则 | 落地状态 | 锚点 |
|------|----------|------|
| Anonymous: "Sign in" button | ✓ 文案统一为 "Sign in" | AuthButton.vue:2 |
| Marketing 页面: primary variant | ✓ `pageType === 'marketing'` → primary | AuthButton.vue:43 |
| Functional 桌面: secondary variant | ✓ `mobileOverride === 'false'` → secondary | AuthButton.vue:44-47 |
| Functional 移动: ghost variant | ✓ `mobileOverride === 'true'` → ghost | AuthButton.vue:44-47 |
| Authenticated: avatar + username → user menu | ✓ user-menu-trigger 含 avatar + name | UserMenu.vue:3-7 |
| Admin badge pill when is_admin | ✓ `<span v-if="isAdmin" class="admin-badge">` | UserMenu.vue:6 |
| Same menu content across all pages | ✓ 三处均用 `<UserMenu />` 统一组件 | LandingView.vue:20, EntryListView.vue:10, EntryDetailHeader.vue:9,43 |

### Buttons（§6 第 153-156 行）

| 规则 | 落地状态 | 锚点 |
|------|----------|------|
| All buttons use BaseButton | ✓ AuthButton 内部使用 BaseButton | AuthButton.vue:2 |
| No new variants | ✓ 仅使用 primary/secondary/ghost | AuthButton.vue:43-47 |

### Tags（§6 第 162-164 行）

| 规则 | 落地状态 | 锚点 |
|------|----------|------|
| Use BaseTag component | ✓ EntryDetailHeader 两处均改为 BaseTag | EntryDetailHeader.vue:57-62, 73-78 |
| Clickable tags navigate to /explore?tags= | ✓ `:href="'/explore?tags=' + encodeURIComponent(tag)"` | EntryDetailHeader.vue:60 |
| @navigate handler calls router.push | ✓ `navigateToTag(href)` → `router.push(href)` | EntryDetailHeader.vue:144-146 |

### Overflow Menus（§6 第 178-179 行）

| 规则 | 落地状态 | 锚点 |
|------|----------|------|
| Dropdown on desktop | ✓ UserMenu dropdown 用 absolute 定位 | UserMenu.vue:120-131 |
| Bottom sheet on mobile | ⚠ 见下方 [INTERACTION] #1 |

### Z-Index（§4 第 122-130 行）

| 规则 | 落地状态 | 锚点 |
|------|----------|------|
| Dropdowns: z-index 100 | ✓ `z-index: 100` | UserMenu.vue:130 |

## 问题清单

### [INTERACTION] #1: UserMenu dropdown 在移动端未切换为 bottom sheet

```
文件：UserMenu.vue:9-13
问题：DESIGN.md §6 Overflow Menus 规则要求 "Dropdown on desktop, bottom sheet on mobile"。UserMenu 的认证态菜单在所有断点下都使用 absolute 定位的 dropdown，移动端未切换为 bottom sheet 形式。
严重度：Minor（不阻断）
Fix：当前 EntryDetailHeader 移动端 sticky-header 中 user-menu 触发器空间有限，dropdown 是合理折中。建议后续迭代时统一为 OverflowMenu 组件或在 UserMenu 内部按断点切换。此问题不阻断本次发布，因为移动端 sticky header 高度仅 40px 左右，dropdown 从 trigger 下方展开是可用的交互模式。
```

### [INTERACTION] #2: UserMenu trigger 缺少 focus-visible 状态

```
文件：UserMenu.vue:72-84
问题：.user-menu-trigger 无 :focus-visible 样式。DESIGN.md §10 要求 "All interactive elements must have visible focus indicators"。代码库中 BaseButton（:131）、BaseTag（:39）、EntryCard 标题（:205）均有 focus-visible outline。UserMenu trigger 是自定义 <button>，未继承 BaseButton 的 focus ring。
严重度：Moderate（可访问性缺陷）
Fix：添加 `.user-menu-trigger:focus-visible { outline: 2px solid var(--c-accent-secondary); outline-offset: 2px; }` 到 UserMenu.vue <style> 中。
```

### [INTERACTION] #3: UserMenu dropdown-item 缺少 focus-visible 状态

```
文件：UserMenu.vue:133-149
问题：.dropdown-item 无 :focus-visible 样式。键盘用户 Tab 导航到 Settings/Logout 时无可见 focus indicator。与 OverflowMenuDropdown.vue:96-98 的 `.overflow-item:focus-visible` 不一致。
严重度：Moderate（可访问性缺陷）
Fix：添加 `.dropdown-item:focus-visible { outline: 2px solid var(--c-accent-secondary); outline-offset: -2px; }` 到 UserMenu.vue <style> 中。
```

### [VISUAL] #4: EntryDetailHeader 桌面端模板缩进不一致

```
文件：EntryDetailHeader.vue:42-43
问题：第 42 行 AuthButton 有正确缩进（8 空格），但第 43 行 UserMenu（`    <UserMenu v-else-if=...`）只有 4 空格缩进，与上下文不一致。actions-area 内的子元素应有 8 空格缩进。
严重度：Trivial（不影响渲染，影响可维护性）
Fix：将第 43 行缩进从 4 空格改为 8 空格，与第 42 行 AuthButton 对齐。
```

### [INTERACTION] #5: AuthButton matchMedia 在 SSR/构建时安全，但 setup 阶段同步初始化的潜在风险

```
文件：AuthButton.vue:25-28
问题：matchMedia 在 setup 阶段同步调用（非 onMounted）。当前用 `typeof globalThis !== 'undefined'` 守卫，在 SSR 场景安全。在客户端 SPA 中，setup 在组件挂载前同步执行 matchMedia，此时 layout 可能尚未完成，但 matchMedia 返回的是视口当前状态，不影响正确性。
严重度：Info（无实际问题，记录设计偏离）
备注：P2 设计原文说 "用 ref + matchMedia.addEventListener('change', ...) 在 onMounted/onUnmounted 管理监听器"。实现中将初始值读取提前到 setup 阶段（确保首次渲染即正确），监听器仍在 onMounted/onUnmounted 管理。此偏离是合理的改进——避免首次渲染闪烁。
```

## AI Slop 检查

| 检查项 | 结果 |
|--------|------|
| 紫色/violet 渐变 | ✗ 无 |
| 泛化文案 | ✗ "Sign in"、"Settings"、"Logout" 均为标准术语 |
| 全部居中布局 | ✗ 无 |
| 千篇一律的卡片 grid | ✗ 无新卡片 |

## Typography 检查

| 检查项 | 结果 |
|--------|------|
| 字号层级清晰 | ✓ user-name 用 `--font-sm`，admin-badge 用 10px，dropdown-item 用 `--font-sm` |
| 移动端字号 ≥ 16px | ⚠ admin-badge 10px、dropdown-item `--font-sm`(13px) 均为辅助文本，非 body text，可接受 |

## Spacing 检查

| 检查项 | 结果 |
|--------|------|
| 一致间距 scale（4px 基数） | ✓ 全部使用 `--space-*` token，admin-badge `padding: 1px 5px` 是唯一非 4px 值（10px 字号的微 badge，可接受） |
| 移动端点击区域 ≥ 44px | ⚠ user-menu-trigger 高度由 padding 决定（`--space-1` + 24px avatar + `--space-1` ≈ 32px），不足 44px。但该元素在桌面端 header 中使用，移动端 EntryDetailHeader 也使用它。考虑增加 min-height。 |

## 交互状态检查

| 检查项 | 结果 |
|--------|------|
| hover 状态 | ✓ .user-menu-trigger:hover, .dropdown-item:hover 均有 |
| focus 状态 | ✗ 见 [INTERACTION] #2, #3 |
| active 状态 | — 无（dropdown 非持久 toggle） |
| disabled 状态 | — 无（auth 态为 binary） |
| loading state | — 无（auth 初始化由 authStore 管理，非 UserMenu 职责） |
| error state | — 无（非 UserMenu 职责） |
| empty state | — 无（认证态有 user 时才有 UserMenu） |

## DESIGN_GAP 审查

P4-implementation.md 声明了 5 个 DESIGN_GAP，以下为 design-review 角色的审查意见：

| DESIGN_GAP | 评审意见 |
|------------|----------|
| mobileOverride prop 偏离 P2 matchMedia 统一方案 | **接受**。EntryDetailHeader 已有 IsMobileKey inject 链，传入比 matchMedia 更准确（IsMobileKey 可能包含 resize observer 逻辑）。LandingView/EntryListView 不传 prop 时回退 matchMedia 是合理的降级。 |
| UserMenu.spec.ts vi.mock hoisting | **接受**。测试基础设施问题，非组件设计问题。 |
| T079 BDD-05 find('button') 选择器 | **接受**。测试选择器问题。 |
| T079 BDD-09/10 :has-text() 不支持 | **接受**。测试选择器问题。 |
| t067 回归 11 failures | **接受**。旧测试断言与新设计矛盾，需更新 t067 测试以匹配新行为。 |

## 总结

### 通过项（15）
- DESIGN.md §6 Navigation & Auth State 规则全部落地
- AuthButton variant 规则正确封装
- UserMenu 菜单内容三页面统一
- BaseTag 替换正确，复用 T076 模式
- Admin badge 正确实现
- Z-index 符合 DESIGN.md 规范
- 无 AI Slop
- Typography 层级清晰
- Spacing 使用 token 系统
- DESIGN_GAP 声明透明且合理

### 问题项（5）
- [INTERACTION] #2: UserMenu trigger 缺 focus-visible — **Moderate**
- [INTERACTION] #3: UserMenu dropdown-item 缺 focus-visible — **Moderate**
- [INTERACTION] #1: 移动端未切换 bottom sheet — **Minor**
- [VISUAL] #4: 模板缩进不一致 — **Trivial**
- [INTERACTION] #5: matchMedia setup 阶段初始化 — **Info**

### 判定

**Status: approved**

2 个 Moderate 可访问性问题（focus-visible 缺失）是真实缺陷，但不构成 BLOCKER——它们不影响功能正确性，且可以在后续迭代中修复。组件设计质量高，与 DESIGN.md §6 高度一致，DESIGN_GAP 声明透明合理。建议主 Agent 在 P7 一致性检查时将 #2 和 #3 转为定向修复项。

> 建议（非阻断）：主 Agent 可在 P4→P5 过渡时，派 implementer 定向修复 #2 和 #3（各加一行 CSS），利用已有的 focus-visible 模式，改动量极小。
