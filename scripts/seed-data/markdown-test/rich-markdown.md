# PeekView 开发文档

> 让 Agent 产出物**可读、可查、可回溯**。

PeekView 是一个轻量级内容发布平台，专为 AI Agent 工作流设计。

## 1. 核心概念

PeekView 的核心是 **Entry**（条目）——一个不可变的内容快照，包含：

- 摘要（summary）+ slug（URL 友好标识）
- 多个文件（代码、文档、图片）
- 标签、权限、状态

Entry 创建后不可修改，只能覆盖发布新版本（immutable snapshot 语义）。

### 1.1 文件类型自动检测

后端根据扩展名自动检测语言，前端根据 language 字段选择渲染器：

| 扩展名 | language | 渲染器 |
|--------|----------|--------|
| `.md` | `markdown` | MarkdownViewer |
| `.html` | `html` | HtmlViewer |
| `.csv` | `csv` | TableView |
| `.tsv` | `tsv` | TableView |
| `.json` | `json` | TreeView |
| `.yaml` | `yaml` | TreeView |
| `.xml` | `xml` | TreeView |
| `.py` | `python` | CodeViewer |
| `.ts` | `typescript` | CodeViewer |
| `.svg` | `xml` | ImageViewer + CodeViewer |

### 1.2 权限模型

- **Anonymous**：仅公开 entry
- **Authenticated**：公开 + 自己的私有
- **Admin**：全部可见

私有 entry 对非 owner 返回 404（非 403），防止 slug 枚举。

## 2. API 设计

### 2.1 认证三层

```python
# JWT Cookie（浏览器自动携带）
resp = client.post("/api/v1/auth/login", json=creds)

# Bearer Header（API 调用）
client.headers["Authorization"] = f"Bearer {token}"

# API Key（Agent 长期凭证）
client.headers["Authorization"] = "pv_xxxxxxxx"
```

### 2.2 Entry CRUD

```bash
# 创建
curl -X POST /api/v1/entries \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"summary":"test","slug":"my-entry","files":[...]}'

# 读取
curl /api/v1/entries/my-entry

# 原始内容（Agent 读路径）
curl /api/v1/entries/my-entry/raw
```

### 2.3 搜索（FTS5）

```sql
-- jieba 预分词 + json_each 精确匹配
SELECT e.slug, e.summary FROM entries_fts
JOIN entries e ON e.id = entries_fts.rowid
WHERE entries_fts MATCH :query
ORDER BY rank
LIMIT 20;
```

## 3. 前端架构

### 3.1 组件层次

```
App.vue
├── Landing.vue（首页）
├── EntryListView.vue（列表页）
│   └── EntryCard.vue × N
└── EntryDetailView.vue（详情页）
    ├── EntryDetailHeader.vue（sticky header + actions）
    ├── EntryDetailSidebar.vue（file tree + TOC）
    └── EntryDetailContent.vue（渲染调度链）
        ├── HtmlViewer.vue
        ├── MarkdownViewer.vue
        ├── TableView.vue ← T075
        ├── TreeView.vue ← T075
        ├── ImageViewer.vue
        └── CodeViewer.vue（fallback）
```

### 3.2 滚动架构

`.content-area` 是唯一纵向滚动容器。Viewer 组件不声明 `overflow-y`，让外层控制。

```css
.content-area {
  overflow-y: auto;  /* 唯一纵向滚动 */
  padding: var(--space-4);
}
/* viewer 组件不 overflow-y */
```

### 3.3 源码/渲染切换

所有富渲染格式（CSV/TSV/JSON/YAML/XML/Markdown）支持 `<>` 按钮切换：

- 默认渲染视图（表格/树/Markdown）
- 点击切换 → CodeViewer 源码高亮
- 文件切换时重置为渲染视图

## 4. MCP Server

### 4.1 双模式

| 模式 | 架构 | 暴露工具 |
|------|------|----------|
| remote | A→B→C | create_entry / get_entry / list_entries / delete_entry |
| local | A=B→C | publish_files / get_entry / list_entries / delete_entry |

### 4.2 publish_files 语义

`publish_files` 在 slug 已存在时走**覆盖路径**（immutable update）：

```typescript
// MCP 工具调用
await client.callTool({
  name: "publish_files",
  arguments: {
    summary: "修复记录",
    slug: "fix-2024-001",
    paths: ["/project/fix.py"],
    is_public: true
  }
});
```

## 5. 部署

### 5.1 开发环境

```bash
make dev          # 创建/更新 venv
make debug        # 一键调试（build + start + seed + test）
make test-quick   # 后端测试
make test-frontend # 前端测试
make typecheck    # 类型检查
make lint         # ruff
```

### 5.2 生产部署

```bash
pipx install peekview
peekview serve --host 0.0.0.0 --port 8080
```

## 6. 版本历史

| 版本 | 日期 | 重点 |
|------|------|------|
| v0.14.0 | 2026-08-01 | 结构化数据富渲染 |
| v0.13.1 | 2026-08-01 | 滚动架构统一 |
| v0.13.0 | 2026-07-31 | 交互一致性 |
| v0.12.3 | 2026-07-31 | 中文搜索修复 |
| v0.12.0 | 2026-07-30 | Card 交互重构 |
| v0.11.0 | 2026-07-23 | 账号设置 |
| v0.10.0 | 2026-07-22 | 冷打开优化 |

## 7. 测试策略

### 7.1 测试金字塔

- **单元测试**（vitest + pytest）：composable 逻辑、parser 边界
- **组件测试**（vitest + @vue/test-utils）：mount + props/emit 断言
- **E2E 测试**（Playwright CDP）：真实浏览器交互验证

### 7.2 Gate 流程

```
P3 TDD 红灯 → P4 实现 → P5 技术验证 → P6 BDD 验收 → P7 一致性 → P8 发布
```

## 8. FAQ

### Q: 为什么 Entry 不可变？

A: Entry 代表一个已发布快照。如果允许原地修改，多 Agent 协作时会丢失历史上下文。覆盖发布（publish）语义上等于 git commit + amend。

### Q: 为什么用 SQLite 而不是 PostgreSQL？

A: PeekView 定位是轻量级工具，单机部署。SQLite WAL 模式下读写并发足够，运维零成本。FTS5 原生支持全文搜索。

### Q: 为什么 MCP 不暴露 updateEntry？

A: PeekView 定位是发布记录而非协作编辑。`publish_files` 已支持覆盖语义（immutable update），不需要 partial update。

## 9. 路线图

- [x] 结构化数据富渲染（T075）
- [x] 滚动架构统一（T084）
- [ ] Docker 部署（T071）
- [ ] 读取追踪强化（T078）
- [ ] 时间线 MVP（T077）
- [ ] 侧边栏可拖拽（T081）

## 10. 数据库设计

PeekView 使用 SQLite WAL 模式，核心表结构如下：

### 10.1 entries 表

```sql
CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    tags TEXT DEFAULT '[]',  -- JSON 数组
    is_public BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'active',  -- active / archived / deleted
    user_id INTEGER REFERENCES users(id),
    idempotency_key TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

### 10.2 files 表

```sql
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content TEXT,  -- NULL for binary files
    language TEXT,
    is_binary BOOLEAN DEFAULT 0,
    size INTEGER DEFAULT 0,
    line_count INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 10.3 FTS5 全文索引

```sql
CREATE VIRTUAL TABLE entries_fts USING fts5(
    content,
    content='entries',
    content_rowid='id',
    tokenize='unicode61'
);
```

FTS5 支持 MATCH 查询、rank 排序、snippet 高亮。jieba 预分词确保中文分词准确。

## 11. 配置系统

PeekView 使用 Pydantic Settings 管理配置，支持环境变量嵌套：

```python
class StorageConfig(BaseModel):
    data_dir: Path = Path("~/.peekview").expanduser()
    db_path: Path | None = None  # 默认 data_dir / peekview.db

class SecurityConfig(BaseModel):
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 1440  # 24h
    bcrypt_rounds: int = 12

class PeekConfig(BaseSettings):
    storage: StorageConfig = StorageConfig()
    security: SecurityConfig = SecurityConfig()
    debug_mode: bool = False

    class Config:
        env_prefix = "PEEKVIEW_"
        env_nested_delimiter = "__"
```

环境变量示例：`PEEKVIEW_STORAGE__DATA_DIR=/data` → `config.storage.data_dir`

## 12. 安全考量

### 12.1 CSP 策略

主应用 CSP 允许 `script-src 'self' 'unsafe-eval'`——Mermaid/d3 的 `new Function()` 必需。

HTML 渲染路由返回独立宽松 CSP + `sandbox="allow-scripts allow-forms"`（无 `allow-same-origin`，iframe opaque origin 无法访问主页面凭据）。

### 12.2 API Key 安全

- 前缀 `pv_` 便于识别
- HMAC-SHA256 hash 存储（不存明文）
- 每用户最多 10 个
- Global API key 中间件跳过 auth 端点

### 12.3 路径安全

- `local_path` 必须 allowlist + symlink 先检查再 resolve
- 后端拒绝 symlink，MCP 用 realpath 跟随后检查

---

*本文档由 PeekView seed-data 自动加载，用于验证 Markdown 渲染 + 滚动 + TOC 效果。*
