---
phase: P0
task_id: T078
task_name: read-tracking-hardening
type: brief
trace_id: T078-P0-20260728
created: 2026-07-28
status: draft
parent: 探针数据统计不准 + 查询性能 + 数据膨胀
---

## 任务简述

强化 PeekView 的读取追踪系统：新增聚合表（O(1) 查询）、扩展统计维度（by_action）、原始事件定期清理（防膨胀）、admin stats 加全局读取概览。

## 背景痛点

1. **查询性能隐患**：`get_read_stats()` 每次对 `entry_reads` 表做 `SUM`/`COUNT(DISTINCT)`，数据量增长后查询变慢
2. **统计维度缺失**：`read_stats` 只按 channel 分，不按 action（read/raw/download/discover）分，无法区分"人看详情页"和"Agent 读 raw"
3. **数据膨胀**：`entry_reads` 表只增不减，长期运行会膨胀
4. **全局统计缺失**：admin stats 只统计 entry/user 数量，没有读取维度

## 任务范围

### A. 新增 `entry_read_stats` 聚合表

```sql
CREATE TABLE entry_read_stats (
    entry_id        INTEGER PRIMARY KEY,
    total_reads     INTEGER DEFAULT 0,
    unique_readers  INTEGER DEFAULT 0,
    by_action       TEXT DEFAULT '{}',   -- JSON: {"read":12,"raw":3,"download":2,"discover":5}
    by_channel      TEXT DEFAULT '{}',   -- JSON: {"api":14,"mcp":1,"share":1}
    last_read_at    TEXT,
    updated_at      TEXT
);
```

- 每个 entry 只有一行，查询 O(1)
- 写时更新：`record_read()` 时同时更新 `entry_read_stats`
- 迁移：应用启动时检查 `entry_read_stats` 是否为空，空则从 `entry_reads` 回填

### B. `read_stats` 返回 `by_action`

`ReadStatsResponse` 新增 `by_action` 字段，与现有 `by_channel` 并列：

```json
{
  "total_count": 15,
  "unique_readers": 3,
  "by_action": {
    "read": 8,
    "raw": 3,
    "download": 2,
    "discover": 5
  },
  "by_channel": {
    "api": 14,
    "mcp": 1
  },
  "last_read_at": "2026-07-28T13:45:22"
}
```

### C. 原始事件清理

- `entry_reads` 表保留 90 天原始事件，过期删除
- 整合进 `admin_service.cleanup_expired()`（已有定时清理机制）
- 新增配置项 `PEEKVIEW_CLEANUP__READS_RETENTION_DAYS`（默认 90）
- 清理前确保 `entry_read_stats` 已聚合（先聚合后清理，不丢数据）

### D. Admin stats 加读取维度

`GET /api/v1/admin/stats` 返回新增：

```json
{
  "total_entries": 50,
  "total_users": 5,
  "total_reads": 1505,
  "reads_today": 23,
  "reads_by_action": {"read": 321, "raw": 5, "download": 12, "discover": 1188},
  "reads_by_channel": {"api": 1499, "mcp": 5, "share": 1}
}
```

### E. 迁移策略

- `database.py` 的 `create_all()` 确保 `entry_read_stats` 表存在
- 启动时检查：如果 `entry_read_stats` 为空且 `entry_reads` 有数据，执行一次性回填
- 回填逻辑：`INSERT INTO entry_read_stats SELECT entry_id, SUM(count), ... FROM entry_reads GROUP BY entry_id`
- 回填完成后日志记录

## 不做

- 时间趋势图（7 天/30 天）— 不是分析平台
- 第三方页面统计（Plausible/Umami）— 放 roadmap，可选配置
- 读取热力图/地理分布 — 过度设计
- CSV 导出 — 已有 `peekview admin backup`

## 环境约束

- 后端：SQLModel + SQLite，新增一张表 + 修改 read_tracking_service
- 前端：无改动（read_stats 通过 API 返回，前端按需展示）
- 配置：新增 `PEEKVIEW_CLEANUP__READS_RETENTION_DAYS`

## 已知风险

- risk=medium：新增表 + 写时更新逻辑 + 迁移回填
- 写时更新性能：每次 read 多一次 `entry_read_stats` 写操作。SQLite 单写者模型下，日均几十次读取无影响
- 回填数据量：当前 740 行 entry_reads，回填瞬间完成。但大量历史数据时可能需要批量处理
- `by_action`/`by_channel` 用 JSON 存储：SQLite 没有原生 JSON 字段类型，查询不如关系型灵活。但当前只做整行读取不做 JSON 内查询，够用

## 裁剪倾向

- P1 不可裁（评审：聚合表设计 + 写时更新策略 + 清理时机）
- P2 必须走（聚合表 schema + 迁移策略 + 清理配置需设计）
- P3 保留（聚合逻辑 + 清理逻辑 + 迁移回填需要测试覆盖）
- P5 验证：后端测试（聚合正确性 + 清理 + 迁移）
- P6 验收：read_stats 返回 by_action + admin stats 有读取维度 + 原始事件 90 天后清理
- P7 一致性：database.py + read_tracking_service + admin_service + config + models

## 验证标准

- `read_stats` 返回 `by_action` 字段，包含 read/raw/download/discover 四种 action
- `entry_read_stats` 表写时更新，`get_read_stats()` 从聚合表读不查原始表
- 已有 `entry_reads` 数据在启动时回填到 `entry_read_stats`
- 超过 90 天的 `entry_reads` 记录被清理
- 清理后 `entry_read_stats` 数据不受影响
- admin stats 包含 `total_reads`、`reads_today`、`reads_by_action`、`reads_by_channel`
- 后端测试全绿
- `make lint` 通过
