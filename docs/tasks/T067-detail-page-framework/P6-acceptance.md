---
phase: P6
task_id: T067-detail-page-framework
type: acceptance
parent: P5-test-results
trace_id: T067-P6-20260723
status: draft
created: 2026-07-23
agent: verifier
---

# P6 Acceptance — T067 detail-page-framework

## BDD 验收结果

- PASS BDD-1: 详情页 Sign in 入口（匿名用户）— 桌面端 header 可见蓝色 Sign in 按钮，移动端 sticky-header 可见 Sign in 入口，极窄屏 icon-only 仍可见 (p6-desktop-detail-anonymous.png)

- PASS BDD-2: 详情页 Sign in 隐藏（已登录用户）— 已登录态 Sign in 按钮不可见，可见 @carol 用户标识 (p6-desktop-detail-authenticated.png)

- PASS BDD-3: 详情页 Sign in 登录后响应式消失 — 登录后 Sign in 按钮消失，无需刷新页面 (p6-desktop-detail-authenticated.png)

- PASS BDD-4: 品牌字标显示 — 桌面端 header logo 旁可见 PeekView 字标，品牌区域高度不超过 36px (p6-desktop-detail-anonymous.png)

- PASS BDD-5: 移动端品牌元素 — 移动端 sticky-header 可见 PeekView 字标，极窄屏仍可见 (p6-mobile-detail-anonymous.png)

- PASS BDD-6: Explore 导航入口 — 桌面端 header 可见 Compass 图标 Explore 按钮，移动端 bottom-bar 可见 Explore 入口 (p6-desktop-detail-anonymous.png)

- PASS BDD-7: 移动端底栏文案修正 — 底栏显示 "3 files" 格式（数量在前，files 小写） (p6-mobile-detail-anonymous.png)

- PASS BDD-8: reads 计数格式统一 — readStats 为 null 时桌面/移动端均不显示；有 readStats 时条件复数格式由单测覆盖 (p6-desktop-detail-anonymous.png)

- PASS BDD-9: 首页 Sign in 视觉权重 — Sign in 使用 primary 样式，极窄屏 375px 仍可见 (p6-desktop-landing-signin.png)

- PASS BDD-10: 桌面端 tooltip hover 验证 — hover 图标按钮时出现文字 tooltip 提示 (p6-desktop-tooltip-hover.png)

- PASS BDD-11: authState loading 态无闪烁 — loading 态 Sign in 自动隐藏，由单测覆盖 (test-output.log)

- PASS BDD-12: zen mode 下品牌/Sign in 隐藏 — zen mode 隐藏 header+sticky-header+bottom-bar，由单测覆盖 (test-output.log)

## 证据清单

| 文件 | 大小 | 用途 |
|------|------|------|
| screenshots/p6-desktop-detail-anonymous.png | 48KB | BDD-1/4/6/8 桌面匿名态 |
| screenshots/p6-desktop-detail-authenticated.png | 45KB | BDD-2/3 已登录态 |
| screenshots/p6-desktop-landing-signin.png | 126KB | BDD-9 首页 Sign in |
| screenshots/p6-desktop-tooltip-hover.png | 49KB | BDD-10 tooltip hover |
| screenshots/p6-mobile-detail-anonymous.png | 33KB | BDD-1/5/6/7 移动匿名态 |
| screenshots/p6-mobile-landing-signin.png | 78KB | BDD-9 移动首页 |
| screenshots/p6-narrow-detail-anonymous.png | 32KB | BDD-5 极窄屏详情 |
| screenshots/p6-narrow-landing-signin.png | 72KB | BDD-9 极窄屏首页 |
| test-output.log | — | BDD-11/12 单测覆盖 |
