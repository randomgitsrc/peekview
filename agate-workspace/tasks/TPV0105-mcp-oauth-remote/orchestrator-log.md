# orchestrator-log — TPV0105

## 2026-11-28 P0

DECISION 立项范围为「PeekView 全项目 OAuth 2.1 身份层」：PeekView 后端做 AS + RS，peekview-mcp 做 RS。依据用户澄清——OAuth 覆盖整个项目而非单个产品特性。

DECISION AS 落在 PeekView 后端而非 Node 侧：账号/密码/JWT/登录态/captcha 全部在 Python 后端，让 Node 当 AS 要复制身份体系；且授权页跨 origin 拿不到 peekview_token Cookie。推论：Node SDK 的 mcpAuthRouter 在本项目不可用（express 中间件），AS 端点为手写 FastAPI。

DECISION 公网可达性归入部署侧要求（P0-brief 第八节），不作为开发前置条件。开发与验证全部在回环完成——SDK 的 issuer 校验对 localhost/127.0.0.1 豁免 HTTPS（router.js:15），DSH mcp-client 同样允许 loopback HTTP（README:125）。

DECISION risk=high：首次让 PeekView 对外签发第三方可持有凭证，aud/scope/过期任一校验有洞即越权读写。P6 不可裁、须独立 judge。

NEXT P0 完成，等用户「开工」进 P1。P1 只需收敛两个分叉：决策 6（token 形态 A 不透明/HS256 反查 vs B RS256+JWKS 本地验签）、决策 5（AS 端点命名空间）。另需改写 server.test.ts:113-120 的认证测试契约。

## 证据索引（全部现测，非记忆）

| 项 | 方法 | 结果 |
|---|---|---|
| MCP 401 无 WWW-Authenticate | `curl -D- -X POST :13003/mcp` | `401`，响应头无该字段 |
| MCP PRM 缺失 | `curl :13003/.well-known/oauth-protected-resource[/mcp]` | 两个变体均 `404` |
| PeekView AS 元数据缺失 | `curl :13001/.well-known/oauth-authorization-server` | `404` |
| .well-known 被 SPA 吞 | `curl :19093/.well-known/*` | `200 text/html`（非 404） |
| 无 OAuth 表 | `grep oauth_client\|oauth_token models.py` | 0 命中 |
| 无 scope 概念 | `grep -c scope auth.py api/_shared.py` | 均 0 |
| JWT 不验 aud | 读 `auth.py:121-135` | 仅 HS256 + exp |
| /login 无前端路由 | `grep -c "path: '/login'" router.ts` | 0 |
| python-jose 可用 | venv 内 `from jose import jwe` | OK（3.5.0 + cryptography 49.0.0） |
| SDK issuer 豁免 loopback | 读 `router.js:15` | localhost/127.0.0.1 免 HTTPS |
| SDK DCR 限流默认值 | 读 `register.js:22-27` | 20 次/小时（未实测 429） |

## 前一轮的错误（已纠正）

初版 P0-brief 把「公网可达性」写成前置硬阻塞，并建议跳过提案 Phase 1 的 JWE 路径。用户指出三点：①公网可达性是部署需求而非开发功能前提 ②OAuth 覆盖整个项目（含 peekview 与 peekview-mcp）③不要引用外部链接、直接写正文。三处均已按修正重写——公网要求移入第八节部署侧，架构从「MCP Server 内做 AS」改为「PeekView 后端做 AS、MCP 为纯 RS」，全文不再引用来源链接。

## 2026-11-29 P0 修订（第 3 版）

DECISION 用户指令要求：OAuth 覆盖全项目（非单产品）；公网可达性归部署侧不阻塞开发；brief 必须自包含；必须经独立审查并迭代至通过。前两点已在第 2 版落地，本轮做第 3 版：重构 brief + 独立审查 + 按审查修订。

DECISION 并行派发 spec-researcher 查规范（MCP 2026-07-28 / RFC 9068 / RFC 8707 / 三平台官方文档），同时自行取证仓库。取证结论写进 brief 第十节 V1–V27。

NEXT 等 brief-reviewer-r2 复审结果；若 PASS 则提交，若 FAIL 则继续修订。

## 第 3 版的关键发现（主 Agent 自查 + 审查共同确认）

### 最重大的一个：Token Passthrough 禁令
规范原文（security-considerations，MUST）：
> "If the MCP server makes requests to upstream APIs ... The access token used at the upstream API
>  is a separate token, issued by the upstream authorization server. The MCP server MUST NOT pass
>  through the token it received from the MCP client."

现状：MCP 全部 6 个工具经 client.ts:33-41 把客户端 token 原样转给 PeekView API。
我上一版 brief 还写了「MCP token 调 API 必须 401」+「6 个工具都调 API」——两条同时成立会让所有工具失效。
本版新增第六节 + 决策 D11（RFC 8693 token exchange）解决。

### 其他阻断项（审查 B1–B6，均已修）
- B2 `/auth/me` 曾被错误允许做 OAuth 身份解析 → 改为 OAuth 路径完全不调用，MCP 本地验签取 claim
- B3 多 resource → 多 audience 漏洞 → 新增 3.2.1，只接受单 resource / aud 必须字符串 / 无 aud 拒绝
- B4 TTL 1h 与「无 refresh」自相矛盾 → 改 12h 并显式记录泄露窗口，给 A/B 两选项
- B5 路由清点 45 → 52（实测 openapi，逐模块对账 11 纳入 + 41 排除）
- B6 JWK to_dict() 不产出 kid/use（我上版误记）→ 修正 V8，新增 7.5 JWKS 端点与 kid 指纹轮换契约

### 我自己的两处过度断言（已纠正）
- 「Gemini 必须 DCR」→ Google 原文给了「或 Play Console 手填」的替代路径
- 「规范对 token 格式完全没有规定」→ 实际是以 RFC 9068 为示例/推荐

### 采纳的规范升级
- access token 采用 RFC 9068（typ: at+jwt + iss/exp/aud/sub/client_id/iat/jti），不自造 token_use
- 新增 9.1.1 记录 Gemini「不轮换 refresh」与 MCP「公共客户端 MUST 轮换」的真实冲突
