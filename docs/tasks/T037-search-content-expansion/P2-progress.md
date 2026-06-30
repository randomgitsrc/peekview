# P2 Progress — T037

## 2026-06-30 Read Phase

### P0-brief findings
- FTS5 索引扩展到文件内容，需后端 database.py + entry_service.py + 前端 SearchInput
- 已知风险：索引体积、回填策略、二进制排除、大文件截断

### P1-requirements findings
- 8 条 BDD 验收条件
- 10 个隐含需求（IM-1 到 IM-10）
- IM-9（搜索结果高亮/上下文）标记为可裁剪
- IM-10（MCP/CLI 自动受益）已满足
- NC-1: 截断阈值待确认（建议 100KB/文件）
- NC-2: placeholder 文案待确认（建议 "Search summaries & file content..."）

### Code analysis

#### database.py (current state)
- `entries_fts` 使用 `content='entries'` 同步模式（FTS5 自动从 entries 表读取数据）
- 3 个触发器：entries_ai (INSERT), entries_ad (DELETE), entries_au (UPDATE)
- 触发器只同步 summary, tags
- `rebuild_fts_index()` 只回填 summary, tags
- `search_entries()` 使用 FTS5 MATCH

#### entry_service.py (current state)
- `list_entries()` 的 FTS5 搜索：直接 `SELECT rowid FROM entries_fts WHERE entries_fts MATCH :q`
- `create_entry()` 写文件到磁盘 + File 记录到 DB
- `update_entry()` 支持 add_files / remove_file_ids / add_dirs
- 文件变更后无 FTS content 更新

#### SearchInput.vue (current state)
- placeholder 默认值 'Search...'
- EntryListView.vue 传入 placeholder="Search entries..."

#### storage.py
- `StorageManager.read_file()` 可读取 entry 文件内容
- `get_disk_path()` 计算磁盘路径

### FTS5 minimal validation results
1. **FTS5 不支持 ALTER TABLE** — confirmed (virtual tables may not be altered)
2. **content='' (contentless) 模式不支持 DELETE** — confirmed (cannot DELETE from contentless fts5 table)
3. **content='' + contentless_delete=1 模式支持 DELETE** — confirmed (SQLite 3.45.1)
4. **standalone FTS5 (无 content=) 支持 DELETE** — confirmed
5. **两种可行方案**：
   - A) content='' + contentless_delete=1：索引最小（不存原文），支持删除
   - B) 无 content= 参数（standalone）：存原文+索引，支持删除，存储更大

**推荐方案 A**：contentless + contentless_delete=1，因为 content 列的原文已在磁盘文件中，无需在 FTS 表中再存一份。
