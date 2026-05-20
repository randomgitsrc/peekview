# MCP 多用户认证 Spec 评审（第二轮）

> 评审框架：gstack review（Staff Engineer + /cso 安全官视角）
> 日期：2026-05-20
> 评审对象：`docs/specs/spec-mcp-multi-user.md`（已修订版）

---

## 上轮问题解决情况

| 问题 | 状态 |
|------|------|
| P0-1 错误码映射与后端不符 | ✅ 已修：改为只按 HTTP status 分类，不做细粒度 code 映射 |
| P0-2 SSE 端点路径不一致（/mcp vs /sse） | ✅ 已修：统一为 `/sse`，用户配置命令已更新 |
| P1-1 validateToken 缺超时 | ✅ 已修：明确写 5s 超时，`AbortSignal.timeout(5000)` |
| P1-2 POST handler 缺 validateUUID 说明 | ✅ 已修：流程步骤明确列出 validateUUID → 400 |
| P1-3 变更清单不完整 | ✅ 已修：文件清单精确到每个 tool 文件 |
| P1-4 createEntry 的 publicUrl 流向不明 | ✅ 已修：`createTools(client, publicUrl)` 签名明确 |
| P2-4 health check 退化 | ✅ 已修：保留 ping()，说明不需要 auth |

上轮 7 个问题全部处理，修订质量高。

---

## 当前问题

### 🔴 P0 — 阻塞：实现后行为错误

#### P0-1 JWT token 可以通过 `/sse` 连接认证，但 spec 声明不支持

**spec 写：**
> JWT token（`eyJ` 前缀）：不支持，7 天过期不适合 MCP 配置

**实际行为：**

`validateToken()` 调用 `/api/v1/auth/me`，后端 `auth.py:150-152` 的认证逻辑：

```python
if auth_header.startswith("Bearer "):
    token = auth_header[7:]
    # JWT（3段）→ JWT 验证路径
    # pv_ 开头 → API Key 验证路径
```

JWT token 发给 `/auth/me` 时，后端会走 JWT 验证路径，有效 JWT 会返回 200 + 用户信息。MCP Server 拿到 200 就认为验证通过，建立 session。

结果：用户用 JWT 连上了 MCP，7 天后 JWT 过期，session 里的 token 也过期，所有 tool 调用开始 401，且用户不知道原因（因为 spec 说"JWT 不支持"，但实际连上了）。

**Fix：** 在 `validateToken()` 返回前，或 SSE handler 里，加前缀检查：

```typescript
// SSE handler
const token = req.headers.authorization?.replace('Bearer ', '') ?? '';
if (!token.startsWith('pv_')) {
  res.status(401).json({ error: '只支持 PeekView API Key（pv_ 前缀），不支持 JWT token' });
  return;
}
const user = await client.validateToken(token);
```

这样"JWT 不支持"才是真的不支持，而不是"不建议但实际可以用"。

---

### 🟠 P1 — 高优先级

#### P1-1 `validateToken()` 使用 `AbortSignal.timeout()` 与现有代码风格不一致

**spec 新写法：**
```typescript
signal: AbortSignal.timeout(5000),
```

**现有 `client.ts` 里的所有 timeout 实现（已提交代码）：**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
try { ... } finally { clearTimeout(timeout); }
```

`AbortSignal.timeout()` 在 Node 17.3+ 可用，`engines: ">=18.0.0"` 满足条件，技术上没问题。但两种写法混用在同一文件里是代码坏味道，实现者需要在新代码里统一选一种。

**建议：** spec 明确写"使用与 `request()` 一致的 `AbortController` 模式"，避免同文件两种风格。或者反过来，把现有 `request()` 里的 setTimeout 也改为 `AbortSignal.timeout()`，在 Task 里作为清理项。

---

#### P1-2 `ping()` 缺超时保护（遗留问题未带入新设计）

**spec 的 ping() 实现：**
```typescript
async ping(): Promise<boolean> {
  try {
    const res = await fetch(`${this.peekviewUrl}/health`);
    return res.ok;
  } catch { return false; }
}
```

没有超时。如果 PeekView 网络不通，`fetch()` 会等到操作系统 TCP 超时（通常 75 秒），health check 端点会挂 75 秒才返回 503。

现有实现（已提交代码）里 `ping()` 有 3s timeout，spec 里的新版本反而把 timeout 丢掉了。

**Fix：**
```typescript
async ping(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${this.peekviewUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch { return false; }
}
```

---

#### P1-3 `token 中途失效` 场景的用户体验描述与错误处理表不一致

**"使用"场景描述：**
> 甲的 key 过期 → SSE 连接保持，但所有 tool 调用返回"认证失败：API Key **已过期**"

**错误处理表：**
> 401 → "认证失败：API Key **无效或已过期**，请检查配置"

两处消息文本不一致，且使用场景里的"已过期"比错误表里的"无效或已过期"更精准——但后端实际上无法区分（都是 UNAUTHORIZED）。

实现者会以哪个为准？需要统一。

**建议：** 使用场景描述改为与错误表一致："认证失败：API Key 无效或已过期，请检查配置"，并在使用场景备注"后端不区分过期和无效，统一提示"。

---

### 🟡 P2 — 中优先级

#### P2-1 `sessionContext.run()` 的异步安全性已在实验中验证，但 spec 表述过于保守

**spec 写：**
> 需在测试中验证 POST → tool handler 能正确读到 sessionContext（如果 SDK 内部有 setImmediate 等脱离当前上下文的调用，context 可能丢失）

实际上，Node.js `AsyncLocalStorage` 在 Promise 链和 `setImmediate` 中均能正确传播 context（Node 22 已验证），这是 Node 文档的明确承诺行为。写"可能丢失"会让实现者过度担心，可能引入不必要的规避方案。

**建议：** 改为：
> `AsyncLocalStorage` 在 Promise 和 setImmediate 中均可正确传播（Node 17+ 保证行为），测试中验证端到端链路即可，无需特殊规避。

#### P2-2 CORS `allowedHeaders` 是否足够覆盖 MCP 协议需求

**spec 写：**
```typescript
allowedHeaders: ['Authorization', 'Content-Type'],
```

标准 MCP SSE 客户端可能发送额外的 header（如 `Accept: text/event-stream`），浏览器 CORS 预检会校验这些 header。`Accept` 通常属于 CORS 安全列表，无需显式允许，但若 SDK 未来版本发送自定义 header（如 `MCP-Session-Id`），当前配置会导致 CORS 拒绝。

这不是当前问题，但建议加 `exposedHeaders: ['*']` 或在注释里标注"如 SDK 升级后 CORS 被拒，优先检查 allowedHeaders"。

#### P2-3 迁移清单缺少"测试验证"步骤

迁移清单 7 步，从"打 tag"到"重新构建"，最后一步是"重新构建 MCP Server"。但没有"验证迁移成功"的步骤：

```bash
# 建议补第 8 步：验证
curl https://peek.example.com:33333/health
# → {"status":"ok"}

claude mcp add peekview --transport sse https://peek.example.com:33333/sse \
  --header "Authorization: Bearer pv_your_key"
# 在 Claude Code 里用 /mcp 命令确认 peekview 工具可用
```

没有验证步骤，用户完成迁移后不知道如何确认成功。

---

## 总结

### 修复优先级

| 级别 | 条目 | 核心影响 |
|------|------|---------|
| 🔴 P0 | P0-1 JWT 可绕过"不支持"声明 | 实现与文档不符，长期用户体验差 |
| 🟠 P1 | P1-1 timeout 风格不一致 | 代码维护问题，需要在实现时统一 |
| 🟠 P1 | P1-2 ping() 丢失超时保护 | health check 可能挂 75 秒 |
| 🟠 P1 | P1-3 错误消息文本不一致 | 实现者无法确定以哪个为准 |
| 🟡 P2 | P2-1 AsyncLocalStorage 表述过保守 | 误导实现者 |
| 🟡 P2 | P2-2 CORS allowedHeaders 可能不完整 | SDK 升级风险 |
| 🟡 P2 | P2-3 迁移清单缺验证步骤 | 用户不知如何确认迁移成功 |

### 评分

| 维度 | 本轮 | 上轮 | 变化 |
|------|------|------|------|
| 架构设计 | 9/10 | 9/10 | → |
| 细节完整性 | 8/10 | 6/10 | ↑↑ |
| 后端契约准确性 | 8/10 | 5/10 | ↑↑ |
| 实现可操作性 | 8/10 | 6/10 | ↑↑ |
| 安全性 | 7/10 | —  | P0-1 JWT 绕过 |

**综合：8/10**（上轮 6.5/10，大幅提升）

修复 P0-1（JWT 前缀检查）和两个 P1（ping timeout + 错误消息统一）后，spec 质量可到 9/10，可以直接进入实现阶段。这是一个清晰、正确、可执行的设计。

---

*评审完成：2026-05-20*
