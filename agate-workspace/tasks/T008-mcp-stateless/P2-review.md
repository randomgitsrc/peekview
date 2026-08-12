---
phase: P2
task_id: T008
parent: P2-design.md
trace_id: T008-P2-review-20260614
reviewer: Staff Engineer (/review)
---

# P2 设计评审 — T008 MCP 无状态模式重构

## status: approved

方案正确，改动范围清晰，无 BLOCKER。

### ✅ 认可的设计决策

1. **每次请求创建新 transport**：无状态 Streamable HTTP 无 SSE 流，对象轻量，GC 回收，开销可忽略
2. **DELETE 返回 200**：正确，客户端断开时发 DELETE 是正常行为，无状态下直接 ack 避免误报
3. **SessionContext 保留**：AsyncLocalStorage 传递认证上下文的机制本身没问题，只是数据来源从缓存改为当次认证，改动最小

### 🔍 实现时注意

**transport.close() 是否需要显式调用**：有状态模式下 `transport.onclose` 会触发 session 清理。无状态下可以省略 `onclose`，但在 handleRequest 完成后可以显式 `transport.close()` 确保资源释放，不依赖 GC。加一行，成本极低。

**GET /mcp 端点保留**：现在返回 405。无状态下仍然正确，保留不动。
