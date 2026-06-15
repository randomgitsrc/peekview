# P0-brief — T001 MCP Path Namespace Mapping

task: "MCP Server 新增路径命名空间映射，解决 Docker 容器内 Agent（Hermes/OpenClaw）的路径空间错位问题：容器内路径 /opt/data 映射到主机 ~/docker-data1，Agent 调用 publish_files 时自动翻译路径"

known_risks:
  - "T008 已将 MCP 改为无状态模式，原方案「namespace 存 session」已不适用，需改为「每次请求从 header 读取 namespace」"
  - "OpenClaw 有已知 bug（issue #65590）：streamable-http transport 可能不转发自定义 header，需用户实测验证"
  - "allowed_paths 当前不展开 ~，配置 ~/xxx 会静默失效（现有 bug），本任务顺带修复"
  - "多容器同一容器内路径（如两个容器都用 /opt/data）必须通过不同 namespace 区分，配置错误会导致路径串"
  - "namespace 标识不是安全凭证，翻译后路径仍须走完整安全链（realpath→denylist→allowlist）"

executor_env:
  platform: "opencode"
  has_task_tool: true
  has_local_runtime: true
  network: "full"

env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）；MCP 测试须用临时HOME，严禁触碰 ~/.peekview/"

pruning_tendency: "保守 — 涉及 MCP 安全链核心路径，建议走完整 P1-P2-P3-P4-P5-P8；P3/P4/P5 需交接给 OpenCode 执行"

phase_hint: [P1, P2, P3, P4, P5, P8]
