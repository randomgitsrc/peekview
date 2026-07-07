---
phase: P2
task_id: T048-entry-lifecycle
type: design
parent: P1-requirements.md
trace_id: T048-P2-20260707
status: revised
created: 2026-07-07
agent: architect
---

# T048 P2: Entry 生命周期管理 — 方案设计

## §0 影响域分析

### 改什么

| 层 | 文件 | 改动 |
|----|------|------|
| Model | `models.py` | EntryBase 加 `archived_at`; EntryUpdate 加 `expires_in`; EntryResponse/EntryListItem 加 `archived_at`; AdminCleanupResponse 加 `archived_count`/`archived_slugs` |
| Config | `config.py` | PeekCleanup 加 `archive_retention_days` |
| DB | `database.py` | `_run_migrations` 加 `archived_at` ADD COLUMN |
| Service | `admin_service.py` | `cleanup_expired()` 改为两阶段 |
| Service | `entry_service.py` | `get_entry()` 加 archived 访问控制; `update_entry()` 加 archived 访问控制 + expires_in + reactivate; `list_entries()` owner 含 archived |
| Service | `share_service.py` | `create_share()` 检查 status==archived |
| API | `api/entries.py` | PATCH 路由传 expires_in |
| API | `api/admin.py` | cleanup 路由无需改（service 层变更透传） |
| CLI | `cli.py` | admin cleanup 输出区分 archived/deleted |
| Frontend | `types/index.ts` | status 改为 `'active' | 'archived'`; Entry 加 `archivedAt` |
| Frontend | `api/types.ts` | Response 加 `archived_at` |
| Frontend | `api/client.ts` | transform 加 archived_at; 新增 `updateEntry()`（data 类型排除 status 字段） |
| Frontend | `views/EntryDetailView.vue` | 过期展示 + Edit + archived banner + Reactivate；移动端布局适配 |
| Frontend | `views/EntryListView.vue` | Mine tab 含 archived |
| Frontend | `components/BaseBadge.vue` | props 增加 `'archived'` 变体 + `.badge-archived` CSS |
| Frontend | `components/EntryCard.vue` | archived 视觉区分 |
| Frontend | `components/EntryListRow.vue` | archived 视觉区分 |
| Frontend | `styles/variables.css` | 新增 `--c-badge-archived-bg`（dark + light 主题） |
| Frontend | 新组件 `ExpiresInDialog.vue` | 过期时间编辑对话框（含 error/loading/success 状态） |

### 不改什么

- `EntryStatus` 枚举：已有 ARCHIVED，无需新增
- `CreateEntryRequest`：已有 `expires_in`，无需改
- MCP server：无 update/patch 工具，不涉及
- 认证/权限模型：不涉及
- FTS5 触发器：entries_au trigger 已在 UPDATE 时重建 FTS 行，archived entry 的 FTS 行在 status 变 archived 时自动更新。但 FTS 搜索需在查询层排除 archived（search_entries 函数或 entry_service 调用处过滤）

### 风险在哪

| 风险 | 缓解 |
|------|------|
| cleanup 从物理删除改为归档，行为破坏性变更 | 测试覆盖两阶段逻辑；AdminCleanupResponse 新字段向后兼容 |
| archived entry 的 FTS 行仍存在，搜索可能返回 | search_entries 返回 ID 后在 entry_service 层过滤 status |
| 前端 status 类型从 `'active'|'expired'` 改为 `'active'|'archived'` | 一次性修正，expired 概念由 archived 替代 |
| 并发 cleanup + reactivate | SQLite WAL 行级锁已保障 |
| BaseBadge 新增 archived 变体需新增 CSS 变量 | 复用现有 badge 模式，新增 `--c-badge-archived-bg` + 灰色中性色 |

## §1 候选方案

### 候选方案A：最小侵入 — 复用现有 status 字段 + cleanup 两阶段

**核心思路**：利用已有 `EntryStatus.ARCHIVED` 和 `status != 'archived'` 过滤，新增 `archived_at` 字段记录归档时间，cleanup 拆为两阶段。

**数据层**：
- EntryBase 新增 `archived_at: datetime | None = None`
- database.py 迁移：`ALTER TABLE entries ADD COLUMN archived_at DATETIME DEFAULT NULL`
- PeekCleanup 新增 `archive_retention_days: int = 90`

**Cleanup 两阶段**：
```
Phase 1: SELECT WHERE expires_at<=now AND status='active'
  → SET status='archived', archived_at=now(), expires_at=NULL
  → FTS 行保留（entries_au trigger 自动更新）

Phase 2: SELECT WHERE archived_at<=now-N AND status='archived'  (N=archive_retention_days, skip if N=0)
  → 物理删除（复用现有 delete_entry_by_api_key）
  → FTS 行由 entries_ad trigger 自动删除
```

**PATCH expires_in**：
- EntryUpdate 新增 `expires_in: str | None = None`
- update_entry 解析 expires_in → 计算 expires_at
- 若 entry.status == ARCHIVED 且传了 expires_in → 自动 reactivate（status=ACTIVE, archived_at=NULL, expires_at=now+delta）
- 若 entry.status == ACTIVE 且传 expires_in="0" → expires_at=NULL

**访问控制**：
- get_entry(): 加 `if entry.status == 'archived' and not is_admin and entry.owner_id != current_user_id: raise NotFoundError`
- update_entry(): 同样加 `if entry.status == 'archived' and not is_admin and entry.owner_id != current_user_id: raise NotFoundError`（与 get_entry 保持一致，显式检查 status）
- list_entries(): owner 查询时，将 `status != 'archived'` 改为 `(status != 'archived' OR owner_id == current_user_id)`（admin 已可见全部）
- FTS 搜索：search_entries 返回 ID 后，在 entry_service 调用处加 `Entry.status != 'archived'` 过滤

**前端**：
- status 类型改为 `'active' | 'archived'`
- Entry 加 `archivedAt: string | null`
- 新增 `updateEntry(slug, data)` API 方法（data 类型排除 status 字段，避免前端误传 status 绕过 reactivate 逻辑）
- ExpiresInDialog：参考 ShareDialog 的 expiresIn select 模式，含 error/loading/success 状态
- EntryDetailView：active 显示 "Expires in Xd [Edit]"; archived 显示 "Expired" banner + Reactivate 按钮；移动端布局适配
- EntryListView：Mine tab 查询时传 `status` 参数或依赖后端 owner 查询自动包含 archived
- EntryCard/EntryListRow：archived 时加 `opacity: 0.6` + "Archived" badge
- BaseBadge：props 增加 `'archived'` 变体，灰色中性色

**优点**：
- 复用已有 ARCHIVED 枚举和 status 过滤基础设施
- 改动量最小，与现有代码模式一致
- FTS trigger 自动处理，无需额外维护

**风险**：
- owner 查询条件变复杂（OR 逻辑），需确保不破坏分页 count
- 前端 status 类型变更需全量搜索替换

**工作量**：中等（~15 文件改动，后端核心 ~200 行新增/修改，前端 ~300 行）

---

### 候选方案B：独立归档表 — archived_entries 分离存储

**核心思路**：归档 entry 移入独立的 `archived_entries` 表，原 entries 表只保留 active，查询无需 status 过滤。

**数据层**：
- 新建 `ArchivedEntry` 模型（镜像 Entry + archived_at）
- cleanup Phase 1：INSERT INTO archived_entries SELECT * + archived_at, DELETE FROM entries
- reactivate：反向操作

**优点**：
- entries 表查询无需 status 过滤，性能更优
- 归档数据与活跃数据物理隔离

**风险**：
- 双表维护成本高（schema 变更需同步、外键关系复杂、FTS 需跨表）
- reactivate 需跨表移动数据，事务复杂
- slug 唯一性需跨表保证
- 文件存储引用 entry_id，跨表移动后 ID 可能冲突
- 工作量显著增大（~2x）

**工作量**：大（~25 文件改动，后端核心 ~500 行新增/修改）

---

### 选择理由与权衡：方案 A

**理由**：
1. 已有 `EntryStatus.ARCHIVED` 枚举和 `status != 'archived'` 过滤，方案 A 是自然延伸
2. 方案 B 的跨表问题（slug 唯一、entry_id 冲突、FTS 跨表、文件引用）解决成本远超收益
3. 当前数据规模（SQLite 单机）不需要物理分表优化
4. 方案 A 的 owner 查询 OR 条件复杂度可控（SQLite 对简单 OR 有优化）

## §2 详细设计

### 2.1 数据层

#### EntryBase 新增 archived_at

```python
# models.py EntryBase
archived_at: datetime | None = Field(default=None)
```

#### database.py 迁移

```python
# _run_migrations 中新增
if "archived_at" not in columns:
    conn.execute(text("ALTER TABLE entries ADD COLUMN archived_at DATETIME DEFAULT NULL"))
    conn.commit()
    logger.info("Migration: added archived_at column to entries")
```

已有先例：`is_public`、`owner_id`、`is_admin` 均用此模式。SQLite `ALTER TABLE ADD COLUMN` 对新增 nullable 列无限制。

#### PeekCleanup 新增 archive_retention_days

```python
# config.py PeekCleanup
archive_retention_days: int = Field(
    default=90,
    description="Days to retain archived entries before permanent deletion (0 = never delete)",
)

@field_validator("archive_retention_days")
@classmethod
def validate_non_negative(cls, v: int) -> int:
    if v < 0:
        raise ValueError("archive_retention_days must be >= 0")
    return v
```

环境变量：`PEEKVIEW_CLEANUP__ARCHIVE_RETENTION_DAYS=90`

#### AdminCleanupResponse 扩展

```python
class AdminCleanupResponse(SQLModel):
    archived_count: int = 0
    archived_slugs: list[str] = Field(default_factory=list)
    deleted_count: int = 0
    deleted_slugs: list[str] = Field(default_factory=list)
    freed_mb: float = 0.0
```

向后兼容：旧字段保留，新字段有默认值。

#### EntryUpdate 新增 expires_in

```python
class EntryUpdate(SQLModel):
    summary: str | None = Field(default=None, min_length=1, max_length=500)
    status: EntryStatus | None = Field(default=None)
    tags: list[str] | None = Field(default=None)
    is_public: bool | None = Field(default=None)
    expires_in: str | None = Field(default=None, description="Duration like '7d', '1h', '0' for never. Reactivates archived entries.")
    add_files: list[FileCreate] | None = Field(default=None)
    remove_file_ids: list[int] | None = Field(default=None)
    add_dirs: list[DirCreate] | None = Field(default=None)
```

#### EntryResponse / EntryListItem 新增 archived_at

```python
# EntryResponse
archived_at: datetime | None = None

# EntryListItem
archived_at: datetime | None = None
```

### 2.2 Cleanup 两阶段

```python
def cleanup_expired(self) -> AdminCleanupResponse:
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    retention_days = self.config.cleanup.archive_retention_days

    with Session(self.engine) as session:
        # Phase 1: Archive expired active entries
        expired = session.exec(
            select(Entry).where(
                Entry.expires_at != None,
                Entry.expires_at <= now_naive,
                Entry.status == "active",
            )
        ).all()

        archived_slugs = []
        for e in expired:
            e.status = EntryStatus.ARCHIVED
            e.archived_at = now_naive
            e.expires_at = None
            session.add(e)
            archived_slugs.append(e.slug)
        session.commit()

        # Phase 2: Permanently delete old archived entries
        deleted_slugs = []
        total_freed = 0
        to_delete = []

        if retention_days > 0:
            cutoff = now_naive - timedelta(days=retention_days)
            old_archived = session.exec(
                select(Entry).where(
                    Entry.status == "archived",
                    Entry.archived_at != None,
                    Entry.archived_at <= cutoff,
                )
            ).all()

            for e in old_archived:
                size_bytes = self.storage.get_entry_size(e.id)
                to_delete.append((e.slug, e.id, size_bytes))

        # Physical deletion (outside session to avoid FK issues)
        entry_service = EntryService(engine=self.engine, storage=self.storage, config=self.config)
        for slug, entry_id, size_bytes in to_delete:
            try:
                entry_service.delete_entry_by_api_key(slug)
                deleted_slugs.append(slug)
                total_freed += size_bytes
            except NotFoundError:
                pass

    return AdminCleanupResponse(
        archived_count=len(archived_slugs),
        archived_slugs=archived_slugs,
        deleted_count=len(deleted_slugs),
        deleted_slugs=deleted_slugs,
        freed_mb=round(total_freed / (1024 * 1024), 2),
    )
```

**关键设计决策**：
- Phase 1 在同一 session 中批量 UPDATE（事务保证一致性）
- Phase 2 物理删除复用 `delete_entry_by_api_key`（清理 DB + 磁盘 + reads）
- `retention_days=0` 时跳过 Phase 2（永不删除）
- Phase 1 和 Phase 2 在同一次 cleanup 调用中执行（一次调用完成两阶段）
- `to_delete` 初始化在 `if` 块之前，避免 `retention_days=0` 时变量未定义

### 2.3 PATCH expires_in + Reactivate

```python
def update_entry(self, slug, ..., expires_in=None, ...):
    with Session(self.engine) as session:
        entry = ...
        # ownership check ...

        # Archived access control (consistent with get_entry)
        if entry.status == EntryStatus.ARCHIVED:
            if not is_admin and entry.owner_id != current_user_id:
                raise NotFoundError(f"Entry not found: {slug}")

        # Handle expires_in
        if expires_in is not None:
            from peekview.services.file_service import parse_expires_in
            delta = parse_expires_in(expires_in)  # "0" → None
            if entry.status == EntryStatus.ARCHIVED:
                # Reactivate
                entry.status = EntryStatus.ACTIVE
                entry.archived_at = None
                if delta is not None:
                    entry.expires_at = now_naive + delta
                else:
                    entry.expires_at = None  # permanent
            else:
                # Active entry: update expires_at
                if delta is not None:
                    entry.expires_at = now_naive + delta
                else:
                    entry.expires_at = None  # set never expire

        # ... rest of update logic ...
```

**API 路由层** (`api/entries.py`):
```python
return service.update_entry(
    slug=slug,
    ...,
    expires_in=data.expires_in,  # 新增
    ...
)
```

**约束**：
- archived entry 只能通过 `expires_in` reactivate，不能直接设 `status=active`（防止无过期时间的重新激活）
- 若 PATCH 同时传 `status` 和 `expires_in`，`expires_in` 优先（reactivate 逻辑覆盖 status）
- update_entry 的 archived 访问控制与 get_entry 保持一致：显式检查 `entry.status == ARCHIVED`，非 owner 非 admin 返回 404

### 2.4 访问控制

#### get_entry()

```python
# 在 is_public 检查之后加
if entry.status == EntryStatus.ARCHIVED:
    if not is_admin and entry.owner_id != current_user_id:
        raise NotFoundError(f"Entry not found: {slug}")
```

逻辑：archived entry 对非 owner 返回 404（与私有 entry 一致，防 slug 枚举）。

#### update_entry()

```python
# 在 ownership check 之后、业务逻辑之前加
if entry.status == EntryStatus.ARCHIVED:
    if not is_admin and entry.owner_id != current_user_id:
        raise NotFoundError(f"Entry not found: {slug}")
```

逻辑：与 get_entry 保持一致，显式检查 status。即使当前 ownership check 也能间接阻止非 owner 修改，显式检查确保代码路径一致，防止未来 ownership 逻辑变更时保护被绕过。

#### list_entries()

当前默认过滤 `status != 'archived'`。改为：

```python
if status:
    query = query.where(Entry.status == status)
    count_query = count_query.where(Entry.status == status)
    # Archived entries: only owner/admin can list
    if status == "archived":
        if is_admin:
            pass  # Admin sees all
        elif current_user_id:
            query = query.where(Entry.owner_id == current_user_id)
            count_query = count_query.where(Entry.owner_id == current_user_id)
        else:
            # Anonymous cannot see any archived entries
            return EntryListResponse(items=[], total=0, page=page, per_page=per_page)
else:
    # Default: hide archived from non-owner queries
    if current_user_id and not is_admin:
        # Owner sees own archived + all non-archived
        query = query.where(
            (Entry.status != "archived") | (Entry.owner_id == current_user_id)
        )
        count_query = count_query.where(
            (Entry.status != "archived") | (Entry.owner_id == current_user_id)
        )
    elif is_admin:
        pass  # Admin sees all, no status filter
    else:
        # Anonymous: hide all archived
        query = query.where(Entry.status != "archived")
        count_query = count_query.where(Entry.status != "archived")
```

**注意**：owner="me" 查询时，应自动包含该 owner 的 archived entry。当前 owner="me" 过滤 `owner_id == current_user_id`，与上述 OR 条件组合后自然包含。

#### FTS 搜索排除 archived

`search_entries()` 返回 entry ID 列表。在 `entry_service.list_entries()` 中，FTS 结果已通过后续的 status 过滤排除 archived。但需确认：当 `q` 参数存在时，FTS 返回的 ID 列表在构建最终查询时是否经过 status 过滤。

查看 `entry_service.py` 的搜索逻辑：FTS 返回 ID → 作为 `Entry.id.in_(fts_ids)` 条件加入 query → query 已有 status 过滤。因此 **FTS 搜索结果自动排除 archived**，无需额外处理。

### 2.5 Share 对 archived entry

```python
# share_service.py create_share()
# 替换 expires_at 检查为 status 检查
if entry.status == "archived":
    raise ValidationError("Cannot create share for archived entry")
# 保留 expires_at 检查（active 但即将过期的 entry 仍可创建 share）
if entry.expires_at:
    entry_exp = entry.expires_at.replace(tzinfo=timezone.utc) if entry.expires_at.tzinfo is None else entry.expires_at
    if entry_exp <= now:
        raise ValidationError("Cannot create share for expired entry")
```

**注意**：归档后 `expires_at=NULL`，旧的 `expires_at<=now` 检查不会触发。必须加 `status==archived` 检查。

### 2.6 CLI 输出适配

```python
# cli.py admin_cleanup
if isinstance(result, AdminCleanupResponse):
    if result.archived_count:
        click.echo(f"  Archived: {result.archived_count} entry(ies)")
        if result.archived_slugs:
            click.echo(f"  Archived: {', '.join(result.archived_slugs)}")
    if result.deleted_count:
        click.echo(f"  Deleted: {result.deleted_count} entry(ies), freed {result.freed_mb} MB")
        if result.deleted_slugs:
            click.echo(f"  Deleted: {', '.join(result.deleted_slugs)}")
```

### 2.7 前端设计

#### 类型变更

```typescript
// types/index.ts
export interface Entry {
  // ...
  status: 'active' | 'archived'  // 移除 'expired'
  archivedAt: string | null       // 新增
  // ...
}
```

```typescript
// api/types.ts
export interface EntryResponse {
  // ...
  archived_at: string | null  // 新增
}
export interface EntryListItemResponse {
  // ...
  archived_at: string | null  // 新增
}
```

#### API 客户端

```typescript
// api/client.ts
// transformListItem/transformEntry:
status: entry.status as 'active' | 'archived',
archivedAt: entry.archived_at ?? null,

// 新增方法（data 类型排除 status 字段，避免前端误传 status 绕过 reactivate 逻辑）
async updateEntry(slug: string, data: { expires_in?: string; is_public?: boolean; summary?: string; tags?: string[] }): Promise<Entry> {
  const response = await this.client.patch<EntryResponse>(`/entries/${slug}`, data)
  return this.transformEntry(response.data)
}
```

**设计决策**：`updateEntry` 的 `data` 参数类型故意排除 `status` 字段。后端 `EntryUpdate` schema 虽有 `status` 字段，但前端不应直接传 `status`——archived entry 只能通过 `expires_in` reactivate，直接传 `status=active` 会绕过 reactivate 逻辑（不设置 expires_at/archived_at）。排除 `status` 从类型层面防止此误用。

#### BaseBadge archived 变体

```typescript
// BaseBadge.vue props 扩展
withDefaults(defineProps<{
  status?: 'public' | 'private' | 'shared' | 'archived'
}>(), {
  status: 'public',
})
```

```css
/* 新增样式 */
.badge-archived {
  background: var(--c-badge-archived-bg);
  color: var(--c-text-tertiary);
}
```

颜色选择：灰色/中性色，与 public=绿/private=红/shared=黄 区分。`--c-badge-archived-bg` 使用低饱和度灰色背景（如 `rgba(128, 128, 128, 0.15)`），文字用 `--c-text-tertiary`（已有灰色文字变量，位于 `variables.css:44` dark / `:99` light）。

#### ExpiresInDialog 组件

参考 ShareDialog 的交互模式，含完整交互状态设计：

- Props: `entrySlug`, `isArchived` (boolean)
- Select 选项：1h / 24h / 7d / 30d / 0 (Never)
- isArchived 时按钮文案 "Reactivate"，否则 "Update"
- 调用 `api.updateEntry(slug, { expires_in })`
- 成功后 emit `updated` 事件，父组件刷新 entry

**交互状态设计**：

| 状态 | 表现 |
|------|------|
| idle | 按钮可点击，文案 "Update" / "Reactivate" |
| loading | 按钮 disabled + 文案 "Updating..." / "Reactivating..."；select 不可操作 |
| error | 按钮 disabled；显示错误消息（复用 ShareDialog 的 error 展示模式：红色文字 + 具体错误信息）；用户可修改 select 后重试 |
| success | emit `updated` 事件 + 自动关闭 dialog（无需手动关闭） |

```typescript
// 内部状态
const loading = ref(false)
const error = ref<string | null>(null)

async function handleSubmit() {
  loading.value = true
  error.value = null
  try {
    await api.updateEntry(props.entrySlug, { expires_in: selected.value })
    emit('updated')
    // 自动关闭：父组件监听 updated 后关闭 dialog
  } catch (e: any) {
    error.value = e.response?.data?.detail || e.message || 'Failed to update'
  } finally {
    loading.value = false
  }
}
```

#### EntryDetailView 改造

- Active entry: "Expires in Xd [Edit]" → 点击弹出 ExpiresInDialog
- Active entry 无过期: "Never expires [Edit]"
- Archived entry: 顶部 "Expired" banner（红色/警告色）+ "Reactivate" 按钮 → 点击弹出 ExpiresInDialog(isArchived=true)
- Archived entry 隐藏 Share 按钮

**移动端布局**：

当前过期时间显示有 `desktop-only` class（`EntryDetailView.vue:59`），移动端不可见。P2 新增的过期编辑、Expired banner、Reactivate 按钮需移动端可见：

- 过期时间 + [Edit] 按钮：移除 `desktop-only` class，移动端也可见。移动端 [Edit] 按钮保持小尺寸
- Expired banner：全宽展示，移动端友好（`width: 100%`，无 `desktop-only`）
- Reactivate 按钮：在 banner 内，移动端可点击（无 `desktop-only`）
- 时间戳（`createdAt`、readStats）保持 `desktop-only`（信息密度低，移动端省空间）

#### EntryListView 改造

- Mine tab 查询：后端 owner 查询已自动包含 archived，前端无需额外参数
- EntryCard/EntryListRow: `v-if="entry.status === 'archived'"` 时加 `opacity: 0.6` + `<BaseBadge status="archived" />`

### 2.8 [SCOPE+] 发现

无。所有隐含需求在 P1 中已识别。

## §3 实现完成标志

1. `cleanup_expired()` 两阶段执行：Phase 1 归档 + Phase 2 物理删除
2. `archive_retention_days=0` 时 Phase 2 跳过
3. PATCH `expires_in` 修改 active entry 过期时间
4. PATCH `expires_in` 对 archived entry 自动 reactivate
5. `expires_in="0"` 清除过期时间（永不过期）
6. Archived entry 访问控制：owner/admin 可访问，匿名/非 owner 返回 404
7. `update_entry()` archived 访问控制与 `get_entry()` 一致（显式检查 status）
8. Owner 列表查询包含 archived entry
9. 匿名列表查询排除 archived entry
10. 显式 `status=archived` 查询仅 owner/admin 可见（匿名返回空列表）
11. FTS 搜索排除 archived entry
12. Share 不可为 archived entry 创建
13. 前端 status 类型对齐为 `'active' | 'archived'`
14. BaseBadge 支持 `'archived'` 变体（`--c-badge-archived-bg` + `--c-text-tertiary`）
15. variables.css 新增 `--c-badge-archived-bg`（dark + light 主题）
16. ExpiresInDialog 组件可用（含 error/loading/success 状态）
17. EntryDetailView 过期编辑 + archived banner + Reactivate（移动端可见）
18. EntryListView archived 视觉区分
19. 前端 updateEntry data 类型排除 status 字段
20. CLI cleanup 输出区分 archived/deleted
21. AdminCleanupResponse 新字段向后兼容

## §4 声明字段

```yaml
packages:
  - backend/peekview

domains:
  - entry-lifecycle
  - cleanup
  - entry-update
  - frontend-entry-edit
  - frontend-types

ui_affected: true
ui_interaction_points:
  - EntryDetailView: Expires in [Edit] → ExpiresInDialog
  - EntryDetailView: Archived "Expired" banner + Reactivate → ExpiresInDialog
  - EntryDetailView: 移动端过期编辑 + Reactivate 可见
  - EntryListView: Mine tab 含 archived entry（灰色 + Archived badge）
  - ExpiresInDialog: select + submit（含 error/loading/success 状态）
  - BaseBadge: archived 变体（灰色中性色）

gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_frontend: "cd frontend-v3 && npx vue-tsc --noEmit && ./node_modules/.bin/vitest run --reporter=dot"
  P6: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no -k 'test_cleanup or test_update_entry or test_archived or test_share'"

env_constraints:
  debug_env: "make debug-start (:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries WHERE status=\"archived\"'"

files_to_read:
  - path: backend/peekview/models.py:82-98
    why: EntryBase 定义，新增 archived_at 字段位置
  - path: backend/peekview/models.py:180-224
    why: Entry table model，确认字段和关系
  - path: backend/peekview/models.py:412-421
    why: EntryUpdate schema，新增 expires_in 字段位置
  - path: backend/peekview/models.py:459-493
    why: EntryResponse/EntryListItem，新增 archived_at
  - path: backend/peekview/models.py:691-694
    why: AdminCleanupResponse，扩展 archived_count/archived_slugs
  - path: backend/peekview/config.py:199-210
    why: PeekCleanup，新增 archive_retention_days
  - path: backend/peekview/database.py:39-120
    why: _run_migrations，新增 archived_at 迁移
  - path: backend/peekview/services/admin_service.py:115-154
    why: cleanup_expired，改为两阶段
  - path: backend/peekview/services/entry_service.py:312-336
    why: get_entry，加 archived 访问控制
  - path: backend/peekview/services/entry_service.py:360-372
    why: list_entries status 过滤，owner 含 archived
  - path: backend/peekview/services/entry_service.py:492-551
    why: update_entry，加 archived 访问控制 + expires_in + reactivate
  - path: backend/peekview/services/share_service.py:38-63
    why: create_share，加 archived 检查
  - path: backend/peekview/services/file_service.py:171-207
    why: parse_expires_in，复用解析逻辑
  - path: backend/peekview/api/entries.py:335-384
    why: PATCH 路由，传 expires_in
  - path: backend/peekview/cli.py:2003-2048
    why: admin cleanup CLI 输出适配
  - path: frontend-v3/src/types/index.ts:9-29
    why: Entry 类型，status 改 + archivedAt
  - path: frontend-v3/src/api/types.ts:1-46
    why: Response 类型，加 archived_at
  - path: frontend-v3/src/api/client.ts:43-90
    why: transform 函数 + 新增 updateEntry（排除 status）
  - path: frontend-v3/src/views/EntryDetailView.vue:59-64
    why: 过期展示区域，加 Edit + archived banner + 移动端适配
  - path: frontend-v3/src/views/EntryListView.vue:36-46
    why: Mine tab，含 archived
  - path: frontend-v3/src/components/BaseBadge.vue
    why: 新增 archived 变体 props + CSS
  - path: frontend-v3/src/styles/variables.css:52-54,107-109
    why: badge 背景色变量位置，新增 --c-badge-archived-bg（dark + light）
  - path: frontend-v3/src/components/ShareDialog.vue:1-130
    why: ExpiresInDialog 参考模式（含 error 状态）
  - path: frontend-v3/src/components/EntryCard.vue
    why: archived 视觉区分
  - path: frontend-v3/src/components/EntryListRow.vue
    why: archived 视觉区分

minimal_validation:
  assumption_1: "SQLite ALTER TABLE ADD COLUMN 支持 DATETIME DEFAULT NULL"
  method_1: "读 database.py 已有迁移先例（is_public BOOLEAN DEFAULT 1, owner_id INTEGER），确认模式可行"
  result_1: "confirmed — 已有 3 个 ADD COLUMN 迁移先例，archived_at DATETIME DEFAULT NULL 无限制"
  assumption_2: "parse_expires_in 与 PATCH expires_in 兼容"
  method_2: "读 file_service.py parse_expires_in，确认支持 '0'/'1h'/'30m'/'7d' 格式"
  result_2: "confirmed — parse_expires_in 已支持所有需要的格式，'0'→None 表示永不过期"
  overall: "not_needed — 纯代码逻辑变更，无浏览器/外部系统依赖"
``