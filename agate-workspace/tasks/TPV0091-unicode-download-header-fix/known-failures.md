---
task_id: TPV0091
generated_by: verifier (P5)
---
# 已知失败登记

> **语义边界**：本文件只登记**预存失败**（P5 之前就存在的、与当前任务无关的失败）。
> 当前任务引入的失败用 P5-test-results/ 记录，不写本文件。

## 预存失败（非本任务引入）

| # | 测试文件 | 失败数 | 根因 | 与本任务相关 | 处理计划 |
|---|---------|--------|------|-------------|---------|
| 1 | `tests/test_cli_remote.py::TestCLIRemoteList::test_list_with_tag_filter` | 1 | remote CLI 集成测试（`pytest.mark.integration`），需连接远程 backend `127.0.0.1:18888`，当前未运行 → Connection refused。该文件未被 TPV0091 commit 触碰（git 核实） | 否 | 推迟（TPV0090 待办：`test_cli_remote.py` 在 `-n auto` 下已知预存失败） |
