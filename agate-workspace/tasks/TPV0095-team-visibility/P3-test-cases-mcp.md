---
phase: P3
task_id: TPV0095
type: test-cases
scope: mcp
batch: mcp
trace_id: TPV0095-P3-test-designer-mcp-20260902
status: draft
agent: test-designer
produced: 2026-09-02
state_marker: "[PROD_NOT_TOUCHED]"
---

# P3 测试用例 — MCP 批（TPV0095 team-visibility，BDD-35~37）

> 本片段由 mcp 批 test-designer 产出，主 Agent 合并为最终 P3-test-cases.md。
> test_code_dir: `packages/mcp-server/tests/`
> gate_commands 引用（P2 §6 固化）：P3_mcp = `make test-mcp-unit`（= packages/mcp-server `npm run test:unit`）

## 状态标记

`[PROD_NOT_TOUCHED]` — 本批只写测试文件（`packages/mcp-server/tests/team-visibility.test.ts`）+ 测试运行器登记（`package.json` test:unit 清单追加一行，属测试基础设施，非实现代码）；未写任何实现代码，未触碰生产 :8080 / ~/.peekview/ / pipx。

## 测试文件与用例清单（1:1 BDD 映射）

| # | 测试名（team-visibility.test.ts） | BDD | 被测对象（P2 §4） | 红灯根因（现状未实现点） |
|---|----------------------------------|-----|------------------|--------------------------|
| 1 | create_entry 传 team_id → POST body 透传 team_id | BDD-35 | createEntry.ts schema 加 `team_id: z.string().optional()` + handler 透传 | schema 无 team_id（zod strip 未知键）→ body.team_id undefined |
| 2 | publish_files 传 team_id → POST body 透传 team_id | BDD-35 | publishFiles.ts schema 加 team_id + handler 透传 | 同上 |
| 3 | client.listTeams() GET /api/v1/teams 带 Bearer 返回 owned/joined | BDD-35 | client.ts 新增 listTeams() | client.listTeams is not a function |
| 4 | list_teams 注册进 remote 模式 common 工具集 | BDD-35 | tools/index.ts 注册 listTeamsTool 到 common | tools/list 不含 list_teams |
| 5 | list_teams 注册进 local 模式 common 工具集 | BDD-35 | 同上（local 与 remote 双模式都有） | 同上 |
| 6 | listTeamsTool handler 无参只读：无查询参数 + Bearer + owned/joined 两分区 | BDD-35 | 新增 src/tools/listTeams.ts | 模块不存在（import 失败） |
| 7 | raw 响应含 team → get_entry 输出含 team: {slug,name} | BDD-36 | getEntry.ts buildOutput 透传 raw.team | GetEntryOutput 无 team 字段 → undefined |
| 8 | raw 响应无 team → get_entry 输出 team: null | BDD-36 | 同上（team: {slug,name}\|null 契约） | 无 team 键 → undefined ≠ null |
| 9 | create_entry description 含 TEAM VISIBILITY + list_teams + omit team_id → PUBLIC 硬提示 | BDD-37 | createEntry.ts description 加 TEAM VISIBILITY 块 | description 无该块 |
| 10 | publish_files description 同上 | BDD-37 | publishFiles.ts description 加 TEAM VISIBILITY 块 | description 无该块 |

**共 10 用例，覆盖 BDD-35~37（BDD-35: 用例 1-6，BDD-36: 用例 7-8，BDD-37: 用例 9-10）。**

## BDD → 断言要点

- **BDD-35**（MCP publish_files/create_entry 传 team_id 发布成功 + list_teams 两分区）：
  - create_entry 与 publish_files handler 传 `team_id: 'proj-a'` → msw 捕获的 POST /api/v1/entries body 含 `team_id: 'proj-a'`（服务端强制 is_public=false / 422 属 backend 批，MCP 层只锁透传）
  - `client.listTeams(token)` → GET /api/v1/teams 带 `Bearer`，返回 `{owned:[{slug,name,member_count}], joined:[...]}` 两分区结构
  - `createTools` remote 与 local 模式工具名清单均含 `list_teams`（P2：注册进 common，双模式都有）
  - listTeamsTool handler 无参只读：请求 URL 无查询串、带 Bearer、输出文本含 owned/joined 分区 slug
- **BDD-36**（MCP get_entry 对 team entry 响应含 team 字段；非成员 404 / 全局 key 200 属 backend 批 P6 矩阵，MCP 层锁 team 字段贯通）：
  - raw 响应含 `team: {slug,name}` → get_entry JSON 输出含同等 team 对象
  - raw 响应无 team（公开/私有/share 访问者）→ get_entry 输出 `team: null`（P2 §4：team: {slug,name}|null，share 访问者不附）
- **BDD-37**（description 含"省略 team_id 默认公开"硬提示）：
  - create_entry 与 publish_files 的 description 均匹配 `/TEAM VISIBILITY/`、含 list_teams 引导、含 omit team_id → PUBLIC 语义（`/omit team_id/i` + `/PUBLIC/`）

## 测试基础设施登记（非实现）

- `packages/mcp-server/package.json` `test:unit` 显式文件清单追加 `tests/team-visibility.test.ts`（vitest include 虽为 glob，但 npm script 是显式清单；不登记则 `make test-mcp-unit` 永不执行本文件 → check-tdd-red 假绿灯）

## 红灯自跑确认（P3 自检）

命令：`cd packages/mcp-server && timeout 300s npx vitest run --reporter=dot`

结果（2026-09-02，TPV0095 引入测试）：
- 本批 10 用例 **10 失败（全红）**，失败类别全部为 **B 类真红灯**（被测目标未实现）：
  1. `create_entry` / `publish_files` 透传：`AssertionError: expected undefined to be 'proj-a'`（schema 无 team_id）
  2. `client.listTeams is not a function`
  3. remote / local 工具集 `expected [...] to include 'list_teams'`
  4. listTeamsTool handler：`Failed to load url ../src/tools/listTeams.js ... Does the file exist?`
  5. get_entry team 字段：`expected undefined to deeply equal { slug: 'proj-a', name: 'Proj A' }` / `expected undefined to be null`
  6. description：`expected 'Create a new PeekView entry...' to match /TEAM VISIBILITY/`（两工具）
- 既有测试回归：25 passed 文件中 324 passed / 7 skipped；唯一额外失败为 `publishFiles.test.ts > 默认白名单：拒绝 cwd/tmpdir 外文件` → `EROFS: read-only file system, mkdtemp '/var/tmp/pv-outside-...'` —— **环境性失败（沙箱 /var/tmp 只读），与 TPV0095 无关的既有用例**，未触碰（本批不写实现、不越 scope）
