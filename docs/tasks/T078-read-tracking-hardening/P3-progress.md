# P3 Progress — test-designer

## Input Files Read

1. P3-dispatch-context-test-designer.md — 派发指引（34 BDD 1:1 映射，红灯预期清单）
2. test-designer.md — 角色定义（TDD 红灯，BDD→测试 1:1，分阶段落盘）
3. P0-brief.md — 任务简报（探针修复 + 聚合表 + 维度扩展 + 90 天清理 + admin stats）
4. P1-requirements.md — 34 条 BDD（BDD-01~BDD-34），含隐含需求 IR-1~IR-23
5. P2-design.md — 方案 A（聚合表写时更新），12 文件改动清单 + files_to_read
6. read_tracking_service.py — 现有 record_read（window_key 不含 action）/ get_read_stats（查原始表）
7. models.py — EntryRead（无 source 列）/ ReadStatsResponse（无 by_action/by_source）/ AdminStatsResponse（无 reads）
8. _shared.py — _record_read_async（无 source 参数，无 _detect_channel，无 _classify_source）
9. conftest.py — autouse 隔离（tmp_path），tracking_engine/tracking_session fixture
10. factories.py — EntryFactory/FileFactory
11. test_read_tracking.py — 现有测试（test_get_read_stats_total_count_excludes_self_reads 名断言矛盾）
12. entries.py — _detect_channel（本地定义，line 36-42），line 231 channel="api" bug
13. files.py — 三处 channel 内联（line 188/232/432），不走 _detect_channel
14. admin_service.py — get_stats（无 reads 维度）/ cleanup_expired（无 entry_reads 清理）/ _restore_merge（无 entry_read_stats 导入）
15. entry_service.py — _cleanup_reads（只删 EntryRead，不删聚合表——表不存在所以无需改）
16. database.py — _run_migrations（无 source 列迁移）
17. config.py — PeekCleanup（无 reads_retention_days）

## Key Design Decisions

- 新建 test_read_tracking_hardening.py（不修改现有 test_read_tracking.py）
- 测试分 5 个 class：TestWindowKeyAction / TestShareChannel / TestSourceClassification / TestAggregationTable / TestCleanupAndAdmin
- BDD-30 在新文件中写 test_bdd_30_total_count_includes_self_read（不修改旧文件中的旧测试名）
- 红灯预期：import EntryReadStats 失败 / record_read 不接受 source 参数 / get_read_stats 无 by_action / _detect_channel 不在 _shared / _classify_source 不存在 / cleanup_expired 无 reads_cleaned / AdminStatsResponse 无 reads

## Test Execution Result

- 34 tests collected, 34 failed (red light), 0 passed
- All failures are genuine red lights (implementation not yet written):
  - 15x ImportError: EntryReadStats (model not implemented)
  - 4x TypeError: record_read() 'source' (parameter not implemented)
  - 4x ImportError: _classify_source (function not implemented)
  - 4x assert False (share channel bug not fixed)
  - 3x ValueError: reads_retention_days (config field not implemented)
  - 1x AssertionError: 'source' not in columns (migration not implemented)
  - 1x AssertionError: 'reads' not in admin stats (dimension not implemented)
  - 1x AssertionError: ':read:' not in window_key (format not changed)
  - 1x AssertionError: 1 == 2 (window_key action bug not fixed)

## Self-Check

- [x] P3-test-cases.md exists and contains test_code_dir declaration
- [x] 34 BDD all have corresponding test cases (1:1 mapping)
- [x] Test code in backend/tests/ directory
- [x] All tests fail before implementation (true red lights)
- [x] No SyntaxError or third-party import failures (no false red lights)
- [x] No test green (implementation not yet written)

## Output Files

1. docs/tasks/T078-read-tracking-hardening/P3-test-cases.md
2. backend/tests/test_read_tracking_hardening.py
