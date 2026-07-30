---
phase: P7
task_id: T079-interaction-consistency
type: consistency
parent: P6-acceptance.md
trace_id: T079-P7-20260731
status: draft
created: 2026-07-31
agent: consistency-reviewer
---

# P7 Consistency — T079: 交互一致性修复

## 环境隔离声明

[PROD_NOT_TOUCHED] 本审查为文档交叉比对 + 源码验证，不涉及后端、数据库、生产服务。

## 检查清单

### 1. DESIGN_GAP 配对

P4-implementation.md 声明了 6 条 [DESIGN_GAP]，逐条审查如下：

#### DESIGN_GAP #1: AuthButton mobileOverride prop（P4 L46）

[DESIGN_GAP: P2 设计指定 AuthButton 使用 matchMedia 检测 mobile，但 EntryDetailHeader 测试未 mock matchMedia（jsdom 默认无 matchMedia），导致 AuthButton 无法检测 mobile。实现中添加了 `mobileOverride` prop，EntryDetailHeader 传入 inject 的 isMobile 值。LandingView/EntryListView 不传该 prop，AuthButton 回退到 matchMedia。此设计偏离 P2 "三个页面统一使用 matchMedia" 的方案，但兼容了测试环境。]

[DESIGN_GAP_REVIEWED: 已确认] — 实现合理。P2 §AuthButton 设备检测方案为"三个页面统一使用 matchMedia"，但 jsdom 测试环境无 matchMedia。实现添加 `mobileOverride?: string` prop（非 boolean，规避 Vue boolean casting），EntryDetailHeader 传入 inject 的 isMobile 值，LandingView/EntryListView 不传 → 回退 matchMedia。源码验证（AuthButton.vue L9-12, L42-48）：`mobileOverride` 优先于 `internalIsMobile`，逻辑正确。EntryDetailHeader.vue L8/L42 传入 `mobile-override="true"/"false"`。此为 P2 设计歧义（未考虑测试环境 matchMedia 缺失）的合理补救，非核心设计目标偏差。涉及 P2 §AuthButton 设备检测方案。

#### DESIGN_GAP #2: UserMenu.spec.ts vi.mock hoisting（P4 L127）

[DESIGN_GAP: UserMenu.spec.ts 在 `mountUserMenu` 函数内部使用 `vi.mock('@/stores/auth', factory)`，vitest 1.6.1 将 vi.mock 提升到文件顶部（hoisting）。提升后 factory 闭包引用 `authStoreMock`（mountUserMenu 的函数参数），在文件加载时该参数不存在，导致 `ReferenceError: authStoreMock is not defined`。正确做法应使用 `vi.hoisted()` 模式（参考 LoginDialog.spec.ts）。此为 P3 测试基础设施问题，非组件实现问题。]

[DESIGN_GAP_REVIEWED: 已确认] — 测试基础设施问题，非组件实现问题。源码验证（UserMenu.spec.ts L1-30）：已修复，改用顶层 `vi.mock('@/stores/auth', ...)` + 模块级可变 `mockAuthStore` 对象（非函数参数闭包），规避 hoisting 问题。P6 验收 47/47 通过。

#### DESIGN_GAP #3: T079 BDD-05 find('button') 选择器（P4 L131）

[DESIGN_GAP: T079-entry-detail-header.spec.ts BDD-05 测试使用 `header.find('button')` 查找 AuthButton，但 .detail-header 中 copy 按钮在 DOM 中先于 AuthButton 渲染（`canCopy: true` 且 OverflowMenu 被 stub）。测试应使用 `.btn-secondary` 或 `.base-button` 选择器。此为 P3 测试选择器设计问题。]

[DESIGN_GAP_REVIEWED: 已确认] — P3 测试选择器问题。P6 验收显示 BDD-05 PASS，说明选择器已修正。非组件实现问题。

#### DESIGN_GAP #4: T079 BDD-09/10 :has-text() 选择器（P4 L135）

[DESIGN_GAP: T079-entry-detail-header.spec.ts BDD-09/10 使用 `button:has-text("Sign in")` 选择器，这是 Playwright 特有语法。`@vue/test-utils` 的 `find()` 使用 `querySelectorAll`，底层 jsdom 不支持 `:has-text()` 伪类，抛出 `SyntaxError: Unknown pseudo-class :has-text()`。此为 P3 测试选择器问题。]

[DESIGN_GAP_REVIEWED: 已确认] — P3 测试选择器问题。P6 验收显示 BDD-09/10 PASS，说明选择器已修正。非组件实现问题。

#### DESIGN_GAP #5: T079 Admin badge vi.doMock 缓存（P4 L139）

[DESIGN_GAP: T079-entry-detail-header.spec.ts admin badge 测试使用 `vi.doMock('@/stores/auth', factory)` 重新 mock auth store，但 `vi.doMock` 不会更新已导入模块的缓存。UserMenu 在文件加载时已导入 @/stores/auth（使用初始 mock，`user: null, isAdmin: false`），`vi.doMock` 的新 factory 不影响已缓存模块。正确做法应使用 `vi.resetModules()` + 重新导入，或在顶层 mock 中使用可变变量。]

[DESIGN_GAP_REVIEWED: 已确认] — P3 测试 mock 策略问题。源码验证（T079-entry-detail-header.spec.ts L14-27）：已修复，改用顶层 `vi.mock` + 模块级可变 `mockAuthStore` 对象，通过 `setAuthState()` 函数直接修改 ref 值切换状态，无需 `vi.doMock`。P6 验收 BDD-11 admin badge PASS。非组件实现问题。

#### DESIGN_GAP #6: t067 回归 — 旧行为断言与新 BDD 矛盾（P4 L143）

[DESIGN_GAP: t067-detail-framework.spec.ts 以下断言与 P1 BDD 矛盾：
> 1. BDD-1/2/3/11/12: 检查 `.actions-area .btn-primary` 存在 — P2 设计要求 desktop variant 从 primary 改为 secondary（BDD-05）
> 2. BDD-1/2/12: 检查 `.mobile-signin-link` 存在 — P2 设计要求移除 mobile-signin-link，改用 AuthButton（BDD-06）
> 3. BDD-6: 检查 Explore 导航链接 `href="/explore"` 存在 — P2 设计要求移除 Explore 按钮（BDD-13）
> t067 测试需更新以匹配新行为。此为 P2 设计变更导致的预期回归。]

[DESIGN_GAP_REVIEWED: 已确认] — 预期回归。t067 测试断言旧行为（btn-primary、mobile-signin-link、Explore 链接），与本任务 P1 BDD 直接矛盾。P4 自查显示 11 个 t067 失败，属于旧测试未更新而非组件实现错误。P6 验收使用 T079 专用测试文件（47/47 通过），不依赖 t067。此为跨任务测试债务，建议后续任务更新 t067，不阻塞本任务。

### 2. SCOPE+ 闭环

P1-requirements.md §4 含 `[SCOPE_RESOLVED]` 标记（Settings 菜单项导航 URL 决策：文案 "Settings" + URL `/settings?tab=apikeys`）。

- P2 §UserMenu `navigateToSettings()` → `router.push('/settings?tab=apikeys')` — 一致
- P4 §UserMenu 行为 → `router.push('/settings?tab=apikeys')` — 一致
- 源码验证（UserMenu.vue L52-55）：`router.push('/settings?tab=apikeys')` — 一致
- P6 BDD-17 验收：点击 Settings 后 `router.push` 参数为 `/settings?tab=apikeys` — 一致

P2 §[SCOPE+] 检查声明"无新发现"。P4 §SCOPE+ 检查声明"无新发现"。无未闭环 SCOPE+。

### 3. 跨文件一致性

#### 3a. P2§packages vs P1§packages

- P1 §6 范围声明 `packages`：列出 7 个文件路径（AuthButton.vue、UserMenu.vue、LandingView.vue、EntryListView.vue、EntryDetailHeader.vue、AuthButton.spec.ts、UserMenu.spec.ts）
- P2 §packages：`[frontend-v3]`（包级别声明）

P2 的包级别声明是对 P1 文件级声明的正确聚合，两者一致。P8 release 的 bump 范围应为 frontend-v3（前端构建产物，非独立 npm 包，无版本 bump 需求）。

#### 3b. P1 BDD vs P6 验收数量匹配

| 维度 | P1 BDD | P6 PASS | 匹配 |
|------|--------|---------|------|
| 登录按钮一致性 | BDD-01~06 (6) | BDD-01~06 (6) | ✓ |
| 用户菜单一致性 | BDD-07~12 (6) | BDD-07~12 (6) | ✓ |
| Explore 按钮移除 | BDD-13 (1) | BDD-13 (1) | ✓ |
| Detail tag 可点击 | BDD-14~16 (3) | BDD-14~16 (3) | ✓ |
| Settings 导航 | BDD-17 (1) | BDD-17 (1) | ✓ |
| **合计** | **17** | **17** | **✓** |

逐条内容比对：P6 每条 BDD 验收结果的内容描述与 P1 BDD 条件语义一致，无映射错位。

#### 3c. P4 实现路径 vs P2 方案设计

| P2 设计 | P4 实现 | 源码验证 | 一致性 |
|---------|---------|----------|--------|
| AuthButton.vue: pageType prop, matchMedia 检测 | AuthButton.vue: pageType + mobileOverride prop, matchMedia 回退 | AuthButton.vue L9-48 | [OK]（mobileOverride 为 DESIGN_GAP #1 的合理偏离） |
| UserMenu.vue: 消费 authStore, emit logout, navigateToSettings | UserMenu.vue: 同设计 | UserMenu.vue L17-64 | [OK] |
| LandingView: AuthButton marketing + UserMenu, 移除内联 auth | LandingView: 同设计 | LandingView.vue L19-20, L186-187 | [OK] |
| EntryListView: AuthButton functional + UserMenu, 移除内联 auth | EntryListView: 同设计 | EntryListView.vue L9-10, L233-234 | [OK] |
| EntryDetailHeader: AuthButton functional + UserMenu, 移除 Explore, BaseTag | EntryDetailHeader: 同设计 | EntryDetailHeader.vue L8-9, L42-43, L57-62, L73-78, L90-92 | [OK] |
| 移除 toggleUserMenu/closeUserMenu/userInitial/userName | 已移除 | grep 确认 LandingView/EntryListView 无残留 | [OK] |
| 移除 CompassIcon import + Explore router-link | 已移除 | grep 确认 EntryDetailHeader 无 Compass/mobile-signin-link/meta-tag | [OK] |
| tag 改为 BaseTag + navigateToTag | 已实现 | EntryDetailHeader.vue L57-62, L73-78, L144-146 | [OK] |

#### 3d. P2 ui_affected vs P6 验收方式

P2 `ui_affected: true`，列出 10 个交互点。P6 使用 vitest 单元测试（非 Playwright E2E）验收。P6 验收方式说明：使用组件级单元测试覆盖 BDD-01~17，通过 `@vue/test-utils` mount 组件 + 断言 DOM 结构/class/事件。此为 P6 verifier 的验收策略选择（BDD-07 验证策略在 P1 中已声明"改为代码级验证 + vitest 单元测试"）。P6 BDD 全部 PASS，验收方式合理。

### 4. 未决项清零

| 产出文件 | [NEED_CONFIRM] | [BLOCKER] | [DEVIATION-CRITICAL] | [NO_NEED_CONFIRM] |
|----------|----------------|-----------|---------------------|-------------------|
| P1-requirements.md | 0 | 0 | 0 | ✓ (L157) |
| P2-design.md | 0 | 0 | 0 | — |
| P4-implementation.md | 0 | 0 | 0 | — |
| P6-acceptance.md | 0 | 0 | 0 | ✓ (L68) |

全阶段产出文件无残留未决项。

### 5. P6 BDD 二值规则

P6 验收结果中每条 BDD 仅使用 PASS 标记（17/17 PASS，0 FAIL），无"调整/跳过/覆盖"等中间态。符合二值规则。

## 双向一致性检查

### 方向 1：设计→实现

逐项对照 P2 设计，所有设计目标已在实现中落地。唯一偏差为 AuthButton 的 `mobileOverride` prop（DESIGN_GAP #1），已 REVIEWED 为合理偏离。无 [BLOCKER]。

### 方向 2：实现→设计

检查 P2 设计文档中是否有不再适用的要求：

- P2 §AuthButton "三个页面统一使用 matchMedia" — 部分不再适用（EntryDetailHeader 改用 mobileOverride），但 LandingView/EntryListView 仍用 matchMedia。此为 DESIGN_GAP #1 的反向映射，已配对。[DEVIATION]（非核心，不阻塞）
- 无僵尸需求（已否决方案的 AC 残留）
- 无已废弃约束
- 实现未超出设计范围（无 [EXTENSION]）

## 结论

- DESIGN_GAP 配对：6/6 已 REVIEWED
- SCOPE+ 闭环：1 条 [SCOPE_RESOLVED]，已验证贯穿 P1→P2→P4→P6
- 跨文件一致性：P1 BDD 17 = P6 PASS 17，P2 packages = P1 packages，P4 实现 = P2 设计
- 未决项清零：无残留 [NEED_CONFIRM]/[BLOCKER]/[DEVIATION-CRITICAL]
- P6 BDD 二值规则：符合
- 无 [BLOCKER]
- 无 [DEVIATION-CRITICAL]

[NO_NEED_CONFIRM]

P7 一致性检查通过，可推进至 P8。
