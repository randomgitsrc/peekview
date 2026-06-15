# P0-brief — T010 apikey local 模式解锁

task: "去掉 peekview apikey create/list/revoke/cleanup 的 remote-only 限制，local 模式直连 DB 生成和管理 pv_ key"

known_risks:
  - "local 模式生成 key 需要确认 DB schema 和现有 remote 模式行为一致（key 格式、hash 方式）"
  - "cleanup 命令的 local 模式需要确认过期逻辑（按 expires_at 字段）"

executor_env:
  platform: "claude-project"
  has_task_tool: false
  has_local_runtime: false
  network: "restricted"

env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）；严禁触碰 ~/.peekview/"

pruning_tendency: "激进 — 单文件小改动，P1+P2+P4+P5，跳过 P3/P6/P7（无 UI，改动集中，风险低）"

phase_hint: [P1, P2, P4, P5, P8]
