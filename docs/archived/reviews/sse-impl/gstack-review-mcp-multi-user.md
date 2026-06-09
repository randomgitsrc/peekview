# MCP 多用户认证 Spec 评审

> 评审框架：gstack review（Staff Engineer 视角为主，兼顾 /cso 安全官和 /plan-eng-review 工程经理）
> 日期：2026-05-20
> 评审对象：`docs/specs/spec-mcp-multi-user.md`
> 参考：后端实际实现（auth.py、main.py、exceptions.py）

---

## 一、设计目标评估

spec 想解决的问题是正确的：**单 MCP_TOKEN 无法区分用户身份，条目所有权混乱**。

选择的解法——**直接透传用户 API Key，MCP Server 不做独立认证，PeekView 是唯一认证中心**——在架构哲学上是正确的：

- 职责清晰：认证权威在 PeekView，不重复造轮子
- 配置简化：移除 MCP_TOKEN 和 PEEKVIEW_API_KEY，用户自带 Key
- 天然多用户：每个 session 持有各自 token，PeekView 自动处理权限

这是一个**有明确边界、实现路径清晰的好设计**。评审重点是发现细节问题，不是质疑方向。

---

## 二、问题清单

### 🔴 P0 — 阻塞：实现后功能错误

#### P0-1 错误码映射与后端实际格式不符

**spec 写的：**
```
| 401 | INVALID_API_KEY  | "认证失败：API Key 无效"   |
| 401 | EXPIRED_API_KEY  | "认证失败：API Key 已过期" |
| 401 | USER_DISABLED    | "认证失败：用户已被禁用"   |
```

**后端实际返回（main.py:151）：**
```json
{"error": {"code": "UNAUTHORIZED", "message": "Invalid or missing API key", "details": null}}
```

后端所有 401 统一返回 `code: "UNAUTHORIZED"`，不区分 Key 无效、过期、用户禁用。`INVALID_API_KEY` / `EXPIRED_API_KEY` / `USER_DISABLED` 这三个错误码在整个后端代码中根本不存在（exceptions.py 也没有）。

MCP Server 按 spec 实现后，`PeekViewApiError` 永远匹配不到这三个 code，用户始终看到 fallback 错误而非精准提示。

**决策分支（需要在实现前确认）：**

**方案 A（推荐）**：接受后端现实，MCP 只区分 401 vs 403，不细分原因：
```typescript
if (status === 401) return '认证失败：API Key 无效或已过期，请检查 PeekView API Key'
if (status === 403) return '权限不足'
```

**方案 B**：同时修改后端，在 apikey_service 里抛出细粒度错误（`INVALID_API_KEY` / `EXPIRED_API_KEY` / `USER_DISABLED`），让中间件透传这些 code。工作量更大，但用户体验更好。

---

#### P0-2 `/sse` 端点路径变更未体现在 spec 中

**spec 认证流程：**
```
客户端发送 Authorization: Bearer pv_xxx → GET /sse
```

**当前实现（server.ts）：** SSE 端点是 `/sse`。

**spec 变更后的 Claude Code 配置（用户使用流程）：**
```bash
claude mcp add peekview --transport sse https://peek.example.com/mcp \
  --header "Authorization: Bearer pv_abc123..."
```

URL 写的是 `/mcp`，但后端代码里是 `/sse`。这是路径命名的最终决策吗？如果要改成 `/mcp`，server.ts 需要同步修改；如果保留 `/sse`，用户使用流程里的命令就是错误的。

**影响：** 用户按文档操作，MCP 连接不上。

**Fix：** 统一为一个路径，并在 spec 和 server.ts 都明确写出，不留歧义。

---

### 🟠 P1 — 高优先级：会导致实现困难或行为不符预期

#### P1-1 `/auth/me` 验证 token 会产生额外 RTT，无超时保护

**现状：** SSE 连接时，MCP Server 调用 PeekView `/api/v1/auth/me` 验证 token。

**问题：**
- 每次 SSE 连接都有一次额外的 HTTP round-trip（`validateToken`）
- spec 没有写超时时间。如果 PeekView 慢响应（10s），用户 SSE 连接会挂起 10s
- 已实现的 `ping()` 有 3s timeout，但 `validateToken()` 的 spec 里没有提

**Fix：** `validateToken()` 加明确超时，建议 5s：
```typescript
async validateToken(token: string) {
  const res = await fetch(`${this.peekviewUrl}/api/v1/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),  // ← 明确写进 spec
  });
  ...
}
```

---

#### P1-2 `POST /messages` 不验证 sessionId 格式的后果未说明

**spec 写了：**
> POST handler 查找 session → 取出 token → 通过 AsyncLocalStorage 传递

**没写：** POST `/messages` 对无效/不存在 sessionId 的处理逻辑。

当前实现有 `validateUUID`，这个验证在新方案里要保留。spec 的 server.ts 变更描述里没有提到这一点，实现者可能在重写 POST handler 时漏掉它。

**Fix：** 在"POST /messages"流程里明确写出：
```
1. 取 sessionId → validateUUID → 无效则 400
2. sessions.get(sessionId) → 不存在则 404
3. sessionContext.run(...) → transport.handlePostMessage
```

---

#### P1-3 `ToolDefinition.handler` 签名变更影响面未完整列出

**spec 写：**
```typescript
handler: (args: unknown, context: SessionContext) => Promise<ToolResult>
```

但变更文件清单里写的是 `src/tools.ts`（不存在这个文件，实际是 `src/tools/` 目录下 4 个文件 + `index.ts`），且 `CallToolRequestSchema` handler 在 `server.ts` 里，不在 tools 文件里。

实现者可能漏掉：
- `server.ts` 的 `CallToolRequestSchema` handler 需要同步修改（从 AsyncLocalStorage 取 ctx 后传给 tool.handler）
- `createEntry.ts`、`getEntry.ts`、`listEntries.ts`、`deleteEntry.ts` 各自的 handler 签名都要变

**Fix：** 变更文件清单改为：
```
src/tools/createEntry.ts  — handler(args, context) 签名变更，用 context.userToken
src/tools/getEntry.ts     — 同上
src/tools/listEntries.ts  — 同上
src/tools/deleteEntry.ts  — 同上
src/tools/index.ts        — createTools() 不再需要 config（publicUrl 从哪来？见 P1-4）
src/server.ts             — CallToolRequestSchema handler 取 ctx 并传入 tool.handler
```

---

#### P1-4 `createEntry` 返回 URL 需要 `publicUrl`，但 context 里没有

**现状：** `createEntry` 用 `config.publicUrl` 拼返回 URL（这是上轮评审加的）。

**变更后：** `createTools` 签名变为 `createTools(client)`（不再传 config，因为不需要 apiKey），但 `createEntry.ts` 仍需要 `config.publicUrl` 来构建用户可访问 URL。

spec 的变更清单里没有说明 `publicUrl` 怎么传入，会导致实现者把它从 createEntry 里删掉或用硬编码。

**Fix：** 明确 `createTools` 签名保留 `config`（仅含 `publicUrl`）：
```typescript
// 可以只传需要的字段，不传完整 config
export function createTools(client: PeekViewClient, publicUrl: string): ToolDefinition[]
```
或保持 `createTools(client, config)` 签名不变，只是 config 里 `apiKey` / `mcpToken` 字段变为可选。

---

### 🟡 P2 — 中优先级：影响质量和完整性

#### P2-1 破坏性变更缺少版本号和迁移时间窗口

spec 写"不支持过渡期（新旧配置完全不兼容）"，但没有：
- 新版本号（应该是 v0.2.0，semver major bump？）
- 用户迁移的时间窗口建议
- 旧版本是否保留 tag（如 `v0.1.x-legacy`）

对于已有用户（哪怕只有几个），一次无过渡期的破坏性变更是比较重的冲击。建议至少：
- 打 `v0.1.x` tag 冻结旧版本
- README 顶部加 migration notice
- docker-compose.yml 加注释说明哪些变量被移除

#### P2-2 多 session 下的 token 验证缓存未考虑

同一用户多个 Claude Code 实例 → 多个 SSE session → 每次建连都调 `/auth/me`。

如果同一 token 在短时间内建立多个 session（如重连），会重复调用 `/auth/me`。这对单用户影响不大，但可以在注释里标注"无缓存，每次连接都验证"作为设计决策，而不是遗漏。

#### P2-3 `AsyncLocalStorage` 在 SSE 长连接中的行为需说明

spec 用 `AsyncLocalStorage` 在 POST handler 和 SDK tool handler 之间传递 context。这个机制基于 Node.js 异步上下文传播，通常在 HTTP 请求处理中工作良好。

**潜在问题：** SSE 是长连接，`transport.handlePostMessage` 内部可能有异步链路跨越多个 tick——需要确认 `sessionContext.run(ctx, () => transport.handlePostMessage(req, res))` 在整个异步调用链中 context 不会丢失。如果 SDK 内部有 `setImmediate` 或独立的 `Promise` 链，AsyncLocalStorage 的 context 可能会断。

建议在 `tests/server.test.ts` 里专门测试这一场景：POST → tool handler 能正确读到 sessionContext。

#### P2-4 health check 变为"纯 HTTP 连通性检查"是倒退

**当前 health check（已有实现）：** 调用 `client.ping()` 探测 PeekView 可达性，不可达时返回 503。

**spec 变更后：** "不带用户 token，直接 HTTP 连通性检查（不经过 PeekViewClient）"

这意味着 health check 不再探测 PeekView 是否健康，只检查 MCP Server 自身是否存活——相当于倒退到第一版的浅层 health check（之前评审里批评过的）。

**建议保留：** ping() 本身不需要 userToken（它调的是 /health 端点），spec 写的"不需要用户 token"和"不经过 PeekViewClient" 是两件事，不应该把后者也去掉。

---

## 三、整体评估

### 设计质量

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构方向 | 9/10 | 正确，职责清晰，不重复造轮子 |
| 细节完整性 | 6/10 | AsyncLocalStorage 方案描述清晰，但边界条件不足 |
| 后端契约准确性 | 5/10 | 错误码映射与实际后端不符（P0-1） |
| 实现可操作性 | 6/10 | 变更清单不完整，publicUrl 流向不明（P1-4） |
| 迁移考虑 | 5/10 | 破坏性变更无版本号和时间窗口 |

**综合：6.5/10**

### 最重要的三件事

1. **确认错误码映射策略（P0-1）**：是接受后端只有 `UNAUTHORIZED`，还是同步改后端增加细粒度错误码？这个决策影响 PeekViewApiError 的实现方式。

2. **统一 SSE 端点路径（P0-2）**：`/sse` 还是 `/mcp`？写进 spec，实现和文档同步。

3. **明确 `publicUrl` 的传递路径（P1-4）**：`createTools` 签名变更后，`createEntry` 如何拿到 publicUrl？不写清楚实现者会漏掉。

这三个问题解决后，spec 质量可以到 8/10，可以进入实现阶段。

---

*评审完成：2026-05-20*
