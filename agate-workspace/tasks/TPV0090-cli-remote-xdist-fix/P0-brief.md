---
phase: P0
task_id: TPV0090
task_name: cli-remote-xdist-fix
trace_id: TPV0090
created: 2026-08-12
status: pending
parent: known-failures.md（TPV0089/TPV0088 两次登记，同源预存失败）
---

# P0-brief — T090 test_cli_remote.py xdist 并发失败修复

## task

修复 `backend/tests/test_cli_remote.py` 在 `make test-quick`（`pytest -n auto`，16 workers xdist）下的并发失败——模块级 fixture 启动的 :18888 server 在 15s 等待窗口内未就绪，导致 CLI 连接被拒，4~7 failed + 3 errors（随轮次漂移）。CI（串行）不受影响，仅本地 `make test-quick` 触发。

## 现象（known-failures 两次登记）

TPV0089 和 TPV0088 的 P5 全量测试均登记了同源失败：

| 运行方式 | 结果 |
|---------|------|
| `-n auto`（16 workers） | 4~7 failed + 3 errors（随轮次变化，server 未在 15s 内就绪） |
| 单跑该文件（无 xdist） | 17/17 全绿 |
| `-n 2` | 全绿 |
| CI（`.github/workflows/ci.yml:38` 串行） | 不受影响（无 -n auto） |

## 根因（已核实，非猜测）

**`backend/tests/test_cli_remote.py:19-59` 的模块级 fixture 就绪等待太脆弱**：

1. fixture 用 `subprocess.Popen` 启动真实 peekview server（:18888），然后轮询 `/health` 最多 `30 次 × 0.5s = 15s`
2. `-n auto`（16 workers）下大量进程并发抢占 CPU/IO，server 子进程启动被拖慢，15s 窗口不够 → `raise RuntimeError("Server failed to start")` → 整个模块 fixture 失败 → 依赖它的全部用例连锁失败
3. 等待循环**不检测子进程是否已死**（`proc.poll()`），server 启动失败时傻等 15s 才报"Server failed to start"，诊断信息缺失（stderr 未打印）
4. 进程级集成测试（起 server + 起 CLI 子进程）本质**不适合 16 并发**——这是设计层面问题

## known_risks

- **修复方案有分歧，需 P2 选型**：
  - 方案 A：等待窗口加长（30→60 次）——1 行，治标（负载极高仍可能不够）
  - 方案 B：检测子进程死亡（`proc.poll()` + 立即报错打印 stderr）——治标，提升诊断
  - 方案 C：该文件串行/分组（`pytestmark = pytest.mark.xdist_group("cli_remote")` 或 Makefile 对该文件排除 xdist）——治本（进程级集成测试不适合并发）
  - 最优可能 B+C 组合，P2 需对比论证
- **无现成测试覆盖**：问题本身就是测试基础设施 bug，修复它没有现成测试可验证（验证需跑 -n auto 复现，非现成覆盖）→ P3 不可跳
- **改动面**：`backend/tests/test_cli_remote.py` fixture（+可能 Makefile/CI 配置）——涉及 pytest 配置/测试 fixture，属机制交叉
- **验证难点**：-n auto 复现是概率性的（16 核下稳定复现，但 CI 串行不复现）——P6 需本地实测 -n auto 全绿 + 单跑不回归
- 不触碰生产 :8080 / ~/.peekview/

## executor_env

platform: opencode
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make test-quick（-n auto 复现）/ cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py（单跑验证）"
lint: "无后端 lint 门禁（ruff 不强制 CI）"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/；测试只走临时目录（fixture 已用 tmp_path_factory）"

## 裁剪倾向

- P1：BDD 覆盖「-n auto 下 17 用例全过」「单跑不回归」「CI 串行不受影响」
- P2：`follows_existing_pattern`（修现有 fixture），但方案 A/B/C 选型需明确对比（B+C 组合 vs 单方案），不建议单候选直接跳过
- P3：**不可跳**——零现成覆盖，需新增 fixture 级测试（模拟 server 启动慢/死亡场景）
- P6：需本地实测 -n auto 全绿 + 单跑不回归 + CI 逻辑不受影响（串行路径）
- 风险：low（纯测试基础设施，无业务代码/schema/权限改动；但影响"每次 make test-quick 的可靠性"）

## 排期

TPV0090：独立于 TPV0071/TPV0077，无依赖，可随时启动。
