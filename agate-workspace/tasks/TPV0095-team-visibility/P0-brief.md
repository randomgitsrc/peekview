---
phase: P0
task_id: TPV0095
task_name: team-visibility
trace_id: TPV0095
created: 2026-09-02
status: pending
parent: docs/design-notes/team-visibility.md（v4 终版，plan-eng + plan-design 双独立评审 PASS）
---

# P0-brief — TPV0095 团队可见性机制（Team Visibility）

## task

实现「团队内可见」权限档位：用户可创建/加入多个 team，发布内容时指定 team，团队内成员可见、不 public；private 行为不变。完整链路：后端（数据模型/权限收敛/API）+ 前端（/teams 管理页 + explore Teams tab/badge）+ MCP（team_id 参数 + list_teams 只读工具）。

## 需求来源

`docs/design-notes/team-visibility.md`（v4 终版，双独立评审 PASS）——需求故事见该文档 §2，本 brief 只摘要执行要点，不重复正文。

## 核心业务逻辑（design-note §3-§5 摘要）

1. **可见性三选一**：public / team / private，`team_id` 非空 → 服务端强制 `is_public=false`（不 422）
2. **entry-team 一对多**：`entries.team_id` 单值外键（`ON DELETE SET NULL`——team 删除 → entry 转 private）
3. **成员流**：owner 按 username 直接添加；成员自助退出；无邀请-接受流；team 不可搜索/浏览（防枚举）
4. **权限收敛**：新增 `can_read_entry()` 单一判定（is_public OR owner OR admin OR team_member），替换现状 7 处分散检查（get_entry/list_entries/_resolve_entry/resolve_entry_raw/_check_share_cookie/get_entry_with_share/download_entry_files）
5. **防枚举**：非成员一律 404（非 403）；share 三接口 403 → 404；team 管理接口无权 404；`?team=` 单一"不可用"态（服务端零存在性信号）
6. **share 边界**：owner + admin 可建 group entry share；成员不可（现状代码已保证）；share 生命周期与成员变动无关
7. **star 缺口修复**：两处 starred 可见性条件加 `team_id IN (我的 team)`
8. **archived**：team 可见性不延伸到归档态，保持星标不变量（owner + admin + 星标持有者）
9. **校验契约**：`team_id` 不存在或非成员 → 422（统一文案，防存在性 oracle）；匿名携带 → 422；**绝不静默忽略**（防 team 内容误发 public）

## 关键决策（design-note §9 决策记录，P1/P2 直接采用）

| # | 决策点 | 结论 |
|---|--------|------|
| A | 命名 | **team**（非 organization/group）：扁平、多 Agent 协作惯例、无层级 |
| B | team name 唯一性 | owner 内唯一 `UNIQUE(owner_id, name)`；slug 全局唯一 + `-N` 后缀 |
| C | 成员流 | owner 直接添加，无邀请-接受流；不可搜索/浏览 |
| D | owner 账号失效 | 禁用 → team 冻结；删除 → 沿用现有 CASCADE |
| E | 全局 master key | 可读一切（与 raw/file 现状一致），补 get_entry 分支 + 修存量 bug `get_entry_by_api_key` |
| F | MCP 查询机制 | **否决 get(key)**；list_entries 参数化复用；新增只读 `list_teams`（管理工具不暴露） |
| G | 移动端 tab | 可横向滚动 tab 栏 + 触达 ≥44px，修订 DESIGN.md Tabs 规则 |

## 后端改动清单

- **迁移**（`database.py:_run_migrations`）：先建 teams/team_members 表，再 `ALTER TABLE entries ADD COLUMN team_id ... ON DELETE SET NULL` + 两个索引（`idx_team_members_user_id` / `idx_entries_team_id`）；幂等
- **模型**：Team / TeamMember 表 + `entries.team_id` + `CreateEntryRequest`/`EntryUpdate` 加 `team_id`
- **新 API**：`/api/v1/teams` CRUD + 成员管理（添加/移除/退出），无权一律 404
- **权限收敛**：`can_read_entry()` 帮助函数替换 7 处分散检查
- **存量 bug**：补 `get_entry_by_api_key` 缺失方法（全局 key /download 路径）
- **share 接口**：create/list/revoke 403 → 404
- **star**：两处 starred 条件加 team 成员项

## 前端改动清单

- **/teams 管理页**（新路由）：我拥有的（管理）+ 我加入的（退出）；入口在 UserMenu 下拉 + explore Teams tab 内"管理团队"链接
- **explore**：Teams tab（`?view=teams`）+ team chips（`?team=`）+ entry badge（BaseBadge `team` 变体，禁 emoji）+ 单一"不可用"态
- **状态 × URL 矩阵**：四维互斥（owner/status/starred/team），URL 恢复静默丢弃非法组合
- **卡片 toggle 按钮**：team entry 隐藏 + store 守卫
- **移动端**：可横向滚动 tab 栏 + 修订 DESIGN.md
- **a11y**：tablist/aria-selected、FilterChip label 参数化、badge 文字+图标成对、live region

## MCP 改动清单

- `publish_files` / `create_entry`：加 `team_id`（服务端强制 is_public=false）
- 新增只读工具 `list_teams`（返回 owned/joined 两分区，无参数）
- `create_entry`/`publish_files` description 加引导文案（先调 list_teams 再填 team_id；省略时默认公开！）
- `get_entry`/`list_entries`：`pv_` key 身份透传已验证；全局 key 补 get_entry 分支
- MCP server bump minor（v0.11.0 → v0.12.0，schema 向后兼容）

## known_risks

- **权限检查 7 处收敛**是本任务最大风险：漏改任一读路径 → 团队成员在 files/raw/download 404。P6 必须逐条实跑权限矩阵（§12 测试清单第 1 项）
- **迁移顺序**：必须先建 teams/team_members 表再 ALTER entries（SQLite 被引用表须已存在）；漏改 `check_schema` 对齐 → 生产升级启动即炸
- **防枚举一致性**：team 接口 / share 接口 / 单一不可用态三处都要 404 化，任何 403 残留都会引入存在性 oracle
- **存量 bug 连带**：`get_entry_by_api_key` 缺失 + 全局 key 语义不一致，修 team 权限时一并处理，避免半途 AttributeError
- **前端状态矩阵**：四维互斥 + URL 恢复丢弃规则是纯状态管理复杂度，容易出"双 tab 高亮/残留维度"，P3 测试要覆盖
- **MCP description 文案**：省略 team_id 默认公开的提示是安全线，不能省

## executor_env

platform: opencode
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888 隔离 /tmp/peekview-debug/）；Playwright CDP（:18800 Chrome）；多实例 make debug-extra（跨 host 测试可选）"
lint: "make lint（ruff 0.15.18，系统 python3）+ make typecheck（vue-tsc 5.9.3，CI 强制）"
test: "make test-quick（pytest 9.1.1，venv）+ make test-frontend（vitest 1.6.1）+ make test-mcp-unit"
版本: "peekview 0.21.0 / mcp 0.11.0（VERSIONS.json 唯一版本源）"
严禁: "触碰生产 :8080 / ~/.peekview/ / pipx peekview；不用 npm run dev（代理 :8080 生产）"

## 裁剪倾向

- **不可裁剪**：P2（方案设计，backend 域强制 plan-eng-review）、P6（验收，权限矩阵实跑 + UI Playwright）
- P3 TDD 必走（§12 测试清单 11 项，medium/high risk）
- 涉及 schema 变更 + 安全 + 三端 → 完整 P0-P8，无裁剪

## env-check

启动 P1 前须完成 `docs/process/env-check-protocol.md` 5 项自检（后端 venv/pytest、前端 vitest/vue-tsc、ruff、MCP node_modules、skill 目录）。
