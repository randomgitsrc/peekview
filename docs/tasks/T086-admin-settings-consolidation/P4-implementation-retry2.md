---
phase: P4
task_id: T086-admin-settings-consolidation
type: implementation
parent: P5-gate-diagnosis.md
trace_id: T086-P4-20260807-retry2
status: draft
created: 2026-08-07
agent: implementer
---

# P4 实现记录 — 重试 #2（P5 回退修复）

## 改了什么

`frontend-v3/src/router.ts`：在 `/:slug`（详情页路由，第 32 行起）之前插入一条显式路由：

```ts
{
  path: '/admin',
  name: 'admin-not-found',
  component: () => import('./views/NotFoundView.vue'),
},
```

name 用 `admin-not-found`（非 `not-found`），避免与 catch-all 路由（`path: '/:pathMatch(.*)*'`, `name: 'not-found'`）重名导致 vue-router 报 duplicate name 警告/错误。

未改动其他任何源码文件（`EntryDetailView.vue` 等均未动）。

## 为什么

P5 gate 诊断（`P5-gate-diagnosis.md`）确认根因：`/:slug` 路由排在 catch-all `/:pathMatch(.*)*` 之前，vue-router 按数组声明顺序匹配，导致 `/admin` 被 `/:slug` 当作 entry slug 拦截，走 `EntryDetailView`（渲染条目详情页的错误态，无 `.not-found` class），而非落到真正的 `NotFoundView.vue`（BDD-8/9/10 要求）。

修复方式：为 `/admin` 单独注册一条指向 `NotFoundView` 的路由，插在 `/:slug` 之前，使其在 `/:slug` 匹配之前先被这条路由捕获，直接落到真正的 404 页面。这是最小改动，符合 P2 §3.1 的原始设计意图。

## 验证结果

- `cd frontend-v3 && npx vue-tsc --noEmit`：0 错误
- `cd frontend-v3 && npx vitest run src/__tests__/t080-admin-route-guard.test.ts`：7 passed，3 skipped（与修复前一致，无回归）
- `make build-frontend`：构建成功，382 个静态文件复制到 `backend/peekview/static/`
- `git diff frontend-v3/src/router.ts`：确认仅新增上述一条路由记录，未改动其他逻辑
- `git status`：源码层面仅 `frontend-v3/src/router.ts` 被修改（`backend/peekview/static/index.html` 的变化来自 `make build-frontend` 的构建产物同步，符合预期）
