# P8-gate-diagnosis — TPV0101

---
phase: P8
task_id: TPV0101
type: gate-diagnosis
diagnosed_by: 主 Agent
created: 2026-10-03
failed_gate: P8-release-check
gate_command: make lint
gate_exit: 1
resolution: fixed-and-reverified
---

## 失败现象

P8 发布检查阶段，主 Agent 亲自执行项目 AGENTS.md 铁律 #10 要求的 `make lint`（`cd backend && .venv/bin/ruff check peekview/ tests/`）→ **exit 1**，4 个错误：

| 规则 | 位置 | 说明 |
|------|------|------|
| F401 | `backend/tests/test_datetime_naive_compat.py:29:31` | `sqlmodel.SQLModel` imported but unused |
| F401 | `backend/tests/test_datetime_naive_compat.py:40:5` | `peekview.models.Team` imported but unused |
| F401 | `backend/tests/test_datetime_naive_compat.py:41:5` | `peekview.models.TeamMember` imported but unused |
| I001 | `backend/tests/test_dependency_guard.py:16:1` | import block un-sorted / un-formatted |

## 根因

- 4 个错误**全部由本任务新增的 2 个测试文件引入**（P3 产出、P4 提交），非预存问题。
- 未被 agate gate 链捕获的原因：`make lint` **不在 P2-design.md 的 `gate_commands`**（P3/P5 各 key 全为 pytest），故 P5 技术验证只跑 pytest、不跑 ruff；CI 门禁亦不含 ruff（见 AGENTS.md「CI 门禁」）。lint 是**项目级铁律**（#10），agate 侧无机械 gate。
- 复盘：P4 `orchestrator-log.md` 曾记「ruff 全绿」，实际该次未覆盖全部测试文件——属自述与实测的口径偏差。

## 处置（不绕过、不手改结论）

1. 派 **backend implementer**（P8 模式）执行 ruff 自动修复——**仅** import 区（F401 删除未用 import + I001 重排），不动任何断言/逻辑/fixture/源码/版本文件。
   - attempt 1（把「修复 + 两轮全量测试」并入同一前台 subagent）被平台中断，**未产生任何改动**；
   - attempt 2（拆分职责：subagent 只做秒级 autofix + `make lint`；全量回归由主 Agent 执行）成功。
2. 主 Agent **独立复跑**（不信自报）：
   - `make lint` → **exit 0**（`All checks passed!`）
   - `git diff --stat` → 仅 2 个测试文件（`-3/+1` 与 `+2/-2`，均 import 区）
   - 本地 0.0.38 全量 `backend/.venv` → **exit 0，1186 passed / 3 skipped**（点数核对与 P5 基线一致）
   - 隔离 0.0.47 全量 `/tmp/ci-repro-venv`（CI 等价）→ **exit 0，0 FAILED / 0 ERROR，进度至 100%**
   - `make typecheck` → **exit 0**（vue-tsc passed）

## 对既有阶段结论的影响

- 改动为 **import 删除 + 重排**，**零行为变更**；双环境全量测试通过数与 P5 基线一致（1186 passed / 3 skipped）。
- 故 P5 技术验证 / P6 验收（18/18）/ P6.5 judge verdict / P7 一致性结论**均保持有效**，无需重开。
- 本任务的 P5 证据因此**不再走「复用」路径**：主 Agent 已在 P8 阶段**重新全量执行** `gate_commands` 的两个环境全量命令（上方 exit 0）。

## 后续

- lint 清理独立成 commit（在 release bump 之前），release commit 与 tag 随后由主 Agent 执行。
