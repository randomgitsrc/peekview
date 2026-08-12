# MCP 性能问题专家评审

> 评审人：软件研发与业务专家
> 日期：2026-05-23
> 评审对象：`docs/analysis/mcp-performance-analysis.md` + 相关实现
> 问题：MCP 调用 create_entry 约 2 分钟，直接 API <1 秒

---

## 一、原有分析的评估

原分析报告列出了 4 个候选原因（SSE 冷启动、连接池、网络延迟、内部处理延迟），但有两个关键问题：

1. **没有区分"在哪段时间慢"**——2 分钟是端到端总耗时，但没有拆分各阶段
2. **忽略了 MCP 协议层本身的延迟来源**——原分析把 MCP 当成普通 HTTP 代理来分析，但 MCP over SSE 有自己独特的时序问题

---

## 二、重新分析：2 分钟在哪里？

### MCP 调用完整时序

```
T+0s    用户发出 /peeklink 命令（或其他触发 MCP 调用的指令）
T+?     Claude 决定调用 create_entry 工具
T+?     Claude Code POST /messages?sessionId=xxx（发送工具调用请求）
T+?     MCP Server 接收请求，validateToken（最多5s）
T+?     MCP Server 调用 client.createEntry() → PeekView API（实测 <1s）
T+?     MCP Server 通过 SSE 推送结果给 Claude Code
T+?     Claude Code 解析工具结果，生成最终回复
T+2min  用户看到结果
```

**关键问题：2 分钟是哪段？**

`成功但极慢` 说明整个链路都走通了，不是超时失败。这排除了网络断线、认证失败等原因。

### 各阶段分析

#### 阶段 1：Claude 决策到发出工具调用（T+0 → POST /messages）

**这段时间最容易被忽视，但可能是主因之一。**

Claude 在决定调用工具之前需要：
- 理解用户意图
- 选择合适的工具
- 构造参数（对于大文件，参数本身就很大）

对于包含大量代码的 create_entry，Claude 需要将所有文件内容打包进工具调用参数。如果文件内容很大（几百KB），这个序列化和传输过程本身就需要时间。

**但这通常是几秒，不是 2 分钟。**

#### 阶段 2：MCP Server 处理（POST /messages → SSE 推送）

这段时间可以精确测量（在 MCP Server 加日志）。

实际开销：
- `validateToken`：**每次 SSE 连接建立时调用一次**，之后不再调用（已存 sessionInfo）。所以正常情况下不影响工具调用速度
- `client.createEntry()`：<1s（已验证）
- `fileNaming.suggestFileExtension()`：纯字符串操作，<1ms

**MCP Server 内部处理时间应该 <2s**，不可能是 2 分钟的来源。

#### 阶段 3：SSE 推送到 Claude Code 接收（最关键的未知）

这是最可能隐藏问题的地方。

**MCP over SSE 的工作机制：**

```
Claude Code (MCP Client)          MCP Server
      |                                |
      |--- POST /messages ----------->|  工具调用请求
      |                                |  处理中...
      |<-- SSE event: result ---------|  通过长连接推送结果
      |                                |
```

如果 SSE 长连接不稳定（超时、被代理断开、网络抖动），Claude Code 会等待 SSE 事件，直到超时或收到结果。

**具体场景：MCP Server 部署在远程 VPS（peek.gsis.top），Claude Code 在本地**

```
Claude Code (本地) ←——SSE长连接——→ MCP Server (VPS)
```

这个长连接需要穿越：
- 本地网络
- 互联网
- VPS 的网络（可能有 Nginx/负载均衡）

**Nginx 默认的 proxy_read_timeout 是 60s**，如果 Nginx 在 MCP Server 前面，且没有配置 SSE 专用的超时，会在 60s 时断开 SSE 连接——Claude Code 需要重建连接（又一次 validateToken），然后重发请求。两次 60s ≈ 2 分钟。

**这是 2 分钟问题最可能的根因。**

#### 阶段 4：Claude Code 生成最终回复（接收工具结果 → 用户看到输出）

这段通常 5-20s，不是主因。

---

## 三、根因假设（按可能性排序）

### 假设 A：Nginx proxy_read_timeout 导致 SSE 断连重试（可能性：高）

**机制：**
```
Claude Code --SSE--> Nginx --> MCP Server
                 ↓
         Nginx 60s 无数据 → 断开 SSE 连接
                 ↓
Claude Code 检测到断连 → 重建 SSE → 重试工具调用
         ≈ 60s（第一次断连）+ 60s（第二次）= 120s ≈ 2分钟
```

**验证方法：**
```bash
# 检查 MCP Server 日志里是否有多次 SSE 连接记录
grep "SSE connected\|session created\|validateToken" ~/.peekview/logs/mcp-server.log

# 如果看到同一个用户短时间内建立了 2-3 次 SSE 连接，就是这个问题
```

**修复：** Nginx 配置加 SSE 专用 location：
```nginx
location /sse {
    proxy_pass http://localhost:33333;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;      # SSE 需要长超时
    proxy_send_timeout 3600s;
    keepalive_timeout 3600s;
    
    # 添加正确的 SSE headers
    add_header Cache-Control 'no-cache';
    add_header X-Accel-Buffering 'no';
}
```

---

### 假设 B：连接池缺失导致每次 HTTP 请求都重建 TLS（可能性：中）

**机制：**
```typescript
// 当前实现：每次 request() 都是全新的 fetch
// 对 HTTPS 端点：DNS(~50ms) + TCP(~100ms) + TLS(~200ms) + 请求 = ~400ms
// 但这只有 400ms，不是 2 分钟
```

这单独不能解释 2 分钟，但可以解释工具调用比预期慢 0.3-0.5s。

**修复：** 添加 HTTP Keep-Alive Agent：
```typescript
import { Agent } from 'https';

export class PeekViewClient {
  private agent: Agent;

  constructor(config: ClientConfig) {
    this.baseUrl = config.peekviewUrl;
    this.agent = new Agent({
      keepAlive: true,
      keepAliveMsecs: 60000,
      maxSockets: 5,
      timeout: 30000,
    });
  }

  private async request<T>(...): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      // @ts-ignore — Node.js fetch 支持 agent
      agent: this.agent,
    });
  }
}
```

---

### 假设 C：MCP Server 作为 npm 全局包安装，node 版本或环境问题（可能性：低）

如果 MCP Server 用 `npm install -g @peekview/mcp-server` 安装，且系统 node 版本不同于开发版本，可能存在 fetch 行为差异或性能问题。

**验证：**
```bash
node --version
peekview-mcp --version
```

---

### 假设 D：Claude Code 自身的处理时间（可能性：中低）

如果传入的文件内容很大（如整个代码库的多个文件），Claude 构造工具调用参数、发送到 MCP Server、接收响应并处理，本身就需要时间。这不是 MCP Server 的问题，是使用方式问题。

---

## 四、诊断方案（逐步排查）

### Step 1：确认 MCP Server 的实际处理时间（10 分钟）

在 `createEntry.ts` 的 handler 加时间日志：

```typescript
handler: async (args: unknown, ctx: SessionContext): Promise<ToolResult> => {
  const t0 = Date.now();
  logger.info({ tool: 'create_entry' }, 'tool call received');
  
  try {
    const params = schema.parse(args);
    const t1 = Date.now();
    
    const entry = await client.createEntry({...}, ctx.userToken);
    const t2 = Date.now();
    
    logger.info({
      parse_ms: t1 - t0,
      api_ms: t2 - t1,
      total_ms: t2 - t0,
    }, 'tool call completed');
    
    // 构建返回...
  }
}
```

**如果日志显示 total_ms < 2000ms**，说明 MCP Server 处理很快，2 分钟在协议层（假设 A）或 Claude 侧。

**如果日志显示 MCP Server 没有收到请求**（日志里没有 `tool call received`），说明请求根本没到达 MCP Server——SSE 连接断了，Claude Code 在等重连。

---

### Step 2：检查 SSE 连接次数（5 分钟）

```bash
# 触发一次 MCP 调用，同时观察日志
tail -f ~/.peekview/logs/mcp-server.log | grep -E "SSE|session|connect|validateToken"

# 期望：只看到 1 次 SSE 连接，然后是工具调用
# 异常：看到 2-3 次 SSE 连接（说明断连重试）
```

---

### Step 3：检查 Nginx 配置（如果有反向代理）

```bash
# 检查 Nginx 是否有 proxy_read_timeout 配置
grep -r "proxy_read_timeout\|proxy_buffering\|X-Accel-Buffering" /etc/nginx/

# 检查 33333 端口是否直接对外还是经过 Nginx
curl -v -N https://peek.gsis.top/sse \
  -H "Authorization: Bearer pv_xxx" 2>&1 | head -30
# 注意：-N 禁用缓冲，SSE 需要这个
# 看 response headers 里是否有 nginx 相关标记
```

---

### Step 4：测量连接建立时间

```bash
# 创建 curl-timing.txt
cat > /tmp/curl-timing.txt << 'EOF'
    namelookup:  %{time_namelookup}s
       connect:  %{time_connect}s
   appconnect:  %{time_appconnect}s
  pretransfer:  %{time_pretransfer}s
     redirect:  %{time_redirect}s
starttransfer:  %{time_starttransfer}s
       total:  %{time_total}s
EOF

# 测试 MCP Server 连接时间
curl -w "@/tmp/curl-timing.txt" -o /dev/null -s \
  https://peek.gsis.top/health

# 如果 appconnect（TLS握手）> 500ms，连接池有价值
# 如果 namelookup > 100ms，DNS 有问题
```

---

## 五、修复方案

### 方案 1：Nginx SSE 配置（如果假设 A 成立，优先修）

见假设 A 的 Nginx 配置。这是零代码改动，只改配置，风险低，效果明显。

```nginx
# /etc/nginx/sites-available/peekview
server {
    listen 443 ssl;
    server_name peek.gsis.top;

    # 默认 location（普通 API）
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_read_timeout 60s;
    }

    # MCP Server - SSE 需要特殊配置
    location /sse {
        proxy_pass http://localhost:33333;
        proxy_http_version 1.1;
        proxy_set_header Connection '';        # 保持长连接
        proxy_buffering off;                    # 禁止缓冲（SSE 必须）
        proxy_cache off;
        proxy_read_timeout 3600s;              # 1小时，避免超时断连
        add_header Cache-Control 'no-cache';
        add_header X-Accel-Buffering 'no';
    }

    location /messages {
        proxy_pass http://localhost:33333;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;                # POST /messages 不需要长超时
    }
}
```

---

### 方案 2：PeekViewClient 添加连接池（无论假设哪个成立都应该做）

```typescript
// packages/mcp-server/src/client.ts
import { Agent } from 'https';
import { Agent as HttpAgent } from 'http';

export class PeekViewClient {
  private baseUrl: string;
  private agent: Agent | HttpAgent;

  constructor(config: ClientConfig) {
    this.baseUrl = config.peekviewUrl;
    // 根据协议选择 Agent
    const isHttps = config.peekviewUrl.startsWith('https://');
    this.agent = isHttps
      ? new Agent({ keepAlive: true, keepAliveMsecs: 60000, maxSockets: 5 })
      : new HttpAgent({ keepAlive: true, keepAliveMsecs: 60000, maxSockets: 5 });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    userToken: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
        // @ts-ignore — Node.js 18+ fetch 支持 agent
        agent: this.agent,
      });
      // ...（其余不变）
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

**预期效果：** 首次连接建立后，后续请求复用 TCP/TLS，每次请求节省 200-400ms（对于 HTTPS）。

---

### 方案 3：validateToken 结果缓存（如果断连重试是主因）

如果 SSE 连接频繁断连重建，每次都要 `validateToken`（一次 HTTP 请求）。可以在进程内缓存 token 验证结果：

```typescript
// client.ts
private tokenCache = new Map<string, { userId: number; username: string; expiry: number }>();

async validateToken(token: string): Promise<{ id: number; username: string } | null> {
  // 缓存 2 分钟（token 本身不会在 2 分钟内失效）
  const cached = this.tokenCache.get(token);
  if (cached && cached.expiry > Date.now()) {
    return { id: cached.userId, username: cached.username };
  }

  // 实际验证...
  const result = await this._validateTokenRemote(token);
  if (result) {
    this.tokenCache.set(token, {
      userId: result.id,
      username: result.username,
      expiry: Date.now() + 2 * 60 * 1000, // 2 分钟
    });
  }
  return result;
}
```

**注意：** 缓存带来 token 撤销不即时生效的风险（最多 2 分钟延迟）。在 PeekView 的安全模型里，这是可以接受的（如需撤销，2 分钟内生效是合理的）。

---

## 六、实施建议

### 立即（今天）

1. **加诊断日志**（Step 1），触发一次 MCP 调用，确认 MCP Server 的实际处理时间
2. **检查 Nginx 配置**（Step 3），确认 SSE 是否经过 Nginx 且是否有 timeout

这两步合计 30 分钟，就能确认根因。

### 根因确认后

- **Nginx 超时**：改 Nginx 配置（<30分钟，零代码）
- **连接池缺失**：实施方案 2（2-3小时，含测试）
- **两者都有**：先改 Nginx，再加连接池

---

## 七、不需要做的事

原分析报告提到了 HTTP/2 和预连接方案，在当前阶段**不建议实施**：

- **HTTP/2**：改动大，且 Node.js 的 http2 模块 API 与 fetch 不兼容，需要大幅重构 client.ts；在根因未明确前不应引入
- **预连接（构造函数里 ping()）**：治标不治本，且会增加 MCP Server 启动时间，不解决根本问题
- **批量 API**：PeekView 本身没有批量创建 entry 的 API，这个方向走不通

---

## 八、一句话结论

**2 分钟延迟最可能是 Nginx 的 `proxy_read_timeout`（默认 60s）导致 SSE 连接被切断，Claude Code 重试两次累计约 120s。** 先加诊断日志确认，然后改 Nginx 配置，预计可以把延迟降到 2-5s（正常的 MCP 工具调用时间）。连接池是值得加的性能优化，但不是 2 分钟问题的主因。

---

*评审完成：2026-05-23*
