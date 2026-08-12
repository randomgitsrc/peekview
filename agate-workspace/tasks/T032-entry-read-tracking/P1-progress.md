--- P1 Progress: Starting analyst work for T032 ---
Timestamp: 2026-06-30T03:03:29+08:00

## Input Analysis: P0-brief.md
- Task: Entry 读取路径埋点 — 记录谁在读、读频率、读取方式
- Core problem: MCP/API 读取路径无任何埋点，无法判断多 Agent 总线愿景是否成立
- Key constraints: 异步写入不阻塞响应、高频读取需采样/聚合、存储方案需评估
- Pruning tendency: 保守 — 涉及后端数据模型+API变更+存储策略

## Input Analysis: Codebase — Read Paths (all entry read access points)
1. API GET /api/v1/entries/{slug} — entries.py:171 get_entry()
2. API GET /api/v1/entries — entries.py:149 list_entries()
3. API GET /api/v1/entries/{slug}/raw — files.py:336 get_entry_raw()
4. API GET /api/v1/entries/{slug}/files/{file_id}/content — files.py:206
5. API GET /api/v1/entries/{slug}/files/{file_id}/render — files.py:273
6. API GET /api/v1/entries/{slug}/download — entries.py:309
7. MCP getEntry — calls client.getEntry() → API GET /entries/{slug}
8. MCP listEntries — calls client.listEntries() → API GET /entries
9. Share access via ?share= token — entries.py:188, share_service.verify_share_token()
10. Share cookie access — entries.py:221, share_service.verify_share_cookie()

Key observation: MCP reads go through the same HTTP API as direct API access. The read tracking can be implemented at the API layer and automatically cover MCP.

## Input Analysis: Existing view_count
- EntryShare.view_count: Only tracks share token access (verify_share_token increments, verify_share_cookie does NOT)
- No entry-level read tracking exists at all
- T027 explicitly stated: "Share access should not increment entry view count"

## Implicit Requirements Analysis (5 dimensions)

### Data dimension
- New table needed (entry_reads or similar) — existing EntryShare.view_count is share-scoped, not entry-scoped
- No existing data to migrate (no entry-level read tracking exists)
- Question: How long to retain raw read events? Growth rate depends on traffic
- Question: Aggregation strategy — raw events vs. pre-aggregated counters vs. hybrid

### Frontend dimension
- P0 says "最小探针" — but data needs to be visible somewhere
- EntryDetailView: owner sees read stats on their entries?
- EntryListView: read count in list items?
- Admin panel: aggregated read analytics?
- These are display questions, but the data model must support them

### Multi-client dimension (MCP / CLI / API)
- MCP reads go through HTTP API — same endpoint, same tracking point
- How to distinguish MCP vs direct API vs share? Need source/channel field
- MCP Bearer token = user-level API key (pv_ prefix) → can identify reader
- CLI reads: `peekview get` uses allow_local mode — should also be tracked?
- Raw endpoint (/raw): Agent read path, should be tracked

### Boundary dimension
- Anonymous reads: no reader identity — how to count? IP? Just increment?
- Owner reading own entry: should it count? (P0 says "是否非创建者")
- listEntries: should listing count as a "read"? P0 says yes for MCP listEntries
- Expired/deleted entries: reads should 404 before tracking fires
- Rate limiting interaction: tracking must not bypass rate limits
- Concurrent reads: SQLite WAL single-writer — tracking write must not serialize reads

### Compatibility dimension
- Must NOT break existing API response schema (additive only)
- Must NOT change existing view_count semantics on EntryShare
- Must NOT add latency to read path (async write)
- Must NOT affect existing auth/visibility checks

## P1 Completion Summary
- 14 BDD conditions defined (B01-B14)
- 0 [NEED_CONFIRM] items — all implicit requirements resolved based on P0 direction + architecture constraints
- 0 [CAPABILITY_GAP] items — all capabilities available
- Key design decisions (P1-level, problem-space only):
  - list vs get: "discover" vs "read" action distinction
  - channel identification: MCP主动声明header + backend fallback
  - aggregation: 1-min window same reader+entry merge count
  - frontend: minimal read_stats field, no analytics dashboard
- Phases: [P1, P2, P3, P4, P5, P6, P7, P8] — no skips, storage+async+cross-client justify full chain
