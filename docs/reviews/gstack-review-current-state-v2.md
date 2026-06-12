# 当前状态评审二次核查

> 评审框架：gstack review（Staff Engineer）
> 日期：2026-06-10
> 评审对象：docs/reviews/expert-review-current-state-2026-06-10.md
> 方式：核查评审里的技术声称，确认哪些准确、哪些需要修正

---

## 评审质量总结

这份评审整体质量高——测试状态、CHANGELOG 缺失、CLAUDE.md 版本滞后、发布前待办清单都是准确的。主要核查结论如下。

---

## 核查结论

### ✅ 准确的部分

**4.1 核心变更描述**：正确。`SSEServerTransport` → `StreamableHTTPServerTransport`，端点从 `/sse`+`/messages` 改为 `/mcp`，会话 ID 从 query param 改为 `mcp-session-id` header。

**4.4 ServerConfig 与 MergedConfig 不一致**：部分准确。`types.ts:ServerConfig` 确实**已包含** `mode`、`allowedPaths`、`trustAllPaths`（第 58-60 行），所以"类型安全幻觉"的说法不成立。但 `MergedConfig`（`config/merge.ts`）还额外有 `configSource`、`configPath` 等字段，这两个字段在 `ServerConfig` 里缺失——这才是真正的不一致点，比评审描述的范围小。

**4.6 会话注册双检查逻辑**：评审判断方向正确，但结论需要修正——见下方。

**测试状态**：Backend 417 + MCP 166 全通过，准确。

**发布前待办清单**：CHANGELOG 缺 3 个版本、CLAUDE.md 版本滞后、4 个提交未推送——全部准确，是真实的发布阻塞项。

---

### ❌ 需要修正的判断

#### 修正 1：4.3 createExpressApp 签名问题——结论有误

评审说：
> `index.ts` 传的第二个参数是一个内联对象，只包含部分 ServerConfig 字段（不含 `mode`、`allowedPaths`、`trustAllPaths`）

**实际代码（index.ts:76-80）：**
```typescript
const app = createExpressApp(tools, {
  ...config,   // ← spread 了完整的 config（loadConfig() 返回的 MergedConfig）
  port,
  host,
}, client);
```

`...config` 把 loadConfig() 的全部字段都展开了，`mode`、`allowedPaths`、`trustAllPaths`、`configSource`、`configPath` 全部包含在内。只是 port/host 两个字段被 CLI 参数覆盖（合理行为）。

**修正：** 4.3 的问题不成立，`health` 端点的 `config.source` 和 `config.path` 会正确返回，不会 null。评审里的这个"中等"问题可以关闭。

#### 修正 2：4.6 会话注册——不是双检查，已是单次注册

评审说存在"两次注册尝试"，但实际代码（server.ts:228-248）只有**一次**注册：

```typescript
await server.connect(transport);

// Handle the initialize request within context
await sessionContext.run(ctx, () =>
  transport.handleRequest(req, res, req.body)
);

// Register session after handleRequest
// (sessionId is set by SDK during initialize processing)
if (transport.sessionId) {
  sessions.set(transport.sessionId, { ... });
}
```

没有 `handleRequest` 前的注册尝试，代码注释也明确说明了 sessionId 在 handleRequest 处理期间被 SDK 设置。这是正确的单次注册，不是"双检查"。

评审 4.6 描述的代码（两次 `sessions.set`）与实际实现不符，该问题不成立。

---

### ⚠️ 评审遗漏的问题

#### 遗漏 1：Origin 校验在无 Origin 头时的行为

`isValidOrigin(origin, corsOrigins)` 函数当 `origin` 为 `undefined` 时的行为未在评审中提及。

若函数对无 Origin 头返回 `false`，则所有非浏览器客户端（curl、SDK 直连等）都会被 403 拒绝——这会破坏实际使用。若返回 `true`，DNS rebinding 防护在无 Origin 头时实际失效。需要核查实现：
<function_calls>
<invoke name="bash_tool">
<parameter name="command">grep -n "isValidOrigin\|function.*Origin" /home/claude/peekview/packages/mcp-server/src/server.ts | head -5
echo "==="
sed -n '145,165p' /home/claude/peekview/packages/mcp-server/src/server.ts