# `/plan-eng-review` — MCP Server 工程评审

> 评审角色：工程经理（gstack /plan-eng-review）
> 评审人：Claude Sonnet 4.6
> 日期：2026-05-19
> 评审对象：
> - `docs/specs/spec-mcp-server.md`
> - `docs/superpowers/plans/2026-05-19-mcp-server.md`
> 背景：PeekView v0.1.29，FastAPI + Vue3 + SQLite，单机部署

---

## 架构问题（阻塞级）

### [BLOCK-1] `createExpressApp` 调用缺少 `config` 参数

`src/index.ts`（Task 6 Step 2）：
```typescript
const app = createExpressApp(mcpServer);  // ← 只传了 mcpServer
```

但函数签名是：
```typescript
export function createExpressApp(server: Server, config: ServerConfig)
```

`loadConfig()` 的结果只在 `main()` 里，没有往下传。直接按计划实现会在启动时崩溃。

**Fix：**
```typescript
const app = createExpressApp(mcpServer, config);  // 补上 config
```

---

### [BLOCK-2] `createEntry` 返回 URL 用了内网地址

`createEntry.ts`：
```typescript
const baseUrl = process.env.PEEKVIEW_URL?.replace(/\/$/, '') || 'http://localhost:8080'
// Docker 部署时: "http://peekview:8080/slug" ← 内网地址，用户点击无效
```

Docker 部署时 `PEEKVIEW_URL=http://peekview:8080`（容器内网），返回给 AI Client 的 URL 用户根本打不开。

**Fix：** 新增环境变量 `PEEKVIEW_PUBLIC_URL`，与 `PEEKVIEW_URL` 分离：

| 变量 | 用途 |
|------|------|
| `PEEKVIEW_URL` | MCP Server → PeekView API 的内部通信地址 |
| `PEEKVIEW_PUBLIC_URL` | 返回给用户的可访问 URL |

需要同步更新：
- `config.ts` schema 加 `PEEKVIEW_PUBLIC_URL`
- `types.ts` `ServerConfig` 加 `publicUrl: string`
- `createEntry.ts` 改用 `config.publicUrl` 拼 URL
- `spec-mcp-server.md` 第 4.1 节环境变量表补入

---

### [BLOCK-3] `SSEServerTransport.sessionId` 依赖未验证

`server.ts` 依赖：
```typescript
const sessionId = transport.sessionId;
sessions.set(sessionId, transport);
```

`@modelcontextprotocol/sdk` 里 `SSEServerTransport` 不一定暴露 `sessionId` 属性，依赖 SDK 具体版本。计划里没有验证这一步，按当前写法实现有 `undefined` 静默 bug 的风险（所有 session 都写入同一个 key）。

**Fix：** Task 6 实现前先执行：
```bash
cd packages/mcp-server && npm install
node -e "const {SSEServerTransport} = require('@modelcontextprotocol/sdk/server/sse.js'); console.log(Object.getOwnPropertyNames(SSEServerTransport.prototype))"
```

确认 `sessionId` 存在。若不存在，改为自己生成 UUID：
```typescript
import { randomUUID } from 'crypto';
const sessionId = randomUUID();
sessions.set(sessionId, transport);
// 通过 SSE 初始消息告知客户端 sessionId
```

---

## 架构问题（非阻塞）

**[TD-MCP-01] sessions Map 是单进程内存结构**
`sessions` 跨进程不共享，无法水平扩展。当前单机部署不是问题，但需在 README 和 spec 里明确标注"单进程限制"，防止将来误用。记录为技术债。

**[TD-MCP-02] `listEntries` query 参数名未核查**
`client.ts` 用 `params.append('q', query)`，但未确认后端接口实际参数名是 `q` 还是 `query`。传错参数名后端不报错，只返回未过滤的全量结果——silent bug。

**Fix：** Task 4 之前先确认：
```bash
grep -n "q\b\|query" /home/claude/peekview/backend/peekview/api/entries.py | head -10
```

**[TD-MCP-03] `docker-compose.yml` 放置位置自相矛盾**
Task 7 Step 2 注释写 `packages/mcp-server/docker-compose.yml`，但 Step 2 末尾又说"应放在项目根目录"。需锁定：**放项目根目录**，`packages/mcp-server/` 不放。

**[TD-MCP-04] MCP_TOKEN 缺少生成指引**
README 只写"any secure string you choose"，没有给生成命令。对比 `PEEKVIEW_API_KEY` 有 `peekview apikey create`，体验不一致。

**Fix：** README Quick Start 补：
```bash
export MCP_TOKEN=$(openssl rand -hex 32)
```

---

## 测试缺口

**`server.test.ts` 内容为空**
计划里只列了文件名，没有写测试内容。最关键的认证场景完全没覆盖：
- 无 token 连接 `/sse` → 期望 401
- 错误 token → 期望 401
- 正确 token → 期望建立 SSE 连接
- `/messages` 未知 sessionId → 期望 404

**`config.test.ts` 缺少 MCP_TOKEN 缺失测试**
现有测试只覆盖了 `PEEKVIEW_URL` 和 `PEEKVIEW_API_KEY` 缺失的情况，`MCP_TOKEN` 缺失没有测试。

---

## 锁定决策

实现前需确认以下 5 项，不确认不开始写代码：

| # | 决策 | 操作 |
|---|------|------|
| 1 | `PEEKVIEW_PUBLIC_URL` 加入环境变量 | 更新 spec + config + types + createEntry |
| 2 | `docker-compose.yml` 放项目根目录 | 从计划中删除 packages/mcp-server/ 路径 |
| 3 | `createExpressApp` 补全 config 参数 | 修正 Task 6 Step 2 代码 |
| 4 | 实现 Task 4 前核查后端 query 参数名 | `grep` 确认后再写 client.ts |
| 5 | 实现 Task 6 前验证 `SSEServerTransport.sessionId` | npm install 后读 SDK API |

---

## 总结

方向完全正确，架构设计质量高——双层认证、CORS 配置、Docker 多阶段构建、Zod 校验都到位，是一份认真写的实现计划。

3 个阻塞 bug 都是细节疏漏，修正成本低（每个 < 10 行改动），不影响整体进度。建议在当前计划文档上直接修正后再开始实现，而不是实现到一半发现问题再回头改。

*评审完成：2026-05-19*
