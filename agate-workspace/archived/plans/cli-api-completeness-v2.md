# PeekView CLI/API 补全方案 v2

> ⚠️ **此文档已过时**
> 取代文档：`docs/plans/cli-api-v3.md`（2026-06-15）
> 本文档保留作为历史参考，不再更新

---

## 一、核心定位

PeekView 是 **Agent Output Layer**——内容中转站：

```
Agent A 产出内容 → publish → PeekView → Agent B 消费内容
                                      ↓
                              人类在浏览器里查看
```

优先级判断标准：
1. **直接服务 Agent 协作链路**（发布 / 消费 / 发现内容）
2. **运维 Agent 环境**（给 Agent 配 key、配路径、验证连通）
3. **人类管理 PeekView 服务**（用户管理、系统维护）

---

## 二、现状（已完成的能力，不需要做）

### Agent 发布端
- MCP `publish_files` ✅、`create_entry` ✅
- CLI `peekview create` ✅（local + remote）
- API `POST /entries` ✅

### Agent 消费端
- `GET /entries/{slug}/raw` ✅（公开 entry 无需认证）
- `/{slug}` 短链重定向 ✅
- MCP `get_entry` ✅、`list_entries` ✅

### 用户/认证
- `peekview user create/list/promote/demote` ✅（local 直连 DB）
- `peekview login` ✅（remote 模式）
- `peekview admin stats/cleanup` ✅（local + remote）
- `peekview apikey create/list/revoke/cleanup` ✅（remote only）

### MCP
- path_namespaces ✅（v0.9.0，手改 YAML 可用）

### PeekClient（remote 模式 HTTP 客户端）
- `create_entry` / `get_entry` / `list_entries` / `delete_entry` ✅
- `login` / `create_api_key` / `list_api_keys` / `revoke_api_key` / `cleanup_expired_keys` ✅
- `admin_stats` / `admin_cleanup` ✅

---

## 三、缺口清单（按优先级）

### 缺口1：apikey CLI 强制 remote-only

**痛点**：headless 服务器无浏览器，无法通过 CLI 给本地 MCP Agent 生成 `pv_` key。只能 curl 或绕远路。

**修复**：去掉 remote-only 限制，local 模式直连 DB 生成 key。

### 缺口2：删用户 + 改密码完全缺失

**痛点**：Agent 不用了，账号/key/entry 全变垃圾，无渠道清理。密码改不了。

**权限模型**：

| 操作 | 谁能做 | 对象 | 认证 |
|------|--------|------|------|
| 管理员删用户 | admin | 任何人（除自己） | require_admin |
| 自助注销 | 任何登录用户 | 只能自己 | require_auth |
| 管理员重置密码 | admin | 任何人 | require_admin |
| 自助改密码 | 任何登录用户 | 只能自己 | require_auth |

**唯一 admin 注销自己**：允许，但需二次确认。语义 = 重置系统（清空所有数据），下一个注册用户自动成为 admin。这是用户自己的实例，有权清空重来。

**级联删除**：entries → `entry_service.delete_entry()`（清理磁盘文件）→ api keys → user。

### 缺口3：whoami 缺失

**痛点**：remote 模式下普通用户无法确认"我用的是谁的 token"。`admin stats` 需要 admin 权限，普通用户调不了。

**修复**：`peekview whoami`，调用 `GET /auth/me`，无需 admin 权限。

### 缺口4：MCP path_namespace 无 CLI 管理

**痛点**：v0.9.0 新功能只能手改 YAML，无校验、无测试翻译。

### 缺口5：MCP 配置校验缺失

**痛点**：配了 URL 和 key，不知道连不连得上。validators.ts 写了校验逻辑但没接线。

---

## 四、功能设计

### T010：apikey local 模式解锁

- 去掉 `cli.py` 中 apikey 命令的 `if not _is_remote_mode` 判断
- local 模式直连 DB（ApiKeyService），行为与 remote 一致
- 改动极小，风险低

### T011：用户管理 API + CLI + whoami

**后端 API（5 个端点）**：

```
# 管理员端点（require_admin）
GET    /api/v1/admin/users              # 列出/查询用户（支持 ?username= 参数）
DELETE /api/v1/admin/users/{id}          # 删用户（级联），不能删自己（400）
POST   /api/v1/admin/users/{id}/reset-password  # 重置他人密码

# 自助端点（require_auth）
DELETE /api/v1/auth/me                   # 注销自己（级联）
POST   /api/v1/auth/change-password      # 改自己密码
```

**`GET /admin/users` 设计**：
- 无参数：返回所有用户列表（分页）
- `?username=alice`：精确查询，CLI remote 模式用此做 username→id 解析
- Web UI 的用户管理页也依赖此端点
- 返回：id / username / display_name / is_admin / is_active / entry_count / api_key_count

**级联删除逻辑**：
1. 遍历该用户的 entries，逐个调用 `entry_service.delete_entry()`（清理磁盘文件 + DB 记录 + 关联 files）
2. 删除该用户的 api_keys
3. 删除 user 记录
4. 事务提交

**唯一 admin 注销自己（`DELETE /auth/me`）**：
- 后端检测：如果是最后一个 admin → 返回 `409 Conflict` + `{"needs_confirm": true, "message": "这是最后一个管理员账号，注销将清空所有数据"}`
- CLI 收到 409 → 二次确认（输入 username 确认）→ 重发请求带 `?confirm=true`
- 确认后级联删除所有数据
- 系统回到初始状态，下一个 `user create` 自动成为 admin（复用现有首用户逻辑）

**CLI 命令（3 个新命令 + 1 个已有命令补 remote）**：

```
peekview user delete <username>
  # local: 直连 DB 级联删除
  # remote: GET /admin/users?username= → DELETE /admin/users/{id}
  # 危险操作：二次确认 + 展示将删除的 entries/keys 数量

peekview user reset-password <username>
  # local: 直连 DB 重置密码（交互式输入新密码）
  # remote: POST /admin/users/{id}/reset-password

peekview user change-password
  # 交互式输入旧密码+新密码
  # remote only（本地直接用 reset-password）
  # 调用 POST /auth/change-password

peekview whoami
  # remote only（本地用 user list 即可）
  # 调用 GET /auth/me，显示 username / is_admin / display_name
```

**PeekClient 补方法**：
- `list_users(username?)` → `GET /admin/users`
- `delete_user(user_id)` → `DELETE /admin/users/{id}`
- `reset_password(user_id, new_password)` → `POST /admin/users/{id}/reset-password`
- `change_password(old_password, new_password)` → `POST /auth/change-password`
- `delete_me(confirm?)` → `DELETE /auth/me`
- `get_me()` → `GET /auth/me`
- `update_entry(slug, **kwargs)` → `PATCH /entries/{slug}`（方法补上，CLI 命令暂不做）

**local 模式认证**：无需认证，控制台即管理员（和现有 create/promote/demote 一致）。
**remote 模式认证**：复用现有 `config.remote.api_key` / `config.remote.token`，不引入新环境变量。

### T012：Web UI 用户管理（第二期）

- admin：用户管理页（列表 + 删除 + 重置密码）
- 自助：设置页加「修改密码」「注销账号」
- 依赖 T011 的 API

### T014：MCP path_namespace CLI

```
peekview-mcp config namespace add <ns> <container_path> <host_path>
peekview-mcp config namespace remove <ns> [<container_path>]
peekview-mcp config namespace list [<ns>]
peekview-mcp config namespace test <ns> <path>     # 测试翻译结果
```

- `add`：校验 container_path 以 `/` 开头、host_path 可含 `~`
- `remove`：无 container_path 则删整个 namespace
- `test`：调用 `translatePath()` 并展示翻译结果，不启动服务器
- `config list` 展示 path_namespaces
- `ConfigFileData.server` 类型声明补 `path_namespaces`

### T015：MCP config verify + unset + 校验

- `peekview-mcp config verify`：读配置 → HTTP 健康检查 → 认证验证 → 输出每项状态
- `peekview-mcp config unset <key>`：删除配置项
- 接线已有 `validators.ts` 的校验逻辑到 `config set`
- `api_key` 脱敏显示（`config get` 默认掩码，`--show-secrets` 显式展示）

---

## 五、任务拆分

按「最小可独立交付」拆分，每个任务独立走 workflow-v4：

### 第一期：CLI + API

| 任务 | 内容 | 包 | 优先级 | 依赖 |
|------|------|-----|--------|------|
| T010 | apikey local 模式解锁 | backend | P0 | 无 |
| T011 | 用户管理 API + CLI + whoami（5 个 API + 4 个 CLI 命令 + PeekClient 7 个方法） | backend | P0 | 无 |
| T014 | MCP path_namespace CLI（4 个子命令 + 类型 + 校验） | mcp-server | P0 | 无 |
| T015 | MCP config verify + unset + 校验接线 | mcp-server | P1 | 无 |

**并行说明**：
- T010 / T011 / T014 / T015 全部互不依赖，可并行
- T011 内部：API 先行，CLI 衔接（同一个任务内顺序做）

### 第二期：Web UI

| 任务 | 内容 | 包 | 优先级 | 依赖 |
|------|------|-----|--------|------|
| T012 | Web UI 用户管理 + 设置页改密码/注销 | frontend | P2 | T011 |

---

## 六、认证设计

### peekview CLI

**local 模式**：直连 DB，无需认证。能在机器上执行命令即代表有权限。与现有 `user create/promote/demote` 行为一致。

**remote 模式**：复用现有机制，不引入新环境变量。
```
认证优先级（从高到低）：
1. --remote-url 参数（同时触发 remote 模式）
2. 环境变量 PEEKVIEW_REMOTE__URL（已有）
3. config 文件 remote.url（已有）

认证凭证（自动从 config 读取）：
- config.remote.token（JWT，peekview login 存入）
- config.remote.api_key（pv_ key，管理员 key 自然有 admin 权限）
```

### peekview-mcp CLI

MCP CLI 只管理本地配置文件，不涉及远程认证。

---

## 七、明确不做的事

| 功能 | 不做的理由 |
|------|-----------|
| MCP `list_entries` 过滤参数 | 伪需求——Agent 协作是 URL 直传，不需要「发现」 |
| `peekview register` CLI | 低频，Web UI 可注册 |
| `peekview download` CLI | 本地文件已在磁盘，远程场景低频；`peekview get --json` 已有文件元数据 |
| user promote/demote/disable/enable 的 remote 化 | 无痛点，local 直连 DB 可解决 |
| `peekview health` | 低优，可 curl /health 替代 |
| `peekview logout` CLI | 已有 `peekview config unset remote.token`，专用命令价值不大 |

---

## 八、Backlog（无痛点，需要时再捞）

- `peekview entry update` CLI（PeekClient.update_entry() 方法已在 T011 补上，CLI 命令暂不做）
- `peekview raw <slug>` CLI（web_fetch + /raw 已覆盖核心场景）
- api_key 脱敏显示（T015 含此）
- `--config <path>` 全局参数
- help 文档补全
