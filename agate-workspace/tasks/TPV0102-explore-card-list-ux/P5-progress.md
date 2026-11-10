## [命令1] make test-quick — 后端全量单元测试
- 命令: `make test-quick` (= `cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short`)
- EXIT_CODE: 2
- 计数: 1 failed, 1205 passed, 3 skipped (25 warnings), 34.73s（外层总耗时 36s）
- FAILED: `tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key`
- 归因: 预存失败 T-12 / 派发单 known-failure #1 —— 沙箱 `~/.peekview/` 只读 (OSError Errno 30)，与 TPV0102 无关 → 登记 known-failures.md
- PROD: [PROD_NOT_TOUCHED]（:8080 探活 000）

## [命令2] make test-frontend — 前端全量单元测试
- 命令: `make test-frontend` (= `cd frontend-v3 && npx vitest run`)
- EXIT_CODE: 0
- 计数: 119 test files passed (119) / 1456 passed | 4 skipped (1460)，failed=0，19.33s（外层 20s）
- 备注: 日志中 Vue warn / Mermaid render failed 为既有噪声，非失败（suite exit 0）

## [命令3] E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test — 本任务 E2E
- 命令: `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`
- 前置探活: `curl :8888/health` → 200（跑前）
- EXIT_CODE: 0
- 计数: **61 passed, 3 skipped, 0 failed**（64 total，2 project: chromium + Mobile Chrome）
- 耗时: 39.4s 测试本体 / 174s 外层总耗时（含 build + 安全检查）
- 与 P4 基线一致（T-13: design 两次复跑 61 passed / 0 failed）
- 截图: 脚本报 `/tmp/e2e-results/`（见下方取证步骤）
- 截图: runner 声明 `/tmp/e2e-results/`，但本次 **`screenshot: 'only-on-failure'`**（`playwright.config.ts:16`）+ 全绿 → 无失败截图产生；`/tmp/e2e-results/` 目录在本次调用后不可见（跨调用 /tmp 不可见）。**e2e.md 中将如实记录"无失败截图"，不伪造成"截图已保存"**。
- 隔离核验: runner Safety Check 通过（BASE_URL=:8888 ≠ :8080；生产条目数 283 记录在案）。`lsof -t -i :8888` 在本调用命名空间内取不到 PID（服务挂在主 Agent 后台 job 的另一命名空间），故 "✓ Service using debug database" 行未打印——**如实记录为"未能独立复核 DB 路径"**，非失败。

## [命令4] E2E_SPEC=e2e/team-visibility.spec.ts make debug-test — legacy 回归
- 命令: `E2E_SPEC=e2e/team-visibility.spec.ts make debug-test`
- 前置探活: `curl :8888/health` → 200
- EXIT_CODE: **2**
- 计数: **2 failed, 6 passed**（8 total = 4 tests × 2 project），2.1m（外层 262s）
- FAILED（两 project 各一，均为同一条测试）:
  - `[chromium] e2e/team-visibility.spec.ts:147:3 › BDD-40: team entry 卡片有 visibility-toggle，delete 保留`
  - `[Mobile Chrome] 同上`
- 失败点: `:157 await expect(teamCard).toHaveCount(1)` → `Expected: 1, Received: 0`，`14 × locator resolved to 0 elements`
- **独立归因取证（不靠自述）**:
  - `GET /api/v1/teams`（alice）→ `{"owned":[{"slug":"frontend-team",...}],"joined":[]}` → **无 `proj-a`**
  - `POST /api/v1/entries` `team_id=proj-a` → **HTTP 422** `{"code":"PARAMETER_VALIDATION_ERROR","message":"Team not found or not accessible"}`
  - 对照 `team_id=frontend-team` → **HTTP 201**（证明后端与 fixture 链路本身正常，仅 `proj-a` 缺）
  - seed 目录 `grep proj-a scripts/seed-data/` → 0 命中
- **归因结论**: 既有 spec 的 fixture 缺失（`proj-a` 不在 seed）＝ 派发单已知失败 #2 / P4-review T-14。**非 TPV0102 行为缺陷**。
  - 诚实补充（不掩盖）: TPV0102 的 §6.4 第 1 项把该断言由 `count=0`(带 `if count>0` 守卫) 翻转为前置 `toHaveCount(1)`，**拆掉了原本会静默跳过该断言的守卫** → 该 fixture 缺口由此从"假绿"变成"真红"。即红的**根因是 fixture**，红的**可见性是本任务带来的**（这正是 P2 要求的诚实化）。

## [命令5] make lint — ruff
- 命令: `make lint` (= `cd backend && .venv/bin/ruff check peekview/ tests/`)
- EXIT_CODE: 0
- 输出: `All checks passed!`
- 耗时: <1s（外层 0s 取整）
- failed=0

## [命令6] make typecheck — vue-tsc
- 命令: `make typecheck` (= `cd frontend-v3 && npx vue-tsc --noEmit`)
- EXIT_CODE: 0
- 输出: `✓ type check passed`
- 耗时: 5s
- failed=0

## [命令7] P5_fitness — 架构适应度（mixin 不污染表模型）
- 命令: `cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=short -k mixin_not_in_table_mro`
- EXIT_CODE: 0
- 计数: **1 passed, 19 deselected**（`-rA` 复核：`PASSED tests/test_utc_serialization.py::TestBdd08TableModelsNotPolluted::test_mixin_not_in_table_mro`）
- 耗时: 1s / 0.30s
- 备注: `-q` + pyproject `addopts = "-q --tb=short"` 使首轮输出仅 `.` + `[100%]`，无汇总行；用 `-rA` 复跑取到 passed 计数（同一命令族，未改测试）
- failed=0
