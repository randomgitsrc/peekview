---
phase: P0
task_id: TPV0105
task_name: mcp-oauth-remote
trace_id: TPV0105
created: 2026-11-28
status: pending-start
parent: 无
---

# P0-brief — TPV0105 PeekView 全项目 OAuth 2.1 身份层

> 主 Agent 亲自填写（P0 产出）。

```yaml
task: "为 PeekView 与 peekview-mcp 建立统一 OAuth 2.1 授权体系，使远程 MCP 客户端可凭标准流程接入"
known_risks:
  - "首次让 PeekView 对外签发可被第三方持有的凭证，token 校验有洞即为越权读写"
  - "PeekView 完全无 scope 概念，需从零引入并同时在后端 API 与 MCP 工具层落实"
  - "PeekView 无 OAuth 相关表，client 记录与授权码需要新的持久化落点"
  - "双产品同时改动（Python 后端 + Node MCP Server），版本与测试契约都要同步"
  - "现有 MCP 认证测试契约断言 'pv_' 前缀，双模式后必须重新界定"
env_constraints:
  debug_env: "make debug（127.0.0.1:8888，数据隔离 /tmp/peekview-debug/）；MCP 用独立端口本地起"
  production: "生产 :13001 / ~/.peekview/ / pipx 全在域外，本任务不得触碰"
executor_env:
  platform: "DSH"
  has_task_tool: true
  has_local_runtime: true
  network: "本机回环 + 公网 HTTPS 探测均可"
```

## 一、任务定义

给 PeekView **整个项目**加一层 OAuth 2.1 授权体系。两个产品都在范围内，角色不同：

| 产品 | 角色 | 职责 |
|---|---|---|
| PeekView 后端 | **授权服务器（AS）** + 资源服务器（RS） | 用户身份、授权页、签发 token、保护自己的 API |
| peekview-mcp | 资源服务器（RS） | 保护 `/mcp`，接受 OAuth token，按 scope 裁剪工具 |

**为什么 AS 必须落在 PeekView 后端**：账号、密码、JWT、登录态、captcha 全在那里。peekview-mcp 没有用户库，让它当 AS 就得把身份体系复制一份；而且授权页会跨 origin，拿不到 `peekview_token` Cookie，用户被迫重新登录。这是数据归属决定的，不是偏好。

**因此一个直接推论**：Node SDK 的 `mcpAuthRouter` 在本项目**用不上**。它是 express 中间件，而我们的 AS 是 Python/FastAPI。它只在"AS 放在 Node 侧"时可用——那条路会把身份体系劈成两半。SDK 在 MCP Server 侧仍有价值（`mcpAuthMetadataRouter` 出 PRM 元数据），但 AS 端点需要手写 FastAPI 实现。可用的加密库已在依赖里：`python-jose[cryptography]>=3.3.0`（`backend/pyproject.toml:36`，venv 内实测 3.5.0 + cryptography 49.0.0，`jose.jwe` 可用）。

## 二、要解决的问题

当前 PeekView MCP 只认一种凭证：静态 API Key（`Authorization: Bearer pv_xxx`）。

```ts
// packages/mcp-server/src/server.ts:102-106
const authHeader = req.headers.authorization?.replace('Bearer ', '') ?? '';
if (!authHeader.startsWith('pv_')) {
  return { ok: false, status: 401, error: 'Only PeekView API Key (pv_ prefix) is supported' };
}
```

这对本地 IDE（Cursor、Cline、Claude Code）够用——配置文件里填一行 header 即可。但对**消费级平台**不成立：Gemini、Claude.ai、ChatGPT 的远程 MCP 连接器不提供"自定义静态 Header"入口，它们只会走 OAuth 2.1 发现流程。用户想把 PeekView 接到手机端或网页端对话里，当前无路可走。

OAuth 落地后还能顺带解决三件事：用户不再手工复制 key；凭证有了有效期与 scope 收敛；将来浏览器插件、IDE 插件、移动端可以复用同一套授权，不必各自造轮子。

## 三、现状缺口（本轮实测，非推断）

全部在 `127.0.0.1:13003`（MCP v0.12.0）与 `127.0.0.1:13001`（PeekView v0.28.0）上现测：

| # | 缺口 | 证据 |
|---|---|---|
| G1 | MCP 的 401 不带 `WWW-Authenticate` | `curl -D- -X POST :13003/mcp` → `HTTP/1.1 401`，响应头逐行确认无该字段。客户端拿不到 AS 地址，发现流程第一步就断 |
| G2 | MCP 无 PRM 元数据（RFC 9728） | `/.well-known/oauth-protected-resource` 与 `/…/mcp` 两个变体均 `404` |
| G3 | PeekView 无 AS 元数据（RFC 8414） | `:13001/.well-known/oauth-authorization-server` → `404`；公网 `:19093` 同路径返回 `200 text/html` |
| G4 | **`.well-known` 被 SPA catch-all 吞掉** | `main.py:598` 的 `serve_spa_catchall` 注册在所有 router 之后，覆盖任意未匹配路径。`/.well-known/*` 不在 `FRONTEND_ROUTES`（`main.py:25`）也不是真实文件，于是落到 `index.html`。**返回 200 + HTML 比 404 更危险**——客户端会当成"通了"然后解析失败 |
| G5 | PeekView 无任何 OAuth 表 | `models.py` 无 client / code / token 表。`grep` 无 `oauth_client` / `oauth_token` 命中 |
| G6 | PeekView 无 scope 概念 | `ApiKey` 模型（`models.py:267-292`）只有 name/prefix/hash/expires；JWT payload 只有 `sub`/`exp`/`iat`（`auth.py:113-117`）；`grep -c scope` 在 `auth.py` 与 `api/_shared.py` 均为 **0** |
| G7 | `decode_access_token` 只验 HS256，无 `aud`/`iss` | `auth.py:121-135`——`jwt.decode(token, secret_key, algorithms=[JWT_ALGORITHM])`，没有 audience 校验 |
| G8 | `/login` 在 `FRONTEND_ROUTES` 里，但前端**没有这个路由** | `main.py:25` 有 `"login"`；`router.ts` 里 `grep -c "path: '/login'"` = **0**。实际登录是 `LoginDialog.vue` 弹窗（`LandingView.vue:189`）。授权页需要新路由，不能指望复用现成的 |
| G9 | MCP Server 未直接依赖 `express-rate-limit` | 仅在 SDK 的嵌套 `node_modules` 内。若自行限流需显式声明依赖 |

### 关于"公网可达性"

本机 `:13003` 从公网不可达（`curl https://s4.vide.cc:13003/health` → `000`），公网入口 `:19093` 是 PeekView 的 SPA。

**这属于部署配置范畴，不是本任务的开发前提。** 开发与验证完全可以在回环上完成——SDK 的 issuer 校验对 `localhost` / `127.0.0.1` 明确豁免 HTTPS（`router.js:15`），DSH 的 mcp-client 同样允许"loopback HTTP"（`mcp-client/README.md:125`）。部署侧需要提供什么，见第八节，那是运维动作，不阻塞 P1–P8。

## 四、目标架构

```
                    ┌─────────────────────────────────┐
   消费级平台        │  PeekView 后端 (:8888 / 生产)     │
   Gemini /         │                                 │
   Claude.ai /  ───▶│  AS: /oauth/authorize            │
   ChatGPT          │      /oauth/token                │
        │           │      /oauth/register  (DCR)     │
        │           │      /.well-known/oauth-        │
        │           │        authorization-server      │
        │           │                                 │
        │           │  RS: /api/v1/**                  │
        │           │      验 token + 验 scope         │
        │           └──────────────┬──────────────────┘
        │                          │ 内部校验
        │                          │ (复用 /auth/me)
        │           ┌──────────────▼──────────────────┐
        └──────────▶│  peekview-mcp (独立端口)          │
                    │                                 │
                    │  RS: /mcp                        │
                    │      /.well-known/oauth-         │
                    │        protected-resource/mcp    │
                    │                                 │
                    │  双模式鉴权 + 按 scope 裁剪工具    │
                    └─────────────────────────────────┘
```

**两个 RS 共用一个 AS**。客户端连 MCP 时，PRM 告诉它 AS 在哪（PeekView）；授权在 PeekView 完成，用户已登录就一键同意；拿到 token 后回到 MCP 使用。

### 一条能省掉大量工作的发现

MCP Server 现在验证 `pv_` key 的方式是**反查 PeekView**：

```ts
// packages/mcp-server/src/client.ts:131-141
async validateToken(token) {
  const res = await fetch(`${this.baseUrl}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  ...
}
```

只要 PeekView 的 `get_current_user`（`auth.py:138`）学会接受 OAuth token，这条路径**原样可用**——OAuth token 和 `pv_` key 都走 `/auth/me`，MCP 侧不需要任何验签代码，也不需要拿到签名密钥。scope 可以顺带由 `/auth/me` 返回。

代价是每次工具调用多一次内部 HTTP（现在已经是这样，不是新增开销）。这是 v1 的推荐路径；JWKS + 本地验签是后续优化项，不是必需。

## 五、关键设计决策

### 决策 1：双模式鉴权，`pv_` 静态 key 行为不变（P0 已定）

OAuth token 与 `pv_` key 并存，按 token 形状分流：`pv_` 前缀走原路径，其余按 OAuth token 处理。理由：本地 IDE 用户没有迁移动力，破坏它等于让所有现存配置失效；而 MCP 官方的授权规范本身也是"服务器可以同时支持多种凭证"。

**但契约要改**：`packages/mcp-server/tests/server.test.ts:113-120` 有测试断言「拒绝非 `pv_` token 且错误信息含 `pv_`」。双模式后，非 `pv_` 的 JWT 形状 token 可能是合法的，这条测试的语义必须重新界定——P1 要明确新的拒绝话术与断言。

### 决策 2：scope 只在 token claim 里，不落库（P0 已定）

最小两级：

| scope | 覆盖工具 | 覆盖 API |
|---|---|---|
| `docs:read` | `get_entry`、`list_entries`、`list_teams` | `GET` 类 |
| `docs:write` | `create_entry`、`publish_files`、`delete_entry` | 写类 |

`docs:write` 隐含 `docs:read`（否则无法确认写入目标）。

**不落库的理由**：`ApiKey` 没有 scope 字段，加字段就是 schema 迁移 + 权限模型改造，会把任务从"加一层授权"扩成"重构权限体系"。scope 只存在 token claim 里，两个 RS 各自读 claim 执行。要改某次授权的 scope 就重新授权——符合 OAuth 的模型。

### 决策 3：授权页新建，不复用现有登录（P0 已定，依据 G8）

`/login` 在前端根本不存在，登录一直是弹窗。授权页需要独立路由（如 `/oauth/authorize`），未登录时内嵌登录流程（可直接复用 `LoginDialog.vue` 的组件能力），已登录则展示"某客户端请求访问你的 PeekView（读 / 读写）"并给同意/拒绝。

**注意病毒式传播的 captcha**：生产配置 `auth.captcha_enabled: true`，登录受 captcha 约束（`api/auth.py:69,139`）。授权页复用登录流程时 captcha 一并生效，这是对的，不要绕过。

**路由冲突**：`/oauth/authorize` 是两段路径，不会命中 `/:slug`（单段），但会落到 `/:pathMatch(.*)*` 的 NotFound。需要显式注册，且要排在 catch-all 之前。后端侧 `FRONTEND_ROUTES` 也要放行 `oauth/` 前缀，否则 `_prefers_json` 的客户端会走进 raw 解析分支（`main.py:611`）。

### 决策 4：`.well-known` 必须在 SPA catch-all 之前注册（P0 已定）

G4 是当前最隐蔽的问题：`/.well-known/*` 返回 `200 text/html`。这在开发时极易误判为"端点通了"，实际拿到的是 Vue 的 `index.html`。所有元数据路由必须在 `_setup_static_files(app)`（`main.py:588`）**之前**注册。

### 决策 5：AS 端点命名空间（P1 待裁决）

PeekView 已有 `POST /api/v1/auth/register`（用户注册，`api/auth.py:42`）。DCR 若也叫 `/register` 且挂在根路径，两个语义撞车。倾向 `/oauth/*` 前缀（`/oauth/authorize`、`/oauth/token`、`/oauth/register`），但 RFC 8414 的元数据可以写明绝对路径，所以不影响标准合规性。**P1 确认。**

### 决策 6：token 形态（P1 待裁决，**本任务最关键的分叉**）

| 方案 | 做法 | 优点 | 代价 |
|---|---|---|---|
| **A（倾向）** | access token 用现有 HS256 secret 签名，加 `scope`/`client_id`/`aud`/`typ` 私有 claim；MCP 反查 `/auth/me` 验证 | `get_current_user` 改动最小；MCP 零验签代码；不需要密钥分发 | 每次工具调用多一次内部 HTTP（现状已如此）；MCP 无法离线验签 |
| B | RS256 + 独立密钥对 + JWKS 端点，两个 RS 本地验签 | 标准形态；MCP 可离线验签；未来多 RS 友好 | 要管密钥生命周期；要发布 JWKS；MCP 侧要加验签依赖 |
| C | 不透明随机串 + `/introspect` 内省端点 | 撤销即时生效；token 不携带信息 | 每请求一次内省；需新增端点与表 |

**P0 倾向 A**：改动面最小，且 MCP 现有的 `validateToken` 路径可以原样复用——这是本任务里性价比最高的一处复用。B 是长期正解，但在"两个 RS 都在同一台机器"的现状下收益不明显。

**P1 必须裁决 A 还是 B**，因为它决定 MCP 侧要不要引验签依赖、PeekView 要不要发 JWKS。

### 决策 7：PKCE 强制 S256（P0 已定）

`code_challenge_method` 只接受 `S256`，拒绝 `plain`。这是 OAuth 2.1 的基线要求，也是公共客户端的唯一保护手段。SDK 的实现同样硬编码了这一点（`authorize.js` 的 `RequestAuthorizationParamsSchema` 里 `code_challenge_method: z.literal('S256')`），可作为参照。

### 决策 8：不引入 refresh_token（P0 已定）

v1 只发短期 access token。refresh token 涉及轮换、重放检测、家族失效，是独立的安全议题；在授权撤销管理页还没有的情况下引入 refresh，会让"撤销"变得更难讲清楚。等有撤销通道再说。

## 六、范围

### 纳入

| 项 | 内容 |
|---|---|
| A. PeekView AS | `/oauth/authorize`、`/oauth/token`、`/oauth/register`(DCR)、`/.well-known/oauth-authorization-server`；PKCE S256 |
| B. PeekView RS | `get_current_user` 接受 OAuth token；`/auth/me` 返回 scope；API 层按 scope 拒写 |
| C. peekview-mcp RS | PRM 元数据；401 带 `WWW-Authenticate`；双模式鉴权；按 scope 裁剪 `ListTools` 结果 |
| D. 授权页 | 独立路由；未登录可登录、已登录一键同意；展示请求的 scope |
| E. 持久化 | DCR client 记录 + 授权码短命存储（决策 6 若选 B 还需签名密钥） |
| F. 向后兼容 | `pv_` 路径行为不变；现有认证测试契约更新后全绿 |

### 排除

| 项 | 理由 |
|---|---|
| refresh_token | 见决策 8 |
| 授权撤销管理页（"已授权应用"） | 需新表 + 新 UI + 新 API，独立子系统；v1 靠 token 短期过期兜底。**列为后续任务** |
| 公网入口 / 反代 / 域名配置 | 部署范畴，见第八节。本任务只保证代码在回环可验证 |
| 改 DSH 的 3 个 MCP 配置 | 本机静态 key 路径继续可用，无收益。且 DSH 直连 row 无法自行发起授权（`mcp-client/README.md:125`），要走 OAuth 必须先迁 manager——那是另一件事 |
| Phase 3 生态复用（浏览器插件 / VS Code / 移动 App） | 与 v1 无耦合 |
| scope 落库 / 权限模型重构 | 见决策 2 |

## 七、已知风险

1. **签名密钥即最高权限**。HS256 下 secret 泄露 = 可伪造任意用户的任意 scope token。若选方案 A，这个 secret 就是 `~/.peekview/.secret_key`（`auth.py:28`），与 JWT 会话共用。**P2 需评估是否给 OAuth token 单独密钥**——共用虽省事，但把会话 JWT 与第三方 token 的风险绑在了一起。
2. **`aud` 缺失是现成的洞**。`decode_access_token` 不校验 audience（G7）。引入 OAuth 后，如果 MCP 的 token 也能被 PeekView API 接受、反之亦然，就出现了跨资源混用。**必须在 token 里加 `aud` 并在两个 RS 各自校验**，这是 OAuth 2.1 的硬要求，不是可选项。
3. **DCR 是公开写入口**。任何人都能注册 client。SDK 的 Node 实现默认 20 次/小时（`register.js:22-27`），但我们手写 FastAPI 版本没有免费实现，需自己挂 slowapi（项目已有 `api/rate_limit.py`）。未限流的 DCR 可以被刷爆表。
4. **授权码存储的 TTL 与清理**。授权码是一次性的、短命的（分钟级）。存内存则多进程/重启丢失，存 SQLite 则需要清理任务。P2 要明确。
5. **双产品版本**。PeekView 与 MCP Server 都要 bump（当前 `0.28.0` / `0.12.0`），P8 分别判定 minor/major。
6. **安全域属高风险**。本任务首次让 PeekView 对外签发第三方可持有凭证，一旦 `aud`/`scope`/过期任一处校验有洞就是越权读写。**P6 不可裁，必须独立 judge。**

## 八、部署侧要求（非本任务交付物）

列在这里是为了让运维有明确目标，**不构成开发前置条件**。开发与验证全部在回环完成。

| 要求 | 说明 |
|---|---|
| MCP 端点的公网 HTTPS 入口 | PRM 与 `/mcp` 需要能被外部客户端访问；AS 已由 PeekView 的公网入口提供 |
| `issuer` 与实际公网地址一致 | RFC 8414 要求 `issuer` 是公网 `https://` 地址且无 query/fragment。反代后要确保 AS 元数据里写的是外部地址而非 `127.0.0.1` |
| 反向代理透传 | 若 AS 在反代之后，需正确传 `X-Forwarded-Proto` / `Host`，否则元数据里的 endpoint 会指向内网地址 |
| `.well-known` 不被 SPA 或反代兜底 | 反代若有 catch-all rewrite，同样会吞掉元数据路径（与 G4 同构的问题） |

## 九、未验证断言

| # | 断言 | 状态 | 验证方式 |
|---|---|---|---|
| 1 | Node SDK `mcpAuthRouter` 的 DCR 默认限流是 20 次/小时 | **已读源码**（`register.js:22-27`），**未实测触发 429** | 高频注册观察 429 |
| 2 | Python 侧手写 AS 不需要额外依赖 | **部分验证**：`python-jose` 已在 `pyproject.toml:36`，venv 内 `jose.jwe` 可用；但授权码/客户端存储的选型未定 | P2 定选型后验 |
| 3 | `get_current_user` 改造后 `pv_` 路径完全不受影响 | **未验证**（只读了代码路径，没有构造双模式并存的测试） | P3 红灯：`pv_` key 全部既有用例保持绿 |
| 4 | 消费级平台会先探裸 `/.well-known/oauth-protected-resource` | **部分验证**：SDK 只按 resource path 生成变体，我实测裸路径 404；"客户端会探裸路径"是 RFC 推断 | 真实客户端接入时观察；v1 建议两个变体都注册 |
| 5 | Gemini / Claude.ai / ChatGPT 各自的具体要求 | **未验证**（仅外部二手资料；Gemini 有 "eligible users" 门槛、ChatGPT 需 developer mode + 付费档） | **不得把二手资料当契约**。P6 用等价模拟客户端验证协议正确性，真实平台接入另议 |
| 6 | 现有 MCP 测试里"拒绝非 `pv_` token"这条在双模式下如何改写 | **未定**（`server.test.ts:113-120` 断言错误信息含 `pv_`） | P1 明确新语义 |

## 十、环境与验证策略

- 后端：`make debug`（`:8888`，数据隔离 `/tmp/peekview-debug/`），pytest 用 `backend/.venv`
- MCP：本地独立端口起，指向 debug backend，**绝不指向生产 `:13001`**
- AS 元数据与 PRM：`curl` 直接断言 JSON 字段，不用浏览器
- 授权码全流程：用脚本模拟客户端（生成 PKCE verifier/challenge → 取 code → 换 token → 调 `/mcp`），不依赖真实平台
- UI（授权页）：Playwright 实跑 + 截图，覆盖"未登录 → 登录 → 同意"与"已登录 → 直接同意"两条路径
- 生产 `:13001`、`~/.peekview/`、pipx 全程隔离

## 十一、交付倾向

- **risk = high**（首次对外签发第三方凭证 + 双产品 + 安全边界）
- **P2 不可简化**：需 `plan-eng-review`（backend 域强制）+ 安全专章（密钥、`aud`、scope、DCR 限流、授权码 TTL 五项各自成节）
- **P3 强制 TDD 红灯**，最少三组：①双模式并存（`pv_` 与 OAuth token 各自通过、互相不串）②PKCE 与授权码一次性 ③scope 拒绝（`docs:read` token 调写工具必须失败，且 MCP 工具列表里不该出现写工具）
- **P6 不可裁**，BDD 逐条实跑 + 授权页 Playwright 截图；judge 独立
- **P8 双产品 bump**，发布前需用户确认

## 十二、下一步

等用户「开工」进 P1。P1 需要收敛的分叉只有两个：

1. **决策 6：token 形态 A / B** —— 决定 MCP 侧要不要引验签依赖
2. **决策 5：AS 端点命名空间** —— 决定路由分区

其余七条决策 P0 已给立场，P1 若无异议即可直接转 BDD。另外 P1 要顺手把 `server.test.ts` 的认证测试契约改写方案定下来（见未验证断言 6）。
