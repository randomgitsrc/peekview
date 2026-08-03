# P1 Progress — requirements-review

## Input file reading
- [x] P1-dispatch-context-requirements-review.md — read
- [x] P0-brief.md — read (5 probe issues, 4 phases, risk=medium)
- [x] read_tracking_service.py — read (window_key line 47, get_read_stats, get_read_events)
- [x] entries.py — read (line 231 channel="api" confirmed; _detect_channel at line 36)
- [x] files.py — read (3 hardcoded channel at lines 188/232/432 confirmed)
- [x] models.py — read (EntryRead model, ReadStatsResponse, AdminStatsResponse)
- [x] test_read_tracking.py — read (line 390 test name vs assertion confirmed)
- [x] P1-requirements.md — read (30 BDDs, 23 IRs, domains/packages/risk/phases declared)

## Review analysis

### Code verification against P1 claims:
1. window_key line 47: `f"{eid_part}:{fingerprint}:{channel}:{window_ts}"` — NO action ✓ (P1 BDD-01/02 correct)
2. entries.py:231: `channel="api"` hardcoded for public/owner+share token branch ✓ (P1 BDD-03 correct)
3. files.py:188/232/432: three hardcoded channel checks ✓ (P1 BDD-04/05/06 correct)
4. discover entry_id=None at entries.py:176 ✓ (P1 BDD-07 correct)
5. test_read_tracking.py:390: `test_get_read_stats_total_count_excludes_self_reads` asserts total_count==4 ✓ (P1 BDD-30 correct)
6. unique_count query has `is_self_read = 0` + `action = 'read'` (line 89) ✓ (IR-12 correct)
7. get_read_stats total_count has NO is_self_read filter (line 79-82) ✓ (Q3 answer correct)
8. files.py:188 is download_file, line 232 is get_file_content, line 432 is resolve_entry_raw — all use inline channel detection not _detect_channel ✓

### BDD binary-judgment check:
- All 30 BDDs use Given/When/Then format
- BDD-01 through BDD-30: sequential, no gaps
- Each BDD has single Given-When-Then (multi-scenario split into separate BDDs where needed)
- All are PASS/FAIL determinable

### Implicit requirement coverage:
- Data: IR-1 through IR-5 (migration, new table, backfill, source default, reader_fingerprints) ✓
- Frontend: IR-6 (no changes) ✓
- Multi-end: IR-7/IR-8 (MCP/CLI no changes) ✓
- Boundary: IR-9 through IR-16 (window_key, discover None, unique_readers, self_read, 90-day events, cleanup order, config default, perf) ✓
- Compat: IR-17 through IR-20 (backup auto, restore merge, restore replace, _cleanup_reads) ✓
- Test: IR-21 through IR-23 ✓

### Trim rationality:
- risk_level: medium ✓ (5 subsystems, schema change)
- phases: [P1-P8] no trims ✓
- P2/P3/P5/P6/P7/P8 all justified as non-trimmable ✓

### P1 purity check:
- BDDs describe behavior, not implementation ✓
- No API endpoint names in BDD conditions (only in Given/When as user actions) ✓
- Minor: BDD-19 mentions _run_migrations (implementation detail) — acceptable as it describes the migration trigger

### Issues found:
1. BDD-09: "by_source 包含来源分类键（direct/internal/search/social/other 中的至少一个）" — "至少一个" makes this non-binary (how many is "at least one"?). Should specify exact expected keys or rephrase.
   → Actually re-reading: "至少一个" IS binary — you check if at least one key exists. PASS if ≥1 key, FAIL if no keys. Acceptable.
2. BDD-22: Says "91 天前的被清理后不存在" — but this BDD conflates two things: (a) cleanup deletes old records, and (b) get_read_events returns only remaining. The Given says "有91天前和10天前", When says "调用get_read_events", Then says "只包含90天内的". But cleanup hasn't been explicitly triggered in the When. This is ambiguous — does get_read_events filter by date, or does it just return whatever exists (which after cleanup is ≤90 days)?
   → Looking at IR-13: "清理后原始记录不存在了；get_read_events 是从原始表读". So BDD-22's intent is: after cleanup runs, get_read_events only sees remaining records. The BDD should explicitly state cleanup has run in the Given/When. Minor revision needed.
3. BDD-16: "不从原始表实时聚合" in parentheses — this is an implementation detail leaking into BDD. But the core assertion (values match aggregate table) is binary. Acceptable.
4. Missing BDD: discover (entry_id=None) does NOT enter entry_read_stats aggregate table. IR-10 states this, but there's no BDD verifying it. This is an important boundary case — if discover accidentally gets written to aggregate table with entry_id=None or entry_id=0, it corrupts the table.
   → This is a real gap. Should have a BDD like "discover events do not create entry_read_stats rows".
5. BDD-13/14: "reader_id=5" with fingerprint "u:5" — but record_read generates fingerprint from reader_id. The BDD says "reader_id=5 再次读取（同一 fingerprint u:5）" which is correct linkage. ✓
6. BDD-27: "reads.total 包含已删 entry 的历史流量" — this depends on BDD-25 (aggregate row preserved). The chain is correct. ✓
7. Missing BDD: source classification for "search" and "social" categories. BDD-10 (direct) and BDD-11 (internal) exist, but no BDD for search/social/other. P0-brief defines 5 categories but only 2 have BDDs.
   → This is a gap. Either add BDDs for search/social/other, or justify why partial coverage suffices (e.g., the classification logic is the same pattern, direct/internal are representative).
8. BDD-19: "默认值为 NULL 或 'unknown'" — "或" makes this non-binary. Which one? The migration must pick one. P0-brief says "历史数据无 source → 回填时归为 unknown" (IR-4), but BDD-19 is about the column migration, not the backfill. The column default could be NULL while backfill sets "unknown". This should be clarified.
9. Missing BDD: concurrent writes to entry_read_stats. SQLite is single-writer, but the BDD should verify that simultaneous record_read calls don't corrupt the aggregate table (e.g., lost update on total_reads). This is an edge case worth covering given write-time update is new.
   → Actually, SQLite WAL single-writer model means this is handled at DB level. P0-brief says "SQLite 单写者模型，日均几十次无影响". Acceptable to not have a BDD for this — it's an implementation guarantee, not a behavior requirement.

### Summary of findings:
- 2 real gaps (missing BDD for discover-not-in-aggregate, missing BDD for search/social/other source)
- 1 minor ambiguity (BDD-22 cleanup trigger not explicit in When)
- 1 minor ambiguity (BDD-19 "NULL 或 unknown")
- Overall quality: high, BDDs are mostly binary-judgmentable, IRs comprehensive, no solution design mixed in

## Final self-check
- P1-review.md exists: ✓ (190 lines)
- status: needs-revision ✓
- BDD 编号引用: ✓ (65 BDD- references)
- 覆盖维度标注: ✓ (每条 BDD 标注 数据/前端/多端/边界/兼容)
- 4 修改意见 R-1 through R-4 ✓
- [PROD_NOT_TOUCHED] ✓

## P1 修复轮 — analyst revision (2026-08-03)

### 读取输入
- P1-dispatch-context-analyst-revision.md：4 项修复目标
- P1-review.md：R-1~R-4 修改意见
- P1-requirements.md：当前版本（30 条 BDD）
- P0-brief.md：source 5 分类定义、IR-4 回填 unknown

### 修复 1: BDD-19 二值歧义（R-1）
- 当前 Then："默认值为 NULL 或 'unknown'" → "或"导致非二值
- 修改：明确默认值为 NULL（回填由 BDD-17 覆盖设为 unknown）

### 修复 2: BDD-22 When 补全（R-2）
- 当前 When 只说"调用 get_read_events"，但 Then 说"被清理后不存在"——cleanup_expired 未在 When 中触发
- 修改：When 补全 cleanup_expired 执行后再调用 get_read_events

### 修复 3: 新增 BDD-31 discover 不入聚合表（R-3）
- IR-10 声明 discover（entry_id=None）不入聚合表，但无 BDD 验证
- 新增 BDD-31：discover 事件不创建 entry_read_stats 聚合行

### 修复 4: 新增 BDD-32/33/34 search/social/other 来源分类（R-4）
- P0-brief 定义 5 类 source（direct/internal/search/social/other），只有 direct（BDD-10）和 internal（BDD-11）有 BDD
- 新增 BDD-32: search、BDD-33: social、BDD-34: other（兜底分类）

### 自检结果
- BDD-19: 已消除"NULL 或 unknown"歧义，改为明确"默认值为 NULL" ✓
- BDD-22: When 已补全 cleanup_expired 执行 ✓
- BDD-31: 已新增，验证 discover 不入聚合表 ✓
- BDD-32/33/34: 已新增，覆盖 search/social/other 三类 source ✓
- BDD 总数：30 → 34 ✓
- 编号连续：BDD-01 ~ BDD-34 ✓
- 已 approved 的 BDD（BDD-01~18, BDD-20~21, BDD-23~30）未动 ✓
- status: draft ✓
- 无 [NEED_CONFIRM] ✓

[PROD_NOT_TOUCHED]
