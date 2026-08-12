---
phase: P0
task_id: T078
task_name: read-tracking-hardening
type: brief
trace_id: T078-P0-20260728
created: 2026-07-28
updated: 2026-08-03
status: draft
parent: 探针数据统计不准 + 查询性能 + 数据膨胀
---

## 任务简述

先修准探针（window_key 跨 action 合并 / share channel 错误 / discover 无查询），再加聚合表（O(1) 查询）+ 扩展统计维度（by_action / by_channel / by_source）+ 原始事件 90 天清理 + admin stats 全局读取概览。

## agate 四字段

```yaml
task: "修探针准确性 + 加聚合表 + 扩展统计维度 + 90 天清理 + admin stats 读取概览"
known_risks:
  - "涉及数据 schema 变更（新表 + 新列）"
  - "跨越 5 个子系统（写入路径/查询路径/清理/备份恢复/迁移）"
  - "window_key 格式变化影响去重语义"
  - "迁移回填正确性"
executor_env:
  platform: "opencode"
  has_task_tool: true
  has_local_runtime: true
  network: "full"
env_constraints:
  debug_env: "make debug（127.0.0.1:8888，/tmp/peekview-debug/）"
  test_cmd: "cd backend && .venv/bin/python -m pytest tests/ -q"
  lint_cmd: "cd backend && python3 -m ruff check peekview/ tests/"
```

## 与原 P0-brief 的差异

原 P0-brief（2026-07-28）只关注"加聚合表 + 加维度"。代码审计发现**现有探针本身就有准确性问题**，不先修会导致聚合表聚合错误数据——垃圾进垃圾出。本 brief 更新后范围前置探针修复。

原 I 节（display_name null 修复）已由 T074 hotfix 完成（commit 3adce6c9），不再纳入本任务。

## 背景痛点

### 探针准确性问题（代码审计发现）

1. **window_key 不含 action**（`read_tracking_service.py:47`）：`window_key = f"{eid}:{fingerprint}:{channel}:{window_ts}"`，同一分钟内同一人同一 channel 先 read 后 download，download 被 window_key 命中合并成 read 的 count+1。**by_action 统计全错**。

2. **share token + 公开 entry channel 错误**（`entries.py:231`）：公开 entry 带 `?share=xxx` 访问走 line 213-236 分支，channel 硬编码 `"api"`，应为 `"share"`。现有测试只覆盖私有 entry + share token（走 line 238-268），此分支无测试。

3. **files.py 三处 channel 不走 `_detect_channel()`**（`files.py:188/232/432`）：只看 `X-PeekView-Source` header，通过 share cookie 访问 `/raw`、download、file content 时 channel 记 `"api"` 而非 `"share"`。

4. **discover 数据记了白记**（`entries.py:176`）：list_entries 记 action="discover" entry_id=None，但 `get_read_stats(entry_id)` 查 `entry_reads.entry_id == entry_id`，None 不匹配任何 entry。`get_read_events` 同理。admin stats 也没读 discover。**没有任何接口能查到 discover 数据**。

5. **测试名与断言矛盾**（`test_read_tracking.py:390`）：`test_get_read_stats_total_count_excludes_self_reads` 期望 `total_count == 4`（含 self_read），但函数名说 "excludes self_reads"。

### 原有痛点（保留）

6. **查询性能隐患**：`get_read_stats()` 每次对 `entry_reads` 做 `SUM`/`COUNT(DISTINCT)`，数据量增长后变慢
7. **统计维度缺失**：只按 channel 分，不按 action / source 分
8. **数据膨胀**：`entry_reads` 表只增不减
9. **全局统计缺失**：admin stats 无读取维度

## 任务范围

### Phase 1：修探针准确性（先修再聚合）

#### A. window_key 加 action

`read_tracking_service.py:47` 改为：
```python
window_key = f"{eid_part}:{fingerprint}:{channel}:{action}:{window_ts}"
```

影响：现有 `entry_reads` 表的 window_key 列值变化。迁移时旧记录的 window_key 不含 action，新记录含 action。`window_key` 有 unique 约束，新旧格式不会冲突（同一分钟内旧格式的 `1:u:5:api:2026-08-03T14:23` 和新格式的 `1:u:5:api:read:2026-08-03T14:23` 不同）。但去重语义变了——旧数据同一分钟内不同 action 会被合并，迁移后不再发生。可接受（历史数据不回溯修改 window_key）。

#### B. share channel 统一

- `entries.py:231`：`channel="api"` → `channel="share"`
- `files.py:188/232/432`：统一走 `_detect_channel(request)`（从 `entries.py` 提取到 `_shared.py` 共享），覆盖 share cookie 场景

#### C. discover 数据可查

保留 discover 探针（list_entries 的曝光统计有价值），加到 admin stats 全局统计（见 Phase 2-D）。不单独加 discover 查询接口——discover 是全局维度，不属于单个 entry。

#### D. 测试修正

`test_get_read_stats_total_count_excludes_self_reads` 改名为 `test_get_read_stats_total_count_includes_self_reads`，或调整断言。在 P1 需求基线明确 total_count 语义。

### Phase 2：聚合表 + 新维度

#### E. 新增 `entry_read_stats` 聚合表

```sql
CREATE TABLE entry_read_stats (
    entry_id        INTEGER PRIMARY KEY,
    total_reads     INTEGER DEFAULT 0,
    unique_readers  INTEGER DEFAULT 0,
    by_action       TEXT DEFAULT '{}',   -- JSON: {"read":12,"raw":3,"download":2,"discover":5}
    by_channel      TEXT DEFAULT '{}',   -- JSON: {"api":14,"mcp":1,"share":1}
    by_source       TEXT DEFAULT '{}',   -- JSON: {"direct":10,"internal":3,"search":2}
    reader_fingerprints TEXT DEFAULT '',  -- 逗号分隔的已见 fingerprint 集合
    last_read_at    TEXT,
    updated_at      TEXT
);
```

- 每个 entry 一行，查询 O(1)
- 写时更新：`record_read()` 时同步更新 `entry_read_stats`
- discover（entry_id=None）不入聚合表（没有对应 entry），只在 admin stats 从原始表查

#### F. `read_stats` 返回 by_action + by_source

`ReadStatsResponse` 新增 `by_action` 和 `by_source` 字段，与现有 `by_channel` 并列。`get_read_stats()` 改读聚合表，不查原始表。

#### G. `unique_readers` 写时更新精度

- `record_read()` 时检查 fingerprint 是否在 `reader_fingerprints` 中，不存在则 `unique_readers += 1` 并追加
- `unique_readers` 排除 self_read（与现状语义一致）
- `reader_fingerprints` 字符串 `in` 检查，单 entry <100 人可接受

#### H. 来源分类

`record_read()` 加 `source` 参数，`_shared.py` 的 `_record_read_async` 从 `request.headers.get("Referer")` 提取并分类：

| 分类 | 判断逻辑 |
|------|----------|
| `internal` | Referer 同域名 |
| `search` | Referer 域名匹配搜索引擎列表 |
| `social` | Referer 域名匹配社交平台列表 |
| `direct` | 无 Referer 或空 |
| `other` | 其他 |

`entry_reads` 表新增 `source` 列。历史数据无 source → 回填时归为 `unknown`。

#### I. 原始事件 90 天清理

- `entry_reads` 保留 90 天，过期删除
- 整合进 `admin_service.cleanup_expired()`
- 新增 `PEEKVIEW_CLEANUP__READS_RETENTION_DAYS`（默认 90）
- 清理后 `entry_read_stats` 不受影响（已聚合）

#### J. Admin stats 加读取维度

`GET /api/v1/admin/stats` 新增读取概览（从 `entry_read_stats` 聚合 + discover 从原始表查）：

```json
{
  "reads": {
    "total": 1505,
    "today": 23,
    "by_action": {"read": 321, "raw": 5, "download": 12, "discover": 1167},
    "by_channel": {"api": 1499, "mcp": 5, "share": 1},
    "by_source": {"direct": 1200, "internal": 200, "search": 50, "unknown": 55}
  }
}
```

#### K. 备份/恢复同步

backup/restore 覆盖 `entry_read_stats` 表（backup 已是整库 SQLite backup，自动覆盖。restore 需确认聚合表正确恢复）。

### Phase 3：迁移

#### L. 迁移策略

- `database.py` `_run_migrations()` 加 `entry_reads.source` 列
- `create_all()` 确保 `entry_read_stats` 表存在
- 启动时检查：`entry_read_stats` 为空且 `entry_reads` 有数据 → 一次性回填
- 回填：从 `entry_reads` 聚合 by_action/by_channel/by_source（source 归 unknown），unique_readers 用 COUNT(DISTINCT reader_fingerprint)，reader_fingerprints 用 GROUP_CONCAT

### Phase 4：删除策略

#### M. 删 entry 时保留聚合统计

**决策**：删 entry 时删原始 `entry_reads`（明细无法查看，entry 元信息已没），**保留 `entry_read_stats` 聚合行**（汇总数字保留，证明"这里曾有流量"）。

`entry_service.py:761/779` 的 `_cleanup_reads(entry_id)` 改为只删 `entry_reads`，不删 `entry_read_stats`。

admin 全局统计的 `total_reads` 包含已删 entry 的历史流量。这是预期行为——存在即合理，流量发生是客观事实。

## 不做

- 注意力/停留时间/滚动深度 — 需前端 heartbeat，是另一个 task
- 时间趋势图（7 天/30 天）— 不是分析平台
- 第三方页面统计（Plausible/Umami）— 放 roadmap
- 读取热力图/地理分布 — 过度设计
- CSV 导出 — 已有 `peekview admin backup`
- display_name null 修复 — T074 已 hotfix
- by_reader_type 维度 — reader_type 已记录但当前不做统计维度，需要时再加
- private/public 维度 — 是 entry 属性不是 read 事件属性，entry 删了就没了，不加到聚合表

## 环境约束

- 后端：SQLModel + SQLite，新增一张表 + 修改 read_tracking_service / admin_service / entry_service / _shared / entries / files / database / config / models
- 前端：无改动（read_stats 通过 API 返回，前端按需展示）
- 配置：新增 `PEEKVIEW_CLEANUP__READS_RETENTION_DAYS`

## 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/peekview/services/read_tracking_service.py` | window_key 加 action；record_read 加 source 参数 + 写时更新聚合表；get_read_stats 改读聚合表；新增 _classify_source |
| `backend/peekview/services/admin_service.py` | cleanup_expired 加清理 entry_reads；get_stats 加读取维度 |
| `backend/peekview/services/entry_service.py` | _cleanup_reads 只删 entry_reads 不删聚合表 |
| `backend/peekview/api/_shared.py` | _record_read_async 从 request 提取 Referer 传 source；_detect_channel 提取到此共享 |
| `backend/peekview/api/entries.py` | share channel 修复（line 231） |
| `backend/peekview/api/files.py` | 三处 channel 统一走 _detect_channel |
| `backend/peekview/models.py` | 新增 EntryReadStats model + 扩展 ReadStatsResponse / AdminStatsResponse |
| `backend/peekview/database.py` | _run_migrations 加 entry_reads.source 列 + 回填逻辑 |
| `backend/peekview/config.py` | PeekCleanup 加 reads_retention_days |
| `backend/tests/test_read_tracking.py` | 修正测试名 + 扩展测试 |
| `backend/tests/test_admin_stats_cleanup.py` | 扩展测试 |
| `backend/tests/test_admin_backup.py` | 扩展测试 |

## 已知风险

- risk=medium：探针修复 + 新表 + 写时更新 + 迁移回填 + 来源分类，5 个子系统交叉
- window_key 格式变化：新旧格式不冲突（unique 约束安全），但历史数据的去重语义不变（不回溯修改）
- 写时更新性能：每次 read 多一次聚合表写（JSON 序列化 + fingerprint 检查）。SQLite 单写者模型，日均几十次无影响
- `unique_readers` 精度：reader_fingerprints 字符串检查在 >500 人时可能变慢。单 entry 通常 <100 人，可接受
- Referer 不可靠：浏览器隐私设置 / Agent 无 Referer → 归 direct。尽力而为
- 迁移正确性：回填必须保证聚合表与原始数据一致，清理必须在聚合之后
- 机制交叉：写入路径 + 查询路径 + 清理 + 备份恢复 + 迁移——必须走完整 agate 不可裁剪

## 验证标准

- window_key 含 action，同一分钟内 read + download 不合并
- share token + 公开 entry channel 记为 "share"
- files.py 的 raw/download/content 通过 share cookie 访问时 channel 记为 "share"
- discover 数据在 admin stats 可查
- `read_stats` 返回 by_action（read/raw/download）和 by_source（direct/internal/search/social/other）
- `entry_read_stats` 表写时更新，`get_read_stats()` 从聚合表读不查原始表
- `unique_readers` 写时更新准确（重复读取者不重复计数，排除 self_read）
- `entry_reads` 表新增 `source` 列，record_read 时从 Referer 分类填充
- 已有 `entry_reads` 数据在启动时回填到 `entry_read_stats`（source 归 unknown）
- 超过 90 天的 `entry_reads` 记录被清理，`entry_read_stats` 不受影响
- 删 entry 时 `entry_reads` 被清理，`entry_read_stats` 聚合行保留
- admin stats 包含 reads.total / reads.today / reads.by_action / reads.by_channel / reads.by_source
- backup/restore 覆盖 `entry_read_stats` 表
- 后端测试全绿
- `make lint` 通过
