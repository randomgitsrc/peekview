---
phase: P8
task_id: TPV0090-cli-remote-xdist-fix
type: release
parent: P7-consistency.md
trace_id: TPV0090-P8-20260813
status: draft
created: 2026-08-13
agent: releaser
---

# P8 发布准备 — test_cli_remote.py xdist 并发失败修复

## 版本决策

- **bump_type: patch**
- 依据：本次改动为测试基础设施修复（`backend/tests/test_cli_remote.py` fixture 改造），无用户可见功能变更（`ui_affected: false`）→ patch 语义。
- **peekview：0.18.5 → 0.18.6**（VERSIONS.json `"peekview": "0.18.5"`，无破坏性变更）
- **MCP server：0.10.0 保持不动**（P2 packages 收敛为 `[backend/tests/test_cli_remote.py]`，MCP 零改动，不 bump）

## P2 packages 声明核对

P2-design.md frontmatter：`packages: [backend/tests/test_cli_remote.py]`（SCOPE+ 收敛，Makefile/pyproject/ci.yml 零改动）。

- P7 独立实证：`git show 7612895c --stat` 代码改动仅 `backend/tests/test_cli_remote.py`（+39/-16）；`git show 51d53161 --stat` 仅追加 TestCLIRemoteFixture（+150）。
- **只处理 peekview 包，MCP 不 bump** —— 与 P2 声明一致，无 `[SCOPE_GAP]`。

## 发布检查命令（P2 packages 逐包）

| 包 | 命令 | 结果 |
|----|------|------|
| peekview backend | `cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short` | **EXIT 0**：`1078 passed, 3 skipped, 25 warnings in 36.20s`（本次 P8 releaser 亲跑，预存失败已消除，零失败） |
| peekview backend | `cd backend && python3 -m ruff check tests/test_cli_remote.py` | **EXIT 0**：`All checks passed!` |
| MCP server | 不适用（无改动，不 bump） | — |

> 注：P6 已实测 BDD-1 `-n auto` 连续 5 次零失败、BDD-2 全量 1078 passed、BDD-3 单跑 23 passed、BDD-4 死亡诊断；本次 P8 全量复跑方向一致（1078 passed / 0 failed）。

## 版本号变更确认

- `VERSIONS.json`：`{"peekview": "0.18.5", "mcp_server": "0.10.0"}`（bump 前快照，releaser 只读确认，**未修改**——版本文件变更由主 Agent `make bump-version NEW_VERSION=0.18.6` 执行）
- 版本源唯一：AGENTS.md「`VERSIONS.json` 是唯一版本源，`bump-version` 通过 `scripts/sync_versions.py` 同步到所有文件」
- 建议主 Agent 执行：`make bump-version NEW_VERSION=0.18.6`（同步到 `backend/peekview/__init__.py` / `pyproject.toml` / frontend 等），MCP 版本不动

## CHANGELOG 更新确认

- 已确认变更（releaser 本次写入 `CHANGELOG.md` `[Unreleased]` 区）：
  - `### 修复` 下新增 TPV0090 条目（描述 xdist 端口竞争修复 + 死亡检测 + teardown 强化，风格与 0.18.5 条目一致，带 `(TPV0090)` 编号）
- **版本号标题变更由主 Agent 处理**：bump 后需将 `## [Unreleased]` → `## [0.18.6] - 2026-08-13`，并把 `[Unreleased]` 清空/重建
- git log 核对：`git log v0.18.5..HEAD --oneline` 仅含 TPV0090 P1-P7 workflow commits（7 个），无其他待记录变更 → CHANGELOG 无遗漏
- CHANGELOG 条目已就位，diff 干净（仅新增 TPV0090 块）

## debt_check

- 读取 `agate-workspace/debt/tech-debt.md`：文件仅含登记模板 + 示例条目（DEBT0001-0003 均为「示例条目」占位），**无真实登记债务条目**。
- 本次改动为单文件测试基础设施修复，无协议/安全/架构债务引入，未来变更成本不受影响。
- **debt_check: none**

## 临时资源清单（releaser→主 Agent 交接，供 READY 收尾清理）

| 类型 | 项 | 状态 |
|------|----|------|
| 调试服务 | debug :8888 | 本任务纯 pytest，未启动 debug 服务 |
| 测试子进程 | `peekview serve --port 1888x`（18888-18903） | 已由 teardown 清理；P8 复跑后 pgrep 确认空、`ss` 确认 1888x 无监听（pgrep 命中均为命令自身假阳性） |
| 临时数据 | pytest `tmp_path_factory` 临时目录（PEEKVIEW_STORAGE__* 指向 tmp） | 自动清理，无持久残留 |
| 测试 fixture 产物 | `backend/zip-entry-test.zip` / `backend/zip-export-test.zip` / `backend/zip-extract-test.zip` 被 pytest 改写（已追踪文件，测试运行即变更） | 建议主 Agent READY 时 `git checkout -- backend/zip-*.zip` 还原 |
| 生产服务 | pipx :8080（PID 70846） | 在运行，**未触碰** |
| 工作区脏文件 | `.state.yaml`、P8-* 产出文件、CHANGELOG.md | 属任务正常产出 |

## 主 Agent 下一步（P8 gate 后）

1. 亲自执行：`make bump-version NEW_VERSION=0.18.6` + `git log v0.18.5..HEAD` 对照 CHANGELOG + 重跑 P5 gate（`make test-quick`）
2. 更新 CHANGELOG `[Unreleased]` → `[0.18.6]`，`git add CHANGELOG.md && git commit --amend --no-edit`
3. `git tag v0.18.6`，README 版本同步（如 sync_versions 覆盖范围）
4. READY 收尾：还原 zip fixture、确认无残留进程、工作区干净

## Lessons Learned

1. **测试端口竞争要用机制级隔离，而非调度参数**：`xdist_group` 分组在默认 `--dist=load` 下不 honor（P2 minimal_validation 实测 refuted），Makefile 拆跑不改变裸命令行为——「每 worker 动态端口」是唯一同时满足裸命令验收（BDD-1）、不改全局配置（P1 §7）、机制确定性的方案。教训：选型前先实证机制前提。
2. **pgrep 自匹配陷阱**：发布检查中 `pgrep -f "peekview serve --port 1888"` 首次命中 PID 是**命令自身**（bash -c 全命令行含该串），需用 `ss -tlnp` 查端口监听或换不含子串的匹配模式才能确认真实残留。教训：残留进程判断以端口监听为准，不以 pgrep 输出为准。
3. **P8 多包发布前先核对 packages 收敛**：P1 原声明含 Makefile，P2 SCOPE+ 收敛为单文件；releaser 必须读 P2 最新声明决定 bump 范围，避免漏 bump（MCP 不动）或虚列未改动文件。

## [PROD_NOT_TOUCHED]

本任务（含 P8 发布检查全量 pytest + ruff）全程未触碰生产 :8080 服务与 `~/.peekview/` 数据目录；测试全部走 tmp_path_factory 隔离目录，生产服务 PID 70846 持续运行但零读写。
