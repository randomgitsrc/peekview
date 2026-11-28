---
phase: P0
task_id: TPV0105
task_name: mcp-oauth-remote
trace_id: TPV0105
created: 2026-11-28
status: pending-start
parent: 无
---

# P0-brief — TPV0105 PeekView 全项目统一 OAuth 2.1 授权体系

> 主 Agent 亲自填写（P0 产出）。本文件自包含，不依赖任何外部链接或对话上下文。
>
> **修订记录**：本文件经三轮修订。第 3 版根据独立审查结论（FAIL）修复了 6 个阻断问题：
> ①MCP→PeekView API 的凭证路径完全未定义（现为第六节）②`/auth/me` 曾被错误地允许做身份解析
> ③多 `resource` → 多 audience 的跨资源漏洞（现为 3.2.1）④TTL 1 小时与"无 refresh"的自相矛盾（已改为 12 小时并显式记录泄露窗口）
> ⑤路由清点 45→52 ⑥JWK 导出字段的失实结论（`to_dict()` 不产出 `kid`/`use`）。
> 同时按审查建议修正了多处 MUST/SHOULD 错标、补上 JWKS 端点契约（7.5）与正向 E2E 用例（E0）。

```yaml
task: "为 PeekView 与 peekview-mcp 建立统一 OAuth 2.1 授权体系与资源隔离边界"
known_risks:
  - "首要风险：MCP 现在是转发客户端 token 调 PeekView API，规范明令禁止（MUST NOT）。OAuth 落地必须同时解决下游凭证分离，否则所有工具失效"
  - "首次让 PeekView 对外签发第三方可持有凭证，audience/scope/typ/过期任一处校验有洞即越权"
  - "多 resource 请求会签出多 audience token，使两个 RS 的隔离形同虚设——必须显式拒绝"
  - "PeekView 完全无 scope 概念，需从零建立并同时在后端 API 与 MCP 工具层落实"
  - "现有 pv_ API Key 权限等同完整用户身份（含 admin）——OAuth 不得继承这种粒度"
  - "无 refresh token 时 TTL 与可用性存在张力：太短每小时重授权，太长泄露窗口大"
  - "双产品同时改动（Python 后端 + Node MCP Server），版本、测试契约、CHANGELOG 都要同步"
env_constraints:
  debug_env: "make debug（127.0.0.1:8888，数据隔离 /tmp/peekview-debug/）"
  production: "生产 :13001 / ~/.peekview/ / pipx 全在域外，本任务不得触碰"
executor_env:
  platform: "DSH"
  has_task_tool: true
  has_local_runtime: true
  network: "本机回环 + 公网 HTTPS 探测均可"
```

---

## 一、任务定义

### 1.1 目标

为 PeekView **整个项目**建立统一的 OAuth 2.1 授权基础设施，使 PeekView API、peekview-mcp 以及未来的其他客户端和资源服务能够共用同一套用户身份与授权体系。

OAuth 是 PeekView 的项目级能力，不是 peekview-mcp 的局部功能。具体分工：

| 组件 | 角色 | 职责 |
|---|---|---|
| PeekView 后端 | **Authorization Server (AS) + Resource Server (RS)** | 用户身份、授权页、签发 token、保护 `/api/v1/**` |
| peekview-mcp | **Resource Server (RS)** | 保护 `/mcp`，校验 token 归属，按 scope 裁剪工具 |

**两个 RS 共享一个 AS，但资源边界必须独立。** 这是本任务的核心，详见第三节。

### 1.2 为什么 AS 必须落在 PeekView 后端

| 理由 | 事实依据 |
|---|---|
| 身份体系在 Python 侧 | 账号表、bcrypt 密码、JWT、登录态、captcha 全部在 `backend/peekview/`；peekview-mcp 无用户库 |
| 授权页需要登录态 | AS 与 PeekView 同 origin 才能复用 `peekview_token` Cookie（`api/auth.py:106`）。跨 origin 则用户被迫重新登录，正是要消除的痛点 |
| 避免身份体系劈裂 | 让 Node 侧当 AS 就得复制一份用户体系，两处漂移 |

**直接推论**：Node SDK 的 `mcpAuthRouter`（express 中间件）在本项目**不可用**。AS 端点需手写 FastAPI。加密能力已在依赖中：`python-jose[cryptography]>=3.3.0`（`backend/pyproject.toml:36`），venv 内实测 3.5.0 + cryptography 49.0.0，RS256 签名与 JWKS 导出均可用。

**SDK 在 RS 侧仍有价值**：`mcpAuthMetadataRouter` 可生成 PRM 元数据，`requireBearerAuth` 可生成标准 `WWW-Authenticate`。但本项目 MCP 是自研 express 4 应用而非 SDK 的 `McpServer` 全托管，是否引入需 P2 权衡（见 D4）。

### 1.3 不做什么

不得把本任务扩展为：用户身份系统重构、全站 RBAC 重构、所有客户端强制迁移。核心是**统一身份与授权基础设施、独立资源访问边界、按资源与权限签发和验证 token**。

---

## 二、要解决的问题与现状缺口

### 2.1 问题

当前 peekview-mcp 只认一种凭证：静态 API Key（`pv_` 前缀）。

```ts
// packages/mcp-server/src/server.ts:102-106
const authHeader = req.headers.authorization?.replace('Bearer ', '') ?? '';
if (!authHeader.startsWith('pv_')) {
  return { ok: false, status: 401, error: 'Only PeekView API Key (pv_ prefix) is supported' };
}
```

本地 IDE 可在配置里填一行 header，够用。但消费级平台（Claude.ai、ChatGPT、Gemini）的远程 MCP 连接器**只走 OAuth 发现流程，不提供自定义静态 Header 入口**。用户想把 PeekView 接入手机端或网页对话，当前无路可走。

OAuth 落地后附带收益：用户不再手工复制 key；凭证有有效期与 scope 收敛；未来客户端复用同一套授权。

### 2.2 现状缺口（本轮全部现测）

探测目标：`127.0.0.1:13003`（MCP v0.12.0）、`127.0.0.1:13001`（PeekView v0.28.0）、`https://s4.vide.cc:19093`（公网入口）。

| # | 缺口 | 实测证据 |
|---|---|---|
| G1 | MCP 的 401 无 `WWW-Authenticate` | `curl -D- -X POST :13003/mcp` → `HTTP/1.1 401`，响应头逐行确认无该字段。客户端拿不到 PRM 地址，发现流程第一步即断 |
| G2 | MCP 无 PRM 元数据（RFC 9728） | `/.well-known/oauth-protected-resource` 与 `/.well-known/oauth-protected-resource/mcp` 均 `404` |
| G3 | PeekView 无 AS 元数据（RFC 8414） | `:13001/.well-known/oauth-authorization-server` → `404` |
| G4 | **`.well-known` 被 SPA catch-all 吞掉** | `main.py:598` 的 `serve_spa_catchall` 注册在所有 router 之后，覆盖任意未匹配路径。`/.well-known/*` 不在 `FRONTEND_ROUTES`（`main.py:25`）也不是真实文件 → 落到 `index.html`。**返回 `200 text/html` 而非 `404`，客户端会当成"端点存在"然后解析失败** |
| G5 | PeekView 无任何 OAuth 表 | 生产 DB 实查 16 张表：`api_keys` / `entries` / `files` / `users` / `teams` / `team_members` / `entry_*` 系列，无 client / code / token |
| G6 | PeekView 无 scope 概念 | `ApiKey`（`models.py:267-292`）只有 name/prefix/hash/expires；JWT payload 只有 `sub`/`exp`/`iat`（`auth.py:113-117`）；`grep -c scope` 在 `auth.py` 与 `api/_shared.py` 均为 **0** |
| G7 | `decode_access_token` 不校验 `aud`/`iss` | `auth.py:121-135`：`jwt.decode(token, secret_key, algorithms=["HS256"])`，无 audience、无 issuer |
| G8 | `/login` 是死路由 | `main.py:25` 的 `FRONTEND_ROUTES` 含 `"login"`，但 `router.ts` 中 `grep -c "path: '/login'"` = **0**。真实登录是 `LoginDialog.vue` 弹窗（`LandingView.vue:189`） |
| G9 | 无 `WWW-Authenticate` 任何实现 | 全仓 `grep -rn "WWW-Authenticate"` 零命中（后端 + MCP 皆无） |
| G10 | MCP 无"自身公网地址"概念 | `config/file.ts` 无表达 MCP 自身地址的字段；现有 `peekview.public_url` 是**PeekView 的**地址（用于拼链接）。MCP 不知道自己的 canonical URI，无法据此校验 audience |

### 2.3 `pv_` key 的真实权限粒度（关键事实）

`pv_` key 验证后直接返回 `User` 对象（`auth.py:181-189`），此后与 JWT 登录**完全等价**：

```python
# auth.py:191-199  require_auth 只看 user 是否非 None
def require_auth(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise AuthenticationError("Authentication required")
    return user
```

因此一个 `pv_` key 可以调用 `require_admin` 保护的端点（`api/admin.py:25,33,44`）——只要对应用户是 admin。**OAuth token 不得继承这种无区分的粒度**，这是 scope 设计的直接动因（第三节 3.2）。

---

## 三、核心架构：Resource 与 Audience 隔离

这是本任务的最高优先级议题。**"同一个 AS 签发 = 可以通用"是错的**，必须建立显式的资源边界。

### 3.1 Resource Identifier（规范事实）

MCP 授权规范（**2026-07-28**，当前版本）对 `resource` 参数的要求是 client 侧 **MUST**：

> "The `resource` parameter: 1. **MUST** be included in both authorization requests and token requests. 2. **MUST** identify the MCP server that the client intends to use the token with. 3. **MUST** use the canonical URI of the MCP server as defined in RFC 8707 Section 2."
> — MCP Specification 2026-07-28, `basic/authorization` §Resource Parameter Implementation

规范 URI 规则：仅 scheme + host + 可选 port + 可选 path；**禁止 fragment**；建议不带尾斜杠；scheme/host 小写（实现上宜容忍大写）。

**PeekView 的两个 Resource Identifier（P0 建议，P1 确认）**：

| 资源 | Resource Identifier | 说明 |
|---|---|---|
| PeekView API | `{public_base_url}/api` | 例如 `https://peek.example.com/api` |
| peekview-mcp | `{mcp_public_url}/mcp` | 例如 `https://mcp.peek.example.com/mcp` |

**为什么 API 用 `/api` 而不是根路径**：PeekView 根路径既是 API 宿主又是 SPA 宿主，用 `/api` 明确圈定资源范围。**为什么两者必须不同**：见 3.2。

⚠️ **前提缺口（G10）**：MCP 当前没有配置项表达"自己的公网地址"。必须新增（建议 `server.public_url` 或复用 RFC 8707 语义的 `server.resource`）。这是 P1 必须落地的配置契约。

### 3.2 Audience 隔离契约

**RS 侧义务（规范 MUST）**：

> "MCP servers **MUST** validate that access tokens were issued specifically for them as the intended audience, according to RFC 8707 Section 2. ... MCP servers **MUST** only accept tokens that are valid for use with their own resources."
> — MCP Specification 2026-07-28, `basic/authorization` §Token Handling

**因此必须做到**：

| 要求 | 实现契约 | 验收 |
|---|---|---|
| token 携带目标资源 | `aud` claim = 授权请求中的 `resource` 值 | 解码 token 断言 `aud` |
| PeekView API 只收自家 token | `get_current_user` 校验 `aud == {base}/api` | MCP token 调 `/api/v1/entries` 必须 401 |
| MCP 只收自家 token | MCP 校验 `aud == {mcp}/mcp` | API token 调 `/mcp` 必须 401 |
| 不能只靠 `sub`/`scope` 判权 | `aud` 校验必须独立于 scope 校验，且**先于**业务逻辑 | 构造 `aud` 正确但 scope 不足、`aud` 错误但 scope 充足的交叉用例 |
| 授权与兑换的 resource 一致 | `/oauth/token` 的 `resource` 必须与授权码绑定的值完全一致，不一致 → `invalid_target` | 用 A 资源换码、B 资源换 token → 拒绝 |
| **只接受单个 resource** | 同时提交多个 `resource` → `invalid_target`，**不得签发多 audience token** | 见 3.2.1 |
| **`aud` 必须存在** | 无 `aud` 或 `aud` 为数组 → 两个 RS 均拒绝（fail-closed） | 见 3.2.1 |

#### 3.2.1 必须堵住"多 audience"这条漏洞（审查发现，P0 遗漏）

RFC 8707 §2 **允许 `resource` 参数多次出现**，且 §3 给出了明确的危险警告：

> "If a bearer token has multiple intended recipients (audiences), then the token is valid at more than one protected resource and can be used by any one of those resources to access any of the others."
> — RFC 8707 §3

若客户端一次提交 `resource={peekview}/api` 与 `resource={mcp}/mcp`，而 AS 顺从地签出 `aud: ["...api", "...mcp"]`，则**两个 RS 的校验都会通过**，3.2 整节的隔离完全失效。

**因此 P0 明确要求（P1 定稿，但方向不可改）**：

| 规则 | 理由 |
|---|---|
| AS **只接受单个 `resource`**，多个一律 `invalid_target` | 规范允许 AS 用 local policy 限制可接受的 resource（RFC 8707 §2.2："at its sole discretion based on local policy"） |
| 签发的 `aud` **必须是单个字符串**，不得为数组 | 便于 RS 做精确相等比较，避免"数组里含我就通过"的宽松实现 |
| RS 收到 `aud` 为数组的 token **一律拒绝** | fail-closed；即便 AS 有 bug 也不会双向放行 |
| 无 `aud` 的 token **一律拒绝** | RFC 8707 对 AS 的 audience 限制只是 SHOULD，实践中易被放宽；RS 侧必须自己守住 |

⚠️ 这与 RFC 8707 允许的多 resource **不冲突**：规范允许 AS 拒绝（"limit the acceptable resources to those that were originally granted... or a subset thereof"）。我们选择"只接受一个"，属于被规范允许的收紧。

**关于 `/auth/me` 不能作为通用授权接口**（用户指令明确指出）：

现有 MCP 通过 `validateToken` 反查 `/api/v1/auth/me`（`client.ts:131-141`）。这条路**不能原样用作 OAuth 授权通道**，原因：

1. `/auth/me` 回答的是"你是谁"，不是"你能访问哪个资源"
2. 它不接收 `resource` 参数，无法判断 token 是否为本 RS 签发
3. 若 MCP 把任意 token 转给它并据此放行，就等于把 PeekView 的用户态当成了 MCP 的授权态——**两个 RS 共用 token 的漏洞正是这么产生的**

**上一版这里写错了一句，必须纠正**：上一版说「`/auth/me` 可用于 OAuth 接入后的身份解析」。这句话会把刚堵上的洞重新打开——若要让 `aud=<mcp>` 的 token 通过 `/auth/me`，就必须让 PeekView（它是另一个 RS）接受别人签发的 token，这正是 3.2 表格第 2 行禁止的事。

**正确做法**：OAuth 路径**完全不调用 `/auth/me`**。

MCP 本地验签后已经从 token 的 `sub` / `client_id` claim 拿到了需要的身份信息，无需再问 PeekView。现有 `validateToken`（`client.ts:131-151`）整体替换为本地 JWKS 校验：

| 现状 | OAuth 路径改为 |
|---|---|
| `fetch(/api/v1/auth/me)` 反查 | 本地用 JWKS 公钥验签，从 claim 取 `sub` / `client_id` / `scope` |
| 额外一次网络往返 | 零往返（JWKS 缓存） |
| 依赖 PeekView 可用性 | 不依赖（仅首次拉 JWKS 需要） |

**`pv_` 路径仍走 `/auth/me`**——因为 `pv_` key 本来就是 PeekView API 的凭证，`/auth/me` 对它是正确的归属查询。这正是"双模式"应有的差异，不是遗漏。

⚠️ 若 P1 认为必须有"身份权威源"，那就**新增一个 RS 专用端点**（只回 `active`/`sub`/`scope`/`aud`/`exp`），而不是复用 `/auth/me`。该端点的边界见 7.6。

### 3.3 三个反例（P1 必须写成测试）

| 反例 | 正确结果 |
|---|---|
| MCP 签发的 token 调 PeekView API | 401（`aud` 不匹配） |
| PeekView API 签发的 token 调 MCP | 401（`aud` 不匹配） |
| 两个 RS 都能调 `/auth/me` → 认为 token 可通用 | **错误推理**。`/auth/me` 能通不代表业务资源可通 |

第三条是本任务最需要警惕的思维陷阱，已写进 3.2。

### 3.4 多 RS 下的 audience 粒度（如实标注依据等级）

| 结论 | 依据等级 |
|---|---|
| 规范要求 RS 只接受为自己签发的 token | **官方原文 MUST** |
| 规范要求 client 的 `resource` 指向具体 MCP server | **官方原文 MUST** |
| RFC 8707 要求 AS 把 token 的 audience 限制到 `resource` | **官方原文 SHOULD**（非 MUST） |
| 多 RS 部署下"整个部署一个 audience"不可行 | **本项目推理**，规范未直接裁断 |

最后一条的推理链：若两个 RS 共享一个 audience，任一 RS 都无法完成"只接受为自己签发的 token"这条 MUST。规范对此场景无明文，但 MUST 的可行性要求 audience 必须 per-RS。**P1 需确认并记录这条推理**，不要伪装成规范强制。

---

## 四、Scope 与业务权限映射

### 4.1 原则

**不能直接按 HTTP 方法切分读写**。已实测存在以下反例：

| 反例 | 事实 |
|---|---|
| `POST /api/v1/entries/{slug}/star` | 是 POST，但只是标记收藏，不修改 entry 内容 |
| `DELETE /api/v1/stars?slug=` | 是 DELETE，但只影响自己的收藏 |
| `GET /api/v1/entries/{slug}/reads` | 是 GET，但泄露读取统计，不属"文档读取" |
| `POST /api/v1/auth/login` | 是 POST，是认证不是业务写 |
| `POST /api/v1/entries` | 若 `allow_anonymous_create=True`（默认），匿名即可创建——OAuth 不应因"支持了 OAuth"就自动开放 |

**最小权限原则**：没有被显式纳入映射表的 API 与 Tool，**不得默认获得 OAuth 访问权限**。

### 4.2 v1 Scope 集合（P0 建议，P1 定稿）

| Scope | 含义 | 权限继承 |
|---|---|---|
| `docs:read` | 读取 entry 与文件内容 | 独立 |
| `docs:write` | 创建、替换 entry | **隐含 `docs:read`**（否则无法确认写入目标是否存在） |

继承规则必须显式声明并在 RS 侧实现：持有 `docs:write` 的 token 在判断 `docs:read` 时应通过。

**继承规则有规范依据，不是我们的发明**：

> "Servers **MUST** account for scope hierarchies, where a broader scope implies narrower ones, when deciding whether a token is sufficient for an operation."
> — MCP Specification 2026-07-28, `basic/authorization` §Step-Up Authorization Flow

注意：这条 MUST 要求的是 **RS 在判权时必须考虑层级**，并未规定层级本身长什么样。`docs:write ⇒ docs:read` 是我们的设计选择，但"RS 必须处理层级"是规范义务。

**为什么不拆更细**：MCP 的 Security Best Practices 明确警告过度 scope 的危害，并列出常见错误——其中包括"使用通配或全权 scope"和"打包不相关权限以预判未来提示"。我们的两级设计正好落在"够用且不过度"的区间：6 个工具只有读/写两类语义。

同理，`scopes_supported` 也不应把未来可能用到的 scope 全列出来（规范说它是"minimal set necessary for basic functionality"），`docs:star` / `docs:share` 这类没有工具对应的 scope 不进 v1 的 `scopes_supported`。

### 4.3 API → Scope 映射表

下表基于实测的完整路由清单——用 `create_app().openapi()["paths"]` 枚举，**共 52 条 path+method**（40 条 distinct path），分布：admin 9 / apikeys 4 / auth 7 / captcha 3 / config 3 / entries 16 / stars 2 / teams 8。

> ⚠️ **上一版有两处错**：①总数写「45 条」②漏了 `GET /api/v1/teams/{slug}`（既未纳入也未排除），导致纳入 10 + 排除 41 = 51 与总数对不上。本版已修正为 **52**，纳入 **11**、排除 **41**，并补齐遗漏项。逐模块对账见本节末。

**纳入 OAuth 访问**：

| API | 方法 | Scope | 依据 |
|---|---|---|---|
| `/api/v1/entries` | GET | `docs:read` | 列举/搜索 entry |
| `/api/v1/entries/{slug}` | GET | `docs:read` | 读取 entry 详情 |
| `/api/v1/entries/{slug}/files/{file_id}` | GET | `docs:read` | 读取文件元信息 |
| `/api/v1/entries/{slug}/files/{file_id}/content` | GET | `docs:read` | 读取文件内容 |
| `/api/v1/entries/{slug}/raw` | GET | `docs:read` | Agent 读路径，MCP `get_entry` 依赖 |
| `/api/v1/entries/{slug}/download` | GET | `docs:read` | 下载打包，语义同读取 |
| `/api/v1/teams` | GET | `docs:read` | MCP `list_teams` 依赖；只读团队信息 |
| `/api/v1/teams/{slug}` | GET | `docs:read` | 单个团队详情。**上一版遗漏了这条**（既未纳入也未排除，导致清点缺口正好为 1） |
| `/api/v1/entries` | POST | `docs:write` | 创建 entry；MCP `create_entry` / `publish_files` 依赖 |
| `/api/v1/entries/{slug}` | PATCH | `docs:write` | 修改 entry 元信息 |
| `/api/v1/entries/{slug}` | DELETE | `docs:write` | 删除 entry；MCP `delete_entry` 依赖 |

**明确排除（不纳入 OAuth）**：

| API | 排除理由 |
|---|---|
| `/api/v1/auth/*`（register/login/logout/me/patch/delete/change-password） | 身份管理，不是资源访问。OAuth token 不能改密码、不能注销账号 |
| `/api/v1/apikeys/*`（4 条） | 凭证管理。若允许，OAuth token 可自造 `pv_` key 提权，绕过所有 scope |
| `/api/v1/admin/*`（9 条） | 管理操作。`pv_` key 目前可调（见 2.3），但 OAuth 不应继承这种粒度 |
| `/api/v1/entries/{slug}/star`（POST/DELETE） | 三条理由：①只改当前用户自己的收藏关系，不触碰 entry 文档内容 ②用户私有状态，与 entry 可见性强耦合 ③**MCP 侧无对应工具**。注意：它确实是写操作，说"非写"不准确；准确说法是"非文档写"。若将来需要，应作为独立 `docs:star` scope |
| `/api/v1/entries/{slug}/shares`（3 条） | 分享链接生成属安全敏感操作（可把私有 entry 外泄），v1 不做 |
| `/api/v1/entries/{slug}/reads` | 读取统计，泄露他人行为，v1 不做 |
| `/api/v1/stars`（GET/DELETE） | 个人收藏列表，非文档资源 |
| `/api/v1/teams` 的写操作（`POST ""`、`PATCH /{slug}`、`DELETE /{slug}`、`POST /{slug}/members`、`DELETE /{slug}/members/{user_id}`、`POST /{slug}/leave`，**共 6 条**） | 团队管理，v1 只开放 `GET`。上一版写「7 条」有误 |
| `/api/v1/entries/{slug}/files/{file_id}/render` | `/content` 已能拿到同一份文件字节；`render` 会**内联 sibling 资源**（CSS/JS/图片，见 TPV0104 的注入预算），泄露面明显大于单文件读取。v1 不开放给 OAuth |
| `/api/v1/config/*`、`/api/v1/captcha/*`、`/health`、`/metrics` | 公开或运维端点，无需 OAuth |

**清点核验（逐模块对账，总数与 OpenAPI 实测 52 一致）**：

| 模块 | 总数 | 纳入 | 排除 | 说明 |
|---|---|---|---|---|
| `entries.py` | 9 | 6 | 3 | 纳入 GET 列表/详情/download + POST/PATCH/DELETE；排除 star×2、reads×1 |
| `files.py` | 4 | 3 | 1 | 纳入 `{file_id}` 元信息 / `{file_id}/content` / `raw`；排除 `{file_id}/render` |
| `shares.py` | 3 | 0 | 3 | 全排除 |
| teams | 8 | 2 | 6 | 2 条 GET 纳入；6 条写操作排除 |
| auth | 7 | 0 | 7 | 全排除 |
| admin | 9 | 0 | 9 | 全排除 |
| apikeys | 4 | 0 | 4 | 全排除 |
| captcha | 3 | 0 | 3 | 全排除 |
| config | 3 | 0 | 3 | 全排除 |
| stars | 2 | 0 | 2 | 全排除 |
| **合计** | **52** | **11** | **41** | 逐条纳入清单见下表 |

**纳入的 11 条逐条列出（这是权威清单，上表模块列的"纳入"数由此推导）**：

| # | 方法 | 路径 | Scope | 所属模块 |
|---|---|---|---|---|
| 1 | GET | `/api/v1/entries` | `docs:read` | entries |
| 2 | GET | `/api/v1/entries/{slug}` | `docs:read` | entries |
| 3 | GET | `/api/v1/entries/{slug}/download` | `docs:read` | entries |
| 4 | POST | `/api/v1/entries` | `docs:write` | entries |
| 5 | PATCH | `/api/v1/entries/{slug}` | `docs:write` | entries |
| 6 | DELETE | `/api/v1/entries/{slug}` | `docs:write` | entries |
| 7 | GET | `/api/v1/entries/{slug}/files/{file_id}` | `docs:read` | files |
| 8 | GET | `/api/v1/entries/{slug}/files/{file_id}/content` | `docs:read` | files |
| 9 | GET | `/api/v1/entries/{slug}/raw` | `docs:read` | files |
| 10 | GET | `/api/v1/teams` | `docs:read` | teams |
| 11 | GET | `/api/v1/teams/{slug}` | `docs:read` | teams |

**排除的 41 条**：auth 7 + admin 9 + apikeys 4 + captcha 3 + config 3 + stars 2 = 28；加 `entries.py` 排除 3（star×2、reads×1）+ `files.py` 排除 1（render）+ `shares.py` 排除 3 + teams 排除 6 = **41**。

> 注：`entries` 前缀被三个文件共用（`entries.py` / `files.py` / `shares.py`），所以"模块"与"路径前缀"不是一一对应。上表的模块列按**定义该路由的 python 文件**划分。

### 4.4 MCP Tool → Scope 映射表

MCP 共 6 个工具（`packages/mcp-server/src/tools/`）：

| Tool | 模式 | 底层调用 | Scope | 说明 |
|---|---|---|---|---|
| `get_entry` | 共用 | `GET /api/v1/entries/{slug}/raw?purify=true` | `docs:read` | `client.ts:249-254` |
| `list_entries` | 共用 | `GET /api/v1/entries?...` | `docs:read` | `client.ts:164-181` |
| `list_teams` | 共用 | `GET /api/v1/teams` | `docs:read` | `client.ts:189-191` |
| `create_entry` | remote | `POST /api/v1/entries` | `docs:write` | `client.ts:153-158` |
| `publish_files` | local | `POST /api/v1/entries`（存在则覆盖） | `docs:write` | `publishFiles.ts:525` |
| `delete_entry` | 共用 | `DELETE /api/v1/entries/{slug}` | `docs:write` | `client.ts:183-188` |

注意工具集随 `mode` 变化（`tools/index.ts:24-31`）：`local` 模式给 `publish_files`，`remote` 模式给 `create_entry`，其余共用。

**RS 侧执行要求**：

1. `ListTools` 必须按 token scope 过滤——`docs:read` 的 token 看不到 `create_entry` / `publish_files` / `delete_entry`
2. `CallTool` 必须二次校验——不能只靠 ListTools 隐藏（客户端可直接调用未列出的工具）
3. 越权调用必须**两层都做**：
   - **HTTP 层**：返回 `403` + `WWW-Authenticate: Bearer error="insufficient_scope", scope="<所需>", resource_metadata="<PRM URL>"`。这是 MCP 规范的 **SHOULD**（原文："the server **SHOULD** respond with: `HTTP 403 Forbidden` ... `WWW-Authenticate` header ... `error="insufficient_scope"`"），上一版写"不适用"是错的
   - **JSON-RPC 层**：工具结果带 `isError` 并说明缺哪个 scope

   两层并存不冲突：HTTP 层让客户端能触发 step-up 授权，JSON-RPC 层让模型理解失败原因。

### 4.5 scope 与现有的"可见性"是两回事

必须明确区分，否则实现会混淆：

| 概念 | 层级 | 规则来源 |
|---|---|---|
| **scope** | OAuth 授权 | token 能做什么操作（读/写） |
| **可见性** | 业务权限 | 这个用户能看到哪些 entry（public / team / private） |

`can_read_entry`（`entry_service.py:89-104`）实现的是后者：`is_public or is_admin or owner_id == user_id or is_team_member or is_team_owner`。

**OAuth 不得放宽可见性**。持有 `docs:read` 的 token 只能读到该用户本来就能读的 entry；私有 entry 对非 owner 仍返回 404（防枚举）。这条必须写成测试。

---

## 五、OAuth Client 注册策略

### 5.1 规范现状（2026-07-28，含重大变更）

**DCR 已正式 Deprecated**。这是相对旧版的关键变化，直接推翻"以 DCR 为中心"的设计：

> "> [!WARNING]
> **Deprecated**: Dynamic Client Registration is deprecated as of protocol version `2026-07-28` (PR #2858). Under the feature lifecycle policy, it remains in the specification for at least twelve months after that revision's release before it becomes eligible for removal. New implementations should use Client ID Metadata Documents instead."
> — MCP Specification 2026-07-28

演进轨迹（四版逐版核对）：

| 版本 | DCR 措辞 |
|---|---|
| 2025-03-26 | `SHOULD` support |
| 2025-06-18 | `SHOULD` support |
| 2025-11-25 | `MAY` support，标注"为向后兼容保留" |
| **2026-07-28** | `MAY` + **Deprecated**，明确推荐 CIMD |

三种方式的规范等级（均无对 AS 的 MUST）：

| 方式 | 等级 | 原文 |
|---|---|---|
| **CIMD**（Client ID Metadata Documents） | AS/client **SHOULD** | "Authorization servers and MCP clients **SHOULD** support OAuth Client ID Metadata Documents" |
| **Pre-registration** | client **SHOULD** | "MCP clients **SHOULD** support an option for static client credentials" |
| **DCR** | **MAY** + Deprecated | "**MAY** support ... deprecated and retained for backwards compatibility" |

### 5.2 CIMD 是什么

用 HTTPS URL 当 `client_id`，该 URL 指向一份 JSON 客户端元数据文档。AS 在收到 URL 形态的 `client_id` 时按需 fetch。

**AS 侧义务（官方原文）**：

> "**For Authorization Servers:**
> * **SHOULD** fetch metadata documents when encountering URL-formatted client_ids
> * **MUST** validate that the fetched document's `client_id` matches the URL exactly
> * **SHOULD** cache metadata respecting HTTP cache headers
> * **MUST** validate redirect URIs presented in an authorization request against those in the metadata document
> * **MUST** validate the document structure is valid JSON and contains required fields"

**广告能力**：AS metadata 加 `"client_id_metadata_document_supported": true`。

⚠️ **SSRF 是真实风险**（用户指令明确要求评估）：AS 会主动 fetch 用户提供的 URL。必须限制：仅 HTTPS、禁止内网/回环/链路本地地址、禁止重定向跟随或严格限制、DNS 解析后再校验 IP、超时上限、响应体大小上限。**这是 P2 的安全专章必答项，不得略过。**

### 5.3 真实平台兼容性（官方文档直读，非二手）

这一节决定"实际要支持哪些注册方式"——**规范说 SHOULD/MAY 不等于平台会用，也不等于平台不用**。

| 平台 | CIMD | DCR | 预注册/手填 | redirect URI | 来源 |
|---|---|---|---|---|---|
| Claude（ai/Desktop/mobile/Cowork） | ✅ 默认，但**要求 metadata 同时 advertise `"none"` in `token_endpoint_auth_methods_supported`**，否则回落 DCR | ✅ 默认 | ✅ 托管凭据 / 连接时手填 / 静态 header(beta) | `https://claude.ai/api/mcp/auth_callback` | claude.com 官方文档 |
| Claude Code | ✅ 自带 CIMD 文档 | ✅ | ✅ | loopback 任意端口（`localhost` + `127.0.0.1`，忽略端口） | 同上 |
| ChatGPT / Codex | ✅ 首选 | ✅ 仍支持 | ✅ predefined client | `https://chatgpt.com/connector_platform_oauth_redirect`（满足 RFC 9207）或 `https://chatgpt.com/connector/oauth/{callback_id}` | developers.openai.com 官方文档 |
| Gemini Connected Apps | ❌ 不作为 DCR 的替代 | ⚠️ **须提供 `registration_endpoint`，或走 Play Console 手填**（二选一，等价性未验证） | ✅ Play Console 手填 client id/secret | `https://oauth-redirect.googleusercontent.com/r/*` 等 6 条通配 | developers.google.com 官方文档（2026-09-14） |
| Gemini CLI | 未提及 | ✅ 若支持则用 | ✅ `clientId`/`clientSecret` | `http://localhost:<随机端口>/oauth/callback` | geminicli.com 官方文档 |

**Gemini 的两段原文（必须一起读，只看一句会得出错误结论）**：

> "`registration_endpoint`
> For now, Play Console relies on Dynamic Client Registration (RFC 7591). **You must provide a registration endpoint in your metadata, or input client id/secret directly in the Play Console UI.** If your authorization server doesn't support Dynamic Client Registration (DCR), you must manually implement and populate the Client ID and Client Secret fields within the Play Console UI to complete the integration."

> "**Missing registration endpoint**: Even if your server supports Client ID Metadata Documents, the Gemini app (acting as the OAuth client connecting to your server) currently requires a dedicated `registration_endpoint` to be present in the discovery JSON."

**准确结论**：Gemini 需要「metadata 里有 `registration_endpoint`」**或**「在 Play Console 里手工填 client id/secret」。
⇒ **DCR 不是硬性唯一路径**；不做 DCR 则 Gemini 走人工配置，仍可接入，只是上线步骤多一步、且无法享受自动发现。
⇒ 但若希望 Gemini **零手工**接入，就必须做 DCR。

**Gemini 其他硬性要求（原文）**：

> "`response_types_supported`: Must contain the string `code`."
> "Missing `code` grant: The Gemini platform's automated system explicitly checks `response_types_supported` for the value `code`."

> "**Non-200 error**: If Gemini's automated metadata discovery mechanism hits your well-known URL and receives a 404 or 500, it will not attempt to guess other URLs."

（最后一条与 G4 直接相关：`.well-known` 若被 SPA 吞成 `200 text/html`，Gemini 会当成"有响应"然后解析失败；若返回非 200 则直接放弃。两种都不可用。）

**Claude 的三条实现细节（比规范更严）**：

> "A `401` is required to start sign-in, and Claude ignores a `WWW-Authenticate` header on a `200` response"
> "Claude uses only the first entry in your metadata's `authorization_servers` list. If you list more than one, Claude uses the first entry and doesn't fall back to later entries"
> "Claude waits up to 10 seconds for a response from your OAuth discovery, registration, and token endpoints, and up to 30 seconds for refresh token requests."

**ChatGPT 的关键期望（原文）**：

> "Expect ChatGPT to append `resource=https%3A%2F%2Fyour-mcp.example.com` to both the authorization and token requests. ... Configure your authorization server to copy that value into the access token (commonly the `aud` claim) so your MCP server can verify the token was minted for it and nobody else."

### 5.4 P0 结论：CIMD 为主、DCR 为兼容、预注册保底

理由链：

1. **只做 CIMD 会让 Gemini 必须走人工 Play Console 配置**（原文允许，但自动发现失效）
2. **只做 DCR 是逆规范而行**：DCR 在 2026-07-28 已 Deprecated，官方 deprecated registry 明确写 "new implementations **SHOULD NOT** adopt it"；且 Claude 官方警告 DCR 会"每次连接都注册新 client，在 AS 上堆积大量记录"
3. **两者都做符合规范**：CIMD 是 SHOULD（推荐路径），DCR 是 MAY（明确为向后兼容保留）

因此 P0 建议：

| 方式 | 定位 | v1 是否实现 |
|---|---|---|
| **CIMD** | 默认路径（Claude / ChatGPT 首选） | ✅ 实现 |
| **DCR** | 兼容兜底（Gemini 自动发现需要） | ✅ 实现，但标注为 deprecated-era 兼容能力 |
| **预注册** | 保底（Gemini 手填 / 企业部署） | ✅ 实现，成本极低（配置项 + 静态表） |

⚠️ **两个必须如实记录的点**：

- **"DCR 已弃用" ≠ "DCR 不该做"**。弃用说的是"不该是新实现的首选"，而 Gemini 的自动接入恰恰依赖它。这是规范与现实需求的真实张力，P1 需确认是否接受这个张力，还是接受 Gemini 走人工配置。
- **deprecated registry 的措辞是 SHOULD NOT**，不是 MUST NOT。所以我们做 DCR **不违规**，但要在文档里写清楚"这是为兼容 Gemini 而保留的 deprecated 能力"。**不得把它写成推荐做法。**

## 六、下游调用：Token Passthrough 禁令（本任务最硬的结构性约束）

这一节是全篇最容易被忽略、却直接决定架构的一节。它不属于"认证流程"，而是"认证之后 MCP 怎么调 PeekView API"。

### 6.1 规范禁令

MCP 规范（2026-07-28）对此有两处措辞，都是 **MUST**：

> "If the MCP server makes requests to upstream APIs, it may act as an OAuth client to them. The access token used at the upstream API is a **separate token**, issued by the upstream authorization server. The MCP server **MUST NOT** pass through the token it received from the MCP client."
> — `basic/authorization/security-considerations` §Access Token Privilege Restriction

> "MCP servers **MUST NOT** accept any tokens that were not explicitly issued for the MCP server."
> — `docs/2026-07-28/tutorials/security/security_best_practices` §Token Passthrough / Mitigation

规范还解释了为何禁止（原文要点）：绕开下游的限流与审计；下游日志显示的来源与真实来源不符；一个服务被攻破后可拿同一 token 横向访问其它服务。

### 6.2 现状：MCP 的每一步都在透传

源码直读，peekview-mcp 的 6 个工具**全部**通过 `client.ts` 调 PeekView API，而 `client.ts` 把客户端送来的 token 原样转发：

```ts
// packages/mcp-server/src/client.ts:33-41
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${userToken}`,   // ← userToken 就是 MCP 收到的那个串
  'X-PeekView-Source': 'mcp',
};
```

| Tool | 底层调用 |
|---|---|
| `get_entry` | `GET /api/v1/entries/{slug}/raw?purify=true` |
| `list_entries` | `GET /api/v1/entries?...` |
| `list_teams` | `GET /api/v1/teams` |
| `create_entry` | `POST /api/v1/entries` |
| `publish_files` | `POST /api/v1/entries` |
| `delete_entry` | `DELETE /api/v1/entries/{slug}` |

**关键观察**：现有 `pv_` 模式**本来就是这个形状**——`server.ts:104` 只检查 `pv_` 前缀，`client.ts:39` 把同一个串转发出去。它之所以长期没人觉得有问题，是因为 `pv_` key 没有 audience 概念，"MCP 的凭证"和"PeekView API 的凭证"恰好是同一个东西。

OAuth 一旦引入 `aud`，这个形状就变成了规范明文禁止的 passthrough：MCP 收到的是 `aud=<mcp>` 的 token，转给 PeekView API 时，API 看到的 token 根本不是为它签发的。

### 6.3 因此 E1 必须改写（上一版的内部矛盾）

上一版 brief 同时写了：

- 「MCP 签发的 token 调 PeekView API → 401」（E1）
- 「6 个工具全部调 PeekView API」（4.4）

**这两条同时成立会让所有工具失效。** 正确的表述是三层：

| 场景 | 结果 |
|---|---|
| 客户端拿 `aud=<mcp>` 的 token **直接**调 PeekView API | **拒绝** 401（aud 不匹配） |
| MCP 拿 `aud=<mcp>` 的 token **原样转发**给 PeekView API | **拒绝** 401（这既是 aud 不匹配，也是 passthrough —— 双重违反） |
| MCP 用它换来的 `aud=<peekview>/api` 的**下游 token** 调 PeekView API | **允许**（这是唯一合法路径） |

### 6.4 三条候选解法（P1 裁决）

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **T1 RFC 8693 Token Exchange**（P0 倾向） | MCP 拿 `aud=<mcp>` 的 token 向 PeekView AS 换 `aud=<peekview>/api` 的新 token，`sub` 保留 | 标准做法；保留用户身份与审计链；严格满足"separate token issued by the upstream AS" | AS 需实现 token exchange 端点；每次首次调用 +1 RTT（可按 token 生命周期缓存） |
| T2 服务凭据 + 用户断言 header | MCP 用自己的 client credentials 调 API，用户身份放 `X-PeekView-Act-As` 之类 header | 无额外 RTT，实现简单 | 用户身份的绑定从密码学退化为 header 信任；API 必须无条件信任 MCP 的断言，本质是把信任边界前移——弱于 T1 |
| T3 MCP 直连数据库 | 跳过 API | 无 RTT | 破坏分层；MCP 与 schema 耦合；两处权限逻辑必然漂移。**否决** |

**P0 倾向 T1**。理由：规范要求的是 "separate token issued by the upstream authorization server"，RFC 8693 正是为此设计的标准机制；T2 用 header 断言替代密码学绑定，是把规范要求降级实现。

### 6.5 交换端点必须认证调用方（否则 exchange 自己变成漏洞）

**这一条是第二轮独立审查补上的，P0 原稿漏了。**

单纯"校验来源 token 的 `aud == <mcp>` + 不许放宽 scope"**不足以**防止滥用。RFC 8693 §2.1 原文警告：

> "omitting client authentication allows for a compromised token to be leveraged via an STS into other tokens by anyone possessing the compromised token."

按当前设计，MCP 是公共客户端（CIMD，`token_endpoint_auth_method=none`），它自己**没有** secret。于是：

| 攻击 | 结果 |
|---|---|
| 攻击者拿到客户端手里的 `aud=<mcp>` token（这本来就是客户端持有的） | 直接调交换端点 → 换到 `aud=<peekview>/api` 的下游 token → **绕过 MCP 直连 API** |

`aud` 校验挡不住这条——来源 token 的 `aud` 本来就合法。因此**交换端点必须能区分"这是 MCP 在交换"与"这是任何持有 token 的人在交换"**。

**三条候选（P1 裁决）**：

| 方案 | 做法 | 优劣 |
|---|---|---|
| **E1：MCP 用独立服务凭据认证**（P0 倾向） | MCP 配一个 `mcp_service` 凭据（client credentials / 预共享密钥），交换请求必须带它；AS 校验"凭据是 MCP 的"且"来源 token 的 aud 是 MCP 的"，两者同时成立才换 | 密码学绑定，最稳；代价是 MCP 要管一份服务凭据（但这份凭据只能换 token、不能直接调 API，泄露面可控） |
| E2：交换端点仅回环可达 | 只监听 `127.0.0.1`，外部不可达 | 实现简单；但 MCP 与 AS 不同机时失效，且"回环"不是认证 |
| E3：不认证，靠 aud + scope 收紧 | — | **否决**：正是 RFC 8693 警告的情形 |

**E1 的补充约束**：

- 服务凭据**只能**用于交换端点，不能用于业务 API（否则等于给了 MCP 一把万能钥匙，回到 T2 的问题）
- 服务凭据泄露的影响 = 可把任意 `aud=<mcp>` token 换成下游 token，所以仍需密钥管理与轮换
- 交换结果必须保留原 token 的 `sub`（用户身份），不能变成"以 MCP 服务身份访问"

⚠️ **T1 其余待决项（P1 必答）**：

1. **缓存策略**：若每次工具调用都换一次 token，延迟翻倍。需按 (sub, scope) 缓存直至接近过期
2. **AS 挂则全链路挂**：MCP 无法离线工作。这是可接受的（现状本就依赖 API 可用）
3. **token exchange 端点的位置**：放 `/oauth/token` 用 `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`，还是独立端点，P1 定
4. **交换后 scope 取交集**：**无 RFC 明文**（RFC 8693 §2.1 只把 `scope` 定为 OPTIONAL "desired scope"）。这是本项目的安全策略：不取交集就等于提权入口。属"本项目策略"而非"规范强制"，与 3.4 的标注方式一致

### 6.6 `pv_` 路径如何处置（兼容性决策）

用户要求 `pv_` 不强制迁移。因此：

- **`pv_` 路径保持现状**：仍透传给 API
- **OAuth 路径不走透传**：必须用 T1（或 P1 裁决的方案）
- **不在本任务里"顺手修" `pv_` 的透传形状**——那会让现有用户的 key 全部需要重新配置。若将来要把 `pv_` 也改成 token exchange，那是独立任务

**必须把话说准：`pv_` 模式确实就是规范定义的 passthrough。**

规范对 passthrough 的定义是"accepts tokens from an MCP client **without validating that the tokens were properly issued to the MCP server** and passes them through to the downstream API"。`pv_` 恰好符合：`server.ts:104` 只查前缀，从不验证这个 key 是否"签发给 MCP"，然后原样转给 PeekView API。

所以不能辩称"`pv_` 不算透传"。正确的表述是：

| 模式 | 是否 passthrough | 处置 |
|---|---|---|
| `pv_`（legacy） | **是**，符合规范定义 | 保留但**如实标注为已知的 legacy anti-pattern**；不因新规范收紧（会破坏全部现存部署）；写入文档供未来迁移 |
| OAuth（新增） | **禁止** | 必须 token exchange |

**为什么不顺手修掉 `pv_`**：`pv_` key 是用户直接持有的 PeekView API 凭证，MCP 在中间只是个转发器。要"修"就得让每个 `pv_` 用户改用 OAuth 或改用新的服务凭据模型——这是**破坏性变更**，且用户已明确要求不强制迁移。本任务的选择是：**新增路径合规，存量路径记账不修**，并把这条记为技术债（见 12.2）。

⚠️ 这一处置**不是规范许可的**——规范没有给 legacy 豁免条款。这是一个有意识的工程取舍：用"存量不动 + 存量记账 + 新增合规"换取不破坏现有部署。P1 需确认接受这个取舍，而不是误以为"`pv_` 不算透传所以没问题"。

---

## 七、Token 签发与验证架构

### 7.1 三个候选方案

| 维度 | A：HS256 + 内部验证 | B：RS256 + JWKS | C：不透明 token + Introspection |
|---|---|---|---|
| **信任边界** | 两个 RS 都要拿到共享密钥，或每次反查 AS | RS 只需公钥，无私钥泄露风险 | RS 每次问 AS |
| **密钥管理** | 共享对称密钥，泄露即全毁 | 私钥只在 AS，公钥可公开 | 只需 introspect 端点鉴权 |
| **Audience 验证** | 能验（在 payload 里） | 能验（标准 `aud`） | 能验（响应里带 `aud`） |
| **MCP 本地验签** | 可以（有了密钥） | 可以（有公钥 + JWKS） | 不行，必须问 AS |
| **内部验证接口** | 可选 | 不需要 | 必需 |
| **每调用性能** | 本地验签 ≈0；反查 +1 RTT | 本地验签 ≈0（JWKS 可缓存） | +1 RTT 每次 |
| **密钥泄露影响** | 可伪造任何用户的任何 scope | 需私钥泄露才可伪造；公钥泄露无害 | 无签名密钥可泄露 |
| **Token 撤销** | 弱（需黑名单，破坏无状态） | 弱（同左） | **强（即时）** |
| **多 RS 扩展** | 密钥要分发给每个 RS | 公钥可公开分发 | 都依赖 AS 可用性 |
| **实现复杂度** | 低 | 中（密钥生成/轮换/JWKS 端点） | 中（新端点 + 表） |

### 7.2 P0 立场：B（RS256 + JWKS），不选 A

**不选 A 的理由**：

现有 HS256 secret 是 `~/.peekview/.secret_key`（`auth.py:28`），**同时用于登录 session JWT**。若 OAuth token 也用它：

1. 会话 JWT 与第三方 token 共用密钥，风险绑定——会话密钥泄露即等同 OAuth 全泄
2. 想把 OAuth token 发给 MCP 验签，就必须把**会话签名密钥**交给另一个进程
3. 无法区分"这是会话 token 还是 OAuth token"的密码学边界，只能靠 payload 里加 `typ` 字段这种软约定

**选 B 的理由**：

1. RS256 私钥只留在 AS；MCP 只需公钥
2. 标准 `aud`/`iss`/`exp`/`kid` 校验，与 OAuth 生态一致
3. 与现有会话 JWT 彻底分离——**不同的密钥、不同的算法、不同的 `typ`**
4. 可行性已验证：`python-jose` + `cryptography` 在 venv 内可直接生成 RSA 密钥、RS256 签名、导出 JWKS（见第十节 V8 实测）
5. 未来多 RS 扩展只需分发公钥

**不选 C 的理由**：introspection 每请求 +1 RTT，对 MCP 工具调用这种高频路径不划算；且 MCP 侧要新增对 AS 的强依赖（AS 挂则 MCP 全挂）。撤销能力虽强，但 v1 不做撤销管理页（见 9.3 与 12.2），C 的优势发挥不出来。

⚠️ **B 不是"规范强制"，但也不是"规范无话可说"**：

- MCP 规范**未强制** token 格式（可 JWT 可不透明），这一点成立
- 但它**以 RFC 9068 为示例/推荐**——security-considerations 原文："via the audience claim, as mentioned in [RFC9068](...)"，且 authorization 的示例 token 就是 JWT
- 因此准确表述是：「规范不强制格式；若选 JWT，则应遵循 RFC 9068」

**P1 需确认此判断**：不要把 B（RS256）写成"规范要求"，也不要把"规范没强制格式"理解成"随便怎么做都行"。

### 7.3 Token 结构：采用 RFC 9068（JWT Access Token Profile）

既然 7.2 选了 JWT 形态，就不该自创 claim 方案。**RFC 9068** 正是"用 JWT 表示 OAuth access token"的标准 profile，直接采用可省掉大量自定义设计，并顺带解决"JWT 与 ID token 混淆"这类经典漏洞。

**RFC 9068 的硬性要求（原文摘录）**：

| 项 | 要求 | 原文 |
|---|---|---|
| `typ` header | access token **MUST** 带 `at+jwt` | "JWT access tokens **MUST** include this media type in the `typ` header parameter ... the `typ` value used SHOULD be `at+jwt`" |
| RS 校验 `typ` | **MUST** 校验，非 `at+jwt`/`application/at+jwt` 一律拒绝 | "The resource server **MUST** verify that the `typ` header value is `at+jwt` or `application/at+jwt` and reject tokens carrying any other value" |
| 必要 claims | `iss` / `exp` / `aud` / `sub` / `client_id` / `iat` / `jti` 全部 **REQUIRED** | §2.2 |
| `aud` 唯一性 | AS **MUST** 用互不相同的 `aud` 区分同一 issuer 下不同资源的 token | "authorization servers **MUST** use a distinct identifier as an `aud` claim value to uniquely identify access tokens issued by the same issuer for distinct resources" |
| 算法 | **MUST NOT** 用 `none`；**MUST** 支持 RS256 | §2.1 |
| RS 校验 `aud` | **MUST** 校验 `aud` 含本 RS 的 resource identifier | §4 |
| RS 校验 `iss` | **MUST** 与 discovery 得到的 issuer 精确相等 | §4 |

**PeekView 的 token 结构（P0 建议）**：

```
Header:  { "alg": "RS256", "typ": "at+jwt", "kid": "<key-id>" }
Payload: {
  "iss":       "https://<peekview-public>",
  "aud":       "https://<peekview-public>/api"   // 或 "https://<mcp-public>/mcp"
  "sub":       "<user_id>",
  "client_id": "<oauth client id>",
  "iat":       <issued at>,
  "exp":       <expiry>,
  "jti":       "<unique id>",
  "scope":     "docs:read docs:write"
}
```

⚠️ **`aud` 必须是资源的规范化 URI，而不是用户或客户端标识**。RFC 9068 §5 明确要求用互不相同的 `aud` 区分不同资源的 token——这正是 §3.2 的 audience 隔离在 token 层面的落地，两处要求是同一件事的两个视角。

⚠️ **`python-jose` 不强制校验 `typ`**（实测：`jwt.decode(..., access_token=True)` 对无 `typ` 的 token 仍通过——该参数是 `at_hash` 校验用的）。因此 RS 侧必须**手动读 header 校验 `typ`**，不能依赖库的默认行为。

### 7.4 关键约束：OAuth token 必须与登录 JWT 可区分

现有 `_looks_like_jwt` 只判断"3 段"（`api/_shared.py:85-87`）：

```python
def _looks_like_jwt(token: str) -> bool:
    return len(token.split(".")) == 3
```

RS256 OAuth token 也是 3 段，会命中这个启发式。若 `get_current_user` 直接拿它去 HS256 验签，必然失败并静默降级为匿名——**不会报错，只会让人以为"没登录"**。

因此必须：

1. **用 RFC 9068 的 `typ: at+jwt` 做类型判别**（见 7.3），不要另造私有 claim。标准 header 比自定义 claim 更可靠，也更容易被第三方正确实现
2. `get_current_user` 先读 header 的 `typ`，再决定走哪条验签路径：`at+jwt` → OAuth（RS256/JWKS + `aud` 校验）；`JWT` → 会话（HS256）；两者都不匹配 → 拒绝。**不得用同一个 `jwt.decode` 走两条路**
3. 类型判断失败时必须**明确拒绝**，不能静默当匿名（否则 `docs:read` 失效会表现为"看不到内容"而非"授权失败"）
4. 同时校验 `aud` 与 `iss`——仅靠 `typ` 不足以防跨资源复用（见 §3.2）

### 7.5 JWKS 端点与密钥轮换（P2 无法开工的缺口，审查指出）

上一版只说"RS256 + JWKS"，但从未回答**JWKS 端点归谁、MCP 怎么缓存、`kid` 怎么轮换**。这三项缺失会让 P2 卡住。

| 项 | P0 契约 |
|---|---|
| 端点归属 | **PeekView AS 提供** `/.well-known/jwks.json`（或 RFC 8414 metadata 的 `jwks_uri` 指向它）。peekview-mcp 不提供，只消费 |
| ⚠️ 与 SPA catch-all 冲突 | **这是新增的 `.well-known` 路径，同样会被 G4 吞掉**。`main.py:598` 的 `serve_spa_catchall` 只对 `api/`、`health` 前缀 404，`/.well-known/jwks.json` 会落到 `index.html`。必须与 AS metadata、PRM 一并注册在 `_setup_static_files` **之前**（见 8.2 的 G4 处置） |
| 元数据声明 | AS metadata 必须含 `"jwks_uri": "<issuer>/.well-known/jwks.json"` 与 `"token_endpoint_auth_methods_supported"`（后者含 `"none"` 见 S9b） |
| 公钥内容 | JWK 需含 `kty` / `n` / `e` / `alg` / `use: "sig"` / **`kid`**。⚠️ `python-jose` 的 `to_dict()` **只产出 `kty`/`n`/`e`/`alg`**（实测，见 V8），`use` 与 `kid` 必须**手工注入** |
| `kid` 生成 | 不用随机串，用公钥指纹（RFC 7638 JWK Thumbprint 的 SHA-256，base64url）。好处：同一密钥永远同一 `kid`，重启不漂移 |
| 轮换策略 | 支持同时发布多把公钥（旧 + 新）。签发只用最新的，验证接受全部未过期公钥。旧公钥保留 ≥ 一个 token TTL（12h）+ 宽限，确保轮换期间无 token 失效 |
| RS 缓存 | 按 `Cache-Control` 缓存；**未知 `kid` 时必须重新拉取一次**再判定失败（否则轮换后旧 RS 会拒绝所有新 token）。重拉要限频，防止被伪造 `kid` 打爆 |
| 失败语义 | 拉不到 JWKS → 503（服务不可用），**不是** 401（认证失败）。两者混淆会让客户端误以为需要重新授权 |

⚠️ **`kid` 是 V8 那个错误结论掩盖的字段**：上一版误以为 `to_dict()` 会自动生成，实际不会。P1 需确认指纹方案，P2 需把它写进实现。

### 7.6 关于内部验证接口的边界（若 P1 最终选 C 或需要 introspection）

用户指令要求：若采用内部 Introspection / Token Validation 接口，必须定义清楚。P0 立场——**如果做，必须满足**：

| 要求 | 契约 |
|---|---|
| 只允许可信 RS 调用 | 不接受公网匿名调用；需独立的 RS 凭据（不是用户 token，不是 `pv_` key） |
| 如何验证调用方 | 预共享密钥 header 或 mTLS；预共享密钥走配置，不落 DB |
| 验证内容 | `iss` / `aud` / `exp` / 签名 / `scope`，全部校验后才返回 |
| 返回最小信息 | 只返回 `active` + `sub` + `scope` + `aud` + `exp`；**不返回**密码、邮箱、admin 标志等 |
| 不得成为绕过入口 | 端点本身不接受用户可控的 `aud`；只回显"这个 token 对什么资源有效"，不签发新 token |
| 不得公网暴露 | 仅监听回环或内网；若必须公网，需独立鉴权且限流 |

**P0 建议 v1 不做 introspection**（理由见 7.2），但把上述契约记入 P1 决策，若 P1 改变方案可直接采用。

---

## 八、OAuth 安全协议契约

### 8.1 规范依据（标明版本）

| 规范 | 版本/编号 | 本任务适用条款 |
|---|---|---|
| MCP Authorization | **2026-07-28**（当前） | resource 参数、PRM、AS metadata、token 校验、PKCE、scope 挑战、错误语义、client 注册 |
| RFC 6749 | OAuth 2.0 | 授权码流程基础 |
| RFC 7636 | PKCE | `S256` 挑战 |
| RFC 8707 | Resource Indicators | `resource` 参数、`aud` 映射 |
| RFC 8414 | AS Metadata | `/.well-known/oauth-authorization-server` 字段 |
| RFC 9728 | Protected Resource Metadata | `/.well-known/oauth-protected-resource{path}`、401 的 `resource_metadata` |
| RFC 9207 | Authorization Server Issuer Identification | 授权响应 `iss` 参数 |
| RFC 6750 | Bearer Token | `WWW-Authenticate`、`insufficient_scope` |
| **RFC 9068** | JWT Access Token Profile | `typ: at+jwt`、REQUIRED claims、`aud` 唯一性、算法白名单 |
| **RFC 8693** | Token Exchange | 下游 token 换取（若不采用则本任务不涉及） |
| **RFC 8252** | OAuth for Native Apps | loopback redirect 的端口放宽规则 |
| **RFC 8725** | JWT Best Current Practices | 跨 JWT 混淆防护、算法混淆防护 |
| RFC 9700 | OAuth 2.0 Security BCP | 公共客户端、token 处理安全实践 |
| RFC 7591 | Dynamic Client Registration | DCR（兼容路径） |
| OAuth 2.1 draft | draft-ietf-oauth-v2-1 | PKCE 强制、公共客户端约束 |

### 8.2 逐条实现契约

下表把规范要求转成 PeekView 的具体契约。**等级标注依据原文，不擅自升级**。

| # | 要求 | 等级 | PeekView 实现契约 | 验收 |
|---|---|---|---|---|
| S1 | Redirect URI 精确匹配 | RFC 6749 MUST | 注册时存完整 URI；授权时字符串精确比较。**例外**：loopback（`localhost`/`127.0.0.1`/`[::1]`）允许端口不同，但 scheme/host/path/query 必须一致（RFC 8252 §7.3） | 非 loopback 差一个字符即拒绝；loopback 不同端口放行 |
| S2 | 授权码短期有效 | OAuth 2.1 | TTL ≤ 10 分钟 | 过期码兑换被拒 |
| S3 | 授权码一次性 | RFC 6749 MUST | 兑换即失效；重复兑换第二次拒绝 | 同一码两次兑换，第二次失败 |
| S4 | 授权码绑定 | RFC 6749 / 8707 | 绑定 `client_id` + `user_id` + `redirect_uri` + `resource` + PKCE `code_challenge` | 任一项不匹配即拒绝 |
| S5a | client 必须用 S256 | **MCP MUST**（client："**MUST** use the `S256` code challenge method when technically capable"） | — | — |
| S5b | AS 必须 advertise `code_challenge_methods_supported` | **RFC 8414 下属强推断**；OIDC Discovery 下才是明文 MUST | metadata 必须含该字段（本项目按 MUST 实现） | 缺该字段时合规 client **MUST** 拒绝继续（client 侧确是 MUST） |
| S5c | AS 拒绝 `plain` | 本项目策略 | 授权端点仅接受 `code_challenge_method=S256` | `plain` 请求 → `invalid_request` |
| S6 | State 防 CSRF | OAuth 2.1 | 授权页原样回传 `state`；不解释、不修改 | 回传值与请求一致 |
| S7 | `iss` 参数 | RFC 9207（MCP SHOULD） | 授权响应带 `iss`；metadata 设 `"authorization_response_iss_parameter_supported": true` | 响应含 `iss` 且与 metadata `issuer` 一致 |
| S8a | client 侧必须带 `resource` | **MCP MUST**（client） | — | 客户端不带 `resource` 时应被拒绝或按默认资源处理（P1 定） |
| S8b | AS 侧授权与兑换的 `resource` 必须一致 | **本项目策略**（严于规范） | 严格相等校验；不一致 → `invalid_target` | 投诉 A 资源换码、B 资源换 token → 拒绝 |
| S8c | 只接受单个 `resource` | **本项目策略**（规范允许 AS 收紧） | 多个 → `invalid_target` | 见 3.2.1 |
| S9a | 公共客户端不得发可用 secret | **RFC 9700** | 公共客户端即使请求 secret 也不得下发可用 secret | 公共客户端 secret 为空或不可认证 |
| S9b | metadata 必须含 `"none"` in `token_endpoint_auth_methods_supported` | **Claude 平台要求**（非 RFC 9700） | 与 S9a 分开实现；缺它则 Claude 回落 DCR 而非 CIMD | 见 5.3 / U7 |
| S10 | Token 校验 | MCP MUST | 校验 `iss` / `aud` / `exp` / 签名 / 算法白名单。**算法白名单必须显式，禁止 `none`，禁止从 token header 取算法** | 篡改 `aud` 拒绝；过期拒绝；`alg: none` 拒绝；`alg: HS256`（对 RS256 token）拒绝 |
| S11a | AS 签发 scope 与请求不同时必须告知 | **RFC 6749 §3.3 MUST** | token 响应的 `scope` 字段回显实际签发的 scope | 请求 2 个、只批 1 个时响应含 `scope` |
| S11b | 授权页展示 = 签发 = RS 校验（三方一致） | **本项目策略**（审查核实：MCP 规范无此 MUST） | 三处用同一 scope 常量；用户不同意某 scope 则不得签发 | 用户只同意 `docs:read`，token 里不得有 `docs:write` |
| S12 | 错误语义 | RFC 6750 + MCP | 缺 token / token 无效 → `401` + `WWW-Authenticate: Bearer resource_metadata="..."`；scope 不足 → `403` + `error="insufficient_scope"` + `scope="..."` | 401/403 各自 header 格式正确 |
| S13 | 不得跳过用户同意 | OAuth 2.1 | **登录态 ≠ 授权同意**。已登录用户首次授权某 client 时仍须展示同意页 | 已登录状态直接访问 `/oauth/authorize` 必须出同意页，不能直接发码 |
| S14a | 授权时明确展示 redirect URI 的 hostname | **MCP security-considerations MUST**（注意语境：该句位于 §Localhost Redirect URI Risks 子节，针对 CIMD 的 localhost 冒充风险；句子本身无条件） | 授权页显示 redirect hostname | Playwright 断言可见 |
| S14b | 同意页五项 | **MCP security_best_practices MUST**（原文主体是 "MCP-level consent page"，出现在 MCP proxy 章节；PeekView 作为 AS 参照执行） | ①client 名称 ②请求的 scope ③redirect_uri ④**CSRF 保护** ⑤防 iframe（`frame-ancestors` / `X-Frame-Options: DENY`） | 五项逐条断言（④由 S6 的 state 覆盖，但需在同意页提交时校验） |
| S15 | scope 挑战 | MCP SHOULD | 401/403 的 `WWW-Authenticate` 带 `scope`；**一次给全**，不要逐次挤 | header 含完整所需 scope |
| S16 | `insufficient_scope` 语义 | RFC 6750 | 403 而非 401（已认证但权限不足） | scope 不足返回 403 |
| S17 | DCR 的 `application_type` | MCP 2026-07-28 MUST（client 侧） | AS 接受该参数；native 类客户端默认 `"native"` | 携带/省略均可正常注册 |
| S18 | DCR 限流 | RFC 7591 安全实践 | 注册端点必须限流。SDK 参考实现为 20 次/小时 | 超限返回 429 |
| S19 | CIMD fetch 的 SSRF 防护 | MCP 2026-07-28 SHOULD 考虑 | 仅 HTTPS、禁内网 IP、禁重定向跟随、DNS 后校验、超时、响应体上限 | 提交 `http://`、内网 IP、超长响应均被拒 |
| S20 | 不向公共客户端发 secret | RFC 9700 §2.1 | 公共客户端注册时即使请求 secret 也不得下发可用 secret | 公共客户端 secret 为空或不可用于认证 |

⚠️ **关于 S8b / S8c 的等级说明**：RFC 8707 对 AS 的 audience 限制是 **SHOULD**，且 §2.2 明确允许 AS 用 local policy 把可接受资源限制为"originally granted ... or a subset thereof"。因此"必须完全一致"与"只接受单个"都是**我们选择的严格策略**，不是规范 MUST。上一版 S8 把这两条合并标成"MUST"是错标，本版已拆开。

### 8.3 授权页的登录态与同意（G8 衍生）

- `/login` 是**死路由**（G8）：`FRONTEND_ROUTES` 有它，`router.ts` 没有。授权页需要新路由。
- 授权页必须能内嵌登录流程。可直接复用现有 `LoginDialog.vue` 的组件能力，或抽出一份表单逻辑。
- **captcha 必须生效**：生产配置 `auth.captcha_enabled=true`（`~/.peekview/config.yaml` 实查），登录受 captcha 约束（`api/auth.py:69,139`）。授权页复用登录时不得绕过。
- 已登录用户走同意页，**不重新登录**（这是选 AS-in-backend 的核心收益）。

---

## 九、Token 生命周期与撤销

### 9.1 v1 不引入 refresh_token

**保留此倾向，但明确代价**：

| 后果 | 说明 |
|---|---|
| 有效期必须足够长以可用 | 太短则用户频繁重新授权，体验差 |
| 有效期必须足够短以安全 | 太长则泄露窗口大 |
| 撤销无法即时 | 无状态 JWT 无法作废，只能等过期 |
| 客户端需能重新授权 | 过期后客户端会重新触发授权流程（这是标准行为，但用户会再看到一次同意页） |

#### 9.1.1 一条真实的规范冲突（P1 必答）

| 来源 | 要求 |
|---|---|
| MCP 2026-07-28 security-considerations | "For public clients, authorization servers **MUST** rotate refresh tokens as described in OAuth 2.1 Section 4.3.1" |
| Google Connected Apps 文档 | "to implement **Persistent Linking**, you must **avoid rotating the Refresh Token** during this exchange. Instead of issuing a new one, return the exact same Refresh Token in the JSON response and extend its expiration date on your backend." |

若 Gemini 是公共客户端（它用 PKCE、无 client secret 的路径），这两个要求直接矛盾：MCP 要求轮换，Google 要求不轮换。

**这为"v1 不发 refresh token"提供了额外支撑**：先不引入 refresh，就不必现在就裁决这个冲突。但必须在 P1 记录：一旦将来要支持 Gemini 的持久链接，这个冲突必须先解决（可能要按 client 区分策略，或对 Gemini 走 confidential client 路径）。

Google 建议发 refresh 的原文（说明这个压力的来源）：
> "Tip: Although refresh tokens are optional, we **strongly recommend** configuring your authorization server to issue them. Refresh tokens let the Connected apps platform maintain access without having to re-authenticate the user."

### 9.2 有效期建议（P1 定稿）

| 参数 | P0 建议 | 理由 |
|---|---|---|
| Access token TTL | **12 小时**（P1 定稿） | 见下方说明——1 小时与"无 refresh"组合会产生可用性硬伤 |
| 授权码 TTL | **5 分钟** | RFC 6749 §4.1.2 是 RECOMMENDED ≤10 分钟，我们取更严 |
| 刷新机制 | 无（v1） | 见 9.1 |

**为什么从 1 小时改为 12 小时（审查发现的自我矛盾）**

上一版写"TTL 1 小时"，理由栏却写"对每天使用的场景可接受一次重授权"。**1 小时 ≠ 每天一次**，同一节内自相矛盾。而且在无 refresh token 的前提下，1 小时 TTL 意味着用户**每小时**要在同意页点一次——这比一次性粘贴 `pv_` key 体验更差，直接抵消了 2.1 的立项动机（"用户不再手工复制 key"）。

**两个自洽的选择**：

| 选项 | 做法 | 代价 |
|---|---|---|
| **A（P0 建议）** | TTL 12 小时，无 refresh | 泄露窗口 12 小时；用户每天约需重授权 1 次 |
| B | TTL 1 小时 + 实现 refresh token | 泄露窗口 1 小时，但引入 9.1.1 的规范冲突与轮换/重放检测工作量 |

**P0 选 A**：在 refresh 的规范冲突（9.1.1）解决之前，用较长 TTL 换取可用性，并**显式接受 12 小时泄露窗口**。若 P1 判定 12 小时窗口不可接受，则必须走 B 而不是偷偷把 TTL 调回 1 小时。

⚠️ **这个 12 小时不是随便定的**：它等于"一个工作日"。若真实使用数据显示需要更长（如每周一次），应通过 refresh 解决，而不是继续拉长 TTL——无限拉长等于退化成永久凭证。

**对比参照**：现有登录 JWT 是 **7 天**（`config.py:285-288` `token_expire_days: int = 7`）。OAuth token 不能沿用这个值——它是给第三方持有的。

### 9.3 泄露风险与应对（P1 必答）

| 问题 | v1 答案 | 缺口 |
|---|---|---|
| Token 泄露最大暴露窗口 | = TTL（**12 小时**） | 无法提前失效。这是 9.2 选 A 的显式代价 |
| 如何禁用某个 Client | 无机制 | **需要 pre-registration 表的 `disabled` 字段**（低成本，建议 v1 纳入） |
| 是否支持撤销单个授权 | 不支持 | 需授权记录表 + 管理 UI，**排除 v1** |
| 用户账号被禁用 | `get_current_user` 已在每次请求查 `user.is_active`（`auth.py:175-178`），禁用即时生效 ✅ | 无 |
| 用户改密码 | 现有机制不使旧 JWT 失效（无 token version） | **这是既有缺口，非本任务引入**；P1 需确认是否纳入 |
| 客户端如何重新授权 | 按标准 OAuth 流程重新走一遍 | 无 |

**关键结论**：**不能隐藏撤销风险**。v1 明确接受"token 有效期内无法撤销"这一代价，并保证：①TTL 有明确上限（12 小时，见 9.2）②账号禁用即时生效 ③提供 client 级 `disabled` 开关。完整的授权管理与撤销页面列为后续任务。

---

## 十、本轮已验证的关键事实

全部为本轮现测或源码直读，**不沿用旧版 brief 的结论**。

| # | 事实 | 证据 |
|---|---|---|
| V1 | PeekView 用 HS256，密钥为 `~/.peekview/.secret_key`，与会话 JWT 共用 | `auth.py:26-28`，`_load_or_generate_secret_key` 三级优先级 |
| V2 | `decode_access_token` 只验签名与 `exp`，无 `aud`/`iss` | `auth.py:121-135` |
| V3 | `get_current_user` 优先级：header JWT > cookie JWT > `pv_` key | `auth.py:146-189` |
| V4 | `pv_` key 验证后返回 `User`，权限与登录完全等价（含 admin） | `auth.py:181-189` + `require_auth`/`require_admin` |
| V5 | 认证测试基线 **92 个全绿** | 实测 `test_auth.py` 50 + `test_apikey.py` 26 + `test_auth_me.py` 16 = 92 passed，failures=0 errors=0（上一版写"72+20"拆分有误，总数对） |
| V6 | MCP 测试基线 **30 个全绿** | `npx vitest run tests/server.test.ts` → 30 passed |
| V7 | MCP 认证测试契约断言"拒绝非 `pv_` 且错误信息含 `pv_`" | `server.test.ts:103-121`，含 JWT 形状 token 被拒的用例 |
| V8 | RS256 + JWKS 在现有依赖下**可用，但 `kid`/`use` 需手工注入** | venv 实测：`jwk.construct(pub).to_dict()` 只返回 `["alg","e","kty","n"]` 四字段——**不含 `kid`，不含 `use`**。RS256 签名与验签本身正常。**上一版写"生成含 use/kid"是错的**，会让 P2 低估密钥轮换工作量 |
| V9 | SQLite 表由 `SQLModel.metadata.create_all()` 创建，`_run_migrations` 只做 ALTER + 部分 `CREATE TABLE IF NOT EXISTS` | `database.py:370-382`；新增表只需在 `models.py` 定义即可 |
| V10 | 生产 DB 现有 16 张表，无任何 OAuth 相关表 | 只读直查 `~/.peekview/peekview.db` 的 `sqlite_master`（`mode=ro` URI）。⚠️ 审查者因铁律 5 未复核此项，**由主 Agent 单方确认**；结论本身不涉写操作 |
| V11 | 授权页路由不存在；登录是 `LoginDialog.vue` 弹窗 | `router.ts` 无 `/login`；`LandingView.vue:189` |
| V12 | `.well-known` 落到 SPA catch-all，返回 `200 text/html` | 公网实测 + `main.py:598` 源码 |
| V13 | MCP 无"自身公网地址"配置项 | `config/file.ts` 的 `ConfigFileData` 有 `peekview.{url,public_url,api_key}` 与 `server.{host,port,cors_origins,mode,allowed_paths,trust_all_paths,path_namespaces}`，但**没有任何字段表达 MCP 自己的公网地址** |
| V14 | MCP 的 `validateToken` 走 `/api/v1/auth/me` 反查 | `client.ts:131-141` |
| V15 | API 共 **52 条** path+method（40 条 distinct path，10 个模块） | `create_app().openapi()["paths"]` 枚举实测：admin 9 / apikeys 4 / auth 7 / captcha 3 / config 3 / entries 16 / stars 2 / teams 8。**上一版写 45，本版已复测纠正** |
| V16 | MCP 共 6 个工具，随 mode 变化（local 有 `publish_files`，remote 有 `create_entry`） | `tools/index.ts:24-31` |
| V17 | `express-rate-limit` 不是 MCP 的直接依赖 | `package.json` dependencies 无此项；仅在 SDK 嵌套树内 |
| V18 | SDK 的 `mcpAuthRouter` 对裸 PRM 路径不注册 | 实测：`/.well-known/oauth-protected-resource` → 404，`/.../mcp` → 200 |
| V19 | 生产配置 `auth.captcha_enabled: true` | 只读直查 `~/.peekview/config.yaml` |
| V20 | 双产品版本：PeekView `0.28.0` / MCP `0.12.0` | `VERSIONS.json` |
| V21 | **MCP 全部 6 个工具都透传客户端 token 调 PeekView API** | `client.ts:33-41` 统一注入 `Authorization: Bearer ${userToken}`；6 个工具均经该 client |
| V22 | 现有 `pv_` 模式本身即透传形状（只是无 aud 概念） | `server.ts:104` 只查前缀；`client.ts:39` 原样转发 |
| V22b | `get_current_user` 的 **cookie 分支无类型判别** | `auth.py:158-161` 直接 `decode_access_token(cookie_token, ...)`，不看 `typ`。OAuth token 塞进 cookie 也会静默降级为匿名 |
| V23 | MCP 有未使用的 `apiKey` 配置项 | `config/merge.ts:20,68,147` 定义并合并，但 `client.ts` 从不使用它（`server.ts:258` 用于 health 展示；`cli/config.ts:489` 与 `cli/service.ts:342` 也有读取） |
| V24 | DCR 在 2026-07-28 已 Deprecated，官方 registry 写 "new implementations SHOULD NOT adopt" | 官方 `specification/2026-07-28/deprecated.md` 直读 |
| V25 | RFC 9068 要求 `typ: at+jwt` 且 RS MUST 校验 | RFC 9068 §2.1 / §4 原文 |
| V26 | Google 允许 Play Console 手填 client id/secret 作为 DCR 替代 | developers.google.com/connected-apps/mcp/oauth 原文 |
| V27 | 认证测试 **92 个**全绿；MCP 测试 **30 个**全绿 | `pytest tests/test_auth.py tests/test_apikey.py tests/test_auth_me.py` → 92 passed；`vitest run tests/server.test.ts` → 30 passed。⚠️ 全量套件在本机沙箱下会有 1 条与代码无关的失败（`test_config_set_remote_api_key` 因 `~/.peekview/config.yaml` 只读），P5 记录基线时需注明 |

---

## 十一、端到端验收场景

### 11.1 安全验收（每条必须实跑）

| # | 场景 | 预期结果 |
|---|---|---|
| **E0** | **正向全链路**：PKCE 授权 → 换 token → 调 `/mcp` 的 `tools/list` 与一个读工具 → 返回正确数据 | **成功**。这是唯一验证"整条链路能用"的用例，缺它则其余 32 条用例全绿也说明不了系统可用 |
| E1 | 客户端拿 `aud=<mcp>` 的 token **直接**调 PeekView API | **拒绝** 401（`aud` 不匹配） |
| E1b | MCP 把客户端 token **原样透传**给 PeekView API（passthrough） | **拒绝** 401（同时违反 aud + 透传禁令） |
| E1c | MCP 用 token exchange 换来的 `aud=<peekview>/api` **下游 token** 调 PeekView API | **允许**（唯一合法路径） |
| E1d | 用 `aud=<mcp>` 的 token 请求 token exchange 换到**更宽 scope** | **拒绝**（不得升级权限） |
| E1e | 用 `aud=<peekview>/api` 的 token 请求 token exchange 换 `aud=<mcp>` | **拒绝**（来源 aud 必须匹配） |
| E1f | **不带 MCP 服务凭据**、只用客户端持有的 `aud=<mcp>` token 请求 exchange（模拟攻击者拿到客户端 token） | **拒绝** `invalid_client`（见 6.5；这是防"绕过 MCP 直连 API"的关键用例） |
| E1g | 用 MCP 服务凭据调用**业务 API**（而非 exchange 端点） | **拒绝**（服务凭据只能换 token，不能调业务） |
| E2 | PeekView API 签发的 token 调 MCP | **拒绝** 401（`aud` 不匹配） |
| E2b | 授权请求同时提交两个 `resource` | **拒绝**（`invalid_target`），不得签发多 audience token |
| E2c | token 的 `aud` 为数组（含当前 RS） | **拒绝**（fail-closed，见 3.2.1） |
| E2d | token 无 `aud` | **拒绝** |
| E2e | 把 OAuth token 塞进 `peekview_token` **cookie** | **拒绝并明确报错**，不得静默降级为匿名（`auth.py:158-161` 的 cookie 分支当前无类型判别，是 7.4 漏掉的入口） |
| E3 | `docs:read` token 调用写工具（`create_entry`/`publish_files`/`delete_entry`） | **拒绝**，且工具列表本就不应出现写工具 |
| E4 | `docs:write` token 调用读工具 | **允许**（按继承规则） |
| E5 | 非法 `redirect_uri`（未注册 / 非 loopback 差一字符） | **拒绝**，不重定向 |
| E6 | 错误 PKCE `code_verifier` | **拒绝**（`invalid_grant`） |
| E7 | 同一授权码重复兑换 | 第二次**拒绝** |
| E8 | 篡改 token 的 `aud` | **拒绝** |
| E9 | 使用过期 token | **拒绝** 401 |
| E10 | 使用错误 `issuer` 的 token | **拒绝** |
| E11 | 使用不允许的签名算法（`none` / `HS256` 冒充 RS256） | **拒绝** |
| E12 | 调用未在映射表声明授权的 API（如 `/api/v1/admin/stats`、`/api/v1/apikeys`） | **拒绝** |
| E13 | 未声明 scope 的场景（token 无 scope 调任何业务 API） | **拒绝** |
| E14 | 用 OAuth token 创建 `pv_` API key（提权尝试） | **拒绝**（`/apikeys` 不在映射表） |
| E15 | 用 OAuth token 访问 admin 端点 | **拒绝**（即使该用户是 admin） |
| E16 | 私有 entry 用 `docs:read` token 读取（非 owner） | **404**（保持防枚举，非 403） |
| E17 | 授权被用户拒绝 | **不签发 token**，重定向带 `error=access_denied` |
| E18 | 授权请求的 `resource` 与兑换时不一致 | **拒绝**（`invalid_target`） |
| E19 | 用户未同意请求的 scope | **不得签发超出同意范围**的权限 |
| E20 | 用户已登录但未做过授权同意 | **仍须展示同意页**，不得直接发码 |
| E21 | 缺少 `code_challenge` 或使用 `plain` | **拒绝**（`invalid_request`） |
| E22 | DCR 端点超过限流阈值 | **429** |
| E23 | CIMD 提交 `http://` 或内网 IP 的 `client_id` | **拒绝**（SSRF 防护） |
| E24 | 已注册为公共客户端（`token_endpoint_auth_method=none`）的 client 在 token 请求中携带 secret | **忽略该 secret 并正常签发**（符合 RFC 9700：公共客户端无 secret 可用）；同时断言该 secret 不会因被"校验通过"而赋予任何额外权限 |

### 11.2 向后兼容验收（`pv_` 必须不受影响）

| # | 场景 | 预期结果 |
|---|---|---|
| E25a | `pv_` key 以 `Authorization: Bearer pv_...` 调用 | 行为不变 |
| E25b | `pv_` key 以 `X-API-Key: pv_...` 调用 | 行为不变（`auth.py:148,181` 两个载体都要测） |
| E25c | 全局 master key 的**裸 `Authorization`**（非 Bearer、非 JWT、非 `pv_`） | 行为不变（`_shared.py:111-118` 单独分支） |
| E25d | `/{slug}/raw` 短链 302 + `Accept` 协商（`_prefers_json`） | 行为不变（改造 `get_current_user` 后这条链路最易被打断） |
| E25e | HTML render + share cookie 回落路径 | 行为不变 |
| E25f | MCP `local` 模式的 `publish_files` 全链 | 行为不变 |
| E26 | 现有 92 个后端认证测试 | **全绿**，无一条修改（新增用例另计） |
| E27 | 现有 30 个 MCP 测试 | 按新语义调整后**全绿**；不允许删除用例来"通过" |
| E28 | JWT 会话（cookie）登录 | **行为不变** |
| E29 | 全局 master API key（`server.api_key`） | **行为不变** |
| E30 | 匿名访问公开 entry | **行为不变** |

⚠️ **E27 的具体处理**：`server.test.ts:103-121` 断言"拒绝 JWT 形状 token 且错误信息含 `pv_`"。双模式后，JWT 形状 token **可以是合法的 OAuth token**。该用例必须改写为"拒绝*无效的* JWT 形状 token"，但**不得删除**"拒绝随机字符串"和"拒绝无效 `pv_` key"两条。P1 给出改写的精确措辞。

### 11.3 真实客户端兼容性验证计划（与协议正确性分开）

**必须严格区分两类结论**：

| 层次 | 手段 | 能得出的结论 | 不能得出的结论 |
|---|---|---|---|
| **协议正确性** | 自建模拟客户端（PKCE 全流程脚本） | 我们的实现符合规范 | ❌ 不能宣称"支持 Claude" |
| **真实平台兼容** | 在各平台实际接入 | 该平台可用 | 仅对该平台该版本成立 |

**真实平台验证计划**（P6 阶段，逐家记录）：

| 平台 | 前置条件 | 关键验证点 | 状态 |
|---|---|---|---|
| Claude.ai / Desktop | 需公网 HTTPS 入口 | CIMD 是否被选用（依赖 metadata 同时 advertise `"none"`）；`authorization_servers` 只用第一条；401 必须带 `WWW-Authenticate` | 未验证 |
| ChatGPT | 需 developer mode + 付费档 | CIMD 优先；`resource` 是否同时在授权与 token 请求中；RFC 9207 `iss` 是否满足 | 未验证 |
| Gemini Connected Apps | 需 Play Console 注册 + 公网入口 | 必须有 `registration_endpoint`（DCR 实质强制）；6 条通配 redirect URI | 未验证 |

**硬性要求**：模拟客户端通过**不得**用于宣称真实平台兼容。真实平台结论必须标注"在某平台某日实测"。

---

## 十二、任务范围

### 12.1 纳入

| 项 | 内容 |
|---|---|
| A. PeekView AS | `/oauth/authorize`、`/oauth/token`（含 token exchange grant）、DCR 端点、CIMD 支持、`/.well-known/oauth-authorization-server`、**`/.well-known/jwks.json`**；PKCE S256；`iss` 参数 |
| B. PeekView API RS | `get_current_user` 支持 OAuth token（按 `typ` 与 JWT/`pv_` 区分）；按 `aud` 校验；按 scope 拒绝越权 API |
| C. peekview-mcp RS | PRM 元数据；401 带 `WWW-Authenticate`；校验 `aud` 与 `typ`；按 scope 裁剪 `ListTools` 与 `CallTool` |
| C2. **下游凭证分离** | MCP 不再透传客户端 token；改为向 AS 换取 `aud=<peekview>/api` 的下游 token（RFC 8693 或 P1 裁决的等价方案）+ 缓存策略 |
| D. Resource Identifier | 两个 RS 的 canonical URI 定义与配置项（含 MCP 缺失的自身地址配置） |
| E. 授权页 | 独立路由；未登录可登录（captcha 生效）、已登录同意；展示 client + resource + scope |
| F. 持久化 | client 记录（CIMD 缓存 / DCR 注册 / 预注册）、授权码短命存储 |
| F2. **签名密钥与 JWKS**（对应 D4） | RS256 密钥对生成/加载、RFC 7638 指纹生成 `kid`、`/.well-known/jwks.json` 发布、多公钥并存与轮换宽限期 |
| G. 兼容 | `pv_` 路径行为完全不变；现有测试全绿（MCP 契约按新语义改写而非删除） |
| I. **Scope 体系** | 分类（`docs:read`/`docs:write`）+ 继承规则 + 白名单执行（RS 侧两级校验：ListTools 过滤 + CallTool 二次校验） |
| J. **Token 生命周期** | TTL 12h + client `disabled` 开关 + 账号禁用即时生效 + 启动清理过期授权码 |
| K. 验证 | 正向 E2E（E0）+ 安全场景（含 E1/E1b–E1g 的透传与交换矩阵）+ 兼容场景逐条实跑 |

### 12.2 不纳入

| 项 | 理由 |
|---|---|
| refresh_token | 见 9.1；涉及轮换与重放检测，独立安全议题；且 Gemini 要求「不轮换」与 MCP 对公共客户端要求「MUST 轮换」存在真实冲突（见 9.1） |
| 授权撤销管理页（"已授权应用"） | 需新表 + 新 UI + 新 API，独立子系统。v1 靠有限 TTL（12h）+ 账号禁用 + client `disabled` 兜底 |
| 生产反向代理 / 公网域名配置 | **部署交付要求，不是开发前置**（见第十四节） |
| DSH 的 3 个 MCP 配置迁移 | 本机静态 key 继续可用，无收益。且 DSH 直连 `mcp-client` row 无法自行发起授权（需 `mcp-manager`），属另一件事 |
| 浏览器插件 / 移动 App / VS Code 插件开发 | 与 v1 无耦合，只是未来复用方 |
| 全站用户身份体系重构 | 用户指令明确排除 |
| 全站 RBAC 权限系统重构 | 用户指令明确排除 |
| scope 落库（写进 DB 表） | 不为 scope 单独建表：`ApiKey` 无 scope 字段，加字段即 schema 迁移 + 权限模型改造，超出本任务。scope 只存在于 token claim 中，由两个 RS 各自读取执行。**若将来要支持"查看并修改已授权 scope"，必须落库——那是撤销管理页任务的一部分** |
| `docs:star` / `docs:share` 等扩展 scope | 无 MCP 工具对应，v1 无需求 |
| **`pv_` 透传的改造** | 见 6.6。`pv_` 模式确实符合规范对 passthrough 的定义，但改造=破坏性变更，用户已明确不强制迁移。**登记为技术债**：`pv_` 模式在 MCP 侧不做 aud 校验就转发客户端凭证 |

---

## 十三、P1 必须收敛的架构决策

每项给出：当前事实 / 可选方案 / 利弊 / 推荐 / 依据 / 缺失证据 / 验收要求。

### D1. Resource Identifier 与 Audience 设计

**本决策含两部分，性质不同，必须分开看**：

**D1-a：per-RS audience（不可讨论，规范强制）**

- **依据**：MCP 规范 RS 侧 MUST「only accept tokens that are valid for use with their own resources」+ RFC 9068 §5 MUST「AS MUST use a distinct identifier as an `aud` claim value to uniquely identify access tokens issued by the same issuer for distinct resources」。
- **结论**：两个 RS 的 token 必须有不同的 `aud`。若共享 audience，任一 RS 都无法完成 MUST 校验。
- **验收**：E1 / E2 / E2b / E2c / E2d / E8 / E18。

**D1-b：具体的 URI 形态（真正的实现选择，P1 定）**

- **当前事实**：两个 RS 均无 resource 概念（G10/V13）。MCP 无自身公网地址配置项。
- **可选方案**：
  - **a) `{peekview}/api` + `{mcp}/mcp`**（P0 倾向）：用 path 圈定资源范围，`/api` 明确区分 API 与 SPA
  - b) `{peekview}` 根 + `{mcp}` 根：更短，但 PeekView 根路径同时是 SPA 宿主，语义模糊
  - c) 部署级单一 URI + scope 区分资源：**违反 D1-a，否决**
- **利弊**：a 语义清晰，代价是 MCP 需新增配置项；b 无需新增 API 侧配置但 PeekView 的 resource 与"网站地址"混同。
- **缺失证据**：MCP 新配置项命名（`server.public_url`？`server.resource`？）；生产实际 MCP 入口地址（部署侧）。
- **验收**：PRM 的 `resource` 字段与 token 的 `aud` 一致。

### D2. API / MCP Scope 与操作映射

- **当前事实**：无 scope 概念（G6）。API **52 条**路由、MCP 6 个工具已清点（V15/V16）。
- **可选方案**：a) 两级 `docs:read` / `docs:write`（推荐）；b) 更细粒度（`docs:read` + `docs:create` + `docs:delete` + ...）
- **利弊**：b 更符合最小权限但授权页复杂度上升，且三平台对多 scope 的处理不一；a 覆盖 MCP 全部 6 个工具的实际需求。
- **推荐**：a，且**映射表采用"白名单"语义**（不在表内即不开放）。
- **依据**：用户指令要求"没有明确纳入映射的不得默认获得访问权限"。
- **缺失证据**：`docs:star` 等是否真的无需求，需 P1 与用户确认。
- **验收**：E3 / E4 / E12 / E13 / E14 / E15。

### D3. OAuth Client 注册策略

- **当前事实**：DCR 在 2026-07-28 已 Deprecated（官方 registry 写明 new implementations "SHOULD NOT adopt"）；Gemini 要自动接入需 `registration_endpoint`，但官方也允许 Play Console 手填 client id/secret 作为替代（5.3）。
- **可选方案**：
  - **a) CIMD + DCR + 预注册**（P0 推荐）：覆盖全部三种平台路径
  - b) CIMD + 预注册（不做 DCR）：Gemini 走人工配置
  - c) 仅 DCR：逆规范，且 Claude 警告 client 堆积。**否决**
- **利弊**：a 多一个端点 + 一张表 + 限流，换来三平台都能零手工接入；b 少一块 deprecated 代码，代价是 Gemini 需人工在 Play Console 填 client id/secret，且自动发现失效。
- **推荐**：a，但在文档中把 DCR 明确标注为「为兼容 Gemini 自动接入而保留的 deprecated 能力」，**不得写成推荐路径**。
- **依据**：规范等级（CIMD SHOULD / DCR MAY + Deprecated + SHOULD NOT adopt）+ 三平台官方文档原文。
- **缺失证据**：
  - Gemini 的 Play Console 手填路径是否与 DCR 完全等价（官方只说"或"，未给出功能差异）
  - 若选 b，Gemini 的自动发现是否真的可以只靠手填完成（未实测）
- **验收**：E22 / E23 + 三平台真实接入。**P1 若选 b，需明确接受「Gemini 不能零手工接入」这一后果。**

### D4. Token 签发与验证方案

- **当前事实**：现有 HS256 与会话 JWT 共用密钥（V1/V2）。`python-jose` 支持 RS256+JWKS（V8）。
- **可选方案**：A HS256 内部验证 / **B RS256+JWKS（推荐）** / C 不透明+Introspection
- **利弊**：见 7.1 表。
- **推荐**：B，并**采用 RFC 9068 profile**（`typ: at+jwt` + 标准 claims），不自创 claim 方案。
- **依据**：密钥分离、`aud` 标准校验、多 RS 扩展性；规范对格式本身无强制（B 属实现选择），但**一旦选 JWT，RFC 9068 的 typ/claims 要求就是适用的**——这两层要分清。
- **缺失证据**：JWKS 端点是否需要缓存头与轮换策略，P2 定；`kid` 轮换时旧 token 的宽限期未定。
- **验收**：E1 / E8 / E9 / E10 / E11。

### D5. Authorization Code 与持久化方案

- **当前事实**：无 OAuth 表（V10）。新表由 `create_all` 自动建（V9）。
- **可选方案**：a) 全部落 SQLite；b) 授权码内存 + client 落库；c) 全部内存
- **利弊**：b 在多进程/重启时丢码，用户体验差；c 完全不可用；a 需清理任务。
- **推荐**：a（SQLite），授权码表带 `expires_at`，启动时清理过期行。
- **依据**：项目已有迁移机制与定时清理先例（`apikey_service.cleanup_expired_keys`）。
- **缺失证据**：清理频率与是否复用现有 CLI 命令，P2 定。
- **验收**：E7 / E18 + 重启后码仍可兑换（或明确失效策略）。

### D6. 授权页与现有登录态的关系

- **当前事实**：`/login` 是死路由（G8/V11）；登录是弹窗；captcha 在生产启用（V19）。
- **可选方案**：a) 新建 `/oauth/authorize` 前端路由 + 内嵌登录组件（推荐）；b) 后端直接渲染 HTML 授权页；c) 复用首页 + 弹窗
- **利弊**：b 需维护两套样式且与 SPA 割裂；c 无法承载"同意"语义；a 与现有前端体系一致。
- **推荐**：a。
- **依据**：登录态同 origin 才能复用 Cookie（1.2）。
- **缺失证据**：`LoginDialog.vue` 的复用方式（直接嵌入 vs 抽表单逻辑），P2 定。
- **验收**：E20 + Playwright 覆盖"未登录→登录→同意"与"已登录→同意"两条路径。

### D7. OAuth Endpoint 命名空间

- **当前事实**：已有 `POST /api/v1/auth/register`（用户注册，`api/auth.py:42`）。根路径 `/register` 空闲。
- **可选方案**：a) `/oauth/authorize` + `/oauth/token` + `/oauth/register`（推荐）；b) 根路径 `/authorize` + `/token` + `/register`
- **利弊**：b 与用户注册语义撞车；a 清晰但需要 RFC 8414 元数据里写绝对路径（合规，规范允许）。
- **推荐**：a。
- **依据**：避免语义混淆；RFC 8414 的 endpoint 字段填绝对 URL，不影响标准合规。
- **缺失证据**：无。
- **验收**：metadata 中三个 endpoint 均可访问。

### D8. Token 生命周期及撤销策略

- **当前事实**：登录 JWT 是 7 天（V1）。无撤销机制。
- **可选方案**：a) **TTL 12h**（见 9.2，P0 推荐）+ client `disabled` 开关 + 账号禁用即时生效；b) TTL 1h + 实现 refresh token（需先解决 9.1.1 的规范冲突）；c) TTL 24h（泄露窗口过大）
- **利弊**：b 泄露窗口最小（1 小时）但需实现 refresh，且要先解决 9.1.1 的规范冲突（Gemini 不轮换 vs MCP 要求轮换）；c 泄露窗口最大（24 小时）且无可用性收益。
- **推荐**：a，并**显式记录"有效期内无法撤销"这一代价**。
- **依据**：`user.is_active` 已在每请求校验（`auth.py:175-178`）。
- **缺失证据**：12h 对真实使用频率是否合适（需真实平台实测后调）；若需更长应引入 refresh 而非继续拉长 TTL。
- **验收**：E9 + 账号禁用后旧 token 立即失效。

### D9. 双模式认证兼容策略

- **当前事实**：`get_current_user` 用"3 段"启发式判 JWT（6.3）；MCP 用 `pv_` 前缀判定（G1）。
- **可选方案**：a) 前缀区分（`pv_` vs JWT 形状）+ claim 类型标识（推荐）；b) 全部走 introspection
- **利弊**：a 无额外 RTT 但需严格的类型判断与拒绝语义；b 每请求 +1 RTT。
- **推荐**：a，且**类型判断失败必须明确拒绝**，不得静默降级为匿名。
- **依据**：6.3 的静默失败风险。
- **缺失证据**：`server.test.ts` 契约改写的精确措辞，P1 定。
- **验收**：E25 / E26 / E27 + 无效 token 必须报错而非静默匿名。

### D10. 真实客户端兼容性目标与测试边界

- **当前事实**：三平台要求已查清（官方文档），但均未实测（5.3）。
- **可选方案**：a) v1 只保证协议正确，真实平台列后续（推荐）；b) v1 必须通过至少一家真实平台
- **利弊**：b 需要公网入口（部署侧），会把开发任务卡在部署上。
- **推荐**：a，但**明确记录**"协议正确 ≠ 平台兼容"。
- **依据**：用户指令"不能用模拟客户端通过来宣称真实平台已经兼容"。
- **缺失证据**：公网入口何时可用（部署侧）。
- **验收**：模拟客户端全流程通过 + 真实平台验证计划成文（不要求 v1 内完成）。

### D11. 下游凭证分离方案（Token Passthrough 禁令的落地）**——本任务最关键的新增决策**

- **当前事实**：MCP 的 6 个工具全部经 `client.ts` 透传客户端 token 调 PeekView API（6.2）。现有 `pv_` 模式本来就是这个形状，只是没有 aud 概念所以未被察觉。规范明令 OAuth 路径 **MUST NOT** 透传。
- **可选方案**：
  - **T1 RFC 8693 Token Exchange**（P0 倾向）：MCP 用 `aud=<mcp>` 的 token 向 AS 换 `aud=<peekview>/api` 的下游 token
  - T2 服务凭据 + 用户断言 header：MCP 用自身凭据调 API，用户身份放 header
  - T3 直连数据库：**否决**（破坏分层、权限逻辑双写必漂移）
- **利弊**：T1 满足"separate token issued by upstream AS"的原文要求，保留用户身份与审计链，代价是 AS 多一个端点 + 缓存设计；T2 无额外 RTT 但把密码学绑定降级为 header 信任。
- **推荐**：T1。
- **依据**：规范原文 "The access token used at the upstream API is a **separate token**, issued by the upstream authorization server. The MCP server **MUST NOT** pass through the token it received from the MCP client."
- **缺失证据**：
  - **交换端点如何认证调用方**（见 6.5，E1/E2/E3 三选一）——这是 D11 能否成立的前提
  - token exchange 端点放 `/oauth/token`（标准 grant_type）还是独立端点
  - 缓存粒度与失效策略（按 sub+scope？随源 token 过期？）
  - 交换后 scope 是否必须取交集（P0 认为必须，否则成为提权入口）
- **验收**：E1b / E1c / E1d / E1e / E1f / E1g。

**哪些不是自由分叉**：

| 决策 | 为何不是分叉 | 依据等级 |
|---|---|---|
| D1 的 per-RS audience | RS 侧 MUST「只接受为自己签发的 token」的必然推论；RFC 9068 §5 另有 MUST「用互不相同的 aud 区分不同资源」 | 规范 MUST（两处） |
| D2 的"白名单语义" | 用户指令明确要求；且 MCP Security Best Practices 把"在 token 里声称有 scope 却不做服务端授权判断"列为常见错误 | 用户要求 + 规范指引 |
| **「token 必须能与登录 JWT 区分」这一约束**（注意：不是"必须选 RS256"） | RFC 9068 §4 的 `typ` MUST 校验 + 跨 JWT 混淆防线（RFC 8725 §2.8） | 规范 MUST |
| **D11 的不透传** | 规范原文两处 MUST NOT | 规范 MUST |
| D9 的"不得静默降级" | 正确性必需：静默当匿名会把"授权失败"伪装成"没权限看到内容"，掩盖真实故障 | 工程判断 |
| 8.2 的 `typ`/claims/算法白名单 | RFC 9068 的 REQUIRED 条款 | 规范 MUST |

这些不应在 P1 被当作可选项重新讨论。**其余项（D3 / D5 / D6 / D7 / D8 / D10）才是真正的实现选择。**

---

## 十四、部署侧要求（非本任务交付物）

**公网可达性属部署交付要求，不是开发前置条件。** 开发、测试、验证全部在隔离的本地环境完成（回环地址），不触碰生产数据、生产进程、生产部署。

以下列出部署侧需满足的条件，供运维对齐：

| 要求 | 说明 |
|---|---|
| MCP 端点公网 HTTPS 入口 | PRM 与 `/mcp` 需外部可达。AS 由 PeekView 公网入口提供 |
| `issuer` 与公网地址严格一致 | RFC 8414 要求 metadata 的 `issuer` 与构造 well-known URL 时用的标识**完全一致**，不一致则合规 client 必须拒绝 |
| 反代透传 `X-Forwarded-Proto` / `Host` | 否则 metadata 里的 endpoint 会指向内网地址 |
| `.well-known` 不被兜底 | 反代若有 catch-all rewrite，会像 G4 一样吞掉元数据路径 |
| MCP 自身公网地址进配置 | 需要 D1 的新配置项，值由部署决定 |

**验证可行性**：即使公网未打通，全部安全场景（11.1）都可在回环验证——SDK 的 issuer 校验对 `localhost`/`127.0.0.1` 豁免 HTTPS，DSH 的 mcp-client 同样允许 loopback HTTP。

---

## 十五、未验证断言

| # | 断言 | 状态 | 验证方法 |
|---|---|---|---|
| U1 | MCP 2026-07-28 是当前最新版本 | **官方 versioning 页直读**，但"是否有未发布到该页的更新 revision"未验证 | 后续复查 versioning 页 |
| U2 | CIMD 在当前版本是 SHOULD 而非 MUST | **官方原文直读**；`draft` 分支措辞相同（仅 IETF 草案引用版本号 `-00`→`-03` 差异） | draft 若提升等级需重新评估 |
| U3 | 多 RS 部署必须 per-RS audience | **本项目推理**（依据 RS 侧 MUST 的可满足性），规范无直接条文 | P1 记录推理链，不写成规范强制 |
| U4 | 规范未**强制** token 格式，但以 RFC 9068 为示例/推荐 | 原判断"无规定"**已修正**：security-considerations 明确把 RFC 9068 当作 audience claim 的例子引用（"for example, via the audience claim, as mentioned in RFC9068"），authorization 的示例 token 也是 JWT。准确表述应为"不强制格式，但 JWT/RFC 9068 是事实上的推荐路径" | 已按此修正正文 |
| U5 | Gemini 需要 `registration_endpoint` **或** Play Console 手填 | **Google 官方原文直读**（两段原文互相补充）。**已修正**：上一版写"DCR 实质强制"是过度断言——原文明确给了手填这条替代路径 | 若选不做 DCR，需实测手填路径是否真正可用 |
| U6 | 三平台对多 scope 的处理差异 | **未验证**（只知道 Claude 会 append `offline_access`） | 真实接入时逐家记录 |
| U7 | Claude 要求 metadata 同时 advertise `"none"` 才走 CIMD | **官方文档直读**，未实测 | 真实接入时验证 |
| U8 | `docs:star` 等扩展 scope 确无需求 | **未验证**（基于 MCP 无对应工具推断） | P1 与用户确认 |
| U9 | 12 小时 TTL 对真实使用频率合适 | **未验证**（无真实平台数据）。P0 的推理是"等于一个工作日"，但真实会话时长未观测 | 真实接入后调整；若需更长则引入 refresh |
| U10 | `python-jose` 的 JWKS 输出符合各 client 期望 | **部分验证**：`to_dict()` 只产出 `["alg","e","kty","n"]`（见 V8），`kid`/`use` 需手工注入；注入后未与真实 client 互操作 | 真实接入时验证 |
| U11 | 现有 `pv_` 路径在改造后完全不受影响 | **未验证**（只读了代码路径，未构造双模式并存测试） | E25 / E26 红灯先行 |
| U12 | `server.test.ts:103-121` 的改写方案可行 | **未定** | P1 给出精确措辞 + P3 红灯 |
| U13 | `python-jose` 的 `access_token` 参数不校验 `typ` | **已实测**：`jwt.decode(..., access_token=True)` 对无 `typ` 的 token 仍通过——该参数是 `at_hash` 校验用的 | 已确认，故 RS 侧必须手动校验 `typ` |
| U14 | RS256 + RFC 9068 全套 claims 能在 `python-jose` 下走通 | **已实测**：`iss/aud/sub/client_id/iat/exp/jti/scope` 全部能编解码，`typ: at+jwt` 可读 | 已确认；跨语言（Node 侧验签）未互通测试 |
| U15 | token exchange（RFC 8693）在 `python-jose` 下可实现 | **未验证**（只确认了签名能力，未设计交换端点） | P2 设计后验证 |
| U16 | Gemini 的 Persistent Linking「不轮换 refresh」与 MCP「公共客户端 MUST 轮换」是真冲突 | **双方原文直读**，冲突成立；但"Gemini 是公共客户端"这一前提未逐一核实（它可能走 confidential client 分支） | P1 或真实接入时确认 |
| U17 | `docs:write ⇒ docs:read` 的层级设计符合规范 | **规范只要求 RS「必须处理层级」（MUST）**，未规定层级内容；具体设计是我们的选择 | 已如实标注；P1 确认即可 |

---

## 十六、环境与验证策略

| 层次 | 手段 |
|---|---|
| 后端单元/集成 | `make test-quick`（pytest，venv）。**认证相关基线 92 个**；全量基线以实际运行为准（Makefile 里打印的 1068 是陈旧值，实测收集数更多）。⚠️ 沙箱下 `test_config_set_remote_api_key` 会因 `~/.peekview/config.yaml` 只读而失败，属环境问题 |
| MCP 单元 | `make test-mcp-unit`（vitest；基线 30 个，`server.test.ts`） |
| 调试服务 | `make debug`（`127.0.0.1:8888`，数据隔离 `/tmp/peekview-debug/`） |
| MCP 集成 | 独立端口起 MCP，指向 debug backend，**绝不指向生产 `:13001`** |
| AS 元数据 | `curl` 断言 JSON 字段，不用浏览器 |
| 授权码全流程 | 脚本模拟客户端（生成 PKCE verifier/challenge → 取 code → 换 token → 调 `/mcp`） |
| 授权页 UI | Playwright 实跑 + 截图，覆盖"未登录→登录→同意"与"已登录→同意" |
| 隔离 | 生产 `:13001`、`~/.peekview/`、pipx 全程不触碰；pytest 的 `isolate_config_file` autouse 生效 |

---

## 十七、交付倾向

- **risk = high**：首次对外签发第三方可持有凭证 + 双产品 + 安全边界 + **下游凭证分离改变 MCP 的调用拓扑**。
- **P2 不可简化**：需 `plan-eng-review`（backend 域强制）+ **安全专章**，六项各自成节：
  ①密钥管理与 JWKS 轮换（含 `kid` 指纹方案）②`aud`/`iss`/`typ`/算法白名单 ③scope 执行与继承
  ④CIMD 的 SSRF 防护 ⑤DCR 限流与 client 生命周期 ⑥**下游 token exchange 的缓存与提权防护**
- **P3 强制 TDD 红灯**，最少六组：
  ①双模式并存（`pv_` / OAuth / 会话 JWT 三者互不串，含 cookie 入口）②PKCE 与授权码一次性
  ③`aud` 交叉拒绝（E1/E2/E2b/E2c/E2d）④scope 拒绝与继承（E3/E4）
  ⑤**透传禁令与下游交换**（E1b/E1c/E1d/E1e）⑥**正向全链路**（E0，先有能用再谈拒绝）
- **P6 不可裁**：安全场景（含 E0 正向 + E1 系列透传矩阵）+ 兼容场景（E25a–f 六面）逐条实跑；授权页 Playwright 截图；judge 独立。
- **P8 双产品 bump**：PeekView `0.28.0` → `0.29.0`（minor，新增能力）；MCP `0.12.0` → `0.13.0`（minor）。发布前需用户确认。

---

## 十八、下一步

等用户「开工」进 P1。P1 需收敛第十三节列出的 **D1–D11 十一项**决策，其中：

| 类别 | 决策 | 说明 |
|---|---|---|
| **规范强制，不是分叉** | D1-a per-RS audience、D11 不透传、`typ`/claims/算法白名单、D2 白名单语义 | 详见十三节末表；P1 只需确认理解正确，不需重新论证 |
| **真正的实现选择** | **D1-b URI 形态**、**D4 签名方案本身**（RS256/JWKS vs HS256+独立密钥 vs opaque） | **审查指出上一版把 D4 错误列入"非分叉"。"必须可区分"是约束，但"必须用 RS256"是实现偏好**——HS256+独立密钥同样满足可区分性，且撤销能力相当、实现更简单。§7.1 表显示 B 在复杂度与撤销两项劣于 A/C，这个成本需 P1 明确接受 |
| D3 注册方式组合、D5 存储选型、D6 授权页形态、D7 端点命名、D8 TTL | 各有 2–3 个合理选项 |
| **需要用户/部署输入** | D10 真实平台验证的时间与入口、D1 的 MCP 公网地址、D3 是否接受 Gemini 人工配置 | 超出开发侧可决定范围 |

**P1 另需产出**：

1. `server.test.ts` 认证契约的**精确改写措辞**（U12）——不允许删用例凑绿
2. `docs:star` 等 scope 取舍的确认（U8）
3. **D11 的验收矩阵**：E1b（透传被拒）/ E1c（交换后可用）/ E1d（不得升级 scope）/ E1e（来源 aud 必须匹配）/ **E1f（无服务凭据的 exchange 被拒）** / **E1g（服务凭据不能调业务）** 六条必须能被 P3 写成红灯

**P1 必答的三个规范张力**（不是能绕过的，是要明确取舍的）：

| 张力 | 一侧 | 另一侧 |
|---|---|---|
| DCR | MCP 规范 Deprecated + "SHOULD NOT adopt" | Gemini 自动接入需要 `registration_endpoint` |
| refresh_token | MCP 要求公共客户端 MUST 轮换 | Google 要求 Persistent Linking 不得轮换（见 9.1.1） |
| `pv_` 透传 | OAuth 路径 MUST NOT 透传 | `pv_` 路径现状就是透传（v1 保持不动，如实标注为 legacy） |
