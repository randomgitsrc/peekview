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

强化 PeekView 的读取追踪系统：新增聚合表（O(1) 查询）、扩展统计维度（by_action + by_source）、原始事件定期清理（防膨胀）、admin stats 加全局读取概览。顺手修复 T068 预存失败（display_name 清空发 `""` 不发 `null`）。

## 背景痛点

1. **查询性能隐患**：`get_read_stats()` 每次对 `entry_reads` 表做 `SUM`/`COUNT(DISTINCT)`，数据量增长后查询变慢
2. **统计维度缺失**：`read_stats` 只按 channel 分，不按 action（read/raw/download/discover）分，无法区分"人看详情页"和"Agent 读 raw"；也不按来源（source）分，不知道"从哪里来的"
3. **数据膨胀**：`entry_reads` 表只增不减，长期运行会膨胀
4. **全局统计缺失**：admin stats 只统计 entry/user 数量，没有读取维度
5. **T068 预存失败**：Account Settings 清空 display_name 时 PATCH 发 `""` 不发 `null`，后端不认为字段被清空

## 任务范围

### A. 新增 `entry_read_stats` 聚合表

```sql
CREATE TABLE entry_read_stats (
    entry_id        INTEGER PRIMARY KEY,
    total_reads     INTEGER DEFAULT 0,
    unique_readers  INTEGER DEFAULT 0,
    by_action       TEXT DEFAULT '{}',   -- JSON: {"read":12,"raw":3,"download":2,"discover":5}
    by_channel      TEXT DEFAULT '{}',   -- JSON: {"api":14,"mcp":1,"share":1}
    by_source       TEXT DEFAULT '{}',   -- JSON: {"direct":10,"internal":3,"search":2}
    last_read_at    TEXT,
    updated_at      TEXT
);
```

- 每个 entry 只有一行，查询 O(1)
- 写时更新：`record_read()` 时同时更新 `entry_read_stats`
- 迁移：应用启动时检查 `entry_read_stats` 是否为空，空则从 `entry_reads` 回填

### B. `read_stats` 返回 `by_action` + `by_source`

`ReadStatsResponse` 新增 `by_action` 和 `by_source` 字段，与现有 `by_channel` 并列：

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
  "by_source": {
    "direct": 10,
    "internal": 3,
    "search": 2
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
  "reads_by_channel": {"api": 1499, "mcp": 5, "share": 1},
  "reads_by_source": {"direct": 1200, "internal": 200, "search": 50, "unknown": 55}
}
```

### E. 来源分类逻辑

`record_read()` 时从 HTTP Referer header 解析来源，分类为 `source` 字段存入 `entry_reads`：

| 分类 | 判断逻辑 | 示例 |
|------|----------|------|
| `internal` | Referer 同域名（`request.url.hostname` 匹配） | Explore 列表 → 详情页 |
| `search` | Referer 域名匹配搜索引擎列表（google/bing/baidu/duckduckgo/yandex） | Google 搜索 → 详情页 |
| `social` | Referer 域名匹配社交平台列表（slack/discord/wechat/telegram/twitter） | Slack 聊天 → 详情页 |
| `direct` | 无 Referer 或空 Referer | 浏览器直接输入 URL、书签、Agent API 调用 |
| `other` | 其他来源 | 未知网站 |

实现位置：`read_tracking_service.py` 新增 `_classify_source(referer: str | None, host: str) -> str` 函数。T082 后 `read_tracking_service` 通过 `app.state.read_tracking_service` 注入，`record_read()` 调用方（`_shared.py` 的 `_record_read_async`）通过 `request.app.state` 获取。若需修改 `record_read()` 签名（加 referer/source 参数），沿注入链路修改即可。

`entry_reads` 表新增 `source` 列（string, nullable）。历史数据无 source → 回填时归为 `unknown`。

### F. `unique_readers` 写时更新精度

写时更新 `unique_readers` 时，不能简单 `+1`——新读取者可能已存在。策略：

- `entry_read_stats` 表新增 `reader_fingerprints` 列（TEXT，存储逗号分隔的已见 fingerprint 集合，或空格分隔）
- `record_read()` 时：检查 fingerprint 是否在 `reader_fingerprints` 中，不存在则 `unique_readers += 1` 并追加
- 性能：`reader_fingerprints` 字符串用 `in` 检查，单 entry 读取者通常 <100 人，O(N) 可接受
- 替代方案：用 `SET` 语义（逗号分隔字符串 + `str.split(",")` 检查），避免额外表

### G. 备份/恢复同步

- `admin_service.backup()` 导出 `entry_read_stats` 表数据
- `admin_service.restore()` 导入 `entry_read_stats` 并重建
- `AdminStatsResponse` 新增 `read_stats_imported` 字段
- T082 后 `AdminService` 已通过构造注入 `entry_service`，访问 `entry_read_stats` 走注入链路，不再内部 new

### I. display_name null 修复（T074 合并）

T068 预存失败：前端 `AccountSettings.vue` 表单提交时，空字符串字段序列化为 `""`，后端 `PATCH /auth/me` 的 Pydantic schema 区分 `None`（未传/清空）和 `""`（空字符串），导致清空操作不生效。

修复：前端提交时，空字符串 display_name 转为 `null`。或后端 schema 将 `""` 视为清空。择一实现。

### H. 迁移策略

- `database.py` 的 `create_all()` 确保 `entry_read_stats` 表存在，`entry_reads` 表新增 `source` 列
- 启动时检查：如果 `entry_read_stats` 为空且 `entry_reads` 有数据，执行一次性回填
- 回填逻辑：从 `entry_reads` 聚合计算 `by_action`/`by_channel`/`by_source`（历史无 source 归为 `unknown`），`unique_readers` 用 `COUNT(DISTINCT reader_fingerprint)`，`reader_fingerprints` 用 `GROUP_CONCAT`
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

- risk=medium：新增表 + 写时更新逻辑 + 迁移回填 + 来源分类
- 写时更新性能：每次 read 多一次 `entry_read_stats` 写操作（含 JSON 序列化 + fingerprint 检查）。SQLite 单写者模型下，日均几十次读取无影响
- `unique_readers` 精度：`reader_fingerprints` 字符串检查在读取者很多时（>500）可能变慢。但单 entry 读取者通常 <100 人，可接受
- Referer 不可靠：浏览器可能不发 Referer（隐私设置/DNT），Agent API 调用无 Referer → 归为 `direct`。来源统计是尽力而为，不是精确值
- 回填数据量：当前 740 行 entry_reads，回填瞬间完成。但大量历史数据时可能需要批量处理
- `by_action`/`by_channel`/`by_source` 用 JSON 存储：SQLite 没有原生 JSON 字段类型，查询不如关系型灵活。但当前只做整行读取不做 JSON 内查询，够用

## 验证标准

- `read_stats` 返回 `by_action` 字段（read/raw/download/discover）和 `by_source` 字段（direct/internal/search/social/other/unknown）
- `entry_read_stats` 表写时更新，`get_read_stats()` 从聚合表读不查原始表
- `unique_readers` 写时更新准确（重复读取者不重复计数）
- `entry_reads` 表新增 `source` 列，`record_read()` 时从 Referer 分类填充
- 已有 `entry_reads` 数据在启动时回填到 `entry_read_stats`（source 归为 unknown）
- 超过 90 天的 `entry_reads` 记录被清理
- 清理后 `entry_read_stats` 数据不受影响
- admin stats 包含 `total_reads`、`reads_today`、`reads_by_action`、`reads_by_channel`、`reads_by_source`
- backup/restore 覆盖 `entry_read_stats` 表
- display_name 清空后 PATCH 发 `null` 非 `""`，T068 预存失败用例通过
- 后端测试全绿
- `make lint` 通过
