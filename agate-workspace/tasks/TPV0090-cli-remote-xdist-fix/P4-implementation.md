---
phase: P4
task_id: TPV0090-cli-remote-xdist-fix
type: implementation
parent: P2-design.md
trace_id: TPV0090-P4-20260813
status: draft
created: 2026-08-13
agent: implementer
---

# P4 实现报告 — test_cli_remote.py xdist 并发失败修复

implementation_dir: `backend/tests/`（改动文件：`backend/tests/test_cli_remote.py`）

## 改动清单（单文件，严格按 P2-design §1 候选 1，已锁定规格）

| 位置 | 改动 | 性质 |
|------|------|------|
| `test_cli_remote.py:7` | 新增 `import os`（P2-review 观察①：`os.environ.get("PYTEST_XDIST_WORKER")` 与 `_server_port` 所需） | 新增 |
| `test_cli_remote.py:20-22` | 新增模块级纯函数 `_server_port(worker_env) -> int`：`18888 + int(worker_env[2:]) if worker_env else 18888`（`None→18888`、`gw0→18888`、`gw7→18895`、`gw15→18903`，P3 TC-port 直接依赖） | 新增 |
| `test_cli_remote.py:25-68` | `server_url` fixture 改造：① 端口由固定 `18888` 改为 `_server_port(os.environ.get("PYTEST_XDIST_WORKER"))`，`PEEKVIEW_SERVER__PORT` env 与 `--port` CLI 参数、`url` 三者同源一致；② 等待循环每轮先 `proc.poll()`，死亡立即 `communicate(timeout=2)` + `raise RuntimeError("Server failed to start (rc={rc}); stderr: {stderr 末 500 字符 repr}")`；③ 健康检查失败时 sleep 步长 0.5s→0.25s（P2 规格值）；④ teardown 强化：`terminate()` → `wait(timeout=5)` → `TimeoutExpired` 时 `kill()` + `wait(timeout=5)` 兜底 | 改造 |
| 17 个既有用例体（TestCLIRemoteCreate/List/Get/Delete/Config/ModeSwitching） | **零改动** | 不变 |
| P3 新增 TestCLIRemoteFixture（6 用例）+ `_FakeProc` + `_popen_capture` | **零改动**（TDD 红灯测试原样保留） | 不变 |

未改动（P2-design §0 明确边界）：Makefile / pyproject.toml / ci.yml / 业务代码 / schema / API。

## 自测结果（自查，非 gate）

| 命令 | 结果 |
|------|------|
| `cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -q --tb=short` | **23 passed**（17 既有 + 6 fixture 级，0 failed / 0 errors） |
| `cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -n auto -q --tb=no` | **23 passed**，0 failed / 0 errors（并发不失败） |
| `cd backend && python3 -m ruff check tests/test_cli_remote.py` | **All checks passed**（rc=0） |
| 残留进程验证（I6 辅助） | `ss -tlnp` 确认 1888x 端口**无监听**，全部 server 已由强化 teardown 回收；早前 `pgrep -f "peekview serve --port 1888"` 命中为 pgrep 自匹配（其自身命令串含模式串）。生产 pipx 服务（:8080，PID 70846）与 `~/.peekview/` 未触碰 |

注：P3 红灯 4 用例（TC-B4a / TC-B4d / TC-B4c2 / TC-port）已全部转绿；TC-B4b / TC-B4c1 回归护栏保持绿。

## 与 P2 完成标志（§8）对照

- [x] ① 端口 = `18888 + worker_index`（xdist）/ `18888`（单跑），URL 与端口一致
- [x] ② 等待循环每轮先 `proc.poll()`，死亡 raise RuntimeError 含 `rc=` 与 stderr 摘要
- [x] ③ teardown：`terminate()` → `wait(timeout=5)` → 超时 `kill()` + `wait(5)` 兜底
- [x] ④ fixture 级测试（P3）绿：死亡 ≤5s 失败含诊断；正常启动行为不变
- [x] ⑤ `pytest tests/test_cli_remote.py -q`：23/23 全绿（17 既有 + 6 新）
- [x] ⑥ `-n auto -q`：0 failed / 0 errors（P6 将按 BDD-1 连续 3 次实测）
- [x] ⑦ `make test-quick`：属 P5 gate 范畴（未自跑，等待 verifier）
- [x] ⑧ 无残留：1888x 无监听（见上表）

## 发现

无 `[SCOPE+]` / `[SCOPE_GAP]` / `[DESIGN_GAP]` / `[CLARIFY]`。实现与 P2-design §1 候选 1 规格逐行一致，未做任何规格外决策。
