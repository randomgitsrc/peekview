---
phase: P5
task_id: T086-admin-settings-consolidation
type: test-results
parent: P3-fix-record.md
trace_id: T086-P5-20260807-retry2
status: draft
created: 2026-08-07
agent: verifier
---

# P5 E2E 测试结果（Playwright）— T086（重试 #2，PAUSED 恢复后第三轮全量重跑）

## 命令

`E2E_SPEC=e2e/admin.spec.ts make debug-test`

## 环境

- debug backend: `make debug-start` → http://127.0.0.1:8888
- 测试数据: `make debug-seed` → 22 entries loaded from seed-data/（Total entries: 20 + 2 svg），users alice/bob/carol/dave（dave disabled）
- Playwright projects: chromium + Mobile Chrome，2 workers，CDP Chrome (`http://127.0.0.1:18800`)
- e2e-safety-check.sh 前置检查全部通过（运行方式正确 / 调试服务运行中 / 使用独立数据库）
- 生产数据库快照：运行前 `SELECT COUNT(*) FROM entries` = 41，`make debug-stop` 后手工核查仍为 41，未变化

## 前置修复核查

`git diff -- frontend-v3/e2e/admin.spec.ts` 无输出（P3-fix-record.md 的选择器修复已在暂存区/工作区外，属已确认状态，非本轮新改）。核实第 276 行现状：

```
await expect(page.locator('.desktop-only [data-testid="user-manager-content"]')).toBeVisible({ timeout: 10000 })
```

`.desktop-only` 前缀消歧已生效，BDD-12（第 279 行起）未改动。

## 结果（原始输出，全量重跑）

exit code: 0（`=== ✓ 所有 E2E 测试通过 ===`）

test runner 输出签名（可 grep，Playwright line reporter 原始行）：
```
1 flaky
35 passed (31.5s)
```

test runner 输出签名（可 grep 前缀形式）：
```
passed: 35
failed: 0
```

- Running 36 tests using 2 workers（chromium 18 条 + Mobile Chrome 18 条，符合预期约 36 条）
- 35 passed（含 1 条经 retry 后计入 passed 的 flaky 用例，Playwright 汇总口径为 `1 flaky` + `35 passed`，两者合计 36，无独立 failed 计数）
- 0 failed
- 0 did not run（本轮首次无级联跳过——BDD-11 修复后不再阻塞 BDD-12）

## 关键结论：T086 BDD-11 与 BDD-12 本轮均真正执行并通过

| 用例 | retry1（上一轮） | retry2（本轮） |
|------|------|------|
| T086 BDD-11（`admin.spec.ts:269`，admin 通过 UserMenu → Settings 到达 user-manager） | **FAILED**（2 projects，strict-mode violation，选择器命中 2 元素） | **PASSED**（chromium + Mobile Chrome 均通过） |
| T086 BDD-12（`admin.spec.ts:279`，非 admin UserMenu Settings 入口不落到 user-manager tab） | did not run（因 BDD-11 失败被 serial 模式级联跳过，三轮以来从未真正执行过） | **PASSED**（chromium + Mobile Chrome 均通过，三轮以来首次真正执行并通过） |

P3-fix-record.md 记录的 `.desktop-only` 选择器前缀修复已确认生效：BDD-11 的 `[data-testid="user-manager-content"]` 断言不再因桌面/移动双 DOM 渲染而触发 Playwright strict-mode violation。

## 与前两轮全量对照（累计验证矩阵）

| 用例 | 第一轮 | retry1 | retry2（本轮） |
|------|--------|--------|--------|
| BDD-01/02（desktop+mobile viewport） | passed（含 flaky） | passed（含 2 flaky） | passed（含 1 flaky，见下） |
| BDD-06/12/20/21（desktop+mobile viewport） | passed | passed | passed |
| T086 BDD-08（admin 访问 /admin 得 404） | did not run | passed | passed |
| T086 BDD-09（原 BDD-14，non-admin 访问 /admin 得 404） | **FAILED**（路由拦截根因） | passed | passed |
| T086 BDD-10（原 BDD-15，未登录访问 /admin 得 404） | did not run | passed | passed |
| T086 BDD-07（未登录访问 /settings?tab=user-manager 重定向到 /） | did not run | passed | passed |
| T086 BDD-11（admin UserMenu → user-manager） | did not run | **FAILED**（选择器 scope 缺陷） | **passed** |
| T086 BDD-12（非 admin UserMenu Settings 入口） | did not run | did not run（级联跳过） | **passed**（首次真正执行） |

三轮问题链路（路由拦截 → 选择器 scope）本轮全部闭环，无新增失败。

## Flaky 详情（1 flaky，重试后通过，不计入失败）

- `[Mobile Chrome] BDD-02: user list shows status badges [desktop]`（`admin.spec.ts:113`）— 首次 `waitForSelector('.desktop-only .admin-user-row, .desktop-only [data-testid="admin-user-row"]')` 超时（10000ms exceeded）
- 触发原因：本文件 `test.describe.configure({ mode: 'serial' })`，BDD-02 失败后 Playwright 对该 project（Mobile Chrome）整个 serial 分组（18 条用例）触发整组重试（日志 `[37/36]`–`[54/36] (retries)`），重试后全部 18 条（含 BDD-11/BDD-12）真正重新执行并通过
- 与前两轮记录的 BDD-01/02 首屏渲染超时 flaky 同类（环境时序抖动，非选择器/路由缺陷），本轮仅出现 1 次（前两轮各 2 次），判定为环境时序抖动，不算真失败

## Passed（35，含 1 flaky retry 后计入）

覆盖全部 36 条用例对应的 18 个 BDD 场景（desktop+mobile 双 viewport，路由 404 场景，UserMenu 入口场景）：BDD-01/02/06/12/20/21（×2 viewport）+ T086 BDD-07/08/09/10/11/12，chromium 与 Mobile Chrome 两个 project 全部真正执行并通过。

## 环境隔离核查

- E2E 全程针对 `http://127.0.0.1:8888`（debug backend），`admin.spec.ts` 的 `beforeAll` 硬编码拒绝 `:8080`/`prod`，未触发
- E2E 开始前手工核查生产库 `~/.peekview/peekview.db`：`SELECT COUNT(*) FROM entries` = 41
- `make debug-stop` 后再次核查：`SELECT COUNT(*) FROM entries` = 41，与运行前一致，未变化
- `/tmp/peekview-debug/` 已随 `make debug-stop` 清理

**[PROD_NOT_TOUCHED]**

## 结论

E2E gate **本轮通过**（exit 0，failed=0，全部 36 条用例真正执行）。

1. **P3-fix-record.md 的选择器修复已生效**：T086 BDD-11 不再触发 strict-mode violation，chromium + Mobile Chrome 均 PASSED
2. **T086 BDD-12 三轮以来首次真正被执行**：不再因 BDD-11 失败被 serial 模式级联跳过，chromium + Mobile Chrome 均 PASSED
3. 单测（1228 passed, 4 skipped）与 typecheck（0 错误）均全绿，无回归（详见 unit.md）
4. 本轮出现 1 条 flaky（BDD-02 Mobile Chrome desktop viewport，与前两轮同类环境时序抖动），重试后通过，不计入失败
5. 三轮累计问题链路（路由拦截 BDD-8/9/10 → 选择器 scope BDD-11/12）本轮全部闭环，无新增失败、无遗留级联跳过

判定：**gate 通过，可推进 P6**。
