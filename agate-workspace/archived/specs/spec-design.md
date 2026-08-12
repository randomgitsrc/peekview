# Peek — 技术设计文档

> 版本: 2.0  
> 日期: 2026-04-17  
> 状态: 评审修正版  
> 变更: 根据三方评审意见修正，关键变更：id/slug 分离、目录结构保留、local_path 安全机制、FTS5 搜索、WAL 模式、统一错误响应

---

## 1. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | **FastAPI** (Python 3.12+) | 异步、高性能、自动 OpenAPI 文档 |
| 数据库 | **SQLite** (SQLModel ORM) | 单文件、零配置、易备份、WAL 模式 |
| 全文搜索 | **SQLite FTS5** | 内置全文索引，无需外部依赖 |
| 文件存储 | **本地文件系统** | 按条目 ID 组织目录，保留目录结构 |
| CLI | **Click** | Python CLI 标准库 |
| MCP Server | **FastMCP** | 将 API 封装为 MCP 工具 |
| 前端框架 | **Vue 3** + **Vite** | SPA，组合式 API |
| 代码高亮 | **Shiki** | 100+ 语言，VSCode 级着色，按需加载语言包 |
| Markdown | **markdown-it** + 插件 | mermaid / 表格 / 任务列表 / sanitize-html |
| Mermaid | **mermaid.js** | 图表渲染，超时降级 |
| HTTP 服务器 | **Uvicorn** | ASGI 服务器 |

---

## 2. 项目目录结构

```
peek/
├── docs/
│   └── specs/
│       ├── spec-requirements.md
│       ├── spec-design.md          # 本文件
│       ├── spec-test-plan.md
│       ├── spec-review-report.md   # PM 评审
│       ├── spec-design-review.md   # 架构师评审
│       └── spec-test-review.md     # QA 评审
│
├── backend/
│   ├── pyproject.toml           # 项目配置 + 依赖
│   ├── peek/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app 入口 + 中间件 + 异常处理
│   │   ├── config.py           # 配置管理（Pydantic BaseSettings）
│   │   ├── models.py           # SQLModel 数据模型
│   │   ├── database.py         # 数据库初始化 + WAL + FTS5
│   │   ├── storage.py          # 文件存储管理（含路径安全校验）
│   │   ├── language.py         # 语言检测（文件扩展名 → 语言标识）
│   │   ├── exceptions.py       # 统一异常层级
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── entries.py      # 条目 CRUD 路由
│   │   │   └── files.py        # 文件下载/打包路由
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── entry_service.py    # 条目业务逻辑
│   │   │   ├── file_service.py     # 文件处理逻辑（含 local_path 安全）
│   │   │   └── cleanup.py          # 过期清理逻辑
│   │   ├── cli.py              # Click CLI 命令
│   │   └── mcp_server.py       # MCP Server 封装
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py         # 测试 fixtures
│       ├── test_api.py         # API 测试
│       ├── test_models.py      # 数据模型测试
│       ├── test_storage.py     # 文件存储测试
│       ├── test_cli.py         # CLI 测试
│       ├── test_language.py    # 语言检测测试
│       ├── test_cleanup.py     # 过期清理测试
│       ├── test_security.py    # 安全测试
│       └── test_services.py    # 服务层测试
│
├── frontend-v3/                # Vue 3 + Vite + TypeScript + Shiki SPA (v3 - CURRENT)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── router/
│       │   └── index.ts        # Vue Router (history mode)
│       ├── api/
│       │   └── client.ts       # API client with list transform
│       ├── views/
│       │   ├── EntryDetailView.vue   # Entry detail with FileTree
│       │   └── EntryListView.vue     # Entry list
│       ├── components/
│       │   ├── FileTree.vue        # Recursive file tree
│       │   ├── CodeViewer.vue      # Code with line numbers, wrap mode
│       │   ├── MarkdownViewer.vue  # Markdown with TOC, Mermaid
│       │   ├── BinaryViewer.vue    # Binary download
│       │   ├── ImageViewer.vue     # Image inline
│       │   ├── TocNav.vue          # TOC navigation
│       │   ├── ThemeToggle.vue     # Theme switcher
│       │   ├── SearchBar.vue       # Search
│       │   ├── EntryCard.vue       # Entry card
│       │   └── ui/                 # UI components
│       │       ├── Button.vue
│       │       ├── IconButton.vue
│       │       ├── Tooltip.vue
│       │       ├── Toast.vue
│       │       └── LoadingSkeleton.vue
│       ├── composables/
│       │   ├── useTheme.ts         # Theme composable
│       │   ├── useShiki.ts         # Shiki highlighter singleton
│       │   ├── useEntry.ts         # Entry data composable
│       │   └── useToast.ts         # Toast notifications
│       ├── stores/
│       │   └── theme.ts            # Pinia theme store
│       ├── styles/
│       │   ├── variables.css       # Design tokens
│       │   ├── dark.css            # Dark theme
│       │   ├── light.css           # Light theme
│       │   ├── code.css            # Code viewer styles
│       │   └── components.css      # Component styles
│       └── types/
│           └── index.ts            # TypeScript types
│
├── frontend/                     # [DEPRECATED] Old frontend - DO NOT USE
│   └── ...                       # Kept for reference only
│
└── README.md
│       │   └── ActionBar.vue       # 复制/下载/打包按钮
│       ├── composables/
│       │   ├── useTheme.ts     # 主题逻辑
│       │   └── useEntry.ts     # 条目数据获取
│       ├── styles/
│       │   ├── variables.css   # CSS 变量（主题色）
│       │   ├── light.css       # 亮色主题
│       │   └── dark.css        # 暗色主题
│       └── types/
│           └── index.ts        # TypeScript 类型定义
│
└── README.md
```

---

## 3. 数据模型

### 3.1 entries 表

```sql
CREATE TABLE entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- 内部主键（不可变）
    slug        TEXT UNIQUE NOT NULL,                -- URL 标识（随机码或自定义）
    summary     TEXT NOT NULL,                       -- 一句话概述
    status      TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'published')),
    tags        TEXT DEFAULT '[]',                   -- JSON 数组: ["tag1", "tag2"]
    user_id     TEXT DEFAULT 'default',              -- 预留多用户，当前固定 'default'
    expires_at  DATETIME,                            -- 过期时间（可为 NULL）
    created_at  DATETIME NOT NULL,
    updated_at  DATETIME NOT NULL
);
```

**关键变更（vs v1.0）：**
- `id` 改为 `INTEGER AUTOINCREMENT`，始终为不可变内部主键
- `slug` 为独立的 `UNIQUE NOT NULL` 字段，承载 URL 标识职责
- 新增 `user_id` 预留字段
- `status` 增加 `CHECK` 约束

### 3.2 files 表

```sql
CREATE TABLE files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    path        TEXT,                   -- 相对路径，如 "src/main.py"（可为 NULL，表示无层级）
    filename    TEXT NOT NULL,          -- 文件名，如 "main.py"
    language    TEXT,                   -- 语言标识，如 "python"（自动检测）
    is_binary   BOOLEAN DEFAULT 0,
    size        INTEGER NOT NULL,       -- 字节数
    sha256      TEXT,                   -- 文件内容校验（可为 NULL）
    created_at  DATETIME NOT NULL
);
```

**关键变更（vs v1.0）：**
- 移除 `disk_path` — 改为动态计算，见 4.2 节
- 移除 `encoding` — 统一 UTF-8，非 UTF-8 文件标记为 binary
- 新增 `sha256` — 内容校验，支持去重和完整性验证
- `entry_id` 引用改为 `INTEGER`，匹配 entries.id 新类型

### 3.3 FTS5 全文搜索

```sql
CREATE VIRTUAL TABLE entries_fts USING fts5(
    summary,
    tags,
    content='entries',
    content_rowid=rowid
);

-- 触发器：自动同步 FTS 索引
CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
    INSERT INTO entries_fts(rowid, summary, tags) VALUES (new.rowid, new.summary, new.tags);
END;

CREATE TRIGGER entries_ad AFTER DELETE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, summary, tags) VALUES('delete', old.rowid, old.summary, old.tags);
END;

CREATE TRIGGER entries_au AFTER UPDATE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, summary, tags) VALUES('delete', old.rowid, old.summary, old.tags);
    INSERT INTO entries_fts(rowid, summary, tags) VALUES (new.rowid, new.summary, new.tags);
END;
```

> 注：文件内容搜索不在 FTS5 中索引（避免大文件内容膨胀索引）。文件名搜索通过 `files.filename LIKE` 实现，文件内容搜索为 P2 考虑。

### 3.4 索引

```sql
CREATE INDEX idx_entries_slug ON entries(slug);
CREATE INDEX idx_entries_status ON entries(status);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_expires_at ON entries(expires_at);
CREATE INDEX idx_entries_created_at ON entries(created_at);
CREATE INDEX idx_entries_updated_at ON entries(updated_at);
CREATE INDEX idx_files_entry_id ON files(entry_id);
```

### 3.5 标签查询

使用 SQLite 的 `json_each()` 函数（当前阶段）：

```sql
SELECT * FROM entries, json_each(entries.tags)
WHERE json_each.value = 'python';
```

> 数据量 > 5000 条目时迁移到 `entry_tags` 关联表 + 索引。

---

## 4. 文件存储

### 4.1 存储目录（保留目录结构）

```
~/.peek/
├── peek.db                        # SQLite 数据库（WAL 模式）
├── peek.log                       # 日志文件
├── config.yaml                    # 配置文件
└── data/
    └── default/                   # user_id 目录（预留多用户）
        └── {entry_id}/            # 每个条目一个目录
            ├── src/
            │   ├── main.py        # 保留原始目录结构
            │   └── utils.py
            ├── README.md
            └── logo.png           # 没有目录的文件直接放根级
```

**关键变更（vs v1.0）：**
- 保留原始目录结构，不再将路径分隔符替换为下划线
- 新增 `user_id` 层级目录，当前固定 `default`
- 原子操作：先写入临时目录，成功后再 rename 到最终路径

### 4.2 磁盘路径动态计算

移除 `files.disk_path` 字段，改为函数动态计算：

```python
def get_disk_path(entry_id: int, file_path: str | None, filename: str) -> Path:
    """根据 entry_id 和文件相对路径计算磁盘存储路径"""
    base = config.data_dir / "default" / str(entry_id)
    if file_path:
        return base / file_path
    return base / filename
```

### 4.3 local_path 安全机制

```python
FORBIDDEN_PATHS = [
    Path.home() / ".ssh",
    Path.home() / ".gnupg",
    # ... 其他黑名单
]

FORBIDDEN_PATTERNS = [
    ".env",          # 环境变量文件
    "id_rsa",        # SSH 私钥
    "id_ed25519",
]

def validate_local_path(local_path: str) -> Path:
    """校验 local_path 安全性"""
    resolved = Path(local_path).resolve()
    
    # 1. 拒绝符号链接
    if resolved.is_symlink():
        raise ForbiddenPathError(f"Symlinks not allowed: {local_path}")
    
    # 2. 黑名单目录检查
    for forbidden in FORBIDDEN_PATHS:
        if str(resolved).startswith(str(forbidden)):
            raise ForbiddenPathError(f"Access to {forbidden} is not allowed")
    
    # 3. 黑名单文件名检查
    for pattern in FORBIDDEN_PATTERNS:
        if pattern in resolved.name:
            raise ForbiddenPathError(f"Access to {resolved.name} is not allowed")
    
    # 4. 文件必须存在
    if not resolved.is_file():
        raise FileNotFoundError(f"File not found: {local_path}")
    
    return resolved
```

### 4.4 文件写入流程

```
1. 校验 local_path 安全性
2. 读取源文件内容
3. 写入临时目录 ~/.peek/data/.tmp/{uuid}/
4. 校验文件大小限制
5. rename 临时目录到最终路径
6. 更新数据库（事务）
7. 更新 FTS5 索引
8. 失败时：回滚数据库事务 + 清理临时文件
```

### 4.5 目录递归扫描

当 Agent 传入 `dirs` 参数时：

```python
IGNORED_DIRS = {".git", ".svn", "__pycache__", "node_modules", ".venv", "venv", ".tox", "dist", "build"}

def scan_directory(dir_path: str) -> list[FileInfo]:
    """递归扫描目录，返回文件列表"""
    root = Path(dir_path).resolve()
    files = []
    for path in root.rglob("*"):
        if path.is_file():
            # 跳过忽略目录
            if any(ignored in path.parts for ignored in IGNORED_DIRS):
                continue
            # 跳过隐藏文件
            if any(part.startswith(".") for part in path.parts):
                continue
            rel_path = path.relative_to(root)
            files.append(FileInfo(
                path=str(rel_path),
                filename=path.name,
                local_path=str(path),
            ))
    return files
```

### 4.6 删除策略

- 删除条目时，级联删除 `data/{user_id}/{entry_id}/` 整个目录
- 过期清理：后端启动时扫描 `expires_at < now()` 的条目，执行删除
- 删除顺序：先删 DB 记录（事务），再删文件（best-effort）
- 清理失败的文件记录到日志，后续重试

---

## 5. API 设计

### 5.1 基础信息

- Base URL: `http://localhost:{port}/api/v1`
- Content-Type: `application/json`
- 健康检查: `GET /health`

### 5.2 统一错误响应格式

所有 API 错误使用统一格式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "人类可读的错误描述",
    "details": null
  }
}
```

**错误码与 HTTP 状态码映射：**

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 400 | `VALIDATION_ERROR` | 参数校验失败 |
| 400 | `INVALID_SLUG` | slug 格式不合法 |
| 403 | `FORBIDDEN_PATH` | local_path 在黑名单中 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 404 | `FILE_NOT_FOUND` | local_path 指向的文件不存在 |
| 413 | `PAYLOAD_TOO_LARGE` | 超出资源限制 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

### 5.3 端点

#### 条目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/entries` | 创建条目 |
| GET | `/entries` | 条目列表（分页、搜索、标签过滤） |
| GET | `/entries/{slug}` | 条目详情 |
| PATCH | `/entries/{slug}` | 更新条目（局部更新） |
| DELETE | `/entries/{slug}` | 删除条目 |

> 变更（vs v1.0）：
> - 路由使用 `slug` 而非 `id`
> - `/archive`、`/publish` 合并为 `PATCH /entries/{slug}` 更新 status
> - `/search` 合并到 `GET /entries?q=keyword`
> - `PUT` 改为 `PATCH`（局部更新语义更准确）

#### 文件操作

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/entries/{slug}/files/{file_id}` | 获取单个文件内容 |
| GET | `/entries/{slug}/download` | 打包下载（zip） |

#### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务健康状态 |

### 5.4 创建条目请求

**方式一：内容直传**

```json
POST /api/v1/entries
{
  "summary": "FastAPI 认证模块设计",
  "slug": "auth-design",
  "tags": ["python", "auth"],
  "expires_in": "7d",
  "files": [
    {
      "path": "src/auth.py",
      "content": "from fastapi import Depends\n..."
    },
    {
      "path": "README.md",
      "content": "# Auth Module\n..."
    }
  ]
}
```

**方式二：本地路径引用**

```json
POST /api/v1/entries
{
  "summary": "项目配置文件",
  "files": [
    {"path": "config.yaml", "local_path": "/home/xz/lab/project/config.yaml"},
    {"path": "Dockerfile", "local_path": "/home/xz/lab/project/Dockerfile"}
  ]
}
```

**方式三：目录上传**

```json
POST /api/v1/entries
{
  "summary": "项目源码展示",
  "dirs": [
    {"path": "/home/xz/lab/project/src"}
  ]
}
```

**方式四：混合**

```json
POST /api/v1/entries
{
  "summary": "完整项目展示",
  "dirs": [
    {"path": "/home/xz/lab/project/src"}
  ],
  "files": [
    {"path": "README.md", "content": "# Hello"},
    {"path": "config.yaml", "local_path": "/home/xz/lab/project/config.yaml"}
  ]
}
```

### 5.5 创建条目响应

```json
{
  "id": 42,
  "slug": "auth-design",
  "url": "https://peek.example.com/view/auth-design",
  "created_at": "2026-04-17T10:00:00Z"
}
```

slug 冲突时：

```json
{
  "id": 43,
  "slug": "auth-design-2",
  "url": "https://peek.example.com/view/auth-design-2",
  "created_at": "2026-04-17T10:05:00Z"
}
```

### 5.6 条目列表

```
GET /api/v1/entries?q=auth&tags=python&status=active&page=1&per_page=20
```

```json
{
  "items": [
    {
      "id": 42,
      "slug": "auth-design",
      "summary": "FastAPI 认证模块设计",
      "tags": ["python", "auth"],
      "status": "active",
      "file_count": 2,
      "created_at": "2026-04-17T10:00:00Z",
      "updated_at": "2026-04-17T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 20
}
```

### 5.7 更新条目

```json
PATCH /api/v1/entries/auth-design
{
  "summary": "更新后的概述",
  "status": "archived",
  "add_files": [
    {"path": "tests/test_auth.py", "content": "import pytest\n..."}
  ],
  "remove_file_ids": [5],
  "add_dirs": [
    {"path": "/home/xz/lab/project/tests"}
  ],
  "tags": ["python", "auth", "testing"]
}
```

### 5.8 条目详情

```
GET /api/v1/entries/auth-design
```

```json
{
  "id": 42,
  "slug": "auth-design",
  "summary": "FastAPI 认证模块设计",
  "status": "active",
  "tags": ["python", "auth"],
  "files": [
    {
      "id": 1,
      "path": "src/auth.py",
      "filename": "auth.py",
      "language": "python",
      "is_binary": false,
      "size": 256,
      "line_count": 12
    }
  ],
  "expires_at": null,
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:00:00Z"
}
```

---

## 6. 异常体系

```python
class PeekError(Exception):
    """基础异常"""
    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

class ValidationError(PeekError):
    """参数校验失败"""
    status_code = 400
    error_code = "VALIDATION_ERROR"

class InvalidSlugError(PeekError):
    """slug 格式不合法"""
    status_code = 400
    error_code = "INVALID_SLUG"

class ForbiddenPathError(PeekError):
    """local_path 在黑名单中"""
    status_code = 403
    error_code = "FORBIDDEN_PATH"

class NotFoundError(PeekError):
    """资源不存在"""
    status_code = 404
    error_code = "NOT_FOUND"

class FileNotFoundError(PeekError):
    """文件不存在"""
    status_code = 404
    error_code = "FILE_NOT_FOUND"

class PayloadTooLargeError(PeekError):
    """超出资源限制"""
    status_code = 413
    error_code = "PAYLOAD_TOO_LARGE"

class ConflictError(PeekError):
    """资源冲突"""
    status_code = 409
    error_code = "CONFLICT"
```

在 FastAPI `main.py` 中注册全局异常处理：

```python
@app.exception_handler(PeekError)
async def peek_error_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.error_code, "message": str(exc), "details": None}}
    )
```

---

## 7. 中间件

### 7.1 CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)
```

生产模式（FastAPI 托管前端静态文件）不需要 CORS。

### 7.2 请求日志

每个请求记录：method、path、status_code、duration、request_id。

### 7.3 全局异常处理

见第 6 节。

---

## 8. 数据库初始化

```python
def init_db(db_path: Path):
    """初始化数据库，启用 WAL 模式"""
    engine = create_engine(f"sqlite:///{db_path}")
    
    with engine.connect() as conn:
        # 启用 WAL 模式（提高并发读写性能）
        conn.execute(text("PRAGMA journal_mode=WAL"))
        # 忙等超时 5 秒
        conn.execute(text("PRAGMA busy_timeout=5000"))
        # 外键约束
        conn.execute(text("PRAGMA foreign_keys=ON"))
    
    SQLModel.metadata.create_all(engine)
```

---

## 9. 配置

### 9.1 配置文件 (`~/.peek/config.yaml`)

```yaml
server:
  host: "127.0.0.1"        # 默认仅本地访问，0.0.0.0 需显式配置
  port: 8080
  base_url: ""              # 留空则用 http://localhost:{port}

storage:
  data_dir: "~/.peek/data"
  db_path: "~/.peek/peek.db"
  forbidden_paths:          # local_path 黑名单
    - "~/.ssh"
    - "~/.gnupg"
  ignored_dirs:             # 目录扫描忽略
    - ".git"
    - "__pycache__"
    - "node_modules"
    - ".venv"
    - "venv"
    - "dist"
    - "build"

limits:
  max_file_size: 10485760        # 10MB
  max_content_length: 1048576    # 1MB（内容直传）
  max_entry_files: 50
  max_entry_size: 104857600      # 100MB
  max_slug_length: 64
  max_summary_length: 500

cleanup:
  check_on_start: true
  interval_seconds: 3600         # 0 = 不检查

logging:
  level: "INFO"
  file: "~/.peek/peek.log"
```

### 9.2 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PEEK_HOST` | 监听地址 | `127.0.0.1` |
| `PEEK_PORT` | 监听端口 | `8080` |
| `PEEK_BASE_URL` | 外部访问 URL | 空 |
| `PEEK_DATA_DIR` | 数据目录 | `~/.peek/data` |
| `PEEK_DB_PATH` | 数据库路径 | `~/.peek/peek.db` |
| `PEEK_LOG_LEVEL` | 日志级别 | `INFO` |

### 9.3 配置优先级

环境变量 > 配置文件 > 默认值

### 9.4 首次运行

- 首次运行自动创建 `~/.peek/` 目录和默认配置文件
- 使用 Pydantic `BaseSettings` 做配置验证

### 9.5 URL 生成逻辑

```python
def build_view_url(slug: str) -> str:
    base = config.base_url or f"http://{config.host}:{config.port}"
    return f"{base}/view/{slug}"
```

---

## 10. 语言检测映射

根据文件扩展名自动检测语言，供前端 Shiki 高亮使用：

```python
EXTENSION_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".java": "java",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".toml": "toml",
    ".md": "markdown",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "zsh",
    ".sql": "sql",
    ".dockerfile": "dockerfile",
    ".makefile": "makefile",
    ".txt": "text",
    ".log": "log",
}

FILENAME_MAP = {
    "Makefile": "makefile",
    "Dockerfile": "dockerfile",
    "CMakeLists.txt": "cmake",
    ".gitignore": "gitignore",
    ".env": "env",
}
```

---

## 11. 前端路由

| 路径 | 页面 |
|------|------|
| `/` | 索引页（条目列表） |
| `/view/:slug` | 条目详情页 |
| `/view/:slug?file=main.py` | 定位到指定文件 |

---

## 12. 前端组件设计

### 12.1 EntryView（条目详情页）

```
┌──────────────────────────────────────────────┐
│  🔙 返回索引    概述文本         🌓 📋 ⬇️ 📦  │  ← 顶栏
├──────────┬───────────────────────────────────┤
│          │                                   │
│  📁 目录树 │      代码/Markdown 渲染区          │  ← 主内容区
│  ├ src/  │                                   │
│  │ └ a.py│                                   │
│  └ b.md  │                                   │
│          │                                   │
├──────────┴───────────────────────────────────┤
│  标签: [python] [auth]    创建: 2026-04-17   │  ← 底栏
└──────────────────────────────────────────────┘
```

**手机端：** 目录树折叠为左滑抽屉 / 下拉菜单

### 12.2 Markdown 渲染特化

```
┌──────────────────────────────────────┐
│  目录大纲（TOC）         [收起/展开]   │
│  ├ 1. 概述                           │
│  ├ 2. 设计                           │
│  │ ├ 2.1 数据模型                     │
│  │ └ 2.2 API 设计                     │
│  └ 3. 总结                           │
├──────────────────────────────────────┤
│                                      │
│  ## 1. 概述                          │
│  正文内容...                          │
│                                      │
│  ```python          [📋 复制]         │
│  def hello():                        │
│      print("hi")                     │
│  ```                                 │
│                                      │
│  | 列1 | 列2 |  ← 可左右拖动          │
│  |-----|-----|                       │
│  | a   | b   |                       │
│                                      │
└──────────────────────────────────────┘
```

### 12.3 Shiki 按需加载

```typescript
// 只加载当前文件所需的语言包
import { createHighlighter } from 'shiki'

const highlighter = await createHighlighter({
  themes: ['github-dark', 'github-light'],
  langs: [currentLanguage],  // 按需加载
})
```

### 12.4 Markdown XSS 防护

```typescript
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'

const md = new MarkdownIt({
  html: false,        // 禁止原始 HTML
  linkify: true,
  typographer: true,
})

// 渲染后二次过滤
function renderMarkdown(content: string): string {
  const html = md.render(content)
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
    },
  })
}
```

---

## 13. 过期清理机制

- 启动时：扫描 `expires_at < now()` 的条目，删除记录 + 文件目录
- 运行时：按 `cleanup.interval_seconds` 间隔定期检查（可配置为 0 关闭）
- 过期时间格式：支持 `7d`（7天）、`30d`（30天）、`1h`（1小时）等
- 清理顺序：先删 DB（事务），再删文件（best-effort），失败记录日志
- 孤儿清理：定期扫描 `data/` 目录与 DB 记录不一致的文件

---

## 14. 部署方案

### 14.1 本地开发

```bash
# 后端
cd backend && pip install -e . && peek serve

# 前端（开发模式，热更新）
cd frontend-v3 && npm install && npm run dev
```

### 14.2 生产部署

**注意：** 使用 `frontend-v3/` 目录（当前版本），`frontend/` 已弃用。

前端构建后，由 FastAPI 托管静态文件：

```bash
cd frontend && npm run build    # 产出 dist/
cd backend && peek serve        # 同时服务 API + 静态文件
```

### 14.3 Docker 部署

```dockerfile
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/ .
RUN npm ci && npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/ .
COPY --from=frontend /app/frontend/dist /app/static/
RUN pip install -e .
EXPOSE 8080
CMD ["peek", "serve"]
```

---

## 15. 测试策略

### 15.1 后端测试

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | pytest | models, storage, language, cleanup, services |
| API 测试 | pytest + httpx | 所有 API 端点 |
| CLI 测试 | pytest + Click testing | 所有 CLI 命令 |
| 安全测试 | pytest | local_path 黑名单、路径遍历、XSS |
| 集成测试 | pytest | 端到端：创建 → 查看 → 删除 |

### 15.2 前端测试

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 组件测试 | Vitest + Vue Test Utils | 组件渲染、交互 |
| E2E 测试 | Playwright（可选） | 关键用户流程 |

### 15.3 测试原则

- 数据库测试使用临时目录，不触碰真实 `~/.peek/`
- 每个测试独立，不依赖其他测试的副作用
- 核心 API 端点必须有测试覆盖
- 安全测试覆盖：路径遍历、黑名单绕过、XSS 注入

---

## 16. 日志方案

- 使用 Python 标准 `logging` 模块
- 日志写入 `~/.peek/peek.log`
- 日志级别可配置（默认 INFO）
- 格式：`{timestamp} {level} {module} {message}`
- 请求日志包含 request_id（便于追踪）
