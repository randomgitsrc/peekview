---
phase: P0
task_id: T069
task_name: settings-refresh-guard
type: brief
trace_id: T069-P0-20260723
created: 2026-07-23
status: draft
parent: T068-P6-known-limitation
---

## 任务简述

已登录用户全页刷新 /settings（或任何 auth-guarded 路由）时，`router.beforeEach` 在 `fetchMe()` 完成前运行，`authState='loading'` 被当作未认证，导致已登录用户被重定向到 /explore。SPA 内导航正常，仅全页刷新触发。

## 环境约束

- 改动范围：`frontend-v3/src/router.ts` 的 `beforeEach` 守卫逻辑
- 不改后端
- 不改 authStore 的 fetchMe 逻辑（只改守卫的等待策略）

## 已知风险

- 守卫等待 authState 初始化完成期间，页面可能短暂空白（需 loading 指示或延迟渲染）
- 其他 auth-guarded 路由（如有）同样受影响，需一并修复

## 裁剪倾向

- risk=low：单文件改动，逻辑清晰
- phases: [P1, P2, P3, P4, P5, P6, P7, P8] 但 P2/P3 可简化（follows_existing_pattern）
- P6 需 Playwright 验证（ui_affected=true）
