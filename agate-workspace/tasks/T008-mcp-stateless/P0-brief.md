# P0-brief — T008 MCP 无状态模式重构

task: "将 MCP Server 的 Streamable HTTP 传输从有状态（session Map + idle timeout）改为无状态（sessionIdGenerator: undefined），根本消除 session 过期导致 opencode 需要重启的问题"

known_risks:
  - "AsyncLocalStorage 的 sessionContext 传递方式需要调整：从 session 缓存改为每次请求临时 run"
  - "DELETE /mcp 端点语义变化：无状态下无 session 可删，需优雅处理避免客户端报错"
  - "MCP 集成测试中有 session 相关用例需要同步更新或删除"
  - "npm 已发布版本（v0.8.5）与本次改动的版本管理"

env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）；MCP测试用临时HOME，严禁触碰 ~/.peekview/"

pruning_tendency: "保守 — 涉及 MCP server 核心传输层，且有已发布版本，需完整测试覆盖"

phase_hint: [P1, P2, P3, P4, P5, P8]
