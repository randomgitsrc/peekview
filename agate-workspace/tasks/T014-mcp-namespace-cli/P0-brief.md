# P0-brief — T014 MCP path_namespace CLI

task: "为 peekview-mcp 新增 namespace 子命令组（add/remove/list），方便配置和管理 path_namespaces 映射，替代手动编辑 YAML"

known_risks:
  - "ConfigFileData 类型声明需要补 path_namespaces 字段（目前 TS 类型未声明）"
  - "config list 输出需要同步展示 path_namespaces"
  - "YAML 读写需要保留注释和格式（用 yaml 库而非 JSON.stringify）"
  - "v3 plan 明确 T014 不含 namespace test 子命令（运行时已校验，CLI test 价值低）"

executor_env:
  platform: "claude-project"
  has_task_tool: false
  has_local_runtime: false
  network: "restricted"

env_constraints:
  debug_env: "make debug（:8888）；MCP 测试须用临时 HOME，严禁触碰 ~/.peekview/"

pruning_tendency: "中等 — 单包 CLI 改动，P1+P2+P3+P4+P5+P8，P3-P8 交接 OpenCode"

phase_hint: [P1, P2, P3, P4, P5, P8]
