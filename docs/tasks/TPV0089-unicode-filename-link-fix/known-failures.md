---
task_id: TPV0089
generated_by: verifier
---
# 已知失败登记

> **语义边界**：本文件只登记**预存失败**（P5 之前就存在的、与当前任务无关的失败）。
> 当前任务引入的失败用 P5-test-results/ 记录，不写本文件。

## 预存失败（非本任务引入）

| # | 测试文件 | 失败数 | 根因 | 与本任务相关 | 处理计划 |
|---|---------|--------|------|-------------|---------|
| 1 | backend/tests/test_cli_remote.py | 4 failed + 3 errors | 仅在 `-n auto`（16 workers xdist）下模块级 fixture 子进程 server 未及时就绪，CLI 连不上 127.0.0.1:18888（Connection refused）；无 xdist 或 `-n 2` 全绿。TPV0089 为 frontend-only，后端零改动 | 否 | 推迟（与本次改动无关，建议另行登记环境 issue） |
| 2 | 全量 E2E（html-render/t058/t052/viewer/search 等 ~20 spec） | ~200+ 失败实例 | CDP 环境问题：html-render 断言 `localhost` 但 debug 地址为 `127.0.0.1:8888`；其余为 16 并发下 CDP Chrome 资源竞争/超时。AGENTS.md 已注明完整 E2E suite 在 CDP 模式下可能超时 | 否 | 推迟（环境性问题；本任务用定向 spec 验证） |
