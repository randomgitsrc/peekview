---
phase: P0
task_id: TPV0105
task_name: mcp-oauth-remote
trace_id: TPV0105
created: 2026-11-28
status: pending-start
parent: 无
---

# P0-brief — TPV0105 远程 MCP 接入与 OAuth 2.1 认证

> 主 Agent 亲自填写（P0 产出）。

```yaml
task: "让消费级 AI 平台（Gemini / Claude / ChatGPT）无需手填静态 Header 即可直连 PeekView MCP"
known_risks:
  - "公网可达性未打通：:13003 公网不可达，且现有公网入口的 .well-known 被 SPA 吞成 HTML"
  - "原提案 Phase 1 的『粘 pv_ key 换 JWE』与其自称的目标（消除复制 key）自相矛盾"
  - "PeekView 无 scope 体系、无 OAuth 表、无撤销通道——三项都是新建子系统而非改造"
  - "授权页登录态跨 origin（:19093 与 MCP 入口）无法共享 Cookie，影响 AS 落点选择"
  - "双产品版本 bump + 安全边界变更，属高风险域"
env_constraints:
  debug_env: "make debug（127.0.0.1:8888，数据隔离 /tmp/peekview-debug/）"
  production: "生产 :13001 / ~/.peekview/ / pipx 全在域外，本任务不得触碰"
executor_env:
  platform: "DSH"
  has_task_tool: true
  has_local_runtime: true
  network: "受限（内网 + 公网 HTTPS 探测均可，但不能改生产反代）"
```

## 需求来源

用户提供 `https://s4.vide.cc:19093/kffgaj`（「PeekView 远程 MCP 接入与 OAuth 2.1 架构改进提案」）。核心诉求：**手机端 / 网页端对话里直接调用 PeekView**，而不是只在 Cursor/Cline 里手填 `Authorization: Bearer pv_xxx`。

提案分三阶段：Phase 1 在 MCP Server 内用 SDK 的 `mcpAuthRouter` 快速打通（授权页填 pv_ key → 换 JWE）；Phase 2 把 AS 迁进 PeekView 后端；Phase 3 生态复用。

## 与上一轮 DSH 迁移分析的接续

上一轮结论是「3 个本地 MCP 不迁 manager」，理由是**本场景无 OAuth**。这个前提现在被本提案改写了，但**只改写了一半**——必须分清两条路径：

| 路径 | 现状 | 提案落地后 |
|---|---|---|
| DSH 连**本机** `127.0.0.1:13003`，静态 `pv_` key | 正常 | **不变**，静态 key 双模式保留 |
| 消费级平台连**公网** OAuth 端点 | 不存在 | 新增，与 DSH 无关 |

**关键推论（源码直读，非推断）**：直连 `mcp-client` row **可以声明** `oauth`（`mcp-client/src/index.ts:102`），但**无法自行发起授权**——

> "Explicit authorization uses the **manager** with Authorization and WebServer services." — `packages/mcp/mcp-client/README.md:125`

直连 row 在无既有 grant 时只会停在 `waiting-authorization`（README:123），**没有入口触发浏览器流程**。⇒ **若将来 DSH 自己要连 OAuth 端点，那台 server 必须先迁到 `mcp-manager`。** 这正是上一轮报告「何时重新考虑迁移」里列的第一条触发条件。本任务**不改** DSH 侧任何配置。

另一条约束同样来自 README：**OAuth 与 `Authorization` header 不能并存**（README:123 与 `config.ts` 的 validate 拒绝规则）。所以 `mcp-peekview` 现在那段 `!!js` 内联读 key 的写法，一旦改走 OAuth 就必须整个删掉——不是叠加。

## 已实测的现状（本轮新证据）

全部在本机 `127.0.0.1:13003`（MCP v0.12.0）与公网 `https://s4.vide.cc:19093` 上现测：

| 探针 | 结果 | 含义 |
|---|---|---|
| `POST /mcp` 无凭证 | `401`，body `{"error":"Only PeekView API Key (pv_ prefix) is supported"}` | 拒绝路径存在，但**无 `WWW-Authenticate` 头**（`-D-` 逐行确认） |
| `/.well-known/oauth-protected-resource` | `404` | RFC 9728 缺失 |
| `/.well-known/oauth-protected-resource/mcp` | `404` | 同上（带 resource 路径变体也缺） |
| `/.well-known/oauth-authorization-server` | `404` | RFC 8414 缺失 |
| `GET /health` | `200`，`version: 0.12.0`，`public_url: https://s4.vide.cc:19093` | 配置已就位 |
| 公网 `:19093/.well-known/*` | `200 text/html`（SPA index.html） | **被 catch-all 吞掉**，不是 404 |
| 公网 `:19093/mcp` | `200 text/html` | 同上，MCP 不在这个入口 |
| 公网 `:13003/health` | 连接失败（`000`） | **MCP 当前完全没有公网入口** |

### SDK 能力已实证（不是纸面推断）

我在 `packages/mcp-server` 目录内用 `@modelcontextprotocol/sdk@1.29.0` 的 `mcpAuthRouter` 起了一个最小 express 4 app 实测：

```
/.well-known/oauth-protected-resource        => 404   ← 裸路径不通（见下方陷阱）
/.well-known/oauth-protected-resource/mcp    => 200   {"resource":"...","authorization_servers":[...],"scopes_supported":[...]}
/.well-known/oauth-authorization-server      => 200   {"issuer":...,"code_challenge_methods_supported":["S256"],...}
POST /register                               => 201   {"client_id":"test-0","redirect_uris":[...],...}
```

同时 `npx tsc --noEmit` 在引入 `mcpAuthRouter` + `OAuthServerProvider` 类型后**通过**（express 4.22.2 + `@types/express` 4.17.25；SDK 内嵌套 express 5.2.1 但类型解析无冲突）。

⇒ 提案「基于 SDK 内置 `mcpAuthRouter`」这条**技术可行性成立**，且不需要新建网关进程。

**⚠️ 实测陷阱**：裸 `/.well-known/oauth-protected-resource`（不带 resource 路径）**不会**被 `mcpAuthRouter` 注册——它按 `resourceServerUrl` 的 path 生成 `/.well-known/oauth-protected-resource/mcp`。部分客户端会按 RFC 9728 先探裸路径，需额外补一条默认路由。

## 与提案的分歧（P0 必须表态的三条）

### 分歧 1：公网可达性是**前置硬阻塞**，不是 Phase 1 的一部分

提案把重点全放在认证流程上，但实测显示：**MCP Server 根本没有任何公网入口**（`:13003` 外部不可达），且现有公网入口 `:19093` 是 PeekView 的 SPA，任意路径都返回 `index.html`。

⇒ 即使 OAuth 代码写得完全正确，客户端在 `https://<公网>/mcp` 拿到的仍是 HTML，发现流程第一步就断。**这一条必须先解决**，且它牵涉反代/端口/域名——属 DSH 铁律 5 的「修改 CI/CD 配置 / 生产部署脚本」邻近区，需用户明确授权与人工操作。

**本任务只产出「需要什么样的入口」的规格与验证脚本，不代为修改生产反代。**

### 分歧 2：Phase 1 的「粘 pv_ key 换 JWE」自我否定，建议直接做 AS 落位

提案 Phase 1 的授权页是「用户输入自己的 `pv_xxx`，服务端加密打包成 JWE 当 access_token」。

**这与提案自己列的头号痛点直接矛盾**——痛点原文是「普通用户需要手动前往后台创建、复制、粘贴 API Key，**在移动端体验极差**」。而 Phase 1 恰恰要求用户在手机浏览器里**再粘贴一次** pv_ key，只是从"粘到配置框"变成"粘到授权页"。它换掉了静态 Header，没换掉复制粘贴。

**采纳方向**：AS 直接落在**有登录态的一侧**。PeekView 已有完整账号体系 + JWT + `/login`（`main.py:25` `FRONTEND_ROUTES` 含 `login`）。授权页应是「已登录则一键同意 / 未登录则先登录」，**用户全程不接触 key**——这才是提案自称的目标。

代价：AS 必须在 PeekView 后端（原 Phase 2），MCP Server 退化为纯 RS。这与提案的 Phase 顺序相反，但总工作量**更小**（省掉整套 JWE 封装 + Phase 2 再拆一次）。

> **P1 需裁决**：是否接受「跳过 Phase 1 / JWE，直接做 AS-in-backend」。若用户坚持要 Phase 1 的快速路径，则需明确接受「仍要粘 key」并把它写进文档，不能宣称解决了痛点。

### 分歧 3：「MCP 层保持无状态」只对 access_token 成立，对 AS 不成立

提案写「Token 校验优先采用无状态 JWE/JWT，避免为 MCP 层引入额外的数据库或 Redis 依赖」。

无状态 token 校验成立；但 **DCR 必须有 client 存储**（`client_id` / `redirect_uris` / 注册时间），**授权码必须有短命存储**（PKCE `code_challenge` 要与 code 绑定）。这两项在提案里没有落点，而它们是 OAuth 2.1 的强制件。

⇒ 不能宣称「零新增存储」。**需明确**：client 记录与授权码存哪、存多久、如何清理。若 AS 落进 PeekView 后端（分歧 2 的方向），则天然有 SQLite + 迁移机制（`database.py:_run_migrations`），此项成本大幅下降——这也是分歧 2 的又一支撑理由。

## 范围裁剪倾向（P0 立场）

### 纳入

| 项 | 说明 |
|---|---|
| A. 公网入口规格 + 可验证脚本 | 只出规格与探针脚本，不动生产反代 |
| B. RS 侧改造 | `/.well-known/oauth-protected-resource`（含裸路径兜底）+ 401 带 `WWW-Authenticate` + 双模式中间件 |
| C. AS 最小实现 | `/authorize` + `/token` + `/register`(DCR) + `/.well-known/oauth-authorization-server`，PKCE S256 |
| D. Scope 最小集 | `docs:read` / `docs:write` 两级，映射到现有工具 |
| E. 授权页 UI | 复用 PeekView 登录态，一键同意 |
| F. 向后兼容 | `pv_` 静态 key 路径**行为不变**（现有测试契约 `error.toContain('pv_')` 必须继续绿） |

### 排除

| 项 | 理由 |
|---|---|
| 撤销管理页（"已授权应用"） | 需新表 + 新 UI + 新 API，独立子系统。**列为后续任务**，本任务只保证 token 可过期 |
| refresh_token | 先只发 access token（短有效期）；refresh 涉及轮换与重放检测，属安全敏感件，独立评估 |
| Phase 3 生态复用（浏览器插件 / VS Code / 移动 App） | 与 v1 无耦合 |
| 改 DSH 的 3 个 MCP 配置 | 本机静态 key 路径继续可用，无收益 |
| 改生产反代 / 部署脚本 | 铁律 5，需用户人工执行 |

## 已知风险

1. **双 origin 授权页登录态**：若 AS 在 PeekView 后端（`:19093`），授权页与 PeekView 同 origin，Cookie 天然可用——**这是选它的关键理由**。若 AS 留在 MCP Server（另一端口/域名），则跨 origin 无法共享 `peekview_token` Cookie，授权页将被迫要求用户重新登录或粘 key。
2. **PeekView 无 scope 体系**：`ApiKey` 模型（`models.py:267`）**无 scope 字段**；JWT payload 只有 `sub`/`exp`/`iat`（`auth.py:113`）。scope 只能靠 token 自带 claim + MCP 侧执行，**不落 DB**；一旦要落 DB 就是 schema 变更 + 权限模型改造，超出本任务。
3. **`/register` 命名冲突**：PeekView 已有 `POST /api/v1/auth/register`（用户注册，`api/auth.py:42`）。AS 的 DCR 端点若也叫 `/register` 且挂在根路径，与用户注册语义混淆；需明确路径分区。
4. **限流**：提案要求 DCR 防滥用。`express-rate-limit` 在当前 `packages/mcp-server` **不是直接依赖**（仅在 SDK 的嵌套树内），若自行限流需显式加依赖。SDK 文档称 `mcpAuthRouter` 默认对全部端点限流——**此项未实测**（见下）。
5. **双产品版本**：PeekView 后端与 MCP Server 都要 bump（当前 `0.28.0` / `0.12.0`），P8 需各自判定 minor/major。
6. **安全边界**：本任务首次让 PeekView 对外签发第三方可用的凭证，一旦 token 校验有洞即为越权读写。属**高风险域**，P6 不可裁、必须独立 judge。

## 未验证断言

| # | 断言 | 状态 | 验证方式 |
|---|---|---|---|
| 1 | `mcpAuthRouter` 默认对 `/register` 等端点启用限流 | **未验证**（仅 SDK 文档表述，未实测触发 429） | 构造高频注册请求观察 429 |
| 2 | 公网反代（`s4.vide.cc` → 本机）能否按路径分流到 `:13003` | **未验证**（本机无 nginx/caddy 配置可读，反代不在本机） | 需用户提供或人工确认反代归属 |
| 3 | SDK 1.29.0 的 `authorize` 处理器与既有 PeekView 登录态的对接成本 | **未验证**（只验了元数据路由与 DCR，`authorize` 用 stub 抛错） | 构造真实授权码流程 |
| 4 | 客户端是否会先探裸 `/.well-known/oauth-protected-resource` | **部分验证**（SDK 只注册带 path 变体，实测裸路径 404；但"客户端会探裸路径"是 RFC 推断） | 三家真实客户端接入时观察 |
| 5 | 三家平台（Gemini / Claude / ChatGPT）各自要求 | **未验证**（仅外部二手资料；Gemini 侧有 "eligible users" 限制、ChatGPT 需 developer mode + 付费档） | 立项后逐家实测；**不得把二手资料当契约** |

## 环境自检

按 `docs/process/env-check-protocol.md` 执行，P0 阶段已确认：
- 后端 venv / pytest 可用；前端 `node_modules` 可用；MCP `node_modules` 已安装
- `make debug`（`:8888`）隔离机制可用；生产 `:13001` 与本任务完全隔离
- 本任务新增依赖需显式声明（如自行限流），不得动用系统 Python

## 交付倾向

- **risk = high**（首次对外签发凭证 + 跨前后端 + 安全边界）
- P2 不可简化，需 `plan-eng-review`（backend 域强制）+ 安全专章
- P3 强制 TDD 红灯（token 校验 / PKCE / scope 拒绝三组必测）
- P6 不可裁，需真实客户端或等价模拟逐条实跑；judge 独立
- P8 双产品 bump，且**发布前需用户确认**

## 下一步

等用户「开工」指令进 P1。P1 首要任务是把上面三条分歧裁决掉——**尤其分歧 2（是否跳过 JWE 快速路径）**，它决定整个架构形态。
