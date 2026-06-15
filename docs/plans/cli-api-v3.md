# PeekView CLI/API 补全方案 v2

> 创建：2026-06-15
> 取代：`docs/plans/agent-collaboration-roadmap.md`（已标注过时）
> 核心原则：**痛点驱动 + 留好接口**

---

## 一、定位与原则

PeekView 是 **Agent Output Layer**——内容中转站。功能优先级：

1. Agent 协作链路（发布 / 消费 / 发现）
2. Agent 环境运维（配 key、配路径、验证连通）
3. 人类管理服务（用户管理、系统维护）

**判断标准**：有真实痛点才做，但 API 层不留结构性缺口（给未来留接口）。

---

## 二、现状

### 已有能力 ✅

| 能力 | CLI | API | MCP | local | remote |
|------|-----|-----|-----|-------|--------|
| Entry 创建 | `peekview create` | `POST /entries` | `publish_files` / `create_entry` | ✅ | ✅ |
| Entry 获取 | `peekview get` | `GET /entries/{slug}` | `get_entry` | ✅ | ✅ |
| Entry 列表 | `peekview list` | `GET /entries` | `list_entries` | ✅ | ✅ |
| Entry 删除 | `peekview delete` | `DELETE /entries/{slug}` | `delete_entry` | ✅ | ✅ |
| Entry raw | — | `GET /entries/{slug}/raw` ✅ | — | — | — |
| Entry 更新 | — | `PATCH /entries/{slug}` ✅ | — | — | — |
| 用户创建 | `user create` | `POST /auth/register` | — | ✅ | ❌ |
| 用户列表 | `user list` | ❌ | — | ✅ | ❌ |
| 用户升降级 | `user promote/demote` | ❌ | — | ✅ | ❌ |
| 登录 | `peekview login` | `POST /auth/login` | — | ❌ | ✅ |
| API Key 管理 | `apikey create/list/revoke` | CRUD ✅ | — | ❌ | ✅ |
| 管理员统计 | `admin stats/cleanup` | CRUD ✅ | — | ✅ | ✅ |
| MCP path namespace | — | — | ✅（运行时）| — | — |
| MCP 配置管理 | `config set/get/list` | — | — | ✅ | — |

### 缺口总览

| # | 缺口 | 痛点 | 优先级 |
|---|------|------|--------|
| 1 | apikey CLI 强制 remote-only | headless 服务器无法生成 key | P0 |
| 2 | 用户删除缺失 | 废弃 Agent 账号无法清理 | P0 |
| 3 | 用户改密码缺失 | 密码设了改不了 | P0 |
| 4 | MCP path_namespace 无 CLI 管理 | 只能手改 YAML | P0 |
| 5 | MCP 配置校验缺失 | 配了不知道对不对 | P1 |
| 6 | `whoami` 缺失 | remote 模式无法确认身份 | P1 |
| 7 | `PeekClient.update_entry()` 缺失 | API 有端点但客户端没方法 | P1（留接口） |

---

## 三、缺口详解与设计

### 缺口1：apikey local 模式解锁

**现状**：`peekview apikey create` 强制 remote，local 直接报错。

**场景**：headless 服务器部署 PeekView，需给 MCP Agent 生成 `pv_` key，无浏览器可用。

**修复**：去掉 remote-only 限制，local 模式直连 DB 生成 key。改动极小（约 20 行），风险低。

### 缺口2+3：用户删除 + 改密码

**场景**：多个 Agent 各有账号，Agent 不用了 → 账号/key/entry 全变垃圾，无法清理。密码设了改不了。

#### 权限模型

| 操作 | 谁能做 | 对象 | 认证 | CLI 模式 |
|------|--------|------|------|---------|
| 管理员删用户 | admin | 任何人，除自己 | require_admin | local 直连 DB / remote 调 API |
| 自助注销 | 任何登录用户 | 只能自己 | require_auth | remote only |
| 管理员重置密码 | admin | 任何人 | require_admin | local 直连 DB / remote 调 API |
| 自助改密码 | 任何登录用户 | 只能自己 | require_auth | remote only |

#### 唯一 admin 注销自己

允许，视为**重置系统**：
- 唯一 admin 调 `DELETE /auth/me` → 后端检测到是最后一个 admin → 返回 409 + 提示"这是最后一个管理员，注销将清空所有数据"
- CLI 收到 409 → 展示警告，要求输入 username 确认
- 确认后级联删除：entries + 磁盘文件 + api keys + user
- 系统回到初始状态，下一个注册/创建的用户自动成为 admin（复用现有首用户逻辑）

#### 级联删除

删除用户时必须清理：
1. **entries + 磁盘文件**：逐个调用 `entry_service.delete_entry()`（确保文件清理，不用裸 SQL）
2. **API keys**：删除该用户所有 `pv_` key
3. **user 行**：删除 user 记录

#### API 端点

```
# 管理员端点（require_admin）
GET    /api/v1/admin/users              # 列出用户（支持 ?username= 查询）
DELETE /api/v1/admin/users/{user_id}    # 删用户（不能删自己 → 400）
POST   /api/v1/admin/users/{user_id}/reset-password  # 重置他人密码

# 自助端点（require_auth）
DELETE /api/v1/auth/me                  # 注销自己（级联；唯一 admin → 409 需确认）
POST   /api/v1/auth/change-password     # 改自己密码（需旧密码验证）
```

**`GET /admin/users` 查询参数**：
- 无参数：返回所有用户（分页）
- `?username=alice`：精确匹配，返回单个用户（CLI remote 模式的 username→id 解析用）
- `?page=1&per_page=20`：分页

**`DELETE /auth/me` 唯一 admin 处理**：
- 检测 `DELETE` 请求者是最后一个 admin → 返回 409 + body `{error: {message: "...", code: "last_admin", confirm_required: true}}`
- CLI 收到 409 → 提示用户输入 username 确认 → 重发 `DELETE /auth/me?confirm_username=alice`
- 服务端验证 `confirm_username` 匹配 → 执行删除

#### CLI 命令

```
peekview user delete <username>            # 管理员删人
  local:  直连 DB，级联删除，确认提示
  remote: GET /admin/users?username= → 拿 id → DELETE /admin/users/{id}

peekview user reset-password <username>    # 管理员重置密码
  local:  直连 DB，生成随机密码或交互输入
  remote: POST /admin/users/{id}/reset-password

peekview user change-password              # 自助改密码（remote only）
  交互式输入旧密码 + 新密码
  remote: POST /auth/change-password
```

local 模式认证模型：控制台即管理员（和现有 `user create/promote/demote` 一致）。

### 缺口4：MCP path_namespace CLI

```
peekview-mcp config namespace add <ns> <container_path> <host_path>
peekview-mcp config namespace remove <ns> [<container_path>]
peekview-mcp config namespace list [<ns>]
```

- `add`：container_path 必须以 `/` 开头（绝对路径）；host_path 可含 `~`
- `remove`：无 container_path 则删除整个 namespace
- `list`：无 ns 参数则列出所有
- 同步更新 `ConfigFileData.server` 类型声明，补 `path_namespaces`
- `config list` 输出补 path_namespaces 展示

### 缺口5：MCP config verify + unset

```
peekview-mcp config verify
  → 校验所有配置项格式（接线 validators.ts）
  → HTTP 连接测试（GET /health）
  → 认证测试（如有 api_key，验证有效性）
  → 输出每项状态 ✅/❌

peekview-mcp config unset <key>
  → 删除配置项（从 YAML 文件移除键）
```

### 缺口6：whoami

```
peekview whoami
  remote only: GET /auth/me → 显示 username、is_admin、created_at
  local: 不支持（本地没有"当前用户"概念）
```

### 缺口7：PeekClient.update_entry()

`PATCH /entries/{slug}` API 已存在，PeekClient 缺对应方法。补上 `update_entry()` 方法，为未来 CLI 命令留接口。**本期不做 CLI 命令。**

---

## 四、任务拆分

每个任务独立走 workflow-v4 P0-P8。

| 任务 | 内容 | 包 | 优先级 | 依赖 |
|------|------|-----|--------|------|
| T010 | apikey local 模式解锁 | backend | P0 | 无 |
| T011 | 用户管理（API + CLI：delete / password / whoami + PeekClient.update_entry） | backend | P0 | 无 |
| T014 | MCP path_namespace CLI | mcp-server | P0 | 无 |
| T015 | MCP config verify + unset | mcp-server | P1 | 无 |

### T011 范围明细

**API 层**（5 个端点）：
- `GET /admin/users` — 列出/查询用户
- `DELETE /admin/users/{user_id}` — 管理员删用户
- `POST /admin/users/{user_id}/reset-password` — 管理员重置密码
- `DELETE /auth/me` — 自助注销（级联，唯一 admin 409+确认）
- `POST /auth/change-password` — 自助改密码

**Service 层**：
- `admin_service.delete_user(user_id)` — 级联删除（entries + files + apikeys + user）
- `admin_service.list_users(username=None)` — 列出/查询用户
- `admin_service.reset_password(user_id)` — 重置密码
- `auth_service.change_password(user_id, old_password, new_password)` — 改密码
- `auth_service.delete_self(user_id, confirm_username=None)` — 注销自己

**PeekClient 层**（3 个新方法）：
- `list_users(username=None)` — GET /admin/users
- `delete_user(user_id)` — DELETE /admin/users/{user_id}
- `reset_user_password(user_id)` — POST /admin/users/{id}/reset-password
- `change_password(old_password, new_password)` — POST /auth/change-password
- `delete_self(confirm_username=None)` — DELETE /auth/me
- `whoami()` — GET /auth/me
- `update_entry(slug, **kwargs)` — PATCH /entries/{slug}

**CLI 层**（4 个命令）：
- `peekview user delete <username>` — local + remote
- `peekview user reset-password <username>` — local + remote
- `peekview user change-password` — remote only
- `peekview whoami` — remote only

**测试**：
- API 端点测试（pytest）
- 级联删除测试（entries + files + apikeys 确认全部清理）
- 唯一 admin 注销测试（409 + 确认流程）
- CLI local 模式测试
- CLI remote 模式测试（mock PeekClient）
- PeekClient 方法测试

### 并行关系

```
T010 ──┐
T011 ──┤── 可并行
T014 ──┤
T015 ──┘
```

---

## 五、认证设计

### local 模式

直连 DB，无需认证。控制台即管理员（和现有 `user create/promote/demote` 一致）。

例外：`change-password` 和 `whoami` 不支持 local 模式——前者需要旧密码验证（本地无此机制），后者没有"当前用户"概念。

### remote 模式

复用现有认证机制：

```
认证优先级（从高到低）：
1. --remote-url 参数（同时触发 remote 模式）
2. 环境变量 PEEKVIEW_REMOTE__URL
3. config 文件 remote.url

认证凭据：
- config.remote.token（JWT，peekview login 存入）
- config.remote.api_key（pv_ key，管理员 key 自然有 admin 权限）
```

API 返回 403 时 CLI 提示："需要管理员账号的 API Key 或已登录的 admin 账号"。

### user delete 在 remote 模式下的 username→id

```
peekview user delete alice --remote-url https://...
  → CLI 内部：GET /admin/users?username=alice → 拿到 user_id
  → CLI 内部：DELETE /admin/users/{user_id}
  → 用户看到：删除用户 alice（2 entries，1 API key）确认？[y/N]
```

---

## 六、边界声明

### 不做

| 功能 | 理由 |
|------|------|
| MCP `list_entries` 过滤参数 | 伪需求——Agent 协作是 URL 直传，不需要「发现」 |
| `peekview register` CLI | 低频，Web UI 可注册 |
| `peekview download` CLI | local 模式文件在磁盘，remote 低频；移 backlog |
| user promote/demote/disable/enable 的 remote 化 | 无痛点，local 直连 DB 可解决 |
| `peekview entry update` CLI | 无痛点，但 API 已有端点 |

### 移入 backlog

| 功能 | 理由 | 触发条件 |
|------|------|---------|
| `peekview raw <slug>` CLI | 本地运维便利，web_fetch+/raw 已覆盖 | 有人要求本地 pip 到 stdout |
| `peekview entry update` CLI | 低频，Agent 直接调 API | 有人反馈需要 CLI 改 tags/visibility |
| `peekview download <slug>` CLI | headless backup 场景 | 有人反馈需要 CLI 导出 ZIP |
| Web UI 用户管理页 | 依赖 T011 API，人类自助 | 第二期 |

### 留了接口但不做 CLI

- `PeekClient.update_entry()` — 补方法，未来 CLI 命令可用
- `GET /admin/users` — T011 一起做，同时服务 CLI remote 和未来 Web UI

---

## 七、与历史文档的关系

| 文档 | 状态 | 说明 |
|------|------|------|
| `docs/plans/cli-api-completeness.md` | ⚠️ 过时 | v1 方案，API 完整性对称思路 |
| `docs/plans/agent-collaboration-roadmap.md` | ⚠️ 过时 | v2 方案，评审发现 7 个问题 |
| 本文档 | ✅ 当前 | v3 方案，吸收评审意见重写 |

**与 agent-collaboration-roadmap.md 的主要差异**：

| 项 | roadmap（v2） | 本文档（v3） |
|----|-------------|------------|
| `whoami` | 不做 | ✅ 补（普通用户 remote 下需确认身份） |
| `download` CLI | 不做 | backlog（headless 场景成立但不急） |
| `PeekClient.update_entry()` | 未提及 | ✅ 补方法（留接口，不做 CLI） |
| 唯一 admin 注销 | 矛盾（既说禁止又说允许） | 明确：允许 + 409 确认流程 |
| T011/T012 拆分 | 两个任务 | 合并为 T011（同包同端，减少协调） |
| username→id | 未解决 | `GET /admin/users?username=` 解决 |
| `GET /admin/users` | 在 T011 但边界声明矛盾 | 明确在 T011 范围内 |
| config verify | T015 | T015（不变） |
| path_namespace test 命令 | T014 含 `test` 子命令 | T014 不含（运行时已校验，CLI test 价值低） |
