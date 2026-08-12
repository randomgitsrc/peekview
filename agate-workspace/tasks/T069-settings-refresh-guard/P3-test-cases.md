---
phase: P3
task_id: T069
type: test-cases
parent: P2-design.md
trace_id: T069-P3-20260726
status: draft
created: 2026-07-26
agent: test-designer
---

test_code_dir: docs/tasks/T069-settings-refresh-guard/P3-test-code

## 测试文件清单

| 文件 | 类型 | 位置 |
|------|------|------|
| auth-guard.test.ts | vitest 单测 | `frontend-v3/src/__tests__/t069-auth-guard.test.ts` |
| ui-structure.test.ts | vitest 单测 | `frontend-v3/src/__tests__/t069-ui-structure.test.ts` |
| t069-settings-refresh-guard.e2e.spec.ts | Playwright E2E | `frontend-v3/e2e/t069-settings-refresh-guard.e2e.spec.ts` |

## BDD→测试用例映射

### Auth Guard 修复

| BDD | 测试用例 | 类型 | 文件 | 红灯状态 |
|-----|----------|------|------|----------|
| BDD-1 | test_bdd_1: authState loading→authenticated, /settings 不重定向 | vitest | auth-guard.test.ts | GREEN（模式验证） |
| BDD-2 | test_bdd_2: authState loading→anonymous, /settings 重定向到 / | vitest | auth-guard.test.ts | GREEN（模式验证） |
| BDD-3 | test_bdd_3: initializing=false + authenticated, SPA 导航正常 | vitest | auth-guard.test.ts | GREEN（模式验证） |
| BDD-4 | test_bdd_4: authState loading→authenticated, / 重定向到 /explore | vitest | auth-guard.test.ts | GREEN（模式验证） |
| BDD-5 | test_bdd_5: authState loading→anonymous, / 停留 | vitest | auth-guard.test.ts | GREEN（模式验证） |
| BDD-6 | test_bdd_6: 超时后 guard 仍完成判定 | vitest | auth-guard.test.ts | GREEN（模式验证） |
| BDD-1 | BDD-1-E2E: 已登录刷新 /settings 不重定向 | E2E desktop | e2e spec | RED（需 debug backend） |
| BDD-2 | BDD-2-E2E: 未登录刷新 /settings 重定向 | E2E desktop | e2e spec | RED（需 debug backend） |
| BDD-3 | BDD-3-E2E: SPA 导航 /settings 正常 | E2E desktop | e2e spec | RED（需 debug backend） |
| BDD-4 | BDD-4-E2E: 已登录刷新 / 重定向到 /explore | E2E desktop | e2e spec | RED（需 debug backend） |
| BDD-5 | BDD-5-E2E: 未登录刷新 / 停留 | E2E desktop | e2e spec | RED（需 debug backend） |
| BDD-6 | BDD-6-E2E: guard 不挂起 | E2E desktop | e2e spec | RED（需 debug backend） |

### 桌面端 Header 品牌与标题分离

| BDD | 测试用例 | 类型 | 文件 | 红灯状态 |
|-----|----------|------|------|----------|
| BDD-7 | test_bdd_7: .detail-logo-word 使用 --c-text-tertiary | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-7 | BDD-7-E2E: 品牌文字颜色与标题可区分 | E2E desktop | e2e spec | RED |
| BDD-8 | test_bdd_8: .brand-sep 元素存在 | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-8 | BDD-8-E2E: 品牌文字与标题间有竖线分隔符 | E2E desktop | e2e spec | RED |
| BDD-9 | test_bdd_9: hover 时品牌文字变 accent 色 | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-9 | BDD-9-E2E: hover 品牌文字变色 | E2E desktop | e2e spec | RED |

### 桌面端 Files Toggle Badge

| BDD | 测试用例 | 类型 | 文件 | 红灯状态 |
|-----|----------|------|------|----------|
| BDD-10 | test_bdd_10: toggle-btn 含 .toggle-badge 显示文件数 | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-10 | BDD-10-E2E: 多文件 entry Files toggle 显示 badge | E2E desktop | e2e spec | RED |
| BDD-11 | test_bdd_11: isMultiFile=false 隐藏 Files toggle | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-11 | BDD-11-E2E: 单文件 entry 不显示 Files toggle | E2E desktop | e2e spec | RED |

### FileTree 面板头部

| BDD | 测试用例 | 类型 | 文件 | 红灯状态 |
|-----|----------|------|------|----------|
| BDD-12 | test_bdd_12: FileTree fileCount prop 渲染 "FILES · 3" | vitest | ui-structure.test.ts | **RED** |
| BDD-12 | test_bdd_12_no_prop: 无 fileCount 渲染 "Files" | vitest | ui-structure.test.ts | GREEN |
| BDD-12 | BDD-12-E2E: FileTree 面板头部显示文件数 | E2E desktop | e2e spec | RED |

### 移动端 Sticky Header

| BDD | 测试用例 | 类型 | 文件 | 红灯状态 |
|-----|----------|------|------|----------|
| BDD-13 | test_bdd_13: 无 .back-btn 和 .sticky-brand | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-13 | BDD-13-E2E: 移动端无 ← 箭头和 PeekView 文字 | E2E mobile | e2e spec | RED |
| BDD-14 | test_bdd_14: .sticky-title 两行 clamp | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-14 | BDD-14-E2E: 标题最多两行 | E2E mobile | e2e spec | RED |
| BDD-15 | test_bdd_15: logo icon 是 router-link to="/" | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-15 | BDD-15-E2E: logo icon 点击回首页 | E2E mobile | e2e spec | RED |
| BDD-16 | test_bdd_16: .mobile-signin-link 替代 .mobile-signin-btn | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-16 | BDD-16-E2E: Sign in 为文本链接 | E2E mobile | e2e spec | RED |

### 移动端 Bottom Bar

| BDD | 测试用例 | 类型 | 文件 | 红灯状态 |
|-----|----------|------|------|----------|
| BDD-17 | test_bdd_17: Files 按钮用 toggle-btn + badge | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-17 | BDD-17-E2E: Files toggle-btn 风格 + badge | E2E mobile | e2e spec | RED |
| BDD-18 | test_bdd_18: TOC 按钮用 toggle-btn | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-18 | BDD-18-E2E: TOC toggle-btn 风格 | E2E mobile | e2e spec | RED |
| BDD-19 | test_bdd_19: 无 Explore 按钮 | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-19 | BDD-19-E2E: 无 Explore 按钮 | E2E mobile | e2e spec | RED |
| BDD-20 | test_bdd_20: 无 Share 按钮 | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-20 | BDD-20-E2E: 无 Share 按钮 | E2E mobile | e2e spec | RED |
| BDD-21 | test_bdd_21: Files toggle active 与 drawer 同步 | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-21 | BDD-21-E2E: Files toggle active 同步 | E2E mobile | e2e spec | RED |
| BDD-22 | test_bdd_22: TOC toggle active 与 drawer 同步 | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-22 | BDD-22-E2E: TOC toggle active 同步 | E2E mobile | e2e spec | RED |

### 移动端 Drawer 头部

| BDD | 测试用例 | 类型 | 文件 | 红灯状态 |
|-----|----------|------|------|----------|
| BDD-23 | test_bdd_23: File drawer header "Files · 3" | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-23 | BDD-23-E2E: File drawer 头部显示文件数 | E2E mobile | e2e spec | RED |
| BDD-24 | test_bdd_24: TOC drawer header "Table of Contents · 12" | vitest | ui-structure.test.ts | PLACEHOLDER |
| BDD-24 | BDD-24-E2E: TOC drawer 头部显示标题数 | E2E mobile | e2e spec | RED |

## 红灯说明

- **vitest auth-guard.test.ts**：6 个测试全部 GREEN——这些测试验证 `waitForAuthInit` + async guard 模式的正确性。当前 `router.ts` 尚未实现此模式，测试作为 P4 实现规范。P4 实现后，`router.ts` 的 guard 应与此模式一致。
- **vitest ui-structure.test.ts**：1 个 RED（BDD-12 FileTree fileCount prop），18 个 PLACEHOLDER。PLACEHOLDER 测试在 P4 实现后需替换为真实 DOM 断言。
- **Playwright E2E**：全部 RED——需要 debug backend 运行，且当前 UI 尚未实现改动。

## Playwright viewport 配置

- Desktop: 1280×800
- Mobile: 390×844 (iPhone 14)
- 截图存入 `docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/`

## 截图清单

| BDD | 截图文件 | viewport |
|-----|----------|----------|
| BDD-1 | BDD-1-desktop-settings-refresh.png | desktop |
| BDD-2 | BDD-2-unauth-settings-redirect.png | desktop |
| BDD-3 | BDD-3-spa-nav-settings.png | desktop |
| BDD-4 | BDD-4-auth-root-redirect.png | desktop |
| BDD-5 | BDD-5-unauth-root-stay.png | desktop |
| BDD-6 | BDD-6-guard-no-hang.png | desktop |
| BDD-7 | BDD-7-desktop-brand-color.png | desktop |
| BDD-8 | BDD-8-desktop-brand-sep.png | desktop |
| BDD-9 | BDD-9-desktop-brand-hover.png | desktop |
| BDD-10 | BDD-10-desktop-files-badge.png | desktop |
| BDD-11 | BDD-11-desktop-single-file-no-toggle.png | desktop |
| BDD-12 | BDD-12-filetree-header-count.png | desktop |
| BDD-13 | BDD-13-mobile-no-back-brand.png | mobile |
| BDD-14 | BDD-14-mobile-title-two-lines.png | mobile |
| BDD-15 | BDD-15-mobile-logo-home.png | mobile |
| BDD-16 | BDD-16-mobile-signin-link.png | mobile |
| BDD-17 | BDD-17-mobile-files-toggle-btn.png | mobile |
| BDD-18 | BDD-18-mobile-toc-toggle-btn.png | mobile |
| BDD-19 | BDD-19-mobile-no-explore.png | mobile |
| BDD-20 | BDD-20-mobile-no-share.png | mobile |
| BDD-21 | BDD-21-mobile-files-active-sync.png | mobile |
| BDD-22 | BDD-22-mobile-toc-active-sync.png | mobile |
| BDD-23 | BDD-23-mobile-file-drawer-count.png | mobile |
| BDD-24 | BDD-24-mobile-toc-drawer-count.png | mobile |
