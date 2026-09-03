# 升级指南

> 本文档记录 PeekView 跨版本升级的**破坏性变更、升级顺序与注意事项**。
> 规则：**有破坏性变更或升级顺序要求时，在这里追加一节**（按版本号，最新在上），
> **不要**写进 `CHANGELOG.md` 的 `[Unreleased]`（bump 时会随新版本滚动错位），
> 也**不要**写进 `README.md`（具体版本信号易过时遗留）。
> 版本条目在发布后保留，不随后续版本修改（历史事实）。

---

## v0.21.0 → v0.22.0（2026-09-03，team 可见性）

**升级顺序：先升后端（peekview 0.22.0），再升 MCP（0.12.0）**，不要颠倒。

### 后端（pipx peekview 0.21.0 → 0.22.0）——安全升级

- 数据迁移幂等（`CREATE TABLE IF NOT EXISTS` + 列存在检查），旧库（无 teams 表、entries 无 team_id）升级启动成功、存量数据完好
- CLI / 前端跟随服务端版本发布，旧命令与旧 API 调用不变
- 行为变化（收紧/更友好，不影响正常使用）：
  - share 三接口（create / list / revoke）非 owner 403 → 404（防存在性枚举）
  - 空文件 entry download：NO_FILES 404 → 空 zip 200

### MCP（npm @peekview/mcp-server 0.11.0 → 0.12.0）——向后兼容，但依赖后端顺序

- 新增 `list_teams` 工具 + `create_entry`/`publish_files` 可选 `team_id` 参数 + `get_entry` 输出新增 `team` 字段（JSON 增量）
- **`list_teams` 依赖后端 `/api/v1/teams` 端点（0.22 才有）**——若 MCP 先升而后端仍为 0.21，`list_teams` 会 404

### ⚠️ 窗口期风险

0.21 后端 + MCP 0.12 时，agent 传 `team_id` 会被 Pydantic 静默忽略（0.21 的 `CreateEntryRequest` 无 `extra=forbid`），内容按默认 `is_public=true` 发布——**团队内容意外变 public**。

两端无法同时升级时：MCP 0.12 配 0.21 后端的窗口期内，**不要让 agent 传 `team_id`**。

---
