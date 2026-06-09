# MCP 调用性能问题分析报告

> 日期: 2026-05-23
> 问题: MCP 调用 peeklink 耗时约 2 分钟，而直接 API 调用 <1 秒
> 状态: 待调查

---

## 1. 问题现象

### 1.1 观察到的现象

**场景**: 通过 MCP Server 创建 PeekView entry

| 方式 | 耗时 | 结果 |
|------|------|------|
| MCP 调用 (`create_entry`) | ~2 分钟 | 成功但极慢 |
| 直接 curl API | <1 秒 | 成功且快速 |

**API 直接调用验证**:
```bash
curl -X POST https://peek.gsis.top/api/v1/entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"summary":"test","files":[{"filename":"test.md","content":"# test"}]}'
# 结果: 秒级响应，entry 创建成功
```

**结论**: 后端 API 本身性能正常，问题出在 MCP 层。

---

## 2. 可能原因分析

### 2.1 最可能原因（按概率排序）

#### A. MCP SSE 连接冷启动延迟 (概率: 高)

**描述**:
- MCP Server 使用 SSE (Server-Sent Events) 与 Claude Code 通信
- 首次连接或长连接断开后重建需要较长时间
- 可能涉及 TLS 握手、HTTP 升级、会话初始化

**验证方法**:
```bash
# 检查 MCP Server 日志
tail -f ~/.peekview/logs/mcp-server.log | grep -i "connect\|session"

# 观察连接建立时间
curl -w "@curl-format.txt" -o /dev/null -s \
  https://peek.gsis.top/sse \
  -H "Authorization: Bearer $TOKEN"
```

#### B. MCP Server HTTP 客户端连接池问题 (概率: 中高)

**描述**:
- MCP Server 的 `PeekViewClient` 可能未使用连接池
- 每次请求新建 TCP 连接，导致延迟累积
- Node.js fetch 默认行为可能导致连接不复用

**代码位置**:
```typescript
// packages/mcp-server/src/client.ts
async createEntry(request: CreateEntryRequest, userToken: string) {
  return this.request<EntryResponse>('/api/v1/entries', {
    method: 'POST',
    body: JSON.stringify(request),
  }, userToken);
}
```

**问题**:
- `fetch` 默认可能不保持连接
- 每次请求需 DNS 解析 + TCP 握手 + TLS 握手

#### C. MCP Server 与后端之间的网络延迟 (概率: 中)

**描述**:
- MCP Server 部署环境与 PeekView API 之间的网络问题
- 可能涉及跨容器/跨主机通信
- 检查双方网络延迟

**验证方法**:
```bash
# 从 MCP Server 所在主机测试
ping peek.gsis.top
dig peek.gsis.top  # DNS 解析时间

# 测试 TCP 连接时间
time curl -w "%{time_connect}\n" -o /dev/null -s https://peek.gsis.top/health
```

#### D. MCP Server 内部处理延迟 (概率: 低)

**描述**:
- 请求在 MCP Server 内部被阻塞
- 可能原因：认证检查、日志写入、同步操作

**验证方法**:
- 在 MCP Server 代码中添加时间戳日志
- 测量 `createEntry` 函数内部各阶段耗时

---

## 3. 当前系统架构

```
Claude Code (本地)
    ↓ SSE (长连接)
MCP Server (Node.js, 本地或远程)
    ↓ HTTP POST
PeekView API (FastAPI, https://peek.gsis.top)
    ↓ SQLite/Filesystem
Data Storage
```

**关键路径**:
1. Claude Code → MCP Server (SSE)
2. MCP Server 处理 (Node.js)
3. MCP Server → PeekView API (HTTP)
4. PeekView API 处理 (Python/FastAPI)
5. 数据返回 (反向)

**已知**: 步骤 4-5 很快 (<1s)，问题在 1-3。

---

## 4. 调查步骤

### Step 1: 定位慢点（添加日志）

在 `packages/mcp-server/src/tools/createEntry.ts` 添加耗时日志：

```typescript
export const createEntryTool = (client: PeekViewClient, publicUrl: string): ToolDefinition => ({
  name: 'create_entry',
  // ...
  handler: async (args: unknown, ctx: SessionContext): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const params = schema.parse(args);
      
      const beforeClient = Date.now();
      const entry = await client.createEntry({...}, ctx.userToken);
      const afterClient = Date.now();
      
      console.log(`[MCP Perf] Total: ${Date.now() - startTime}ms`);
      console.log(`[MCP Perf] Client.createEntry: ${afterClient - beforeClient}ms`);
      
      // ...
    }
  }
});
```

### Step 2: 测试 MCP Server 直接调用

绕过 Claude Code，直接测试 MCP Server：

```bash
# 启动 MCP Server 本地测试
cd packages/mcp-server
npm run dev

# 在另一个终端使用 mcp-cli 测试
# 或编写测试脚本直接调用 client
```

### Step 3: 网络抓包分析

```bash
# 在 MCP Server 运行环境抓包
sudo tcpdump -i any -w mcp-traffic.pcap host peek.gsis.top

# 分析连接建立时间
# 查看 SYN → SYN-ACK 间隔
```

### Step 4: 检查连接复用

验证 MCP Server 是否使用了 HTTP Keep-Alive：

```typescript
// 检查 client.ts 是否需要添加 keepalive agent
import { Agent } from 'https';

const agent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
});

// 在 fetch 中使用 agent
fetch(url, { agent });
```

---

## 5. 推荐的修复方案

### 方案 A: 添加连接池 (推荐)

**文件**: `packages/mcp-server/src/client.ts`

```typescript
import { Agent } from 'https';

export class PeekViewClient {
  private baseUrl: string;
  private agent: Agent;

  constructor(config: ClientConfig) {
    this.baseUrl = config.peekviewUrl;
    // 添加 keep-alive agent
    this.agent = new Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 10,
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    userToken: string
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      // @ts-ignore - fetch agent support
      agent: this.agent,
    });
    // ...
  }
}
```

**预期效果**: 首次连接慢，后续请求复用连接，<100ms。

### 方案 B: 使用 HTTP/2 (备选)

如果 PeekView 支持 HTTP/2，MCP Server 可使用 HTTP/2 客户端：

```typescript
import { connect } from 'http2';
// HTTP/2 多路复用，减少连接开销
```

### 方案 C: 预连接/预热 (临时方案)

在 MCP Server 启动时预建立连接：

```typescript
// client.ts
constructor(config: ClientConfig) {
  this.baseUrl = config.peekviewUrl;
  // 预连接
  this.ping().catch(() => {});
}
```

---

## 6. 需要用户协助

请协助收集以下信息：

1. **MCP Server 运行位置**
   - 本地开发环境？
   - 远程服务器？
   - 容器内？

2. **网络环境**
   ```bash
   # 在 MCP Server 运行环境执行
   traceroute peek.gsis.top
   curl -w "@curl-format.txt" -o /dev/null -s https://peek.gsis.top/health
   ```

3. **MCP Server 日志**
   ```bash
   # 日志位置
   cat ~/.peekview/logs/mcp-server.log | tail -100
   ```

---

## 7. 临时 workaround

在修复前，建议：

1. **保持 MCP Server 长连接** — 避免频繁断开重连
2. **批量操作** — 如需创建多个 entry，使用批量 API（如果有）
3. **异步处理** — 不阻塞等待 MCP 返回，先继续其他工作

---

## 附录

### A. curl 格式化输出模板

创建 `curl-format.txt`:
```
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
   time_pretransfer:  %{time_pretransfer}\n
      time_redirect:  %{time_redirect}\n
 time_starttransfer:  %{time_starttransfer}\n\n                    ----------\n\n         time_total:  %{time_total}\n
```

使用:
```bash
curl -w "@curl-format.txt" -o /dev/null -s https://peek.gsis.top/health
```

### B. 相关文件

- MCP Client: `packages/mcp-server/src/client.ts`
- MCP Create Entry Tool: `packages/mcp-server/src/tools/createEntry.ts`
- PeekView API: `backend/peekview/api/entries.py`

---

**最后更新**: 2026-05-23
**负责人**: 待分配
**优先级**: P2 (影响体验但不阻塞功能)
