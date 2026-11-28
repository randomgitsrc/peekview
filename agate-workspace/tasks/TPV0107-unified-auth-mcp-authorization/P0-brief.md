---
phase: P0
task_id: TPV0107
task_name: unified-auth-mcp-authorization
trace_id: TPV0107
created: 2026-11-29
status: pending-start
parent: 无
supersedes: TPV0105（已作废，不继承其架构）
---

# P0-brief — TPV0107 Peekview 统一访问认证与 MCP 授权体系建设

> 主 Agent 亲自填写（P0 产出）。本文件自包含，不引用外部链接。
>
> **风险等级：high。** 这是认证与授权域的系统性建设，涉及凭证签发、权限判定、撤销语义。判错后果是越权访问，不是界面异常。

```yaml
task: "在 Peekview 现有产品内建立统一、清晰、安全、适合自部署形态的访问认证与授权体系，并让 OAuth 作为可选能力接入"
known_risks:
  - "同类/影响面预判：pv_ 全权语义不止一处消费——`auth.py:181-189` 产出 User 后被 require_auth（require_admin 引用 10 处）+ 各 service 的 is_admin 分支共同消费；改权限模型必须同批处理这整条链，只改 verify_api_key 无效"
  - "同类/影响面预判：凭证类型判别分散在三处且互不知情——`_looks_like_jwt`（api/_shared.py:85，只判 3 段）、`pv_` 前缀（auth.py:182）、`_is_global_api_key_auth`（api/_shared.py:90）；新增第四类凭证时三处都要动，漏一处即类型混淆"
  - "同类/影响面预判：`.well-known` 类路径当前无任何注册（backend/peekview 全量 grep 零命中），新增时须同时处理路由顺序（排在 main.py:598 catch-all 之前）+ `_is_frontend_route`/`_prefers_json` 的 content-negotiation 分支，否则会按 Accept 头分裂出两种错误响应"
  - "凭证混用：JWT / API Key / OAuth Token 若共用验证路径，任一处判别错误即越权"
  - "撤销语义：无状态 Token 无法即时作废，但用户撤销授权必须真正生效——矛盾需可验证解法，不接受'改标记即失效'"
  - "为修静默降级而破坏匿名访问与防枚举（私有资源对非 owner 返 404 是有意设计，见 entry_service.py 注释 N8）"
  - "范围膨胀：认证域极易滑向完整 IAM；须严守非目标清单"
  - "旧方案惯性：TPV0105 的架构假设容易被无意识继承（见第十一节）"
  - "双产品协同：Python 后端与 Node MCP Server 若各写一套权限判定，必然漂移"
env_constraints:
  debug_env: "make debug（127.0.0.1:8888，数据隔离 /tmp/peekview-debug/）；后端测试 make test-quick"
  production: "生产 :8080/:13001、~/.peekview/、pipx 全在域外，本任务不得触碰"
executor_env:
  platform: "DSH"
  has_task_tool: true
  has_local_runtime: true
  network: "本机回环可完成开发与验证；公网 HTTPS 属部署侧事项，非开发前置"
```

---

## 一、任务定义

### 1.1 一句话目标

在 Peekview 现有产品内，建立一套**统一、清晰、安全**的访问认证与授权体系：让用户身份、各类凭证、第三方应用授权、资源权限判定之间的关系有明确定义，并让 OAuth 作为**可选能力**接入，不破坏现有部署。

### 1.2 性质

这是**一个 Agateon Task**，在现有 Peekview 项目中立项。不是新项目 / 新产品 / 新仓库；不是 Agateon 自身改造；不是研究报告。

本次交付**仅立项**：目标、边界、完成条件、阶段、依赖、风险、待决策清单。**不实施任何开发**。

### 1.3 核心命题

关键不是"把不同 Token 统一成一种格式"，而是**建立正确的身份与权限关系**。后续设计必须区分四个层次：

| 层次 | 回答的问题 | 现有对应物 |
|---|---|---|
| **L1 身份认证** | 当前请求是谁发起的？身份可信吗？ | `get_current_user`（auth.py:138-188）——只覆盖其中一部分 |
| **L2 凭证与授权关系** | 这个凭证谁签发？代表谁？授权范围？ | **基本缺失**。`pv_` key 无 scope（models.py:267-292），无 OAuth grant |
| **L3 用户实际资源权限** | 这个用户在 Peekview 本身能做什么？ | `is_admin` / `is_active`（models.py:136-137）、owner、team |
| **L4 资源访问决策** | 这个凭证能否以这个身份访问这个资源？ | `can_read_entry`（entry_service.py:89-104）+ 散落各 service 的判断 |

现状是 L1 部分实现、L2 空白、L3 存在、L4 分散且只看 L3。**这个断层是本任务要解决的根本问题。**

---

## 二、背景与目标

Peekview 已具备四类访问能力：用户名密码登录（JWT + httpOnly Cookie）、用户级 API Key（`pv_` 前缀）、后端 REST API（实测 58 个 path+method 操作）、MCP Server（Node，Streamable HTTP）。这些能力**各自能工作**，但彼此的身份与授权关系从未被统一定义。

具体表现（第三节实测）：

- 三类凭证在同一个函数里按"形状"分流（几段点、什么前缀），**无类型标识**
- `pv_` API Key 验证后直接返回 `User`，权限与登录完全等价，**包括 admin**
- 没有任何 scope / 授权范围概念，第三方接入只能"给一把全权钥匙"
- 前端无"已授权应用"视图，用户无法查看授予了谁什么
- 代码库中 **OAuth 概念零命中**（backend / frontend-v3 / mcp-server 三处 src 全量 grep 计数 0）

**这与"要不要做 OAuth"无关**——即便不做 OAuth，上述关系也应当被定义清楚。OAuth 只是让这套关系第一次有了外部消费者，从而把问题暴露出来。

---

## 三、现状基线（本轮实测，可复核）

> 行号基于 Peekview `0.28.0`。标注「实测」者为在本轮隔离环境实跑所得；其余为代码直读。

### 3.1 三类凭证

| 凭证 | 载体 | 位置 | 权限等价性 |
|---|---|---|---|
| 会话 JWT | httpOnly Cookie `peekview_token` 或 `Authorization: Bearer eyJ...` | `auth.py:146-178` | 绑定 `User` |
| 用户 API Key | `X-API-Key: pv_...` 或 `Authorization: Bearer pv_...` | `auth.py:181-189` | **验证后返回 `User`，与登录完全等价，含 admin** |
| 全局 master key | 裸 `Authorization` / `X-API-Key`（非 JWT、非 `pv_`） | `api/_shared.py:90-118` | 无用户绑定，全局读 |

JWT 载荷只有 `sub` / `exp` / `iat`（`auth.py:110-114`），**无 `aud`、无 `iss`、无 `typ`、无 `scope`**。有效期 `token_expire_days=7`（config.py:285-288）。

### 3.2 已知缺陷（代码直读定位）

| # | 事实 | 位置 | 影响 |
|---|---|---|---|
| A1 | `decode_access_token` 只验签名与 `exp`，**无 `aud`、无 `iss`、无 `typ`** | `auth.py:121-135` | Token 无法约束"能用于哪个资源"，不能区分用途 |
| A2 | cookie 分支**无类型判别**，任意 token 塞进 `peekview_token` 都走 HS256 验证 | `auth.py:158-161` | 类型混淆；外来 token 只要同密钥即被接受 |
| A3 | 凭证验证失败一律落到 `return None` | `auth.py:188` | 调用方无法区分"没带凭证"与"凭证无效"（**实际可观测后果窄于旧记录，见 3.3**） |
| A4 | `pv_` key 无 scope，验证后等同完整 `User` | `auth.py:181-189` | 第三方接入只能给全权 |
| A5 | `ApiKey` 模型无 scope / 无用途字段 | `models.py:267-292` | 同上 |
| A6 | 无任何 OAuth 相关表（生产 DB 实查 16 张表） | `~/.peekview/peekview.db` | 无持久化基础 |
| A7 | `scope` 概念完全不存在（`auth.py` / `_shared.py` 计数均为 0） | — | 无授权范围语言 |
| A8 | HS256 密钥与会话 JWT 共用 `~/.peekview/.secret_key` | `auth.py:26-28` | 会话与第三方 Token 风险绑定 |
| A9 | `/login` 在 `FRONTEND_ROUTES` 但前端**无该路由**（router.ts 实测无 `/login`），登录实为 `LoginDialog.vue` 弹窗 | `main.py:25` vs `router.ts` | 无独立登录页，OAuth 授权确认页需新建 |
| A10 | `.well-known/*` 无任何专用路由；落 SPA catch-all，**响应随 Accept 头分裂** | `main.py:598-624` | 见 3.3，两种表现都是错的 |
| A11 | MCP Server **只有 Streamable HTTP，无 stdio 传输**（`grep StdioServerTransport` 零命中） | `server.ts:2,198` | "本机 STDIO MCP"当前**不存在** |
| A12 | MCP 把客户端 token 原样转发给后端 API | `client.ts:33-41` | 对所有下游构成 passthrough 形状（见 3.6） |
| A13 | 前端无"已授权应用"视图（SettingsView 仅 profile/security/apikeys/user-manager 四 tab） | `router.ts` + `SettingsView.vue:72` | 用户无法查看/撤销第三方授权 |

### 3.3 本轮实测的两处细节（修正旧记录的绝对化表述）

TPV0105 的记录中有两条论断过于绝对。**这不是挑旧账——基于错误表述设计会得出错误的验收判据。**

#### 修正一：`.well-known` 不是"永远 200 HTML"，而是按 Accept 头分裂成两种错误

`TestClient` 实跑（debug 隔离环境）：

| 路径 | `Accept: */*` | `Accept: application/json` |
|---|---|---|
| `/.well-known/oauth-protected-resource` | `200 text/html`（index.html） | `404 application/json`，`{"error":{"code":"NOT_FOUND","message":"Entry not found: .we..."}}` |
| `/.well-known/oauth-authorization-server` | `200 text/html` | `404` 同上 |
| `/.well-known/jwks.json` | `200 text/html` | `404` 同上 |
| `/.well-known/anything-at-all` | `200 text/html` | `404` 同上 |
| `/api/v1/definitely-not-a-route` | `404 application/json` | `404 application/json` |

机制：catch-all 在 `main.py:611` 判断 `_prefers_json(accept)` 后转 `resolve_entry_raw`，把 `.well-known/...` 当 slug 查，查不到即 404。**客户端（通常发 `Accept: application/json`）看到的是"404 且文案是 Entry not found"，浏览器看到的是"200 一坨 HTML"。** 两种都错，但现象不同——旧记录只写了后者，会让 S0 复核对不上。

#### 修正二：无效凭证在需要认证的端点上确实返 401，静默降级只发生在允许匿名访问的端点上

实测（每用例独立 client，避免 cookie 串味）：

| 端点 | 无凭证 | 有效 JWT | 过期 JWT | 错签名/错密钥 | 垃圾串 |
|---|---|---|---|---|---|
| `GET /api/v1/auth/me` | 401 | 200 | 401 | 401 | 401 |
| `GET /api/v1/apikeys` | 401 | 200 | 401 | 401 | 401 |
| `GET /api/v1/entries`（公开列表） | 200 | 200 | 200 | 200 | 200 |

私有资源（alice 的私有 entry，用无效凭证访问）：

| 凭证 | `GET /entries/{slug}` | `/download` | `/raw` |
|---|---|---|---|
| 无凭证 | 404 | 404 | 404 |
| 有效 JWT | 200 | 200 | 200 |
| 过期 JWT | 404 | 404 | 404 |
| 垃圾串 | 404 | 404 | 404 |
| 有效 `pv_` | 200 | 200 | 200 |
| 伪造 `pv_` | 404 | 404 | 404 |

**结论**：`get_current_user` 层面确实"失败即匿名"（A3 成立），但其**可观测后果小于旧记录所述**——`require_auth` 端点仍正确返 401。真正的问题是**在允许匿名访问的端点上，无效凭证与匿名完全不可区分**，故障表现为"看不到资源"而非"凭证有问题"。私有资源返 404 是**有意的防枚举设计**（`entry_service.py:89-104` 注释 N8），不能为了区分改成 403——这正是"不能为了修降级而破坏现有匿名行为"的具体约束点。

**这条修正直接决定 C8 的正确写法**：不能要求"所有端点无效凭证一律报错"（会破坏匿名与防枚举），只能要求"在需要凭证才能成功的路径上，无效凭证必须给出可区分的认证失败信号"。

### 3.4 `pv_` 全权语义的实证（本轮最重的发现）

管理员用**自己的** `pv_` Key 访问管理端点，实跑结果：

| 端点 | 结果 |
|---|---|
| `GET /api/v1/admin/stats` | `200` |
| `GET /api/v1/admin/users` | `200` |
| `DELETE /api/v1/admin/users/{id}` | **`204`——用户被实际删除** |

即：**一把为"脚本调 API"设计的 Key，等价于管理员账号密码，可执行不可逆的破坏性操作**。这把 A4/A5 从"设计瑕疵"升级为"可验证的安全事实"，是 S1 必须裁决的问题（D5）。

对照实测：用户被 `disable` 后，其 JWT 与 `pv_` 均在下次请求即 401（`verify_api_key` 检查 `user.is_active`，`apikey_service.py:198`），登录也拒绝。**"禁用用户"这条链路当前是正确的**，可作为撤销语义的参照实现。

### 3.5 权限判定的现状

- 字段级：`Entry.is_public` / `owner_id` / `team_id`（models.py），`ApiKey` **无 scope**
- 函数级：`can_read_entry(entry, user_id, is_admin, is_team_member, is_team_owner)`（`entry_service.py:89-104`）
- 依赖级：`require_auth`（401，`auth.py:191`）、`require_admin`（403，`auth.py:203`），后者被引用 10 处
- 匿名：`auth.allow_anonymous_create` 默认 `True`（config.py:293-296）

**缺口**：以上全部是"你是谁 → 能看到什么"，缺少 L2"这个凭证被授权做什么"。

### 3.6 MCP Server 现状

- 传输：仅 `StreamableHTTPServerTransport`（`server.ts:198`），**无 stdio**
- 认证：`server.ts:104` **只检查 `pv_` 前缀**，从不验证该凭证是否"签发给 MCP"；失败文案 `'Only PeekView API Key (pv_ prefix) is supported'`
- 转发：`client.ts:33-41` 把同一个串原样放进 `Authorization: Bearer`，附加 `X-PeekView-Source: mcp`
- 校验：`client.ts:131-151` `validateToken` 走 `GET /api/v1/auth/me` 反查
- 工具：6 个（`tools/index.ts:24-31`）——`local` 模式 `publish_files` + 通用四项；`remote` 模式 `create_entry` + 通用四项
- README 明示链路：`Agent (Alice) → Bearer pv_alice → MCP Server → validate via /auth/me → PeekView`

MCP 规范（2026-07-28）明文禁止此形状，原文：**"The MCP server MUST NOT pass through the token it received from the MCP client."** `pv_` key 本来就是后端 API 的钥匙，所以长期未被察觉。它**存在与否和"做不做 OAuth"无关**，但引入 OAuth 后若不处理，新路径会复制同一形状。

### 3.7 版本与规模基线

| 项 | 值 |
|---|---|
| Peekview / MCP Server | `0.28.0` / `0.12.0`（`VERSIONS.json`） |
| API 操作数 | **58** 个 path+method（openapi 实测）：entries 16 / admin 9 / teams 8 / auth 7 / root 6 / apikeys 4 / config 3 / captcha 3 / stars 2 |
| 生产 DB 表数 | 16，无 OAuth 相关表 |
| 加密依赖 | `python-jose[cryptography]>=3.3.0`（venv 实测 jose 3.5.0），**无 authlib** |
| 前端路由 | 11 条，**无 `/login`**，`/admin` 指向 `NotFoundView` |
| 业务错误格式 | 统一 `{"error":{"code","message","details"}}`，未匹配路由为 FastAPI 原生 `{"detail":...}` |

### 3.8 S0 必须独立复核

本节实测均在**本轮**环境取得。S0 需独立重跑：A1–A13 逐条是否仍成立、3.3 两张表是否随代码变动、3.4 的 `pv_` 全权实证是否仍可复现。**P0 提供起点，不提供结论。**

---

## 四、产品原则与约束（不可擅改）

### 4.1 产品原则

| # | 原则 |
|---|---|
| P1 | 一套产品、一套代码，不建立多产品版本 |
| P2 | **API Key 保留**，不能因引入 OAuth 而废弃 |
| P3 | **OAuth 是可选能力**，不要求所有部署开启 |
| P4 | OAuth **不依赖官方中心服务**，自部署实例独立运行 |
| P5 | 不启用 OAuth 时，现有登录、API Key 原有功能**正常工作** |
| P6 | 不要求把现有用户名密码登录改造成 OAuth 登录 |
| P7 | OAuth 授权必须关联**真实 Peekview User**，不脱离现有用户权限体系 |
| P8 | 三类凭证可关联同一用户，但**不能混为一谈**（不同类型、不同语义） |
| P9 | OAuth 授权**不能扩大**用户自身已有的资源权限 |
| P10 | 用户能查看并撤销自己授予的授权 |
| P11 | 实例管理员能管理 OAuth 服务级配置 |
| P12 | **优先复用成熟实现**，不自行实现标准协议或密码学算法 |
| P13 | 不扩展成完整 IAM；不默认引入企业 SSO / MFA / 社交登录 / 身份目录 / 完整 RBAC-ABAC 平台 |

### 4.2 MCP 场景原则

必须评估四类网络部署场景：**本机回环 / 局域网 / 远程 / 第三方托管 MCP Client**。

| 约束 | 说明 |
|---|---|
| 不把部署位置等同于信任度 | "本机所以安全"不是理由 |
| **网络位置 ≠ 传输协议** | 本机/局域网/远程都是 Streamable HTTP 的部署差异，不是不同传输协议 |
| 不无理由要求所有场景用 OAuth | 按访问主体、资源服务器、网络边界、信任关系分别决定 |
| STDIO 不是默认要求 | **当前无 stdio 传输（A11）**，只有证明存在明确产品需求才纳入 |

### 4.3 权限原则

**权限判定不能只看 Token Scope。** 至少同时考虑：

1. 用户当前实际拥有的资源权限
2. 凭证或 Grant 授予的权限范围
3. 目标资源及其访问策略
4. Token 的 Issuer / Audience / Scope 有效性约束

**失效机制必须可验证**：**不能只改数据库撤销标记就宣称 Token 已立即失效。**

---

## 五、范围与非目标

### 5.1 纳入（六大工作领域）

| 领域 | 内容 |
|---|---|
| **W1 现状审计** | 认证代码与数据模型；API Key 完整实现；API 权限判断；匿名与公开资源行为；文件下载访问控制；MCP 实际传输与认证；`.well-known` 路由；前端/CLI/外部客户端依赖；测试覆盖 |
| **W2 统一认证与权限基础** | 统一认证上下文；不同凭证的身份映射；无效凭证与匿名的区分；凭证授权范围；User/Client/Grant 关系；资源权限决策；API Key 权限模型 |
| **W3 OAuth 能力** | Authorization Server；Client 注册与发现策略；用户授权确认；Token 签发与验证；生命周期；撤销；Scope 与资源权限映射；用户授权管理；管理员配置 |
| **W4 MCP 集成** | Streamable HTTP MCP OAuth 集成；Client 授权；Server 身份验证；Server 委托用户身份访问 API；Audience 与 Scope 正确性；四类部署场景；协议元数据端点 |
| **W5 管理与体验** | API Key 管理；已授权应用管理；授权确认页；Grant 撤销；服务级配置；必要 CLI/API |
| **W6 安全与发布** | 威胁模型；CSRF；Token 验证；权限隔离；凭证存储；兼容性；数据迁移；自动化测试；部署升级回滚 |

### 5.2 非目标（默认不做）

网站登录整体迁移到 OAuth · 废弃 API Key · 官方中心认证平台 · 强制所有部署启用 OAuth · 强制所有 MCP 用 OAuth · 默认新增 STDIO MCP · 完整企业 IAM · 无必要地重构用户系统 · 无必要地更换技术栈 · 改造 Agateon · 顺带处理无关需求

---

## 六、可验证完成条件

指令给出的完成条件，逐条转成可判定形式。**P1 需为每条写出具体验收方法与阈值**；此处先标注判定证据类型。

### 6.1 现状与架构

| # | 完成条件 | 判定证据 |
|---|---|---|
| C1 | 认证、API Key、API、MCP 的真实实现有代码证据 | 带行号的现状文档 + 可复跑探测脚本 |
| C2 | 公开资源与匿名访问行为得到明确描述 | 行为矩阵表（端点 × 凭证态） |
| C3 | 用户 / 凭证 / Client / Grant / Scope / Resource 关系明确 | 关系模型 + 不变量清单，**须落实 8.3 的 I1–I3**（交集非并集、缺省拒绝、L4 不被 L2 短路）|
| C4 | 四层职责明确（L1–L4） | 分层文档 + 每层的验证位置；**L2 与 L3 不得合并成单一权限概念**（8.3）|
| C5 | MCP Client / AS / MCP Server / Peekview API 协议角色明确 | 角色表 + 部署拓扑 |
| C6 | MCP Token 与 API Token 的 Audience 及身份传递关系正确 | 跨资源拒绝用例集 |
| C7 | 技术选型有实际比较与选择依据 | 选型对比表（含 License / 自部署 / 撤销能力 / 维护状况） |

### 6.2 认证与凭证

| # | 完成条件 | 判定证据 |
|---|---|---|
| C8 | **无效凭证与匿名访问正确区分** | 须区分"需凭证路径"与"允许匿名路径"，不得破坏防枚举（见 3.3） |
| C9 | 无效 OAuth Token 不静默降级为匿名 | 无效/过期/错 aud/错 iss 逐项拒绝 |
| C10 | API Key 保留，权限模型与管理员继承关系明确 | 全生命周期可用 + 边界写入文档并被测试覆盖 |
| C11 | 网站现有登录方式保留 | 登录/登出/会话续期行为不变 |
| C12 | 用户禁用后不能继续以该用户身份访问 | 实跑：禁用后 JWT 与 `pv_` 均失效（当前已满足，须防回归） |
| C13 | OAuth Grant 与 Client 的授权关系明确 | 关系模型 + 撤销传播用例 |

### 6.3 OAuth 与 MCP

| # | 完成条件 | 判定证据 |
|---|---|---|
| C14 | OAuth 可选启用与关闭 | 关闭状态下完整跑通现有功能；无外部依赖 |
| C15 | 自部署实例独立运行 | 无中心服务依赖验证 |
| C16 | Scope 不扩大用户自身资源权限 | 越权尝试被拒的用例集 |
| C17 | Streamable HTTP MCP 可通过适当 OAuth 流程访问 | 端到端实跑（非模拟声明） |
| C18 | MCP Server 不能绕过后端资源权限控制 | 后端拒绝 → MCP 透传拒绝的链路验证 |
| C19 | `.well-known` 端点返回符合协议要求的内容 | 真实 HTTP 请求的状态码 + Content-Type + body，**须覆盖 `Accept: application/json`**（见 3.3） |
| C20 | STDIO 不作为默认验收条件 | 除非有独立批准的产品需求 |

### 6.4 撤销与安全

| # | 完成条件 | 判定证据 |
|---|---|---|
| C21 | API Key / Grant / 用户禁用 / Client 禁用各自有明确且可验证的生效保证 | 每类撤销的实跑证据 |
| C22 | 撤销延迟有**量化指标**（按场景分别定义，不一律零延迟） | 指标表 + 测量方法 + 实测值 |
| C23 | 不存在通过其他认证路径绕过撤销的情况 | 跨路径尝试用例（如 Grant 撤销后改用 API Key 路径） |
| C24 | 不存在错误 Audience / Issuer / Scope 被接受 | 篡改矩阵逐项拒绝 |
| C25 | CSRF 与授权确认流程有明确保护 | 攻击场景用例 |

### 6.5 兼容与交付

| # | 完成条件 | 判定证据 |
|---|---|---|
| C26 | 现有 API Key 客户端兼容 | 兼容验证清单实跑 |
| C27 | 公开资源与匿名访问兼容 | 同 C2 矩阵回归 |
| C28 | 读、写、删除、文件下载路径均有权限测试 | 双向用例（允许 + 拒绝），不能只验只读 |
| C29 | OAuth 关闭时原有功能正常 | 同 C14 |
| C30 | 具备自动化测试、安全测试、部署验证 | 测试报告 + 安全场景逐条 |
| C31 | 具备配置、迁移、升级、回滚文档 | 文档清单 |
| C32 | 最终结果有可复现的验证证据 | 证据可重跑，不以"代码已合并/页面完成"为准 |

---

## 七、阶段与工作包 S0–S5

不设僵化瀑布。以下为**工作包**，可按依赖调整、合并、重排；但目标、范围、完成条件不得漂移。

| 阶段 | 目标 | 主要产出 | 依赖 |
|---|---|---|---|
| **S0 现状确认** | 基于真实代码确认现状，建立可验证问题清单 | 现状文档（带行号）+ 问题清单 + 兼容约束清单 | 无 |
| **S1 架构与技术方案** | 确定四层关系；按 8.1/8.2 已定方向选具体实现；确定协议实现方案；明确安全边界与部署模型；**收敛 D2–D3、D5–D12**（D1/D4 已定不重开） | 关系模型 + 选型对比 + 安全边界 + 部署模型 + 决策定稿 | S0 |
| **S2 统一认证与权限基础** | 统一认证上下文；梳理完善权限判定；保持现有访问方式兼容 | 凭证类型识别与隔离 + 统一 L4 判定 + 兼容验证 | S1 |
| **S3 OAuth 能力** | 授权流程、Token 生命周期、用户授权管理、管理员配置 | AS 能力 + Token 机制 + 用户/管理员界面 | S1（部分可与 S2 并行） |
| **S4 MCP 集成** | Client 授权 + Server 访问控制；覆盖四类部署场景与客户端兼容 | MCP 授权流程 + 凭证验证 + 权限映射 + 部署矩阵 | S2、S3 |
| **S5 安全验证与发布** | 验证授权/撤销/权限变更/异常访问；兼容性、部署验证、文档、迁移 | 安全场景验收 + 兼容报告 + 文档 + 迁移方案 | S2–S4 |

**S0 必须先于任何设计**：指令明确要求"以当前代码和实际项目情况为背景，不能凭空假设已有能力"。第三节提供起点，S0 需独立复核。

---

## 八、架构决策

### 8.0 决策状态：D1 / D4 已由用户裁定（2026-11-29）

本节分两部分：**8.1–8.2 是已定决策**（用户裁定，S1 不再重开）；**8.3 是仍需 S1 收敛的 D2–D3、D5–D12**。

用户附加的**变更门槛**（原话）：「如果代码审计发现存在足以推翻这些选择的实际技术约束，应提供具体证据、影响和替代方案，再提出变更，而不是自行扩大建设范围。」——即：D1/D4 不是不可讨论，但推翻须走「证据 + 影响 + 替代方案」三件套，不得以"更完善"为由自行扩大。

### 8.1 D1 — Authorization Server 部署形态（**已定**）

| 项 | 决定 |
|---|---|
| **形态** | 逻辑独立、部署内置 |
| **第一阶段** | AS 作为 Peekview 后端**内部独立模块**，不引入独立进程 |
| **不采用** | Keycloak / Ory / authentik 等完整 IAM 产品 |
| **协议实现** | **优先复用成熟、经充分验证的库**，不自行从零实现协议细节 |
| **演进** | 架构上**保留**未来独立部署的可能，但**不得为这种可能提前引入额外基础设施与运维负担** |

**「逻辑独立、部署内置」的可判定含义**（为避免 S1 各写各的理解，先钉死三条）：

1. **代码边界独立**：AS 是独立模块（service + router），不寄生在 `auth.py` 里。判据：AS 相关代码不与 `get_current_user` / JWT 会话逻辑混在同一文件。
2. **不新增进程 / 端口 / 容器**：仍由现有 `create_app()` 装配、现有 uvicorn 进程承载。判据：部署单元数量不变。
3. **状态可分离**：AS 的 client / grant / token 状态存储在语义上独立于 User 表，未来可拆库。判据：AS 表不通过外键**强耦合**到只能同库的语义（Peekview 用 SQLite 单库，此处指**设计上**预留，不是现在就分库）。

#### 8.1.1 依赖侧已核实的事实（影响 D1 的选型，供 S1 直接使用）

用户要求「优先复用成熟库」。**核实结论：这条路在当前项目可行，但有一个必须知道的实现细节**——库的 AS 集成层只覆盖 Flask/Django，FastAPI 需要自己搭一层薄封装。

本轮实测（`pip download authlib==1.9.10` 后解包检查，未安装）：

| 事实 | 证据 |
|---|---|
| 项目当前**无** authlib | venv `import authlib` → `ModuleNotFoundError`；`pyproject.toml:25-43` 依赖清单无 authlib |
| 加密能力已具备 | `python-jose[cryptography]>=3.3.0`（venv 实测 `jose 3.5.0` + cryptography），可做 JWS/JWK/JWT |
| authlib 提供 AS 相关 integrations | wheel 内 `authlib/integrations/` = base_client / django_client / django_oauth1 / **django_oauth2** / flask_client / flask_oauth1 / **flask_oauth2** / httpx_client / requests_client / sqla_oauth2 / starlette_client |
| **无 `starlette_oauth2` / `fastapi_oauth2`** | 实测 `starlette_oauth2 exists: False`；官方文档的 Authorization Server 章节只列 Flask 与 Django 两种集成（[Authorization Server 文档](https://docs.authlib.org/en/stable/oauth2/authorization-server/index.html)） |
| **但协议核心与框架无关** | `authlib/oauth2/rfc6749/authorization_server.py` 的 import 中 `flask` 出现 **0** 次、`django` **0** 次、`request.args`/`request.form` **0** 次——纯协议实现 |
| 集成层很薄 | `flask_oauth2/authorization_server.py` 仅 **165 行**，方法是 `init_app` / `load_config` / `create_oauth2_request` / `create_json_request` / `handle_response` / `send_signal` / `create_bearer_token_generator` 等适配样板 |

**这对 D1 的含义**：`rfc6749` 核心可直接用，需自写的是**约一个 Flask 集成层的等价物**（把 Flask request/response 换成 Starlette/FastAPI 的），不是自研协议。这与「优先复用成熟库、不自研协议」不冲突——**协议逻辑复用，框架适配自写**。S1 须在 D8（组件选型）中把这条工作量显式计入，不能按"装个库就有 AS"估算。

> 注：上表中 authlib 的模块存在性来自解包实测；其"未来是否会提供 Starlette AS 集成"**未验证**，不应作为排期依据。

### 8.2 D4 — Scope 设计（**已定**）

| 项 | 决定 |
|---|---|
| **范围** | OAuth Grant **保留最小 Scope 能力**，不建设复杂通用权限体系 |
| **语义** | Scope 用于限制 User 授予特定 OAuth Client 的权限范围，**不能扩大** User 自身的 Peekview 资源权限 |
| **粒度** | 初期只定义**确实有必要的粗粒度**类别（如读取、写入）；具体划分须**根据当前 API、MCP 工具及实际操作风险核实后确定**，不预设大量细粒度 Scope |
| **API Key** | **保留兼容**；本次**不强制**引入 API Key Scope，**不要求**把 API Key 全面改造成 OAuth Grant |

**推论（S1 须落实）**：Scope 的粒度不能先验决定，必须先做一次「58 个 API 操作 × 6 个 MCP 工具 × 实际操作风险」的对应表，再由表推出最少需要几个类别。**这正好是 S0 的输出物之一**，顺序不能颠倒——旧方案（TPV0105）定 `docs:read`/`docs:write` 时并未做过这张表。

### 8.3 共同约束：三类权限不得混为一谈（**已定**）

用户原话：「不要将 User 权限、凭证权限、OAuth Grant Scope 混成一个权限概念。所有访问最终都必须同时满足用户自身权限、凭证或 Grant 的限制，以及目标资源的访问规则。」

转成可判定形式，**任何一次资源访问须同时通过三项，缺一即拒**：

```
allow =  UserPermission(user, resource, action)      # L3：用户自身能做什么
      AND CredentialOrGrantLimit(credential, action)  # L2：这个凭证被授予了什么
      AND ResourcePolicy(resource, action)            # L4：资源本身的访问规则
```

三条关键不变量（S1 须写进设计，S2 须被测试覆盖）：

| # | 不变量 | 反例（必须被拒） |
|---|---|---|
| I1 | **交集而非并集** | Grant 有 `write` 但 User 无权写该 entry → 拒。Scope 不能提权 |
| I2 | **任一为空即拒，不默认放行** | Credential 无 scope 信息 ≠ 无限 scope。缺省须是拒绝，不是允许 |
| I3 | **L4 不能被 L2 短路** | Grant 有 `read` 且 User 是 admin，但资源规则要求 team 成员 → 仍按 L4 判 |

**I2 是本任务最容易出错的地方**：现有 `pv_` 之所以危险（3.4 的实证），本质就是"无 scope 被当作无限 scope"。若 OAuth 路径照抄这个默认值，等于把同一缺陷复制到新凭证类型上。

### 8.4 仍需 S1 收敛的决策（D2–D3、D5–D12）

| # | 待决 | 需回答的问题 |
|---|---|---|
| D2 | **凭证类型识别机制** | 四类凭证如何无歧义区分？是否需显式类型标识（`typ`）？判别失败如何不降级？改动须覆盖 `_looks_like_jwt` / `pv_` 前缀 / `_is_global_api_key_auth` 三处 |
| D3 | **撤销机制** | 无状态 Token 如何做到可验证的即时撤销？必须引入有状态校验吗？性能代价？多实例如何传播？缓存延迟如何计量？ |
| D5 | **`pv_` 全权语义** | 3.4 实证：管理员 Key 可删用户。**注意**：D4 已定"本次不强制引入 API Key Scope"，故 D5 的可行空间收窄为「保留现状但显式记录风险与适用场景」或「提供可选的限权 Key」，**不得**推出"全面改造 API Key 为 Grant"——那超出 D4 授权范围 |
| D6 | **MCP 四场景策略** | 本机 / 局域网 / 远程 / 第三方 Client 各自认证方式？是否需要 stdio 传输能力？ |
| D7 | **下游凭证问题** | MCP 转发客户端 token 的形状（A12）如何处理？token exchange？按场景分凭证？还是让 MCP 作为独立 RS 后再取下游凭证？须说明安全性、复杂度、运行成本 |
| D8 | **组件选型** | 复用哪些成熟实现？Python 与 Node 侧分别选什么？**须计入 8.1.1 的框架适配工作量**；**MCP SDK ≠ 完整 AS** |
| D9 | **Token 生命周期** | 有效期、是否 refresh、轮换策略——**必须成对裁决**（旧方案在此自相矛盾过） |
| D10 | **管理员配置边界** | 哪些是实例级、哪些是用户级？关闭 OAuth 的实例如何表现？ |
| D11 | **迁移与兼容** | 现有 `pv_` key 用户如何不受影响？旧 Token 如何处理？是否需要数据迁移？回滚路径？ |
| D12 | **四层关系的验证位置** | L1/L2/L3/L4 各在哪一层代码验证？两端（Python/Node）如何不漂移？**须落实 8.3 的 I1–I3** |

### 8.5 决策不重开原则

D1 / D4 / 8.3 已定，S1–S5 **不得自行变更**。若审计发现足以推翻的实际技术约束，须提交：

1. **具体证据**（代码行号 / 实测输出 / 规范原文，不接受推测）
2. **影响**（推翻后哪些设计要改、代价多大）
3. **替代方案**（至少一个可执行的）

经用户确认后方可变更。**不得以"方案更完善"为由自行扩大建设范围。**

---

## 九、主要风险和依赖

### 9.1 风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | 凭证混用导致越权 | 严重 | S2 核心交付即"识别与隔离"；C8/C9 强制可区分 |
| R2 | 撤销语义不可验证 | 严重（虚假安全感） | 指令禁止"只改标记即失效"；C21/C22 要求实跑 + 量化指标 |
| R3 | 为修静默降级而破坏匿名与防枚举 | 中高 | 3.3 修正直接写成 C8 的约束 |
| R4 | 范围膨胀成 IAM | 中（拖垮任务） | 5.2 非目标 + 第十节边界纪律 |
| R5 | 双端权限逻辑漂移 | 中 | W2 要求统一判定原则；S4 显式验证两端一致 |
| R6 | 旧方案惯性 | 中 | 第十一节显式列出不继承项 |
| R7 | 四类 MCP 场景难以同时满足 | 中 | 不追求"一套覆盖所有"，C6/C18 要求的是**明确策略** |
| R8 | E2E 基建质量影响验收可信度 | 中 | 见 9.2 |

### 9.2 依赖

| 依赖 | 状态 | 影响 |
|---|---|---|
| 无硬前置任务 | — | 可独立开工 |
| TPV0097 / TPV0098（E2E 分片与用例可信） | 未开始 | **不阻塞**，但 S5 若需大规模 E2E 可能受其影响 |
| TPV0071（docker-deploy） | 未开始 | 部署模型设计可能重叠，S1 需协调 |
| MCP stdio 传输 | **不存在**（A11） | 若该场景纳入，需先补能力或明确排除 |
| 公网 HTTPS 入口 | 部署侧事项 | **非开发前置**，回环可完成开发与验证 |
| OAuth 组件选型 | 待 S1（D8） | 4.1 P12：优先复用，不得自研协议或密码学。**8.1.1 已核实：authlib 的 AS 集成只覆盖 Flask/Django，FastAPI 需自写等价适配层（协议核心可复用）** |

### 9.3 环境约束

- 开发与测试全部在隔离环境（`make debug` :8888 + `/tmp/peekview-debug/`）
- 生产 `:8080`/`:13001`、`~/.peekview/`、pipx 全程不触碰
- MCP 集成测试指向 debug backend，绝不指向生产
- 任何选型须能在**纯自部署**条件下运行，不假设中心服务可用

---

## 十、任务边界控制规则

执行中发现问题时：

1. 判断其是否影响本任务的安全性、兼容性或用户目标
2. 提供**代码或运行证据**（不接受推测）
3. 判断是否为本任务的必要前置条件
4. 必要问题**可申请纳入**，但须说明新增工作量与影响
5. 非必要问题**单独记录**，不自动扩展任务边界

**不允许为了追求架构完整性无限扩大任务。**

三条硬边界：

- **不把"顺手统一所有凭证格式"当作成果**——格式统一不是目标，关系明确才是
- **不把"引入某成熟 AS 产品"当作解法本身**——须先证明其满足"自部署独立、无中心依赖、License 可用"（P3/P4/P12）
- **不在 S0 完成前裁决 D2–D3、D5–D12**——旧方案最大的错误就是跳过现状直接定架构（D1/D4 已由用户裁定，不受此限）
- **不自行推翻 D1/D4/8.3**——须走 8.5 的「证据 + 影响 + 替代方案」三件套并经用户确认

---

## 十一、TPV0105 / TPV0106 历史衔接

### 11.1 TPV0105（已作废）

**2026-11-29 用户决定作废**（`.state.yaml` 有 `cancelled` 记录，看板标 🚫）。P0 完成且经两轮独立审查，**未进 P1、无任何代码产出**。

| 项 | 处理 |
|---|---|
| 历史记录 | **保留**，不删除、不修改其任何文件 |
| 旧 OAuth P0 方案 | **明确作废**，不在其上直接修补 |
| 架构与技术假设 | **不默认继承** |
| 实测成果 | **只复用经重新验证仍成立的**（见 11.3） |

### 11.2 TPV0106（已 Git revert）

`444e6078` 立项，`55afa456` revert。`git diff 16c5aabc --name-only` 为空，工作树内容与立项前完全一致。

- **不得**把撤销前的 Task 记录误认为当前有效任务
- 编号处置：`TPV0106` 目录已移除，但本地 `.gate-history.jsonl` 仍保留其 `task_created` 记录（哈希链）。指令要求"不得擅自占用或复用编号"，故本次**新分配 TPV0107**（`git log --all` 确认该号从未出现），不复用 0106
- 新 Task 有独立、清晰的记录

### 11.3 可复用但须重新验证的研究成果

以下在旧任务中经实测得出，与架构选择无关，可复用但须复核（版本：Peekview 0.28.0 / MCP 0.12.0）：

- MCP 规范 2026-07-28 结论：DCR 已 Deprecated 且 "new implementations SHOULD NOT adopt"；CIMD 为 SHOULD；`resource` 参数为 client 侧 MUST；RS 只接受自己签发的 token 为 MUST；**MCP server MUST NOT pass through 客户端 token**
- 平台侧事实：Gemini Connected Apps 需 `registration_endpoint` **或** 手填 client id/secret（二选一）；Claude 要求 metadata advertise `"none"` 才走 CIMD
- `python-jose` 的两个坑：`access_token=True` **不校验** `typ`；`jwk.construct().to_dict()` **只产** `alg/e/kty/n`，`kid`/`use` 需手工注入
- 旧方案两轮独立审查记录（首轮 FAIL 6 项阻断、二轮 PASS WITH ISSUES 8 项残留）——**最有价值的复用物**，记录了这类设计最容易犯的错

### 11.4 已吸收的教训

| 教训 | 本任务应对 |
|---|---|
| 先定架构后做现状梳理，方案与产品约束错位 | **S0 强制先于 S1**，且 S0 独立复核 |
| 把"某平台接入方式"倒推成全局架构 | 4.2 要求四类场景**并列**考虑，不预设主场景 |
| 把推断写成"已验证事实" | 第三节全部带行号/实测；推断另设第十四节 |
| 审查阻断项散落对话未沉淀 | 审查结论作为 S1 输入；S5 需独立 judge |
| TTL 与 refresh 策略互相矛盾 | 列为 D9，**必须成对裁决** |
| 记录中的绝对化表述与实测不符（本轮发现 2 处，见 3.3） | S0 复核须**重跑而非引用**；结论附环境与命令 |

### 11.5 文档保留

`agate-workspace/tasks/TPV0105-mcp-oauth-remote/` 全部保留（含 1290 行 P0-brief、两轮审查记录）。**本任务不修改其任何文件。**

---

## 十二、启动条件与优先顺序

### 12.1 硬性启动条件

| # | 条件 | 状态 |
|---|---|---|
| 1 | TPV0107 已正式创建并登记看板 | ✅ 本次 |
| 2 | P0-brief 四字段齐全（task / known_risks / executor_env / env_constraints） | ✅ 本次 |
| 3 | 环境自检 5 项通过 | ✅ 本轮已跑（pytest 9.1.1 / ruff 0.15.22 / vue-tsc 5.9.3 / MCP node_modules 就绪 / 版本 0.28.0 与 VERSIONS.json 一致 / 工作树干净） |
| 4 | 用户明确「开工」 | ⏸ **待用户指令** |

### 12.2 优先顺序

| 序 | 事项 | 理由 |
|---|---|---|
| 1 | S0 现状确认 | 指令硬要求；旧方案错在跳过此步 |
| 2 | S1 架构 + D2–D3、D5–D12 收敛 | D1/D4 已定；其余在此裁决；**Scope 粒度须等 S0 的 API×工具×风险表出来后才能定**（8.2 推论）|
| 3 | S2 统一认证基础 | 后续一切的前提 |
| 4 | S3 OAuth 能力 | 可与 S2 部分并行 |
| 5 | S4 MCP 集成 | 依赖 S2/S3 |
| 6 | S5 安全验证与发布 | 收口 |

### 12.3 建议的 S0 第一批动作

1. 复核第三节 A1–A13，逐条重跑（**不引用本文结论**），特别是 3.3 两张实测表
2. 复现 3.4 的 `pv_` 全权实证，确认是否仍可删用户
3. 枚举 58 个 API 操作与 MCP 6 个工具的权限判定对应关系，建表
4. 交叉验证 A11（MCP 无 stdio），排除运行时动态加载可能
5. 建立"现有客户端兼容清单"——哪些脚本/CLI/外部集成依赖当前认证行为
6. 补测 API Key 撤销与实际生效延迟（本文未取得该数据，见 U8）
7. 输出问题清单（可验证、可复现），作为 S1 输入

---

## 十三、本次立项交付物对照

| # | 指令要求 | 本文对应 |
|---|---|---|
| 1 | 正式创建的 Agateon Task 与任务 ID | **TPV0107** — `agate-workspace/tasks/TPV0107-unified-auth-mcp-authorization/` |
| 2 | 背景与目标 | 第一、二节 |
| 3 | 任务范围与非目标 | 第五节 W1–W6 / 5.2 |
| 4 | 已知代码现状与待核实事项 | 第三节（含 3.8 待核实） |
| 5 | 可验证完成条件 | 第六节 C1–C32 |
| 6 | 阶段和工作包安排 | 第七节 S0–S5 |
| 7 | 关键架构决策清单 | 第八节：**D1/D4/8.3 已由用户裁定**，D2–D3/D5–D12 留 S1 |
| 8 | 主要风险和依赖 | 第九节 |
| 9 | 任务边界控制规则 | 第十节 |
| 10 | TPV0105 / TPV0106 历史衔接 | 第十一节 |
| 11 | 后续执行的启动条件和优先顺序 | 第十二节 |

---

## 十四、未验证断言

按「先证后说」，P0 阶段未能验证或仅有单方来源的事项：

| # | 断言 | 状态 |
|---|---|---|
| U1 | 3.2 表 A1–A13 全部成立 | **本轮实测/直读**，未做跨版本回归；S0 须独立重跑 |
| U2 | "MCP 无 stdio 传输" | 基于 `grep StdioServerTransport` 零命中 + `server.ts` 只 import Streamable HTTP；**未测运行时动态加载** |
| U3 | 四类 MCP 场景全部需要支持 | 来自指令，但指令同时说"不能无理由要求所有场景用 OAuth"；具体取舍待 S1 与用户确认 |
| U4 | C1–C32 的判定阈值与方法足够 | 类型已标注，**具体阈值未定**（如撤销延迟指标），指令允许"由执行过程结合真实实现确定" |
| U5 | 存在满足"自部署独立、无中心依赖"的成熟 AS 方案 | **未调研**。S1 核心工作 |
| U6 | 现有 E2E 基建足以支撑 S5 验收 | **未验证**。TPV0097/0098 未完成 |
| U7 | 11.3 的可复用结论在新版本下仍成立 | **未复核**。S0/S1 须逐条验证 |
| U8 | API Key 撤销后的实际生效延迟 | **未取得实测数据**（探测脚本在登录步骤中断，未重跑） |
| U9 | 3.4 的 `pv_` 全权实证在生产配置下同样成立 | 仅在 debug 隔离环境验证；生产配置差异未验证 |
| U10 | "生产 DB 16 张表" | `sqlite3 .tables` 实查；**未验证是否有其他 attach 库** |
| U11 | 登录/登出/改密对已签发 JWT 的影响 | **未实测**（scripts 中断），C11/C12 的现状前提待 S0 补齐 |
| U12 | authlib 未来是否提供 Starlette/FastAPI 的 AS 集成 | **未验证**，不可作为排期依据（当前实测为无） |
| U13 | 自写 FastAPI 适配层的工作量 | **未估算**。8.1.1 只测出 Flask 集成层 165 行这一量级参考，实际工作量待 S1 评估 |
| U14 | 8.3 的三项不变量 I1–I3 与现有代码的兼容性 | **未验证**。现有 `can_read_entry` 只实现 L4 与部分 L3，**L2 尚不存在**，故 I1–I3 当前既无从违反也无从验证；S0 须确认现有路径是否隐含"无 scope = 无限 scope"的默认值 |

---

## 十五、下一步

**本次仅完成立项。等用户「开工」进 P1。**

P1 的第一个动作**不是设计，而是 S0 现状确认**——这是与旧方案最重要的区别。旧方案跳过现状直接设计架构，结果架构与产品约束错位。

若用户希望先讨论方向再开工，建议聚焦两项：**D1（AS 落点）与 D4（scope 是否必要）**——这两项决定整个体系的形态。
