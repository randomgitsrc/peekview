---
task_id: T086-admin-settings-consolidation
generated_by: main-agent
---
# 已知失败登记

> **语义边界**：本文件只登记**预存失败**（P5 之前就存在的、与当前任务无关的失败）。
> 当前任务引入的失败用 P5-test-results/ 记录，不写本文件。

## 预存失败（非本任务引入）

| # | 测试文件 | 失败数 | 根因 | 与本任务相关 | 处理计划 |
|---|---------|--------|------|-------------|---------|
| 1 | `backend/tests/test_cli_remote.py`（`pytest.mark.integration`） | 3 failed + 3 errors | 全文件标注 `pytest.mark.integration`，需要一个运行中的远程 peekview 服务（`127.0.0.1:18888`）才能通过；本次 P8 `make pre-publish-quick` 执行环境未启动该远程服务，报 `Connection refused` | 否——T086 全部改动在 `frontend-v3/` 内（domains: [frontend]，P2-design.md 已声明），零后端/CLI 代码改动，与该测试文件无任何关联 | 推迟。已用 `pytest -m "not integration"` 验证排除该文件后其余 1052 passed/2 skipped/0 failed，确认失败面精确隔离在这一个 integration 文件，非本次改动引入回归 |

## 验证记录

```
$ .venv/bin/python -m pytest tests/ -n auto --tb=short   # 全量（含 integration）
3 failed, 1063 passed, 2 skipped, 3 errors

$ .venv/bin/python -m pytest tests/ -n auto -m "not integration"   # 排除 integration
1052 passed, 2 skipped, 0 failed
```
