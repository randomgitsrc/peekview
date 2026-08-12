# SSE → Streamable HTTP 迁移方案专家评审

> 评审框架：gstack review（Staff Engineer + /cso 安全官）
> 日期：2026-06-09
> 评审对象：docs/plans/mcp-sse-to-streamable-http-migration.md
> 状态：初版评审（待交叉评审修订）

---

## 总体评价

方案识别了正确的技术债务（SSE 已废弃），影响域分析准确（传输层替换，工具逻辑零改动），自评审质量高（8/10）。但存在**三个 Critical 级别问题**和**两个 Important 级别问题**，必须在实施前解决。

**综合评分：初版 6/10，修正后可到 8/10。**

---

## Critical Issues

### C1：SDK 版本锁定在 1.4.0，但方案要求 ≥1.10.0——存在未验证的 breaking change 风险

**现状：** `package.json` 中 `@modelcontextprotocol/sdk` 锁死在 `"1.4.0"`，方案要求升级到 ≥1.10.0（StreamableHTTPServerTransport 所需）。

**风险：**
- SDK 1.4 → 1.10+ 跨了 6 个 minor，可能存在 breaking change
- `Server` 构造签名、`types` 导出、`setRequestHandler` 行为可能变化
- 如果 SDK 升级后现有 SSE 测试都挂了，说明 breaking change 真实存在

**自评审已提及此问题（Step 1 gate），但方案正文没有量化风险。** 需要明确：如果 Step 1 发现现有测试挂了，是回退 SDK 版本还是向前修复？

**建议修正：**
- 方案增加"Step 1 失败时的决策树"：
  - 如果是 types 导出路径变化 → 批量替换 import
  - 如果是 `Server` 构造签名变化 → 调整 `createMCPServer`
  - 如果是 SSE transport API 变化 → 先修 SSE 兼容再继续迁移
  - 如果 breaking change 过大（>1 天工作量）→ 拆分为独立 PR，不阻塞迁移

### C2：方案示例代码中 `server` 变量存在生命周期/作用域陷阱

方案 3.3 示例：
```typescript
const server = createMCPServer(tools);  // 模块级或外层作用域
// ...
const transport = new StreamableHTTPServerTransport({...});
await server.connect(transport);
```

**问题：** 如果 `server` 是外层（模块级或共享）实例，多会话共用同一个 `server` 对象。虽然 `Server` 本身轻量，但 `server.connect(transport)` 的行为在 SDK 中可能**替换**底层 transport，导致并发会话互相干扰。

**需要验证：** SDK 的 `Server.connect()` 是否支持多次调用（多 transport）？还是会抛出"already connected"或替换 transport？

**如果 `Server` 不支持多 connect：** 方案 3.4(a) "每会话一个 Server 实例" 是唯一可行路径，但示例代码没有体现 `createMCPServer(tools)` 在 initialize handler 内调用。

**建议修正：**
- 明确示例中 `server` 是在 initialize handler 内 `const server = createMCPServer(tools)` 创建的
- 或验证 `Server` 是否支持 `connect()` 多次调用
- 如果 SDK 文档未明确，写一个小测试验证

### C3：认证模型从"连接时"改为"initialize 时"，但缺少对重放攻击的考虑

SSE 模式下，认证在 `GET /sse` 建立连接时做一次，之后同一个 TCP 连接内的所有请求天然受认证保护。

Streamable HTTP 模式下，认证在 `POST /mcp` initialize 请求时做，之后靠 `mcp-session-id` 头识别会话。

**攻击场景：**
1. 攻击者截获合法用户的 `mcp-session-id` 头
2. 攻击者用该 session-id 发送 `POST /mcp` 请求（不带 Authorization）
3. 如果服务器仅检查 `mcp-session-id` 存在性，攻击者可复用会话

**当前方案示例：**
```typescript
if (sessionId && sessions.has(sessionId)) {
  // 直接复用，不检查 Authorization
}
```

**确实不检查 Authorization。** 这在 stateful 模式下是正常设计（session-id 就是凭证），但需要明确：
- session-id 是否足够随机（`randomUUID()` → 足够）
- session-id 传输是否安全（HTTPS → 足够）
- session-id 生命周期是否有限（30 分钟超时 → 足够）

**但如果用户用 HTTP（非 HTTPS），session-id 在传输中被截获的风险真实存在。**

**建议修正：**
- 文档明确：Streamable HTTP 必须使用 HTTPS（尤其是生产环境）
- 可选：每次请求验证 Origin + Referer，增加 DNS rebinding 层保护
- 明确 session-id 不是长期凭证，30 分钟超时后失效

---

## Important Issues

### I1：CORS 配置需要暴露 `mcp-session-id` 头，但方案只提了加 allowedHeaders

方案 Step 3：
```
allowedHeaders 加 mcp-session-id
exposedHeaders 加 mcp-session-id
methods 加 DELETE
```

**问题：** `exposedHeaders` 只在**跨域**场景下有意义。如果 Claude Code 和 MCP Server 在同一台机器（localhost），CORS 预检可能不触发。但如果 MCP Server 在远程、Claude Code 在本地，跨域场景下客户端 JS 需要读取 `mcp-session-id` 响应头——这时 `Access-Control-Expose-Headers: mcp-session-id` 必须设置。

**当前 `cors()` 配置：**
```typescript
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
```

没有 `exposedHeaders` 和 `credentials` 字段。

**建议修正：**
- CORS 配置改为：
  ```typescript
  app.use(cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'mcp-session-id'],
    exposedHeaders: ['mcp-session-id'],
    credentials: true,  // 如果将来用 Cookie
  }));
  ```

### I2：`express.json()` 中间件位置与认证顺序

方案提到"必须加 `app.use(express.json())`"，但没有明确**在 CORS 之后、路由之前**。

**如果顺序错了：**
```typescript
app.use(express.json());  // 先解析 body
app.use(cors());          // 后加 CORS → 预检请求可能不经过 CORS
```

正确顺序：
```typescript
app.use(cors({...}));     // 1. CORS 最先（处理 OPTIONS 预检）
app.use(express.json());  // 2. 然后解析 body
app.use((req, res, next) => { logger.info(...); next(); });  // 3. 日志
// 4. 路由
```

**建议修正：** 方案明确中间件顺序。

---

## Minor Issues

### M1：方案中 `version` 变量从 `package.json` 读取，但 Streamable HTTP 场景下 `Server` 构造可能需要重新考虑

当前 `server.ts`：
```typescript
const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
```

如果每会话创建一个新的 `Server` 实例，每次都要读 `package.json`。虽然开销可忽略，但不如缓存 `version`。

**建议：** 把 `version` 提升到模块级常量，不再每次读文件。

### M2：DELETE /mcp 的实现示例不完整

方案示例：
```typescript
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
```

**问题：** `entry.transport.handleRequest(req, res)` 在 DELETE 场景下是否正确？SDK 的 `StreamableHTTPServerTransport` 是否支持 DELETE 请求？如果不支持，可能需要直接 `transport.close()` 而不是 `handleRequest`。

**建议：** 实施时验证 DELETE 行为，或改为显式 `transport.close()` + `sessions.delete()`。

### M3：session 超时清理的 setInterval 在模块级，如果 createExpressApp 被调用多次会创建多个 interval

当前设计是 `createExpressApp` 内启动 `setInterval`。如果测试或某些场景多次调用 `createExpressApp`，会有多个 interval 同时运行。

**建议：** 用 `if (!globalCleanupStarted) { globalCleanupStarted = true; setInterval(...) }` 保护，或在 `createExpressApp` 返回的 app 上附加 cleanup 函数。

---

## 评审检查清单（实施前必须完成）

- [ ] C1：Step 1 失败时的决策树写入方案
- [ ] C2：验证 `Server.connect()` 是否支持多次调用，或改为每会话新建 Server
- [ ] C3：文档明确 HTTPS 必须 + session-id 安全说明
- [ ] I1：CORS 配置补 `exposedHeaders` 和 `credentials`
- [ ] I2：明确 express 中间件顺序（CORS → json → logger → routes）
- [ ] M1：version 缓存优化（可选）
- [ ] M2：DELETE 行为验证（实施时）
- [ ] M3：setInterval 重复启动保护（可选）

---

## 结论

方案方向正确，但存在三个 Critical 问题需要修正后才能进入实施：

1. **SDK 升级风险**（C1）— 需要明确的失败应对策略
2. **Server 生命周期**（C2）— 需要验证 SDK 行为或调整设计
3. **认证安全**（C3）— 需要明确 HTTPS 要求

修正后综合评分可达 8/10。

---

## 交叉评审（第二轮：安全架构师视角）

> 评审初版评审本身，发现初版存在过度评级和遗漏。

### 初版评审的修正

**C1 降级为 Important（原 Critical 过度）：**
- 方案已明确 Step 1 gate（先升级 SDK 跑现有测试），风险已被覆盖
- 初版评审说"方案正文没有量化风险"是对的，但标为 Critical 过度
- 实际风险：如果 Step 1 失败，最坏情况是延迟迁移，不是安全或数据损失
- **修正：** 降级为 Important，要求方案补充"Step 1 失败决策树"即可

**C2 降级为 Important（原 Critical 过度）：**
- 方案 3.4(a) 已明确"每会话一个 Server 实例"，文字描述正确
- 初版评审的问题是"示例代码模糊"，这是文档问题不是设计缺陷
- Server 是否支持多 connect 是 SDK 内部行为，即使不支持，按方案文字做即可
- **修正：** 降级为 Important，要求示例代码明确 `const server = createMCPServer(tools)` 在 initialize handler 内

**C3 降级为 Important（原 Critical 过度）：**
- stateful HTTP 靠 session-id 识别会话是正常设计，不是漏洞
- randomUUID() + HTTPS + 30 分钟超时 已足够安全
- 攻击前提是"用户用 HTTP 非 HTTPS"——这属于错误配置，不是方案缺陷
- **修正：** 降级为 Important，要求文档明确"生产环境必须使用 HTTPS"和"session-id 安全属性"

**I1 降级为 Minor（原 Important 过度）：**
- 初版评审误判了 MCP 客户端的性质
- Claude Code / Codex 等 MCP 客户端底层是 Node.js SDK（`StreamableHTTPClientTransport`），不是浏览器 JS
- MCP 客户端直接发 HTTP 请求，不受浏览器 CORS 限制
- `exposedHeaders` 只对浏览器 Web 应用有意义，MCP 客户端不需要
- **修正：** 降级为 Minor，保留 exposedHeaders 建议（无害），但不作为 blocking issue

**I2 降级为 Minor（原 Important 过度）：**
- express 中间件顺序（CORS → body parser → routes）是基础常识
- 方案未明确顺序是因为这是"默认做法"，不是设计决策
- **修正：** 降级为 Minor，在方案中补一行顺序说明即可

### 初版遗漏的问题

**新增 I3：客户端升级体验（Important）**
- 方案决策"直接切换，不保留 SSE 双跑"
- 但用户现有 Claude Code 配置是 SSE（`--transport sse http://.../sse`）
- 升级 v0.8.0 后，现有配置立即失效，用户必须手动改配置才能连上
- **建议：** 在 CHANGELOG 和 README 中明确标注 breaking change，给出旧配置→新配置的迁移命令

**新增 I4：session 内存存储的已知限制（Important）**
- `sessions` 是内存 Map，与 SSE 模式下的内存存储相同
- 但 Streamable HTTP 的"无状态扩展"卖点（方案背景中提到）实际上**没有实现**
- 如果用户用 pm2/cluster 启动多个进程，session 仍然不共享
- **建议：** 文档明确说明"当前实现仍为单进程内存 session，水平扩展需后续引入 Redis/共享存储"

**新增 M4：package.json 和 CLI description 中的 SSE 引用（Minor）**
- `package.json` description: "SSE transport" → 需改为 "Streamable HTTP transport"
- CLI help / `peekview-mcp --version` 输出可能含 SSE 描述
- **建议：** 全局搜索 "SSE" 字符串，更新所有用户可见的文案

**新增 M5：错误响应格式差异（Minor）**
- SSE 模式下错误通过 SSE event 返回（`event: error`）
- Streamable HTTP 模式下错误通过 HTTP status code + JSON body 返回
- 客户端（Claude Code SDK）会自动处理这种差异，但自定义客户端可能受影响
- **建议：** 文档注明错误响应格式变化

---

## 修正后评审检查清单

| 优先级 | 问题 | 修正 |
|---|---|---|
| 🔴 Important | I1（原 C1） | Step 1 失败决策树写入方案 |
| 🔴 Important | I2（原 C2） | 示例代码明确每会话新建 Server |
| 🔴 Important | I3（原 C3） | 文档明确 HTTPS 必须 + session-id 安全说明 |
| 🟠 Important | I4（新增） | CHANGELOG/README 标注 breaking change + 迁移命令 |
| 🟠 Important | I5（新增） | 文档说明单进程内存 session 限制 |
| 🟡 Minor | M1（原 I1） | CORS 加 exposedHeaders（无害，但非 blocking）|
| 🟡 Minor | M2（原 I2） | 明确 express 中间件顺序 |
| 🟡 Minor | M3（原 M1） | version 缓存优化 |
| 🟡 Minor | M4（原 M2） | DELETE 行为实施时验证 |
| 🟡 Minor | M5（原 M3） | setInterval 重复启动保护 |
| 🟡 Minor | M6（新增） | 全局替换 SSE 文案 |
| 🟡 Minor | M7（新增） | 注明错误响应格式变化 |

---

## 修正后结论

**初版评审存在评级过度（3 个 Critical 实际应为 Important），同时遗漏了客户端升级体验和 session 扩展性两个真实问题。**

**修正后综合评分：7/10 → 9/10（修正后）。**

方案本身设计正确，影响域分析准确，自评审质量高。主要工作是：
1. 降级 3 个 Critical → Important（避免阻塞）
2. 补充 2 个遗漏的 Important（客户端迁移、session 扩展性）
3. 补充 3 个 Minor（文案、错误格式、中间件顺序）

实施前必须完成：I1-I5（5 个 Important），M1-M7 可在实施中处理。

---

*交叉评审完成：2026-06-09*
*终版评审完成：2026-06-09*
