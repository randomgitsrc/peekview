# P5 Progress Log (T086)

trace_id: T086-P5-20260807
agent: verifier

START make test-frontend
## [2026-08-07T10:06Z] make test-frontend
- exit code: 0
- Test Files: 94 passed (94)
- Tests: 1228 passed | 4 skipped (1232)
- 结论: PASS，全绿

## [$(date -u +%Y-%m-%dT%H:%M:%SZ)] make debug-start + make debug-seed
- debug backend health: 200
- seed: OK, 20 entries seeded, users alice/bob/carol/dave (dave disabled)
- 结论: 环境就绪，开始 E2E

## E2E_SPEC=e2e/admin.spec.ts make debug-test
- exit code: 2 (FAIL)
- 汇总: 22 passed, 2 failed, 2 flaky, 10 did not run (共 36)
- 真失败: BDD-14 (非 admin bob 访问 /admin 应 404) — chromium + Mobile Chrome 两个 project 均失败，各重试 2 次仍失败（非 flaky）
- 根因（已代码核查确认）: router.ts 中 `/:slug`（EntryDetailView，第 32-37 行）注册在 `/:pathMatch(.*)*`（NotFoundView，第 38-42 行）之前。/admin 被 `/:slug` 捕获，当作 slug="admin" 的 entry 详情页处理，而非落到真正的 404 页面。API 端确认 GET /api/v1/entries/admin 返回 404 JSON（{"error":{"code":"NOT_FOUND",...}}），说明后端行为正确，但前端 EntryDetailView 对该 404 的渲染没有 .not-found class，测试的 waitForSelector('.not-found') 超时
- 因 test.describe.configure({mode:'serial'})，BDD-14 失败后同 project 内后续用例（BDD-15/BDD-08/BDD-07/BDD-11/BDD-12）级联跳过 = "did not run" 的 10 条（2 projects × 5 tests）。test-results/ 目录佐证：仅 bf30b (BDD-14) 命中的截图/trace 存在，BDD-15/BDD-08 无产出目录，确认它们从未执行
- 结论: 真 bug，非环境/flaky 问题，需回 P4 修复（EntryDetailView 对 404 entry 应展示等效于 not-found 的状态，或路由层面调整 /:slug 与 catch-all 顺序/exclusion）

## make typecheck
- exit code: 0
- vue-tsc --noEmit: 0 错误

## make debug-stop
- 服务已停止 (PID 1309411)，/tmp/peekview-debug/ 已清理
- 生产库核查: SELECT COUNT(*) FROM entries = 41（与 E2E 运行前快照一致，未变化）
- [PROD_NOT_TOUCHED]

## 产出文件已写
- P5-test-results/unit.md
- P5-test-results/fail-list.txt
- P5-test-results/e2e.md

## 总体结论
- unit: PASS (94 files / 1228 passed / 0 failed)
- typecheck: PASS (0 错误)
- E2E: FAIL (exit 2, 2 failed + 10 did not run，根因已定位为 router.ts /:slug 与 /:pathMatch(.*)* 顺序问题，导致 /admin 未落到真 404 页面) — 判定真 bug，需回 P4 修复，不可推进 P6
