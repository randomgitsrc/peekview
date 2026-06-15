# PeekView 改进事项目标文档

> 创建：2026-06-09
> 用途：汇总评审发现的待改进事项，按优先级跟踪
> 当前版本：Backend v0.1.60 / MCP Server v0.9.0

---

## 优先级总览

| # | 事项 | 类别 | 优先级 | 状态 |
|---|------|------|--------|------|
| 1 | SSE → Streamable HTTP 迁移 | 技术债/传输 | 🔴 立即 | ✅ 完成 (v0.8.0) |
| 2 | rate limiting 配置化真正落地 | 技术债 | 🟠 近期 | ✅ 完成 (v0.1.45) |
| 3 | MCP/CLI 定位写进用户文档 | 产品/文档 | 🟠 近期 | ✅ 完成 |
| 4 | JWT → httpOnly Cookie | 安全 | 🟡 中期 | ✅ 完成 (v0.1.45) |
| 5 | 前端页面 CSP | 安全 | 🟡 中期 | ✅ 完成 (v0.1.45) |
| 6 | publish_files 二进制文件 base64 支持 | 功能 | 🟡 中期 | ✅ 完成 (v0.1.44) |
| 7 | package-lock.json 版本元数据同步 | 技术债 | 🟡 中期 | ✅ 完成 (v0.1.44) |
| 8 | StorageBackend 接口抽象 | 架构 | 🔵 长期 | 待办 |
| 9 | 嵌入式 iframe 分享 (/embed/{slug}) | 产品 | 🔵 长期 | 待办 |
| 10 | SQLite 并发写边界文档化 | 架构/文档 | 🔵 长期 | 待办 |
| 11 | publish_files 大目录扫描进度反馈 | 体验 | 🔵 长期 | 待办 |
| 12 | health check 503 vs 200 决策复审 | 运维 | 🔵 长期 | ✅ 决策完成 (保持200) |
| 13 | 登录/注册 Cap captcha 集成 | 安全 | 🟠 近期 | ✅ 完成 (v0.1.49) |
| 14 | SCOPE+ 影响范围决策矩阵 | 流程 | 🔵 长期 | 待实战验证 |
| 15 | BDD 验收条件可量化门槛 | 流程 | 🔵 长期 | 待实战验证 |
| 16 | P7 一致性检查覆盖度门槛 | 流程 | 🔵 长期 | 待实战验证 |
| 17 | 链式上溯拦截规则 | 流程 | 🔵 长期 | 待实战验证 |

---

## 详细说明

### 🔴 1. SSE → Streamable HTTP 迁移（✅ 已完成 v0.8.0）

**问题**：PeekView MCP 用 HTTP+SSE 传输，该传输在 MCP 规范 2025-03-26 中已被废弃。

**已完成**：MCP Server v0.9.0 已迁移至 Streamable HTTP，端点从 `/sse` + `/messages` 改为 `/mcp`，SDK 升级至 1.29.0。详见已归档的 `docs/archived/plans/sse-migration/mcp-sse-to-streamable-http-migration.md`。

---

### 🟠 2. rate limiting 配置化真正落地（✅ 已完成 v0.1.45）

**问题**：`@limiter.limit()` 是编译时装饰器，无法从 config 读值。当前实现硬编码 `"10/minute"`，但 config 里的 `rate_limit_login_per_minute` 字段形同虚设——用户配了不生效。

**已完成方案**：`create_app()` 新增 `rate_limit_login_per_minute` / `rate_limit_per_minute` 参数，captcha 端点限速从硬编码改为可配置，`limiter.default_limits` 兜底保护所有 API 端点。

---

### 🟠 3. MCP/CLI 定位写进用户文档

**问题**：内部决策文档（`mcp-vs-cli-positioning.md`）已厘清 MCP 适合 Agent 自主决策、CLI 适合用户主动操作。但面向用户的文档没有体现，用户装上 MCP 发现"不如 CLI 顺手"会困惑。

**方案**：README 增加"何时用 CLI / 何时用 MCP"的指引章节。

---

### 🟡 4. JWT → httpOnly Cookie（✅ 已完成 v0.1.44）

**问题**：前端 JWT 存在 `localStorage['peekview_token']`，Markdown 渲染若有 XSS 绕过可直接窃取 token。

**已完成方案**：迁移到 httpOnly Cookie（浏览器 JS 无法读取）。后端 `/auth/login` `/auth/register` 改为 Set-Cookie，前端 client.ts 移除 localStorage 改用 withCredentials，auth.ts 重构为 user ref 模式。Cookie 优先级：Authorization header JWT > Cookie JWT > API key。

---

### 🟡 5. 前端页面 CSP（✅ 已完成 v0.1.44）

**问题**：后端 CSP 头只加在 `/api/*` 和 `/health`（`default-src 'none'`），前端页面没有 CSP。Markdown 渲染、HTML iframe 是 XSS 主要攻击面，缺纵深防御。

**已完成方案**：
- 后端：SPA 页面添加 CSP 头（`script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src blob:; frame-ancestors 'none'; form-action 'none'`）
- 前端：移除 index.html 内联脚本（theme-init.ts 替代）
- 前端：useMarkdown.ts 8 个内联 onclick/onmousedown → data-action 属性 + 事件委托
- 前端：MarkdownViewer.vue 移除 7 个 window.* 全局函数，改为事件委托处理
- 前端：DOMPurify 集成，清理 markdown 渲染输出
- 前端：HtmlViewer iframe 添加 csp 属性限制 blob 内容的 CSP

---

### 🟡 6. publish_files 二进制文件 base64 支持（✅ 已完成 v0.1.44）

**问题**：图片、PDF 被直接跳过。后端已支持 base64 上传，能力未利用。发布含截图的项目时图片全丢。

**已完成方案**：publish_files 对二进制文件用 content_base64 上传。后端 MAX_FILE_SIZE 10MB→20MB，MCP 分离 MAX_TEXT_FILE_BYTES (7MB) / MAX_BINARY_FILE_BYTES (20MB)，types.ts 添加 content_base64 字段。

---

### 🟡 7. package-lock.json 版本元数据同步（✅ 已完成 v0.1.44）

**问题**：MCP Server package-lock.json 顶层 version 字段长期落后于 package.json。bump-mcp-version 只改 package.json 不跑 npm install。

**已完成方案**：bump-mcp-version 加 `npm install --package-lock-only`，Makefile 添加 lockfile 版本验证。

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

### 🟠 13. 登录/注册 Cap captcha 集成（✅ 已完成 v0.1.43）

**问题**：自托管 PeekView 缺乏登录/注册的人机验证层，易被脚本刷账号。

**已完成方案**：
- 集成 [Cap](https://github.com/tiagozip/cap)（Apache 2.0 自托管 captcha）
- 新增 `peekview.auth.captcha.*` 配置段（`enabled` / `site_key` / `secret_key` / `verify_url` / `exempt_first_user`）
- `register` / `login` 在 captcha 启用时验证 `cap-token`
- 公开端点 `GET /api/v1/config/captcha` 返回公开字段
- 第一个用户（admin）可豁免
- 15 个新测试覆盖 verify_captcha 单元、register/login 集成、exempt 场景、公开端点

**部署**：用户需自行启动 Cap standalone（Docker），详见 `docs/archived/plans/captcha-integration.md`。

---

---

### 🔵 14. SCOPE+ 影响范围决策矩阵

**来源**：workflow-v4 评审 Fix-8（docs/reviews/expert-review-wf-v4-fixes-2026-06-12.md 分歧 2）

**问题**：SCOPE+ 定向回补的核心步骤"主 Agent 判断哪些阶段需要跟着改"缺少判断规则，完全靠临场判断。但当前无实战数据证明这条规则是必要的——可能 P1 基线增补后各阶段自然消费最新基线即可，不需要显式矩阵。

**方案**：待 5-10 个真实 SCOPE+ 场景积累后，分析是否存在"回补不足"或"回补过度"的实际失败，再决定是否矩阵化。

---

### 🔵 15. BDD 验收条件可量化门槛

**来源**：workflow-v4 评审 Fix-9（docs/reviews/expert-review-wf-v4-fixes-2026-06-12.md 分歧 2）

**问题**：P1 分析师可能写出"伪 BDD"（Then 子句含模糊词如"体验良好""正常工作"），全流程无质检。但增加 BDD 质量规则会增加长期认知负担，且"伪 BDD"是否真的导致过 P6 验收失败尚无数据。

**方案**：待 5-10 个真实任务执行后，统计 P6 验收失败中因 BDD 模糊导致的比例，再决定是否加门槛。

---

### 🔵 16. P7 一致性检查覆盖度门槛

**来源**：workflow-v4 评审 Fix-10（docs/reviews/expert-review-wf-v4-fixes-2026-06-12.md 分歧 2）

**问题**：P7 gate 只检查"有无 BLOCKER"，空壳 P7-consistency.md（无 BLOCKER 但也没做检查）可过 gate。但增加覆盖度计数规则增加认知负担，且空壳 P7 是否真的导致过上线问题尚无数据。

**方案**：待 5-10 个真实任务执行后，检查 P7 产出质量是否与 P5 回归测试结果关联，再决定是否加门槛。

---

### 🔵 17. 链式上溯拦截规则

**来源**：workflow-v4 评审 Fix-12（docs/reviews/expert-review-wf-v4-fixes-2026-06-12.md B2）

**问题**：L2 上溯每次只跳一个阶段，但多次上溯可能链式组合（如 P5→P4→P2），等效跨多阶段回退。Fix-12 原方案用"非相邻即 PAUSED"拦截，但这与 L2 上溯表中的合法非相邻跳转（P4→P2、P6→P4、P7→P2）冲突。

**方案**：待真实链式上溯场景出现后，基于实际数据设计拦截条件（如：检测链内是否有阶段 retry 已耗尽、限制链总步数等），而非预设规则。

---

*维护：随评审持续更新*
