# P0-brief — T015 MCP config verify + unset

task: "为 peekview-mcp 新增 config verify（连通性验证）和 config unset（删除配置项）两个命令"

known_risks:
  - "verify 需要实际发 HTTP 请求到 PeekView，测试时需要 mock 或运行中的 backend"
  - "unset 删除嵌套 key（如 peekview.url）需要正确处理 section 下只剩空对象的情况"
  - "validators.ts 已有格式校验逻辑，verify 需要接线但不重复实现"

executor_env:
  platform: "claude-project"
  has_task_tool: false
  has_local_runtime: false
  network: "restricted"

env_constraints:
  debug_env: "make debug（:8888）；MCP 测试须用临时 HOME，严禁触碰 ~/.peekview/"

pruning_tendency: "中等 — 单包 CLI 改动，P1+P2+P3+P4+P5+P8，P3-P8 交接 OpenCode"

phase_hint: [P1, P2, P3, P4, P5, P8]
