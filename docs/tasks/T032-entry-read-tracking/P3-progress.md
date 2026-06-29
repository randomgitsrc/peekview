---
phase: P3
task_id: T032-entry-read-tracking
type: progress
trace_id: T032-P3-20260630
---

## P3 Progress Log

### Read P1-requirements.md
- 14 BDD acceptance conditions (B01-B14)
- Key domains: entry_reads table, window aggregation, async write, channel detection, read_stats API field

### Read P2-design.md
- entry_reads table with window_key UNIQUE constraint
- ReadTrackingService: record_read (UPSERT), get_read_stats, get_read_events
- asyncio.create_task for async write
- _detect_channel() helper: X-PeekView-Source header → mcp, ?share= → share, default → api
- EntryResponse.read_stats: owner/admin only
- New endpoint: GET /entries/{slug}/reads
- MCP client: X-PeekView-Source: mcp header

### Read existing test infrastructure
- conftest.py: autouse isolate_config_file, engine/session/app/client fixtures
- factories.py: EntryFactory, FileFactory
- test_api.py pattern: isolated tmp_dir, AsyncClient with ASGITransport
- test_share_access.py pattern: client_and_app fixture, helper functions for register/create/share

### Writing test files
- backend/tests/test_read_tracking.py: main test file covering B01-B14
- packages/mcp-server/tests/client-source-header.test.ts: MCP header test

### Test files written
- backend/tests/test_read_tracking.py: 38 test cases (model 3, service 19, API 16)
- packages/mcp-server/tests/client-source-header.test.ts: 4 test cases

### TDD red-light verification
- Backend: ImportError (EntryRead, ReadStatsResponse not in models.py) — correct red
- MCP: 4/4 fail (X-PeekView-Source header not sent) — correct red
- Both files discovered by pytest/vitest

### P3-test-cases.md written
- 14 BDD → 38+4=42 test cases, full coverage matrix
