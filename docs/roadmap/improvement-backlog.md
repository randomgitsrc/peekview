# PeekView 改进事项目标文档

> 创建：2026-06-09
> 用途：汇总评审发现的待改进事项，按优先级跟踪
> 当前版本：Backend v0.1.42 / MCP Server v0.8.1

---

## 优先级总览

| # | 事项 | 类别 | 优先级 | 状态 |
|---|------|------|--------|------|
| 1 | SSE → Streamable HTTP 迁移 | 技术债/传输 | 🔴 立即 | ✅ 完成 (v0.8.0) |
| 2 | rate limiting 配置化真正落地 | 技术债 | 🟠 近期 | 待办 |
| 3 | MCP/CLI 定位写进用户文档 | 产品/文档 | 🟠 近期 | 待办 |
| 4 | JWT → httpOnly Cookie | 安全 | 🟡 中期 | 待办 |
| 5 | 前端页面 CSP | 安全 | 🟡 中期 | 待办 |
| 6 | publish_files 二进制文件 base64 支持 | 功能 | 🟡 中期 | 待办 |
| 7 | package-lock.json 版本元数据同步 | 技术债 | 🟡 中期 | 待办 |
| 8 | StorageBackend 接口抽象 | 架构 | 🔵 长期 | 待办 |
| 9 | 嵌入式 iframe 分享 (/embed/{slug}) | 产品 | 🔵 长期 | 待办 |
| 10 | SQLite 并发写边界文档化 | 架构/文档 | 🔵 长期 | 待办 |
| 11 | publish_files 大目录扫描进度反馈 | 体验 | 🔵 长期 | 待办 |
| 12 | health check 503 vs 200 决策复审 | 运维 | 🔵 长期 | 待办 |

---

## 详细说明

### 🔴 1. SSE → Streamable HTTP 迁移（✅ 已完成 v0.8.0）

**问题**：PeekView MCP 用 HTTP+SSE 传输，该传输在 MCP 规范 2025-03-26 中已被废弃。

**已完成**：MCP Server v0.8.0 已迁移至 Streamable HTTP，端点从 `/sse` + `/messages` 改为 `/mcp`，SDK 升级至 1.29.0。详见已归档的 `docs/archived/plans/sse-migration/mcp-sse-to-streamable-http-migration.md`。

---

### 🟠 2. rate limiting 配置化真正落地

**问题**：`@limiter.limit()` 是编译时装饰器，无法从 config 读值。当前实现硬编码 `"10/minute"`，但 config 里的 `rate_limit_login_per_minute` 字段形同虚设——用户配了不生效。

**方案**：Spec 已更新（`spec-security-hardening-20260523.md`）——auth.py 去掉装饰器，在 create_app 里用 config 值动态 `limiter.limit()(login)` 绑定。实现待跟进。

---

### 🟠 3. MCP/CLI 定位写进用户文档

**问题**：内部决策文档（`mcp-vs-cli-positioning.md`）已厘清 MCP 适合 Agent 自主决策、CLI 适合用户主动操作。但面向用户的文档没有体现，用户装上 MCP 发现"不如 CLI 顺手"会困惑。

**方案**：README 增加"何时用 CLI / 何时用 MCP"的指引章节。

---

### 🟡 4. JWT → httpOnly Cookie

**问题**：前端 JWT 存在 `localStorage['peekview_token']`，Markdown 渲染若有 XSS 绕过可直接窃取 token。

**方案**：迁移到 httpOnly Cookie（浏览器 JS 无法读取），需后端 `/auth/login` 改为 Set-Cookie。

---

### 🟡 5. 前端页面 CSP

**问题**：后端 CSP 头只加在 `/api/*` 和 `/health`（`default-src 'none'`），前端页面没有 CSP。Markdown 渲染、HTML iframe 是 XSS 主要攻击面，缺纵深防御。

**方案**：为前端页面设计专用 CSP（需允许 Shiki inline、HtmlViewer blob:）。

---

### 🟡 6. publish_files 二进制文件 base64 支持

**问题**：图片、PDF 被直接跳过。后端已支持 base64 上传，能力未利用。发布含截图的项目时图片全丢。

**方案**：publish_files 对二进制文件用 content_base64 上传。

---

### 🟡 7. package-lock.json 版本元数据同步

**问题**：MCP Server package-lock.json 顶层 version 字段长期落后于 package.json。bump-mcp-version 只改 package.json 不跑 npm install。

**方案**：bump-mcp-version 加 `npm install --package-lock-only`。

---

### 🔵 8. StorageBackend 接口抽象

**问题**：`~/.peekview/data/{entry_id}/` 路径耦合在 storage.py、entry_service.py、CLI 多处。未来支持 S3/对象存储改动面广。

**方案**：抽 `StorageBackend` 接口，现实现为 `LocalStorageBackend`。

---

### 🔵 9. 嵌入式 iframe 分享

**问题**：`<iframe src=".../embed/{slug}">` 是内容传播核心路径，长期在 backlog 未做。

**方案**：加 `/embed/{slug}` 路由（去掉顶部导航）。

---

### 🔵 10. SQLite 并发写边界文档化

**问题**：SQLite 并发写串行，多账号/多 Agent 并发 publish 会写争用。边界未文档化。

**方案**：README 明确"单机低并发"适用边界 + 未来 PostgreSQL 迁移路径。

---

### 🔵 11. publish_files 大目录扫描进度反馈

**问题**：扫描大目录静默无反馈。MCP 协议支持 progress notification 未用。

**方案**：扫描时推送 progress notification。

---

### 🔵 12. health check 503 vs 200 决策复审

**问题**：DB 故障时 health check 返回 200（status: degraded），理由"避免负载均衡器误判"。但业界标准是 503 让流量切走，degraded 信息在 body 里监控难感知。

**方案**：复审决策，考虑 DB/存储错误返回 503，磁盘低返回 200+warning。

---

## 评审盲区教训

历次 gstack 评审盯实现细节（sessionId、认证、安全边界），但从未质疑**技术选型的时效性**——SSE 在 2025-03 已废弃，评审中无人发现。

**新增评审清单第一项：选型时效性检查。** 涉及协议/框架/库/传输方式时，先查证"当前时间点是否仍是推荐做法"，再审实现细节。AI/Agent 领域标准演进以季度计，训练数据里的常识可能几个月就过时。

---

*维护：随评审持续更新*
