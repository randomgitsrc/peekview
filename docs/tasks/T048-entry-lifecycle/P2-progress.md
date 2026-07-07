# P2 Progress — T048

## Input Reading

### P0-brief.md
- Task: 两阶段生命周期 active→archived→物理删除
- env: make debug-start (:8888, /tmp/peekview-debug/)
- Risk: cleanup 从物理删除改为归档是破坏性变更

### P1-requirements.md
- 14 条 BDD 验收条件
- 隐含需求：D1(archived_at), D2(AdminCleanupResponse), D3(cleanup两阶段), D5(FTS排除archived)
- 前端：F1(status类型), F2(updateEntry API), F3(ExpiresInDialog), F4(DetailView改造), F5(ListView archived展示)
- 边界：B1(archived访问控制), B2(share拒绝archived), B3(reactivate), B4(expires_in=0), B5(并发), B6(retention=0)

### P1-dispatch-context.md
- EntryStatus 已有 ACTIVE/ARCHIVED/PUBLISHED
- cleanup 当前直接物理删除
- EntryUpdate 无 expires_in 字段
- 列表查询已排除 archived (status != 'archived')
- 前端 status 硬编码 'active' | 'expired'

### Code Analysis

#### models.py
- EntryBase: status(EntryStatus), expires_at(datetime|None) — 无 archived_at
- Entry(EntryBase, table=True): id, slug, created_at, updated_at, files, shares, owner
- EntryUpdate: summary, status, tags, is_public, add_files, remove_file_ids, add_dirs — 无 expires_in
- EntryResponse: 无 archived_at 字段
- AdminCleanupResponse: deleted_count, deleted_slugs, freed_mb — 无 archived_count
- CreateEntryRequest: 已有 expires_in 字段

#### config.py
- PeekCleanup: check_on_start, interval_seconds — 无 archive_retention_days
- PeekConfig: cleanup: PeekCleanup

#### database.py
- _run_migrations: 用 PRAGMA table_info + ALTER TABLE ADD COLUMN 模式
- 已有先例：is_public, owner_id, is_admin 都是后加的
- 结论：archived_at 可用同样模式添加，无需特殊迁移

#### admin_service.py
- cleanup_expired(): 查 expires_at<=now → 物理删除
- 需改为两阶段：第一阶段归档，第二阶段物理删除

#### entry_service.py
- get_entry(): 只检查 is_public，不检查 status → 需加 archived 访问控制
- list_entries(): 默认 status != 'archived' → owner 查询需包含 archived
- update_entry(): 支持 status 更新，无 expires_in → 需加 expires_in 处理 + reactivate 逻辑

#### share_service.py
- create_share(): 检查 entry.expires_at<=now 拒绝 → 需改为检查 status==archived

#### file_service.py
- parse_expires_in(): 支持 "0"→None, "1h"/"30m"/"7d" → 与 EntryUpdate.expires_in 兼容

#### frontend
- types/index.ts: status: 'active' | 'expired' → 需改为 'active' | 'archived'
- api/client.ts: transformListItem/transformEntry 硬编码 as 'active' | 'expired'
- api/types.ts: status: string (raw response)
- EntryDetailView.vue: 显示 "Expires Xd" / "Never expires" → 需加 Edit + archived banner
- EntryListView.vue: All/Mine tab → 需在 Mine 中包含 archived
- ShareDialog.vue: expiresIn select 模式 → ExpiresInDialog 可参考

#### CLI
- admin cleanup: 显示 deleted_count → 需区分 archived vs deleted

### Minimal Validation
1. archived_at ADD COLUMN: database.py 已有 ALTER TABLE ADD COLUMN 迁移模式，确认可行 ✓
2. parse_expires_in 兼容: 已支持 "0"/"1h"/"30m"/"7d"，与 PATCH expires_in 完全兼容 ✓
3. 无需运行时验证
