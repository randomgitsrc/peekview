# MCP v0.2.0 实现质量评审（第二轮）

> 评审框架：gstack review（Staff Engineer）
> 日期：2026-05-20
> 评审对象：`packages/mcp-server/` 最新实现（含 fix commit 2009c3a3 + 重构 7adfa3a3）

---

## 上轮问题解决情况

| 问题 | 状态 | 说明 |
|------|------|------|
| P0-2 listEntries userToken 默认值 `''` | ✅ 已修 | userToken 提为第一参数，无默认值 |
| P1-1 错误翻译重复 4 份 | ✅ 已修 | 抽到 `tools/utils.ts`，所有 tool 统一引用 |
| P1-2 logger 耦合在 createExpressApp 内 | ❌ 未修 | logger 仍在函数内，tool handler 拿不到 |
| P1-3 `as any` 类型断言 4 处 | ❌ 未修 | `server.ts` 仍有 4 处 `as any` |
| P2-2 空测试 `expect(true).toBe(true)` | ❌ 未修 | 仍然存在 |
| P2-3 `(e as any).file_count` | 需确认 | — |

P0-1（sessionId 机制）的处理方式：注释说 "SDK auto-generates sessionId"，保留了 `transport.sessionId`。这是一个**待验证的假设**，见下方 P0-1。

---

## 当前问题

### 🔴 P0 — 必须在部署前验证/修复

#### P0-1 `transport.sessionId` 是未验证的 SDK 内部属性

**现状（server.ts:131-134）：**
```typescript
// SDK auto-generates sessionId and appends ?sessionId= to the endpoint event.
// Passing just '/messages' (not '/messages?sessionId=...') avoids double sessionId.
const transport = new SSEServerTransport('/messages', res);
const sessionId = transport.sessionId;
```

注释解释了选择这种写法的理由，但没有证明 `transport.sessionId` 存在。

**风险：** SDK 1.4.0 的 `SSEServerTransport` 若不暴露 `sessionId` 属性，`transport.sessionId` 为 `undefined`，`sessions.set(undefined, ...)` 把所有 session 存入同一个 key，多用户 session 互相覆盖，后一个用户的 token 会冒充前一个用户的 session——**严重安全漏洞**。

**验证方法（加入 tests/server.test.ts）：**
```typescript
it('SSEServerTransport exposes sessionId property', () => {
  // 用 mock res 构造 transport，验证 sessionId 存在且为 UUID 格式
  const mockRes = { write: vi.fn(), on: vi.fn(), end: vi.fn() } as any;
  const transport = new SSEServerTransport('/messages', mockRes);
  expect(transport.sessionId).toBeDefined();
  expect(validateUUID(transport.sessionId)).toBe(true);
});
```

在环境中无法安装依赖，此验证必须由实现者在 CI 中完成。若 `transport.sessionId` 不存在，回退到：
```typescript
const sessionId = randomUUID();
const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
```

---

### 🟠 P1 — 高优先级

#### P1-1 多用户隔离测试完全没有覆盖核心场景

**现状（integration test，"Multi-user isolation" describe）：**
```typescript
// 唯一的多用户测试：用无效 key 创建条目，断言不崩溃
expect(result.content).toBeDefined();
expect(result.content[0].text).toBeTruthy();
```

这不是多用户隔离测试，是"不崩溃"测试。

**实际需要覆盖的场景（对应 spec 目标）：**

1. **用户甲创建 private 条目，用户乙看不到**
   ```typescript
   // 甲创建 is_public: false
   // 乙 list_entries → 返回列表中不含甲的私有条目
   ```

2. **用户甲删不了用户乙的条目（403）**
   ```typescript
   // 乙创建一个条目
   // 甲 delete_entry(乙的slug) → PeekView 返回 403 → 工具返回"权限不足"
   ```

3. **两个用户同时建立 SSE session，context 不互相污染**
   ```typescript
   // sessionA 用甲的 token，sessionB 用乙的 token
   // sessionA 的 tool 调用带甲的 token，sessionB 的带乙的 token
   ```

这三个场景是 v0.2.0 的核心价值所在，没有测试等于核心功能没有验收。

**当前测试实际只验证了：**
- 认证拒绝（JWT、空 token、无效 pv_ key）✅
- 单用户工具调用的输入输出 ✅
- health check ✅
- 错误翻译 ✅

---

#### P1-2 `logger` 仍耦合在 `createExpressApp` 内，tool 执行无日志

tool handler 出错时，`CallToolRequestSchema` handler 捕获异常并返回错误内容，但没有任何服务端日志：

```typescript
} catch (error) {
  return {
    content: [{ type: 'text', text: `Tool execution error: ...` }],
    isError: true,
  } as any;
  // ← 没有 logger.error(...)
}
```

生产环境里 tool 执行失败，日志里什么都看不到，排查困难。

**建议：** 将 logger 提升为模块级变量（惰性初始化），或在 `createMCPServer` 接收 logger 参数：

```typescript
// 方案A：模块级 logger（简单）
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// CallToolRequestSchema handler
} catch (error) {
  logger.error({ tool: request.params.name, error }, 'tool execution failed');
  return { ... } as any;
}
```

---

#### P1-3 `as any` 4 处仍未解决

`server.ts` 的 `CallToolRequestSchema` handler 返回值有 4 处 `as any`，原因是 SDK 的 `CallToolResult` 类型和自定义 `ToolResult` 不兼容。

这不影响运行，但 TypeScript 严格模式下是代码坏味道，SDK 升级时类型不匹配不会被编译器捕获。

**建议：** 在 `types.ts` 里对齐类型，或用显式类型 guard 替代 `as any`：

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// ToolResult 改为继承 SDK 的 CallToolResult，或显式转换
function toSDKResult(result: ToolResult): CallToolResult {
  return result as CallToolResult; // 至少是有意图的转换，而非盲目 as any
}
```

---

### 🟡 P2 — 细节问题

#### P2-1 空测试仍然存在

```typescript
it('should accept valid pv_ token for SSE connection', async () => {
  expect(true).toBe(true); // Auth gate verified by rejection tests above
});
```

这行测试永远通过，且会给人"这个场景已覆盖"的错觉。

**建议：** 改为验证 validateToken 被调用：
```typescript
it('should call validateToken with pv_ token', async () => {
  let capturedToken: string | undefined;
  client.validateToken = async (token) => {
    capturedToken = token;
    return token === VALID_TOKEN ? { id: 1, username: 'alice' } : null;
  };
  // 发起 SSE 请求（不等待响应完成，只验证 validateToken 被调用）
  request(app).get('/sse').set('Authorization', `Bearer ${VALID_TOKEN}`).end(() => {});
  await new Promise(r => setTimeout(r, 50)); // 给 async 认证时间
  expect(capturedToken).toBe(VALID_TOKEN);
});
```

#### P2-2 `validateToken` 超时后返回 503，但注释说"return null"（文档不一致）

`client.ts` 的 `validateToken` catch 块：
```typescript
} catch {
  clearTimeout(timeout);
  return null;  // ← 超时时返回 null
}
```

`server.ts` 里捕获异常返回 503 的逻辑：
```typescript
try {
  userInfo = await client.validateToken(authHeader);
  if (!userInfo) { return 401; }
} catch (e) {
  return 503;  // ← 但 validateToken 从不抛异常，只返回 null
}
```

`validateToken` 吞掉了所有异常（catch 返回 null），server.ts 的 try/catch 永远不会走 503 分支。超时时走的是 `401 Invalid or expired API Key`，而不是期望的 `503 PeekView unreachable`。

**Fix：** `validateToken` 在超时时抛出，而不是返回 null：
```typescript
} catch (e) {
  clearTimeout(timeout);
  if (e instanceof Error && e.name === 'AbortError') {
    throw e;  // 超时抛出，让 server.ts 的 catch 处理为 503
  }
  return null;  // 其他错误（网络拒绝等）返回 null → 401
}
```

---

## 总结

### 修复优先级

| 级别 | 条目 | 说明 |
|------|------|------|
| 🔴 P0 | P0-1 transport.sessionId 未验证 | 若不存在则多用户 session 互相覆盖，安全漏洞 |
| 🟠 P1 | P1-1 多用户隔离无实质测试 | 核心功能无验收，v0.2.0 价值未被证明 |
| 🟠 P1 | P1-2 tool 执行无服务端日志 | 生产排查困难 |
| 🟠 P1 | P1-3 as any 4 处 | TypeScript 类型安全风险 |
| 🟡 P2 | P2-1 空测试 | 误导覆盖率 |
| 🟡 P2 | P2-2 validateToken 超时路径错误 | 503 分支永远不走 |

### 评分

| 维度 | 本轮 | 上轮 | 变化 |
|------|------|------|------|
| 运行时正确性 | 6/10 | 5/10 | ↑（P0-2修复，P0-1待验证） |
| 代码质量 | 7/10 | 6/10 | ↑（错误翻译统一，listEntries签名修正） |
| 测试质量 | 5/10 | 7/10 | ↓（多用户隔离无实质测试） |
| 安全性 | 7/10 | 8/10 | ↓（P0-1 sessionId 安全隐患未证） |

**综合：6.5/10**

最重要的两件事：
1. **验证 `transport.sessionId` 是否真实存在**（加一个测试），这决定了多用户 session 是否安全隔离
2. **补多用户隔离的实质测试**：用户甲看不到用户乙的私有条目、删不了乙的条目——这是 v0.2.0 的存在价值

---

*评审完成：2026-05-20*
