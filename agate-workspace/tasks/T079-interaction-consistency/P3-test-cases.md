---
phase: P3
task_id: T079-interaction-consistency
type: test-cases
parent: P2-design.md
trace_id: T079-P3-20260731
status: draft
created: 2026-07-31
agent: test-designer
---

# P3 Test Cases — T079: 交互一致性修复

## test_code_dir
test_code_dir: frontend-v3/src/components/__tests__/

```
frontend-v3/src/components/__tests__/AuthButton.spec.ts
frontend-v3/src/components/__tests__/UserMenu.spec.ts
frontend-v3/src/components/__tests__/T079-entry-detail-header.spec.ts
frontend-v3/e2e/t079-auth-consistency.spec.ts
```

## 环境隔离

[PROD_NOT_TOUCHED]

## 测试框架

- 单元测试：vitest + jsdom + @vue/test-utils
- E2E 测试：Playwright（CDP 模式，debug backend :8888）
- 基线：1078 passed + 1 skipped

## 红灯验证

全量运行 `npx vitest run --reporter=dot`：

- 3 个新测试文件，19 个测试红灯
- 零回归（原有 1078 passed + 1 skipped 不受影响）
- AuthButton.spec.ts / UserMenu.spec.ts：import 失败（B类红灯——组件尚未创建）
- T079-entry-detail-header.spec.ts：断言失败（B类红灯——当前实现不符合 BDD 预期）
- 3 个 incidental pass：空 tags 数组边界条件（当前实现恰好通过，不影响红灯判定）

## BDD → 测试用例映射

### 登录按钮一致性（BDD-01 ~ BDD-06）

| BDD | 测试文件 | 测试名 | 预期红灯原因 |
|-----|---------|--------|-------------|
| BDD-01 | AuthButton.spec.ts | `BDD-01: marketing pageType renders primary variant "Sign in"` | AuthButton.vue 不存在 |
| BDD-01 | AuthButton.spec.ts | `BDD-01: marketing pageType renders primary even on mobile` | AuthButton.vue 不存在 |
| BDD-02 | AuthButton.spec.ts | `BDD-02: functional pageType desktop renders secondary variant` | AuthButton.vue 不存在 |
| BDD-03 | AuthButton.spec.ts | `BDD-03: functional pageType tablet renders secondary variant` | AuthButton.vue 不存在 |
| BDD-04 | AuthButton.spec.ts | `BDD-04: functional pageType mobile renders ghost variant` | AuthButton.vue 不存在 |
| BDD-05 | AuthButton.spec.ts | `BDD-05: functional pageType desktop renders secondary (for Detail page)` | AuthButton.vue 不存在 |
| BDD-05 | T079-entry-detail-header.spec.ts | `desktop header has AuthButton with secondary variant` | 当前 BaseButton variant=primary |
| BDD-05 | T079-entry-detail-header.spec.ts | `desktop header does NOT use primary variant for sign-in` | 当前用 primary |
| BDD-06 | AuthButton.spec.ts | `BDD-06: functional pageType mobile renders ghost (for Detail page)` | AuthButton.vue 不存在 |
| BDD-06 | T079-entry-detail-header.spec.ts | `mobile header has AuthButton with ghost variant` | 当前用 `<a>` 纯文本链接 |
| BDD-06 | T079-entry-detail-header.spec.ts | `mobile header does not use plain text link for sign-in` | `.mobile-signin-link` 存在 |
| BDD-01 | t079-auth-consistency.spec.ts | `BDD-01: Landing anonymous shows primary "Sign in" button` | E2E（P6 验收） |
| BDD-02 | t079-auth-consistency.spec.ts | `BDD-02: Explore anonymous desktop shows secondary "Sign in" button` | E2E |
| BDD-03 | t079-auth-consistency.spec.ts | `BDD-03: Explore anonymous tablet shows secondary "Sign in" button` | E2E |
| BDD-04 | t079-auth-consistency.spec.ts | `BDD-04: Explore anonymous mobile shows ghost "Sign in" button` | E2E |
| BDD-05 | t079-auth-consistency.spec.ts | `BDD-05: Detail anonymous desktop shows secondary "Sign in" button` | E2E |
| BDD-06 | t079-auth-consistency.spec.ts | `BDD-06: Detail anonymous mobile shows ghost "Sign in" button` | E2E |

### 用户菜单一致性（BDD-07 ~ BDD-12）

| BDD | 测试文件 | 测试名 | 预期红灯原因 |
|-----|---------|--------|-------------|
| BDD-07 | UserMenu.spec.ts | `BDD-07: renders user menu trigger for authenticated user` | UserMenu.vue 不存在 |
| BDD-07 | UserMenu.spec.ts | `BDD-07: dropdown contains Settings and Logout after clicking trigger` | UserMenu.vue 不存在 |
| BDD-08 | UserMenu.spec.ts | `BDD-08: Explore page renders same Settings + Logout menu` | UserMenu.vue 不存在 |
| BDD-09 | UserMenu.spec.ts | `BDD-09: Detail desktop renders user menu with Settings + Logout` | UserMenu.vue 不存在 |
| BDD-09 | T079-entry-detail-header.spec.ts | `desktop header shows UserMenu trigger when authenticated` | 无 UserMenu 组件 |
| BDD-09 | T079-entry-detail-header.spec.ts | `desktop header does not show AuthButton when authenticated` | 当前匿名按钮仍显示 |
| BDD-09 | T079-entry-detail-header.spec.ts | `desktop user menu opens to show Settings + Logout` | 无 UserMenu |
| BDD-10 | UserMenu.spec.ts | `BDD-10: Detail mobile renders user menu with Settings + Logout` | UserMenu.vue 不存在 |
| BDD-10 | T079-entry-detail-header.spec.ts | `mobile header shows UserMenu trigger when authenticated` | 无 UserMenu |
| BDD-10 | T079-entry-detail-header.spec.ts | `mobile user menu opens to show Settings + Logout` | 无 UserMenu |
| BDD-11 | UserMenu.spec.ts | `BDD-11: admin user shows admin badge in trigger` | UserMenu.vue 不存在 |
| BDD-11 | UserMenu.spec.ts | `BDD-11: non-admin user does not show admin badge` | UserMenu.vue 不存在 |
| BDD-11 | T079-entry-detail-header.spec.ts | `admin user shows admin badge in detail header trigger` | 无 UserMenu |
| BDD-12 | UserMenu.spec.ts | `BDD-12: menu items are consistent (Settings + Logout only)` | UserMenu.vue 不存在 |
| BDD-12 | UserMenu.spec.ts | `BDD-12: admin user menu still has same items (Settings + Logout)` | UserMenu.vue 不存在 |
| BDD-08 | t079-auth-consistency.spec.ts | `BDD-08: Explore authenticated shows Settings + Logout menu` | E2E |
| BDD-09 | t079-auth-consistency.spec.ts | `BDD-09: Detail desktop authenticated shows user menu` | E2E |
| BDD-10 | t079-auth-consistency.spec.ts | `BDD-10: Detail mobile authenticated shows user menu` | E2E |
| BDD-11 | t079-auth-consistency.spec.ts | `BDD-11: admin user shows admin badge` | E2E |
| BDD-12 | t079-auth-consistency.spec.ts | `BDD-12: menu items consistent across pages` | E2E |

### Explore 按钮移除（BDD-13）

| BDD | 测试文件 | 测试名 | 预期红灯原因 |
|-----|---------|--------|-------------|
| BDD-13 | T079-entry-detail-header.spec.ts | `desktop header actions-area does not contain Explore router-link` | 当前有 Explore router-link |
| BDD-13 | T079-entry-detail-header.spec.ts | `desktop header does not contain CompassIcon` | 当前有 CompassIcon |
| BDD-13 | t079-auth-consistency.spec.ts | `BDD-13: Detail desktop has no Explore button` | E2E |

### Detail 页 tag 可点击（BDD-14 ~ BDD-16）

| BDD | 测试文件 | 测试名 | 预期红灯原因 |
|-----|---------|--------|-------------|
| BDD-14 | T079-entry-detail-header.spec.ts | `meta-row tags use BaseTag not span.meta-tag` | 当前用 span.meta-tag |
| BDD-14 | T079-entry-detail-header.spec.ts | `meta-row BaseTag href points to /explore?tags=<encoded>` | 无 BaseTag |
| BDD-14 | T079-entry-detail-header.spec.ts | `clicking a tag emits navigate event` | 无 BaseTag |
| BDD-15 | T079-entry-detail-header.spec.ts | `meta-tags-bar tags use BaseTag not span.meta-tag` | 当前用 span.meta-tag |
| BDD-15 | T079-entry-detail-header.spec.ts | `meta-tags-bar BaseTag href points to /explore?tags=<encoded>` | 无 BaseTag |
| BDD-16 | T079-entry-detail-header.spec.ts | `Chinese tag href is URL-encoded` | 无 BaseTag |
| BDD-16 | T079-entry-detail-header.spec.ts | `Chinese tag displays correct text` | 无 BaseTag |
| BDD-14 | t079-auth-consistency.spec.ts | `BDD-14: Detail desktop tag clicks navigate to /explore?tags=<tag>` | E2E |
| BDD-15 | t079-auth-consistency.spec.ts | `BDD-15: Detail mobile tag clicks navigate to /explore?tags=<tag>` | E2E |

### Settings 导航（BDD-17）

| BDD | 测试文件 | 测试名 | 预期红灯原因 |
|-----|---------|--------|-------------|
| BDD-17 | UserMenu.spec.ts | `BDD-17: clicking Settings navigates to /settings?tab=apikeys` | UserMenu.vue 不存在 |
| BDD-17 | t079-auth-consistency.spec.ts | `BDD-17: clicking Settings navigates to settings page` | E2E |

## 红灯分类

| 类型 | 数量 | 说明 |
|------|------|------|
| B类（import 失败） | 24 | AuthButton.vue / UserMenu.vue 尚未创建 |
| B类（断言失败） | 19 | EntryDetailHeader 当前实现不符合 BDD |
| incidental pass | 3 | 空数组边界条件，当前实现恰好通过 |
| A类（测试自身错误） | 0 | 无 |
| 绿灯（实现先于测试） | 0 | 无 |

## E2E Playwright 用例

P2 声明 `ui_affected: true`，每个交互点都有对应 E2E 用例：

| 交互点 | E2E 测试名 |
|--------|-----------|
| Landing 匿名态 primary "Sign in" | BDD-01 |
| Explore 匿名态桌面 secondary "Sign in" | BDD-02 |
| Explore 匿名态平板 secondary "Sign in" | BDD-03 |
| Explore 匿名态移动 ghost "Sign in" | BDD-04 |
| Detail 匿名态桌面 secondary "Sign in" | BDD-05 |
| Detail 匿名态移动 ghost "Sign in" | BDD-06 |
| Explore 认证态 UserMenu | BDD-08 |
| Detail 桌面认证态 UserMenu | BDD-09 |
| Detail 移动认证态 UserMenu | BDD-10 |
| admin badge | BDD-11 |
| 菜单一致性 | BDD-12 |
| 无 Explore 按钮 | BDD-13 |
| tag 点击跳转 | BDD-14, BDD-15 |
| Settings 导航 | BDD-17 |

E2E 文件：`frontend-v3/e2e/t079-auth-consistency.spec.ts`
gate_commands.P5_e2e: `E2E_SPEC=e2e/t079-auth-consistency.spec.ts make debug-test`

## BDD-07 特殊说明

BDD-07 验证策略（P1 §3）：Playwright 无法可靠验证 Landing redirect 前的瞬时窗口，改为：
1. vitest 单测：mock authState=authenticated，断言 UserMenu 组件渲染
2. 代码级验证：确认 LandingView 模板中包含 UserMenu 组件引用

vitest 单测在 UserMenu.spec.ts 中覆盖。LandingView 的 UserMenu 集成在 P4 实现后由 P5/P6 验证。
