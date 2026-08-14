# P5 技术验证结果 — TPV0092 mcp-get-entry-fetch

- 执行时间：2026-08-15
- 执行人：verifier subagent（P5 模式一）
- gate_commands 来源：P2-design.md §5（唯一命令真相源）
- 环境隔离：仅 pytest/vitest（隔离 tmp_path + 临时 HOME）；未触碰 `:8080` 生产 / `~/.peekview/` → `[PROD_NOT_TOUCHED]`
- 无待确认项 → `[NO_NEED_CONFIRM]`

## 命令 1：`make test-quick`（后端 pytest 全量）

**第 1 次执行：exit 2（1 failed / 1090 passed / 3 skipped，31.01s）**

- FAILED：`tests/test_admin_backup.py::TestBdd10BasicRestore::test_restore_into_empty_target`
- 失败原因：`.tmp` 重命名竞态 —— `Error: Path not found: ...peekview-backup-*.tar.tar.gz.tmp -> ...tar.gz`（backup CLI 原子重命名时 tmp 文件尚未就绪），`assert 1 == 0`
- **判定：预存 flaky（非本任务引入）**
  - 查证 1：P4 commit `f1b9f8f1` 改动文件清单不含 `backend/tests/test_admin_backup.py`（仅 files.py/purify.py 及 MCP 文件）；该测试最近 commit 为 `3e18f711`/`87536524`（ruff format/lint 修复，非 TPV0092）
  - 查证 2：P3-progress.md:57 已记录 backup 测试 flaky（`test_backup_debug_mode_isolation` 首轮 failed，隔离重跑绿）
  - 查证 3：隔离重跑 `pytest tests/test_admin_backup.py::TestBdd10BasicRestore::test_restore_into_empty_target` → **exit 0 PASS**
  - 查证 4：全量第 2 次执行 → **1091 passed, 3 skipped, exit 0**

**第 2 次执行（确认 flake）：exit 0（1091 passed, 3 skipped，26.78s）**

- 输出签名：`1091 passed, 3 skipped, 25 warnings`
- Makefile 输出：`✓ Tests passed`

## 命令 2：`make test-mcp-unit`（MCP vitest）

**exit 0**

- 输出签名：`✓ MCP unit tests passed`（17 文件，~268 tests，Duration 8.73s）
- 覆盖：parseEntryRef 5 形态 / purifyContent / fetchEntryRaw 匿名+share+404+非PeekView+302拒绝+超时+响应体上限 / getEntry 全返回策略+file= / publish_files Raw URL / mcp-integration + mcp-e2e `{ref}` 契约

## 命令 3：`make typecheck`（vue-tsc）

**exit 0**

- 输出签名：`✓ type check passed`

## 命令 4：`make lint`

**exit 2 — 环境问题（非代码问题）**

- `cd backend && ruff check ...`：`ruff: 未找到命令`（ruff 不在 PATH，Makefile:187 依赖 PATH 中的 ruff）
- 按 dispatch-context 指示降级执行：`cd backend && ~/.local/bin/ruff check peekview/ tests/` → **exit 0 `All checks passed!`**
- MCP eslint 未安装（P4 已记录预存环境缺口，非本次引入；`make lint` target 本身只跑后端 ruff）

## 可选：`make debug-test-mcp`（MCP 集成，需 :8888 在线）

- **未执行**：P2-design §5 将 `debug-test-mcp` 列为 **P6 gate 命令**（`gate_commands.P6`），dispatch-context 明确 "P5 可不跑" → 留给 P6 实跑。

## failed 汇总

- **failed 计数（本次真实失败）：1 次（第 1 轮），第 2 轮全量重跑 0** → **有效结果 failed=0（flaky 复现失败已排除）**
- 预存失败（与本次改动无关）：`test_admin_backup.py::TestBdd10BasicRestore::test_restore_into_empty_target`（backup CLI .tmp 重命名时序竞态，隔离重跑绿 + 全量第 2 轮绿）
- 本次任务相关测试（raw ?share=/?purify=/purify.py + MCP get_entry/entryRef/purify/client）：**全部通过**
- 全量测试：已运行（后端 pytest 全量 ×2 + MCP vitest 全量 + typecheck + ruff 全量）

## 返回签名

- 后端：1090 passed + 1 flaky → 1091 passed（重跑）
- MCP：268 passed
- typecheck：通过
- ruff：All checks passed
- EXIT_CODE: 0
passed 1091 (后端 pytest 全量第 2 轮: 1091 passed, 3 skipped)
failed 0 (第 1 轮 1 flaky 已隔离重跑+全量重跑排除: test_admin_backup TestBdd10BasicRestore)
passed 268 (MCP vitest: 268 passed, 17 files)
passed 1 (typecheck: ✓ type check passed)
passed 1 (ruff: All checks passed)
