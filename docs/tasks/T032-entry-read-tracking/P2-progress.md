
## P2 Architect 进度

### 2026-06-30 代码阅读完成

**已读文件**：
- `backend/peekview/models.py` — Entry/EntryShare/File/User/ApiKey 模型 + Pydantic schemas
- `backend/peekview/database.py` — init_db, _run_migrations, FTS5 setup
- `backend/peekview/api/entries.py` — get_entry, list_entries, _check_share_cookie
- `backend/peekview/api/files.py:336-409` — get_entry_raw endpoint
- `backend/peekview/services/entry_service.py` — EntryService.get_entry, list_entries, _build_response
- `backend/peekview/services/share_service.py:1-50` — ShareService 构造
- `backend/peekview/auth.py:1-160` — get_current_user, JWT/API key 解析
- `backend/peekview/main.py` — create_app, DI (app.state.*), middleware
- `packages/mcp-server/src/client.ts` — PeekViewClient.request(), headers 构造
- `packages/mcp-server/src/tools/getEntry.ts` — getEntry tool handler
- `packages/mcp-server/src/tools/listEntries.ts` — listEntries tool handler
- `frontend-v3/src/stores/entry.ts` — useEntryStore, loadEntry
- `frontend-v3/src/api/client.ts` — PeekAPI, transformEntry
- `frontend-v3/src/api/types.ts` — EntryResponse type
- `frontend-v3/src/types/index.ts` — Entry interface
- `frontend-v3/src/views/EntryDetailView.vue:1-180` — header + content area
- `backend/tests/conftest.py` — test fixtures, isolation

**关键发现**：
1. `EntryResponse` schema (models.py:409-425) 无 read_stats 字段，需新增可选字段
2. `EntryService._build_response` (entry_service.py:820-849) 构建 EntryResponse，需扩展
3. MCP client.ts `request()` 方法 (client.ts:22-61) 构造 headers，需加 X-PeekView-Source
4. `get_entry` API (entries.py:171-225) 有 share/cookie 分支，埋点需覆盖所有路径
5. `get_entry_raw` (files.py:336-409) 独立鉴权逻辑，需单独埋点
6. `list_entries` (entries.py:149-168) 需记录 discover 事件
7. 前端 `transformEntry` (client.ts:60-82) 需映射 read_stats
8. `EntryDetailView.vue` header 区域 (line 16-58) 有 owner controls + meta，read_stats 可放在 meta 区域
9. `database.py:_run_migrations` (database.py:35-102) 处理 schema 演进，新表通过 SQLModel.metadata.create_all 自动创建
10. DI 模式：`app.state.*` 单例，新 ReadTrackingService 需注册到 app.state

### 2026-06-30 P2-design.md 产出完成

**产出文件**：`docs/tasks/T032-entry-read-tracking/P2-design.md`

**设计要点**：
1. 新表 `entry_reads`：window_key UNIQUE 约束实现 1 分钟窗口聚合，同一 reader+entry+channel 在窗口内只产生 1 行（count 递增）
2. `ReadTrackingService`：record_read (UPSERT) + get_read_stats (聚合查询) + get_read_events (分页)
3. 异步写入：`asyncio.create_task` + try/except，不 await，不阻塞响应
4. Channel 检测：MCP 主动声明 `X-PeekView-Source: mcp` header + share 参数/cookie 显式传 + 默认 api
5. API 变更：EntryResponse 新增 read_stats 可选字段（owner/admin 可见）；新端点 GET /entries/{slug}/reads
6. MCP 变更：client.ts headers 添加 `X-PeekView-Source: mcp`
7. 前端变更：类型扩展 + transformEntry 映射 + EntryDetailView header meta 区域展示
8. 14 条 BDD 全部覆盖
9. 冗余存储 reader_fingerprint 列，简化 unique_readers 查询
10. anonymous fingerprint 用 IP hash 前 8 位，不存完整 IP（隐私）
