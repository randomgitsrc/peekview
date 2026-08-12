# main 分支当前状态评审（v0.1.42 / MCP v0.8.0-local）

> 评审日期：2026-06-10
> 评审对象：main 分支 HEAD `67a2f06e release: bump MCP Server to v0.8.0 (Streamable HTTP)`
> 评审范围：SSE→Streamable HTTP 迁移、版本/tag 一致性、CHANGELOG、文档同步、测试状态、发布就绪度
> 前置评审：`expert-review-main-after-pull-2026-06-09.md`（上次评审，已解决大部分阻塞项）

---

## 评审结论

自上次评审以来，项目取得了显著进展：

- MCP Server 已从 v0.7.0 迭代至 v0.8.0，经过 v0.7.1~v0.7.3 的安全加固和功能完善。
- SSE 传输已迁移至 Streamable HTTP，符合 MCP 协议最新规范。
- `publish_files` 的安全模型已大幅增强（denylist 扩展、`trust_all_paths`、cwd+tmpdir 默认策略、`is_public=false` 默认值）。
- 测试隔离已完全修复（mkdtemp 唯一 HOME，不再触碰真实 `~/.peekview`）。
- `PEEKVIEW_SERVER__HOST` 默认值已在 CLAUDE.md / README.md 中修正为 `0.0.0.0`。
- CLAUDE.md 环境变量表已补全至 33 项。

**但当前仍存在发布阻塞项：** MCP v0.8.0 的 4 个本地提交尚未推送到 origin，CHANGELOG 缺少 `[mcp-v0.7.2]`/`[mcp-v0.7.3]`/`[mcp-v0.8.0]` 条目，CLAUDE.md 仍声明 MCP v0.7.0，缺少 `mcp-v0.8.0` tag。

结论：**不建议推送到 origin 或发布 npm。需先完成 CHANGELOG、CLAUDE.md 版本同步、git push 和 tag。**

---

## 一、版本号与 tag 状态

| 项 | 当前值 | 状态 | 说明 |
|----|--------|------|------|
| `backend/peekview/__init__.py` | `0.1.42` | 通过 | |
| `backend/pyproject.toml` | `0.1.42` | 通过 | |
| `frontend-v3/package.json` | `0.1.42` | 通过 | |
| `packages/mcp-server/package.json` | `0.8.0` | 通过 | 与 SSE→Streamable 迁移匹配 |
| Backend tag `v0.1.42` | 存在 | 通过 | |
| MCP tag `mcp-v0.7.0` ~ `mcp-v0.7.3` | 存在 | 通过 | |
| MCP tag `mcp-v0.8.0` | 缺失 | 失败 | 本地提交未推送，tag 未创建 |
| CLAUDE.md MCP 版本 | `v0.7.0` | 失败 | 实际已到 v0.8.0 |

### 本地领先 origin 的提交

```
67a2f06e release: bump MCP Server to v0.8.0 (Streamable HTTP)
f959fe7f chore: update package.json description and E2E test comments for v0.8.0
f7c89392 docs: update SSE references to Streamable HTTP
dc4390b5 feat(mcp): migrate from SSE to Streamable HTTP transport
```

这 4 个提交尚未推送到 origin。

---

## 二、CHANGELOG 状态

CHANGELOG 当前最新条目为 `[mcp-v0.7.1]`，缺少以下版本的记录：

| 缺失版本 | 对应提交 | 重要性 |
|----------|----------|--------|
| `[mcp-v0.7.2]` | `0473007c chore(release): bump MCP to v0.7.2` + `066d183c feat(mcp): add config allowed_path add/remove/list CLI commands` | 用户可感知：CLI 命令新增 |
| `[mcp-v0.7.3]` | `86c4d606 chore(release): bump MCP to v0.7.3` + `7f3f6476 fix(mcp): prevent tests from deleting real ~/.peekview/mcp-config.yaml` | 维护者可感知：测试安全修复 |
| `[mcp-v0.8.0]` | `dc4390b5 feat(mcp): migrate from SSE to Streamable HTTP transport` + 后续 3 提交 | 用户可感知：传输协议迁移，breaking change |

其中 `[mcp-v0.8.0]` 是必须记录的 breaking change：SSE 传输已被替换为 Streamable HTTP，客户端需同步升级。

---

## 三、CLAUDE.md 文档同步

### 已修正（vs 上次评审）

- `PEEKVIEW_SERVER__HOST` 默认值已修正为 `0.0.0.0`。
- 环境变量表已补全至 33 项，与 `config.py` 一致。
- Architecture 行已更新为 "Streamable HTTP transport"。

### 仍需修正

| 行 | 当前内容 | 应修正为 | 原因 |
|----|----------|----------|------|
| 9 | `MCP Server v0.7.0 dual-mode implementation has been released to npm` | `MCP Server v0.8.0 (Streamable HTTP transport) has been released to npm` | 版本过时 |
| 10 | `MCP Server v0.7.0` | `MCP Server v0.8.0` | 版本过时 |
| 156 | `### MCP Server Architecture (v0.7.0)` | `### MCP Server Architecture (v0.8.0)` | 版本过时 |
| 163 | `uses server.allowed_paths or cwd fallback, rejects cwd /` | `uses server.allowed_paths or cwd+tmpdir fallback, trust_all_paths option, rejects cwd /` | publish_files 安全策略已变更 |
| 166 | `MCP Server v0.7.0 requires PeekView Backend v0.1.25+` | `MCP Server v0.8.0 requires PeekView Backend v0.1.25+` | 版本过时 |

---

## 四、SSE → Streamable HTTP 迁移评审

### 4.1 核心变更

提交 `dc4390b5` 将 MCP Server 从 SSE 传输迁移至 Streamable HTTP：

- **传输层**：`SSEServerTransport` → `StreamableHTTPServerTransport`
- **端点**：`/sse` + `/messages` → `POST /mcp`（+ `GET /mcp` SSE 流 + `DELETE /mcp` 会话终止）
- **会话管理**：sessionId 通过 `mcp-session-id` header 传递，而非 query parameter
- **DNS Rebinding 防护**：新增 `isValidOrigin()` 检查
- **SDK 升级**：`@modelcontextprotocol/sdk` 更新以支持 `StreamableHTTPServerTransport`

### 4.2 核查通过项

| 项 | 结论 |
|----|------|
| Streamable HTTP 端点实现（POST/GET/DELETE /mcp） | 通过 |
| 认证逻辑保持 pv_ prefix check + PeekView API 验证 | 通过 |
| 会话生命周期（initialize → reuse → timeout → DELETE 终止） | 通过 |
| DNS rebinding 防护 | 通过 |
| Health endpoint 不变 | 通过 |
| 向后兼容：旧 SSE 客户端无法连接（breaking change，符合预期） | 通过 |

### 4.3 问题 1（中等）：`server.ts` 中 `createExpressApp` 签名与 `index.ts` 调用不一致

**`server.ts` 签名：**

```ts
export function createExpressApp(
  tools: ToolDefinition[],
  config: ServerConfig,
  client: PeekViewClient
): express.Application
```

**`index.ts:89` 调用：**

```ts
const app = createExpressApp(tools, { ... }, client);
```

参数顺序已从 `(tools, opts, client)` 变为 `(tools, config, client)`，但 `index.ts` 传的第二个参数是一个内联对象，只包含部分 ServerConfig 字段（不含 `mode`、`allowedPaths`、`trustAllPaths`）。

**风险**：`createExpressApp` 内部的 health check 使用 `config.configSource` 和 `config.configPath`，这些字段在 `index.ts` 传入的内联对象中不存在（为 `undefined`），可能导致 `/health` 响应中 `config.source` 和 `config.path` 始终为 `null`。

**建议**：将完整的 `config`（即 `loadConfig()` 返回的 `MergedConfig`）传入 `createExpressApp`，而非手动挑选字段。或者让 `ServerConfig` 接口将 `configSource` / `configPath` 标为 optional 并在 health check 中处理 `undefined`。

---

### 4.4 问题 2（中等）：`types.ts` 中 `ServerConfig` 接口与 `config/merge.ts` 的 `MergedConfig` 不一致

`types.ts:ServerConfig` 缺少 `mode`、`allowedPaths`、`trustAllPaths` 字段，这些字段在 `merge.ts:MergedConfig` 中存在。`createTools(client, config)` 接收 `ServerConfig`，但实际需要 `mode` 来决定工具集。

当前代码能工作是因为 TypeScript 的结构化类型系统——`MergedConfig` 满足 `ServerConfig` 的所有字段，多余字段不影响类型检查。但这会导致类型安全幻觉：任何人看 `types.ts` 的 `ServerConfig` 都不会知道还有 `mode` 字段。

**建议**：统一 `ServerConfig` 和 `MergedConfig`，或将 `ServerConfig` 改为 `MergedConfig` 的别名/superset。让类型定义反映运行时实际使用的字段。

---

### 4.5 问题 3（轻微）：`GET /mcp` 返回 405 但注释说"not yet implemented"

`server.ts:206`:

```ts
app.get('/mcp', async (_req, res) => {
  res.status(405).json({ error: 'SSE streaming not yet implemented. Use POST /mcp with enableJsonResponse.' });
});
```

Streamable HTTP 规范中 `GET /mcp` 用于 SSE 通知流，返回 405 是合理的。但错误消息暗示这是临时状态，而非有意设计决策。如果确定不需要服务端推送通知，建议改为明确的 405 说明（如 "Server-initiated notifications not supported. Use POST /mcp for all client requests."）。

---

### 4.6 问题 4（轻微）：会话注册存在时序竞争

`server.ts:168-183`:

```ts
// Register session after onsessioninitialized equivalent
const originalSessionId = transport.sessionId;
if (originalSessionId) {
  sessions.set(originalSessionId, { ... });
}

await sessionContext.run(ctx, () => transport.handleRequest(req, res, req.body));

if (transport.sessionId && !sessions.has(transport.sessionId)) {
  sessions.set(transport.sessionId, { ... });
}
```

存在两次注册尝试：
1. 在 `handleRequest` 前检查 `transport.sessionId`（此时可能为 `undefined`，因为 initialize 尚未处理）。
2. 在 `handleRequest` 后检查。

第一次注册几乎总是空操作（`originalSessionId` 为 `undefined`），第二次才会真正注册。但这段代码暗示开发者不确定 `sessionId` 何时可用，可能导致后续维护困惑。

**建议**：只保留 `handleRequest` 后的注册，删除第一次检查，并添加注释说明 `StreamableHTTPServerTransport` 在处理 `initialize` 请求期间设置 `sessionId`。

---

## 五、publish_files v0.7.1+ 安全增强评审

自上次评审后，`publish_files` 经历了重大安全加固（v0.7.1 ~ v0.7.3）：

### 已改善项

| 项 | 改善前 | 改善后 | 评审意见 |
|----|--------|--------|----------|
| 默认路径策略 | cwd fallback（systemd cwd=/ 危险） | cwd + tmpdir fallback，cwd=/ 拒绝 | 通过 |
| `is_public` 默认值 | `true` | `false` | 通过，更安全 |
| denylist 覆盖范围 | 8 条规则 | 30+ 条规则，覆盖云/IaC/editor/浏览器 | 通过 |
| `/tmp` owner 检查 | 无 | `process.getuid()` 检查，TOCTOU 已记录 | 通过 |
| `trust_all_paths` | 无 | 新增危险选项，显式 warning | 通过 |
| 错误信息 | 简单拒绝 | 区分 sensitive/out_of_scope/tmp_owner，给出修复命令 | 通过 |
| 工具描述 | 含 emoji | 纯文本 `ERROR:`/`OK:`/`Link:` 前缀 | 通过 |
| CLI `config` 命令 | 无 allowed_path 管理 | 新增 add/remove/list 子命令 | 通过 |
| `baseForRel` | `path.dirname(realPath)` | `realPath`（目录自身） | 通过，上次评审发现的问题已修复 |

### 仍存在项

| 项 | 说明 | 严重程度 |
|----|------|----------|
| `looksBinary` 仅检查前 8000 字节 | UTF-16/GB2312 等非 UTF-8 文本文件可能误判 | 轻微 |
| `matchPattern` 含 `/` 的 pattern 未防护 | `src/*.py` 会匹配为 `^src/[^/]*\.py$`，不符合"只支持文件名通配"的设计意图 | 轻微 |

这两项均为边界情况，不影响正常使用，可作为后续优化。

---

## 六、测试状态

### Backend

```
417 passed, 1 skipped, 1 warning
```

通过。1 个 warning 是 `test_cli_remote.py` 的 `pytest.mark.integration` 未注册，不影响功能。

### MCP Server

```
12 test files passed, 166 tests passed
```

通过。测试隔离完全修复——每个 test file 获得唯一的 mkdtemp HOME，teardown 正确清理。

### MCP build

```
tsc — 编译成功，无错误
```

通过。

---

## 七、发布前待办

### 阻塞推送/发布

- [ ] 补全 CHANGELOG.md：新增 `[mcp-v0.7.2]`、`[mcp-v0.7.3]`、`[mcp-v0.8.0]` 条目
- [ ] 更新 CLAUDE.md 第 9、10、156、166 行的 MCP 版本为 v0.8.0
- [ ] 更新 CLAUDE.md 第 163 行的 publish_files 安全策略描述
- [ ] 创建 `mcp-v0.8.0` tag
- [ ] 推送 4 个本地提交 + tag 到 origin

### 建议发布前完成

- [ ] 统一 `types.ts:ServerConfig` 和 `config/merge.ts:MergedConfig` 接口
- [ ] 将 `index.ts` 中 `createExpressApp` 的内联 config 对象改为传入完整 `MergedConfig`
- [ ] 简化 `server.ts` 中会话注册的双检查逻辑

### 后续优化

- [ ] `GET /mcp` 错误消息改为明确的设计决策说明
- [ ] `looksBinary` 增强：扩展名白名单或 UTF-16 BOM 检测
- [ ] `matchPattern` 拒绝含 `/` 的 pattern 或支持路径 glob

---

## 八、与上次评审的对比

| 上次评审阻塞项 | 当前状态 |
|---------------|----------|
| MCP package.json 版本 0.1.41 未更新 | 已更新至 0.8.0 |
| CLAUDE.md 声明 MCP v0.6.0 | 已更新至 v0.7.0（但未到 v0.8.0） |
| CHANGELOG v0.1.41 条目为空 | 已补全 |
| v0.1.41 tag 缺失 | 已创建 |
| 测试隔离未修复 | 已修复（mkdtemp 唯一 HOME） |
| publishFiles baseForRel 使用 path.dirname | 已修复（使用 realPath） |
| cwd fallback 安全风险 | 已修复（cwd+tmpdir 策略，cwd=/ 拒绝） |
| publish_files 输出含 emoji | 已修复（纯文本前缀） |
| npm test 包含 integration/e2e | 已修复（`npm test` = `npm run test:unit`） |
| 环境变量表缺失 ~18 项 | 已补全至 33 项 |
| PEEKVIEW_SERVER__HOST 文档不一致 | 已修正为 0.0.0.0 |

**上次评审 10 项阻塞/建议中，9 项已完全解决，1 项（CLAUDE.md MCP 版本）部分解决但需再更新到 v0.8.0。**

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 版本一致性 | 8/10 | Backend 三处一致；MCP package.json 正确；CLAUDE.md 滞后于 v0.8.0 |
| 代码质量 | 8/10 | SSE→Streamable 迁移质量高；publish_files 安全模型成熟；类型定义存在不一致 |
| 测试覆盖 | 9/10 | Backend 417 + MCP 166 测试通过；测试隔离完全修复 |
| 文档同步 | 7/10 | 环境变量表已补全；CHANGELOG 缺 3 个版本；CLAUDE.md 版本声明滞后 |
| 发布就绪度 | 6/10 | 4 个本地提交未推送；缺 CHANGELOG/tag/CLAUDE.md 同步 |

整体评分：**7.6/10** — 代码和测试状态良好，但文档和发布流程需要完成才能推送。
