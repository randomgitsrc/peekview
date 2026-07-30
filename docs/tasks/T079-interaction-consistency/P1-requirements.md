---
phase: P1
task_id: T079-interaction-consistency
type: problems
parent: P0-brief.md
trace_id: T079-P1-20260731
status: draft
created: 2026-07-31
agent: analyst
---

# P1 Requirements — T079: 交互一致性修复

## 1. 需求复述

修复 4 处前端交互不一致，使所有页面遵守 DESIGN.md §6 Navigation & Auth State 规则：

1. **登录按钮统一**：Marketing 页（Landing）用 `primary` + "Sign in"（已正确）；Functional 页（Explore、Detail）桌面端用 `secondary` + "Sign in"，移动端用 `ghost` + "Sign in"。当前 Explore 用 `ghost` + "Login"（文案和 variant 均错），Detail 桌面端用 `primary`（variant 错），Detail 移动端用纯文本链接（未用 BaseButton）。

2. **用户菜单统一**：所有页面的认证态用户菜单为 Settings + Logout，admin 用户显示 admin badge。当前 Landing 只有 Logout（缺 Settings、缺 admin badge），Explore 用 "API Keys"（文案错、缺 admin badge），Detail 完全没有认证态用户菜单。

3. **移除冗余 Explore 按钮**：Detail 页桌面端 header 有 CompassIcon "Explore" 按钮，但 logo 点击回 `/` 会 redirect 到 `/explore`（认证态），或直接可用 logo 返回首页再导航。此按钮冗余，应移除。

4. **详情页 tag 可点击**：Detail 页 meta-row 和 meta-tags-bar 中的 tag 是静态 `<span class="meta-tag">`，应改为 BaseTag 组件（提供 href 跳转到 `/explore?tags=<encoded>`），与 EntryCard/EntryListRow 保持一致。

共享组件 AuthButton（匿名态）和 UserMenu（认证态）需抽取，供各页面复用。

## 2. 隐含需求识别

### 数据
- 无数据影响。后端无改动，无迁移。

### 前端
- **AuthButton 组件**：需封装匿名态登录按钮，支持 variant 区分（marketing 页 primary，functional 页 desktop secondary / mobile ghost）。组件需感知当前页面类型（marketing vs functional）和设备类型（desktop vs mobile）以选择正确 variant。**Tablet 归属规则**：641px-1023px 区间归入 desktop variant（即 functional 页 tablet = secondary），与 EntryDetailHeader 当前 `isDesktop = !isMobile` 二分逻辑一致（`isMobile` 以 640px 为界）。
- **UserMenu 组件**：需封装认证态用户菜单（avatar + username + admin badge + dropdown: Settings, Logout）。需包含 closeUserMenu 外部点击关闭逻辑，目前此逻辑在 LandingView 和 EntryListView 中重复。
- **Detail 页认证态用户菜单缺失**：EntryDetailHeader 当前只处理匿名态（Sign in 按钮），认证态完全无用户菜单。需在 EntryDetailHeader 桌面端和移动端都添加 UserMenu 组件。
- **Detail 页 tag 点击后导航**：Detail 页 tag 改为 BaseTag 可点击后，需有 navigateToTag 处理函数（router.push），与 EntryCard/EntryListRow 模式一致。但 Detail 页使用子组件 EntryDetailHeader，需通过 emit 或直接在子组件内处理路由跳转。
- **Landing 认证态瞬时可见**：LandingView 在认证后立即 redirect 到 /explore，但 redirect 前的瞬间仍需显示一致的 UserMenu（避免闪烁不一致）。

### 多端
- MCP / CLI / API 不受影响。纯前端改动。

### 边界
- **空 tag 列表**：entry 无 tag 时，meta-row 和 meta-tags-bar 中无 tag 元素，不影响功能。改用 BaseTag 后 v-for 仍正确处理空数组。
- **含特殊字符的 tag**：`encodeURIComponent(tag)` 已在 EntryCard/EntryListRow 中使用，Detail 页改用 BaseTag 时同样编码，保证中文 tag（T083 已修复后端 LIKE 查询）正常工作。
- **Landing 移动端登录按钮**：DESIGN.md §9 规则 "hide secondary links on mobile, keep brand + theme toggle + primary CTA"——Landing 是 marketing 页，移动端仍用 primary variant。
- **Detail 移动端登录按钮**：DESIGN.md 规则 functional 页移动端用 ghost variant。当前 Detail 移动端用纯文本 `<a>` 链接，应改为 `BaseButton variant="ghost" size="small"`。
- **Zen mode 隐藏**：EntryDetailHeader 在 zen mode 下隐藏（`v-show="!zenMode"`），AuthButton 和 UserMenu 都应随 header 隐藏，不需额外处理。
- **Share access 模式**：通过 share link 访问详情页时，用户可能是匿名态。AuthButton 应正常显示，UserMenu 不应显示。**声明：share link 场景与普通匿名访问在 auth 状态展示上无行为差异——匿名态均显示 AuthButton，认证态均显示 UserMenu，不因 share link 来源产生额外行为分支。**

### 兼容
- 现有 LandingView 的 `closeUserMenu`、`toggleUserMenu`、`handleLogout`、`userInitial`、`userName` 逻辑需迁移到 UserMenu 组件中，LandingView 和 EntryListView 移除这些重复逻辑。
- EntryListView 的 `navigateToApiKeys` 函数改为导航到 `/settings`（而非 `/settings?tab=apikeys`），因为 DESIGN.md 要求菜单项文案为 "Settings" 而非 "API Keys"。但改为 `/settings`（不带 tab 参数）会导致 API Keys 用户需手动切换 tab，是行为退化。**主 Agent 已裁定：文案改为 "Settings" + URL 保持 `/settings?tab=apikeys`，见 §4 `[SCOPE_RESOLVED]`。**
- EntryDetailHeader 的 `overflowItems` 可能包含与 auth 相关的操作（delete entry 等），需确保 UserMenu 的引入不干扰 overflow menu 的布局。
- **移除 Explore 按钮后布局回归**：Detail 页桌面端移除 CompassIcon "Explore" 按钮后，actions-area 的间距、分隔线（action-sep）和剩余元素（AuthButton/UserMenu、ThemeToggle）的布局不应出现错位或多余空白。

## 3. BDD 验收条件

### 登录按钮一致性

#### BDD-01: Landing 页匿名态显示 primary "Sign in" 按钮
- Given 用户未登录，在 Landing 页（`/`）
- When 页面渲染完成
- Then 导航区域有一个 BaseButton，variant 为 primary，按钮文案为 "Sign in"

#### BDD-02: Explore 页匿名态桌面端显示 secondary "Sign in" 按钮
- Given 用户未登录，在 Explore 页（`/explore`），视口宽度 >= 1024px
- When 页面渲染完成
- Then 导航区域有一个 BaseButton，variant 为 secondary，按钮文案为 "Sign in"

#### BDD-03: Explore 页匿名态平板端显示 secondary "Sign in" 按钮
- Given 用户未登录，在 Explore 页（`/explore`），视口宽度为 641px-1023px
- When 页面渲染完成
- Then 导航区域有一个 BaseButton，variant 为 secondary，按钮文案为 "Sign in"

#### BDD-04: Explore 页匿名态移动端显示 ghost "Sign in" 按钮
- Given 用户未登录，在 Explore 页（`/explore`），视口宽度 <= 640px
- When 页面渲染完成
- Then 导航区域有一个 BaseButton，variant 为 ghost，按钮文案为 "Sign in"

#### BDD-05: Detail 页匿名态桌面端显示 secondary "Sign in" 按钮
- Given 用户未登录，在 Detail 页（`/some-slug`），视口宽度 >= 1024px
- When 页面渲染完成
- Then header 导航区域有一个 BaseButton，variant 为 secondary，按钮文案为 "Sign in"

#### BDD-06: Detail 页匿名态移动端显示 ghost "Sign in" 按钮
- Given 用户未登录，在 Detail 页（`/some-slug`），视口宽度 <= 640px
- When 页面渲染完成
- Then 移动端 sticky header 有一个 BaseButton，variant 为 ghost，按钮文案为 "Sign in"

### 用户菜单一致性

#### BDD-07: Landing 页认证态显示 Settings + Logout 用户菜单
- Given 用户已登录，在 Landing 页（`/`，redirect 前）
- When 用户点击头像/用户名触发器
- Then 下拉菜单包含 "Settings" 和 "Logout" 两个选项
- 验证策略：Playwright 中 redirect 前的瞬时窗口不可可靠验证，改为代码级验证（确认 LandingView 模板中包含 UserMenu 组件引用）+ vitest 单元测试（mock authState.isAuthenticated=true，断言 UserMenu 渲染）

#### BDD-08: Explore 页认证态显示 Settings + Logout 用户菜单
- Given 用户已登录，在 Explore 页（`/explore`）
- When 用户点击头像/用户名触发器
- Then 下拉菜单包含 "Settings" 和 "Logout" 两个选项

#### BDD-09: Detail 页桌面端认证态显示用户菜单
- Given 用户已登录，在 Detail 页（`/some-slug`），视口宽度 >= 1024px
- When 用户点击头像/用户名触发器
- Then 下拉菜单包含 "Settings" 和 "Logout" 两个选项

#### BDD-10: Detail 页移动端认证态显示用户菜单
- Given 用户已登录，在 Detail 页（`/some-slug`），视口宽度 <= 640px
- When 用户点击头像/用户名触发器
- Then 下拉菜单包含 "Settings" 和 "Logout" 两个选项

#### BDD-11: admin 用户在所有页面显示 admin badge
- Given 用户已登录且 is_admin 为 true，在任一页面
- When 用户菜单触发器渲染
- Then 触发器上显示 admin badge 标记

#### BDD-12: 所有页面用户菜单内容一致
- Given 用户已登录
- When 分别在 Landing、Explore、Detail 页面打开用户菜单
- Then 三个页面的菜单选项数量和文案完全相同（Settings + Logout，admin 用户含 badge）

### Explore 按钮移除

#### BDD-13: Detail 页桌面端无 Explore 按钮
- Given 在 Detail 页（`/some-slug`），视口宽度 >= 1024px
- When 页面渲染完成
- Then header 的 actions-area 中不包含 CompassIcon "Explore" 按钮

### Detail 页 tag 可点击

#### BDD-14: Detail 页桌面端 tag 可点击并跳转到 explore
- Given 在 Detail 页（`/some-slug`），entry 有 tag "vue"，视口宽度 >= 1024px
- When 用户点击 tag "vue"
- Then 浏览器导航到 `/explore`，且 URL 查询参数包含 `tags=vue`

#### BDD-15: Detail 页移动端 tag 可点击并跳转到 explore
- Given 在 Detail 页（`/some-slug`），entry 有 tag "vue"，视口宽度 <= 640px
- When 用户点击 tag "vue"
- Then 浏览器导航到 `/explore`，且 URL 查询参数包含 `tags=vue`

#### BDD-16: Detail 页中文 tag 可点击并正确跳转
- Given 在 Detail 页（`/some-slug`），entry 有中文 tag "前端"，视口为桌面端
- When 用户点击 tag "前端"
- Then 浏览器导航到 `/explore`，且 URL 查询参数包含 `tags=` + URL 编码后的 "前端"

### Settings 导航

#### BDD-17: 用户菜单点击 Settings 导航到设置页
- Given 用户已登录，在任一页面
- When 用户打开用户菜单并点击 "Settings"
- Then 浏览器导航到 `/settings`

## 4. 待确认清单

[NO_NEED_CONFIRM]

- `[SCOPE_RESOLVED]` **Settings 菜单项导航 URL**：DESIGN.md §6 要求用户菜单文案为 "Settings"（而非 "API Keys"），但未指定导航 URL。当前 EntryListView 导航到 `/settings?tab=apikeys`（直达 API Keys tab）。改为 `/settings`（默认 tab，可能是 profile）会导致 API Keys 用户需手动切换 tab——是行为退化。**决策（主 Agent 默认裁定）：选项① — 文案改为 "Settings" + URL 保持 `/settings?tab=apikeys`（文案变但直达不变，不退化用户体验）。DESIGN.md §6 只规范文案，不限制 URL，此决策不违反设计规则。**

## 5. 裁剪说明

```yaml
P1_simplified: false
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

- **P1（需求基线）**：不可裁剪，核心阶段。
- **P2（方案设计）**：不可裁剪。共享组件 AuthButton 和 UserMenu 的接口设计需评审，涉及多个页面适配不同布局，属于跨组件改动。
- **P3（TDD 测试）**：保留。共享组件需 vitest 单元测试覆盖 variant 切换、菜单展开/关闭、admin badge 显示。risk=medium 应走 TDD 红灯。
- **P4（代码实现）**：保留。实现 AuthButton、UserMenu 组件 + 3 个页面改造 + Detail tag 改造。
- **P5（技术验证）**：保留。`make test-frontend` + `make typecheck` 必须通过。
- **P6（验收）**：不可裁剪。涉及 UI 交互，需 Playwright 实跑验证。
- **P7（一致性检查）**：保留。涉及 3 个 view + 1 个 header 子组件的跨文件改动。
- **P8（发布准备）**：保留。CHANGELOG 记录。

## 6. 范围声明

```yaml
domains: [frontend]
packages:
  - frontend-v3/src/components/AuthButton.vue          # 新建
  - frontend-v3/src/components/UserMenu.vue             # 新建
  - frontend-v3/src/views/LandingView.vue               # 改造
  - frontend-v3/src/views/EntryListView.vue             # 改造
  - frontend-v3/src/components/EntryDetailHeader.vue     # 改造（登录按钮 + 用户菜单 + tag + 移除 Explore 按钮）
  - frontend-v3/src/components/__tests__/AuthButton.spec.ts   # 新建
  - frontend-v3/src/components/__tests__/UserMenu.spec.ts     # 新建
risk_level: medium
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证交互行为（按钮 variant、用户菜单展开、tag 点击跳转）
    available:
      - "playwright-cdp skill（CDP 连接 Chrome :18800，截图 + 交互验证）"
      - "vision-engine skill（截图后分析 UI 一致性）"
    status: supplementable
  - need: unit-test-framework
    why: P3 TDD 需要 vitest 编写组件单元测试
    available:
      - "vitest + jsdom（项目已配置，make test-frontend）"
    status: available
```

## 环境隔离声明

[PROD_NOT_TOUCHED] 本任务为纯前端组件改造，不涉及后端、数据库、生产服务。验证使用 `make debug`（:8888 隔离数据）或 `make test-frontend`（vitest 单元测试）。
