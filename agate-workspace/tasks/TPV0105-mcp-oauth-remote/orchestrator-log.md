# orchestrator-log — TPV0105

## 2026-11-28 P0

DECISION 立项：范围为「远程 MCP 接入 + OAuth 2.1」，来源用户提供的 entry kffgaj（PeekView 提案）。用户指令为「形成下一步的立项 task」，即只做 P0，不进入实现。

DECISION risk=high：本任务首次让 PeekView 对外签发可被第三方使用的凭证。token 校验若有洞即为越权读写。P6 不可裁、须独立 judge。

NEXT P0 完成，等用户「开工」进 P1。P1 首要裁决三条分歧（见 P0-brief「与提案的分歧」），尤其分歧 2：是否跳过提案 Phase 1 的「粘 pv_ key 换 JWE」快速路径，直接把 AS 落在 PeekView 后端。

## 证据索引（P0 阶段实测，全部现测非记忆）

| 项 | 命令/方法 | 结果 |
|---|---|---|
| MCP 无凭证 401 | `curl -D- -X POST :13003/mcp` | `401`，无 `WWW-Authenticate` |
| RFC 9728 缺失 | `curl :13003/.well-known/oauth-protected-resource` | `404` |
| RFC 9728（带 path）缺失 | `curl :13003/.well-known/oauth-protected-resource/mcp` | `404` |
| RFC 8414 缺失 | `curl :13003/.well-known/oauth-authorization-server` | `404` |
| 公网 .well-known 被 SPA 吞 | `curl https://s4.vide.cc:19093/.well-known/*` | `200 text/html`（非 404） |
| MCP 无公网入口 | `curl https://s4.vide.cc:13003/health` | `000`（连接失败） |
| SDK tsc 可行性 | 临时引入 `mcpAuthRouter` + `OAuthServerProvider` 后 `npx tsc --noEmit` | exit 0 |
| SDK 运行可行性 | 最小 express4 app 实跑 | resource-meta `200` / as-meta `200` / `/register` `201`；**裸 PRM 路径 `404`** |

> 上述临时探针文件已删除，未进入工作树（`git status` 已确认干净）。
