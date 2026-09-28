---
task_id: TPV0099
generated_by: orchestrator (main)
---
# 已知失败登记

> **语义边界**：本文件只登记**预存失败**（P5 之前就存在的、与当前任务无关的失败）。
> 当前任务引入的失败用 P5-test-results/ 记录，不写本文件。

## 预存失败（非本任务引入）

| # | 测试文件 | 失败数 | 根因 | 与本任务相关 | 处理计划 |
|---|---------|--------|------|-------------|---------|
| 1 | `backend/tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` | 1 | DSH 沙箱环境性：测试直写真实 `~/.peekview/config.yaml` 被只读拦截（`OSError: [Errno 30] Read-only file system`）。**已在 HEAD 基线 worktree（`.agate-tmp/baseline-0099`）复现确认预存** | 否 | 推迟（沙箱限制；与 TPV0095 登记的第 1 条同源） |
| 2 | `backend/tests/test_admin_backup.py::TestBdd01ConsistentBackup::test_backup_produces_tarball` | 1（首轮，隔离复跑绿，全量重跑亦绿） | 并发/时序竞态（backup `.tmp`，TPV0092 同源）——**TPV0095 已登记为预存 flaky** | 否 | 推迟（flaky 一振，预存确认） |
| 3 | `frontend-v3/src/components/__tests__/DiagramBlock.spec.ts`（mermaid: clicking outside closes the menu） | 1（偶发，隔离复跑必绿） | jsdom/全量并发时序 flaky。本任务 P2/P3/P4 期均复现过"全量首跑 1 failed、隔离复跑 + 全量重跑均绿" | 否 | 推迟（flaky，预存确认；非本任务引入——本任务前端改动仅 3 文件且与之无关） |
| 4 | `frontend-v3/src/components/__tests__/TableView.spec.ts` | 1（偶发，隔离复跑必绿） | 同上（jsdom/全量并发时序 flaky）。P3 修正轮观测到首跑 1 failed、隔离连跑 3 次全绿 | 否 | 推迟（flaky，预存确认） |

> **口径说明（供 P5/P6 判读）**：
> - 本任务在 P5 期的 6 条 `gate_commands.P5` 命令**全部 exit 0、failed=0**（详见 `P5-test-results/`）——第 3/4 条 flaky **本轮未触发**。
> - 第 1/2 条属**后端**测试，**不在本任务 `gate_commands.P5` 声明内**（P2 §6 只声明 4 条前端/文档命令 + 2 条 E2E）。主 Agent 为满足 P5 卡「应运行全量测试套件」要求**自行补跑** `make test-quick` 时发现，故登记于此。
> - **判定依据**：第 1 条在 **HEAD 基线 worktree 复现**（预存实证）；第 2/3/4 条**隔离复跑全绿**（flaky 实证）。三条均与本任务改动无因果关系（本任务为前端 3 文件 + 文档，后端零改动）。
