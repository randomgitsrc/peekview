# MCP Server 专家评审（第二轮）

> 评审人：软件研发与业务专家
> 日期：2026-05-19
> 评审对象：
> - `docs/specs/spec-mcp-server.md`（修订后）
> - `docs/superpowers/plans/2026-05-19-mcp-server.md`（修订后，含 BLOCK/CRITICAL/HIGH/MEDIUM/LOW 修复）
> 背景：PeekView v0.1.29，FastAPI + Vue3 + SQLite，单机自托管部署

---

## 一、目标摘要

本次设计和计划的核心目标是：

**让 AI Agent（Claude Code、Cursor 等）能直接调用 PeekView，把"手动 CLI 操作"变成 Agent 工具调用，返回 URL。**

具体体现为：
- 部署一个 Node.js/TypeScript MCP Server，通过 SSE transport 暴露 4 个工具（create/get/list/delete entry）
- MCP Server 作为中间层，持有内部 API Key，向外只暴露连接 Token（两层认证）
- 支持 Docker Compose 一键部署，支持 npm 全局安装
- 目标用户：AI Agent 开发者 + 自托管 PeekView 的用户

这是 PeekView 从"工具"升级为"Agent 基础设施"的关键一步，战略方向完全正确。

---

## 二、上轮评审问题解决情况

| 问题 | 状态 | 说明 |
|------|------|------|
| BLOCK-1：createExpressApp 缺 config 参数 | ✅ 已修 | 改为传 `(mcpServer, config, client)` |
| BLOCK-2：createEntry 返回内网 URL | ✅ 已修 | 新增 `PEEKVIEW_PUBLIC_URL`，config 里独立字段 |
| BLOCK-3：sessionId 依赖未验证 | ✅ 已修 | `(transport as any).sessionId \|\| randomUUID()` + validateUUID |
| TD-MCP-02：query 参数名 | ✅ 已修 | 后端确认是 `q`，计划已对齐 |
| TD-MCP-04：MCP_TOKEN 生成指引 | ✅ 已修 | README 补了 `openssl rand -hex 32` |
| server.test.ts 为空 | ✅ 已修 | 新增认证测试 |

上轮问题全部处理，修复质量整体良好。

---

## 三、现存问题

### 🔴 P0 — 阻塞级

#### 3.1 sessionId 泄露给客户端的机制缺失

**现状：** `/sse` 建立连接后，服务端自生成 `sessionId` 存入 `sessions` Map，但**没有把 `sessionId` 告知客户端**。

```typescript
// server.ts 当前实现
const sessionId = (transport as any).sessionId || randomUUID();
sessions.set(sessionId, transport);
await server.connect(transport);
// ← 客户端完全不知道 sessionId 是什么
```

客户端 POST `/messages` 时需要带 `?sessionId=xxx`，但它从哪里拿到这个值？计划里没有写。

MCP SSE 协议的标准做法是：SSE 连接建立后，服务端通过第一条 SSE event 把 `endpoint` URL（含 sessionId）推给客户端：

```
event: endpoint
data: /messages?sessionId=<uuid>
```

`@modelcontextprotocol/sdk` 的 `SSEServerTransport` 构造时接收 `endpoint` 参数，会自动发送这条 event。当前计划把 endpoint 硬写成 `'/messages'`，没有带 sessionId，客户端拿到的 endpoint 是 `/messages`（无 sessionId），POST 时 400。

**Fix：**
```typescript
// 先生成 sessionId，再构造 transport，把 sessionId 注入 endpoint
const sessionId = randomUUID();
const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
sessions.set(sessionId, transport);
```

这样 SDK 会自动把 `/messages?sessionId=<uuid>` 作为 endpoint 推给客户端，客户端 POST 时就会带上 sessionId。同时 `validateUUID` 校验也能正常工作。

---

#### 3.2 `ping()` 用业务接口探活，会消耗配额且语义错误

**现状：**
```typescript
async ping(): Promise<boolean> {
  await this.request<EntryResponse>('/api/v1/entries?page=1&per_page=1', { method: 'GET' });
  return true;
}
```

**问题：**
- 用真实的列表接口探活，每次 health check 都产生一次真实的 DB 查询
- 如果 API Key 权限不够或被 revoke，这个 ping 会返回 401/403——health check 降级的原因被混淆了（是网络不通？还是认证失败？）
- `/health` 应该是快速、轻量的，不应该走业务逻辑

**Fix：** 改用 PeekView 的 `/health` 接口探活（无需认证，纯 GET）：
```typescript
async ping(): Promise<boolean> {
  try {
    const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
```

---

### 🟠 P1 — 高优先级

#### 3.3 docker-compose.yml 位置矛盾未彻底解决

**现状：** Task 7 文件列表写的是：
```
- Create: `packages/mcp-server/docker-compose.yml`
```

但 Step 2 末尾注释又说"应放项目根目录"。两处矛盾依然存在，执行时会产生歧义。

**Fix：** Task 7 文件列表改为：
```
- Create: `docker-compose.yml`（项目根目录）
```

删除末尾的注释（已无必要）。同时 `git add Dockerfile docker-compose.yml .dockerignore` 中的 `docker-compose.yml` 路径需确认是根目录。

---

#### 3.4 `createTools` 签名变化但 Task 5 没有同步

**现状：** Task 6 的 `index.ts` 改成了：
```typescript
const tools = createTools(client, config);  // ← 传了 config
```

但 Task 5 的 `tools/index.ts`（Tool Registry）：
```typescript
export function createTools(client: PeekViewClient): ToolDefinition[] {
```

只有一个参数。`createEntry` 需要 `config.publicUrl`，但 Tool 拿不到 `config`。

**Fix：** Task 5 的 `createTools` 签名和所有 Tool 工厂函数同步更新：
```typescript
export function createTools(client: PeekViewClient, config: ServerConfig): ToolDefinition[] {
  return [
    createEntryTool(client, config),  // createEntry 需要 config.publicUrl
    getEntryTool(client),
    listEntriesTool(client),
    deleteEntryTool(client),
  ];
}
```

---

#### 3.5 config.test.ts 缺少 `PEEKVIEW_PUBLIC_URL` 和 `MCP_TOKEN` 缺失测试

**现状：** 新加了 `PEEKVIEW_PUBLIC_URL` 和 `MCP_TOKEN` 两个必填字段，但 Task 3 的测试没有补：
- 缺失 `PEEKVIEW_PUBLIC_URL` 时应 throw
- 缺失 `MCP_TOKEN` 时应 throw
- `PEEKVIEW_PUBLIC_URL` trailing slash 应被去除

计划里测试期望仍是 "Expected: 5 tests pass"，但加了新字段后有效的 `loadConfig()` 调用都缺少 `PEEKVIEW_PUBLIC_URL` 赋值，5 个现有测试会全部失败。

---

### 🟡 P2 — 中优先级

#### 3.6 Task 9 本地测试步骤不完整

```bash
# Terminal 2: Start MCP Server
export PEEKVIEW_API_KEY=$(peekview apikey create "MCP" -j | jq -r '.key')
```

缺少：
- `PEEKVIEW_PUBLIC_URL` 的设置（新增必填字段，没有会启动失败）
- `MCP_TOKEN` 的设置（同上）

开发者按 Task 9 操作会直接报配置错误，体验很差。

**Fix：** Task 9 Step 2 补全：
```bash
export PEEKVIEW_URL=http://localhost:8080
export PEEKVIEW_PUBLIC_URL=http://localhost:8080   # 本地开发时同地址
export PEEKVIEW_API_KEY=$(peekview apikey create "MCP" -j | jq -r '.key')
export MCP_TOKEN=$(openssl rand -hex 32)
npm start
```

---

#### 3.7 Acceptance Checklist 缺少 `PEEKVIEW_PUBLIC_URL` 验证项

当前 Checklist 没有验证"返回的 URL 用户可以访问"这一项。这是最直接的用户价值验证点，漏掉了。

**Fix：** Checklist 补一条：
```
- [ ] create_entry 返回的 URL 是 PEEKVIEW_PUBLIC_URL 而非内网地址
```

---

#### 3.8 `SSEServerTransport` 构造参数与 SDK 实际 API 需最终确认

计划当前假设 `SSEServerTransport` 构造签名为：
```typescript
new SSEServerTransport(endpoint: string, res: Response)
```

这是基于 `@modelcontextprotocol/sdk@^1.0.0` 的 API。SDK 在 1.x 期间有过 breaking change（如 `endpoint` 参数移入 options 对象）。

**建议：** Task 6 Step 1 开始前，计划里加一步验证：
```bash
cd packages/mcp-server
npm install
node -e "const m = require('@modelcontextprotocol/sdk/server/sse.js'); console.log(m.SSEServerTransport.toString().split('\n')[0])"
```

确认构造签名后再写实现，避免 API 不匹配在最后一步才暴露。

---

## 四、总体评估

| 维度 | 本轮评分 | 上轮 | 变化 |
|------|----------|------|------|
| 目标清晰度 | 9/10 | 9/10 | → |
| 架构设计 | 8/10 | 7/10 | ↑ |
| 实现计划完整性 | 6.5/10 | 5/10 | ↑ |
| 测试覆盖 | 6/10 | 4/10 | ↑ |
| 可执行性 | 6.5/10 | 5/10 | ↑ |

**综合：7/10**（上轮 5.5/10，提升明显）

**修复优先级：**
- P0（必须修才能工作）：3.1 sessionId 传递机制、3.2 ping 接口、3.4 createTools 签名
- P1（修了才能按计划执行）：3.3 docker-compose 路径、3.5 config 测试
- P2（影响体验和验收）：3.6 Task 9 步骤、3.7 Checklist、3.8 SDK 验证

P0 的 3 个问题中，**3.1 是最关键的**——sessionId 不传给客户端，整个 SSE 通信就根本跑不通，所有 Tool 调用都会 400。这是当前计划最大的可行性风险。

---

*评审完成：2026-05-19*
