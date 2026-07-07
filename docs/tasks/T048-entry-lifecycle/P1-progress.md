# P1 Progress — T048

## File reads completed

### P0-brief.md
- Task: 两阶段生命周期 active→archived→物理删除
- 5 core changes: cleanup改归档、PATCH加expires_in、前端编辑UI、列表展示archived、可配置保留期
- Risk: cleanup从物理删除改为归档是破坏性变更
- Pruning: P3/P6/P7保留

### P1-dispatch-context.md
- EntryStatus已有ARCHIVED值但cleanup未使用
- cleanup直接物理删除（delete_entry_by_api_key）
- EntryUpdate无expires_in字段
- update_entry已支持status更新
- 列表查询默认排除archived
- PeekLimits有default_expires_in，无archive_retention_days
- 前端status类型只有'active'|'expired'，缺'archived'

### models.py
- EntryStatus: ACTIVE/ARCHIVED/PUBLISHED 三值枚举
- EntryBase: status默认ACTIVE, expires_at可选
- EntryUpdate: 无expires_in字段
- EntryResponse: status是str（非枚举），含expires_at
- AdminCleanupResponse: deleted_count/deleted_slugs/freed_mb（语义需改为含archived_count）
- Entry model无archived_at字段

### admin_service.py:115-154
- cleanup_expired()查expires_at<=now，直接调delete_entry_by_api_key物理删除
- 无归档逻辑

### entry_service.py
- create_entry: 已有expires_in解析逻辑（parse_expires_in）
- update_entry: 支持status更新，无expires_in参数
- get_entry: 无archived状态特殊处理（只检查is_public）
- list_entries: 默认排除archived，但owner查询也排除（P0要求owner可见archived）

### config.py
- PeekCleanup: check_on_start + interval_seconds，无archive_retention_days
- PeekLimits: default_expires_in='15d'

### share_service.py
- create_share: 检查entry.expires_at<=now则拒绝（"Cannot create share for expired entry"）
- 当前用expires_at判断过期，改为archived后需同步

### frontend types/index.ts
- Entry.status: 'active' | 'expired' — 缺'archived'
- 需扩展为 'active' | 'archived' | 'expired'（或去掉expired？）

### frontend api/client.ts
- transformListItem/transformEntry: status as 'active' | 'expired' 硬编码
- 无updateEntry方法（只有toggleEntryVisibility）

### MCP tools
- createEntry/publishFiles: 已有expires_in参数
- 无update/patch工具（MCP不暴露entry修改能力）
- getEntry: 显示expires_at

## Key findings / implicit requirements

1. **archived_at字段**：P0说"过期→status=ARCHIVED, expires_at=NULL"，但需要记录归档时间以计算保留期。需新增archived_at字段
2. **AdminCleanupResponse语义变更**：从deleted_count→需含archived_count（第一阶段归档）+ deleted_count（第二阶段物理删除）
3. **share_service过期检查**：当前用expires_at<=now判断，改为archived后应检查status==archived
4. **get_entry对archived的访问控制**：当前无status检查，archived entry对owner应可见、对匿名应不可见
5. **前端无updateEntry API**：需新增PATCH调用（含expires_in）
6. **MCP无update工具**：P0未提MCP端修改，但MCP createEntry已有expires_in。MCP是否需要reactivate能力？
7. **'expired'状态不存在于后端**：后端只有active/archived/published，前端'expired'是前端根据expires_at计算的派生状态。归档后expires_at=NULL，前端'expired'概念需重新定义
8. **cleanup两阶段**：第一阶段（过期→归档）+ 第二阶段（archived N天后→物理删除），需两个独立逻辑
9. **CLI cleanup命令**：当前显示deleted_count，需适配新语义
10. **FTS5**：archived entry是否应从FTS索引移除？列表已排除，但直接访问slug仍可到达
