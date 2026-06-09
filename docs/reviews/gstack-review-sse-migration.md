# SSE → Streamable HTTP 迁移方案自评审

> 评审框架：gstack review（Staff Engineer + /cso）
> 日期：2026-06-09
> 评审对象：docs/plans/mcp-sse-to-streamable-http-migration.md
> 方式：实现前自评审，核查 SDK API 与现有代码契合度

---

## 评审结论

方案整体扎实，影响域分析准确（传输层替换，工具逻辑不动）。发现 4 个需要修正/补充的点。

---

## 需要修正

### 问题 1：方案示例混用了 McpServer 和低层 Server，与现有代码不一致

**现状：** 现有 `server.ts` 用的是**低层 `Server`**（`@modelcontextprotocol/sdk/server/index.js`）+ `setRequestHandler`，不是高层 `McpServer`。

但方案 3.3 的示例参考了网上的 `McpServer` 写法。两者 API 不同：
- `McpServer`：`server.tool(name, schema, handler)` 注册
- `Server`（现有）：`server.setRequestHandler(CallToolRequestSchema, ...)` 注册

**修正：** 方案应明确沿用现有低层 `Server` + `createMCPServer(tools)` 模式，不引入 `McpServer`。`StreamableHTTPServerTransport` 对两者都兼容（都通过 `server.connect(transport)` 连接）。这降低改动面——`createMCPServer` 函数体几乎不动，只改外层 transport。

### 问题 2：工具是纯请求-响应式，可用 enableJsonResponse 简化，不需要 GET SSE 流

**发现：** PeekView 的所有工具（create_entry / publish_files / get / list / delete）都是**请求-响应式**——客户端发请求，服务器返回结果，没有服务器主动推送（progress notification 是未来增强，当前没有）。

对这种场景，`StreamableHTTPServerTransport` 可以设 `enableJsonResponse: true`，直接返回 JSON 响应而不是 SSE 流。这样：
- 不需要 `GET /mcp` 的 SSE 流端点（除非将来加 progress notification）
- 响应是普通 JSON，更简单，对代理更友好

**修正：** 方案改为 `enableJsonResponse: true`，初版不实现 `GET /mcp` SSE 流。保留 DELETE（会话终止）。如果将来加进度通知（backlog #11），再启用 GET 流。

**注意权衡：** enableJsonResponse 下，如果将来要服务器推送，需要改回 SSE 流模式。但当前 YAGNI，简单优先。

### 问题 3：stateful/stateless 模式未明确选定

方案 3.4 提了每会话独立 server，但没明确 `sessionIdGenerator` 是否设值（stateful vs stateless）。

**分析：**
- PeekView 工具本身无状态（每次调用独立）
- 但**认证需要会话关联**——initialize 时认证一次，后续请求复用，不能每个工具调用都重新 validateToken（多一次 PeekView 往返）

**修正：明确用 stateful 模式**（`sessionIdGenerator: () => randomUUID()`）。认证在 initialize 时做一次，userToken 绑定到 session，后续工具调用复用。这符合"多 Agent 共享、每 Agent 一会话"的场景。

### 问题 4：session 内存泄漏防护需要更具体

方案提了 onclose/DELETE 清理，但多 Agent 长时间运行下，如果客户端异常断开（没发 DELETE，onclose 也没触发），session 会泄漏。

**补充：** 加 session 空闲超时清理：
```typescript
// 每个 session 记录 lastActivity，定期清理超时的
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 分钟
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.lastActivity > SESSION_IDLE_TIMEOUT) {
      entry.transport.close?.();
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000); // 每 5 分钟检查
```
每次 handleRequest 更新 `lastActivity`。

---

## 补充建议

### 建议 1：Origin 校验的默认策略要明确

方案提了 Origin 校验防 DNS rebinding，但没说默认行为。

**明确：**
- 默认放行：localhost / 127.0.0.1 / 配置的 corsOrigins
- 其他 Origin 拒绝
- 与现有 CORS 配置统一（不要两套 origin 逻辑）

### 建议 2：迁移前先验证 SDK 升级的影响（Step 1 加 gate）

SDK 1.4 → 1.10+ 跨了 6 个 minor 版本，可能有 breaking change（types 导出、Server 构造签名等）。

**Step 1 应该是一个明确的 gate：** 只升级 SDK、不改任何代码，先跑现有全部测试。如果现有测试（还是 SSE 的）在新 SDK 上跑挂了，说明 SDK 有 breaking change，要先处理这些，再做传输迁移。把"SDK 升级"和"传输迁移"两个变更解耦，便于定位问题。

### 建议 3：测试要验证"工具逻辑零改动"

迁移的核心卖点是"工具逻辑不动"。测试应该有一条专门验证：**迁移后，tools.test.ts 和 publishFiles.test.ts 一个字符都不用改就全过**。如果这两个测试需要改，说明迁移泄漏到了工具层，违背设计目标，要回头检查。

---

## 评审结论

| 维度 | 评分 | 说明 |
|------|------|------|
| 影响域分析 | 9/10 | 准确区分了改与不改 |
| 设计正确性 | 7/10 | McpServer/Server 混淆、GET 流冗余需修 |
| 测试完整性 | 8/10 | 覆盖全，补充"工具零改动"验证 |
| 风险控制 | 8/10 | 回滚方案好，SDK 升级 gate 需强化 |

**修正后进入实施：**
1. 沿用低层 Server，不引入 McpServer
2. enableJsonResponse: true，初版不做 GET SSE 流
3. 明确 stateful 模式（认证一次复用）
4. 加 session 空闲超时清理
5. Origin 校验默认策略明确（复用 corsOrigins）
6. Step 1 作为 SDK 升级 gate（先升级跑旧测试）
7. 测试验证工具逻辑零改动

综合 8/10，修正后可实施。

---

*自评审完成：2026-06-09*
