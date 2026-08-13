---
phase: P6
task_id: TPV0090-cli-remote-xdist-fix
type: acceptance
parent: P5-test-results
trace_id: TPV0090-P6-20260813
status: draft
created: 2026-08-13
agent: verifier
# ── v2.0 机器汇总 ──
pass: 4          # BDD PASS 数
fail: 0          # BDD FAIL 数
ui_affected: false
---

# P6 验收 — test_cli_remote.py xdist 并发失败修复

验收对象：P4 实现（`server_url` fixture 动态端口 + poll 死亡检测 + teardown 强化 + `_server_port` 纯函数，`backend/tests/test_cli_remote.py`）。
验收方式：本地 pytest 实测（纯测试基础设施，无 UI，ui_affected: false）。环境：backend/.venv（Python 3.12.3, pytest 9.1.1, xdist 3.8.0），16 workers。

## BDD 逐条验收

- PASS BDD-1: 并发模式全绿——`pytest tests/test_cli_remote.py -n auto` 连续 5 次运行（Run1-4 为 `-q`，Run5 默认 verbosity）全部 EXIT_CODE: 0，无 failed/error，无 "Server failed to start"；Run5 显式摘要 `23 passed, 16 warnings in 10.02s`（23 用例全过）(P6-evidence/bdd1-xdist-consecutive.log)
- PASS BDD-2: 完整 `make test-quick`（`pytest tests/ -n auto --tb=short`）全绿——`1078 passed, 3 skipped, 25 warnings in 28.67s`，EXIT_CODE: 0，0 FAILED/0 ERROR 行；test_cli_remote 用例零失败（warnings 仅 PytestUnknownMarkWarning 与既有 DeprecationWarning，与改动无关）(P6-evidence/bdd2-full-suite.log)
- PASS BDD-3: 单跑（无 xdist）不回归——`pytest tests/test_cli_remote.py --tb=short` → `23 passed, 1 warning in 23.03s`，EXIT_CODE: 0，0 failed/0 error/0 skipped（修复后 23 用例 = 17 既有全部通过 + 6 新增 fixture 级用例，与修复前行为一致）(P6-evidence/bdd3-serial.log)
- PASS BDD-4: server 子进程启动阶段死亡时 fixture 快速失败且报错含诊断——fixture 级测试 TC-B4a（`test_b4a_death_raises_with_rc`：假 proc 立即死亡 rc=3 → fixture raise RuntimeError 含 `rc=3` 且耗时 <5s，不进入完整等待窗口）+ TC-B4d（`test_b4d_death_message_includes_stderr`：死亡报错同时含 `rc=1` 与 stderr 摘要 `address already in use`）单跑 2 passed in 0.36s，EXIT_CODE: 0 (P6-evidence/bdd4-fixture-death.log)

## 环境隔离

- 测试全部走 `tmp_path_factory` 临时目录与子进程隔离环境，未触碰生产数据
- 生产库 `~/.peekview/peekview.db` mtime 保持 1786540641（与 P5 记录一致，全程未变）
- 无残留测试 server 进程（pgrep "serve --port" 为空），端口 18888-18903 全部释放
- 生产 :8080（PID 70846 pipx serve）全程存活，未触碰

**Summary**: 4/4 PASS, 0 FAIL

[NO_NEED_CONFIRM]
[PROD_NOT_TOUCHED]
