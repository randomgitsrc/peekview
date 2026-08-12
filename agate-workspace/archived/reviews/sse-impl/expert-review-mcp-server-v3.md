# MCP Server 专家评审（第三轮）

> 评审角色：软件研发与业务专家（全面审查）
> 日期：2026-05-19
> 评审对象：`docs/superpowers/plans/2026-05-19-mcp-server.md`（v2修复后）
> 方法：逐 Task 全量检查，交叉核对后端 API 实际实现

---

## 上轮问题解决情况

| 问题 | 状态 |
|------|------|
| P0-1 sessionId 未传给客户端 | ✅ 已修：`new SSEServerTransport('/messages?sessionId=${sessionId}', res)` |
| P0-2 ping() 用业务接口 | ✅ 已修：改用 `/health` + AbortSignal.timeout |
| P0-3 createTools 签名不一致 | ✅ 已修：`createTools(client, config)` 两处同步 |
| P1 docker-compose 位置矛盾 | ⚠️ 部分修：File list 改为根目录，但 build.context 注释仍写 `packages/mcp-server/docker-compose.yml build` |
| P1 config.test.ts 缺新字段测试 | ✅ 已修：补了 8 个测试，覆盖所有必填字段 |
| P2 Task9 步骤缺环境变量 | ✅ 已修：补了 PEEKVIEW_PUBLIC_URL 和 MCP_TOKEN |

---

## 当前问题

### 🔴 P0 — 实现会出错

#### P0-1 `visibility` 字段与后端 API 不兼容

**现状：** `createEntry.ts` 和 `types.ts` 定义：
```typescript
visibility?: 'public' | 'private'
```

并直接传给后端：
```typescript
await client.createEntry({ ..., visibility: params.visibility })
```

**实际后端 API（`models.py:336`）：**
```python
is_public: bool | None = Field(default=None)
```

后端接受的是 `is_public: bool`，不是 `visibility: string`。传 `visibility: 'public'` 给后端，后端会忽略这个字段，`is_public` 保持默认 `True`——private entry 根本创建不了，且没有报错，silent bug。

**Fix：**
- `CreateEntryRequest` 改为 `is_public?: boolean`
- `createEntry.ts` schema 改为 `is_public: z.boolean().optional()`
- 工具 inputSchema 改为 `is_public: { type: 'boolean' }`
- Tool handler 映射：`is_public: params.is_public`
- Tool 输出文本：`${entry.is_public ? 'public' : 'private'}`（已正确，保留）

---

#### P0-2 `tags` 查询参数格式与后端不兼容

**现状：** `client.ts`：
```typescript
tags.forEach((tag) => params.append('tag', tag))
// 生成: ?tag=foo&tag=bar
```

**实际后端 API（`entries.py:111,120`）：**
```python
tags: str | None = Query(None)
tag_list = tags.split(",") if tags else None
```

后端期望逗号分隔字符串 `?tags=foo,bar`，不是多个 `tag=` 参数。当前实现传多个 `tag=` 参数，后端只读 `tags` 参数（单数），完全收不到过滤条件——silent bug，返回全量结果。

**Fix：**
```typescript
if (tags?.length) {
  params.append('tags', tags.join(','))  // 改为逗号分隔、参数名加s
}
```

---

### 🟠 P1 — 会导致运行时错误或构建失败

#### P1-1 `pino-pretty` 缺少依赖声明

**现状：** `server.ts` 使用：
```typescript
transport: process.env.NODE_ENV === 'development'
  ? { target: 'pino-pretty' }
  : undefined,
```

`pino-pretty` 是 pino 的独立包，需要单独安装，但 `package.json` 的 `devDependencies` 里没有 `pino-pretty`。

**影响：** `npm run dev` 时 pino 找不到 `pino-pretty` transport，直接抛异常。开发阶段就跑不起来。

**Fix：** `devDependencies` 加：
```json
"pino-pretty": "^10.0.0"
```

---

#### P1-2 `@types/uuid` 缺少类型声明

**现状：** `server.ts` 引入：
```typescript
import { validate as validateUUID } from 'uuid';
```

`uuid@9` 自带 TypeScript 类型（`.d.ts`），不需要单独 `@types/uuid`。但要确认 tsconfig `strict: true` 下能正确解析。

实际上 `uuid@9` 已内置类型，这条不是问题——**但**`devDependencies` 里缺少 `@types/uuid` 的声明（虽然不需要，但建议明确记录已核查），更重要的是计划里没有提到这一点，实现者可能会困惑。

**评级调低到 P2，见下。**

---

#### P1-3 docker-compose.yml 仍有错误注释

**现状：** Task 7 Step 2 的 docker-compose.yml 里仍有：
```yaml
services:
  peekview:
    image: peekview:latest
    # Build from backend directory (run from project root)
    # docker-compose -f packages/mcp-server/docker-compose.yml build  ← 错误路径
```

docker-compose.yml 已经在项目根目录了，但注释还写 `packages/mcp-server/docker-compose.yml`。实现者复制代码时会把这个错误注释写进实际文件，造成困惑。

**Fix：** 删除或改为：
```yaml
# Run from project root: docker-compose up -d
```

---

#### P1-4 `docker-compose.yml` 缺少 `PEEKVIEW_PUBLIC_URL`

**现状：** `docker-compose.yml` 的 `mcp-server` 环境变量里没有 `PEEKVIEW_PUBLIC_URL`：
```yaml
environment:
  - PEEKVIEW_URL=http://peekview:8080
  - PEEKVIEW_API_KEY=${PEEKVIEW_API_KEY}
  - MCP_TOKEN=${MCP_TOKEN}
  # ← 缺少 PEEKVIEW_PUBLIC_URL
```

`PEEKVIEW_PUBLIC_URL` 是必填字段（config.ts Zod schema 里 `required`），不设置 MCP Server 会在启动时直接 crash。

**Fix：**
```yaml
environment:
  - PEEKVIEW_URL=http://peekview:8080
  - PEEKVIEW_PUBLIC_URL=${PEEKVIEW_PUBLIC_URL}   # ← 新增
  - PEEKVIEW_API_KEY=${PEEKVIEW_API_KEY}
  - MCP_TOKEN=${MCP_TOKEN}
```

同时 README 的 Docker Compose Quick Start 和配置表也需要补上 `PEEKVIEW_PUBLIC_URL`。

---

### 🟡 P2 — 影响质量和完整性

#### P2-1 `server.test.ts` 和 `tools.test.ts` 仍然没有实现内容

File Structure 里列了这两个文件，但计划里从未写它们的实现代码。`client.test.ts` 和 `config.test.ts` 有完整代码，这两个没有。

直接影响：
- `npm test` 的实际覆盖只有 config（8个）+ client（5个），共 13 个测试
- server 的认证逻辑、SSE 连接建立、tool 的完整调用链——全部没有测试

**最低限度应补：**

`server.test.ts`（使用 supertest）：
- 无 token 请求 `/sse` → 401
- 错误 token → 401
- 有效 token 请求 `/health` → 200
- PeekView 不可达时 `/health` → 503
- 无效 sessionId POST `/messages` → 400

`tools.test.ts`：
- createEntry 工具正常调用
- createEntry 返回 URL 用的是 publicUrl 而非 peekviewUrl
- deleteEntry 无 confirm 返回确认提示而非直接删除
- listEntries 传 tags 时生成正确的 `?tags=foo,bar` 格式

---

#### P2-2 `client.test.ts` 缺少 ping() 测试

Task 4 新增了 `ping()` 方法，但 `client.test.ts` 里没有对应测试。

至少补：
- PeekView 健康时 `ping()` 返回 `true`
- PeekView 不可达时 `ping()` 返回 `false`（mock 网络错误）

---

#### P2-3 README 配置表缺少 `PEEKVIEW_PUBLIC_URL`

README 的 Configuration 表里没有 `PEEKVIEW_PUBLIC_URL`，但它是必填字段。NPM standalone 快速开始里也没有设置它。用户按 README 操作会直接启动失败。

**Fix：**
```markdown
| `PEEKVIEW_PUBLIC_URL` | Yes | - | Public URL for user-facing links (e.g. https://peek.example.com) |
```

NPM 快速开始补：
```bash
export PEEKVIEW_PUBLIC_URL=http://localhost:8080   # public URL shown to users
```

---

#### P2-4 `listEntries` Tool handler 调用参数顺序与 client 签名不符

**现状：** `listEntries.ts` handler：
```typescript
const result = await client.listEntries(
  params.page,
  params.per_page,
  params.query,
  params.tags
);
```

`client.ts` 签名：
```typescript
async listEntries(page = 1, perPage = 20, query?: string, tags?: string[])
```

`params.page` 在 Zod schema 里是 `z.number().int().positive().optional()`——可以是 `undefined`。传 `undefined` 给 `page` 参数，`params.append('page', undefined.toString())` 会抛 TypeError。

**Fix：**
```typescript
const result = await client.listEntries(
  params.page ?? 1,
  params.per_page ?? 20,
  params.query,
  params.tags
);
```

---

#### P2-5 `vitest` 找不到 `tests/` 目录（需要 vitest.config）

**现状：** `tsconfig.json` 的 `include` 是 `["src/**/*"]`，`tests/` 目录被 exclude 在外。`vitest` 默认查找 `**/*.{test,spec}.{js,ts}`，在无配置时能找到 `tests/`，但严格来说应该有 `vitest.config.ts` 明确配置。

`package.json` 的 `scripts.test` 是 `vitest run`，无配置文件时 vitest 可以工作，但：
- TypeScript 编译时 tests/ 目录不会被 tsc 处理（正确），但 vitest 的 ts 支持和 tsc 是独立的
- 没有配置文件意味着无法设置 `coverage`、`globals`、`environment` 等选项

**建议：** 新增 `vitest.config.ts`：
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

---

## 总结

### 修复优先级

| 级别 | 条目 | 说明 |
|------|------|------|
| 🔴 P0 | P0-1 visibility→is_public | 实现后无法创建 private entry，silent bug |
| 🔴 P0 | P0-2 tags 参数格式 | tag 过滤完全失效，silent bug |
| 🟠 P1 | P1-1 pino-pretty 缺依赖 | dev 模式无法启动 |
| 🟠 P1 | P1-3 docker-compose 错误注释 | 实现者会复制错误信息 |
| 🟠 P1 | P1-4 docker-compose 缺 PEEKVIEW_PUBLIC_URL | Docker 部署启动 crash |
| 🟡 P2 | P2-1 server.test + tools.test 空缺 | 核心逻辑无测试 |
| 🟡 P2 | P2-2 ping() 无测试 | 新功能无测试 |
| 🟡 P2 | P2-3 README 缺 PEEKVIEW_PUBLIC_URL | 用户按文档操作会失败 |
| 🟡 P2 | P2-4 listEntries undefined 参数 | 边界条件 TypeError |
| 🟡 P2 | P2-5 缺 vitest.config.ts | 配置不规范 |

### 评分

| 维度 | 本轮 | 上轮 | 变化 |
|------|------|------|------|
| 架构设计 | 8.5/10 | 8/10 | ↑ |
| 实现计划完整性 | 7/10 | 6.5/10 | ↑ |
| API 契约准确性 | 5/10 | — | 新发现 |
| 测试覆盖 | 5/10 | 6/10 | ↓（server/tools 仍空） |
| 部署可用性 | 6/10 | — | 新维度（docker缺PEEKVIEW_PUBLIC_URL） |

**综合：6.5/10**

两个 P0 是这轮最重要的发现：`visibility` 和 `tags` 参数都与后端实际 API 不兼容，实现后功能看似正常但实际上 private 创建无效、tag 过滤失效，都是 silent bug，测试阶段很容易漏掉。

建议在修 P0 的同时，同步补上 `tools.test.ts` 里对应的测试用例，确保回归。

---

*评审完成：2026-05-19*
