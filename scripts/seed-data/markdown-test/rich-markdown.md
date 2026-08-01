# PeekView 完整开发手册

> **版本**: 0.14.0 | **更新**: 2026-08-01 | **状态**: 活跃维护

本文档是 PeekView 的完整开发参考，涵盖架构设计、API 规范、前端组件、MCP 集成和部署运维。

---

## 目录

1. [项目概述](#1-项目概述)
2. [架构设计](#2-架构设计)
3. [后端 API](#3-后端-api)
4. [前端组件](#4-前端组件)
5. [MCP Server](#5-mcp-server)
6. [数据库设计](#6-数据库设计)
7. [安全策略](#7-安全策略)
8. [测试体系](#8-测试体系)
9. [部署运维](#9-部署运维)
10. [FAQ](#10-faq)

---

## 1. 项目概述

PeekView 是一个面向 AI Agent 工作流的轻量级内容发布平台。核心价值主张：

- **可读**：结构化数据富渲染（表格/树/代码高亮），非纯文本堆砌
- **可查**：FTS5 全文搜索 + 标签过滤 + 读取追踪
- **可回溯**：Entry 不可变快照语义，覆盖发布 = git amend

### 1.1 核心概念

| 概念 | 定义 | 类比 |
|------|------|------|
| Entry | 不可变内容快照（摘要 + 多文件 + 标签 + 权限） | git commit |
| File | Entry 内的单个文件（代码/文档/图片） | git blob |
| Slug | URL 友好的唯一标识 | git branch name |
| Publish | 创建或覆盖 Entry（幂等） | git push --force |

### 1.2 文件类型与渲染器

后端 `detect_language()` 根据扩展名返回 language 字段，前端根据 language 选择渲染器：

| 扩展名 | language | 渲染器 | 说明 |
|--------|----------|--------|------|
| `.md` `.mdx` | markdown | MarkdownViewer | 富文本渲染 + TOC |
| `.html` `.htm` | html | HtmlViewer | sandbox iframe + CSP |
| `.csv` | csv | TableView | 分页/排序/筛选表格 |
| `.tsv` | tsv | TableView | tab 分隔表格 |
| `.json` | json | TreeView | 递归树 + 类型标签 |
| `.yaml` `.yml` | yaml | TreeView | js-yaml 安全解析 |
| `.xml` | xml | TreeView | DOMParser 递归 |
| `.svg` | xml | ImageViewer | 矢量图预览 |
| `.py` `.ts` 等 | 各语言 | CodeViewer | Shiki 语法高亮 |
| `.png` `.jpg` 等 | None | ImageViewer | 二进制图片预览 |

### 1.3 权限模型

三层权限，私有 entry 对非 owner 返回 404（非 403）防止 slug 枚举：

```
Anonymous     → 仅公开 entry
Authenticated → 公开 + 自己的私有
Admin         → 全部可见
```

认证方式优先级：`Authorization: Bearer` > Cookie `peekview_token` > `pv_` API Key

---

## 2. 架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────┐
│                   浏览器 / Agent                  │
└──────────┬──────────────────────┬───────────────┘
           │ HTTP/REST            │ MCP Protocol
           ▼                      ▼
┌──────────────────┐    ┌──────────────────────┐
│   FastAPI 后端    │◄──►│   MCP Server (Node)   │
│   :8080 / :8888   │    │   Streamable HTTP     │
│                  │    └──────────────────────┘
│  ┌────────────┐  │
│  │ SQLite WAL │  │
│  │   + FTS5   │  │
│  └────────────┘  │
└──────────────────┘
```

### 2.2 后端分层

```
backend/peekview/
├── main.py           # App factory (create_app/get_app)
├── config.py         # Pydantic Settings (PEEKVIEW_* env vars)
├── database.py       # SQLite init, WAL, FTS5, migrations
├── models.py         # SQLModel Entry/File/User/ApiKey
├── auth.py           # JWT + bcrypt + API key
├── language.py       # 扩展名 → language 映射
├── storage.py        # 文件系统操作
├── api/              # 路由层
│   ├── entries.py    # CRUD + 搜索 + raw
│   ├── files.py      # 文件内容 + 下载
│   ├── auth.py       # 登录/注册/刷新
│   ├── apikeys.py    # API Key 管理
│   ├── admin.py      # 管理员接口
│   ├── captcha.py    # 注册验证码
│   ├── config.py     # 公开配置
│   ├── shares.py     # 分享链接
│   └── rate_limit.py # 速率限制
└── services/         # 业务逻辑层
    ├── entry_service.py
    ├── file_service.py
    ├── apikey_service.py
    ├── admin_service.py
    ├── share_service.py
    ├── read_tracking_service.py
    └── html_render_service.py
```

### 2.3 前端组件树

```
App.vue
├── Landing.vue（首页）
│   ├── HeroSection.vue
│   └── FeatureGrid.vue
├── EntryListView.vue（列表页）
│   ├── SearchBar.vue
│   ├── EntryCard.vue × N
│   └── Pagination.vue
└── EntryDetailView.vue（详情页）
    ├── EntryDetailHeader.vue（sticky header + actions）
    ├── EntryDetailSidebar.vue
    │   ├── FileTree.vue（递归 TreeNodeItem.vue）
    │   └── TocNav.vue
    ├── EntryDetailContent.vue（渲染调度链）
    │   ├── HtmlViewer.vue
    │   ├── MarkdownViewer.vue（+ DiagramBlock.vue）
    │   ├── TableView.vue
    │   ├── TreeView.vue（+ DataTreeNode.vue）
    │   ├── ImageViewer.vue
    │   └── CodeViewer.vue（fallback）
    └── EntryDetailMobileBar.vue（移动端底部栏）
```

### 2.4 滚动架构

`.content-area` 是详情页**唯一纵向滚动容器**。Viewer 组件不声明 `overflow-y: auto` 或 `height: 100%`，内容自然流动由外层滚动。

例外：HtmlViewer 和 ImageViewer 使用 `height: 100%; overflow: hidden`（iframe/图片内部滚动隔离）。

```css
.content-area {
  flex: 1;
  overflow-y: auto;        /* 唯一纵向滚动 */
  padding: var(--space-4); /* 桌面 16px */
}
@media (max-width: 640px) {
  .content-area { padding: var(--space-3) var(--space-2); } /* 移动 12px/8px */
}
```

---

## 3. 后端 API

### 3.1 Entry CRUD

```python
# 创建（幂等）
POST /api/v1/entries
Authorization: Bearer <token>
Body: { "summary": "...", "slug": "...", "files": [...], "tags": [...], "is_public": true }

# 读取
GET /api/v1/entries/{slug}
# → 200 { "slug": "...", "summary": "...", "files": [...], ... }
# → 404 (不存在或无权限)

# 列表（分页 + 过滤）
GET /api/v1/entries?tag=python&search=fastapi&page=1&per_page=20

# 原始内容（Agent 读路径）
GET /api/v1/entries/{slug}/raw
# → 200 { "filename": "...", "language": "...", "content": "..." }
```

### 3.2 搜索

FTS5 全文搜索 + jieba 预分词：

```sql
-- 创建 FTS5 虚拟表
CREATE VIRTUAL TABLE entries_fts USING fts5(
    content,
    content='entries',
    content_rowid='id',
    tokenize='unicode61'
);

-- 搜索查询
SELECT e.slug, e.summary
FROM entries_fts
JOIN entries e ON e.id = entries_fts.rowid
WHERE entries_fts MATCH :query
ORDER BY rank
LIMIT 20;
```

标签过滤使用 `json_each` 精确匹配（非 LIKE）：

```sql
-- 标签精确匹配
SELECT * FROM entries
WHERE EXISTS(
    SELECT 1 FROM json_each(entries.tags)
    WHERE json_each.value = 'python'
);
```

### 3.3 认证

三层认证，优先级：Bearer Header > Cookie > API Key

```python
# JWT Cookie（浏览器自动携带）
POST /api/v1/auth/login
Body: { "username": "alice", "password": "..." }
→ Set-Cookie: peekview_token=<jwt>; HttpOnly; SameSite=Lax

# Bearer Header（API 调用）
GET /api/v1/entries
Authorization: Bearer <jwt>

# API Key（Agent 长期凭证）
GET /api/v1/entries
Authorization: pv_xxxxxxxxxxxxxxxx
```

API Key 安全：
- 前缀 `pv_` 便于识别
- HMAC-SHA256 hash 存储（不存明文）
- 每用户最多 10 个
- Global API key 中间件跳过 auth 端点

---

## 4. 前端组件

### 4.1 渲染调度链

`EntryDetailContent.vue` 的 v-if 链决定渲染器选择：

```
isHtml         → HtmlViewer
isMarkdown     → MarkdownViewer (或 CodeViewer if sourceViewMode)
isCsv/isTsv    → TableView (或 CodeViewer if showSourceView)
isJson/isYaml  → TreeView  (或 CodeViewer if showSourceView)
/isXml
isImage        → ImageViewer
else           → CodeViewer (fallback)
```

### 4.2 源码/渲染切换

所有富渲染格式支持 `<>` 按钮切换源码视图：

- 状态管理：`sourceViewMode` 在 `EntryDetailView.vue`，`watch(activeFile)` 重置为 false
- 切换按钮：`EntryDetailHeader`（桌面）+ `EntryDetailMobileBar`（移动）
- 仅 `isRichRenderable`（csv/tsv/json/yaml/xml/markdown）时显示按钮

### 4.3 TableView 组件

TanStack Table v8 headless + 复用 Pagination.vue：

- 分页：50/100/500 行可选，默认 100，切换后回到第一页
- 排序：列头三态（升序→降序→原序），`aria-sort` 绑定
- 筛选：每列文本包含匹配，`aria-label="Filter {列名}"`
- 横向滚动：`overflow-x: auto`，列头 sticky
- 截断：CSV >50000 行显示 TruncationBanner + 下载按钮
- 移动端：列级筛选隐藏，perPage 独占一行

### 4.4 TreeView 组件

递归 DataTreeNode + 统一 TreeDataNode 中间结构：

- 类型标签：string（绿）/number（蓝）/boolean（橙）/null（灰）/object/array（紫）
- 搜索高亮：key 或 value 包含搜索文本时高亮 + `aria-live` 播报匹配数
- 点击复制：叶子节点值点击复制到剪贴板，toast 反馈
- 截断：JSON/YAML/XML >2MB 显示 TruncationBanner + 下载按钮
- YAML 安全：js-yaml v4 `load()` 默认 DEFAULT_SAFE_SCHEMA

---

## 5. MCP Server

### 5.1 双模式

| 模式 | 架构 | 暴露工具 |
|------|------|----------|
| remote | A→B→C | create_entry / get_entry / list_entries / delete_entry |
| local | A=B→C | publish_files / get_entry / list_entries / delete_entry |

### 5.2 publish_files 语义

`publish_files` 在 slug 已存在时走覆盖路径（immutable update）：

```typescript
await client.callTool({
  name: "publish_files",
  arguments: {
    summary: "修复记录",
    slug: "fix-2024-001",
    paths: ["/project/fix.py", "/project/test.py"],
    is_public: true
  }
});
```

- slug 不存在 → 创建新 entry
- slug 已存在 → 覆盖（新快照替换旧快照）
- 文件路径必须 allowlist + symlink 检查

### 5.3 配置

```
# 远程模式（连接远程 PeekView）
PEEKVIEW_MCP__MODE=remote
PEEKVIEW_MCP__API_URL=http://peekview.local:8080
PEEKVIEW_MCP__API_KEY=pv_xxxxxxxx

# 本地模式（本机 PeekView）
PEEKVIEW_MCP__MODE=local
PEEKVIEW_MCP__ALLOWED_PATHS=/home/user/projects,/tmp/work
```

---

## 6. 数据库设计

### 6.1 核心表

```sql
-- entries 表
CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    is_public BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'active',
    user_id INTEGER REFERENCES users(id),
    idempotency_key TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- files 表
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content TEXT,
    language TEXT,
    is_binary BOOLEAN DEFAULT 0,
    size INTEGER DEFAULT 0,
    line_count INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

-- users 表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- api_keys 表
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 6.2 FTS5 全文索引

```sql
CREATE VIRTUAL TABLE entries_fts USING fts5(
    content,
    content='entries',
    content_rowid='id',
    tokenize='unicode61'
);

-- 触发器自动同步
CREATE TRIGGER entries_fts_insert AFTER INSERT ON entries BEGIN
    INSERT INTO entries_fts(rowid, content)
    VALUES (new.id, new.summary || ' ' || COALESCE(new.tags, ''));
END;
```

### 6.3 读取追踪

```sql
CREATE TABLE entry_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL REFERENCES entries(id),
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,  -- 'view' / 'raw' / 'download'
    source TEXT,           -- 'web' / 'api' / 'mcp'
    created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 7. 安全策略

### 7.1 CSP 策略

主应用 CSP：
```
default-src 'self';
script-src 'self' 'unsafe-eval';  ← Mermaid/d3 的 new Function() 必需
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
```

HTML 渲染路由独立 CSP + sandbox：
```
sandbox="allow-scripts allow-forms"
```
（无 `allow-same-origin`，iframe opaque origin 无法访问主页面凭据）

### 7.2 路径安全

- `local_path` 必须 allowlist + symlink 先检查再 resolve
- 后端拒绝 symlink
- MCP 用 realpath 跟随后检查 allowlist

### 7.3 速率限制

- 认证端点：10 次/分钟
- 数据端点：60 次/分钟
- Global API key 中间件跳过 auth 端点

---

## 8. 测试体系

### 8.1 测试金字塔

| 层级 | 框架 | 覆盖 |
|------|------|------|
| 单元测试 | pytest (backend) / vitest (frontend) | composable 逻辑、parser 边界、language 检测 |
| 组件测试 | vitest + @vue/test-utils | mount + props/emit 断言 |
| E2E 测试 | Playwright CDP | 真实浏览器交互验证 |

### 8.2 agate Gate 流程

```
P0 立项 → P1 需求(BDD) → P2 设计 → P3 TDD红灯 → P4 实现
→ P5 技术验证 → P6 BDD验收 → P7 一致性 → P8 发布
```

每个阶段有 gate 脚本自动校验，主 Agent 亲自验 gate 不信 subagent 自报。

### 8.3 调试流程

```bash
make debug          # 完整调试（build + start + E2E + MCP，~5min）
make debug-quick    # 快速调试（build-fast + start + seed，~20s）
make debug-start    # 仅启动服务
make debug-seed     # 仅灌入数据
make debug-stop     # 停止 + 清理
```

---

## 9. 部署运维

### 9.1 开发环境

```bash
make dev              # 创建/更新 venv（不影响 pipx）
make test-quick       # 后端测试（venv pytest）
make test-frontend    # 前端测试（vitest 非 watch）
make typecheck        # 类型检查（vue-tsc）
make lint             # 代码检查（ruff）
```

### 9.2 生产部署

```bash
pipx install peekview
peekview serve --host 0.0.0.0 --port 8080
```

或 systemd：
```ini
[Unit]
Description=PeekView Server
After=network.target

[Service]
Type=simple
User=peekview
ExecStart=/home/peekview/.local/bin/peekview serve --host 0.0.0.0 --port 8080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 9.3 发布流程

```bash
make bump-version NEW_VERSION=x.y.z    # 同步版本号 + commit + tag
# 填 CHANGELOG → git commit --amend --no-edit
make pre-publish-quick                 # 快速检查
make publish                           # 发布到 PyPI
git push && git push origin vx.y.z     # 推送代码 + tag
# 升级生产（人工）: pipx upgrade peekview && sudo systemctl restart peekview
```

MCP 独立发布：
```bash
make bump-mcp-version NEW_MCP_VERSION=x.y.z
make pre-publish-npm
make publish-npm
```

### 9.4 数据库维护

```bash
# WAL checkpoint
sqlite3 ~/.peekview/peekview.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 完整性检查
sqlite3 ~/.peekview/peekview.db "PRAGMA integrity_check; PRAGMA foreign_key_check;"

# 清理已删除 entry（软删除 → 物理删除）
peekview delete <slug>
```

---

## 10. FAQ

### Q: 为什么 Entry 不可变？

A: Entry 代表一个已发布快照。如果允许原地修改，多 Agent 协作时会丢失历史上下文。覆盖发布（publish）语义上等于 git commit + amend——新快照替换旧快照，但旧快照的"存在过"这个事实被记录在读取追踪中。

### Q: 为什么用 SQLite 而不是 PostgreSQL？

A: PeekView 定位是轻量级工具，单机部署。SQLite WAL 模式下读写并发足够（单写多读），运维零成本。FTS5 原生支持全文搜索，无需额外依赖。如果未来需要多实例部署，可以平滑迁移到 PostgreSQL（SQLModel 抽象层兼容）。

### Q: 为什么 MCP 不暴露 updateEntry？

A: PeekView 定位是"发布记录"而非"协作编辑"。Entry 代表一个已发布快照，语义上应该是创建或覆盖（publish），而非原地修改。`publish_files` 在 slug 已存在时走覆盖路径，相当于 immutable update（新快照替换旧快照），不需要单独的 partial update 能力。

### Q: 为什么 CSP 允许 'unsafe-eval'？

A: Mermaid 和 d3 的图表渲染依赖 `new Function()` 动态求值，这需要 `unsafe-eval`。我们评估过替代方案（Web Worker 隔离、iframe sandbox），但性能和复杂度代价过大。当前方案通过 CSP 其他指令（default-src 'self'、不允许外部连接）限制了 unsafe-eval 的攻击面。

### Q: 为什么 .tsv 之前映射到 'csv'？

A: 这是 v0.14.0 之前的一个 bug。`.tsv` 错误映射为 `'csv'`，导致前端无法区分 CSV 和 TSV，无法选择正确的分隔符（逗号 vs tab）。v0.14.0 修正为 `.tsv → 'tsv'`，PLAIN_TEXT_LANGS 同步加入 `'tsv'`。

### Q: 如何调试前端？

A: 使用 `make debug-quick`（~20s 启动调试环境），然后在浏览器访问 `http://127.0.0.1:8888`。**不要用 `npm run dev`**——vite dev server 代理到 `:8080`（生产 backend），会读写生产数据。

---

## 附录

### A. 版本历史

| 版本 | 日期 | 重点 |
|------|------|------|
| v0.14.0 | 2026-08-01 | 结构化数据富渲染（TableView + TreeView + 源码切换） |
| v0.13.1 | 2026-08-01 | 滚动架构统一 |
| v0.13.0 | 2026-07-31 | 交互一致性 |
| v0.12.3 | 2026-07-31 | 中文搜索修复 |
| v0.12.0 | 2026-07-30 | Card 交互重构 |
| v0.11.0 | 2026-07-23 | 账号设置 |
| v0.10.0 | 2026-07-22 | 冷打开优化 |

### B. 路线图

- [x] 结构化数据富渲染（T075）
- [x] 滚动架构统一（T084）
- [ ] Docker 部署（T071）
- [ ] 读取追踪强化（T078）
- [ ] 时间线 MVP（T077）
- [ ] 侧边栏可拖拽（T081）
- [ ] Admin 用户管理（T080）

### C. 相关文档

- [CLAUDE.md](../../CLAUDE.md) — 完整配置和规范
- [AGENTS.md](../../AGENTS.md) — 铁律和命令速览
- [DESIGN.md](../../DESIGN.md) — 前端设计系统
- [docs/process/debug-workflow.md](../../docs/process/debug-workflow.md) — 调试流程
- [docs/process/release.md](../../docs/process/release.md) — 发布流程

---

*本文档由 PeekView seed-data 提供，用于验证 Markdown 渲染、滚动、TOC、代码高亮等效果。*
