# MCP Server v0.8.0 实现评审 — Streamable HTTP 传输

> 评审日期：2026-06-10
> 评审角色：Staff Engineer / 安全官
> 评审对象：`packages/mcp-server/src/server.ts`、`src/index.ts`、`src/config.ts`、`src/types.ts`
> 评审方式：核查实现代码（非方案文档），编译 + 单元测试验证
> 测试状态：编译通过；单元测试 190 passed（1 failed 为需真实后端的 health/integration 测试，环境问题）

---

## 评审结论

MCP Server v0.8.0 的 SSE → Streamable HTTP 迁移实现质量高，传输迁移干净彻底。端点设计、认证模型、会话管理、Origin 防护、多用户隔离均正确实现。

发现 1 个真实 bug、1 个类型重复定义（与该 bug 同根因）、2 个健壮性问题、2 个轻微项。其中 BUG-1 与 ISSUE-1 建议发布前修复。

---

## 一、确认正确的部分

| 项 | 结论 |
|----|------|
| `POST /mcp` 四条路由分支 | 通过（已有会话复用 / 新会话 initialize / Origin 拒绝 / 无效请求 400）|
| 认证逻辑 | 通过（保留 pv_ 前缀 + validateToken，区分 401 无效 / 503 不可达）|
| `isValidOrigin` DNS rebinding 防护 | 通过（localhost 放行，通配符 `*` 显式不豁免 Origin 校验 — 这点尤其正确）|
| 会话清理 | 通过（空闲超时 + onclose + DELETE 三重清理）|
| `enableJsonResponse` + GET /mcp 405 | 通过（设计自洽，错误消息已是明确设计声明，非临时状态）|
| AsyncLocalStorage 多用户隔离 | 通过（handleRequest 包在 sessionContext.run 内，ctx 不串）|
| 测试隔离 | 通过（mkdtemp 唯一 HOME，不触碰真实 ~/.peekview）|

---

## 二、问题

### 🔴 BUG-1：health endpoint 的 `config.source` / `config.path` 永远是默认值

`server.ts` health 处理：

```js
config: {
  source: config.configSource || 'default',
  path: config.configPath || null,
  ...
}
```

但 `config` 来自 `loadConfig()` → `mergeConfig()`，返回的 `MergedConfig`（merge.ts:7）**没有 `configSource` / `configPath` 字段**。因此无论配置实际来自文件还是环境变量，`/health` 永远返回 `source: 'default'`、`path: null`。

`types.ts:ServerConfig` 声明了这两个 optional 字段，造成"类型上存在、运行时永远 undefined"的假象，掩盖了这个 bug。

**根因：** 见 ISSUE-1（ServerConfig 三处重复定义）。

**修复方向：** 在 `mergeConfig` 中实际计算并填充 `configSource`（依据 fileConfig 是否存在 + env 是否覆盖）和 `configPath`（配置文件路径），并加入 `MergedConfig` 接口。

---

### 🟡 ISSUE-1：`ServerConfig` 在三处重复定义，字段不同步

- `config.ts:7` `ServerConfig`：无 `configSource` / `configPath`
- `types.ts:50` `ServerConfig`：有这两个字段
- `merge.ts:7` `MergedConfig`：又没有这两个字段

三个接口描述同一个配置对象，字段各异，靠 TypeScript 结构化类型"碰巧"通过编译。`server.ts` import 的是 `types.ts` 版本（有 configSource），实际传入的是 `merge.ts` 版本（没有）—— 这正是 BUG-1 瞒过类型检查的原因。

**修复方向：** 三者合一。让 `MergedConfig` 成为唯一真相源，`config.ts`/`types.ts` re-export 它，或全部替换为 `MergedConfig`。

---

### 🟡 ISSUE-2：会话注册依赖 SDK 隐式时序，缺防御

```js
await sessionContext.run(ctx, () => transport.handleRequest(req, res, req.body));
if (transport.sessionId) {
  sessions.set(transport.sessionId, {...});
}
```

依赖"`StreamableHTTPServerTransport` 在处理 initialize 期间设置 `transport.sessionId`"这一隐式行为。已有注释说明，但若 SDK 未来改变 sessionId 设置时机，这里会静默失效（session 永不注册，每次请求都当新 initialize），无任何报错。

**修复方向：** 加防御性检查——`handleRequest` 后若 `transport.sessionId` 仍为空，记 error 日志（当前是静默跳过）。

---

### 🟢 LOW-1：`startSessionCleanup` 的 setInterval 未 `unref()`

```js
setInterval(() => {...}, CLEANUP_INTERVAL);
```

定时器会阻止 Node 进程自然退出。生产长驻无影响，但测试或优雅关闭时可能挂起进程。

**修复方向：** `setInterval(...).unref()`。

---

### 🟢 LOW-2：health endpoint 用 `any` 类型

```js
const healthResponse: any = {...};
```

绕过类型检查，与项目严格类型风格不一致。建议定义 `HealthResponse` interface。

---

## 三、评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 传输迁移正确性 | 9/10 | 端点、会话、Origin 防护都对 |
| 认证与隔离 | 9/10 | pv_ 校验 + AsyncLocalStorage 保留完好 |
| 类型健全性 | 6/10 | ServerConfig 三处重复，BUG-1 因此瞒过编译 |
| 健壮性 | 7/10 | 会话时序隐式依赖、interval 未 unref |
| 测试覆盖 | 9/10 | 190 passed，隔离干净 |

整体：**8/10** — 实现可用且质量好，BUG-1 + ISSUE-1（同根因）建议发布前修复。

---

## 四、修复优先级

| 优先级 | 项 | 根因关系 |
|--------|----|---------|
| 🔴 发布前 | BUG-1：health config 字段失真 | 与 ISSUE-1 同根因 |
| 🟡 发布前 | ISSUE-1：ServerConfig 三处合一 | BUG-1 的根因 |
| 🟡 建议 | ISSUE-2：会话注册加防御日志 | 独立 |
| 🟢 后续 | LOW-1：setInterval unref | 独立 |
| 🟢 后续 | LOW-2：HealthResponse 类型 | 独立 |

---

*评审完成：2026-06-10*
