# PeekView CLI/API 全面性需求方案

> 目标：peekview 和 peekview-mcp 的 API/CLI、local/remote 接口系统性补全
> 原则：API 有的能力，CLI 应该能用；CLI 支持的操作，local/remote 应该一致

---

## 一、设计原则

1. **API → CLI 对称**：每个 API 端点都应有对应的 CLI 命令（前端专用的除外）
2. **local/remote 一致**：数据操作命令应同时支持 local 和 remote 模式，行为一致
3. **PeekClient 完整**：remote 模式依赖 PeekClient，API 有的方法 PeekClient 必须有
4. **配置可管理**：每个配置项都应可通过 CLI 查看、设置、删除

---

## 二、peekview CLI — 当前状态 vs 目标状态

### Entry 资源

| 操作 | API 端点 | PeekClient | CLI local | CLI remote | 现状 | 目标 |
|------|---------|------------|-----------|------------|------|------|
| Create | ✅ POST /entries | ✅ create_entry | ✅ | ✅ | ✅ | — |
| Get | ✅ GET /entries/{slug} | ✅ get_entry | ✅ | ✅ | ✅ | — |
| List | ✅ GET /entries | ✅ list_entries | ✅ | ✅ | ✅ | — |
| Update | ✅ PATCH /entries/{slug} | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| Delete | ✅ DELETE /entries/{slug} | ✅ delete_entry | ✅ | ✅ | ✅ | — |
| Download ZIP | ✅ GET /entries/{slug}/download | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| Get raw | ✅ GET /entries/{slug}/raw | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| Get file | ✅ GET /entries/{slug}/files/{id}/content | ❌ | ❌ | ❌ | 🟡 缺 | ✅ 补 |

**Entry Update 细节**（API 已支持但 CLI 缺失）：
- 修改 summary / status / tags / is_public
- 追加文件到已有 entry
- 从 entry 中移除文件
- 追加目录到已有 entry

### User 资源

| 操作 | API 端点 | PeekClient | CLI local | CLI remote | 现状 | 目标 |
|------|---------|------------|-----------|------------|------|------|
| Create | ⚠️ POST /auth/register（非 admin） | ❌ | ✅ 直连 DB | ❌ | 🟡 半 | ✅ 补 |
| Get (me) | ✅ GET /auth/me | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| List (admin) | ❌ | ❌ | ✅ 直连 DB | ❌ | 🔴 缺 API | ✅ 补 |
| Update password | ❌ | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| Update profile | ❌ | ❌ | ❌ | ❌ | 🟡 缺 | ✅ 补 |
| Promote | ❌ | ❌ | ✅ 直连 DB | ❌ | 🔴 缺 API | ✅ 补 |
| Demote | ❌ | ❌ | ✅ 直连 DB | ❌ | 🔴 缺 API | ✅ 补 |
| Delete | ❌ | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| Enable/Disable | ❌（模型有 is_active） | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |

**User 资源是最大的缺口**：4 个 CLI 命令全是本地直连 DB，无 API 端点，remote 模式完全不可用。

### Auth 资源

| 操作 | API 端点 | PeekClient | CLI local | CLI remote | 现状 | 目标 |
|------|---------|------------|-----------|------------|------|------|
| Register | ✅ POST /auth/register | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| Login | ✅ POST /auth/login | ✅ login | ❌ | ✅ | ✅ | — |
| Logout | ✅ POST /auth/logout | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| Whoami | ✅ GET /auth/me | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |

### ApiKey 资源

| 操作 | API 端点 | PeekClient | CLI local | CLI remote | 现状 | 目标 |
|------|---------|------------|-----------|------------|------|------|
| Create | ✅ POST /apikeys | ✅ | ❌ blocked | ✅ | 🟡 | ✅ 补 local |
| List | ✅ GET /apikeys | ✅ | ❌ blocked | ✅ | 🟡 | ✅ 补 local |
| Revoke | ✅ DELETE /apikeys/{id} | ✅ | ❌ blocked | ✅ | 🟡 | ✅ 补 local |
| Cleanup | ✅ DELETE /apikeys/expired | ✅ | ❌ blocked | ✅ | 🟡 | ✅ 补 local |

**ApiKey local 模式**：当前强制 remote-only，但本地实例也需要通过 CLI 生成 `pv_` key 给 MCP/CI 使用。

### Admin 资源

| 操作 | API 端点 | PeekClient | CLI local | CLI remote | 现状 | 目标 |
|------|---------|------------|-----------|------------|------|------|
| Stats | ✅ GET /admin/stats | ✅ | ✅ | ✅ | ✅ | — |
| Cleanup | ✅ POST /admin/cleanup | ✅ | ✅ | ✅ | ✅ | — |
| User list | ❌ | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| User get | ❌ | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| User update | ❌ | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| User delete | ❌ | ❌ | ❌ | ❌ | 🔴 缺 | ✅ 补 |

### Health/Config 资源

| 操作 | API 端点 | PeekClient | CLI | 现状 | 目标 |
|------|---------|------------|-----|------|------|
| Health check | ✅ GET /health | ❌ | ❌ | 🔴 缺 | ✅ 补 |
| Config limits | ✅ GET /config/limits | ❌ | ❌ | 🟡 缺 | ✅ 补 |

---

## 三、peekview-mcp CLI — 当前状态 vs 目标状态

### 配置管理

| 配置项 | config set | config get | config list | 专用命令 | 校验 | 现状 | 目标 |
|--------|-----------|-----------|-------------|---------|------|------|------|
| peekview.url | ✅ | ✅ | ✅ | — | ❌ | 🟡 | ✅ 补校验 |
| peekview.public_url | ✅ | ✅ | ✅ | — | ❌ | 🟡 | ✅ 补校验 |
| peekview.api_key | ✅ | ✅ | ❌ 隐藏 | — | ❌ | 🔴 | ✅ 补 list + 脱敏 |
| server.host | ✅ | ✅ | ✅ | — | ❌ | 🟡 | ✅ 补校验 |
| server.port | ✅ | ✅ | ✅ | — | ❌ | 🟡 | ✅ 补校验 |
| server.cors_origins | ✅ | ✅ | ✅ | — | ❌ | 🟡 | ✅ 补校验 |
| server.mode | ✅ | ✅ | ✅ | — | ❌ | 🟡 | ✅ 补校验 |
| server.allowed_paths | ⚠️ 笨 | ✅ | ✅ | ✅ add/remove/list | ❌ | 🟡 | ✅ 补校验 |
| server.trust_all_paths | ✅ | ✅ | ✅ | — | ❌ | 🟡 | ✅ 补确认 |
| server.path_namespaces | ❌ | ❌ | ❌ | ❌ | — | 🔴 | ✅ 补专用命令 |
| logging.level | ✅ | ✅ | ✅ | — | ❌ | 🟡 | ✅ 补校验 |

### 通用能力

| 能力 | 现状 | 目标 |
|------|------|------|
| config unset | ❌ | ✅ 补 |
| config verify / test-connection | ❌ | ✅ 补 |
| --config <path> 全局参数 | ❌ | 🟡 可选 |
| api_key 脱敏显示 | ❌ 明文 | ✅ 补 |

---

## 四、新增命令清单

### peekview 新增 CLI 命令

| 命令 | 模式 | 说明 |
|------|------|------|
| `peekview update <slug>` | local + remote | 修改 entry 的 summary/status/tags/visibility，追加/移除文件 |
| `peekview download <slug>` | local + remote | 下载 entry 为 ZIP |
| `peekview raw <slug>` | local + remote | 获取 entry 原始内容（JSON） |
| `peekview whoami` | remote only | 查看当前登录用户信息 |
| `peekview logout` | remote only | 清除本地存储的 token |
| `peekview register` | remote only | 远程注册新用户 |
| `peekview health` | local + remote | 检查服务器健康状态 |
| `peekview user delete <username>` | local + remote | 删除用户及其 entries/apikeys |
| `peekview user password <username>` | local only | 重置用户密码 |
| `peekview user disable <username>` | local + remote | 禁用用户（is_active=false） |
| `peekview user enable <username>` | local + remote | 启用用户 |

### peekview 新增 API 端点

| 端点 | 认证 | 说明 |
|------|------|------|
| `GET /api/v1/admin/users` | require_admin | 列出所有用户 |
| `GET /api/v1/admin/users/{user_id}` | require_admin | 获取单个用户详情 |
| `PATCH /api/v1/admin/users/{user_id}` | require_admin | 更新用户（promote/demote/enable/disable） |
| `DELETE /api/v1/admin/users/{user_id}` | require_admin | 删除用户（级联删除 entries + apikeys + 磁盘文件） |
| `POST /api/v1/auth/change-password` | require_auth | 修改自己的密码 |
| `POST /api/v1/admin/users/{user_id}/reset-password` | require_admin | 管理员重置用户密码 |

### peekview-mcp 新增 CLI 命令

| 命令 | 说明 |
|------|------|
| `config path_namespace add <ns> <container_path> <host_path>` | 添加命名空间映射 |
| `config path_namespace remove <ns> [<container_path>]` | 移除映射（无 container_path 则删整个 ns） |
| `config path_namespace list [<ns>]` | 列出命名空间映射 |
| `config unset <key>` | 删除配置项 |
| `config verify` | 校验配置 + 测试连接 |

---

## 五、优先级分层

### P0 — 基础完整性（CLI 应该能用）

| 项 | 理由 |
|----|------|
| User 管理 API（CRUD + admin 端点） | 没有这个，远程 user delete 不可能 |
| `peekview user delete` | 原始需求 |
| `peekview update` | entry 创建后无法修改是核心功能缺失 |
| MCP `config path_namespace` 命令 | v0.9.0 新功能零 CLI 管理 |

### P1 — 体验完整性（CLI 应该好用）

| 项 | 理由 |
|----|------|
| `peekview whoami` / `logout` | 远程模式下身份确认和退出是最基本操作 |
| `peekview download` / `raw` | 能创建不能获取是半残 |
| `peekview health` | 调试必需 |
| MCP `config verify` | 配了 url 不知道通不通 |
| MCP `config unset` | 设了删不掉 |
| MCP config 校验 | validators.ts 写了但没接线 |
| user password change | 密码改不了是运维痛点 |

### P2 — 打磨（可以慢慢做）

| 项 | 理由 |
|----|------|
| ApiKey local 模式 | 本地实例需要生成 key |
| `peekview register` | 低频，可通过 web 注册 |
| api_key 脱敏显示 | 安全改进 |
| Help 文档补全 | 体验改进 |
| `--config <path>` 全局参数 | 高级用法 |

---

## 六、建议的任务拆分

每个任务独立走 workflow-v4 P0-P8：

| 任务 | 包 | 范围 |
|------|-----|------|
| T010: User 管理 API + CLI | backend | 6 个新 API 端点 + user delete/password/enable/disable + 现有 user 命令加 remote 模式 |
| T011: Entry update + download CLI | backend | PeekClient 补方法 + update/download/raw 命令 |
| T012: Auth CLI (whoami/logout/register) | backend | PeekClient 补方法 + 3 个新命令 |
| T013: Health + config limits CLI | backend | PeekClient 补方法 + health 命令 |
| T014: MCP path_namespace CLI | mcp-server | 3 个子命令 + 类型声明 + config list 展示 |
| T015: MCP config 校验 + unset + verify | mcp-server | 接线 validators + unset + verify 命令 |

**依赖关系**：
- T010 先做（User 管理 API 是其他 user 命令 remote 模式的基础）
- T011/T012/T013 互相独立，可并行
- T014/T015 互相独立，可并行

---

## 七、开放问题

1. **User delete 级联策略**：删除用户时，entries 是级联删除还是设为匿名？当前建议级联删除（PeekView 是个人工具，不是协作平台）
2. **Admin API 路径**：`/api/v1/admin/users/` vs `/api/v1/users/`？建议 `/admin/users/`，和现有 admin 端点一致
3. **User username vs id**：API 用 user_id，CLI 用 username。API 路径用 id，CLI 内部先查 username→id
4. **Entry update 的文件追加**：`peekview update <slug> --add-file file.txt` 还是 `peekview add-file <slug> file.txt`？建议用子命令更清晰
5. **ApiKey local 模式**：是否需要？如果用户在本地运行 peekview，想给 MCP 生成 key，目前只能走 web UI 或 curl
