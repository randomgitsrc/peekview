---
phase: P2
task_id: T006
task_name: admin-stats-cleanup
type: design
trace_id: T006-P2-20260613
created: 2026-06-13
status: draft
parent: P1-requirements.md
packages: [peekview]
domains: [backend]
ui_affected: false
---

# T006 admin-stats-cleanup — P2 设计方案

## 1. 影响域分析

### 改什么

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `backend/peekview/services/admin_service.py` | **新增** | stats + cleanup 业务逻辑 |
| `backend/peekview/api/admin.py` | **新增** | admin 路由（stats, cleanup） |
| `backend/peekview/models.py` | **修改** | 新增 Pydantic response schema（AdminStatsResponse, AdminCleanupResponse） |
| `backend/peekview/main.py` | **修改** | 注册 admin router + 创建 AdminService 挂 app.state |
| `backend/peekview/cli.py` | **修改** | 新增 `admin` 子命令组（stats, cleanup） |
| `backend/peekview/client.py` | **修改** | 新增 `admin_stats()`, `admin_cleanup()` 方法 |

### 不改什么

| 文件/模块 | 理由 |
|-----------|------|
| `entry_service.py` | 不修改；cleanup 通过调用现有 `delete_entry_by_api_key` 复用删除逻辑 |
| `auth.py` | 不修改；复用现有 `require_admin` 依赖 |
| `frontend-v3/` | P1 明确排除前端改动 |
| `packages/mcp-server/` | P1 明确排除 MCP 改动 |
| `database.py` | 不修改；现有 `get_db_stats` 不完全匹配 stats 需求，admin_service 自行查询 |
| `storage.py` | 不修改；复用现有 `get_entry_size` + `delete_entry_files` |

### 风险在哪

| 风险 | 缓解 |
|------|------|
| cleanup 并发安全（定时器 vs 手动调用） | 幂等保证（C-4）；SQLite WAL + 行级锁；复用 `delete_entry_by_api_key` 天然幂等（entry 不存在不报错） |
| stats 查询性能（1000 entries ≤ 500ms） | 使用聚合 SQL（COUNT + GROUP BY）而非全表扫描；已有 `idx_entries_is_public`、`idx_entries_expires_at` 索引覆盖 |
| `freed_mb` 计算精度 | 在逐 entry 删除前记录 `storage.get_entry_size(entry_id)`，累加后除以 1024²；避免删除前后两次 `shutil.disk_usage` 差值（不精确） |

## 2. API 设计

### 2.1 `GET /api/v1/admin/stats`

**请求**：无请求体，无 query 参数。

**响应** `AdminStatsResponse`：

```python
class EntryStats(SQLModel):
    total: int
    public: int
    private: int
    expired: int
    active: int
    latest_created_at: datetime | None

class ApiKeyStats(SQLModel):
    total: int
    expired: int

class StorageStats(SQLModel):
    data_dir_mb: float
    db_mb: float

class AdminStatsResponse(SQLModel):
    users: int
    entries: EntryStats
    api_keys: ApiKeyStats
    storage: StorageStats
```

**字段语义**：
- `entries.expired`：`expires_at < now()` 的 entry 数（含已删除前仍存在 DB 的）
- `entries.active`：`entries.total - entries.expired`
- `entries.public`/`entries.private`：按 `is_public` 分组计数
- `api_keys.expired`：`expires_at < now()` 的 API key 数
- `storage.data_dir_mb`：`data_dir` 目录总大小（MB，保留 2 位小数）
- `storage.db_mb`：`db_path` 文件大小（MB，保留 2 位小数）

### 2.2 `POST /api/v1/admin/cleanup`

**请求**：无请求体（清理所有过期 entry，无选择性参数）。

**响应** `AdminCleanupResponse`：

```python
class AdminCleanupResponse(SQLModel):
    deleted_count: int
    deleted_slugs: list[str]
    freed_mb: float
```

**语义**：
- `deleted_count`：本次删除的过期 entry 数
- `deleted_slugs`：被删除 entry 的 slug 列表（按删除顺序）
- `freed_mb`：被删除 entry 释放的磁盘空间（MB，2 位小数）

## 3. 路由设计 — `api/admin.py`

```python
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    request: Request,
    admin: User = Depends(require_admin),
) -> AdminStatsResponse:
    ...

@router.post("/cleanup", response_model=AdminCleanupResponse)
async def cleanup_expired_entries(
    request: Request,
    admin: User = Depends(require_admin),
) -> AdminCleanupResponse:
    ...
```

**在 `main.py` 中挂载**：

```python
from peekview.api.admin import router as admin_router
app.include_router(admin_router)
```

与现有 `auth_router`/`entries_router` 等并列（`main.py:237-248`）。

## 4. Service 层设计

### 4.1 单一 `admin_service.py`（不拆分）

理由：stats 和 cleanup 是同一关注域（admin 运维操作），且 cleanup 依赖 stats 的过期 entry 查询逻辑（查询 `expires_at < now()` 的 entry 是两个方法的共同基础）。拆成两个 service 会增加重复查询代码。

### 4.2 AdminService 类

```python
class AdminService:
    def __init__(self, engine, storage: StorageManager, config: PeekConfig):
        self.engine = engine
        self.storage = storage
        self.config = config

    def get_stats(self) -> AdminStatsResponse:
        """GET /api/v1/admin/stats 的业务逻辑。"""

    def cleanup_expired(self) -> AdminCleanupResponse:
        """POST /api/v1/admin/cleanup 的业务逻辑。"""
```

**DI 模式**：在 `main.py` 的 `create_app` 中创建 `AdminService` 并挂载到 `app.state.admin_service`，与其他 service 保持一致。

### 4.3 stats 的 DB 查询方式

使用 SQLModel `select` + `func.count` 聚合查询，配合原始 SQL 的 `CASE WHEN` 进行条件计数。具体策略：

```python
with Session(self.engine) as session:
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    # 单条聚合查询获取所有 entry 统计
    result = session.exec(
        select(
            func.count(Entry.id).label("total"),
            func.count(case((Entry.is_public == True, 1))).label("public"),
            func.count(case((Entry.is_public == False, 1))).label("private"),
            func.count(case((Entry.expires_at != None, Entry.expires_at <= now_naive), 1)).label("expired"),
        )
    ).one()

    # latest_created_at：单条 select
    latest = session.exec(
        select(func.max(Entry.created_at))
    ).one()

    # users count
    user_count = session.exec(
        select(func.count(User.id))
    ).one()

    # api_keys stats
    key_total = session.exec(select(func.count(ApiKey.id))).one()
    key_expired = session.exec(
        select(func.count(ApiKey.id)).where(
            ApiKey.expires_at != None,
            ApiKey.expires_at <= now_naive,
        )
    ).one()
```

**性能分析**：6 条 SELECT 查询（其中 entry 统计合并为 1 条），均走索引。1000 entries 场景下 SQLite 单次聚合查询 < 5ms，总耗时远低于 500ms 约束。

**磁盘统计**：
- `data_dir_mb`：遍历 `data_dir` 子目录累加大小（复用 `storage.get_entry_size` 逻辑，或直接用 `shutil.disk_usage` 取已用空间——但 `disk_usage` 是整个分区，不精确。改用 `du` 策略：遍历 entry 目录求和）
- `db_mb`：`db_path.stat().st_size / (1024 * 1024)`

对于 `data_dir_mb`，更高效的做法是累加 `os.scandir` 结果，而非逐 entry 调用 `get_entry_size`：

```python
def _get_dir_size(path: Path) -> int:
    total = 0
    for entry in os.scandir(path):
        if entry.is_file(follow_symlinks=False):
            total += entry.stat(follow_symlinks=False).st_size
        elif entry.is_dir(follow_symlinks=False):
            total += _get_dir_size(entry.path)
    return total
```

### 4.4 cleanup 如何复用 `entry_service.delete_entry`

**不直接复用 `entry_service.delete_entry`**，原因：
1. `delete_entry` 需要 `slug` 参数并做可见性/权限检查，cleanup 不需要
2. `delete_entry` 内部先查 entry 再删，cleanup 已经查到了所有过期 entry
3. cleanup 需要在删除前记录每个 entry 的磁盘大小（计算 `freed_mb`）

**复用策略**：调用 `entry_service.delete_entry_by_api_key(slug)`，该方法：
- 无权限检查（API key 级别直接删）
- 天然幂等（entry 不存在 raise NotFoundError，cleanup 已确认存在所以不会触发）
- 已处理 FTS5 同步删除（由 DB trigger 自动完成，`database.py:228-240`）
- 已处理磁盘文件删除（调用 `storage.delete_entry_files(entry_id)`）

**cleanup 实现流程**：

```python
def cleanup_expired(self) -> AdminCleanupResponse:
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. 查询所有过期 entry
    with Session(self.engine) as session:
        expired_entries = session.exec(
            select(Entry).where(
                Entry.expires_at != None,
                Entry.expires_at <= now_naive,
            )
        ).all()

        if not expired_entries:
            return AdminCleanupResponse(
                deleted_count=0, deleted_slugs=[], freed_mb=0.0
            )

        # 2. 记录每个 entry 的磁盘大小和 slug
        to_delete = []
        for e in expired_entries:
            size_bytes = self.storage.get_entry_size(e.id)
            to_delete.append((e.slug, e.id, size_bytes))

    # 3. 逐个删除（复用 entry_service.delete_entry_by_api_key）
    deleted_slugs = []
    total_freed = 0
    entry_service = EntryService(engine=self.engine, storage=self.storage, config=self.config)

    for slug, entry_id, size_bytes in to_delete:
        try:
            entry_service.delete_entry_by_api_key(slug)
            deleted_slugs.append(slug)
            total_freed += size_bytes
        except NotFoundError:
            pass  # 并发清理场景，已被删

    return AdminCleanupResponse(
        deleted_count=len(deleted_slugs),
        deleted_slugs=deleted_slugs,
        freed_mb=round(total_freed / (1024 * 1024), 2),
    )
```

## 5. CLI 设计

### 5.1 `admin` 子命令组

```python
@cli.group(name="admin")
def admin_cmd():
    """Admin operations (requires admin privileges)."""
    pass
```

与 `user`/`service`/`config`/`apikey` 同级。

### 5.2 `peekview admin stats`

```python
@admin_cmd.command(name="stats")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def admin_stats(remote_url: str | None, json_output: bool) -> None:
```

**本地模式**：创建 `AdminService` 实例直接调用 `get_stats()`
**远程模式**：通过 `PeekClient.admin_stats()` 调用 HTTP API

**Rich 表格输出**（非 JSON 模式）：

```
PeekView Admin Stats
─────────────────────
Users:        3
Entries:
  Total:      42
  Public:     30
  Private:    12
  Expired:    5
  Active:     37
API Keys:
  Total:      8
  Expired:    2
Storage:
  Data Dir:   123.45 MB
  Database:   6.78 MB
```

### 5.3 `peekview admin cleanup`

```python
@admin_cmd.command(name="cleanup")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def admin_cleanup(remote_url: str | None, json_output: bool) -> None:
```

**本地模式**：创建 `AdminService` 实例直接调用 `cleanup_expired()`
**远程模式**：通过 `PeekClient.admin_cleanup()` 调用 HTTP API

**非 JSON 模式输出**：

```
Cleaned up 3 expired entry(ies), freed 12.34 MB
  Deleted: slug1, slug2, slug3
```

### 5.4 本地模式 vs 远程模式的实现

遵循现有模式（`_get_backend` + `_is_remote_mode`），但 admin 命令需要返回结构化数据而非 entry 对象，因此本地模式不通过 `_get_backend` 获取 `EntryService`，而是：

```python
def _get_admin_service(config: PeekConfig, cli_remote_url: str | None = None) -> AdminService | PeekClient:
    """Get admin backend: AdminService for local, PeekClient for remote."""
    if cli_remote_url is not None:
        remote_url = cli_remote_url
    elif "PEEKVIEW_REMOTE__URL" in os.environ:
        remote_url = os.environ["PEEKVIEW_REMOTE__URL"]
    else:
        remote_url = config.remote.url

    if remote_url:
        return PeekClient(
            base_url=remote_url,
            api_key=config.remote.api_key,
            token=config.remote.token,
            timeout=config.remote.timeout,
            verify_ssl=config.remote.verify_ssl,
        )

    # Local mode
    engine = init_db(config.db_path)
    check_schema(engine)
    storage = StorageManager(config=config)
    return AdminService(engine=engine, storage=storage, config=config)
```

## 6. PeekClient 新增方法

```python
def admin_stats(self) -> dict[str, Any]:
    """GET /api/v1/admin/stats — Get system statistics."""
    resp = requests.get(
        f"{self.base_url}/api/v1/admin/stats",
        headers=self.headers,
        timeout=self.timeout,
        verify=self.verify,
    )
    if resp.status_code != 200:
        self._handle_error(resp)
    return resp.json()

def admin_cleanup(self) -> dict[str, Any]:
    """POST /api/v1/admin/cleanup — Cleanup expired entries."""
    resp = requests.post(
        f"{self.base_url}/api/v1/admin/cleanup",
        headers=self.headers,
        timeout=self.timeout,
        verify=self.verify,
    )
    if resp.status_code != 200:
        self._handle_error(resp)
    return resp.json()
```

## 7. 安全设计

| 措施 | 说明 |
|------|------|
| `require_admin` 守卫 | 两个端点均使用 `Depends(require_admin)`，非管理员 403，未认证 401 |
| 无额外 rate limiting | admin 端点仅管理员可达，攻击面极小；适用全局默认限速 |
| 无用户输入 | stats 无参数；cleanup 无参数；无注入风险 |
| cleanup 幂等 | 重复调用返回 `deleted_count: 0`；与后台定时器并发安全 |

## 8. BDD 条件覆盖映射

| BDD ID | 设计覆盖 |
|--------|----------|
| STATS-1 | `AdminStatsResponse` 包含所有字段；`AdminService.get_stats()` 返回完整统计 |
| STATS-2 | `Depends(require_admin)` → 非管理员 403 |
| STATS-3 | `Depends(require_admin)` 内含 `require_auth` → 未认证 401 |
| STATS-4 | CLI `admin stats` 本地模式：`AdminService.get_stats()` → Rich 表格输出 |
| STATS-5 | CLI `admin stats` 远程模式：`PeekClient.admin_stats()` |
| STATS-6 | CLI `--json-output` 标志输出 JSON |
| STATS-7 | 空系统时 `func.count` 返回 0，磁盘大小为实际值 |
| STATS-8 | 聚合查询 + 索引，1000 entries < 500ms |
| CLEANUP-1 | `AdminService.cleanup_expired()` 返回 `deleted_count`/`deleted_slugs`/`freed_mb`；复用 `delete_entry_by_api_key` 处理 DB + FTS5 + 磁盘 |
| CLEANUP-2 | 无过期 entry → 空列表 → 返回 `deleted_count=0, deleted_slugs=[], freed_mb=0.0` |
| CLEANUP-3 | 幂等：第二次调用查询过期 entry 为空 → 返回 0 |
| CLEANUP-4 | `Depends(require_admin)` → 非管理员 403 |
| CLEANUP-5 | `Depends(require_admin)` 内含 `require_auth` → 未认证 401 |
| CLEANUP-6 | CLI `admin cleanup` 本地模式 |
| CLEANUP-7 | CLI `admin cleanup` 远程模式：`PeekClient.admin_cleanup()` |
| CLEANUP-8 | cleanup 查询条件 `expires_at < now()` 只删过期 entry |

## 9. 实现完成标志

1. `GET /api/v1/admin/stats` 返回 `AdminStatsResponse`，所有字段非空
2. `POST /api/v1/admin/cleanup` 返回 `AdminCleanupResponse`，删除过期 entry + FTS5 同步 + 磁盘文件清理
3. 两个端点均受 `require_admin` 守卫，非管理员 403，未认证 401
4. cleanup 幂等：连续两次调用，第二次 `deleted_count=0`
5. `peekview admin stats` 本地/远程模式均可输出 Rich 表格和 JSON
6. `peekview admin cleanup` 本地/远程模式均可执行并输出结果
7. stats 在 1000 entries 下响应时间 ≤ 500ms
8. 无前端/MCP 改动
