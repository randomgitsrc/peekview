---
task_id: TPV0095
generated_by: orchestrator (main)
---
# 已知失败登记

> **语义边界**：本文件只登记**预存失败**（P5 之前就存在的、与当前任务无关的失败）。
> 当前任务引入的失败用 P5-test-results/ 记录，不写本文件。

## 预存失败（非本任务引入）

| # | 测试文件 | 失败数 | 根因 | 与本任务相关 | 处理计划 |
|---|---------|--------|------|-------------|---------|
| 1 | backend/tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key | 1 | DSH 沙箱环境性：测试写真实 ~/.peekview/config.yaml 被沙箱只读拦截（Errno 30 Read-only file system）；非 TPV0095 代码问题 | 否 | 推迟（沙箱限制，P2 HEAD 461936ad 上同样失败，预存确认） |
| 2 | backend/tests/test_prometheus_metrics.py::test_metrics_prometheus_format | 1 | /metrics 响应缺 http_requests_total counter（prometheus instrumentator 行为/配置，与 team 功能无关）；P2 HEAD 461936ad 上同样失败，预存确认 | 否 | 推迟（独立于 TPV0095 的既有失败） |

> 两条均在 P2 HEAD（461936ad，TPV0095 代码改动前）worktree 实测复现 → 预存确认，不阻断 P5 推进（WARNING 级）。

| 3 | backend/tests/test_admin_backup.py（backup .tmp 竞态） | 1（首轮，重跑全绿） | 并发/时序竞态（TPV0092 同源），P5 首轮出现 1 次、隔离+文件级复跑双绿 | 否 | 推迟（flaky 一振，预存确认） |
