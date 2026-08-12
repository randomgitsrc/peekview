# PeekView CLI/API 痛点驱动补全方案

> ⚠️ **此文档已过时**
> 取代文档：`docs/plans/cli-api-v3.md`（2026-06-15）
> 本文档保留作为历史参考，不再更新

---

## 一、判断标准

功能优先级按三层权重排序：

1. **有真实痛点的** → 必须做
2. **无痛点但成本极低（<1h）且消除了接口不对称** → 顺手做
3. **无痛点且成本不低** → 不做，移入 backlog

与前版方案的核心区别：不再追求「API 有的 CLI 必须有」，而是追问「谁被卡住了」。

---

## 二、现状（已有的不做）

| 资源 | 创建 | 读取 | 列表 | 修改 | 删除 | local | remote |
|------|------|------|------|------|------|-------|--------|
| Entry | ✅ | ✅ | ✅ | ✅ API | ✅ | ✅ | ✅ |
| User | ✅ local | ❌ | ✅ local | ❌ | ❌ | ✅ 直连DB | ❌ |
| Auth | ✅ register API | ✅ /auth/me API | — | ❌ | ❌ logout API | — | ✅ login |
| ApiKey | ✅ remote | ✅ remote | ✅ remote | — | ✅ remote | ❌ blocked | ✅ |
| Admin | — | ✅ stats | — | — | ✅ cleanup | ✅ | ✅ |
| MCP config | ✅ set | ✅ get | ✅ list | — | ❌ | ✅ | — |

---

## 三、缺口分析

### 缺口1：apikey local 模式被锁（痛点：高）

**场景**：headless 服务器部署 PeekView，需要给 MCP Agent 生成 `pv_` key，没有浏览器，CLI 直接报错。

**修复**：去掉 remote-only 限制，local 模式直连 DB 生成 key。

### 缺口2：删用户 + 改密码完全缺失（痛点：高）

**场景**：Agent 不用了，账号/key/entry 全留着变垃圾，没有任何渠道清理。改密码同理——Web UI 和 CLI 都没有。

**范围**：只做 delete + password，不做全套 user CRUD。promote/demote 的 remote 化无痛点，local 直连 DB 够用。

### 缺口3：whoami 缺失（痛点：中）

**场景**：remote 模式下，普通用户想确认"我用的是谁的 token"。`admin stats` 需要 admin 权限，普通用户调不了。

**修复**：`peekview whoami`，调 `GET /auth/me`，成本极低。

### 缺口4：MCP path_namespace 无 CLI（痛点：中）

**场景**：v0.9.0 新功能只能手改 YAML，没有格式校验，没有测试翻译结果的手段。

### 缺口5：MCP 配置校验缺失（痛点：中）

**场景**：配了 URL 和 key，不知道连不连得上。validators.ts 已写但没有接线。

### 缺口6（非痛点，顺手做）

- `PeekClient.update_entry()`：API 已有 `PATCH /entries/{slug}`，PeekClient 缺方法。补上方法成本极低，为未来 CLI `peekview update` 留路。CLI 命令本身移 backlog。

---

## 四、明确不做

| 功能 | 理由 |
|------|------|
| MCP `list_entries` 过滤参数 | 伪需求——Agent 协作是 URL 直传，不需要「发现」 |
| `peekview register` CLI | 低频，Web UI 可注册 |
| `peekview download` CLI | `peekview get` 已显示元数据；文件内容获取用 `web_fetch + /raw` 或 Web UI |
| `peekview raw` CLI | 同上，无痛点 |
| `peekview entry update` CLI | 无痛点——PeekClient 补方法即可，CLI 移 backlog |
| user promote/demote/disable/enable remote 化 | 无痛点，local 直连 DB 够用 |
| `peekview health` CLI | 可用 `curl /health` 替代，不值得单独做命令 |

**移入 backlog（需要时再捞）**：
- `peekview entry update` CLI
- `peekview raw` / `download` CLI
- `peekview health` CLI
- `peekview-mcp config unset`

---

## 五、功能设计

### T010：apikey local 模式解锁

**包**：backend | **风险**：低 | **改动量**：~20 行

- `cli.py` 去掉 `if not _is_remote_mode` 的 remote-only 判断
- local 模式直连 DB 生成 `pv_` key，走 `ApiKeyService`
- 行为与 remote 模式一致

### T011：用户管理（API + CLI）

**包**：backend | **风险**：高（级联删除 + 权限）| **依赖**：无

#### 新增 API 端点

```
# 管理员操作（require_admin）
GET    /api/v1/admin/users                  # 列出用户（支持 ?username= 查询）
DELETE /api/v1/admin/users/{user_id}        # 删用户（不能删自己）
POST   /api/v1/admin/users/{user_id}/reset-password  # 重置他人密码

# 自助操作（require_auth）
DELETE /api/v1/auth/me                      # 注销自己（级联）
POST   /api/v1/auth/change-password         # 改自己密码
GET    /api/v1/auth/me                      # 已有，CLI 暴露为 whoami
```

#### 级联删除逻辑

用户被删除时，依次清理：
1. 遍历该用户的 entries，逐个调用 `entry_service.delete_entry()`（清理磁盘文件 + DB 记录 + 关联 files）
2. 删除该用户的 API keys
3. 删除 user 记录

**不用裸 SQL 级联**——绕过 `entry_service.delete_entry()` 会导致磁盘文件残留。

#### 唯一 admin 注销自己

- `DELETE /auth/me` 检测到请求者是最后一个 admin
- 返回 `409 Conflict`，要求确认：请求体必须含 `{"confirm_username": "<自己的用户名>"}`
- 确认后执行级联删除，系统回到初始状态
- 下一个注册/创建的用户自动成为 admin（复用现有首用户逻辑）
- **admin 不能通过 `DELETE /admin/users/{id}` 删自己**（只走 `/auth/me` 自助注销）

#### 新增 CLI 命令

```
peekview user delete <username>              # local: 直连DB | remote: GET /admin/users?username= → DELETE /admin/users/{id}
peekview user reset-password <username>      # local: 直连DB | remote: POST /admin/users/{id}/reset-password
peekview user change-password                # 交互式，remote only（本地用 reset-password）
peekview whoami                              # remote only，调 GET /auth/me
```

**remote 模式下 username → user_id 解析**：

`peekview user delete alice --remote-url ...`
1. CLI 内部调 `GET /admin/users?username=alice` 获取 user_id
2. CLI 内部调 `DELETE /admin/users/{user_id}`
3. 用户只看到：「删除用户 alice（2 entries, 1 API key）」

**local 模式**：直连 DB，无需认证，和现有 user create/promote/demote 一致。

**remote 模式**：复用 `_get_backend()` 机制，用 `config.remote.api_key`（管理员 key 自然有 admin 权限）。

#### PeekClient 补方法

```python
def get_current_user(self) -> dict: ...           # GET /auth/me
def delete_account(self, confirm_username: str = "") -> dict: ...  # DELETE /auth/me
def change_password(self, old_password: str, new_password: str) -> dict: ...  # POST /auth/change-password
def list_users(self, username: str | None = None) -> dict: ...  # GET /admin/users
def delete_user(self, user_id: int) -> dict: ...  # DELETE /admin/users/{id}
def reset_user_password(self, user_id: int) -> dict: ...  # POST /admin/users/{id}/reset-password
def update_entry(self, slug: str, **kwargs) -> RemoteEntry: ...  # PATCH /entries/{slug}
```

### T014：MCP path_namespace CLI

**包**：mcp-server | **风险**：低

```
peekview-mcp config namespace add <ns> <container_path> <host_path>
peekview-mcp config namespace remove <ns> [<container_path>]
peekview-mcp config namespace list [<ns>]
```

- 仿照 `config allowed_path add/remove/list` 模式
- `ConfigFileData.server` 类型声明补 `path_namespaces`
- `config list` 输出补 path_namespaces 展示

### T015：MCP config verify

**包**：mcp-server | **风险**：低

```
peekview-mcp config verify
```

- 读配置 → 校验格式（接线 validators.ts）→ HTTP 健康检查 → 认证验证 → 逐项输出状态
- 不做 `config unset`（移 backlog，无痛点）

---

## 六、任务拆分

| 任务 | 内容 | 包 | 优先级 | 依赖 | 风险 |
|------|------|-----|--------|------|------|
| T010 | apikey local 解锁 | backend | P0 | 无 | 低 |
| T011 | 用户管理 API + CLI（delete / password / whoami + PeekClient 补方法）| backend | P0 | 无 | 高 |
| T014 | MCP path_namespace CLI | mcp-server | P0 | 无 | 低 |
| T015 | MCP config verify | mcp-server | P1 | 无 | 低 |

**并行说明**：
- T010 / T011 / T014 可并行（互不依赖）
- T015 独立
- T010 改动极小，可以先交付

**T011 合并了前版 T011+T012 的理由**：
- 同一个包（backend），改动端完全相同
- CLI remote 模式需要 API，一起做减少协调
- 工作量可控：5 个新 API 端点 + 4 个 CLI 命令 + 7 个 PeekClient 方法

### 第二期（依赖 T011 API，可缓）

| 任务 | 内容 | 包 | 优先级 |
|------|------|-----|--------|
| T013 | Web UI 用户管理页 + 设置页改密码/注销 | frontend | P2 |

---

## 七、权限模型

| 操作 | 谁能做 | 对象 | 认证 | 端点 |
|------|--------|------|------|------|
| 管理员删用户 | admin | 任何人，**除自己** | require_admin | DELETE /admin/users/{id} |
| 自助注销 | 任何登录用户 | 只能自己 | require_auth | DELETE /auth/me |
| 管理员重置密码 | admin | 任何人 | require_admin | POST /admin/users/{id}/reset-password |
| 自助改密码 | 任何登录用户 | 只能自己 | require_auth | POST /auth/change-password |
| 查看自己信息 | 任何登录用户 | 只能自己 | require_auth | GET /auth/me |
| 列出用户 | admin | 全部 | require_admin | GET /admin/users |

**唯一 admin 注销**：允许，需 `confirm_username` 确认。效果 = 重置系统。

---

## 八、local vs remote 认证总结

| CLI 命令 | local 模式 | remote 模式 |
|---------|-----------|------------|
| `user delete` | 直连 DB，无认证 | PeekClient → DELETE /admin/users/{id} |
| `user reset-password` | 直连 DB，无认证 | PeekClient → POST /admin/users/{id}/reset-password |
| `user change-password` | 无意义（本地用 reset-password）| PeekClient → POST /auth/change-password |
| `whoami` | 无意义（本地没有「当前用户」概念）| PeekClient → GET /auth/me |
| `apikey create/list/revoke/cleanup` | 直连 DB，无认证（T010 解锁后）| PeekClient（现有） |

local 模式「控制台即管理员」的设计与现有 user create/promote/demote 完全一致，不引入新的认证机制。
