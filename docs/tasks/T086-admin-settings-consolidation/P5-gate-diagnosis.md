---
phase: P5
task_id: T086-admin-settings-consolidation
type: gate-diagnosis
trace_id: T086-P5-20260807
created: 2026-08-07
---

# P5 gate 诊断 — E2E 真失败，回退 P4

## 现象

`E2E_SPEC=e2e/admin.spec.ts make debug-test` exit 2：2 个真失败（非 flaky，各重试 2 次仍败）+ 10 个因 serial 级联被跳过。单测（1228 passed）和 typecheck（0 错误）均通过，只有 E2E 未过。

## 根因（verifier 已代码核查确认，主 Agent 复核同意）

`frontend-v3/src/router.ts` 路由注册顺序：

```
32:  { path: '/:slug', name: 'detail', component: EntryDetailView, ... }
38:  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView }
```

`/admin` 是单段路径，会被排在前面的 `/:slug`（详情页路由）捕获，当作 `slug="admin"` 走 `EntryDetailView`——**永远不会落到** `/:pathMatch(.*)*` 这条真正的 404 路由。`EntryDetailView.vue` 收到后端 404（entry not found）后，渲染的是条目详情页的错误态（无 `.not-found` class），不是 `NotFoundView.vue` 的真正 404 页。

**这是 P2 设计阶段的一个错误假设**：P2-design.md §3.1（第 87 行）写"删除后 `/admin` 落到 catch-all `path: '/:pathMatch(.*)*'` → `NotFoundView.vue`，天然满足 BDD-8/9/10"——这个假设没有考虑到 `/:slug` 路由排在 catch-all 之前、且会拦截任何单段路径。P4 implementer 也未在实现时发现这个路由匹配顺序问题（P2 files_to_read 清单也没有把这个交叉点标出来）。P4-review.md（design-review）的检查范围是视觉/交互，不覆盖路由匹配逻辑，所以这一轮评审也没有捕获到。

## 影响的 BDD

- **T086 BDD-9**（非 admin 访问 /admin 返回 404，不重定向）—— 直接失败（legacy 编号 BDD-14）
- **T086 BDD-10**（未登录访问 /admin 返回 404）—— 因 serial 级联未执行，但同根因，判定同样会失败
- **T086 BDD-8**（admin 访问 /admin 返回 404）—— 因 serial 级联未执行，同根因
- BDD-7/11/12 因级联跳过未执行，但与 `/admin` 路由无关，大概率不受此根因影响，仍需在重跑时补充验证

## 处置

回退 P4，修复方向：在路由表中为 `/admin` 显式注册一条指向 `NotFoundView` 的路由，插入在 `/:slug` **之前**（或至少在其之前生效），使 `/admin` 不被 `/:slug` 捕获，直接落到真正的 404 页面。这是最小改动，且完全符合 P2 §3.1 的原始设计意图（只是修正了"catch-all 天然生效"这个错误假设的实现方式）。

不需要改动 `EntryDetailView.vue` 的错误处理逻辑（那是更大范围的重构，超出本任务范围，也不是 P1 BDD 要求的行为）。

修复后需在 P5 **全量重跑** `E2E_SPEC=e2e/admin.spec.ts make debug-test`（覆盖被级联跳过的全部 10 条，不能只测修复的那一条，T027 教训）。
