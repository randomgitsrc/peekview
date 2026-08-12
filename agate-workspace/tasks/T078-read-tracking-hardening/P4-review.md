---
phase: P4
task_id: T078-read-tracking-hardening
type: review
parent: P4-implementation.md
trace_id: T078-P4-20260803
status: approved
created: 2026-08-03
agent: review
---

# P4 Review — read-tracking-hardening

## 评审范围

审查 P4 实现代码，覆盖 13 个文件改动，对照 34 BDD 验收条件 + P2 方案设计。

## Pass 1 — 数据安全与正确性（CRITICAL）

### 1.1 SQL 注入

所有 raw SQL 查询均使用 `text()` + `bindparams()` 参数化绑定，无字符串拼接。

- `read_tracking_service.py:186-245`（backfill_stats）：6 个查询全部 `bindparams(eid=eid)`
- `admin_service.py:292-294`（cleanup DELETE）：`bindparams(cutoff=cutoff)`
- `database.py:151-156`（migration ALTER）：DDL 无用户输入

**结论：无 SQL 注入风险。**

### 1.2 Read-Check-Write 竞态条件

`record_read()` (`read_tracking_service.py:54-118`) 在同一 Session 内执行：
1. SELECT existing by window_key
2. INSERT or UPDATE
3. SELECT stats by entry_id (PK)
4. UPDATE stats

SQLite 单写者模型 + WAL 模式下，同一 Session 的事务是串行的。但跨请求并发时，两个 `record_read` 可能同时读到 `existing=None` 和 `stats=None`，导致：
- window_key 唯一约束冲突 → 第二个事务回滚（IntegrityError 被 `_record_read_async` 的 `try/except` 吞掉，read event 丢失）
- 聚合表 stats 行重复创建 → PK 冲突 → 同上

**风险评估**：SQLite 的写锁会在第一个事务 commit 后释放，第二个事务会等待。实际上 SQLite 的 `BEGIN IMMEDIATE` 行为取决于 isolation level。SQLModel 默认使用 `BEGIN`（deferred），理论上存在 TOCTOU 窗口。但：
- window_key 有 UNIQUE 约束兜底（冲突时 IntegrityError，不会重复计数）
- entry_read_stats PK 是 entry_id（冲突时 IntegrityError，不会重复创建行）
- `_record_read_async` 有 `try/except` 吞掉异常（fire-and-forget 语义，丢失个别 read event 可接受）

**结论：无 CRITICAL。** 约束兜底 + fire-and-forget 语义使竞态不会导致数据损坏，只会丢失个别事件。与现有代码模式一致（P4 未引入新的竞态窗口）。

### 1.3 window_key 格式变更兼容

`read_tracking_service.py:50`:
```python
window_key = f"{eid_part}:{fingerprint}:{channel}:{action}:{window_ts}"
```

旧格式 `eid:fp:channel:ts` → 新格式 `eid:fp:channel:action:ts`。字符串不同，UNIQUE 约束不冲突。历史数据不回溯修改。**正确。**

### 1.4 聚合表写时更新不变量

`record_read()` 中，每次调用都执行 `stats.total_reads += 1`（line 93），无论 window_key 命中（existing.count += 1）还是新建（count=1）。`by_action`/`by_channel`/`by_source` 同理。**不变量成立：聚合表增量 = 原始表增量。**

### 1.5 unique_readers 排除 self_read

`read_tracking_service.py:107`:
```python
if not is_self_read:
    fps = [fp for fp in (stats.reader_fingerprints or "").split(",") if fp]
    if fingerprint not in fps:
        fps.append(fingerprint)
        stats.reader_fingerprints = ",".join(fps)
        stats.unique_readers += 1
```

使用列表 `in` 检查（非子字符串匹配），正确排除 self_read。**正确。**

### 1.6 迁移 DEFAULT NULL + model default 一致性

`models.py:273`: `source: str | None = Field(default=None, max_length=20)`
`database.py:154`: `ALTER TABLE entry_reads ADD COLUMN source VARCHAR(20) DEFAULT NULL`

P2 设计 §3.8 规定 model default 为 `"direct"`，但实现用 `None`。**偏差**：所有新记录通过 `_record_read_async` 显式传 `source`（`_shared.py:66-70`），model default 不会被触发。仅 `_restore_merge` 中 `source=_row_get(row, "source")` 可能返回 `None`（旧备份无 source 列），但这与 `DEFAULT NULL` 语义一致。**无功能影响，但与 P2 设计文档不一致。**

### 1.7 回填 COALESCE(source, 'unknown') 正确性

`read_tracking_service.py:217-225`:
```python
text("SELECT COALESCE(source, 'unknown') as src, SUM(count) as total FROM entry_reads "
     "WHERE entry_id = :eid GROUP BY src").bindparams(eid=eid)
```

NULL → `'unknown'`，非 NULL 保持原值。**正确。**

### 1.8 清理顺序

`admin_service.py:237-305`:
1. 先 archive expired entries (line 242-257)
2. 再 delete old archived entries (line 263-285) → 触发 `_cleanup_reads` 删 entry_reads
3. 最后清理 90 天 entry_reads (line 287-296)

清理顺序：先聚合（archive/delete entries 时聚合表不受影响），后清理原始表。**正确。**

### 1.9 删 entry 保留聚合统计

`entry_service.py:782-788`: `_cleanup_reads` 只 `select(EntryRead)` 并删除，不碰 `EntryReadStats`。**正确。**

### 1.10 restore merge PK 冲突跳过

`admin_service.py:870-898`:
- 收集目标库已有 `entry_read_stats.entry_id` 集合
- 导入前检查 PK 冲突 → 跳过
- 防止 backup 内重复 entry_id → `existing_stats_ids.add(new_entry_id)`

**正确。**

### 1.11 _classify_source 分类逻辑完整性

`_shared.py:35-52`:
- 无 Referer → "direct"
- 同域名（去端口）→ "internal"
- 搜索引擎列表匹配 → "search"
- 社交平台列表匹配 → "social"
- 其他 → "other"

`request_host.lower().split(":")[0]` 去端口后与 `urlparse(referer).hostname`（已去端口）比较。**正确。**

## Pass 2 — 代码健康（INFORMATIONAL）

### 2.1 [INFORMATIONAL] model source default 与 P2 设计不一致

`models.py:273`: `source: str | None = Field(default=None)`
P2 §3.8: `source: str = Field(default="direct")`

实际无功能影响（所有新记录显式传 source），但与设计文档不符。建议保持现状（`None` 与 migration `DEFAULT NULL` 语义一致）或更新 P2 文档。

### 2.2 [INFORMATIONAL] _restore_replace 未设 read_stats_imported

`admin_service.py:1031-1041`: `RestoreResult` 未设 `read_stats_imported`（默认 0）。replace 模式整库替换，统计信息在备份 DB 中已存在，返回 0 不反映实际情况。但 replace 语义是"替换全部"，`reads_imported=0` 同样未设，属于既有模式。**无需修复。**

### 2.3 [INFORMATIONAL] backfill_stats 性能

`read_tracking_service.py:202-263`: 对每个 entry_id 执行 5 个独立查询（action/channel 聚合、source 聚合、unique_readers、fingerprints、last_read）。大量 entry 时为 N+1 模式（N = entry 数量）。但回填仅在启动时执行一次（幂等跳过），且 entry 数量通常有限。**可接受。**

### 2.4 [INFORMATIONAL] reader_fingerprints 字符串拼接

`read_tracking_service.py:108-111`: 使用 `split(",")` + `",".join()` 管理 fingerprint 列表。`fingerprint` 格式为 `u:{id}` 或 `a:{hash}`，不会包含逗号。**安全。** 但当 fingerprint >500 时（P2 已知风险），`split` + `in` 检查变慢。**已知可接受风险。**

### 2.5 [INFORMATIONAL] backfill_stats last_read 类型检查

`read_tracking_service.py:246-250`: `last_read` 从 SQLite 查询返回可能是 `str` 或 `datetime`（取决于 SQLAlchemy 类型推断）。代码用 `isinstance(last_read, str)` 判断并尝试 `datetime.fromisoformat`。**正确处理了类型不确定性。**

### 2.6 [INFORMATIONAL] _record_read_async 同步阻塞

`_shared.py:72`: `record_read` 是同步方法，在 async 函数中直接调用会阻塞事件循环。现在聚合表更新增加了 Session 内的额外读写（SELECT stats + UPDATE stats），阻塞时间略增。但 SQLite 操作通常 <1ms，且 fire-and-forget 语义下可接受。**既有模式，非 P4 引入。**

### 2.7 [INFORMATIONAL] admin stats today 语义

`admin_service.py:199-206`: `today_count` 查询 `EntryRead.read_at >= today_start`，其中 `today_start` 是 naive UTC datetime。`read_at` 由 `now_utc()` 生成（aware UTC）。SQLAlchemy 处理 datetime 比较时会统一格式。**与既有代码模式一致（cleanup_expired 也用 naive datetime 比较）。**

## BDD 覆盖验证

| BDD | 文件:行 | 状态 |
|-----|---------|------|
| BDD-01 | read_tracking_service.py:50 | ✅ window_key 含 action |
| BDD-02 | read_tracking_service.py:50 | ✅ 同 action 仍合并 |
| BDD-03 | entries.py:224,252 | ✅ share token → channel="share" |
| BDD-04 | files.py:189 | ✅ _detect_channel(request, slug=slug) |
| BDD-05 | files.py:234 | ✅ 同上 |
| BDD-06 | files.py:435 | ✅ 同上 |
| BDD-07 | admin_service.py:187-197 | ✅ discover 从原始表查 |
| BDD-08 | read_tracking_service.py:95-97 | ✅ by_action JSON 更新 |
| BDD-09 | read_tracking_service.py:103-105 | ✅ by_source JSON 更新 |
| BDD-10 | _shared.py:36-37 | ✅ 无 Referer → direct |
| BDD-11 | _shared.py:44-47 | ✅ 同域名 → internal |
| BDD-12 | read_tracking_service.py:93-105 | ✅ 写时更新聚合表 |
| BDD-13 | read_tracking_service.py:108-112 | ✅ 重复不计数 |
| BDD-14 | read_tracking_service.py:108-112 | ✅ 新读者计数 |
| BDD-15 | read_tracking_service.py:107 | ✅ 排除 self_read |
| BDD-16 | read_tracking_service.py:120-140 | ✅ 只读聚合表 |
| BDD-17 | read_tracking_service.py:184-265 | ✅ 回填 + COALESCE unknown |
| BDD-18 | read_tracking_service.py:189-190 | ✅ 幂等跳过 |
| BDD-19 | database.py:150-157 | ✅ ALTER TABLE source DEFAULT NULL |
| BDD-20 | admin_service.py:287-296 | ✅ DELETE WHERE read_at < cutoff |
| BDD-21 | entry_service.py:782-788 | ✅ _cleanup_reads 不碰 stats |
| BDD-22 | admin_service.py:287-296 | ✅ 清理后 get_read_events 返回更少 |
| BDD-23 | config.py:216-219 | ✅ reads_retention_days 可配 |
| BDD-24 | entry_service.py:782-788 | ✅ 删 entry_reads |
| BDD-25 | entry_service.py:782-788 | ✅ 保留 entry_read_stats |
| BDD-26 | admin_service.py:174-214 | ✅ reads 维度 |
| BDD-27 | admin_service.py:175-177 | ✅ 聚合表保留已删 entry 流量 |
| BDD-28 | admin_service.py:870-898 | ✅ restore merge 导入 stats |
| BDD-29 | admin_service.py:951-1041 | ✅ restore replace 整库替换 |
| BDD-30 | read_tracking_service.py:93 | ✅ total_reads 含 self_read |
| BDD-31 | read_tracking_service.py:79 | ✅ entry_id=None 不入聚合表 |
| BDD-32 | _shared.py:48-49 | ✅ 搜索引擎 → search |
| BDD-33 | _shared.py:50-51 | ✅ 社交平台 → social |
| BDD-34 | _shared.py:52 | ✅ 其他 → other |

## 测试验证

- 34/34 BDD 测试通过（`pytest tests/test_read_tracking_hardening.py`）
- 全量测试套件：1042 passed, 2 skipped, 0 failures
- Lint：`ruff check peekview/ tests/` — All checks passed!

## 评审结论

**PASS — 无 CRITICAL 问题。**

7 个 INFORMATIONAL 项均为既有模式或已知可接受风险，不阻断发布。P2 设计文档中 model source default 的偏差（`None` vs `"direct"`）在实际运行中无功能影响。

[PROD_NOT_TOUCHED]
