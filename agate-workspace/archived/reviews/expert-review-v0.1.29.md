# PeekView 专家评审报告

> 评审人：软件研发与业务专家  
> 日期：2026-05-19  
> 版本：v0.1.29  
> 评审范围：架构、安全、工程质量、产品策略、升级方向  

---

## 总体评价

PeekView 是一个**完成度相当高的个人/小团队工具**。从 v0.1 的空仓库到 v0.1.29 的完整产品，30+ 天内完成了 393 个后端测试 + 52 个 E2E 测试的覆盖，文档规范、流程完整，开发纪律良好。

但它目前仍是**一个精良的工具，而非一个平台**。CEO 评审在 v0.1 时提出的核心问题——"做 MCP 还是做 Pastebin"——在 v0.1.29 依然是开放问题，且随着功能迭代，技术债和架构局限正在缓慢积累。

评分（满分 10 分）：

| 维度 | 评分 | 说明 |
|------|------|------|
| 代码质量 | 7.5 | 整洁，有规范，但存在可见技术债 |
| 安全性 | 6.5 | 核心防护到位，但缺 rate limit、CSP、health 深度检查 |
| 测试质量 | 8.0 | 覆盖率高，分层清晰，但前端单元测试缺失 |
| 架构可扩展性 | 5.5 | 单机 SQLite 是天花板，无 Docker，存储耦合深 |
| 产品战略 | 5.0 | 功能完整但定位模糊，MCP 仍未实现 |
| 工程流程 | 8.5 | 文档、流程、发布规范一流 |

**综合：6.8 / 10**

---

## 一、已解决的历史问题（值得肯定）

这些是 CEO/Design 评审中提出的问题，已在 v0.1.29 前得到解决：

- ✅ **Shiki 单例**：`useShiki.ts` 已修复，不再每次重建 highlighter
- ✅ **FileTree 非平铺**：支持嵌套目录树，含折叠/展开
- ✅ **文件内容端点**：`/content` 端点已修复，不再触发浏览器下载
- ✅ **allowlist 替代 blacklist**：`local_path` 已改用白名单防路径遍历
- ✅ **DI 模式**：通过 `app.state` 注入服务，不再每次请求重建
- ✅ **认证**：JWT + API Key 双轨认证
- ✅ **生产数据污染**：三层保护机制
- ✅ **HTML 沙盒**：Blob URL + `sandbox="allow-scripts"` 正确实现

---

## 二、现存问题与缺陷

### 🔴 P0 — 阻塞性问题

#### 2.1 无速率限制（Rate Limiting）

**现状**：API 层完全没有速率限制，任何可到达 API 的客户端可以无限请求。  
**风险**：
- 失控的 Agent 循环可在数秒内创建数千条 entry，撑爆 SQLite 和磁盘
- 公网部署时面临暴力枚举 API Key、密码爆破等攻击
- 文件上传接口无并发保护，大量并发上传可造成 OOM

**建议**：集成 `slowapi`（FastAPI 官方推荐），对创建类接口加 `10/minute`，认证失败接口加 `5/minute`。工作量 2-4 小时。

---

#### 2.2 健康检查过浅

**现状**：`/health` 仅返回 `{"status": "ok", "version": "0.1.29"}`，不探测 DB 和磁盘。  
**风险**：DB 损坏、磁盘满、SQLite 锁死时，`/health` 仍返回 200——监控无法感知服务降级。  
**建议**：

```python
@app.get("/health")
async def health_check():
    # 探测 DB
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse({"status": "degraded", "db": "error"}, status_code=503)
    
    # 探测磁盘
    disk = shutil.disk_usage(data_dir)
    if disk.free < 100 * 1024 * 1024:  # <100MB
        return JSONResponse({"status": "degraded", "disk": "low"}, status_code=503)
    
    return {"status": "ok", "version": app.version}
```

---

#### 2.3 无 CSP（Content Security Policy）响应头

**现状**：后端响应头里没有 CSP，前端 `MarkdownViewer` 虽用了 `sanitize-html`，但无纵深防御。  
**风险**：sanitize-html 的任何绕过（历史上有过多个）直接变成 XSS，因为无 CSP 兜底。  
**建议**：在 `main.py` 的中间件里加：

```python
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "  # Shiki 需要 inline
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "frame-src blob:; "  # HtmlViewer 用 Blob URL
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    return response
```

---

### 🟠 P1 — 高优先级问题

#### 2.4 数据库迁移机制脆弱

**现状**：`_run_migrations()` 是手写的 `PRAGMA table_info` + `ALTER TABLE` 检测，每次启动都运行。  
**问题**：
- 没有版本号，无法知道当前 DB 是哪个"版本"
- 迁移失败不回滚（SQLite ALTER TABLE 无事务保护）
- 随功能增加，这个函数会越来越长，越来越脆
- 无法生成迁移历史，无法 dry-run

**建议**：引入 **Alembic**（SQLAlchemy 官方迁移工具），或至少维护一个 `schema_version` 表，将迁移拆成独立文件。这是 v0.2 前必须解决的技术债。

---

#### 2.5 前端渲染判断逻辑分散（TD-001 未解决）

**现状**（已记录为技术债 TD-001）：

```
isHtml / isMarkdown / isImage 的判断：
├── EntryDetailView.vue（computed，基于 activeFile.language）
└── entry.ts（canWrap，基于 language 字符串匹配）
```

**问题**：这是两套判断，逻辑重复，后端改了 `language` 字段值就要改两处。  
**建议**：将 `isHtml`、`isMarkdown`、`isImage`、`canWrap` 统一抽到 `entry.ts` store 的 getter 里，`EntryDetailView` 直接使用 store 暴露的 computed。

---

#### 2.6 CLI 过于庞大（1344 行），职责混乱

**现状**：`cli.py` 1344 行，包含了：本地 serve、本地 create、远程 create、user 管理、apikey 管理、service 安装。  
**问题**：
- 本地模式和远程模式混在同一套命令，靠 config 区分，容易误操作
- `service install` 相关代码（systemd/launchd 模板）嵌在 cli.py 里，难以维护
- 没有 shell completion（Tab 补全）

**建议**：
- 按子命令组拆分：`cli/commands/serve.py`、`cli/commands/entries.py`、`cli/commands/user.py`、`cli/commands/apikey.py`、`cli/commands/service.py`
- 添加 `click.shell_completion` 支持

---

#### 2.7 EntryDetailView.vue 过于肥大（666 行）

**现状**：`EntryDetailView.vue` 666 行，既管路由、数据获取、渲染分支、键盘快捷键、TOC、侧边栏、复制逻辑……  
**建议**：
- 将 TOC 逻辑提取为 `useToc.ts` composable
- 将键盘快捷键提取为 `useKeyboardShortcuts.ts`
- 将文件切换/加载逻辑合并进 `useEntry.ts`

---

### 🟡 P2 — 中优先级问题

#### 2.8 SQLite WAL Checkpoint 未配置

**现状**：WAL 模式开启，但无 `PRAGMA wal_autocheckpoint` 配置，也无定期 checkpoint 触发。  
**风险**：长期运行的实例 WAL 文件会持续增长，最终导致磁盘耗尽或性能下降。  
**建议**：在 `database.py` 里加 `PRAGMA wal_autocheckpoint=1000`，并在 cleanup 任务里定期执行 `PRAGMA wal_checkpoint(TRUNCATE)`。

---

#### 2.9 JWT 存储在 localStorage，XSS 风险

**现状**：`auth.ts` 将 JWT 存在 `localStorage['peekview_token']`。  
**风险**：如果存在任何 XSS 漏洞（包括 Markdown 渲染绕过），攻击者可直接读取 token。  
**建议**：迁移到 `httpOnly` Cookie（由后端 `Set-Cookie` 设置），浏览器 JS 无法读取，消除此类 XSS 横向利用路径。需要后端配合 `/auth/login` 响应改为设 Cookie。

---

#### 2.10 无 Docker / 容器化支持

**现状**：没有 `Dockerfile`、没有 `docker-compose.yml`，存储路径硬编码在 `~/.peekview/`。  
**影响**：
- 无法在 CI/CD 中运行完整 E2E 测试
- 无法一键部署到云环境（Fly.io、Railway、VPS）
- 无法做水平扩展（虽然 SQLite 单节点也无意义，但容器化是前提）

**建议**：提供一个标准 Dockerfile：

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY backend/ .
RUN pip install --no-cache-dir ".[prod]"
VOLUME ["/data"]
ENV PEEKVIEW_STORAGE__DATA_DIR=/data
ENV PEEKVIEW_STORAGE__DB_PATH=/data/peekview.db
EXPOSE 8080
CMD ["peekview", "serve", "--host", "0.0.0.0"]
```

---

#### 2.11 无前端单元测试

**现状**：`vitest.config.ts` 存在，但没有实际的前端单元测试（`src/**/__tests__/` 为空）。所有测试依赖 Playwright E2E。  
**问题**：E2E 测试慢（依赖浏览器启动），且覆盖不了 utils 层的边界条件（如 `guessMimeType`、`buildTree`、Blob URL 管理）。  
**建议**：至少为以下单元添加 vitest 测试：
- `mime.ts` → guessMimeType
- HtmlViewer 的资源注入逻辑（纯函数部分）
- `useShiki.ts` 的单例行为

---

#### 2.12 Content-Disposition 头注入风险（低但真实）

**现状**：文件下载接口直接用 `file_record.filename` 拼接 `Content-Disposition: attachment; filename="xxx"` 响应头。  
**风险**：文件名含 `"` 或 `\r\n` 时可能注入头。  
**建议**：

```python
from urllib.parse import quote
safe_filename = quote(file_record.filename, safe='')
headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{safe_filename}"
```

---

## 三、架构层面的关键局限

### 3.1 SQLite 是单点天花板

SQLite WAL 模式对并发读优化有效，但并发写仍是单线程串行。目前的假设是**单用户/单 Agent**使用，一旦：
- 多个 Agent 并发推送内容（CI 多任务并发）
- 多用户同时使用同一实例

写争用就会显现。**这不是 Bug，是设计选择**，但需要在文档中明确"单机、低并发"的适用边界，以及未来迁移 PostgreSQL 的路径。

### 3.2 文件存储路径耦合深

`~/.peekview/data/{entry_id}/` 的路径结构被 `storage.py`、`file_service.py`、CLI 多处引用。未来若要支持 S3/R2/对象存储，需要改动面很广。  
**建议**：抽一个 `StorageBackend` 接口，现在的实现是 `LocalStorageBackend`，未来可接入 `S3StorageBackend`，不改业务逻辑。

### 3.3 无背压机制的异步清理

`cleanup` 任务在后台定期扫描过期 entry，但没有：
- 任务锁（两个进程启动时会并发执行）
- 错误重试
- 执行时间监控

对于大数据量实例，cleanup 可能成为性能黑洞。

---

## 四、产品策略评估

### 4.1 MCP 缺失仍是最大战略风险

CEO 评审 5 周前就指出：**不做 MCP 就是升级版 Pastebin**。现在 v0.1.29 的功能更丰富，但这个判断仍然成立。

目前的竞争格局：
- Claude Code 原生支持输出文件到本地
- GitHub Gist + GitHub Copilot 在 IDE 内闭环
- Cursor、Windsurf 等 AI IDE 有自己的预览机制

PeekView 的差异化价值是：**跨工具、自托管、结构化的 Agent 输出展示**。但这个价值只有在 MCP 打通后才完整——Agent 调用 `peekview.create_entry` 工具，结果 URL 直接返回给用户，零上下文切换。

### 4.2 嵌入式 iframe 分享缺失

`<iframe src="https://peek.example.com/embed/{slug}">` 这种嵌入式分享，是内容传播的核心路径。技术上只需加一个 `/embed/{slug}` 路由（去掉顶部导航），但目前仍未实现。

### 4.3 条目编辑 UI 缺失

后端 PATCH 已实现，但没有前端编辑入口。这对 Agent workflow 有一定影响：Agent 发布一个"草稿"后无法通过 UI 修改摘要、标签等元数据。

---

## 五、升级方向建议（优先级排序）

### Tier 1 — 近期（1-2周）

| 项目 | 工作量 | 价值 |
|------|--------|------|
| Rate Limiting（slowapi） | 4h | 阻塞安全风险 |
| CSP 响应头 | 2h | 安全纵深防御 |
| 健康检查深度 | 2h | 运维可观测性 |
| Content-Disposition 修复 | 1h | 安全合规 |
| WAL Checkpoint 配置 | 1h | 稳定性 |

### Tier 2 — 中期（1个月）

| 项目 | 工作量 | 价值 |
|------|--------|------|
| **MCP Server** | 2-3天 | 战略核心，最大差异化 |
| Docker 容器化 | 1天 | 部署门槛大幅降低 |
| 条目编辑 UI | 1天 | 功能完整性 |
| 嵌入式 iframe 分享 | 0.5天 | 内容传播 |
| TD-001 重构（渲染判断统一） | 半天 | 技术债清偿 |
| CLI 拆分重构 | 1天 | 可维护性 |

### Tier 3 — 长期（战略级）

| 项目 | 说明 |
|------|------|
| JWT → httpOnly Cookie | 消除 localStorage XSS 风险 |
| StorageBackend 接口化 | 为 S3/R2 做架构准备 |
| Alembic 迁移系统 | 替换手写迁移脚本 |
| 前端单元测试 | 补齐测试金字塔 |
| PostgreSQL 支持 | 多用户/高并发场景 |
| 实时更新（WebSocket/SSE） | Agent 流式推送，页面实时刷新 |
| VS Code / Cursor 插件 | IDE 内直接预览，扩大生态 |

---

## 六、最值得立刻做的三件事

如果只能选三件，按投入产出比：

**第一：MCP Server**  
这是护城河。做完后 PeekView 从"开发者手动用的工具"变成"Agent 自动调用的基础设施"。工作量 2-3 天，但战略价值是其他所有 Tier 1 功能加起来的 10 倍。

**第二：Rate Limiting + CSP**  
各 2-4 小时，消除最明显的生产安全风险。如果 PeekView 公网部署，这两个不做是定时炸弹。

**第三：Docker 容器化**  
大幅降低他人使用门槛。目前 README 写的是 `pipx install peekview`，对开发者友好，但对运维不友好。有了 `docker-compose up` 一键起服务，采用率会显著提升。

---

## 七、一句话总结

> v0.1.29 是一个**工程质量良好、功能完整、文档规范**的自托管工具，但它距离"Agent 输出平台"还差一个 MCP Server、一个容器化部署故事、和几个关键的安全加固。
> 
> 现在是最佳的战略决策时机：继续打磨成一个精致的个人工具，还是迈出那一步成为 Agent 生态的基础设施。这两条路都是合理的，但它们对接下来优先级的影响是截然不同的。

---

*本报告已写入 `docs/reviews/expert-review-v0.1.29.md`*
