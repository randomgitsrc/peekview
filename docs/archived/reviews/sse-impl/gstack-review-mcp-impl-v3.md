# MCP v0.2.0 实现质量评审（第三轮）

> 评审框架：gstack review（Staff Engineer + /cso 安全官）
> 日期：2026-05-20
> 评审对象：`packages/mcp-server/` fix commit 3436861f

---

## 上轮问题解决情况

| 问题 | 状态 | 说明 |
|------|------|------|
| P0-1 transport.sessionId 未验证 | ✅ 已修 | 新增测试直接构造 SSEServerTransport 验证属性存在且为 UUID |
| P1-1 多用户隔离无实质测试 | ✅ 已修 | 新增 Alice/Bob 跨用户隔离测试（私有条目不可见、删除权限拒绝） |
| P1-2 tool 执行无服务端日志 | ✅ 已修 | logger 提升为模块级，tool handler 失败时 `logger.error` |
| P1-3 as any 4 处 | ✅ 部分修 | 改用 `toSDKResult()` 包装，仍是 `any` 返回类型，见 P1-1 |
| P2-1 空测试 | ✅ 已修 | 改为验证 validateToken 被调用 + 503 场景测试 |
| P2-2 validateToken 超时路径错误 | ✅ 已修 | AbortError 时 throw，server.ts 的 catch 分支现在能走到 |

上轮 6 个问题全部处理，且都有对应测试验证，质量高。

---

## 当前问题

### 🔴 P0 — 安全

#### P0-1 真实 API Key 硬编码在集成测试源码中

**现状（integration test:236）：**
```typescript
const BOB_API_KEY = process.env.PEEKVIEW_API_KEY_BOB || 'pv_RNsaFaHyOHzbydy4qCeF2eHWUkVTuHtY';
```

`pv_RNsaFaHyOHzbydy4qCeF2eHWUkVTuHtY` 是一个真实的 PeekView API Key，已经提交进 Git 历史。

**影响：**
- 此 key 永久存在于 Git 历史，即使将来删除这行代码，历史里仍可读取
- 任何有仓库 read 权限的人可直接用这个 key 操作 PeekView 实例
- 如果这个 key 对应的是真实用户（Bob），该用户数据存在越权风险

**Fix：**
1. **立即**在 PeekView 后台 revoke 这个 key（`peekview apikey revoke pv_RNsa...`）
2. 代码改为：
```typescript
const BOB_API_KEY = process.env.PEEKVIEW_API_KEY_BOB;
if (!BOB_API_KEY) {
  console.warn('PEEKVIEW_API_KEY_BOB not set, skipping multi-user tests');
}
```
3. 在 `.gitignore` 里加 `.env.test.local`，把测试用 key 放在本地环境变量，不提交

---

### 🟠 P1 — 代码质量

#### P1-1 `toSDKResult()` 返回 `any`，问题未真正解决

**现状：**
```typescript
// types.ts
export function toSDKResult(result: ToolResult): any {
  return result;
}
```

注释写"Avoids `as any`"，但实际上函数返回类型是 `any`，TypeScript 编译器对调用方的类型检查依然失效——只是把 `as any` 包了一层皮。

`server.ts` 里：
```typescript
return toSDKResult(result);  // 返回类型是 any，等价于 return result as any
```

**真正的 fix** 是对齐 `ToolResult` 与 SDK 的 `CallToolResult` 类型：
```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// 让 ToolResult 兼容 SDK 类型
export interface ToolResult extends CallToolResult {}

// 或者显式类型转换（至少有编译期意图记录）
export function toSDKResult(result: ToolResult): CallToolResult {
  return result as CallToolResult;
}
```

这不影响运行，但是类型安全的正确做法。SDK 升级时类型不匹配会被编译器捕获，而不是运行时才发现。

---

#### P1-2 多用户隔离测试依赖外部真实服务，CI 会跳过核心验收

**现状：** 多用户测试用的是 `itIfReady`（当 PeekView 后端可达时才执行），这意味着：
- 本地没有跑 PeekView 的开发者：测试跳过 ✓（可接受）
- CI/CD 环境：除非配置了 PeekView 服务，否则这组测试**永远跳过**

v0.2.0 最核心的功能——多用户隔离——在 CI 里没有任何验收。

**建议：** 在 `server.test.ts`（unit）层补充一个用 mock 模拟的多用户隔离测试，不依赖真实 PeekView：

```typescript
describe('Multi-user session isolation', () => {
  it('should maintain separate contexts for concurrent sessions', async () => {
    // 建立两个 mock session：alice 和 bob
    const aliceCtx = { userToken: 'pv_alice', userId: 1, username: 'alice' };
    const bobCtx   = { userToken: 'pv_bob',   userId: 2, username: 'bob' };

    // 模拟两个并发 tool 调用，验证各自拿到自己的 context
    let aliceCaptured: string | undefined;
    let bobCaptured:   string | undefined;

    // 直接测试 AsyncLocalStorage 隔离
    const sessionContext = new AsyncLocalStorage<SessionContext>();
    await Promise.all([
      sessionContext.run(aliceCtx, async () => {
        await new Promise(r => setTimeout(r, 10));
        aliceCaptured = sessionContext.getStore()?.userToken;
      }),
      sessionContext.run(bobCtx, async () => {
        await new Promise(r => setTimeout(r, 5));
        bobCaptured = sessionContext.getStore()?.userToken;
      }),
    ]);
    expect(aliceCaptured).toBe('pv_alice');
    expect(bobCaptured).toBe('pv_bob');
  });
});
```

这个测试不依赖 PeekView，在 CI 里始终运行，验证 AsyncLocalStorage 的隔离行为。

---

### 🟡 P2 — 细节

#### P2-1 `validateToken` 超时测试实际上测不到 5s 超时

**现状（client.test.ts:60-77）：**
```typescript
it('should throw on timeout (AbortError), not return null', async () => {
  // 用 msw 延迟响应，等待超时触发
  ...
  await client.validateToken('pv_timeout_test_key');
  // 期望抛出 ...
});
```

如果测试真的等待 5 秒超时，整个测试套件会慢 5 秒。查看测试实现，如果 msw 的 delay 机制不是真的挂起 5s 而是立即报错，这个测试可能是通过了但并没有真正测到 `AbortController` 超时路径。

**建议：** 验证一下这个测试的实际执行时间——如果不到 1 秒就通过了，说明测的是 fetch 被 msw 直接拒绝（network error），走的是 `catch` 里的普通 Error 分支，而非 AbortError 分支。应该用 `vi.useFakeTimers()` 配合 `vi.advanceTimersByTimeAsync(5001)` 来精确测试超时路径。

#### P2-2 `itIfReady` 跳过时无输出，CI 难以感知

当 PeekView 不可达时，`itIfReady` 跳过的测试在 CI 日志里显示为 `skipped`，但没有明确说明跳过原因。建议用 `it.skip` 并加明确原因，或在 `itIfReady` 里加 `console.warn`：

```typescript
function itIfReady(name: string, fn: () => Promise<void>) {
  if (!backendReady) {
    it.skip(`[SKIP: PeekView unavailable] ${name}`, fn);
  } else {
    it(name, fn);
  }
}
```

---

## 总结

### 评分

| 维度 | 本轮 | 上轮 | 变化 |
|------|------|------|------|
| 运行时正确性 | 9/10 | 6/10 | ↑↑↑ |
| 代码质量 | 7/10 | 7/10 | → |
| 测试质量 | 7/10 | 5/10 | ↑↑ |
| 安全性 | 5/10 | 7/10 | ↓↓（API Key 入库） |

**综合：7/10**（上轮 6.5，整体提升，但安全问题拉低评分）

### 最优先的两件事

**第一：立即 revoke `pv_RNsaFaHyOHzbydy4qCeF2eHWUkVTuHtY`。** 这个 key 已经在公开 Git 历史里，必须立即吊销，不能等下次 commit。

**第二：CI 层补多用户隔离的 mock 测试。** 集成测试依赖真实服务，CI 里永远跳过，核心功能没有 CI 验收。用 AsyncLocalStorage 的单元测试可以在不依赖后端的情况下验证并发 session 隔离。

修完这两个，代码质量可到 8.5/10，达到可信赖生产部署的水平。

---

*评审完成：2026-05-20*
