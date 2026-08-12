# MCP v0.2.0 实现质量评审

> 评审框架：gstack review（Staff Engineer + /cso 安全官）
> 日期：2026-05-20
> 评审对象：`packages/mcp-server/` v0.2.0 多用户认证实现
> 评审方法：逐文件代码审查，交叉核对 spec

---

## 总体印象

实现速度快，结构清晰，AsyncLocalStorage 的使用方式正确，pv_ 前缀拒绝 JWT 的安全设计到位，测试覆盖了主要场景。但有 2 个会导致运行时失败的 P0，以及几个代码质量问题。

---

## 问题清单

### 🔴 P0 — 运行时失败

#### P0-1 `SSEServerTransport` endpoint 回退为 `/messages`（无 sessionId）

**当前实现（server.ts:125-126）：**
```typescript
const transport = new SSEServerTransport('/messages', res);
const sessionId = transport.sessionId;
```

这是一个回归。之前的评审（Round 1 BLOCK-1）修复的是：
```typescript
// 正确修法（Round 1修复版）
const sessionId = randomUUID();
const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
```

当前实现重新改成了 `/messages`（无 sessionId），然后从 `transport.sessionId` 读 sessionId。

**问题：** SDK `SSEServerTransport` 构造时会通过 SSE 把 endpoint 推给客户端：
```
event: endpoint
data: /messages
```

客户端 POST 到 `/messages`（无 sessionId），服务端 `req.query.sessionId` 为 `undefined`，`validateUUID(undefined)` 返回 false，直接 400。**所有工具调用都会失败。**

同时 `transport.sessionId` 是否真实存在于 SDK 1.4.0 的 `SSEServerTransport` 上，在环境里无法验证（无法安装依赖），这是额外风险。

**Fix：**
```typescript
// 方案A（推荐）：自生成 sessionId，写入 endpoint
const sessionId = randomUUID();
const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
sessions.set(sessionId, { transport, ... });

// 方案B：如果 SDK 确实暴露 transport.sessionId，保持现状但验证
// 在 tests/server.test.ts 里加一个 transport.sessionId 读取验证
```

---

#### P0-2 `listEntries` 的 `userToken` 有空字符串默认值

**当前实现（client.ts:97）：**
```typescript
async listEntries(
  page = 1,
  perPage = 20,
  query?: string,
  tags?: string[],
  userToken: string = ''   // ← 危险默认值
): Promise<ListEntriesResponse>
```

其他方法（`createEntry`、`getEntry`、`deleteEntry`）的 `userToken` 都是必填参数，只有 `listEntries` 有默认值 `''`。

**影响：** 如果调用方漏传 `userToken`（例如 `listEntries.ts` tool handler 中 `ctx` 为 undefined），会静默发出 `Authorization: Bearer ` 给后端，后端返回 401，工具报"认证失败"而非"内部错误"——掩盖了真实 bug。

**Fix：** 移除默认值，与其他方法保持一致：
```typescript
async listEntries(
  page = 1,
  perPage = 20,
  query?: string,
  tags?: string[],
  userToken: string        // 必填，无默认值
): Promise<ListEntriesResponse>
```

---

### 🟠 P1 — 代码质量问题

#### P1-1 错误翻译逻辑重复，4 个 tool 各写了一份

`createEntry.ts` 定义了 `translateError()` 函数，但没有导出。`deleteEntry.ts`、`getEntry.ts`、`listEntries.ts` 各自内联了相同逻辑：

```typescript
// deleteEntry.ts
if (error.status === 401) {
  return { content: [{ type: 'text', text: '✗ 认证失败...' }], isError: true };
}
if (error.status === 403) {
  return { content: [{ type: 'text', text: '✗ 权限不足' }], isError: true }；
}

// getEntry.ts — 完全相同的代码
// listEntries.ts — 完全相同的代码
```

**影响：** 将来要改错误消息，需要改 4 个地方；已经出现细微不一致（`createEntry` 用 `translateError(error, 'create entry')`，其他用内联 if）。

**Fix：** 将 `translateError` 移到 `tools/utils.ts`，导出供所有 tool 使用：

```typescript
// tools/utils.ts
export function translateError(error: unknown, action: string): ToolResult {
  if (error instanceof PeekViewApiError) {
    if (error.status === 401) return errorResult('认证失败：API Key 无效或已过期，请检查配置');
    if (error.status === 403) return errorResult('权限不足');
    return errorResult(`操作失败：${error.message}`);
  }
  return errorResult(`Failed to ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
```

---

#### P1-2 logger 定义在 `createExpressApp` 内部，无法在 request handler 外使用

```typescript
export function createExpressApp(...) {
  const logger = pino({ ... });
  // ...
}
```

`createMCPServer` 里的 `CallToolRequestSchema` handler 和 `sessionContext` 都在函数外部，如果需要记录 tool 执行日志，拿不到 logger。

**当前影响：** tool 执行出错时只返回错误消息，没有服务端日志。生产问题排查困难。

**建议：** logger 提升为模块级变量，或通过 DI 传入：
```typescript
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
```

---

#### P1-3 `CallToolRequestSchema` handler 里的 `as any` 类型断言

```typescript
return {
  content: [{ type: 'text', text: 'No session context' }],
  isError: true,
} as any;  // ← 3处 as any
```

SDK 的 `CallToolRequestSchema` 的返回类型与 `ToolResult` 有细微差异，用 `as any` 绕过了。这掩盖了类型不兼容，如果 SDK 升级改了返回类型签名，TypeScript 不会报错。

**Fix：** 在 `types.ts` 里对齐 `ToolResult` 与 SDK 期望的类型，或显式 cast 而非 `as any`。

---

### 🟡 P2 — 细节问题

#### P2-1 SSE 连接认证失败后 `validateToken` 中的网络超时无法区分

`validateToken` 在网络超时或 token 无效时统一返回 `null`，server.ts 统一返回 `401 Invalid or expired API Key`。

但用户角度：PeekView 服务器挂了（超时）和 Key 无效，看到的是同一个错误消息。难以区分是配置问题还是网络问题。

**建议：** `validateToken` 区分两种情况，抛出不同错误或返回不同状态：
```typescript
async validateToken(token: string): Promise<{ id: number; username: string } | null> {
  try {
    const res = await fetch(...);
    if (!res.ok) return null;          // token 无效
    return await res.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('PeekView connection timeout');  // 超时单独抛出
    }
    return null;
  }
}
```

SSE handler 捕获后：
```typescript
try {
  const userInfo = await client.validateToken(authHeader);
  if (!userInfo) return res.status(401).json({ error: 'Invalid or expired API Key' });
} catch (e) {
  return res.status(503).json({ error: 'PeekView unreachable, please try again later' });
}
```

#### P2-2 `server.test.ts` 中 "valid token 通过认证" 测试是空实现

```typescript
it('should accept valid pv_ token for SSE connection', async () => {
  // SSE is long-lived, supertest can't fully handle it.
  expect(true).toBe(true); // Auth gate verified by rejection tests above
});
```

这是一个占位测试，永远通过。SSE 长连接确实难用 supertest 测试，但可以通过 mock res 来验证认证通过时 `sessions.set()` 被调用，而不是 `expect(true).toBe(true)`。

**建议：** 改为：
```typescript
it('should NOT return 401 for valid pv_ token', async () => {
  // 发起请求后立即关闭连接，验证auth gate通过
  const controller = new AbortController();
  const req = request(app).get('/sse').set('Authorization', `Bearer ${VALID_TOKEN}`);
  // 验证没有立即返回401
  req.on('response', (res) => {
    expect(res.statusCode).not.toBe(401);
    controller.abort();
  });
});
```

#### P2-3 `listEntries` tool 输出中的安全降级写法

```typescript
const fileCount = e.files?.length ?? (e as any).file_count ?? 0;
```

`(e as any).file_count` 是不必要的 any cast，`file_count` 字段在 `EntryResponse` 类型定义里不存在。这表明写这行代码时对 API 返回结构有不确定性。

**Fix：** 统一用 `e.files?.length ?? 0`，类型安全。

---

## 总结

| 维度 | 评分 | 说明 |
|------|------|------|
| 核心架构实现 | 8/10 | AsyncLocalStorage 正确，pv_ 检查到位 |
| 安全性 | 8/10 | JWT 拒绝、token 不入日志、session 清理 |
| 运行时正确性 | 5/10 | P0-1 sessionId 机制回归，会导致所有工具调用失败 |
| 代码质量 | 6/10 | 错误翻译重复，as any，logger 耦合 |
| 测试质量 | 7/10 | 覆盖了主要场景，但有空测试 |

**综合：6.5/10**

P0-1（SSEServerTransport endpoint 回退）是最紧急的问题，**会导致所有 MCP 工具调用 400 失败**，必须在测试/部署前修复。P0-2（listEntries userToken 默认值）是静默 bug，需同步修复。其余 P1/P2 建议在当前迭代内一并清理。

---

*评审完成：2026-05-20*
