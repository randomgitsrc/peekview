# MCP Server 多用户认证设计

## 背景

当前 MCP Server 使用单一 `MCP_TOKEN` 认证，所有客户端共享同一个身份（通过 `PEEKVIEW_API_KEY` 绑定）。无法区分不同用户，创建的条目都属于同一个人。

## 设计目标

- 不同 Claude Code 客户端以各自用户身份连接 MCP Server
- 条目归属创建者，私有条目只有创建者可见
- MCP Server 不做认证判断，PeekView 是唯一认证中心
- 配置简单，长期有效

## 认证架构

```
用户甲 (Claude Code)              用户乙 (Claude Code)
    │                                 │
    │ Bearer: pv_甲的apikey           │ Bearer: pv_乙的apikey
    ▼                                 ▼
┌──────────────────────────────────────────┐
│          MCP Server (远程)               │
│                                          │
│  1. SSE 连接时验证 token（调 PeekView） │
│  2. 验证通过 → 建立 SSE session          │
│  3. token + userId 存入 session          │
│  4. tool handler 通过 AsyncLocalStorage │
│     获取当前 session 的 token            │
│  5. 调用 PeekView 时透传 token          │
│                                          │
│  验证失败 → 401 拒绝连接                │
└──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│          PeekView (认证中心)              │
│                                          │
│  pv_xxx → HMAC-SHA256 验证 → 用户甲     │
│  无效    → 401 拒绝                      │
│  过期    → 401 拒绝                      │
│  用户禁用 → 401 拒绝                     │
└──────────────────────────────────────────┘
```

## 变更内容

### 移除的配置

| 变量 | 原用途 | 移除原因 |
|------|--------|---------|
| `MCP_TOKEN` | 连接级共享密码 | 不再需要，用户自带 API Key |
| `PEEKVIEW_API_KEY` | 服务级 API Key | 不再需要，每个用户自带 Key |

### 新增的配置

无新增。配置更简化：

```bash
PEEKVIEW_URL=http://peekview:8080          # PeekView 内部地址
PEEKVIEW_PUBLIC_URL=https://peek.example.com # 用户可见地址
MCP_PORT=33333
MCP_HOST=0.0.0.0
MCP_CORS_ORIGINS=*
LOG_LEVEL=info
```

### 认证流程

**SSE 连接（GET /sse）：**
1. 客户端发送 `Authorization: Bearer pv_xxx`
2. MCP Server 调用 PeekView `/api/v1/auth/me` 验证 token（5s 超时）
3. 验证通过 → 建立 SSE session，存入 token + userId + username
4. 验证失败 → 401 拒绝连接
5. 不再支持 query parameter 传 token（防止泄露到日志）

**POST /messages：**
1. 取 sessionId → validateUUID → 无效则 400
2. sessions.get(sessionId) → 不存在则 404
3. sessionContext.run(ctx, ...) → transport.handlePostMessage
4. Claude Code 的 SSE 客户端不会在 POST 请求上发送 Authorization header
5. 认证完全通过 sessionId 查找 session 中的 token

**业务调用（tool handler）：**
1. AsyncLocalStorage 提供当前请求的 token
2. tool handler 从 AsyncLocalStorage 获取 token
3. 调用 PeekView API 时带上 `Authorization: Bearer pv_xxx`
4. 如果 PeekView 返回 401，返回结构化错误信息给客户端

**Health check（GET /health）：**
- 不带用户 token，但仍通过 PeekViewClient.ping() 探测 PeekView 可达性
- ping() 不需要 auth，调用 PeekView /health 端点

### Token 传递机制（AsyncLocalStorage）

SDK 的 `Server` 实例是所有 session 共享的，`CallToolRequestSchema` handler 只收到 JSON-RPC request，没有 session 上下文。用 `AsyncLocalStorage` 解决：

```typescript
import { AsyncLocalStorage } from 'async_hooks';

const sessionContext = new AsyncLocalStorage<SessionContext>();

interface SessionContext {
  userToken: string;   // pv_xxx API Key
  userId: number;      // PeekView 用户 ID
  username: string;    // PeekView 用户名
}
```

**Express middleware → SDK handler 链路：**

```typescript
// POST /messages handler
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const sessionInfo = sessions.get(sessionId);
  if (!sessionInfo) return res.status(404).json({ error: 'Session not found' });

  // 在 AsyncLocalStorage 上下文中调用 SDK handler
  sessionContext.run(
    { userToken: sessionInfo.userToken, userId: sessionInfo.userId, username: sessionInfo.username },
    () => transport.handlePostMessage(req, res)
  );
});

// CallToolRequestSchema handler 中读取
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const ctx = sessionContext.getStore();
  // ctx.userToken → 传给 PeekViewClient
});
```

### Session 存储

```typescript
interface SessionInfo {
  transport: SSEServerTransport;
  userToken: string;    // 客户端传来的 pv_ API Key
  userId: number;       // 从 PeekView /auth/me 获取
  username: string;     // 从 PeekView /auth/me 获取
}

const sessions = new Map<string, SessionInfo>();
```

**安全说明：** userToken 以明文存储在内存中，这是透传设计的固有特性。风险可控：
- MCP Server 与 PeekView 在同一信任边界（同一 Docker 网络 / 同一主机）
- SSE 断开时 session 自动清理
- 绝不在日志中输出 token 值

**设计决策：** 每次 SSE 连接都调用 `/auth/me` 验证 token，不做缓存。理由：同一 token 在短时间内建立多个 session（如重连）是低频操作，缓存收益不大，且 API Key 可在 PeekView 侧随时撤销。

**AsyncLocalStorage 行为：** `sessionContext.run(ctx, () => transport.handlePostMessage(req, res))` 在 SSE POST 处理链路中有效。Node.js AsyncLocalStorage 在同一异步请求上下文中传播。需在测试中验证 POST → tool handler 能正确读到 sessionContext（如果 SDK 内部有 setImmediate 等脱离当前上下文的调用，context 可能丢失）。

### PeekView Client 变更

```typescript
class PeekViewClient {
  // 不再持有全局 apiKey，每次请求传入 userToken
  async request(path: string, options: RequestInit, userToken: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
    };
    return fetch(`${this.peekviewUrl}${path}`, { ...options, headers });
  }

  // SSE 连接时验证 token（5s 超时）
  async validateToken(token: string): Promise<{ id: number; username: string } | null> {
    const res = await fetch(`${this.peekviewUrl}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const user = await res.json();
    return { id: user.id, username: user.username };
  }

  // health check 不需要 auth
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.peekviewUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

### Tool handler 变更

```typescript
// handler 签名变更：接收 context
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: unknown, context: SessionContext) => Promise<ToolResult>;
}
```

**createTools 签名保留 publicUrl：**

```typescript
// publicUrl 仍通过 createTools 参数传入（createEntry 需要它拼 URL）
export function createTools(client: PeekViewClient, publicUrl: string): ToolDefinition[]
```

`publicUrl` 存入 tool closure，不从 `ServerConfig` 读取（config 已移除 apiKey/mcpToken）。

**CallToolRequestSchema handler：**

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const ctx = sessionContext.getStore();  // 从 AsyncLocalStorage 获取
  if (!ctx) {
    return { content: [{ type: 'text', text: 'No session context' }], isError: true };
  }
  const tool = tools.find(t => t.name === request.params.name);
  return tool.handler(request.params.arguments, ctx);
});
```

### 工具行为

| 工具 | 行为 | 说明 |
|------|------|------|
| create_entry | 条目归属 token 对应用户 | owner_id 由 PeekView 从 API Key 推断 |
| get_entry | 公开条目 + 自己的私有条目 | PeekView 已有 visibility 过滤 |
| list_entries | 同 get_entry | 同上 |
| delete_entry | 只能删自己的条目 | PeekView 已有 owner 权限检查 |

**管理员用户：** 如果 admin 用户通过 MCP 连接，PeekView 会赋予管理员权限（可看所有私有条目、可删任何条目）。这是 PeekView 已有的行为，MCP 不做额外限制。

**多 session：** 同一用户多个 Claude Code 实例会建立多个 SSE session，共享同一个 API Key。功能正常，但注意：一个实例撤销 key 后，另一个也会失效。

**Token 中途失效：** 用户 API Key 被撤销/过期/用户被禁用时，已有的 SSE session 不会主动断开，但后续所有 tool 调用都会收到 401 错误。用户看到重复的"认证失败"信息。不做主动 session 关闭（复杂度高、收益低）。

### 错误处理

PeekView 后端所有 401 统一返回 `code: "UNAUTHORIZED"`，不区分 Key 无效、过期、用户禁用。MCP Server 只按 HTTP 状态码分类：

| PeekView 返回 | MCP 返回给客户端 |
|---------------|-----------------|
| 401 | "认证失败：API Key 无效或已过期，请检查配置" |
| 403 | "权限不足" |
| 其他非 200 | "请求失败：${原始错误消息}" |

PeekViewClient 抛出结构化错误：

```typescript
class PeekViewApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`PeekView API error ${status}: ${body}`);
  }
}
```

tool handler 捕获后按 status 映射中文消息，不做错误码细分（后端不支持）。

### CORS 配置

`Authorization` header 必须在 CORS 中显式允许：

```typescript
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
```

## 用户使用流程

### 1. 在 PeekView 创建 API Key

```bash
# 在服务器上
peekview apikey create "Claude Code - 甲"
# → pv_abc123...

peekview apikey create "Claude Code - 乙"
# → pv_def456...
```

### 2. 配置 Claude Code

SSE 端点路径统一为 `/sse`：

```bash
# 用户甲
claude mcp add peekview --transport sse https://peek.example.com:33333/sse \
  --header "Authorization: Bearer pv_abc123..."

# 用户乙（另一台机器）
claude mcp add peekview --transport sse https://peek.example.com:33333/sse \
  --header "Authorization: Bearer pv_def456..."
```

### 3. 使用

```
用户甲通过 Claude Code 创建条目 → 条目 owner = 甲
用户乙通过 Claude Code 创建条目 → 条目 owner = 乙
用户甲 list_entries → 看到公开 + 甲的私有条目
用户乙 list_entries → 看到公开 + 乙的私有条目
甲的 key 过期 → SSE 连接保持，但所有 tool 调用返回"认证失败：API Key 已过期"
```

## 不支持的场景

- JWT token（`eyJ` 前缀）：不支持，7 天过期不适合 MCP 配置
- 无 token 连接：SSE 建立阶段验证 token，无效直接 401
- 服务级全局 API Key（`PEEKVIEW_SERVER__API_KEY`）：不通过 MCP 使用
- query parameter 传 token：完全移除，防止 token 泄露到日志

## 兼容性说明

**破坏性变更**（版本 v0.2.0），需要协调更新：

迁移清单：
1. 给当前版本打 `v0.1.x` tag 冻结旧版本
2. 删除 `MCP_TOKEN` 和 `PEEKVIEW_API_KEY` 环境变量
3. 每个用户在 PeekView 上创建各自的 API Key
4. 更新 Claude Code MCP 配置（从 `MCP_TOKEN` 改为 `pv_` API Key）
5. 更新 Docker Compose `.env` 文件（移除 MCP_TOKEN 和 PEEKVIEW_API_KEY）
6. README 顶部加 migration notice
7. 重新构建 MCP Server（新版本不兼容旧配置）

不支持过渡期（新旧配置完全不兼容，无法同时运行）。

## Docker Compose 变更

```yaml
mcp-server:
  environment:
    - PEEKVIEW_URL=http://peekview:8080
    - PEEKVIEW_PUBLIC_URL=${PEEKVIEW_PUBLIC_URL}
    # 移除: PEEKVIEW_API_KEY
    # 移除: MCP_TOKEN
    - MCP_PORT=33333
    - MCP_HOST=0.0.0.0
    - MCP_CORS_ORIGINS=https://claude.ai,https://cursor.sh
```

## 需更新的文件清单

| 文件 | 变更 |
|------|------|
| `src/server.ts` | 认证流程重写：AsyncLocalStorage、SessionInfo 结构、SSE 验证、POST handler（sessionId 验证 + ctx 传递） |
| `src/client.ts` | 移除 apiKey 属性，request() 传入 userToken，新增 validateToken()（5s 超时），ping() 不需 auth |
| `src/config.ts` | 移除 MCP_TOKEN 和 PEEKVIEW_API_KEY 字段 |
| `src/types.ts` | 新增 SessionContext、SessionInfo，ToolDefinition.handler 签名变更，移除 config 中 apiKey/mcpToken |
| `src/tools/createEntry.ts` | handler(args, ctx) 签名，用 ctx.userToken 调 client，publicUrl 从 closure |
| `src/tools/getEntry.ts` | handler(args, ctx) 签名 |
| `src/tools/listEntries.ts` | handler(args, ctx) 签名 |
| `src/tools/deleteEntry.ts` | handler(args, ctx) 签名 |
| `src/tools/index.ts` | createTools(client, publicUrl) 签名 |
| `src/index.ts` | 启动流程变更（不再需要 apiKey/mcpToken） |
| `tests/server.test.ts` | 新认证流程测试：SSE 验证、AsyncLocalStorage 传递、sessionId 验证 |
| `tests/client.test.ts` | request() 签名变更、validateToken() 测试（含超时） |
| `tests/config.test.ts` | 移除 MCP_TOKEN/API_KEY 测试 |
| `tests/tools/*.ts` | handler 签名变更测试 |
| `docker-compose.yml` | 移除 PEEKVIEW_API_KEY、MCP_TOKEN |
| `README.md` | 更新配置说明、端点路径统一为 /sse、使用流程 |