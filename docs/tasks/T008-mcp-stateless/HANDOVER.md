# T008 交接文件 — MCP 无状态模式

> 状态：P4 实现完成，P5 gate 需在有 node_modules 的环境执行
> 接手 Agent：读完本文件 + P0-brief.md + P1-requirements.md + P2-design.md 即可上手

---

## 当前进度

| 阶段 | 状态 | 说明 |
|------|------|------|
| P0 任务简报 | ✅ | docs/tasks/T008-mcp-stateless/P0-brief.md |
| P1 需求基线 | ✅ | docs/tasks/T008-mcp-stateless/P1-requirements.md（7条BDD）|
| P2 方案设计 | ✅ approved | docs/tasks/T008-mcp-stateless/P2-design.md |
| P3 测试更新 | ✅ | packages/mcp-server/tests/server.test.ts 已按无状态行为重写 |
| P4 实现 | ✅ | packages/mcp-server/src/server.ts + types.ts 已改完 |
| P5 技术验证 | ⏳ **待执行** | 需要 node_modules，本机无法安装 npm 包 |
| P8 发布准备 | ⏳ 待 P5 通过后 | MCP v0.8.5 → v0.8.6 |

---

## P5 需要做的事

### 1. 安装依赖并跑单元测试

```bash
cd packages/mcp-server
npm install
npm test
```

**期望结果**：全部通过，重点关注这几个新用例：

```
POST /mcp - Stateless mode
  ✓ should successfully initialize and NOT return mcp-session-id (stateless)
  ✓ should handle tools/list without prior initialize (stateless)
  ✓ should authenticate on every request independently
  ✓ should ignore stale mcp-session-id header (stateless)

DELETE /mcp - Stateless acknowledgement
  ✓ should return 200 regardless of session-id (stateless)
  ✓ should return 200 for DELETE without session-id header
```

### 2. 如果有测试失败

看失败信息，最可能的问题：

**「mcp-session-id 仍然存在于响应头」**
→ 说明 `sessionIdGenerator: undefined` 没有生效，检查 server.ts 的 transport 创建代码

**「tools/list 返回 400 而不是 200」**
→ 说明无状态模式下 SDK 还在检查某些前置条件，可能需要在 handleRequest 之前判断请求类型

**「DELETE 返回 404」**
→ 说明 DELETE handler 没有改到，检查 packages/mcp-server/src/server.ts 末尾的 DELETE 路由

### 3. 可选：手动冒烟测试

如果本地有跑 PeekView 的环境（make debug）：

```bash
# 启动 MCP server（调试模式）
cd packages/mcp-server
PEEKVIEW_URL=http://127.0.0.1:8888 PEEKVIEW_API_KEY=your_key npm start

# 用 curl 模拟 opencode 的调用
# 1. initialize
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_pv_key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# 期望：响应里没有 mcp-session-id header

# 2. 直接调用 tools/list（不需要 initialize）
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_pv_key" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 期望：200，返回工具列表

# 3. 带旧 session-id（模拟服务端重启后的场景）
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_pv_key" \
  -H "mcp-session-id: stale-old-session-id" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{}}'

# 期望：200，session-id 被忽略，正常返回（之前会返回 404）
```

---

## P8 发布准备（P5 通过后执行）

```bash
# 1. bump MCP 版本
make bump-mcp-version NEW_MCP_VERSION=0.8.6

# 2. 手动填写 CHANGELOG（packages/mcp-server/CHANGELOG.md）
# 添加：
# ## [0.8.6] - 2026-06-14
# ### Changed
# - 改为无状态 Streamable HTTP 模式，彻底消除 session 过期导致 opencode 需要重启的问题
# - 每次请求独立认证，无 session 概念，服务端重启对客户端透明

# 3. amend commit
git add packages/mcp-server/CHANGELOG.md packages/mcp-server/package.json
git commit --amend

# 4. push
git push origin main

# 5. 发布到 npm（如果 make publish 支持 MCP 单独发布）
cd packages/mcp-server && npm publish
```

---

## 关键文件速查

| 文件 | 说明 |
|------|------|
| `packages/mcp-server/src/server.ts` | 核心改动：无状态 POST/DELETE handler |
| `packages/mcp-server/src/types.ts` | 删除了 SessionInfo interface |
| `packages/mcp-server/tests/server.test.ts` | 测试已更新为无状态行为 |

---

## 不需要改的东西

- `packages/mcp-server/src/tools/` — tool 实现无变化
- `packages/mcp-server/src/client.ts` — PeekView client 无变化
- `packages/mcp-server/src/config.ts` — 配置无变化
- 后端 Python 代码 — 完全不涉及
- 前端 Vue 代码 — 完全不涉及

---

## 背景（简版）

opencode 长开超 30 分钟不用 MCP → server 清 session → 下次调用返回 404 → opencode 不处理 404 re-initialize → 只能重启。

根治方案：去掉 session（无状态），每次请求独立认证。MCP 规范明确说 session 是 `MAY`（可选），所有 PeekView tool 本就无跨请求状态，无状态完全合规。

详细分析见上传的 `mcp-session-analysis.md` 和 `docs/tasks/T008-mcp-stateless/P2-design.md`。
