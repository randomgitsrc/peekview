---
task_id: TPV0088
generated_by: verifier
---
# 已知失败登记

> **语义边界**：本文件只登记**预存失败**（P5 之前就存在的、与当前任务无关的失败）。
> 当前任务引入的失败用 P5-test-results/ 记录，不写本文件。

## 预存失败（非本任务引入）

| # | 测试文件 | 失败数 | 根因 | 与本任务相关 | 处理计划 |
|---|---------|--------|------|-------------|---------|
| 1 | backend/tests/test_cli_remote.py | 4~7 failed + 3 errors（`-n auto` 下不稳定，随轮次变化；串行全量 1068 passed/0 failed） | 模块级 fixture 以子进程启动 :18888 server，xdist 16 workers 并发下未及时就绪 → CLI 连接 127.0.0.1:18888 被拒（Connection refused）。与 TPV0089 known-failures 登记的失败模式一致 | 否（TPV0088 零后端改动，backend/ diff 为空） | 推迟（建议另行登记环境 issue，与 TPV0089 同源） |

EXIT_CODE: 0
