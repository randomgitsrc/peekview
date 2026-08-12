---
phase: P1
task_id: T078-read-tracking-hardening
type: problems
parent: P0-brief.md
trace_id: T078-P1-20260803
status: draft
created: 2026-08-03
agent: analyst
---

## 1. 需求复述

T078 要解决的是"读取追踪系统"的准确性、性能、维度和数据生命周期四个层面的问题：

1. **探针准确性**：现有 9 个探针调用点存在 window_key 跨 action 合并、share channel 错误记录、discover 数据无法查询、files.py 三处不走 `_detect_channel()` 等准确性缺陷，导致统计基础数据就是错的。
2. **查询性能**：`get_read_stats()` 每次对 `entry_reads` 原始表做 `SUM`/`COUNT(DISTINCT)`，数据增长后查询变慢。需要聚合表实现 O(1) 查询。
3. **统计维度缺失**：只有 `by_channel`，缺少 `by_action`（read/raw/download/discover）和 `by_source`（direct/internal/search/social/other）。
4. **数据生命周期**：`entry_reads` 表只增不减，需要 90 天清理；删 entry 时应保留聚合统计（流量发生是客观事实）。

修完后，admin stats 应能展示全局读取概览（含 discover 数据），entry owner 能看到准确的 by_action / by_source 统计，原始事件 90 天自动清理且聚合统计不受影响。

## 2. 隐含需求识别

### 数据维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| IR-1 | `entry_reads` 表新增 `source` 列，需 migration ALTER TABLE | by_source 维度依赖 source 字段；历史数据无此列会导致查询报错 |
| IR-2 | `entry_read_stats` 聚合表是新表，需 `create_all()` 确保 schema 存在 | 新表不存在时写时更新会报错；get_read_stats 改读聚合表也会报错 |
| IR-3 | 启动时回填：`entry_read_stats` 为空且 `entry_reads` 有数据 → 一次性聚合回填 | 现有数据不回填 → 聚合表为空 → get_read_stats 返回全 0 → 历史数据"消失" |
| IR-4 | 回填时 source 归为 `unknown`（历史数据无 Referer 信息） | 不能凭空编造来源分类，`unknown` 是诚实的占位 |
| IR-5 | 回填时 `reader_fingerprints` 用 `GROUP_CONCAT` 拼接，`unique_readers` 用 `COUNT(DISTINCT reader_fingerprint)` | 聚合表需要与原始数据一致的 unique_readers 值 |

### 前端维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| IR-6 | 前端无改动 | P0-brief 明确"前端：无改动（read_stats 通过 API 返回，前端按需展示）"。ReadStatsResponse 新增字段（by_action/by_source）对前端是可选字段，不影响现有展示。 |

### 多端维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| IR-7 | MCP 端无需同步改动 | MCP 不直接操作 read tracking；探针在 API 层 `_record_read_async` 中自动触发。MCP 请求带 `X-PeekView-Source: mcp` header，`_detect_channel` 已能识别。 |
| IR-8 | CLI 端无需同步改动 | CLI 不暴露 read stats 查询接口；admin CLI 的 `peekview admin stats` 走 admin API，自动获得新字段。 |

### 边界维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| IR-9 | window_key 格式变化后，旧数据不回溯修改 | 旧格式 `eid:fp:channel:ts` 和新格式 `eid:fp:channel:action:ts` 的 unique 约束不冲突（字符串不同）。历史数据的去重语义已发生（同分钟不同 action 被合并），回溯修改会破坏已提交的 count 值。 |
| IR-10 | discover（entry_id=None）不入聚合表 | 聚合表 PK 是 entry_id，None 无法作为 PK。discover 是全局维度，只在 admin stats 从原始表查。 |
| IR-11 | `unique_readers` 写时更新：检查 fingerprint 是否在 `reader_fingerprints` 字符串中 | 避免每次 read 都做 COUNT(DISTINCT)；单 entry <100 人时字符串 `in` 检查性能可接受 |
| IR-12 | `unique_readers` 排除 self_read（与现状语义一致） | 现有 `get_read_stats` 的 unique_count 查询条件含 `is_self_read = 0`，聚合表必须保持同样语义 |
| IR-13 | 90 天清理 entry_reads 后，`get_read_events`（明细列表）只能查 90 天内的数据 | 清理后原始记录不存在了；`get_read_stats`（聚合统计）是全量的（从聚合表读） |
| IR-14 | 清理必须在聚合之后 | 如果先清理原始表再回填聚合表，数据会丢失。回填在启动时一次性完成，清理在 cleanup_expired 中定期执行，时序上安全 |
| IR-15 | `PEEKVIEW_CLEANUP__READS_RETENTION_DAYS` 默认 90 | 与 `archive_retention_days` 默认 90 对齐 |
| IR-16 | `reader_fingerprints` 字符串检查在 >500 人时可能变慢 | 已知风险，单 entry 通常 <100 人，可接受。不在本任务优化范围 |

### 兼容维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| IR-17 | backup 已是整库 SQLite backup，自动覆盖 `entry_read_stats` | 无需额外改动；新表随数据库一起备份 |
| IR-18 | restore merge 路径需导入 `entry_read_stats` 行 | restore merge 是逐表逐行导入；如果不导入 `entry_read_stats`，恢复后聚合表为空，get_read_stats 返回全 0 |
| IR-19 | restore replace 路径是整库替换，自动覆盖 `entry_read_stats` | 无需额外改动 |
| IR-20 | `_cleanup_reads` 改为只删 `entry_reads`，不删 `entry_read_stats` | 删 entry 时保留聚合行（用户已确认决策）；改 `_cleanup_reads` 实现 |

### 测试维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| IR-21 | `test_get_read_stats_total_count_excludes_self_reads` 测试名与断言矛盾需修正 | 函数名说 excludes，断言 total_count==4（含 self_read）。需明确 total_count 语义并修正测试名。 |
| IR-22 | 需新增 share cookie 访问 files.py 端点的 channel 测试 | files.py 三处 channel 修复后需验证 share cookie 场景 channel 记为 "share" |
| IR-23 | 需新增聚合表写时更新、回填、90 天清理、删除策略的测试 | 新功能必须有测试覆盖 |

## 3. 关键质疑点回答

### Q1：window_key 加 action 后，旧数据的去重语义变化

**回答**：不回溯修改历史数据是合理的。理由：
- 旧格式 `eid:fp:channel:ts` 和新格式 `eid:fp:channel:action:ts` 字符串不同，unique 约束不冲突
- 历史数据的 count 值已提交，回溯修改会破坏数据一致性
- 影响范围有限：同一分钟内同一人同一 channel 先 read 后 download 的场景较少
- 聚合表回填时，历史数据按现有 window_key 聚合，by_action 统计对历史数据有已知偏差（同分钟不同 action 被合并），这是可接受的已知限制

### Q2：discover 数据是否需要 BDD 验证

**回答**：需要 BDD 验证 discover 数据在 admin stats 可查。理由：
- discover 数据目前"记了白记"——没有任何接口能查到
- P0-brief 明确"加到 admin stats 全局统计"
- 这是一个可二值判定的行为：admin stats 的 reads 维度是否包含 discover action 的计数

### Q3：total_count 语义

**回答**：`total_count` **包含** self_read。理由：
- 现有代码 `get_read_stats` 的 `total_count` 查询是 `SUM(count) WHERE entry_id=X`，无 `is_self_read` 过滤 → 含 self_read
- 现有测试断言 `total_count == 4`（4 条记录含 1 条 self_read）→ 含 self_read
- `unique_readers` 排除 self_read（查询条件含 `is_self_read = 0`）
- 语义：total_count = 总读取次数（含自己），unique_readers = 独立访客数（排除自己）
- 需修正测试名：`test_get_read_stats_total_count_excludes_self_reads` → `test_get_read_stats_total_count_includes_self_reads`

### Q4：get_file_content 的 action="read" 是否需要区分

**回答**：不区分，保持 action="read"。理由：
- get_file_content 是查看文件内容，语义上是"读"
- P0-brief 明确"不改"
- 与 entry 详情页 read 混在一起是可接受的——两者都是"阅读行为"
- 如果未来需要区分，可以通过 channel 或新增 action 区分，但不是本任务范围

### Q5：90 天清理与聚合表的关系是否需要 BDD 明确

**回答**：需要 BDD 明确。理由：
- 这是一个可二值判定的行为：清理后 `get_read_stats` 应返回与清理前相同的值（从聚合表读），`get_read_events` 应返回更少的记录（从原始表读）
- 清理后聚合表不受影响是核心设计约束，必须有 BDD 验证

### Q6：backup/restore 是否需要单独 BDD

**回答**：需要 BDD 验证 restore 后聚合表正确恢复。理由：
- backup 是整库 backup，自动覆盖聚合表，无需单独验证
- restore merge 是逐行导入，如果不导入 `entry_read_stats`，恢复后聚合表为空 → 需要 BDD 验证 restore merge 后聚合表有数据
- restore replace 是整库替换，自动覆盖 → 需要 BDD 验证 restore replace 后聚合表有数据

## 4. BDD 验收条件

### 探针准确性 — window_key

#### BDD-01: window_key 含 action，同一分钟内 read + download 不合并
- Given 一个 entry（entry_id=1），一个已认证用户（reader_id=5），entry owner_id=10
- When 在同一分钟内先 record_read(action="read", channel="api") 再 record_read(action="download", channel="api")
- Then entry_reads 表中有 2 条记录，action 分别为 "read" 和 "download"，每条 count=1

#### BDD-02: window_key 含 action，同一分钟内相同 action 仍合并
- Given 一个 entry（entry_id=1），一个已认证用户（reader_id=5）
- When 在同一分钟内 record_read(action="read", channel="api") 连续调用 3 次
- Then entry_reads 表中有 1 条记录，action="read"，count=3

### 探针准确性 — share channel

#### BDD-03: 公开 entry 带 share token 访问时 channel 记为 "share"
- Given 一个公开 entry，owner 创建了一个 share link
- When 匿名用户带 `?share={token}` 访问 GET /api/v1/entries/{slug}
- Then entry_reads 中记录的 channel 为 "share"

#### BDD-04: share cookie 访问 download_file 时 channel 记为 "share"
- Given 一个私有 entry，owner 创建了 share link，匿名用户通过 share link 获得了 share cookie
- When 匿名用户带 share cookie 访问 GET /api/v1/entries/{slug}/files/{file_id}
- Then entry_reads 中记录的 channel 为 "share"

#### BDD-05: share cookie 访问 get_file_content 时 channel 记为 "share"
- Given 一个私有 entry，匿名用户持有有效 share cookie
- When 匿名用户带 share cookie 访问 GET /api/v1/entries/{slug}/files/{file_id}/content
- Then entry_reads 中记录的 channel 为 "share"

#### BDD-06: share cookie 访问 get_entry_raw 时 channel 记为 "share"
- Given 一个私有 entry，匿名用户持有有效 share cookie
- When 匿名用户带 share cookie 访问 GET /api/v1/entries/{slug}/raw
- Then entry_reads 中记录的 channel 为 "share"

### 探针准确性 — discover 数据可查

#### BDD-07: admin stats 包含 discover action 的读取计数
- Given 系统中有 discover 事件（list_entries 触发的 action="discover"）
- When admin 调用 GET /api/v1/admin/stats
- Then 响应的 reads.by_action 中包含 "discover" 键且值 > 0

#### BDD-31: discover 事件不创建 entry_read_stats 聚合行
- Given 系统中有 discover 事件（list_entries 触发，entry_id=None）
- When record_read 被调用（action="discover", entry_id=None）
- Then entry_read_stats 表中不新增任何行（entry_id=None 不入聚合表）

### 统计维度 — by_action

#### BDD-08: read_stats 返回 by_action 维度
- Given 一个 entry 有 read、raw、download 三种 action 的读取记录
- When owner 调用 GET /api/v1/entries/{slug}（include_read_stats=true）
- Then read_stats.by_action 包含 "read"、"raw"、"download" 三个键，值与原始数据一致

### 统计维度 — by_source

#### BDD-09: read_stats 返回 by_source 维度
- Given 一个 entry 有来自不同 Referer 的读取记录
- When owner 调用 GET /api/v1/entries/{slug}（include_read_stats=true）
- Then read_stats.by_source 包含来源分类键（direct/internal/search/social/other 中的至少一个）

#### BDD-10: 无 Referer 时 source 归为 "direct"
- Given 一个无 Referer 的请求
- When record_read 被调用
- Then entry_reads 中记录的 source 为 "direct"

#### BDD-11: 同域名 Referer 时 source 归为 "internal"
- Given 一个 Referer 域名与请求域名相同的请求
- When record_read 被调用
- Then entry_reads 中记录的 source 为 "internal"

#### BDD-32: 搜索引擎 Referer 时 source 归为 "search"
- Given 一个 Referer 域名匹配搜索引擎列表的请求（如 https://www.google.com/）
- When record_read 被调用
- Then entry_reads 中记录的 source 为 "search"

#### BDD-33: 社交平台 Referer 时 source 归为 "social"
- Given 一个 Referer 域名匹配社交平台列表的请求（如 https://twitter.com/）
- When record_read 被调用
- Then entry_reads 中记录的 source 为 "social"

#### BDD-34: 其他 Referer 时 source 归为 "other"
- Given 一个 Referer 域名不匹配搜索引擎/社交平台列表且非同域名的请求（如 https://example.com/）
- When record_read 被调用
- Then entry_reads 中记录的 source 为 "other"

### 聚合表 — 写时更新

#### BDD-12: record_read 时同步更新 entry_read_stats 聚合表
- Given 一个 entry（entry_id=1）的 entry_read_stats 聚合行为初始状态（total_reads=0）
- When record_read(entry_id=1, action="read", channel="api") 被调用
- Then entry_read_stats 中 entry_id=1 的行 total_reads 增加 1，by_action 中 "read" 增加 1，by_channel 中 "api" 增加 1

#### BDD-13: unique_readers 写时更新，重复读取者不重复计数
- Given 一个 entry 的 entry_read_stats 中 unique_readers=1，reader_fingerprints="u:5"
- When reader_id=5 再次读取（同一 fingerprint "u:5"）
- Then unique_readers 仍为 1（不增加），reader_fingerprints 不变

#### BDD-14: unique_readers 写时更新，新读取者计数增加
- Given 一个 entry 的 entry_read_stats 中 unique_readers=1，reader_fingerprints="u:5"
- When reader_id=6（fingerprint "u:6"）首次读取
- Then unique_readers 变为 2，reader_fingerprints 追加 "u:6"

#### BDD-15: unique_readers 排除 self_read
- Given 一个 entry owner_id=10
- When owner（reader_id=10）读取自己的 entry
- Then entry_read_stats 的 unique_readers 不增加，reader_fingerprints 不追加 owner 的 fingerprint

#### BDD-16: get_read_stats 从聚合表读取，不查原始表
- Given 一个 entry 的 entry_read_stats 聚合行有数据，entry_reads 原始表也有数据
- When 调用 get_read_stats(entry_id=X)
- Then 返回的 total_count、unique_readers、by_action、by_channel、by_source 与聚合表数据一致（不从原始表实时聚合）

### 聚合表 — 回填

#### BDD-17: 启动时 entry_read_stats 为空且 entry_reads 有数据则回填
- Given 数据库中 entry_reads 有数据，entry_read_stats 为空（首次升级）
- When 应用启动（init_db + 回填逻辑执行）
- Then entry_read_stats 中每个有读取记录的 entry 都有对应的聚合行，total_reads/by_action/by_channel 与原始数据聚合一致，source 归为 "unknown"

#### BDD-18: 启动时 entry_read_stats 已有数据则不回填
- Given 数据库中 entry_read_stats 已有数据
- When 应用启动
- Then entry_read_stats 数据不被重新回填（幂等）

### 迁移 — source 列

#### BDD-19: entry_reads 表新增 source 列
- Given 一个已存在的数据库（entry_reads 表无 source 列）
- When _run_migrations 执行
- Then entry_reads 表新增 source 列，默认值为 NULL（历史记录 source 为 NULL，回填时由 BDD-17 覆盖设为 "unknown"）

### 90 天清理

#### BDD-20: 超过 90 天的 entry_reads 记录被清理
- Given entry_reads 表中有一条 read_at 为 91 天前的记录
- When cleanup_expired 执行（reads_retention_days=90）
- Then 该 entry_reads 记录被删除

#### BDD-21: 清理 entry_reads 后 entry_read_stats 不受影响
- Given entry_reads 表中有旧记录，entry_read_stats 聚合表有对应数据
- When cleanup_expired 清理了旧 entry_reads 记录
- Then entry_read_stats 中的 total_reads、by_action、by_channel、by_source 值不变

#### BDD-22: 清理后 get_read_events 只返回剩余记录
- Given entry_reads 表中有 91 天前的记录和 10 天前的记录
- When cleanup_expired 执行（reads_retention_days=90）后调用 get_read_events(entry_id=X)
- Then 返回的 items 只包含 10 天前的记录（91 天前的已被清理删除）

#### BDD-23: PEEKVIEW_CLEANUP__READS_RETENTION_DAYS 可配置
- Given 设置 PEEKVIEW_CLEANUP__READS_RETENTION_DAYS=30
- When entry_reads 表中有 31 天前的记录
- Then cleanup_expired 执行后该记录被删除

### 删除策略

#### BDD-24: 删 entry 时删除 entry_reads 原始记录
- Given 一个 entry 有读取记录
- When 该 entry 被删除
- Then entry_reads 中该 entry_id 的所有记录被删除

#### BDD-25: 删 entry 时保留 entry_read_stats 聚合行
- Given 一个 entry 有 entry_read_stats 聚合行
- When 该 entry 被删除
- Then entry_read_stats 中该 entry_id 的聚合行仍然存在（不被删除）

### Admin stats 读取维度

#### BDD-26: admin stats 包含 reads 维度
- Given 系统中有读取记录（含 discover）
- When admin 调用 GET /api/v1/admin/stats
- Then 响应包含 reads 字段，含 total、today、by_action、by_channel、by_source 子字段

#### BDD-27: admin stats reads.total 包含已删 entry 的历史流量
- Given 一个 entry 被删除前有读取记录，删除时保留了 entry_read_stats 聚合行
- When admin 调用 GET /api/v1/admin/stats
- Then reads.total 包含该已删 entry 的历史流量计数

### Backup/Restore

#### BDD-28: restore merge 后 entry_read_stats 有数据
- Given 一个 backup 包含 entry_read_stats 数据
- When 执行 restore（merge 模式）
- Then 恢复后 entry_read_stats 表有数据，与 backup 中的聚合统计一致

#### BDD-29: restore replace 后 entry_read_stats 有数据
- Given 一个 backup 包含 entry_read_stats 数据
- When 执行 restore（replace 模式）
- Then 恢复后 entry_read_stats 表有数据，与 backup 中的聚合统计一致

### 测试修正

#### BDD-30: total_count 语义为包含 self_read
- Given 一个 entry 有 3 条非 self_read 记录和 1 条 self_read 记录
- When 调用 get_read_stats(entry_id=X)
- Then total_count == 4（含 self_read），unique_readers 排除 self_read 的 reader

## 5. 待确认清单

[NO_NEED_CONFIRM]

所有关键质疑点已在第 3 节回答，P0-brief 的决策（不回溯 window_key / discover 加到 admin stats / total_count 含 self_read / get_file_content 不改 action / 90 天清理聚合表不受影响 / backup-restore 覆盖聚合表）均经代码审计确认合理，无需人定方向。

## 6. 裁剪说明

```yaml
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

**不可裁剪阶段及理由**：

- **P2（方案设计）不可裁**：涉及新表 schema 设计、写时更新策略、迁移回填逻辑、source 分类逻辑，方案设计直接影响实现正确性。
- **P3（TDD 测试）不可裁**：risk=medium，涉及数据 schema 变更和写时更新，必须有 TDD 红灯保证实现正确。现有测试有矛盾点（test_get_read_stats_total_count_excludes_self_reads），需先修测试再写代码。
- **P5（技术验证）不可裁**：涉及 5 个子系统交叉（写入路径/查询路径/清理/备份恢复/迁移），必须跑全量测试套件验证。
- **P6（验收）不可裁**：30 条 BDD 验收条件需逐条实跑验证，涉及数据一致性（聚合表 vs 原始表）、迁移正确性、清理时序等关键行为。
- **P7（一致性检查）不可裁**：涉及 12 个文件的改动，需跨文件交叉核对。
- **P8（发布准备）不可裁**：涉及 schema 变更，需版本/CHANGELOG 双路径检查。

**可裁剪阶段**：无。本任务 risk=medium + 5 子系统交叉 + 机制交叉（写入+查询+清理+备份恢复+迁移），必须走完整 agate。

## 7. 范围声明

```yaml
domains:
  - backend
  - api
  - security
  - database
  - config

packages:
  - backend/peekview/services/read_tracking_service.py
  - backend/peekview/services/admin_service.py
  - backend/peekview/services/entry_service.py
  - backend/peekview/api/_shared.py
  - backend/peekview/api/entries.py
  - backend/peekview/api/files.py
  - backend/peekview/models.py
  - backend/peekview/database.py
  - backend/peekview/config.py
  - backend/tests/test_read_tracking.py
  - backend/tests/test_admin_stats_cleanup.py
  - backend/tests/test_admin_backup.py
```

**domains 说明**：
- `backend`：核心业务逻辑改动（read_tracking_service / admin_service / entry_service）
- `api`：API 层探针修复（entries.py / files.py / _shared.py）
- `security`：share channel 修复涉及访问来源正确性（share cookie 场景的 channel 记录）
- `database`：新增表 + 列迁移 + 回填逻辑
- `config`：新增 PEEKVIEW_CLEANUP__READS_RETENTION_DAYS 配置项

**不涉及**：frontend、mcp、cli（P0-brief 明确前端无改动，MCP/CLI 无需同步）

## 8. 能力需求声明

```yaml
capability_requirements: []
```

本任务纯后端，无浏览器行为/安全模型/外部系统依赖。所有 BDD 验收条件可通过 pytest 单元测试 + API 集成测试验证，无需特殊能力。

[PROD_NOT_TOUCHED]
