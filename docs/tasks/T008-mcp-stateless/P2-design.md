---
phase: P2
task_id: T008
parent: P1-requirements.md
trace_id: T008-P2-20260614
---

# P2 方案设计 — T008 MCP 无状态模式重构

## 声明字段

```yaml
packages: [mcp-server]
domains: [mcp]
ui_affected: false
gate_commands:
  P5: "cd packages/mcp-server && npm test"
env_constraints:
  debug_env: "make debug（:8888）；MCP测试用临时HOME"
```

---

## 核心改动：server.ts

### 删除的内容（约 80 行）

```typescript
// 删除：
const sessions = new Map<string, SessionInfo>();
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupStarted = false;
function startSessionCleanup() { ... }          // 整个函数删除
startSessionCleanup();                           // 调用删除
```

### POST /mcp 新逻辑

**之前**：
1. 有 sessionId + sessions 里有 → 复用 transport，跳过认证
2. 无 sessionId + isInitializeRequest → 认证，创建 transport，存 session
3. 有 sessionId + sessions 里没有 → 404
4. 无 sessionId + 非 initialize → 400

**之后**（无状态，每次请求独立）：
1. 认证（每次都做）→ 失败返回 401/503
2. 创建临时 transport（`sessionIdGenerator: undefined`）
3. 连接临时 server，处理请求
4. transport 用完即弃（无状态下无 SSE 流，GC 自动回收）

```typescript
app.post('/mcp', async (req, res) => {
  // Origin check（保留）
  const origin = req.headers.origin;
  if (!isValidOrigin(origin, corsOrigins)) {
    res.status(403).json({ error: 'Invalid Origin header' });
    return;
  }

  // 每次请求认证
  const auth = await authenticate(req, client);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const ctx: SessionContext = {
    userToken: auth.userToken,
    userId: auth.userId,
    username: auth.username,
  };

  // 无状态 transport：不分配 session ID
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = createMCPServer(tools);
  await server.connect(transport);

  await sessionContext.run(ctx, () =>
    transport.handleRequest(req, res, req.body)
  );
});
```

### DELETE /mcp 新逻辑

无状态下没有 session 可删，直接返回 200：

```typescript
app.delete('/mcp', async (_req, res) => {
  // 无状态模式：无 session 概念，直接确认
  res.status(200).json({ ok: true });
});
```

### types.ts 清理

删除 `SessionInfo` interface（含 transport/server/lastActivity 字段）。
`SessionContext` 保留（userToken/userId/username，每次请求临时使用）。

---

## 影响域

| 文件 | 改动 | 方向 |
|------|------|------|
| `packages/mcp-server/src/server.ts` | 删 sessions/cleanup，改 POST/DELETE 逻辑 | 删 ~80 行，改 ~40 行 |
| `packages/mcp-server/src/types.ts` | 删 SessionInfo interface | 删 ~8 行 |
| `packages/mcp-server/tests/server.test.ts` | 更新 session 相关测试用例 | 改 ~40 行 |
| `packages/mcp-server/package.json` | v0.8.5 → v0.8.6 | P8 bump |

**不改动**：tools/、client.ts、config.ts、index.ts、CLI

---

## 关键设计决策

**每次请求都创建新 transport 对象，性能可接受吗？**

是的。无状态 Streamable HTTP 下：
- 无 SSE 长连接流
- transport 对象轻量（无持久状态）
- 每个请求完成后 GC 回收
- 开销远小于每次调用 PeekView API 的网络延迟

**认证每次都做 bcrypt compare，性能可接受吗？**

当前 `authenticate()` 调用 `client.validateToken()`，这是一次 HTTP 请求到 PeekView 后端做 API key 验证（bcrypt compare 在后端）。这在有状态模式下也是初始化时做一次的，现在改为每次做——增加了每次调用的延迟，但绝对值极小（通常 <5ms 本地），可接受。

**mcp-session-id header 怎么处理？**

无状态模式下 SDK 不会在响应里设置 `mcp-session-id`。客户端若带着旧的 session-id header 发请求，服务端忽略它（SDK 层面处理），正常响应。

---

## 测试用例调整（P3 需同步）

**删除的测试**（对应有状态行为，无状态下不再适用）：
- `should return mcp-session-id on initialize`
- `should reject non-initialize request without session-id`
- `should return 404 for request with unknown session-id`
- `should return 404 for non-existent session` (DELETE)
- `should terminate a valid session via DELETE`

**新增/修改的测试**：
- `should handle request without session-id header` → 直接工具调用也能工作
- `should return 200 on DELETE /mcp regardless of session-id`
- `should authenticate on every request`
- `should handle second request independently (no session reuse)`
