---
phase: P3
task_id: TPV0090-cli-remote-xdist-fix
type: test-cases
parent: P2-design.md
trace_id: TPV0090-P3-20260813
status: draft
created: 2026-08-13
agent: test-designer
---

# P3 测试用例 — test_cli_remote.py xdist 并发失败修复

test_code_dir: backend/tests/test_cli_remote.py

## 测试设计概要

- **修复对象**：`server_url` module-scope fixture（test_cli_remote.py:19-59）——本次任务唯一改动点（P2-design §0）
- **测试策略**：fixture 级测试。monkeypatch `subprocess.Popen` 返回假 proc（不启动真实进程），monkeypatch `requests.get` / `time.sleep` 控制健康检查路径，通过 **`server_url.__wrapped__`** 直接调用 fixture 函数体（pytest 9.1.1 禁止 `server_url()` 直接调用——`FixtureFunctionDefinition.__call__` 抛 `Failed: Fixture called directly`，`__wrapped__` 是绕过的稳定通道，已实测）
- **TDD 红灯**：fixture 未改造 → 无 poll 死亡检测 / teardown 无 kill 兜底 / 无 `_server_port` 函数 → TC-B4a、TC-B4d、TC-B4c2、TC-port 断言失败（B 类），TC-B4b、TC-B4c1 为回归护栏（改造前后均绿）
- **A/B 类规避**：check-tdd-red.sh 判定 errors>0 为 A 类（exit 1）。测试禁止让 fixture 抛非断言异常泄漏（如 `TimeoutExpired` 从 teardown 泄漏会被判 A 类）→ TC-B4c2 用 try/except 包裹 `gen.close()` 转为断言失败；TC-port 用 `globals().get("_server_port")` 避免改造前 NameError（NameError = ERROR = A 类）
- **ui_affected: false** → 无 Playwright/E2E 用例
- **真实运行验证（BDD-1/2/3 主体）**：属 P6 实测范畴（概率性失败必须真实命令关闭），不写死测试代码

## BDD 映射（1:1）

| BDD | 验收方式 | 本文件支撑用例 |
|-----|---------|---------------|
| BDD-1（`-n auto` 连续 3 次零失败） | **P6 实测**：gate_commands.P5_cli_remote 连续 3 次 | TC-port（端口唯一推导支撑） |
| BDD-2（`make test-quick` 全绿） | **P6 实测**：gate_commands.P5 | — |
| BDD-3（单跑 17/17 不回归） | **P6 实测**：gate_commands.P5_serial | TC-B4b（正常启动回归护栏） |
| BDD-4（死亡快速失败含诊断） | fixture 级测试（本文件） | TC-B4a（rc + 快速）、TC-B4d（stderr 摘要） |
| I6（teardown 回收，P1 隐含需求） | fixture 级测试（本文件） | TC-B4c1（正常路径）、TC-B4c2（wait 超时 → kill） |

> BDD-1/2/3 无单测断言可写（`-n auto` 是 pytest 调度行为，非函数行为），设计为 P6 实测——与 P2-design §3 BDD 映射表一致（BDD-4 走 fixture 级测试，其余 P6）。

## 测试用例清单（6 用例，追加到 test_cli_remote.py 尾部新类 `TestCLIRemoteFixture`）

### TC-B4a — server 启动阶段死亡 → fixture 快速 raise RuntimeError 含 rc（BDD-4）
- Given 假 proc：`poll() -> 3`（立即死亡）、`returncode=3`；`requests.get` 抛 ConnectionError；`time.sleep` 空操作
- When 测试通过 `server_url.__wrapped__(tmp_path_factory)` 请求 fixture
- Then `next(gen)` 抛 `RuntimeError` 且消息匹配 `rc=3`；真实耗时 `< 5s`（不进入完整 15s 等待窗口）
- 当前状态：**红**（现 fixture 无 poll 检测 → 消息无 `rc=` → pytest.raises match 失败）

### TC-B4d — 死亡报错含 stderr 摘要（BDD-4 诊断）
- Given 假 proc：`poll() -> 1`、`returncode=1`、`stderr=b"Error binding socket: address already in use"`（模拟端口绑定失败）
- When 请求 fixture
- Then `RuntimeError` 消息同时含 `rc=1` 与 `address already in use`（stderr 摘要片段）
- 当前状态：**红**（现 fixture 消息为无信息量 "Server failed to start"）

### TC-B4b — 正常启动 → fixture 正常 yield，行为不变（BDD-3 回归护栏）
- Given 假 proc：`poll() -> None`（存活）、`returncode=0`；`requests.get` 返回 200
- When 请求 fixture 并 `next(gen)`
- Then yield 的 URL 与 `PEEKVIEW_SERVER__PORT` env 一致（`http://127.0.0.1:{port}`）；`--port` CLI 参数与 env 端口一致；`gen.close()` 不抛异常
- 当前状态：**绿**（改造前后均通过——护栏语义）

### TC-B4c1 — teardown 正常路径：terminate → wait(5)（I6）
- Given 假 proc：`wait()` 正常返回 0
- When 请求 fixture、`next(gen)`、`gen.close()`
- Then 调用序列含 `terminate` 与 `wait:5`，`gen.close()` 不抛异常
- 当前状态：**绿**（改造前后均通过）

### TC-B4c2 — teardown 超时路径：wait 抛 TimeoutExpired → kill() 兜底（I6）
- Given 假 proc：`wait()` 首次调用抛 `subprocess.TimeoutExpired`，后续调用返回 0（模拟进程不退让）
- When 请求 fixture、`next(gen)`、`gen.close()`（try/except 包裹，任何泄漏异常转为断言失败）
- Then `gen.close()` 不抛异常；调用序列含 `kill` 与 `terminate`
- 当前状态：**红**（现 fixture teardown 无 try/except → `TimeoutExpired` 泄漏 → 断言失败）

### TC-port — `_server_port` 纯函数端口推导（BDD-1/3 支撑，P2-design §9）
- Given `_server_port` 为 P4 新增模块级纯函数（现不存在）
- When `globals().get("_server_port")` 获取并逐例调用
- Then `None → 18888`、`"gw0" → 18888`、`"gw7" → 18895`、`"gw15" → 18903`（每 worker 唯一端口）
- 当前状态：**红**（改造前函数不存在 → 首条断言失败；用 `globals().get` 而非直接引用，避免 NameError 被判 A 类）

## 测试代码辅助结构

- `_FakeProc`（模块级私有类）：`poll/communicate/terminate/kill/wait` 记录调用序列到 `calls`；`wait_raises_once` 控制首调抛 `subprocess.TimeoutExpired`
- `_popen_capture(fake, monkeypatch, *, health_ok, fast_dead)`（模块级辅助）：patch `subprocess.Popen` 返回 fake 并捕获调用参数；`health_ok=True` 时 patch `requests.get` 返回 200，否则抛 ConnectionError；`fast_dead=True` 时 patch `time.sleep` 为空操作（加速红灯运行）

## 验证命令（与 P2-design §4 gate_commands.P3 一致）

```bash
cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -v --tb=short
```

## 红灯预期（当前，P3 gate 判定依据）

- exit 非 0；`failed` 计数 = 4（TC-B4a / TC-B4d / TC-B4c2 / TC-port），`errors` = 0（B 类）
- 17 个既有 CLI 用例串行不受影响（P2-review 实证串行 17/17 全绿）
