# SSE → Streamable HTTP 迁移完整方案

> 创建：2026-06-09
> 目标版本：MCP Server v0.8.0（minor bump，传输层变更但工具逻辑不变）
> 优先级：🔴 立即（SSE 已废弃，客户端支持持续退化，2026 年中多平台移除）
> 关联：docs/roadmap/improvement-backlog.md #1

---

## 一、背景

### 为什么必须迁移

MCP 规范 2025-03-26 引入 Streamable HTTP，同时将 HTTP+SSE（2024-11-05）标记为 deprecated。截至 2026 年：

- Streamable HTTP 是官方推荐的唯一有未来的远程传输
- SSE 客户端支持持续退化，多个平台 2026 年中移除 SSE 端点
- 新 Agent 客户端（Codex 等）优先支持 Streamable HTTP

PeekView MCP 当前用 SSE，用户的多 Agent 环境（Claude Code / OpenCode / Codex / Hermes / OpenClaw）中越新的客户端越可能无法连接。

### SSE 的固有缺陷（迁移同时解决）

| 缺陷 | Streamable HTTP 如何解决 |
|------|--------------------------|
| 双端点（/sse + /messages）配对复杂 | 单端点 /mcp |
| 长连接脆弱（代理超时断连）| 按需开流，普通 HTTP 请求 |
| sessionId 手工管理（历次 P0 来源）| SDK 用 mcp-session-id 头自动管理 |
| 有状态无法水平扩展 | 支持 stateless / 会话可恢复 |

---

## 二、影响域分析

### 2.1 需要改动的

| 组件 | 改动 | 风险 |
|------|------|------|
| `package.json` | SDK 1.4.0 → ≥1.10.0（StreamableHTTPServerTransport 所需） | SDK 升级可能有 breaking change |
| `src/server.ts` | SSE transport → StreamableHTTP transport | 核心改动 |
| `tests/server.test.ts` | SSE 端点测试 → /mcp 端点测试 | 测试重写 |
| `tests/e2e/mcp-e2e.test.ts` | E2E 连接方式更新 | — |
| `tests/integration/mcp-integration.test.ts` | 集成测试连接更新 | — |
| README / 文档 | 客户端配置示例（url 从 /sse 改 /mcp，transport 类型）| — |
| `.mcp.json` 示例 | transport 配置更新 | — |

### 2.2 不需要改动的（关键：降低迁移风险）

| 组件 | 为什么不动 |
|------|-----------|
| `src/tools/*.ts` | 工具逻辑与传输无关 |
| `src/client.ts` | PeekView API 调用逻辑不变 |
| `src/config.ts` / config 系统 | 配置不变（端口、mode、allowedPaths 等）|
| 认证逻辑（pv_ 前缀 + validateToken） | 认证模型不变，只是触发时机调整 |
| AsyncLocalStorage 上下文传递 | 机制不变 |
| 双模式（local/remote）| 与传输正交，不受影响 |

**核心判断：这是传输层替换，不是协议重写。工具逻辑、认证模型、双模式全部复用。**

### 2.3 兼容性策略

**决策：直接切换，不保留 SSE 双跑。**

理由：
- PeekView 是自托管，用户可控制 MCP Server 和客户端版本同步升级
- 双跑（同时挂 /sse 和 /mcp）增加维护复杂度和测试矩阵
- SSE 反正要废弃，双跑只是推迟问题

例外：如果用户反馈有客户端只支持 SSE，再考虑加回兼容端点（SDK 支持同一 server 绑定多 transport）。

⚠️ **Breaking Change**：v0.8.0 升级后，用户现有 Claude Code 配置需要手动更新：
```bash
# 旧配置（v0.7.x）
claude mcp add peekview -t sse http://localhost:33333/sse --header "Authorization: Bearer pv_xxx"

# 新配置（v0.8.0+）
claude mcp add peekview -t http http://localhost:33333/mcp --header "Authorization: Bearer pv_xxx"
```

### 2.4 Session 扩展性限制

⚠️ **当前实现仍为单进程内存 session**：
- `sessions` 是内存 Map，与 SSE 模式相同
- Streamable HTTP 规范支持 stateless 模式，但当前实现使用 stateful（session-id）
- 如果用户用 pm2/cluster 启动多个进程，session **不共享**
- 水平扩展需要后续引入 Redis/共享存储（backlog #future）

---

## 三、设计

### 3.1 端点变更

```
旧（SSE）：
  GET  /sse       建立长连接 + 认证
  POST /messages?sessionId=xxx   发请求

新（Streamable HTTP）：
  POST /mcp       发请求（initialize 时建会话，之后带 mcp-session-id 头）
  GET  /mcp       SSE 流（服务器推送通知，可选）
  DELETE /mcp     终止会话
```

### 3.2 认证模型适配

SSE 模式认证在 `GET /sse` 建立连接时做。Streamable HTTP 没有独立的连接建立步骤，认证改在 **initialize 请求**时做。

```typescript
// 认证逻辑（保留 pv_ 前缀检查 + validateToken）
async function authenticate(req: express.Request): Promise<
  { ok: true; userId: number; username: string; userToken: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.authorization?.replace('Bearer ', '') ?? '';
  if (!authHeader.startsWith('pv_')) {
    return { ok: false, status: 401, error: 'Only PeekView API Key (pv_ prefix) is supported' };
  }
  try {
    const userInfo = await client.validateToken(authHeader);
    if (!userInfo) return { ok: false, status: 401, error: 'Invalid or expired API Key' };
    return { ok: true, userId: userInfo.id, username: userInfo.username, userToken: authHeader };
  } catch {
    return { ok: false, status: 503, error: 'PeekView unreachable, please try again later' };
  }
}
```

### 3.3 会话与 transport 管理

**沿用现有低层 `Server`（不引入 McpServer）+ stateful 模式 + enableJsonResponse。**

设计要点（详见自评审 gstack-review-sse-migration.md）：
- **低层 Server**：现有 `createMCPServer(tools)` 用 `Server` + `setRequestHandler`，保持不变，只改外层 transport
- **enableJsonResponse: true**：PeekView 工具都是请求-响应式，无服务器主动推送，用 JSON 响应替代 SSE 流，更简单、对代理更友好。初版不实现 GET /mcp 流（将来加 progress notification 时再启用）
- **stateful 模式**：`sessionIdGenerator` 设值，认证在 initialize 时做一次，userToken 绑定到 session，后续工具调用复用（避免每次调用都 validateToken）

```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';

// sessionId → { transport, server, ctx, lastActivity }
const sessions = new Map<string, {
  transport: StreamableHTTPServerTransport;
  server: Server;
  ctx: SessionContext;
  lastActivity: number;
}>();

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // 已有会话：复用 transport
  if (sessionId && sessions.has(sessionId)) {
    const entry = sessions.get(sessionId)!;
    entry.lastActivity = Date.now();
    return sessionContext.run(entry.ctx, () =>
      entry.transport.handleRequest(req, res, req.body)
    );
  }

  // 新会话：必须是 initialize 请求
  if (!sessionId && isInitializeRequest(req.body)) {
    const auth = await authenticate(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const ctx: SessionContext = {
      userToken: auth.userToken,
      userId: auth.userId,
      username: auth.username,
    };

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,   // 请求-响应式，无需 SSE 流
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, server, ctx, lastActivity: Date.now() });
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    // 沿用现有低层 Server（createMCPServer 不变）
    const server = createMCPServer(tools);
    await server.connect(transport);

    return sessionContext.run(ctx, () =>
      transport.handleRequest(req, res, req.body)
    );
  }

  res.status(400).json({ error: 'No valid session or not an initialize request' });
});

// DELETE /mcp — 会话终止
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const entry = sessions.get(sessionId)!;
    await entry.transport.handleRequest(req, res);
    sessions.delete(sessionId);
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// 注意：初版不实现 GET /mcp（无服务器推送需求）。
// 将来加 progress notification（backlog #11）时再启用 GET 流并去掉 enableJsonResponse。

// session 空闲超时清理（防止客户端异常断开导致泄漏）
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000;  // 30 分钟
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.lastActivity > SESSION_IDLE_TIMEOUT) {
      entry.transport.close?.();
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);  // 每 5 分钟检查
```

### 3.4 关键设计点

**a) 沿用低层 Server，每会话一个 Server 实例**

 现有 `createMCPServer(tools)` 用低层 `Server` + `setRequestHandler`（不是高层 McpServer），保持不变。每个会话 initialize 时调一次 `createMCPServer(tools)`——`tools` 是共享引用，Server 实例本身轻量，开销可接受。这样每会话隔离干净，与 per-session ctx 配合自然。

**b) stateful 模式，认证一次复用**

 `sessionIdGenerator` 设值（stateful）。认证在 initialize 时做一次（pv_ 前缀 + validateToken），userToken 绑定到 session。后续工具调用复用，不重复 validateToken（避免每次调用多一次 PeekView 往返）。这符合"多 Agent 共享、每 Agent 一会话"场景。

**c) AsyncLocalStorage 保留**

 多用户隔离依然靠 AsyncLocalStorage 传递 ctx。`handleRequest` 包在 `sessionContext.run(ctx, ...)` 里，工具 handler 通过 `getStore()` 拿到正确的用户 token。这个机制不变。

**d) express.json() 中间件**

 Streamable HTTP 需要解析 JSON body（`req.body`），必须加 `app.use(express.json())`。

**e) Host/Origin 头校验（安全）**

 MCP 2025-11-25 规范 MUST 要求校验 Origin 头防 DNS rebinding。默认放行 localhost / 127.0.0.1 / 配置的 corsOrigins，其他拒绝。复用现有 corsOrigins 配置，不另起一套 origin 逻辑。

**f) HTTPS 必须 + session-id 安全说明** (见 2.3)

### 3.5 Express 中间件顺序

```
1. CORS (处理 OPTIONS 预检)
2. express.json() (解析 JSON body)
3. logger (可选)
4. 路由 (/mcp, /health)
```

 ⚠️ **生产环境必须使用 HTTPS**。Streamable HTTP 使用 session-id 识别会话：
 - session-id 使用 `randomUUID()` 生成，熵足够
 - 传输层必须 HTTPS，防止 session-id 在传输中被截获
 - session 默认 30 分钟超时，超时后自动失效
 - 建议在反向代理层配置 TLS，不要裸 HTTP 暴露公网

---

## 四、实施计划

### Step 1：升级 SDK（作为独立 gate）

**先只升级 SDK，不改任何代码**，跑现有全部测试（还是 SSE 的）：
```bash
cd packages/mcp-server
npm install @modelcontextprotocol/sdk@latest   # 确认 ≥1.10.0
make test-mcp-unit   # 现有 SSE 测试必须全过
```

如果现有测试在新 SDK 上挂了 → SDK 1.4→1.10+ 有 breaking change（types 导出、Server 构造签名等），**先处理这些兼容问题再继续**。把"SDK 升级"和"传输迁移"两个变更解耦，便于定位问题。

只有现有测试全过，才进入 Step 2。

#### Step 1 失败决策树

如果升级 SDK 后现有测试失败，按以下顺序排查：

1. **types 导出路径变化** → 批量替换 import 语句
2. **Server 构造签名变化** → 调整 `createMCPServer` 参数
3. **SSE transport API 变化** → 先修 SSE 兼容再继续迁移（临时保留 SSE）
4. **breaking change 过大（>1 天工作量）** → 拆分为独立 PR，不阻塞迁移

> 注：本次迁移实测 SDK 1.4→1.29.0 无 breaking change（见 commit dc4390b5），上述决策树作为未来参考。

### Step 2：重写 server.ts 传输层
- 移除 `SSEServerTransport` import，加 `StreamableHTTPServerTransport`
- 移除 `/sse` 和 `/messages` 端点
- 加 `/mcp` 的 POST/GET/DELETE 处理
- 加 `express.json()` 中间件
- 加 Origin 头校验
- 抽出 `authenticate()` 函数（复用 pv_ + validateToken 逻辑）
- 保留 AsyncLocalStorage 和 sessionContext
- `createMCPServer` 改为可被每会话调用

### Step 3：CORS 更新
- `allowedHeaders` 加 `mcp-session-id`（客户端会发这个头）
- `exposedHeaders` 加 `mcp-session-id`（客户端要读这个头）
- methods 加 `DELETE`

### Step 4：更新测试（见第五节）

### Step 5：更新文档和配置示例
- README：客户端配置从 `{"type":"sse","url":".../sse"}` 改为 `{"type":"http","url":".../mcp"}`
- `.mcp.json` 示例同步
- CHANGELOG 标注 Breaking Change

### Step 6：版本 bump
- MCP Server v0.7.3 → v0.8.0

---

## 五、测试计划

### 5.1 单元测试（server.test.ts 重写）

| 用例 | 验证 |
|------|------|
| POST /mcp initialize + 有效 pv_ token | 返回 200 + mcp-session-id 头 |
| POST /mcp initialize + 无 pv_ 前缀 | 401 |
| POST /mcp initialize + JWT token | 401（拒绝 JWT）|
| POST /mcp initialize + PeekView 不可达 | 503 |
| POST /mcp 带有效 session-id 调工具 | 工具执行，返回结果 |
| POST /mcp 带未知 session-id | 400（非 initialize 且无 session）|
| DELETE /mcp 带有效 session-id | session 删除 |
| DELETE /mcp 带未知 session-id | 404 |
| Origin 头非法 | 拒绝（DNS rebinding 防护）|
| session 空闲超时 | 超时后自动清理 |
| local/remote 模式工具列表 | local 无 create_entry，remote 无 publish_files（不受传输影响）|

> 注：enableJsonResponse 模式下不实现 GET /mcp SSE 流，无需 GET 流测试。

### 5.2 多用户隔离测试（关键回归）

| 用例 | 验证 |
|------|------|
| 两个 session 用不同 token | 各自 ctx 隔离，token 不串 |
| AsyncLocalStorage 在 handleRequest 异步链中传播 | 工具 handler 拿到正确 ctx |

### 5.3 集成测试（mcp-integration.test.ts）

- 真实 StreamableHTTP 连接 + initialize + 工具调用全链路
- 用 SDK 的 StreamableHTTPClientTransport 作为客户端验证

### 5.4 E2E（mcp-e2e.test.ts）

- 模拟真实 Agent 连接：initialize → list_tools → call_tool → 结果
- 验证 mcp-session-id 头的完整生命周期

### 5.5 回归测试（必须全过）

- **关键验证：tools.test.ts 和 publishFiles.test.ts 一个字符都不用改就全过**。如果这两个需要改，说明迁移泄漏到了工具层，违背"工具逻辑零改动"的设计目标，要回头检查。
- config 系统测试不受影响
- health check 测试（/health 端点不变）

### 5.6 验证命令
```bash
make build-mcp && make test-mcp-unit
make test-mcp           # 含集成
```

---

## 六、回滚方案

如果迁移后发现客户端兼容问题：
- SDK 支持同一 server 同时绑定 SSE 和 StreamableHTTP transport
- 可临时加回 `/sse` + `/messages` 端点（backwards-compatible 模式），与 `/mcp` 并存
- 给客户端宽限期后再移除 SSE

代码层面保留 git tag `mcp-v0.7.3`，紧急时可回退。

---

## 七、风险评估

| 风险 | 等级 | 缓解 |
|------|------|------|
| SDK 1.4→1.10+ 有 breaking change | 中 | Step 1 先升级跑现有测试，确认兼容再继续 |
| 客户端只支持 SSE | 低 | 保留回滚方案，可双跑 |
| AsyncLocalStorage 在新 transport 异步链断裂 | 中 | 5.2 专项测试验证 |
| Origin 校验误拦合法请求 | 低 | 默认放行 localhost + 配置 allowlist |
| 多会话内存泄漏（session 不清理）| 中 | onclose/DELETE 清理 + 测试验证 |

---

## 八、验收标准

- [ ] SDK 升级到 ≥1.10.0，现有测试全过
- [ ] /mcp 端点支持 POST/GET/DELETE
- [ ] 认证保留：pv_ 前缀 + validateToken，JWT 拒绝
- [ ] 多用户隔离：AsyncLocalStorage ctx 不串
- [ ] 双模式工具列表不受传输影响
- [ ] Origin 头校验防 DNS rebinding
- [ ] session 正确清理（onclose/DELETE）
- [ ] 所有现有工具/config/health 测试通过（回归）
- [ ] README + .mcp.json 配置示例更新
- [ ] CHANGELOG 标注 Breaking Change
- [ ] 版本 bump 到 v0.8.0

---

*方案创建：2026-06-09*
