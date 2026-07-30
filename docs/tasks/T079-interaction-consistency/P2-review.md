---
phase: P2
task_id: T079-interaction-consistency
type: review
parent: P2-design.md
trace_id: T079-P2-20260731
status: approved
created: 2026-07-31
agent: plan-design-review
---

# P2 Design Review — T079: 交互一致性修复

## 评审范围

对 P2-design.md 做独立设计评审，聚焦四个维度：交互状态覆盖率、AI Slop 风险、移动端考虑、可访问性。同时验证方案与 DESIGN.md §6 的一致性，以及组件 API 设计的合理性。

## 评分维度（0-10）

### 1. 交互状态覆盖率 — 8/10

**优点：**
- AuthButton 的 variant 规则清晰覆盖了 marketing/desktop/mobile 三态（P2-design.md:72-76），与 DESIGN.md §6 "Navigation & Auth State" 完全对齐
- UserMenu 的 dropdown 行为（toggle/close/logout）完整迁移了现有逻辑（P2-design.md:122-125），不丢功能
- 登出副作用通过 emit('logout') 事件传递给父组件处理（P2-design.md:124-135），EntryListView 可保留 archived filter 重置 + toast 逻辑，LandingView 可不监听

**缺失：**
- **loading 态未提及**：authStore.authState 有 `'loading'` 状态（auth.ts:12-14）。当前三个页面的模板用 `v-if="authState === 'anonymous'"` / `v-else-if="authState === 'authenticated'"`，loading 态不渲染任何 auth UI。P2-design.md 未说明 AuthButton/UserMenu 在 loading 态的行为——是否保持当前"不渲染"行为？应显式声明：loading 态 AuthButton 和 UserMenu 均不渲染（由父组件的 v-if/v-else-if 控制），组件内部不处理 loading
- **空 tag 列表**：P1-requirements.md:44 已声明边界（空数组 v-for 正确处理），P2-design.md 未重复声明但方案不影响此行为

### 2. AI Slop 风险 — 9/10

**优点：**
- 方案严格遵循 DESIGN.md §6 规则，variant 选择是确定性映射（pageType + device → variant），无主观设计空间
- UserMenu 的模板结构直接迁移现有实现（P2-design.md:139-153），CSS 从 EntryListView 迁移（P2-design.md:155），不引入新视觉
- 文案全部来自 DESIGN.md §11 Terminology 表（"Sign in" / "Settings" / "Logout"），无自由发挥空间
- BaseTag 的使用完全复用 EntryCard.vue:40-45 的已验证模式（href + @navigate），无新设计

**轻微风险：**
- CSS 迁移时 LandingView 和 EntryListView 的样式差异需仔细处理（P2-design.md:155 提到 LandingView 用 `var(--c-border-strong)` vs EntryListView 用 `var(--c-border-strong)` + `var(--c-surface-lower)`）。设计选择取 EntryListView 版本（更完整），但未说明 LandingView 的 `.user-menu-trigger` 样式是否完全兼容。**非 BLOCKER**——实现时验证即可

### 3. 移动端考虑 — 8/10

**优点：**
- AuthButton 使用 `window.matchMedia('(max-width: 640px)')` 检测移动端（P2-design.md:80），与 DESIGN.md §9 断点一致
- matchMedia 的 listener 在 onMounted/onUnmounted 管理（P2-design.md:81），无内存泄漏
- EntryDetailHeader 移动端从纯文本 `<a>` 链接改为 AuthButton ghost variant（P2-design.md:175-177），符合 DESIGN.md §6 "ghost on functional pages (mobile)"
- 明确解释了不使用 inject IsMobileKey 的理由（P2-design.md:82）——IsMobileKey 是 EntryDetail 专用的 provide/inject 链，LandingView 和 EntryListView 不在链中

**缺失：**
- **EntryDetailHeader 移动端布局适配**：P2-design.md:177 提到"需要调整 CSS：mobile-sticky-header 中 AuthButton 的布局适配（当前 mobile-signin-link 是纯文本链接）"，但未给出具体 CSS 调整方案。当前 `.mobile-signin-link`（EntryDetailHeader.vue:136）是 `color: var(--c-accent); font-size: var(--font-sm); cursor: pointer; flex-shrink: 0;`——替换为 BaseButton small ghost 后尺寸和间距会变化。**非 BLOCKER**——BaseButton 自带样式，实现时验证布局即可，但建议 P4 实现者重点关注
- **LandingView 移动端**：DESIGN.md §9 "hide secondary links on mobile, keep brand + theme toggle + primary CTA"。LandingView 是 marketing 页，移动端 AuthButton 用 primary variant——符合规则。但 LandingView 当前有 `@media (max-width:860px)` 的 `.nav-links { display:none }` 和 `.btn-ghost { display:none }`（LandingView.vue:443-448），替换为 AuthButton 后这些媒体查询可能需要调整。**非 BLOCKER**——AuthButton primary variant 在移动端应正常显示

### 4. 可访问性 — 7/10

**优点：**
- BaseButton 已有 `:focus-visible` 样式（BaseButton.vue:131-134），AuthButton 继承
- BaseTag 已有 `a.base-tag:focus-visible` 样式（BaseTag.vue:39-43），EntryDetailHeader tag 改造后继承
- UserMenu 的 dropdown 使用 `<button>` 元素（P2-design.md:141-149），可键盘聚焦

**缺失：**
- **UserMenu dropdown 的 ARIA 属性未提及**：当前内联实现（LandingView.vue:24-32, EntryListView.vue:14-25）的 dropdown 没有 `aria-expanded`、`aria-haspopup`、`aria-label` 属性。UserMenu 组件提取时应补上：
  - trigger button: `:aria-expanded="showUserMenu"` `aria-haspopup="menu"`
  - dropdown: `role="menu"` 或 `role="listbox`
  - dropdown items: `role="menuitem"`
  **非 BLOCKER**——这是对现有代码的改善而非退化，但 DESIGN.md §10 Accessibility 要求 "All interactive elements must have visible focus indicators" 和 "Use semantic HTML"。建议 P4 实现时补充
- **键盘导航**：dropdown 打开后无法用 Escape 键关闭。DESIGN.md §10 未显式要求 Escape 关闭 dropdown，但这是常见交互模式。**非 BLOCKER**
- **EntryDetailHeader tag 的导航语义**：BaseTag 使用 `<a :href>` + `@click.prevent`（BaseTag.vue:2），有正确的链接语义。EntryDetailHeader 的 navigateToTag 函数（P2-design.md:188）使用 `router.push(href)`，与 EntryCard.vue:104-106 模式一致。正确

## DESIGN.md §6 一致性验证

| 规则 | 设计方案 | 一致 |
|------|---------|------|
| Anonymous: "Sign in" button | AuthButton 文案 "Sign in"（P2-design.md:87） | ✓ |
| Primary on marketing pages | LandingView `page-type="marketing"` → primary（P2-design.md:74） | ✓ |
| Secondary on functional pages (desktop) | EntryListView/EntryDetailHeader `page-type="functional"` + desktop → secondary（P2-design.md:75） | ✓ |
| Ghost on functional pages (mobile) | `page-type="functional"` + mobile → ghost（P2-design.md:76） | ✓ |
| Authenticated: avatar + username trigger | UserMenu trigger 含 avatar + username（P2-design.md:141-144） | ✓ |
| User menu: Settings, Logout | UserMenu dropdown 含 Settings + Logout（P2-design.md:148-149） | ✓ |
| Admin badge when is_admin | UserMenu trigger 含 admin badge（P2-design.md:145） | ✓ |
| Same menu content across all pages | UserMenu 组件统一，三个页面使用同一组件（P2-design.md:159-181） | ✓ |
| Tags: clickable → /explore?tags=\<encoded\> | BaseTag href="/explore?tags=..." + navigate emit（P2-design.md:186-188） | ✓ |
| Tags: non-clickable only on entry detail page | DESIGN.md §6 允许 detail 页 tag 可点击或不可点击。方案选择可点击——与 EntryCard/EntryListRow 一致 | ✓ |

## 组件 API 设计验证

### AuthButton

- **Props**：`pageType: 'marketing' | 'functional'`——简洁，覆盖所有场景。无需 device prop（内部 matchMedia 自动检测）。✓
- **Emits**：`sign-in: []`——语义清晰，父组件决定如何响应（打开 LoginDialog）。✓
- **Variant computed**：P2-design.md:101-106 逻辑正确，与 variant 规则表一致。✓

### UserMenu

- **直接消费 authStore**：与 ThemeToggle.vue:18-19 的模式一致（直接 useStore + storeToRefs），符合 follows_existing_pattern 声明。✓
- **Emits**：`logout: []`——允许父组件做额外处理（EntryListView 重置 archived filter + toast）。✓
- **navigateToSettings**：`router.push('/settings?tab=apikeys')`——与 P1 [SCOPE_RESOLVED] 决策一致（文案 "Settings" + URL 保持直达 apikeys tab）。✓

## follows_existing_pattern 声明验证

P2-design.md:48-52 声明 follows_existing_pattern，列出 3 个参照文件：

1. **BaseTag.vue**——T076 建立的可点击 tag 模式。验证：EntryCard.vue:40-45 已使用此模式，BaseTag.vue:1-16 实现正确。✓
2. **BaseButton.vue**——已有的 variant 按钮模式。验证：BaseButton.vue:32-48 支持 primary/secondary/ghost/danger + size。✓
3. **ThemeToggle.vue**——自包含 header 子组件模式。验证：ThemeToggle.vue:14-21 直接 useStore + storeToRefs，无 props。UserMenu 采用相同模式。✓

声明合理，单候选方案合规。

## 事实核查

### 设计声称 vs 源码验证

| 设计声称 | 源码验证 | 结果 |
|---------|---------|------|
| EntryDetailHeader 桌面端用 `variant="primary"`（错） | EntryDetailHeader.vue:41 `variant="primary"` | ✓ 确认 |
| EntryDetailHeader 移动端用纯文本 `<a>`（错） | EntryDetailHeader.vue:8 `<a class="mobile-signin-link">` | ✓ 确认 |
| EntryListView 用 `variant="ghost"` + "Login"（错） | EntryListView.vue:10 `variant="ghost"` + 文案 "Login" | ✓ 确认 |
| LandingView 用户菜单只有 Logout | LandingView.vue:30 仅 `<button>Logout</button>` | ✓ 确认 |
| EntryListView 用户菜单用 "API Keys" | EntryListView.vue:21 `<button>API Keys</button>` | ✓ 确认 |
| LandingView 用户菜单无 admin badge | LandingView.vue:23-27 无 admin badge span | ✓ 确认 |
| EntryListView 有 admin badge | EntryListView.vue:17 `<span v-if="authStore.isAdmin" class="admin-badge">` | ✓ 确认 |
| LandingView handleLogout 无 toast | LandingView.vue:227-230 仅 closeMenu + logout() | ✓ 确认 |
| EntryListView handleLogout 有额外逻辑 | EntryListView.vue:409-416 重置 archived + toast | ✓ 确认 |
| EntryDetailHeader 已 inject IsMobileKey | EntryDetailHeader.vue:121 `const isMobile = inject(IsMobileKey)!` | ✓ 确认 |
| action-sep 在 Explore 按钮之后/之前 | EntryDetailHeader.vue:39 action-sep 在 OverflowMenu 之前，OverflowMenu 之后无 action-sep | ⚠ 见下 |

### action-sep 布局分析修正

P2-design.md:184 声称"Explore 按钮前没有 action-sep（action-sep 在 OverflowMenu 后，AuthButton/Explore 在其后）"。

实际源码（EntryDetailHeader.vue:39-45）：
```
39: <span class="action-sep"></span>      ← 在 OverflowMenu 之前
40: <OverflowMenu ... />
41: <BaseButton ... />                    ← AuthButton（当前）
42: <router-link ...>Explore</router-link> ← Explore 按钮
45: <ThemeToggle />
```

action-sep 在 OverflowMenu **之前**，不是之后。但设计结论仍然正确：移除 Explore 按钮后，action-sep 仍在 OverflowMenu 和 AuthButton/UserMenu 之间起分隔作用，布局不变。**事实描述有小误，结论正确。非 BLOCKER。**

## 四字段验证

- `packages: [frontend-v3]` ✓
- `domains: [frontend]` ✓（与 P1-requirements.md:180 一致）
- `ui_affected: true` ✓（涉及 3 个页面 + 2 个新组件的 UI 改动）
- `gate_commands`：
  - P3: `cd frontend-v3 && npx vitest run --reporter=verbose` ✓
  - P5: `cd frontend-v3 && npx vitest run --reporter=dot` ✓
  - P5_e2e: `E2E_SPEC=e2e/auth-consistency.spec.ts make debug-test` ✓（ui_affected: true 时必填，已声明）
  - P6: `cd frontend-v3 && npx vitest run --reporter=dot` ✓

## minimal_validation 验证

P2-design.md:258-263 声明"纯代码逻辑，无外部系统依赖"，理由：
1. Vue 组件提取重构
2. BaseButton variant 值替换
3. BaseTag 替换 span（复用 T076 已验证模式）
4. 删除冗余 router-link

依赖的内部函数：authStore.logout()、router.push()、matchMedia（标准 Web API）。

验证：authStore.logout() 在 auth.ts:48-51 已存在。router.push() 是 vue-router 标准 API。matchMedia 是标准 Web API。声明合理。✓

## files_to_read 验证

P2-design.md:228-253 列出 12 个文件引用，每个都附 why 说明。检查：

- 数量合理（12 个），未过多导致上下文爆炸
- 覆盖了实现所需的全部关键文件（BaseButton/BaseTag/ThemeToggle 参照、auth store、3 个改造目标、entryDetailKeys）
- 行号引用（如 LandingView.vue:7-37, EntryListView.vue:378-416）精确指向改造区域

✓ 合规

## BDD 覆盖检查

P1-requirements.md 定义了 BDD-01 到 BDD-17。检查 P2-design.md 是否覆盖：

| BDD | 设计覆盖 | 状态 |
|-----|---------|------|
| BDD-01 (Landing primary) | P2-design.md:160 AuthButton marketing → primary | ✓ |
| BDD-02 (Explore desktop secondary) | P2-design.md:168 AuthButton functional desktop → secondary | ✓ |
| BDD-03 (Explore tablet secondary) | P2-design.md:75 tablet = desktop variant (≥641px → secondary) | ✓ |
| BDD-04 (Explore mobile ghost) | P2-design.md:76 mobile → ghost | ✓ |
| BDD-05 (Detail desktop secondary) | P2-design.md:178-179 AuthButton functional desktop → secondary | ✓ |
| BDD-06 (Detail mobile ghost) | P2-design.md:175-176 AuthButton functional mobile → ghost | ✓ |
| BDD-07 (Landing Settings+Logout) | P2-design.md:161 UserMenu | ✓ |
| BDD-08 (Explore Settings+Logout) | P2-design.md:169 UserMenu | ✓ |
| BDD-09 (Detail desktop UserMenu) | P2-design.md:180-182 UserMenu | ✓ |
| BDD-10 (Detail mobile UserMenu) | P2-design.md:180 (同桌面端逻辑) | ✓ |
| BDD-11 (admin badge) | P2-design.md:145 admin badge | ✓ |
| BDD-12 (菜单内容一致) | UserMenu 组件统一 | ✓ |
| BDD-13 (无 Explore 按钮) | P2-design.md:183 移除 Explore | ✓ |
| BDD-14 (Detail desktop tag 可点击) | P2-design.md:186-188 BaseTag | ✓ |
| BDD-15 (Detail mobile tag 可点击) | P2-design.md:186 meta-tags-bar 也要改 | ✓ |
| BDD-16 (中文 tag) | P2-design.md:186 encodeURIComponent | ✓ |
| BDD-17 (Settings 导航) | P2-design.md:125 navigateToSettings | ✓ |

全部 17 条 BDD 均有设计覆盖。✓

## 风险评估

P2-design.md:38-41 列出 4 个风险，均有应对方案：

1. LandingView 认证态瞬时可见——UserMenu 直接读 authStore，自然渲染。✓
2. EntryDetailHeader 布局回归——移除 Explore 按钮及前方的 action-sep。**修正**：action-sep 不在 Explore 前方，移除 Explore 不需移除 action-sep。✓（结论正确，路径描述有小误）
3. UserMenu logout 副作用——emit('logout') 事件。✓
4. EntryDetailHeader isMobile inject——AuthButton 用 matchMedia 而非 inject。✓

## 综合结论

**Status: approved**

方案设计合理，严格遵循 DESIGN.md §6 规则，组件 API 简洁且符合现有模式。follows_existing_pattern 声明合规。BDD 全覆盖。四字段齐全。files_to_read 精确。

发现的 5 个非 BLOCKER 问题（实现时注意）：

1. **[N1] loading 态行为未显式声明**：authState='loading' 时 AuthButton/UserMenu 不渲染（由父组件 v-if 控制），但 P2-design.md 未显式声明。建议 P4 实现者确认三个页面的 v-if/v-else-if 链不渲染 loading 态
2. **[N2] UserMenu ARIA 属性缺失**：当前内联实现无 aria-expanded/aria-haspopup/role。UserMenu 提取时应补充，符合 DESIGN.md §10
3. **[N3] EntryDetailHeader 移动端 CSS 适配**：mobile-signin-link → BaseButton small ghost 的布局变化未给出具体 CSS 方案。P4 实现者需验证
4. **[N4] LandingView 移动端媒体查询**：`@media (max-width:860px)` 中的 `.btn-ghost { display:none }` 等规则在替换为 AuthButton 后可能需要调整
5. **[N5] action-sep 位置描述小误**：P2-design.md:184 描述 action-sep 在 OverflowMenu 后，实际在前。结论不受影响

以上均为 WARNING 级，不阻断推进。建议 P4 实现者关注 N1-N4。
