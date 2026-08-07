---
phase: P5
task_id: T086-admin-settings-consolidation
type: test-results
parent: P4-implementation-retry2.md
trace_id: T086-P5-20260807-retry1
status: draft
created: 2026-08-07
agent: verifier
---

# P5 单元测试结果 — T086（重试 #1，全量重跑）

## 命令

`make test-frontend`（全量前端单测，非本任务子集，非 watch 模式）

## 结果

exit code: 0

```
Test Files  94 passed (94)
     Tests  1228 passed | 4 skipped (1232)
  Start at  10:20:16
  Duration  21.89s (transform 19.57s, setup 21ms, collect 62.52s, tests 36.94s, environment 155.00s, prepare 17.34s)
```

test runner 输出签名（可 grep）：
```
passed: 1228
failed: 0
```

- failed: 0
- passed: 1228
- skipped: 4（预存跳过项，非本任务引入，未新增，与上一轮一致）
- Test Files: 94 passed (94)

## typecheck

`make typecheck` → exit code 0

```
→ Running vue-tsc type check (~30-60s)...
  ✓ type check passed
```

## 预存失败

无。全量测试套件全绿，未发现预存失败，无需登记 known-failures.md。与上一轮结果一致（router.ts 修复未影响单测/typecheck）。

## stderr 噪音说明（非失败）

与上一轮相同，以下 stderr 输出为测试内故意触发的错误分支断言，均属预期行为，对应用例已 PASS，非失败信号：
- `PlantUmlRenderer.spec.ts` / `MermaidRenderer.spec.ts`：故意触发 renderError 分支
- `svg-pan-zoom init failed: TypeError: svgPanZoom is not a function`：测试环境 mock 限制，非本任务相关
- `t031-landing-view.spec.ts`：`[Vue warn]: injection "Symbol(router)" not found`，预存 vue-test-utils mount 警告，用例仍 PASS

## 全量测试确认

已运行全量测试套件（非本任务改动文件子集），94 个测试文件全部执行。

## 结论

unit + typecheck 门槛全部达标：exit 0 + failed=0。**router.ts 修复（P4-retry2）未在单测层面引入回归**。但 E2E 全量重跑发现一个新的真失败（BDD-11，与路由修复无关，见 e2e.md），需回 P4。
