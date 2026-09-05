---
phase: P0
task_id: TPV0096
task_name: e2e-fixture-selfcontained
trace_id: TPV0096
created: 2026-09-05
status: pending
parent: agate-workspace/debt/tech-debt.md（DEBT0010，source: retrospective）
---

# P0-brief — TPV0096 E2E 红灯 spec 自建 entry 化（DEBT0010）

## task

三个渲染类 E2E spec 依赖的 seed entry 已消失（404），长期红灯掩盖真回归：`mermaid.spec.ts`（依赖 `test-mermaid-2`）、`mermaid-check.spec.ts`（`playwright-test`）、`mermaid-visual.spec.ts`（`e2e-test`）。改为**自建 entry**（测试内 API createEntry + afterEach 清理队列），使三个 spec 在干净 debug 环境全绿且可重复跑。

## 需求来源

DEBT0010（tech-debt.md，source: retrospective，2026-09-05）：回归排查裸 SVG 修复时经 stash 基线对照定性——这批失败与代码改动无关，是"spec 依赖手动建在 debug DB、从未入库的 entry"（git 历史无 fixture 删除记录），`make debug-stop` 清库后 entry 永久消失。

## 已实证事实（P0 阶段完成，P1 直接引用）

- 失败形态：`Page not found`——entry 404，非渲染回归（TPV0096 排查记录见 git 7710b836 commit message）
- 修复前基线失败集合与修复后完全一致（t084 两态同 7 failed；render-regression 仅 bdd_4↔5 flaky 互换）
- 自建模式现成：`render-regression.spec.ts:39` `createEntry(request, slug, summary, files)` + afterEach 清理队列（`teams-page.spec.ts` 同模式）
- 环境自检 5 项全 PASS（2026-09-05，本会话）
- 现行 seed-data/ 共 24 entry，无 test-mermaid-2/playwright-test/e2e-test

## 验收基线（BDD 倾向，P1 细化）

1. Given 干净 debug 环境（debug-start + debug-seed）When 跑 3 spec（chromium+Mobile）Then 全绿
2. When 连续重跑 2 次 Then 结果稳定且 debug DB 无残留 entry（afterEach 清理验证）
3. Then 其余渲染 spec（svg-inline-render/render-regression 的 SVG 用例）不回归
4. Then E2E 编写规范落点完成：project.md 加「spec 依赖 entry 必须存在（seed）或自建（清理）」

## 改动清单（预估）

- `frontend-v3/e2e/mermaid.spec.ts` / `mermaid-check.spec.ts` / `mermaid-visual.spec.ts`：beforeEach 手动 entry → beforeEach/first-test 自建 + afterEach 清理
- `docs/` 或 project.md：E2E 编写规范一条
- 不改产品代码；不 bump 版本

## 已知风险

- 旧 spec 断言强度未知：mermaid-visual 疑似视觉/尺寸断言（需 P1 实读确认；若含像素级对比，降级为存在性+尺寸断言）
- mermaid 渲染时序（beforeEach 现有 waitForTimeout 3000）——本 task 不做硬等待清理（TPV0097 范围），仅保证 fixture 稳定

## 裁剪倾向

- P2：follows_existing_pattern（render-regression 模式）→ 1 候选方案简化
- P3：保留（被测对象即测试自身，红灯→绿灯即 TDD 闭环）
- P6：不可裁——实跑 3 spec + DB 无残留 + 稳定性重跑证据
- P8：无需 bump（纯测试改动，走 CHANGELOG [Unreleased] 记录）
