# P0-brief — T011 用户管理

task: "新增用户删除+改密码的 API+CLI，含 admin 操作他人和用户自助两套权限模型；顺带补 PeekClient.update_entry() 和 peekview whoami"

known_risks:
  - "级联删除高风险：entries + 磁盘文件 + api keys + user，必须用 entry_service.delete_entry() 而非裸 SQL"
  - "唯一 admin 注销自己的 409+确认流程逻辑复杂，需要完整测试"
  - "admin 不能删自己（400），和唯一 admin 注销自己（允许但 409 确认）是两种不同情况，容易混淆"
  - "user delete remote 模式需要 username→id 的二次查询（GET /admin/users?username=）"
  - "change-password 需要旧密码验证，local 模式不支持（无当前用户概念）"

executor_env:
  platform: "claude-project"
  has_task_tool: false
  has_local_runtime: false
  network: "restricted"

env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）；严禁触碰 ~/.peekview/"

pruning_tendency: "保守 — 涉及级联删除+双权限模型，完整走 P1-P2-P3-P4-P5-P8，P3-P8 交接 OpenCode"

phase_hint: [P1, P2, P3, P4, P5, P8]
