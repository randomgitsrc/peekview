---
phase: P2
task_id: T015
parent: P2-design.md
trace_id: T015-P2-review-20260615
reviewer: Staff Engineer
status: approved
---

方案简洁，直接 fetch PeekView backend 而非通过 MCP Server 的设计是对的——用户配置完立刻能验，不需要先启动服务。

**实现时注意**：

1. Step 5 认证判断逻辑有笔误：
   `res.status === 401 === false` 应改为 `res.status !== 401 && res.ok`
   或更清晰：`res.status === 200 || res.status === 403`

2. `AbortSignal.timeout()` 在 Node.js 18 才加入，确认 mcp-server 的 engines 要求版本。

3. verify 是 async action，Commander.js 需要在 action 里用 `.parseAsync()` 或确认异步 action 被正确 await。参考 package.json 的 bin 入口怎么调 program.parseAsync。

无 BLOCKER。
