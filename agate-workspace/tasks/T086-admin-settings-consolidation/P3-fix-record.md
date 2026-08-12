---
phase: P3
task_id: T086-admin-settings-consolidation
type: test-cases
parent: PAUSED-resolution.md
trace_id: T086-P3-20260807-fix
status: draft
created: 2026-08-07
agent: test-designer
---

# P3 定向修复记录 — admin.spec.ts:276 选择器 strict-mode violation

## 改了什么

`frontend-v3/e2e/admin.spec.ts` 第 276 行（T086 BDD-11 用例内）：

```diff
-    await expect(page.locator('[data-testid="user-manager-content"]')).toBeVisible({ timeout: 10000 })
+    await expect(page.locator('.desktop-only [data-testid="user-manager-content"]')).toBeVisible({ timeout: 10000 })
```

## 为什么

`SettingsView.vue` 桌面/移动双渲染，`[data-testid="user-manager-content"]` 在 DOM 中同时存在两份（`.desktop-only` 和 `.mobile-only` 容器各一份），导致 Playwright strict-mode 因命中 2 个节点而报错。BDD-11 用例在第 270 行已显式 `setViewportSize({ width: 1280, height: 800 })` 固定跑桌面视口，不经过 `scopeOf(vp.name)` 循环，因此直接加 `.desktop-only` 字面量前缀消歧即可，不需要引入 `scopeOf()` helper。

按 `PAUSED-resolution.md` 记录的人工批准决策 + `P3-dispatch-context-test-designer-fix.md` 的更精确澄清（BDD-12 已核查不查询 `user-manager-content`，无选择器缺陷，之前只是同 describe 内因 BDD-11 失败被 serial 级联跳过），本次只改这一行，不改 BDD-12，不改任何产品代码，不重新走 TDD 红灯流程（已通过验收设计后暴露的测试代码缺陷订正，验收语义不变）。

## 验证结果

- `npx playwright test --list e2e/admin.spec.ts`：解析成功，列出 36 个测试用例，无语法错误
- `git diff -- frontend-v3/e2e/admin.spec.ts`：仅第 276 行一处改动，其余无变化
