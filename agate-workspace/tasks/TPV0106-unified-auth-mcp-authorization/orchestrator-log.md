# orchestrator-log — TPV0106

## 2026-11-29 P0

DECISION 立项范围来自用户提供的指令文件（370 行）。核心判断：这不是"重做 TPV0105"，而是范围更宽的体系建设。指令第一节明确"不要把它变成研究报告""不要直接实施开发"，第九节列出 8 项交付物。

DECISION 任务编号取 TPV0106。创建前已检查：现有任务无 OAuth/认证域重叠（TPV0105 已作废并标记 supersedes 关系），编号未占用。

DECISION risk=high。认证与授权域判定错误后果是越权访问，不是界面异常。

DECISION 阶段结构 S0–S5 而非 P0–P8 直接映射。理由：指令第六节要求"合理的阶段和工作包结构""不要机械设计成僵化瀑布"，同时要求"维护任务目标、范围和完成条件"。S0 现状确认强制先于 S1 设计——这是与旧方案最重要的区别（旧方案跳过现状直接定架构，导致与产品约束错位）。

DECISION 与旧 TPV0105 关系定为"取代不继承"。指令第八节逐条要求：明确作废、保留文档、不继承架构/组件/Token 设计/MCP 部署假设/Scope、可复用经重新验证的研究成果、吸收问题与遗漏。brief 第八节按此写成 8.1–8.5 五小节，其中 8.2 显式列出 5 项不继承、8.3 列出可复用项、8.4 列出 5 条已吸收的教训。

NEXT P0 完成，等用户「开工」进 P1。P1 第一动作是 S0 现状确认（独立复核 brief 第三节 A1–A13），不是设计。

## 本轮实测证据（全部带行号，S0 需独立复核）

| 项 | 位置 | 结论 |
|---|---|---|
| 三类凭证分流 | `auth.py:146-189` | 按"形状"判别（3 段 / `pv_` 前缀），无类型标识 |
| JWT 无 aud/iss | `auth.py:121-135` | 只验签名与 exp |
| cookie 分支无类型判别 | `auth.py:158-161` | 任意 token 塞 cookie 都会走 HS256 |
| 验证失败静默降级 | `auth.py:188` | 一律 return None，调用方无法区分"没带"与"无效" |
| pv_ 等同完整用户含 admin | `auth.py:181-189` + `require_admin` | 第三方接入只能给全权 |
| ApiKey 无 scope 字段 | `models.py:267-292` | — |
| 无 OAuth 表 | 生产 DB 16 张表实查（mode=ro） | — |
| scope 概念不存在 | `grep -c scope` 在 auth.py / api/_shared.py = 0 | — |
| HS256 密钥共用 | `auth.py:26-28` | 会话与第三方 Token 风险绑定 |
| /login 死路由 | `main.py:25` vs `router.ts` | 登录实为 LoginDialog 弹窗 |
| .well-known 被 SPA 吞 | `main.py:598` | 返回 200 text/html 而非 404 |
| **MCP 无 stdio 传输** | `server.ts:2,198` 只 import StreamableHTTPServerTransport；`grep StdioServerTransport` 零命中 | **指令要求的"本机 STDIO MCP"当前不存在** |
| MCP 转发客户端 token | `server.ts:104` + `client.ts:39` | 对所有下游构成 passthrough 形状 |

## 需要用户注意的一处范围张力

指令 3.2 要求"同时考虑本机 STDIO MCP"，但 A11 实测该传输当前不存在。brief 9.2 与 U3 已登记：S0/S1 需确认是"补 stdio 能力"还是"明确排除该场景"。这不是立项能裁决的，留给 S1。
