---
phase: P4
task_id: T078-read-tracking-hardening
type: implementation
parent: P3-test-cases.md
trace_id: T078-P4-20260803
status: draft
created: 2026-08-03
agent: implementer
---

implementation_dir: backend/peekview

## 概述

T078 read-tracking-hardening 的 P4 实现。P2 方案 A（聚合表写时更新）的全部代码改动已落盘。

## 改动文件清单

| 文件 | 改动 | BDD 覆盖 |
|------|------|----------|
| `backend/peekview/models.py` | EntryReadStats model (line 284); EntryRead.source 列 (line 273); ReadStatsResponse 加 by_action/by_source (line 298); ReadsStats model (line 730); AdminStatsResponse.reads (line 743); AdminCleanupResponse.reads_cleaned (line 746); RestorePreview.read_stats_count; RestoreResult.read_stats_imported | BDD-08~09, 12~16, 19, 26 |
| `backend/peekview/config.py` | PeekCleanup.reads_retention_days (line 216, default=90) + field_validator | BDD-23 |
| `backend/peekview/services/read_tracking_service.py` | window_key 加 action (line 50); record_read 加 source 参数 + 写时更新聚合表 (line 79~116); get_read_stats 改读聚合表 (line 120~140); backfill_stats 方法 (line 184~265) | BDD-01~02, 12~18, 30~31 |
| `backend/peekview/api/_shared.py` | _detect_channel 提取到此 (line 22); _classify_source 新增 (line 35); _record_read_async 加 request 参数 + source 提取 (line 55~82) | BDD-03~06, 10~11, 32~34 |
| `backend/peekview/api/entries.py` | _detect_channel 从 _shared 导入 (line 15); line 224 channel="share" 硬编码; line 294/470 传 slug 参数 | BDD-03 |
| `backend/peekview/api/files.py` | 三处内联 channel 改为 _detect_channel(request, slug) (line 189/234/435); _record_read_async 传 request | BDD-04~06 |
| `backend/peekview/database.py` | _run_migrations 加 entry_reads.source 列迁移 (line 150~157) | BDD-19 |
| `backend/peekview/main.py` | create_app 中 backfill_stats 调用 (line 222) | BDD-17~18 |
| `backend/peekview/services/admin_service.py` | get_stats 加 reads 维度 (line 174~214); cleanup_expired 加 90 天清理 (line 287~295); _restore_merge 导入 entry_read_stats (line 870~898); RestorePreview/RestoreResult 新字段 | BDD-07, 20~23, 26~29 |
| `backend/peekview/services/entry_service.py` | _cleanup_reads 无改动（确认只删 entry_reads，不删 entry_read_stats） | BDD-24~25 |
| `backend/tests/test_read_tracking_hardening.py` | 修复 lint：ruff --fix 自动排序 + 去 redefinition；手动修复 2x F841 unused `result` | — |

## 自查结果

- 34/34 红灯测试变绿（`pytest tests/test_read_tracking_hardening.py`）
- 全量测试套件：1042 passed, 2 skipped, 0 failures
- Lint：`ruff check peekview/ tests/` — All checks passed!
- EntryReadStats model 已落盘：models.py:284
- _classify_source 已落盘：_shared.py:35
- _detect_channel 在 _shared.py:22
- [PROD_NOT_TOUCHED]

## 实现说明

### window_key 格式变更 (BDD-01~02)
`window_key` 从 `{eid}:{fp}:{channel}:{ts}` 改为 `{eid}:{fp}:{channel}:{action}:{ts}`。新旧格式不冲突（unique 约束安全）。同一分钟内不同 action 不再合并。

### 聚合表写时更新 (BDD-12~15)
`record_read()` 在同一 Session 内同步更新 `entry_read_stats`。每次调用对应原始表 +1 和聚合表 +1（不变量）。`unique_readers` 排除 `is_self_read`，通过 `reader_fingerprints` 字符串去重。

### _classify_source 实现细节 (BDD-10~11, 32~34)
`_classify_source(referer, request_host)` 的 host 比较逻辑：`request_host.lower().split(":")[0]` 去端口后与 referer hostname 比较。测试 BDD-11 传 `"127.0.0.1:8888"` 作为 request_host，去端口后得 `"127.0.0.1"`，与 referer `"http://127.0.0.1:8888/entries"` 的 hostname `"127.0.0.1"` 匹配 → `"internal"`。

### 回填逻辑 (BDD-17~18)
`backfill_stats()` 在 `main.py:create_app()` 中 `init_db` 之后调用（line 222）。幂等：`entry_read_stats` 非空则跳过。`source` 为 NULL 的历史数据通过 `COALESCE(source, 'unknown')` 归为 `unknown`。

### Admin stats reads 维度 (BDD-07, 26~27)
`get_stats()` 从 `entry_read_stats` 聚合表 + `entry_reads`（discover, entry_id IS NULL）汇总。`reads.total` 包含已删 entry 的历史流量（聚合行保留）。`reads.today` 从原始表查 `read_at >= today_start`。
