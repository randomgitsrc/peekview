---
phase: P3
task_id: T032-entry-read-tracking
type: test-cases
parent: P2-design.md
trace_id: T032-P3-20260630
status: draft
created: 2026-06-30
---

# T032 Test Cases: Entry Read Tracking

## Test File Mapping

| File | Scope |
|------|-------|
| `backend/tests/test_read_tracking.py` | B01-B13 (model, service, API) |
| `packages/mcp-server/tests/client-source-header.test.ts` | B02/B14 (MCP X-PeekView-Source header) |

## Test Cases

### 1. EntryRead Model Tests (backend/tests/test_read_tracking.py)

| ID | BDD | Test | Expected |
|----|-----|------|----------|
| TC-M01 | B08 | test_entry_read_create | EntryRead row inserted with correct fields |
| TC-M02 | B08 | test_window_key_unique_constraint | Duplicate window_key raises IntegrityError / upserts count |
| TC-M03 | B08 | test_window_key_aggregation_count | Same window_key second insert increments count, not new row |
| TC-M04 | - | test_entry_read_default_values | action='read', channel='api', reader_type='anonymous', count=1, is_self_read=False |

### 2. ReadTrackingService Tests

| ID | BDD | Test | Expected |
|----|-----|------|----------|
| TC-S01 | B01 | test_record_read_api_channel | record_read with channel='api' creates entry_reads row |
| TC-S02 | B02 | test_record_read_mcp_channel | record_read with channel='mcp' stores channel='mcp' |
| TC-S03 | B04 | test_record_read_non_owner_is_self_read_false | reader_id != entry_owner_id → is_self_read=False |
| TC-S04 | B05 | test_record_read_owner_is_self_read_true | reader_id == entry_owner_id → is_self_read=True |
| TC-S05 | B06 | test_record_read_anonymous | reader_id=None → reader_type='anonymous', reader_id=None |
| TC-S06 | B08 | test_record_read_window_aggregation | Same reader+entry+channel within 1 min → count increments, not new row |
| TC-S07 | B08 | test_record_read_different_window | Same reader+entry+channel in different minute → new row |
| TC-S08 | B01 | test_record_read_authenticated_reader_type | reader_id set → reader_type='authenticated' |
| TC-S09 | B09 | test_get_read_stats_total_count | get_read_stats returns sum(count) excluding self_reads |
| TC-S10 | B09 | test_get_read_stats_by_channel | get_read_stats groups counts by channel |
| TC-S11 | B09 | test_get_read_stats_unique_readers | get_read_stats counts distinct reader_fingerprint excluding self_reads |
| TC-S12 | B09 | test_get_read_stats_last_read_at | get_read_stats returns max(updated_at) |
| TC-S13 | B09 | test_get_read_stats_empty | No reads → total_count=0, unique_readers=0, by_channel={} |
| TC-S14 | B13 | test_get_read_events_pagination | get_read_events returns paginated list |
| TC-S15 | B13 | test_get_read_events_fields | Response contains id, action, channel, reader_type, is_self_read, count, read_at, updated_at |
| TC-S16 | B11 | test_record_discover_action | record_read with action='discover' stores action='discover' |
| TC-S17 | - | test_record_read_reader_fingerprint_authenticated | reader_id=5 → fingerprint='u:5' |
| TC-S18 | - | test_record_read_reader_fingerprint_anonymous_ip | reader_ip='1.2.3.4' → fingerprint='a:{sha256[:8]}' |
| TC-S19 | - | test_record_read_reader_fingerprint_anonymous_no_ip | reader_ip=None → fingerprint='a:unknown' |

### 3. API Endpoint Tests

| ID | BDD | Test | Expected |
|----|-----|------|----------|
| TC-A01 | B01 | test_get_entry_records_read_event | GET /entries/{slug} → entry_reads row created |
| TC-A02 | B02 | test_get_entry_mcp_channel_header | GET /entries/{slug} with X-PeekView-Source: mcp → channel='mcp' |
| TC-A03 | B03 | test_share_link_records_channel_share | GET /entries/{slug}?share={token} → channel='share' |
| TC-A04 | B04 | test_non_owner_read_is_self_read_false | User B reads user A's entry → is_self_read=False |
| TC-A05 | B05 | test_owner_read_is_self_read_true | Owner reads own entry → is_self_read=True |
| TC-A06 | B06 | test_anonymous_read_public_entry | No auth → reader_type='anonymous', reader_id=None |
| TC-A07 | B07 | test_read_tracking_does_not_block_response | get_entry response time with/without tracking < 5ms diff |
| TC-A08 | B08 | test_high_frequency_read_aggregation | 10 rapid reads → 1 row with count=10 |
| TC-A09 | B09 | test_owner_sees_read_stats | Owner GET /entries/{slug} → response has read_stats with data |
| TC-A10 | B10 | test_non_owner_no_read_stats | Non-owner GET /entries/{slug} → read_stats is null/absent |
| TC-A11 | B11 | test_list_entries_records_discover | GET /entries → discover event recorded |
| TC-A12 | B12 | test_raw_endpoint_records_read | GET /entries/{slug}/raw → read event recorded |
| TC-A13 | B13 | test_read_events_endpoint | GET /entries/{slug}/reads returns paginated read events |
| TC-A14 | B13 | test_read_events_requires_owner_or_admin | Non-owner, non-admin → 403 or 404 |
| TC-A15 | B14 | test_list_entries_mcp_channel | GET /entries with X-PeekView-Source: mcp → discover + channel=mcp |
| TC-A16 | B03 | test_share_cookie_access_records_channel_share | Cookie-based share access → channel='share' |

### 4. MCP Client Header Tests (client-source-header.test.ts)

| ID | BDD | Test | Expected |
|----|-----|------|----------|
| TC-MCP01 | B02 | client getEntry sends X-PeekView-Source: mcp | Header present in GET request |
| TC-MCP02 | B14 | client listEntries sends X-PeekView-Source: mcp | Header present in list request |
| TC-MCP03 | - | client createEntry sends X-PeekView-Source: mcp | Header present (write ops don't trigger read tracking, but header is always sent) |
| TC-MCP04 | - | client deleteEntry sends X-PeekView-Source: mcp | Header present |

## Coverage Matrix

| BDD | Test IDs |
|-----|----------|
| B01 | TC-S01, TC-S08, TC-A01 |
| B02 | TC-S02, TC-A02, TC-MCP01 |
| B03 | TC-A03, TC-A16 |
| B04 | TC-S03, TC-A04 |
| B05 | TC-S04, TC-A05 |
| B06 | TC-S05, TC-A06 |
| B07 | TC-A07 |
| B08 | TC-M02, TC-M03, TC-S06, TC-S07, TC-A08 |
| B09 | TC-S09, TC-S10, TC-S11, TC-S12, TC-S13, TC-A09 |
| B10 | TC-A10 |
| B11 | TC-S16, TC-A11 |
| B12 | TC-A12 |
| B13 | TC-S14, TC-S15, TC-A13, TC-A14 |
| B14 | TC-A15, TC-MCP02 |
