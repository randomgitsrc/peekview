---
phase: P1
task_id: T008
parent: P0-brief.md
trace_id: T008-P1-20260614
---

# P1 需求基线 — T008 MCP 无状态模式重构

## 1. 需求复述

MCP Server 目前使用有状态 Streamable HTTP（session Map + 30分钟 idle timeout）。opencode 长开实例超过 30 分钟不用 MCP 工具后，session 被服务端清理，下次调用返回 404。opencode/SDK 均未实现 MCP 规范要求的 404 re-initialize，导致唯一恢复方式是重启 opencode。

改为无状态模式：`sessionIdGenerator: undefined`，每次请求独立认证，无 session 概念，彻底消除此问题。

## 2. 隐含需求识别

- **认证时机变化**：现在只在 initialize 时认证一次，之后 session 里有缓存的 userToken。无状态后每次请求都要认证——`authenticate()` 函数保留，但移到每次 POST 请求的入口处调用
- **AsyncLocalStorage 上下文传递**：`sessionContext.run(ctx, ...)` 仍然需要，但 ctx 来自当次请求的认证结果而非 session 缓存
- **DELETE /mcp 的处理**：无状态下没有 session 可删。某些客户端（如 Claude Desktop）在断开时会发 DELETE，必须返回 200/204 而不是 404，否则客户端可能误以为出错
- **sessions Map 和 cleanup timer 全部删除**：约 80 行代码，删比改好
- **MCP 版本 bump**：这是 server 行为变更，需要 bump MCP server 版本（v0.8.5 → v0.8.6）
- **无状态对 tool 功能无影响**：所有 tool（create_entry/publish_files/get_entry/list_entries/delete_entry）本来就是无状态的，每次独立调用 PeekView 后端 API

## 3. BDD 验收条件

**AC1：基本工具调用不受 session 影响**
```
Given MCP Server 以无状态模式启动
When  客户端发送 initialize 请求
Then  服务端不返回 mcp-session-id header
      响应包含正常的 initialize result
```

**AC2：工具调用每次独立认证**
```
Given 有效 API Key
When  直接发送 tool call 请求（不需要先 initialize）
Then  认证通过，工具正常执行，返回结果
```

**AC3：无效 API Key 每次都被拒绝**
```
Given 无效或缺失的 API Key
When  发送任意 MCP 请求
Then  返回 401，包含明确错误信息
```

**AC4：长时间不用后工具调用仍正常**
```
Given 客户端在 initialize 后超过 30 分钟不发请求
When  客户端再次发送 tool call
Then  请求正常处理（不会因 session 过期而报 404）
```

**AC5：DELETE /mcp 优雅处理**
```
Given 客户端发送 DELETE /mcp（无论带不带 mcp-session-id）
When  服务端处理请求
Then  返回 200 { ok: true }（不返回 404）
```

**AC6：服务端重启对客户端透明**
```
Given 服务端重启后
When  客户端立即发送 tool call（带旧的 session-id header）
Then  请求正常处理（无状态下 session-id header 被忽略）
```

**AC7：PeekView 不可达时返回 503**
```
Given PeekView 后端不可达
When  客户端发送 MCP 请求
Then  返回 503，提示 PeekView 不可达
```

## 4. 裁剪说明

```
phases: [P1, P2, P3, P4, P5, P8]
```

- 跳过 P6：无 UI 变化，验收条件通过测试覆盖即可
- 跳过 P7：单包改动，一致性检查不需要专项阶段
- P8 必须：涉及 npm 发布（MCP server v0.8.6）

## 5. 范围声明

```yaml
packages: [mcp-server]
domains: [mcp]
ui_affected: false
gate_commands:
  P5: "cd packages/mcp-server && npm test"
```

## 6. 能力需求声明

```yaml
capability_requirements: []
```
