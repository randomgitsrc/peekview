# PeekView Agent 协作能力路线图

> 创建：2026-06-15
> 取代：`docs/plans/cli-api-completeness.md`（已标注过时，见该文件头部）
> 核心视角：**以 Agent 协作场景为驱动，而非 API 完整性对称**

---

## 一、核心定位重申

PeekView 的角色是 **Agent Output Layer**——内容中转站：

```
Agent A 产出内容 → publish → PeekView → Agent B 消费内容
                                      ↓
                              人类在浏览器里查看
```

功能优先级判断标准（按权重）：
1. **直接服务 Agent 协作链路**（发布 / 消费 / 发现内容）
2. **运维 Agent 环境**（给 Agent 配 key、配路径、验证连通）
3. **人类管理 PeekView 服务**（用户管理、系统维护）

---

## 二、现状摸底（基于代码实际调查）

### 已有能力（不需要做）

**Agent 发布端**：
- MCP `publish_files` ✅、`create_entry` ✅
- CLI `peekview create` ✅（local + remote 双模式）
- API `POST /entries` ✅

**Agent 消费端**：
- T007：`GET /api/v1/entries/{slug}/raw` ✅（公开 entry 无需认证）
- T009：`/{slug}` 302 重定向到 `/raw`（短链直达）✅
- MCP `get_entry` ✅、`list_entries` ✅

**用户/认证基础**：
- `peekview user create/list/promote/demote` ✅（local 直连 DB）
- `peekview login/logout` ✅（remote 模式）
- `peekview admin stats/cleanup` ✅（local + remote）
- `peekview apikey create/list/revoke/cleanup` ✅（remote 模式）

**MCP 配置**：
- T001（v0.9.0）：path_namespaces 支持 ✅（手改 YAML 可用）

### 真实缺口分析

#### 缺口1：apikey CLI 强制 remote-only（高优）

`peekview apikey create/list/revoke` 目前强制 remote 模式，本地运行直接报错：
```
Error: API key management requires remote mode.
```

**实际场景**：headless 服务器（无浏览器）部署 PeekView，需要给 MCP Agent 生成 `pv_` key，目前只能开浏览器或者写 curl 脚本。这是真实的运维痛点。

**修复**：去掉 remote-only 限制，local 模式下直连 DB 生成 key，和 remote 模式行为一致。

#### 缺口2：user 管理命令 local-only，remote 完全不可用（高优）

`peekview user create/list/promote/demote` 全部直连 DB，无 `--remote-url` 支持。对 remote 部署的 PeekView，想管理用户只能 SSH 进去。

**实际场景**：PeekView 跑在云服务器上，想新增一个 Agent 的用户账号 → 目前做不到，只能 SSH + sqlite3。

**另一个真实缺口**：`user delete` 完全缺失，想删用户也没有渠道（local 和 remote 都没有）。

**需要新增的后端 API**（admin 权限）：
```
GET    /api/v1/admin/users              # 列出所有用户
GET    /api/v1/admin/users/{id}         # 单个用户详情
PATCH  /api/v1/admin/users/{id}         # 修改（角色/状态/密码重置）
DELETE /api/v1/admin/users/{id}         # 删除（级联）
```

**peekview admin 认证增强**（你的建议）：
- `peekview admin user *` 系列命令通过管理员 API Key 认证
- 认证优先级：`PEEKVIEW_ADMIN_KEY` 环境变量 > `.env` 文件 > `config.remote.api_key`
- 非管理员 key 调用 admin 命令 → 403，明确提示需要管理员权限

#### 缺口3：MCP path_namespace 无 CLI 管理（中优）

v0.9.0 新增的 path_namespaces 功能，只能手改 `~/.peekview/mcp-config.yaml`。没有：
- 命令行添加/删除/列出映射
- 格式校验（写错了没有提示）
- 测试路径翻译是否符合预期

#### 缺口4：MCP 配置校验缺失（中优）

`peekview-mcp config verify` 不存在。配置好 URL 和 key 后，不知道连不连得上、key 对不对，只能真的跑一次 MCP 调用才知道。validators.ts 已写了验证逻辑但没有接线到 CLI。

#### 缺口5：MCP `list_entries` 无过滤参数（中优）

Agent B 想发现 Agent A 发布的内容，目前 `list_entries` 是全量的，没有 `author`/`tag`/`limit`/`since` 参数。多 Agent 协作时发现内容能力弱。

#### 缺口6：peekview raw CLI（低优）

`peekview raw <slug>` 不存在。这主要是本地运维便利——已经连着某个 PeekView 的用户，想在命令行快速看 entry 原始内容。对 Agent 协作没有额外价值（web_fetch + /raw 已经够），但对人类调试有用。

---

## 三、重新排优先级

### 第一批（直接服务 Agent 运维）

**FIX-1：apikey local 模式解锁**
- 文件：`backend/peekview/cli.py`，去掉 `if not _is_remote_mode` 的 remote-only 判断
- 本地模式直连 DB 生成 `pv_` key
- 改动极小（约 20 行），风险低

**NEW-1：user delete 命令**
- `peekview user delete <username>`（本地：直连 DB；remote：调 admin API）
- 级联删除：entries + files + apikeys（本地直连时可直接 SQL 级联；remote 需后端 API 支持）
- 危险操作：`--confirm` 二次确认 + 展示将被删除的数量

**NEW-2：后端 Admin User API**（T011 的后端部分）

新增 5 个端点，全部 `require_admin`：
```
POST   /api/v1/admin/users              # 强制创建用户（不受 allow_registration 限制）
GET    /api/v1/admin/users              # 列出所有用户
GET    /api/v1/admin/users/{id}         # 单个用户详情
PATCH  /api/v1/admin/users/{id}         # 修改角色/状态（promote/demote/disable/enable）
DELETE /api/v1/admin/users/{id}         # 删除用户（级联删除 entries + files + apikeys）
```
认证复用 `require_admin`（现有机制），非 admin key → 403，
CLI 提示「需要管理员账号生成的 API Key」。

**NEW-3：升级 `peekview user` 命令组（接入现有 remote 机制）**
- 统一接入 `_get_backend()` 机制，和 `create/get/list/delete` 一样的模式
- local 模式直连 DB（现有行为不变，无需认证——能执行命令即有权限）
- remote 模式调 Admin API（需要 `config.remote.api_key` 为管理员 key）
- 统一加可选 `--remote-url` 参数（平时通过 `config set remote.url` 配置好，不用每次传）

升级后完整命令集：
```
peekview user create <username>    # local: 直连DB | remote: POST /admin/users（不受 allow_registration 限制）
peekview user list                 # local: 直连DB | remote: GET /admin/users
peekview user delete <username>    # local: 直连DB | remote: DELETE /admin/users/{id}（新增）
peekview user promote <username>   # local: 直连DB | remote: PATCH /admin/users/{id}（新增）
peekview user demote <username>    # local: 直连DB | remote: PATCH /admin/users/{id}（新增）
peekview user disable <username>   # local: 直连DB | remote: PATCH /admin/users/{id}（新增）
peekview user enable <username>    # local: 直连DB | remote: PATCH /admin/users/{id}（新增）
```

**不新增 `peekview admin user` 命令组**：避免和 `peekview user` 重叠混淆。
`peekview admin` 保持现有职责（stats/cleanup），不涉及用户 CRUD。
**不引入 `PEEKVIEW_ADMIN_KEY`**：复用现有 `config.remote.api_key`（管理员用户生成的 key 自然有权限）。

**MCP-1：path_namespace CLI**（T014）
- `peekview-mcp config namespace add <ns> <container> <host>`
- `peekview-mcp config namespace remove <ns> [<container>]`
- `peekview-mcp config namespace list [<ns>]`
- `peekview-mcp config namespace test <ns> <path>`（测试翻译结果）

### 第二批（提升体验）

**MCP-2：config verify + unset**（T015）
- `peekview-mcp config verify`：读配置 → 发 HTTP 健康检查 → 认证验证 → 输出每项状态
- `peekview-mcp config unset <key>`：删除配置项（现在只能手改 YAML）
- 接线已有 validators.ts 的校验逻辑

**MCP-3：list_entries 加过滤参数**（T016）

后端现状（已调查）：
- `tags`/`status`/`q`/`per_page` 过滤已支持 ✅
- `owner="me"` 支持（只能过滤自己）✅
- `author=<username>`（按任意用户名过滤）**不支持** ❌ — 需新增
- `since=<datetime>`（按创建时间过滤）**不支持** ❌ — 需新增

改动范围：
- 后端 `list_entries` service 加 `author`/`since` 参数
- API `GET /entries` 暴露这两个参数
- MCP 工具 `list_entries` 加 `author`/`tag`/`since`/`limit` 参数
- PeekClient 同步更新
- CLI `peekview list` 补 `--author`/`--since` 选项

**NEW-4：peekview raw <slug>**
- 输出 entry 原始内容到 stdout（Markdown/代码原文）
- `--output/-o` 写入文件
- `--json` 输出完整结构化 JSON（同 `/raw` API）

### 第三批（完整性补全）

**NEW-5：user password 修改**
- `POST /api/v1/auth/change-password`（自己改自己）
- `POST /api/v1/admin/users/{id}/reset-password`（admin 重置）
- CLI：`peekview user password`（交互式）

**NEW-6：peekview entry update**
- 修改 entry 元数据（summary/tags/visibility）
- API `PATCH /entries/{slug}` 已有，需补 PeekClient 方法 + CLI

---

## 四、任务拆分

按「最小可独立交付」原则拆分，每个任务独立走 v4 流程：

| 任务 | 内容 | 包 | 优先级 | 依赖 |
|------|------|-----|--------|------|
| T010 | apikey local 模式解锁 | backend | P0 | 无 |
| T011 | Admin User API（5个端点 + service + 级联删除 + 测试）| backend | P0 | 无 |
| T012 | peekview user 命令组升级（含 delete，local+remote，PeekClient+CLI+测试）| backend | P0 | T011 |
| T014 | MCP path_namespace CLI | mcp-server | P0 | 无（已设计）|
| T015 | MCP config verify + unset | mcp-server | P1 | 无（已设计）|
| T016 | MCP list_entries 过滤参数 + 后端 author/since 过滤 | mcp-server + backend | P1 | 无 |
| T017 | peekview raw CLI | backend | P1 | 无 |
| T018 | user password 修改 | backend | P2 | T011 |
| T019 | peekview entry update CLI | backend | P2 | 无 |

**并行说明**：
- T010/T011/T014 可并行（互不依赖）
- T012 依赖 T011（API 稳定后再做 CLI）
- T015/T016/T017 可并行

**任务粒度说明**：
- T011：高风险（级联删除 + 磁盘文件清理），独立验收，gate = pytest admin user API 全绿
- T012：CLI 是一个整体，含 delete 在内所有子命令一起交付，gate = pytest CLI user 全绿
- T010/T014/T015/T017：小任务，改动集中，风险低

---

## 五、peekview user 命令组认证设计

**local 模式**：直连 DB，无需认证。
能在机器上执行命令本身就代表有权限（和现有 create/promote/demote 行为一致，不破坏现有习惯）。
边注：多人共用机器的场景在 PeekView 的个人/小团队定位下极少见，不为此场景增加复杂度。

**remote 模式**：复用现有认证机制，不引入新环境变量。
```
认证优先级（从高到低）：
1. --remote-url 参数（同时触发 remote 模式）
2. 环境变量 PEEKVIEW_REMOTE__URL（已有）
3. config 文件 remote.url（已有）
```

remote 模式下 `config.remote.api_key` 就是管理员 key——管理员用户生成的 `pv_` key 自然有 admin 权限，API 返回 403 时 CLI 提示「需要管理员账号生成的 API Key」。

**peekview admin 命令组**：保持现有职责（stats/cleanup），不涉及用户 CRUD。

---

## 六、明确不做的事（边界声明）

以下功能**有意不做**，避免 Agent 或维护者看到缺口就去填：

| 功能 | 不做的理由 |
|------|-----------|
| `peekview register` CLI | 低频，Web UI 可注册；CLI 注册意义不大 |
| `peekview download` CLI | Agent 不需要（web_fetch 够用），人类用 Web UI |
| `peekview health` CLI | 可通过 `peekview-mcp config verify` 间接覆盖 |
| `peekview logout` CLI | 已有，不在本路线图范围 |
| `peekview whoami` CLI | `peekview admin stats` 已含用户信息，不重复 |
| Web UI 管理后台 | 等后端 API 稳定后再考虑，现在做太早 |
| ApiKey 管理 Web UI | 同上 |
| Entry update CLI（T019）| 暂缓，Agent 直接调 API 更自然；人类用 Web UI |
| Auth change-password CLI | 暂缓（T018），低频运维操作 |

---

## 七、与 cli-api-completeness.md 的关系

`docs/plans/cli-api-completeness.md` 已标注过时（见该文件头部）。

**继承的内容**：
- 现状分析表格（Entry/User/Auth/ApiKey/Admin 资源矩阵）
- 任务编号 T010-T015（T014/T015 仍有效，继续使用）
- 开放问题的答案（级联删除、Admin API 路径、username vs id）

**重大调整**：
- 优先级逻辑从「API 完整性对称」改为「Agent 协作场景驱动」
- T011 拆为两个任务：T011（Admin User API）+ T012（user 命令组升级含 delete）
  API 和 CLI 有自然验收边界；delete 合并进 T012，CLI 层作为整体交付
- T011 降级为 T017/T019（非 Agent 协作必需）
- T012/T013 合并到更小粒度任务
- 新增 T010（apikey local 解锁，最小代价最大收益）
- 新增「peekview admin 认证设计」章节
