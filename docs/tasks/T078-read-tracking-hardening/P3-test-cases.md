---
phase: P3
task_id: T078-read-tracking-hardening
type: test-cases
parent: P2-design.md
trace_id: T078-P3-20260803
status: draft
created: 2026-08-03
agent: test-designer
---

test_code_dir: backend/tests/test_read_tracking_hardening.py

## 概述

本文件记录 T078 read-tracking-hardening 任务的 34 条 BDD 验收条件与测试用例的 1:1 映射。

测试代码：`backend/tests/test_read_tracking_hardening.py`
测试状态：34/34 红灯（实现前全部失败）

## 红灯分类

| 失败类型 | 数量 | 说明 |
|---------|------|------|
| `ImportError: EntryReadStats` | 15 | model 未实现 |
| `TypeError: record_read() got unexpected keyword 'source'` | 4 | source 参数未实现 |
| `ImportError: _classify_source` | 4 | _classify_source 函数未实现 |
| `assert False` (share channel == "api") | 4 | share channel bug 未修复 |
| `ValueError: PeekCleanup has no field "reads_retention_days"` | 3 | config 字段未实现 |
| `AssertionError: 'source' not in columns` | 1 | source 列迁移未实现 |
| `AssertionError: 'reads' not in admin stats` | 1 | admin stats reads 维度未实现 |
| `AssertionError: ':read:' not in window_key` | 1 | window_key 格式未改 |
| `AssertionError: 1 == 2` (window_key 合并) | 1 | window_key action bug 未修复 |

## BDD → 测试用例映射

### 探针准确性 — window_key

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-01: window_key 含 action，同一分钟内 read + download 不合并 | `TestBDD01WindowKeyAction.test_bdd_01_different_actions_same_minute_not_merged` | assert 1 == 2（当前 window_key 不含 action，read+download 被合并） |
| BDD-02: window_key 含 action，同一分钟内相同 action 仍合并 | `TestBDD01WindowKeyAction.test_bdd_02_same_action_same_minute_merged` | assert ':read:' not in window_key（当前格式不含 action） |

### 探针准确性 — share channel

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-03: 公开 entry 带 share token 访问时 channel 记为 "share" | `TestBDD03ShareChannel.test_bdd_03_public_entry_with_share_token_channel_share` | assert False（channel == "api" 而非 "share"） |
| BDD-04: share cookie 访问 download_file 时 channel 记为 "share" | `TestBDD03ShareChannel.test_bdd_04_share_cookie_download_channel_share` | assert False（files.py 内联 channel 不走 _detect_channel） |
| BDD-05: share cookie 访问 get_file_content 时 channel 记为 "share" | `TestBDD03ShareChannel.test_bdd_05_share_cookie_file_content_channel_share` | assert False（files.py 内联 channel 不走 _detect_channel） |
| BDD-06: share cookie 访问 get_entry_raw 时 channel 记为 "share" | `TestBDD03ShareChannel.test_bdd_06_share_cookie_raw_channel_share` | assert False（files.py 内联 channel 不走 _detect_channel） |

### 探针准确性 — discover 数据可查

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-07: admin stats 包含 discover action 的读取计数 | `TestBDD07DiscoverData.test_bdd_07_admin_stats_includes_discover` | AssertionError: 'reads' not in admin stats response |
| BDD-31: discover 事件不创建 entry_read_stats 聚合行 | `TestBDD07DiscoverData.test_bdd_31_discover_no_aggregation_row` | ImportError: EntryReadStats + TypeError: record_read() 'source' |

### 统计维度 — by_action / by_source

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-08: read_stats 返回 by_action 维度 | `TestBDD08ByActionBySource.test_bdd_08_read_stats_returns_by_action` | TypeError: record_read() 'source' |
| BDD-09: read_stats 返回 by_source 维度 | `TestBDD08ByActionBySource.test_bdd_09_read_stats_returns_by_source` | TypeError: record_read() 'source' |

### 来源分类

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-10: 无 Referer 时 source 归为 "direct" | `TestBDD10SourceClassification.test_bdd_10_no_referer_source_direct` | TypeError: record_read() 'source' |
| BDD-11: 同域名 Referer 时 source 归为 "internal" | `TestBDD10SourceClassification.test_bdd_11_internal_referer_source_internal` | ImportError: _classify_source |
| BDD-32: 搜索引擎 Referer 时 source 归为 "search" | `TestBDD10SourceClassification.test_bdd_32_search_engine_referer_source_search` | ImportError: _classify_source |
| BDD-33: 社交平台 Referer 时 source 归为 "social" | `TestBDD10SourceClassification.test_bdd_33_social_platform_referer_source_social` | ImportError: _classify_source |
| BDD-34: 其他 Referer 时 source 归为 "other" | `TestBDD10SourceClassification.test_bdd_34_other_referer_source_other` | ImportError: _classify_source |

### 聚合表 — 写时更新

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-12: record_read 时同步更新 entry_read_stats 聚合表 | `TestBDD12AggregationTable.test_bdd_12_record_read_updates_aggregation_table` | TypeError: record_read() 'source' |
| BDD-13: unique_readers 重复读取者不重复计数 | `TestBDD12AggregationTable.test_bdd_13_unique_readers_repeat_not_counted` | TypeError: record_read() 'source' |
| BDD-14: unique_readers 新读取者计数增加 | `TestBDD12AggregationTable.test_bdd_14_unique_readers_new_reader_counted` | TypeError: record_read() 'source' |
| BDD-15: unique_readers 排除 self_read | `TestBDD12AggregationTable.test_bdd_15_unique_readers_excludes_self_read` | TypeError: record_read() 'source' |
| BDD-16: get_read_stats 从聚合表读取，不查原始表 | `TestBDD12AggregationTable.test_bdd_16_get_read_stats_reads_from_aggregation_table` | ImportError: EntryReadStats |

### 聚合表 — 回填 + 迁移

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-17: 启动时 entry_read_stats 为空且 entry_reads 有数据则回填 | `TestBDD17BackfillAndMigration.test_bdd_17_backfill_on_startup_when_stats_empty` | ImportError: EntryReadStats |
| BDD-18: 启动时 entry_read_stats 已有数据则不回填 | `TestBDD17BackfillAndMigration.test_bdd_18_no_backfill_when_stats_already_exist` | ImportError: EntryReadStats |
| BDD-19: entry_reads 表新增 source 列 | `TestBDD17BackfillAndMigration.test_bdd_19_entry_reads_has_source_column` | AssertionError: 'source' not in column names |

### 90 天清理

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-20: 超过 90 天的 entry_reads 记录被清理 | `TestBDD20CleanupExpired.test_bdd_20_old_reads_cleaned_up` | ValueError: reads_retention_days not in PeekCleanup |
| BDD-21: 清理 entry_reads 后 entry_read_stats 不受影响 | `TestBDD20CleanupExpired.test_bdd_21_stats_unaffected_after_cleanup` | ValueError: reads_retention_days not in PeekCleanup |
| BDD-22: 清理后 get_read_events 只返回剩余记录 | `TestBDD20CleanupExpired.test_bdd_22_get_read_events_after_cleanup` | ValueError: reads_retention_days not in PeekCleanup |
| BDD-23: PEEKVIEW_CLEANUP__READS_RETENTION_DAYS 可配置 | `TestBDD20CleanupExpired.test_bdd_23_configurable_retention_days` | ValueError: reads_retention_days not in PeekCleanup |

### 删除策略

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-24: 删 entry 时删除 entry_reads 原始记录 | `TestBDD24DeleteStrategy.test_bdd_24_delete_entry_removes_raw_reads` | ImportError: EntryReadStats（测试同时验证聚合行不被删除） |
| BDD-25: 删 entry 时保留 entry_read_stats 聚合行 | `TestBDD24DeleteStrategy.test_bdd_25_delete_entry_preserves_aggregation` | ImportError: EntryReadStats |

### Admin stats 读取维度

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-26: admin stats 包含 reads 维度 | `TestBDD26AdminStatsReads.test_bdd_26_admin_stats_has_reads_dimension` | ImportError: EntryReadStats |
| BDD-27: admin stats reads.total 包含已删 entry 的历史流量 | `TestBDD26AdminStatsReads.test_bdd_27_admin_stats_total_includes_deleted_entry` | ImportError: EntryReadStats |

### Backup/Restore

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-28: restore merge 后 entry_read_stats 有数据 | `TestBDD28RestoreAggregation.test_bdd_28_restore_merge_imports_read_stats` | ImportError: EntryReadStats |
| BDD-29: restore replace 后 entry_read_stats 有数据 | `TestBDD28RestoreAggregation.test_bdd_29_restore_replace_imports_read_stats` | ImportError: EntryReadStats |

### 测试修正

| BDD | 测试方法 | 预期红灯 |
|-----|---------|---------|
| BDD-30: total_count 语义为包含 self_read | `TestBDD30TotalCountSemantics.test_bdd_30_total_count_includes_self_read` | TypeError: record_read() 'source' |

## 测试组织

```
backend/tests/test_read_tracking_hardening.py
├── TestBDD01WindowKeyAction        (BDD-01, BDD-02)
├── TestBDD03ShareChannel           (BDD-03, BDD-04, BDD-05, BDD-06)
├── TestBDD07DiscoverData           (BDD-07, BDD-31)
├── TestBDD08ByActionBySource       (BDD-08, BDD-09)
├── TestBDD10SourceClassification   (BDD-10, BDD-11, BDD-32, BDD-33, BDD-34)
├── TestBDD12AggregationTable       (BDD-12, BDD-13, BDD-14, BDD-15, BDD-16)
├── TestBDD17BackfillAndMigration   (BDD-17, BDD-18, BDD-19)
├── TestBDD20CleanupExpired         (BDD-20, BDD-21, BDD-22, BDD-23)
├── TestBDD24DeleteStrategy         (BDD-24, BDD-25)
├── TestBDD26AdminStatsReads        (BDD-26, BDD-27)
├── TestBDD28RestoreAggregation     (BDD-28, BDD-29)
└── TestBDD30TotalCountSemantics    (BDD-30)
```

## 设计决策

1. **新建独立测试文件**：不修改现有 `test_read_tracking.py`，避免影响现有测试
2. **模块级 import EntryRead**：确保 `SQLModel.metadata.create_all(engine)` 能创建 `entry_reads` 表
3. **EntryReadStats 在测试函数内 import**：产生正确的 ImportError 红灯
4. **share cookie 测试**：使用 share access 自动设置的 cookie（前缀值），不手动覆盖
5. **BDD-05 清空初始记录**：share access 会产生 channel="share" 的 read 记录，需清空后再测 file content 端点
6. **BDD-24 同时导入 EntryReadStats**：虽然 BDD-24 主要测 entry_reads 删除，但加入 EntryReadStats import 确保红灯（当前行为已正确，但新表不存在）
7. **delete_entry 使用 allow_local=True**：绕过认证检查，直接测试删除逻辑

[PROD_NOT_TOUCHED]
