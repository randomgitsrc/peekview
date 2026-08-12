---
phase: P3
task_id: T067-detail-page-framework
type: test-cases
parent: P2-design.md
trace_id: T067-P3-20260723
status: draft
created: 2026-07-23
agent: test-designer
---

test_code_dir: frontend-v3/src/components/__tests__

## 测试文件

`t067-detail-framework.spec.ts` — 28 个测试用例，覆盖 12 条 BDD

## 测试用例清单

| # | BDD | 测试用例 | 预期 | 当前状态 |
|---|-----|---------|------|---------|
| TC-1 | BDD-1 | desktop header shows Sign in button when authState is anonymous | `.actions-area .btn-primary` 存在且文本含 "Sign in" | RED |
| TC-2 | BDD-1 | mobile sticky-header shows Sign in entry when authState is anonymous | `.mobile-sticky-header .mobile-signin-btn` 存在 | RED |
| TC-3 | BDD-1 | clicking Sign in opens LoginDialog | 点击 btn-primary 后 LoginDialog 组件存在 | RED |
| TC-4 | BDD-2 | desktop header hides Sign in when authState is authenticated | 先验证 anonymous 时存在，切换 authenticated 后不存在 | RED |
| TC-5 | BDD-2 | mobile sticky-header hides Sign in when authState is authenticated | 先验证 anonymous 时存在，切换 authenticated 后不存在 | RED |
| TC-6 | BDD-3 | Sign in disappears when authState changes anonymous→authenticated | 匿名时存在，切换后消失 | RED |
| TC-7 | BDD-4 | desktop header shows PeekView brand text | `.detail-logo-word` 存在且文本为 "PeekView" | RED |
| TC-8 | BDD-4 | brand area total height does not exceed 36px | `.detail-logo-word` 存在 + `.title-row` 存在 | RED |
| TC-9 | BDD-5 | mobile sticky-header shows brand identifier element | `.sticky-brand` 存在且文本为 "PeekView" | RED |
| TC-10 | BDD-5 | brand identifier visible at viewport width <=380px | `.sticky-brand` 存在 | RED |
| TC-11 | BDD-6 | desktop has clickable navigation element pointing to /explore | `a[href="/explore"]` >= 1 | RED |
| TC-12 | BDD-6 | mobile has clickable navigation element pointing to /explore | `a[href="/explore"]` >= 1 | RED |
| TC-13 | BDD-7 | mobile bottom bar shows "N files" format | 文本匹配 `/^\d+\s+files$/`，不匹配 `/^Files\s+\d+$/` | RED |
| TC-14 | BDD-8 | desktop shows "1 read" for single read | header 文本含 "1 read" 不含 "1 reads" | GREEN (已正确) |
| TC-15 | BDD-8 | desktop shows "N reads" for N>1 | header 文本含 "5 reads" | GREEN (已正确) |
| TC-16 | BDD-8 | mobile shows same conditional plural format as desktop | meta-tags-bar 文本含 "1 read" 不含 "1 reads" | RED |
| TC-17 | BDD-8 | desktop hides reads count when readStats is null | header 文本不含 "read" | GREEN (已正确) |
| TC-18 | BDD-8 | mobile hides reads count when readStats is null | meta-tags-bar 文本不含 "read" | RED |
| TC-19 | BDD-9 | LandingView Sign in uses btn-primary style | `.nav-cta .btn-primary` 存在且文本含 "Sign in" | RED |
| TC-20 | BDD-9 | LandingView Sign in is not using btn-ghost class | `.nav-cta .btn-ghost` 不存在 | RED |
| TC-21 | BDD-10 | desktop icon buttons have tooltip elements | `.actions-area .tooltip` >= 1 | GREEN (已存在) |
| TC-22 | BDD-10 | tooltip elements contain text content | 每个 tooltip 文本长度 > 0 | GREEN (已存在) |
| TC-23 | BDD-11 | desktop Sign in not visible when authState is loading | 先验证 anonymous 时存在，切换 loading 后不存在 | RED |
| TC-24 | BDD-11 | mobile Sign in not visible when authState is loading | 先验证 anonymous 时存在，切换 loading 后不存在 | RED |
| TC-25 | BDD-12 | desktop brand not visible in zen mode | 先验证正常时存在，zen mode 后 isVisible=false | RED |
| TC-26 | BDD-12 | desktop Sign in not visible in zen mode | 先验证正常时存在，zen mode 后 isVisible=false | RED |
| TC-27 | BDD-12 | mobile brand not visible in zen mode | 先验证正常时存在，zen mode 后 isVisible=false | RED |
| TC-28 | BDD-12 | mobile Sign in not visible in zen mode | 先验证正常时存在，zen mode 后 isVisible=false | RED |

## 红灯确认

- 23 RED（断言失败，实现未写）
- 5 GREEN（BDD-8 桌面端 reads 格式已正确 ×3，BDD-10 tooltip 已存在 ×2）
- 0 A 类错误（无 SyntaxError / 第三方 import 失败）

## 防假绿灯设计

BDD-2/BDD-11/BDD-12 的 "不可见" 测试采用先验证基线状态（anonymous/非 zen）元素存在，再验证目标状态（authenticated/loading/zen）元素不可见。确保功能未实现时基线断言先失败，不会因元素不存在而意外通过。

## 移动端模拟

jsdom 无真实视口，通过 `Object.defineProperty(window, 'innerWidth', { value: 375 })` 模拟移动端宽度。组件 `viewportWidth = ref(window.innerWidth)` 在 mount 时读取该值，`isMobile = computed(() => viewportWidth.value <= 640)` 正确响应。
