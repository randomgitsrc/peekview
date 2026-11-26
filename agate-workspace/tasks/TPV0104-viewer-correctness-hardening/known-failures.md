---
task_id: TPV0104
generated_by: 主 Agent（P5 阶段）
---
# 已知失败登记 — TPV0104

> **语义边界**：本文件只登记**预存失败**（P5 之前就存在的、与当前任务无关的失败）。
> 当前任务引入的失败用 P5-test-results/ 记录，不写本文件。

## 预存失败（非本任务引入）

| # | 测试文件 | 失败数 | 根因 | 与本任务相关 | **复现证据**（可重跑命令 + 关键输出） | **举一反三**（同类扫描结论） | 处理计划 |
|---|---------|--------|------|-------------|--------------------------------------|------------------------------|---------|
| 1 | `backend/tests/test_cli_remote.py` | 1 | 沙箱 `~/.peekview/` 只读，CLI `config set` 写配置文件失败 | 否 | `cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key -q` → `OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`（`assert 1 == 0`） | `grep -rln "\.peekview/config.yaml\|\.peekview\\\\config" backend/tests/` → 仅本文件；该失败是**环境只读**而非代码缺陷，换可写 HOME 即绿 | 推迟（环境限制，非代码问题）；CI 有可写 HOME 故不触发 |
| 2 | `frontend-v3/e2e/viewer.spec.ts` | 18 | `markdown-test` 归 `frontend-team` → `team_id` 强制 `is_public=false`（`entry_service.py:200`）→ 匿名 `GET` 404 → `entry.files` 为 `undefined` → `TypeError: Cannot read properties of undefined (reading 'find')` | 否（**TPV0095 / `59182590`（2026-09-03）引入**） | `make debug-start && make debug-seed && E2E_SPEC=e2e/viewer.spec.ts make debug-test` → `18 failed / 20 passed`；失败信息见 `test-results/viewer-*/error-context.md` | `grep -rln "markdown-test\|mermaid-charts" frontend-v3/e2e/` → `viewer.spec.ts` / `t091-*.spec.ts` / `tpv0099-*.spec.ts` 三处；**`tpv0099` 已带认证故不红**，前两者无登录态 → 同源 | 推迟。BDD-50 判据已按「失败集不劣于基线」写，非要求全绿。根治需给这两个 spec 加认证配对（属 TPV0095 遗留债，单独立项） |
| 3 | `frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts` | 14 | 同 #2（`markdown-test` 匿名 404 → `toBeVisible()` 找不到 `meta-tags-bar` / `mobile-bottom-bar` / `markdown-body`） | 否（同 TPV0095 遗留） | `E2E_SPEC=e2e/t091-mobile-detail-visual-polish.spec.ts make debug-test` → `14 failed / 12 passed` | 同上 | 推迟（同 #2） |

## 并发 flaky（非本任务引入，串行可过）

| # | 测试文件 | 失败数 | 根因 | 复现证据 | 处理 |
|---|---------|--------|------|---------|------|
| F1 | `backend/tests/test_admin_backup.py` | 0–2（视并发度） | `pytest-xdist -n auto` 下备份/恢复用例涉及文件系统时序，并发执行时偶发失败（`TestBdd01ConsistentBackup::test_backup_db_is_consistent_snapshot` / `TestBdd10BasicRestore::test_restore_into_empty_target`） | 串行全量 `pytest tests/ -q -p no:randomly` → **仅 `test_cli_remote` 1 项失败**（`test_admin_backup` 40 passed）；`-n auto` 三次实测分别 3F / 2F / 1F，**失败集不稳定**即 flaky 指纹 | 不修（属测试并发隔离问题，与本任务无关）；发布验证以串行全量结果为准 |

> **发布时的判据**：`make test-quick`（xdist）允许 `test_admin_backup` 偶发失败；判定标准为「串行全量仅预存 `test_cli_remote` 失败」。

## 基线计数瑕疵（非失败，但影响判据可复现性）

| # | 现象 | 说明 | 处理 |
|---|------|------|------|
| B1 | `t091` 的 P1 基线记「12 failed / 12 passed = 24 项」，而 spec 实为 **13 test × 2 project = 26 项** | 基线采集时很可能有 2 项 flaky 未计入。实测 14F 与 12F 的差（+2）即在此区间内，且 14 个失败**全部**指向同源 404 | P5 判据采用「失败集 ⊆ 基线失败集 **且** 失败原因同源」的双条件，而非仅比数字。已在 `P5-test-results/e2e.md` 记录该边界 |

## 同类扫描结论（举一反三）

- **`~/.peekview/` 只读**：`grep -rln "\.peekview" backend/tests/` → 仅 `test_cli_remote.py`。其他测试均用 `tmp_path` / `create_app(mkdtemp)` 隔离。
- **`markdown-test` 团队归属导致的匿名 404**：`grep -rln "markdown-test" frontend-v3/e2e/` → 3 个 spec；其中 `tpv0099` 有 `aliceToken()` + `setAuthCookie()` 认证配对（实测 6P/0F 全绿），`viewer` / `t091` 无认证（红）。→ **同源但影响面已明确列全**。
- **seed 数据完整性**：`scripts/seed-data/` 有 24 个目录，但 `image-gallery`（0 文件）会被 seed 跳过（`:184` `SKIP no content files`）；`markdown-test` / `mermaid-charts` / `csv-employees` 带 `team_id`，**首次 `make debug-seed` 可能未建全，需重跑一次**（实测重跑后 `Total entries: 25`，三者均 200）。已在 orchestrator-log 记录。
