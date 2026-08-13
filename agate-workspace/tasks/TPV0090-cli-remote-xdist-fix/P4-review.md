---
phase: P4
task_id: TPV0090-cli-remote-xdist-fix
type: review
parent: P4-implementation.md
trace_id: TPV0090-P4-review-20260813
status: approved
created: 2026-08-13
agent: review
---

# P4 评审 — test_cli_remote.py xdist 并发失败修复（backend 实现评审）

评审对象：`backend/tests/test_cli_remote.py`（git diff HEAD 复核 + 全文件通读）
评审依据：P2-design.md §1 候选 1（逐行规格）/ §8 完成标志、P3-test-cases.md（6 用例）、P1-requirements.md（4 BDD + I1-I8）

**独立实证（本评审亲自运行，非转述 implementer/主 Agent 自报）**：
- 串行：`pytest tests/test_cli_remote.py -q --tb=short` → **23 passed / 0 failed / 0 errors**
- 并发：`pytest tests/test_cli_remote.py -n auto -q --tb=no` → **23 passed / 0 failed / 0 errors**
- lint：`python3 -m ruff check tests/test_cli_remote.py` 及 `tests/` → **All checks passed**
- 资源：两轮（串行+并发）测试结束后 `ss -tlnp` 无 1888x 监听、`pgrep -af "peekview serve"` 无 1888x 残留进程；生产 pipx 服务（PID 70846, :8080）与 `~/.peekview/` 全程未触碰

## 1. 正确性

| 项 | 结论 | 锚点/证据 |
|----|------|----------|
| `_server_port` gw0..gw15 推导 | ✅ | `test_cli_remote.py:20-22`：`18888 + int(worker_env[2:])`。gw0→18888、gw7→18895、gw15→18903，16 端口逐一唯一。TC-port 断言（:735-738）与实现逐一对应且全绿 |
| None / 空串回退 | ✅ | `if worker_env else 18888`：None（单跑/CI）与空串均回退 18888，与修复前行为一致 |
| 非 gwN 格式 worker 名 | ✅ 低风险（已论证） | xdist 仅注入 `gwN` 命名（P2-review 实证 3.8.0 稳定）；若未来改命名 `int()` 抛 ValueError 属 fail-fast 而非静默错误——与 P2-design §1 缺点/风险及 P2-review 判定一致，非本次实现引入 |
| 端口范围 18888-18903 无冲突 | ✅ | 全库 grep `1888\d`：仅 test_cli_remote.py 使用；不触碰 3000/8000/8080/8888（P2-review 已 grep 验证 test_config.py:116 port=3000 仅配置断言不监听） |
| env / --port / url 三源一致 | ✅ | `test_cli_remote.py:31` 单变量 `port` 派生：env `PEEKVIEW_SERVER__PORT`(:36)、Popen `--port`(:39)、url(:44) 全部同源；TC-B4b（:692-702）断言 url==env 端口且 `--port` 一致，绿 |
| 死亡检测时序 | ✅ | 等待循环 30 轮每轮先 `proc.poll()`（:47-51），子进程死亡后 ≤0.25s+1 次轮询内 raise（BDD-4 时间界，P2-design §3:170 "≤1s"）；TC-B4a 断言 <5s 绿 |

## 2. 与 P2 规格一致（逐行比对 §1 候选 1）

`git diff` 与 P2-design.md:49-91 候选 1 代码逐行比对：

| 规格点 | 实现 | 判定 |
|--------|------|------|
| 端口推导 | 规格内联 `18888 + int(worker[2:]) if worker else 18888`（P2-design.md:55）→ 实现提取为 `_server_port` 纯函数（:20-22） | ✅ 语义逐位一致；纯函数化是 P2-design §9 + implementer dispatch-context 要求 1 的显式规格，TC-port 依赖 |
| env dict | `**dict(subprocess.os.environ)` + 三个 PEEKVIEW_STORAGE__/PORT 覆盖 | ✅ :32-37 逐字一致 |
| Popen | `[sys.executable, "-m", "peekview", "serve", "--port", str(port)]` | ✅ :38-39 逐字一致 |
| 等待循环 | 30 轮；先 poll()→communicate(timeout=2)→`RuntimeError("...rc={rc}); stderr: {err.decode()[-500:]!r}")`；`requests.get(timeout=1)`；ConnectionError→`time.sleep(0.25)`；else→terminate+raise | ✅ :46-60 逐字一致（含 sleep 步长 0.25，规格值 :207） |
| teardown | `terminate()` → `wait(timeout=5)` → `TimeoutExpired` → `kill()` + `wait(timeout=5)` | ✅ :62-68 逐字一致 |
| §8 完成标志 ①-⑧ | ①端口/URL 一致 ✅ ②poll+rc+stderr ✅ ③teardown 强化 ✅ ④P3 用例绿 ✅ ⑤串行 23/23 ✅（自证）⑥-n auto 23/23 ✅（自证）⑦make test-quick = P5 gate 范畴（正确留给 verifier）⑧无残留 ✅（自证） | ✅ 全部满足 |
| P1 §7 边界 | Makefile / pyproject.toml / ci.yml / 业务代码零改动；17 既有用例体零改动（git diff 证实） | ✅ |

## 3. 回归风险

- **单跑/CI 回退分支**：无 `PYTEST_XDIST_WORKER` 时端口固定 18888，env/`--port`/url 与修复前逐位一致（仅 `PEEKVIEW_SERVER__PORT` 值从字面 `"18888"` 变 `str(18888)`，恒等）。串行实测 23/23 证实无回归
- **17 既有用例语义**：git diff 证实断言逻辑零改动；成功路径唯一行为差异是 sleep 0.5→0.25（P2 规格值，轮询更快不改变语义）与死亡检测/teardown 兜底（仅在失败路径生效）
- **跨文件**：仅本文件使用 1888x 端口（grep 证实），无新增共享资源冲突；`conftest.py` autouse `isolate_config_file`（conftest.py:22-41）不设 `PEEKVIEW_SERVER__PORT`，与动态端口无干扰（已读 conftest 复核）
- **CI 串行**：ci.yml 零改动（P1 §7），无 `-n` 时 `PYTEST_XDIST_WORKER` 不存在 → 18888 → 行为不变（I5 满足）

## 4. 代码质量

- `import os`（:7）仅此处新增且被使用（:30），无未使用 import
- `_server_port` 置于模块级（:20-22）、fixture 引用前，命名清晰、带 docstring
- 无规格外改动（git diff 范围收敛：+import os / +纯函数 / fixture 3 处改造 / +P3 既有测试类未动）
- ruff 全绿（F841 对 `out` 未告警——元组解包豁免；全 tests/ 目录亦通过）
- [INFORMATIONAL] `:48` `out, err = proc.communicate(timeout=2)` 中 `out` 未使用，系 P2 规格逐字保留，无实际影响

## 5. 资源清理

- teardown 强化链 `terminate → wait(5) → kill() → wait(5)`（:62-68）满足 I6：超时兜底路径经 TC-B4c2 断言（kill + terminate 均被调用、无异常泄漏），正常路径经 TC-B4c1 断言（terminate + wait:5）
- 自证两轮完整运行后无 1888x 监听/进程残留；早前 pgrep 命中为 pgrep 自匹配（命令串含模式串），已排除

## 6. 测试对应（P3 红灯 → 绿）

| P3 用例 | 实现锚点 | 结果 |
|---------|---------|------|
| TC-B4a（死亡 raise 含 rc，<5s） | :47-51 poll→communicate→RuntimeError rc= | ✅ 绿（实测 23/23 含） |
| TC-B4d（报错含 stderr 摘要） | :50 `err.decode()[-500:]!r` | ✅ 绿 |
| TC-B4c2（wait 超时 → kill 兜底，无泄漏） | :66-68 try/except TimeoutExpired → kill | ✅ 绿 |
| TC-port（_server_port 纯函数） | :20-22 + :731-738 四断言 | ✅ 绿 |
| TC-B4b / TC-B4c1（回归护栏） | 正常启动/正常 teardown 路径 | ✅ 保持绿 |

4 个真红灯用例全部转绿，2 个护栏用例未回归，P3 预期（B 类红 → 绿）完全兑现。

## BLOCKER / CRITICAL

无。无 BLOCKER、无 CRITICAL。

INFORMATIONAL（非阻塞，供参考，无需返工）：
1. `:48` 未使用的 `out` 变量（P2 规格逐字保留）
2. `TestCLIRemoteFixture` 继承模块级 `pytestmark = pytest.mark.integration`（:17），在 `-m "not integration"` 过滤下会连 fixture 级测试一起被排除——与该文件既有整体标记一致，属既有特性非本次引入，不影响本任务 4 BDD

## 结论

**approved**。实现与 P2-design §1 候选 1 规格逐行一致，`_server_port` 推导正确、端口范围无冲突、单跑/CI 回退零分叉、teardown 强化满足 I6、P3 四红灯全转绿且护栏不回归。独立实证：串行 23/23、`-n auto` 23/23、ruff 全绿、无残留进程。
