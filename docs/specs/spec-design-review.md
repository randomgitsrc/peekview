# Peek 技术设计评审报告

> 评审人: 技术架构师视角  
> 日期: 2026-04-17  
> 基于文档: 需求规格 v1.0 / 技术设计 v1.0 / 测试计划 v1.0

---

## 总体评价

设计整体**方向正确**，技术选型与"轻量级本地服务"的定位匹配。目录结构清晰，前后端分离合理，需求覆盖完整。但在安全性、数据模型严谨性、API 语义一致性、存储方案鲁棒性方面存在**若干需要在开发前修正的问题**，其中 2 个为 **🔴 严重（阻塞发布）**，5 个为 **🟡 重要（影响质量）**，其余为 **🔵 建议**。

---

## 1. 架构设计评审

### ✅ 合理之处
- FastAPI + SQLite + 文件系统的组合，符合零依赖、易备份的定位
- 前后端分离（Vue 3 SPA + REST API），开发体验好
- 分层清晰：api → services → models/storage，职责分明
- 生产部署由 FastAPI 托管前端静态文件，避免引入 Nginx，简化部署

### 🟡 问题 1: SQLite 并发写入未说明 WAL 模式

SQLite 默认 journal 模式在并发写入时容易产生 `database is locked`。设计文档未提及 WAL 模式。

**建议**: 在 `database.py` 初始化时显式启用：
```python
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
```

### 🟡 问题 2: 缺少中间件层描述

设计文档未涉及以下中间件:
- CORS 配置（前后端分离开发时必需）
- 请求日志/追踪
- 全局异常处理

**建议**: 在 `main.py` 中增加:
- `CORSMiddleware` 配置
- 全局 `exception_handler` 统一错误响应格式
- 请求 ID 追踪（便于调试）

### 🔵 建议: 缺少日志方案

未定义日志框架、日志级别、日志输出位置。对于调试和运维都很关键。

**建议**: 采用 `structlog` 或标准 `logging`，配置写入 `~/.peek/peek.log`。

---

## 2. 数据模型评审

### 🔴 问题 3: `entries.id` 语义混淆 — 既是主键又当 slug

```sql
id TEXT PRIMARY KEY  -- 短随机码或 slug
```

`id` 同时承载了**数据库主键**和 **URL 标识**两个职责。当 slug 冲突自动追加 `-N` 后缀时，实际存入 `id` 的是 `auth-design-2`，这导致:
- 主键含义不清晰（是标识符？是显示名？）
- 如果未来需要修改 slug，必须改主键，级联影响 `files.entry_id`
- 自动生成的随机码（如 `xK9m2p`）和 slug 混在同一字段，无法区分来源

**建议**: 分离主键和 slug:
```sql
CREATE TABLE entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- 内部主键
    slug        TEXT UNIQUE NOT NULL,                -- URL 标识（随机码或自定义）
    summary     TEXT NOT NULL,
    ...
);
```
URL 路由使用 `slug`，内部关联使用 `id`。API 响应中可同时返回 `id` 和 `slug`。

### 🟡 问题 4: `files.disk_path` 存储绝对路径 — 冗余 + 耦合

```sql
disk_path TEXT NOT NULL  -- 磁盘存储路径
```

- 文件存储在 `~/.peek/data/{entry_id}/` 下，路径完全可由 `entry_id + filename` 推导，`disk_path` 是冗余字段
- 存储绝对路径将数据绑定到特定机器，迁移时需批量更新
- 如果存储目录配置变更，所有 `disk_path` 都需更新

**建议**: 移除 `disk_path`，改为动态计算:
```python
def get_disk_path(entry_id: str, filename: str) -> Path:
    return config.data_dir / entry_id / filename
```

### 🟡 问题 5: 缺少文件内容校验字段

没有 `content_hash` 或 `checksum` 字段，无法:
- 检测文件损坏
- 实现去重（同一内容多次上传）
- 验证下载完整性

**建议**: 增加 `sha256 TEXT` 字段到 `files` 表。

### 🔵 建议: 缺少多用户预留字段

需求规格 4.3 提到"数据模型预留多用户字段"，但设计文档的表结构中**完全没有 `user_id` 字段**。

**建议**: 即使当前不启用，也应预留:
```sql
user_id TEXT DEFAULT 'default'  -- 预留，当前版本固定为 'default'
```
这为未来多用户扩展节省大量迁移成本（详见第 9 节）。

### 🔵 建议: `tags` 字段查询性能

使用 JSON 数组存储标签 + `json_each()` 查询，在数据量增长后无法建索引。当前阶段可接受，但建议在文档中注明**未来迁移到关联表**的计划:
```sql
CREATE TABLE entry_tags (
    entry_id TEXT REFERENCES entries(id),
    tag TEXT,
    PRIMARY KEY (entry_id, tag)
);
CREATE INDEX idx_entry_tags_tag ON entry_tags(tag);
```

### 🔵 建议: `status` 字段缺少约束

```sql
status TEXT DEFAULT 'active'  -- active / archived / published
```

没有 CHECK 约束，可写入任意值。

**建议**: 添加 `CHECK(status IN ('active', 'archived', 'published'))`，或在应用层用 Enum 强约束。

---

## 3. API 设计评审

### 🟡 问题 6: `PATCH /entries/{id}/archive` 和 `/publish` 不符合 RESTful 语义

RESTful 原则中，URL 应标识资源而非动作。`/archive` 和 `/publish` 是动词，不是资源。

**建议方案 A**（推荐）: 统一用 `PATCH /entries/{id}` 更新状态:
```json
PATCH /api/v1/entries/auth-design
{"status": "archived"}
```

**建议方案 B**: 如果需要保留专用端点，改用更 RESTful 的方式:
```
POST /api/v1/entries/{id}/status-changes  {"status": "archived"}
```

### 🟡 问题 7: `GET /search?q=keyword` 应归属条目资源

搜索的本质是"带过滤条件的条目列表"，不应是独立的顶级资源。

**建议**: 合并到 `GET /entries`，通过 query 参数统一:
```
GET /api/v1/entries?q=keyword&tags=python&status=active&page=1&per_page=20
```
删除 `/search` 端点，减少 API 面积。

### 🔵 建议: `PUT /entries/{id}` 语义不准确

PUT 语义是**完整替换**，但设计中支持"添加文件"和"删除文件"的局部更新。应改为 `PATCH /entries/{id}`，或明确 PUT 是全量替换、PATCH 是部分更新。

### 🔵 建议: 缺少统一的错误响应格式

设计文档定义了成功响应，但没有定义错误响应格式。

**建议**: 统一为:
```json
{
  "error": {
    "code": "ENTRY_NOT_FOUND",
    "message": "Entry 'xxx' not found",
    "detail": null
  }
}
```
配合标准 HTTP 状态码: 400/404/409/422/500。

### 🔵 建议: 创建条目响应缺少完整信息

当前创建响应只返回 `id` 和 `url`。建议至少增加 `created_at`，便于客户端确认。

---

## 4. 文件存储方案评审

### 🔴 问题 8: 路径分隔符替换为下划线的文件名冲突

设计将 `src/main.py` → `src_main.py`，但以下场景会**静默冲突**:
- 文件 `src_main.py` 和 `src/main.py` 会映射到相同磁盘文件名
- `a/b/c.py` 和 `a/b_c.py` 和 `a_b/c.py` 全部映射到 `a_b_c.py`

**建议方案 A**（推荐）: 保留目录结构:
```
data/{entry_id}/
├── src/
│   └── main.py
├── README.md
└── image.png
```
直接按相对路径创建子目录，天然避免冲突，且目录树信息可从文件系统直接还原。

**建议方案 B**: 如果坚持扁平存储，使用确定性编码:
```
src/main.py  →  src%2Fmain.py  (URL编码路径分隔符)
```

### 🟡 问题 9: `local_path` 读取任意服务器文件 — 严重安全风险

需求允许 Agent 传入 `local_path: "/home/xz/lab/project/config.yaml"`，后端直接读取服务器文件。这意味着:
- **路径遍历**: 可读取 `/etc/passwd`, `/etc/shadow`, `~/.ssh/id_rsa` 等敏感文件
- **信息泄露**: 可读取同机器其他项目的源码、配置、密钥
- **无认证 + 任意文件读取 = 远程文件泄露攻击面**

**建议**: 
1. 限制 `local_path` 只能读取配置中指定的**允许目录白名单**:
   ```yaml
   storage:
     allowed_paths:
       - /home/xz/lab/projects/
       - /tmp/
   ```
2. 路径解析后验证 `resolve()` 结果在允许目录内
3. 拒绝符号链接指向白名单外的路径
4. 长期方案: 移除 `local_path`，Agent 应自行读取文件后以 `content` 方式上传

### 🟡 问题 10: 无文件大小限制

未定义单文件大小上限和单条目总大小上限。Agent 可能传入超大文件导致:
- 磁盘写满
- 内存溢出（大文件内容直传时在请求体中）
- 响应超时

**建议**: 在配置中增加:
```yaml
storage:
  max_file_size: 10MB        # 单文件上限
  max_entry_size: 100MB      # 单条目总大小上限
  max_files_per_entry: 50    # 单条目文件数上限
```

### 🔵 建议: 无磁盘空间监控

没有磁盘使用量监控和告警机制。建议定期检查可用空间，低于阈值时拒绝创建。

---

## 5. 安全性评审

### 🔴 问题 11: 无认证 + 任意文件读取 = 严重安全缺陷

综合问题 9 和无认证设计:
- 任何能访问 API 的人都可以读取服务器上的任意文件
- 即使是"本地使用"场景，绑定 `0.0.0.0` 默认监听意味着局域网内任何人可访问

**建议**（分层实施）:
1. **P0**: `local_path` 增加白名单限制（见问题 9）
2. **P0**: 默认监听地址改为 `127.0.0.1`，`0.0.0.0` 需显式配置
3. **P1**: 增加 API Key 认证（简单 Header 校验即可）:
   ```yaml
   auth:
     api_key: "your-secret-key"  # 留空则不启用
   ```
4. **P2**: 支持 Bearer Token 认证

### 🟡 问题 12: Markdown 渲染 XSS 风险

`markdown-it` 默认不防止 XSS。Agent 传入的内容如果包含 `<script>` 标签或恶意 HTML，将在用户浏览器中执行。

**建议**: 
- 使用 `markdown-it` 的 `html: false` 选项，或集成 `sanitize-html`
- 对 Mermaid 渲染使用沙箱 iframe
- 在前端对用户内容统一做 HTML 转义

### 🟡 问题 13: 路径遍历风险（文件存储）

文件 `path` 字段如 `../../etc/passwd` 可能导致写入到数据目录外。

**建议**: 在 `storage.py` 中强制校验:
```python
def sanitize_path(path: str) -> str:
    # 拒绝 .. 和绝对路径
    parts = Path(path).parts
    if '..' in parts or Path(path).is_absolute():
        raise ValueError(f"Invalid path: {path}")
    return str(Path(*parts))
```

### 🔵 建议: 缺少 Rate Limiting

无认证场景下，恶意请求可快速填满磁盘或耗尽连接。

**建议**: 使用 `slowapi` 或自定义中间件实现基本限流（如 100 req/min）。

### 🔵 建议: 缺少输入长度限制

`summary`、`tags`、`content` 等字段没有长度限制。超长输入可导致数据库膨胀或内存问题。

**建议**: 在 Pydantic 模型中添加 `Field(max_length=...)` 约束。

---

## 6. 性能瓶颈预判

### 🟡 问题 14: 全文搜索未使用 FTS5

`GET /entries?search=keyword` 最可能的实现是 `WHERE summary LIKE '%keyword%'`，这无法利用索引，全表扫描。搜索文件内容更慢（需读磁盘）。

**建议**: 使用 SQLite FTS5:
```sql
CREATE VIRTUAL TABLE entries_fts USING fts5(
    summary, tags, content='entries', content_rowid=rowid
);
```
在条目创建/更新时同步维护 FTS 索引。文件内容也可纳入 FTS。

### 🟡 问题 15: Shiki 首屏加载性能

Shiki 加载 100+ 语言语法需要大量 WASM/JSON 文件。首屏加载时间 < 500ms 的目标可能难以达到。

**建议**:
- 按需加载语言包（只加载当前文件所需语言）
- 使用 Shiki 的 `createHighlighter` 懒加载模式
- 考虑后端预渲染高亮结果（减少前端计算）

### 🔵 建议: 分页参数缺少上限校验

`per_page` 无最大值限制，客户端可传 `per_page=10000` 导致慢查询和大量响应。

**建议**: 限制 `per_page` 范围为 1-100，默认 20。

### 🔵 建议: 条目列表查询缺少索引优化

`GET /entries?tags=python` 使用 `json_each()` 无法使用 B-tree 索引。条目数 > 1000 后可能明显变慢。建议文档注明当前方案的数据量上限预期（如 < 5000 条目），超出需迁移到关联表。

---

## 7. 错误处理策略评审

### 🟡 问题 16: 缺少事务一致性保证

创建条目涉及多步操作: 写入 DB → 写入文件 → 更新 FTS。如果中间步骤失败（如磁盘满），会出现:
- DB 有记录但文件缺失
- 文件存在但 DB 无记录

**建议**: 
- 创建流程使用 DB 事务包裹元数据写入
- 文件写入失败时回滚 DB 事务
- 增加**孤儿清理任务**: 定期扫描 `data/` 目录与 DB 记录不一致的情况

### 🟡 问题 17: 缺少统一的异常分类和处理

设计文档未定义异常体系。不同模块可能抛出不同异常，API 层没有统一捕获。

**建议**: 定义业务异常层级:
```python
class PeekError(Exception): ...
class NotFoundError(PeekError): ...
class ConflictError(PeekError): ...
class StorageError(PeekError): ...
class ValidationError(PeekError): ...
```
在 FastAPI `exception_handler` 中统一转换为标准错误响应格式。

### 🔵 建议: 过期清理的原子性

清理过期条目时，如果删除文件失败（如权限问题），DB 记录是否仍删除？建议:
- 先删 DB 记录（事务），再删文件（best-effort）
- 记录清理失败的文件路径，后续重试

---

## 8. 配置管理评审

### ✅ 合理之处
- 三层配置: 配置文件 → 环境变量 → 默认值，优先级清晰
- 配置文件使用 YAML，人类可读

### 🟡 问题 18: 配置缺少验证和首次初始化

- 未定义首次运行时如何创建 `~/.peek/config.yaml`
- 未定义配置项的验证规则（如端口范围 1-65535）
- `base_url` 为空字符串时如何生成 URL 未说明

**建议**: 
- 首次运行自动创建默认配置文件
- 使用 Pydantic `BaseSettings` 做配置验证:
  ```python
  class PeekConfig(BaseSettings):
      host: str = "127.0.0.1"
      port: int = Field(8080, ge=1, le=65535)
      base_url: str = ""
      ...
  ```
- `base_url` 为空时，URL 生成逻辑显式化: `http://{host}:{port}/view/{slug}`

### 🔵 建议: 配置文件与数据目录分离

当前配置和数据都放在 `~/.peek/`。Docker 场景下建议:
- 配置可挂载 `/etc/peek/config.yaml`
- 数据挂载 `/var/lib/peek/`

在配置中增加 `config_path` 选项。

### 🔵 建议: 敏感配置加密

如果未来增加 `api_key`，不应以明文存储在 YAML 中。建议支持环境变量优先读取敏感值。

---

## 9. 多用户迁移成本评审

### 🟡 问题 19: 当前设计几乎未预留多用户支持

尽管需求规格 4.3 提到"预留多用户字段"，但设计文档:

| 维度 | 现状 | 迁移难度 |
|------|------|----------|
| 数据模型 | 无 `user_id` 字段 | 🟡 中 — 需 ALTER TABLE + 数据迁移 |
| 文件存储 | `data/{entry_id}/` 无用户隔离 | 🟡 中 — 需重构为 `data/{user_id}/{entry_id}/` |
| API 路由 | 无用户上下文 | 🟢 低 — 增加 `user_id` 过滤条件 |
| 认证 | 无 | 🔴 高 — 需完整实现认证/授权 |
| 标签系统 | JSON 数组，无法按用户隔离 | 🟡 中 — 需迁移到关联表 |
| 搜索 | 无用户过滤 | 🟢 低 — WHERE 增加用户条件 |
| URL 结构 | `/view/{slug}` 无用户前缀 | 🟡 中 — 是否需 `/u/{user}/{slug}`? |

**建议**: 最低成本预留:
1. **数据模型**: 增加 `user_id TEXT DEFAULT 'default'` 到 `entries` 表，建索引
2. **文件存储**: 路径改为 `data/{user_id}/{entry_id}/`，当前 `user_id='default'`
3. **API**: 所有查询隐式添加 `WHERE user_id = ?`，当前硬编码为 `'default'`
4. **认证**: 预留 `auth` 中间件接口，当前为 passthrough

这样未来扩展时只需实现认证层，无需数据迁移。

---

## 问题汇总与优先级

| # | 严重度 | 问题 | 建议 |
|---|--------|------|------|
| 8 | 🔴 严重 | 文件名扁平化冲突 | 保留目录结构或使用编码方案 |
| 11 | 🔴 严重 | 无认证 + 任意文件读取 | 白名单 + 默认 127.0.0.1 + API Key |
| 3 | 🟡 重要 | entries.id 语义混淆 | 分离内部 id 和 slug |
| 4 | 🟡 重要 | disk_path 冗余 | 改为动态计算 |
| 6 | 🟡 重要 | archive/publish 非 RESTful | 改用 PATCH + status 字段 |
| 9 | 🟡 重要 | local_path 安全风险 | 白名单限制 |
| 10 | 🟡 重要 | 无文件大小限制 | 增加配置上限 |
| 14 | 🟡 重要 | 全文搜索无 FTS5 | 使用 FTS5 |
| 16 | 🟡 重要 | 缺少事务一致性 | 事务包裹 + 孤儿清理 |
| 1 | 🟡 重要 | SQLite 未启用 WAL | 启用 WAL + busy_timeout |
| 2 | 🟡 重要 | 缺少中间件层 | CORS + 异常处理 + 日志 |
| 5 | 🔵 建议 | 缺少文件校验 | 增加 sha256 字段 |
| 7 | 🔵 建议 | /search 应合并到 /entries | 统一查询参数 |
| 12 | 🔵 建议 | Markdown XSS 风险 | sanitize-html |
| 13 | 🔵 建议 | 路径遍历风险 | 输入校验 |
| 15 | 🔵 建议 | Shiki 加载性能 | 按需加载语言包 |
| 17 | 🔵 建议 | 缺少统一异常体系 | 定义 PeekError 层级 |
| 18 | 🔵 建议 | 配置缺少验证 | Pydantic BaseSettings |
| 19 | 🟡 重要 | 多用户迁移成本高 | 预留 user_id + 路径隔离 |

---

## 建议的开发前修正清单

### 必须在编码前修正（影响数据模型和 API 契约）

1. **分离 `entries.id` 和 `slug`**（问题 3）— 表结构变更，越早改成本越低
2. **文件存储改为保留目录结构**（问题 8）— 影响存储层和前端目录树逻辑
3. **移除 `files.disk_path`**（问题 4）— 简化数据模型
4. **API 路由调整**（问题 6、7）— 影响前后端接口契约
5. **增加 `user_id` 预留字段**（问题 19）— 表结构变更
6. **`local_path` 白名单机制**（问题 9）— 安全基线

### 可在开发中同步完善

7. WAL 模式 + 中间件 + 异常体系 + 配置验证
8. FTS5 搜索 + 文件大小限制 + 路径校验
9. 事务一致性 + XSS 防护 + Shiki 按需加载

---

*评审完毕。以上问题和建议基于设计文档分析，实际实现时可能还有新发现，建议在关键模块完成后进行代码级复审。*
