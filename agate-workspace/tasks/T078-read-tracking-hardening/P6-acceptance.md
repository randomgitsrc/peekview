---
phase: P6
task_id: T078-read-tracking-hardening
type: acceptance
parent: P5-test-results.md
trace_id: T078-P6-20260803
status: draft
created: 2026-08-03
agent: verifier
---

# P6 验收报告 — T078 read-tracking-hardening

## 验证方式

纯后端任务，无 UI 截图。所有 BDD 通过 pytest 单元/集成测试验证。

执行命令：
```
cd backend && .venv/bin/python -m pytest tests/test_read_tracking_hardening.py -v --tb=short
```

执行结果：34 passed, 0 failed, 0 skipped（6.47s）

## 环境隔离

- [PROD_NOT_TOUCHED]
- conftest autouse 隔离到 tmp_path，生产 DB（~/.peekview/peekview.db）未触碰
- 测试使用临时 tracking_engine / client_and_app fixture，独立 SQLite 实例

## BDD 逐条验收

### 探针准确性 — window_key

- PASS BDD-01: window_key 含 action，同一分钟内 read + download 不合并 — 2 条记录，action 分别为 read/download，count=1 (test-output.log)
- PASS BDD-02: window_key 含 action，同一分钟内相同 action 仍合并 — 1 条记录，count=3，window_key 含 ":read:" (test-output.log)

### 探针准确性 — share channel

- PASS BDD-03: 公开 entry 带 share token 访问时 channel 记为 "share" — entry_reads 中 channel 全部为 "share" (test-output.log)
- PASS BDD-04: share cookie 访问 download_file 时 channel 记为 "share" — download action 记录 channel 全部为 "share" (test-output.log)
- PASS BDD-05: share cookie 访问 get_file_content 时 channel 记为 "share" — file content 访问记录 channel 全部为 "share" (test-output.log)
- PASS BDD-06: share cookie 访问 get_entry_raw 时 channel 记为 "share" — raw action 记录 channel 全部为 "share" (test-output.log)

### 探针准确性 — discover 数据可查

- PASS BDD-07: admin stats 包含 discover action 的读取计数 — reads.by_action 含 "discover" 且值 > 0 (test-output.log)
- PASS BDD-31: discover 事件不创建 entry_read_stats 聚合行 — entry_id=None 调用后 EntryReadStats 表 0 行 (test-output.log)

### 统计维度 — by_action

- PASS BDD-08: read_stats 返回 by_action 维度 — by_action 含 read/raw/download 三个键 (test-output.log)

### 统计维度 — by_source

- PASS BDD-09: read_stats 返回 by_source 维度 — by_source 非空，含 "direct" 键 (test-output.log)
- PASS BDD-10: 无 Referer 时 source 归为 "direct" — entry_reads.source == "direct" (test-output.log)
- PASS BDD-11: 同域名 Referer 时 source 归为 "internal" — _classify_source 返回 "internal" (test-output.log)
- PASS BDD-32: 搜索引擎 Referer 时 source 归为 "search" — _classify_source(google.com) 返回 "search" (test-output.log)
- PASS BDD-33: 社交平台 Referer 时 source 归为 "social" — _classify_source(twitter.com) 返回 "social" (test-output.log)
- PASS BDD-34: 其他 Referer 时 source 归为 "other" — _classify_source(example.com) 返回 "other" (test-output.log)

### 聚合表 — 写时更新

- PASS BDD-12: record_read 时同步更新 entry_read_stats 聚合表 — total_reads=1, by_action.read=1, by_channel.api=1 (test-output.log)
- PASS BDD-13: unique_readers 写时更新，重复读取者不重复计数 — unique_readers=1, reader_fingerprints 含 "u:5" (test-output.log)
- PASS BDD-14: unique_readers 写时更新，新读取者计数增加 — unique_readers=2, reader_fingerprints 含 "u:5" 和 "u:6" (test-output.log)
- PASS BDD-15: unique_readers 排除 self_read — owner 读取后 unique_readers=0, reader_fingerprints 不含 "u:10" (test-output.log)
- PASS BDD-16: get_read_stats 从聚合表读取，不查原始表 — 返回值与聚合表预设数据一致（total_count=10, unique_readers=3, by_action/by_channel/by_source 一致） (test-output.log)

### 聚合表 — 回填

- PASS BDD-17: 启动时 entry_read_stats 为空且 entry_reads 有数据则回填 — 回填后 total_reads=3, by_action.read=3, by_source.unknown=3 (test-output.log)
- PASS BDD-18: 启动时 entry_read_stats 已有数据则不回填 — 回填后 total_reads 仍为 5（幂等） (test-output.log)

### 迁移 — source 列

- PASS BDD-19: entry_reads 表新增 source 列 — PRAGMA table_info 含 "source" 列 (test-output.log)

### 90 天清理

- PASS BDD-20: 超过 90 天的 entry_reads 记录被清理 — 91 天前记录被删除 (test-output.log)
- PASS BDD-21: 清理 entry_reads 后 entry_read_stats 不受影响 — 清理后聚合行 total_reads=5 不变 (test-output.log)
- PASS BDD-22: 清理后 get_read_events 只返回剩余记录 — 清理后 total=1，只含 10 天前记录 (test-output.log)
- PASS BDD-23: PEEKVIEW_CLEANUP__READS_RETENTION_DAYS 可配置 — retention_days=30 时 31 天前记录被删除 (test-output.log)

### 删除策略

- PASS BDD-24: 删 entry 时删除 entry_reads 原始记录 — 删除后 entry_reads 该 entry_id 0 条 (test-output.log)
- PASS BDD-25: 删 entry 时保留 entry_read_stats 聚合行 — 删除后 EntryReadStats 聚合行仍在，total_reads=1 (test-output.log)

### Admin stats 读取维度

- PASS BDD-26: admin stats 包含 reads 维度 — reads 含 total/today/by_action/by_channel/by_source 子字段 (test-output.log)
- PASS BDD-27: admin stats reads.total 包含已删 entry 的历史流量 — entry_id=999 聚合行 total_reads=5 被计入 reads.total (test-output.log)

### Backup/Restore

- PASS BDD-28: restore merge 后 entry_read_stats 有数据 — merge 后 EntryReadStats 表有行，total_reads=7 (test-output.log)
- PASS BDD-29: restore replace 后 entry_read_stats 有数据 — replace 后 EntryReadStats 表有行，total_reads=3 (test-output.log)

### 测试修正

- PASS BDD-30: total_count 语义为包含 self_read — 3 条非 self_read + 1 条 self_read → total_count=4 (test-output.log)

## 汇总

- BDD 总数：34
**Summary**: 34/34 PASS, 0 FAIL
- Failures: 0
- NEED_CONFIRM：0

[NO_NEED_CONFIRM]

## 证据

- P6-evidence/test-output.log — pytest 执行日志（34 passed, 0 failed）
