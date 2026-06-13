---
phase: P1
task_id: T006
task_name: admin-stats-cleanup
type: requirements
trace_id: T006-P1-20260613
created: 2026-06-13
status: draft
parent: docs/plans/admin-capability-improvements.md
---

# T006 admin-stats-cleanup — P1 需求基线

## 1. 需求复述

### FEAT-1: `peekview admin stats` 系统统计

为管理员提供系统级统计视图，包括用户数、entry 数（公开/私有/总数）、磁盘占用、DB 文件大小。需同时提供后端 API 端点（`GET /api/v1/admin/stats`）和 CLI 命令（`peekview admin stats`），CLI 支持 `--json-output` 和 Rich 表格格式。

### FEAT-5: `peekview admin cleanup` 手动清理

允许管理员手动触发过期 entry 清理（目前仅靠后台定时器 `cleanup.interval_seconds`），返回清理数量和释放空间。需同时提供后端 API 端点（`POST /api/v1/admin/cleanup`）和 CLI 命令（`peekview admin cleanup`）。

## 2. 隐含需求识别

### 2.1 stats 统计指标的完整性

| # | 隐含需求 | 为什么必须 |
|---|----------|-----------|
| S-1 | stats 应包含 **expired vs active entry 数**（`entries.expired` / `entries.active`） | 管理员需区分"总数中多少已过期但未清理"与"仍活跃的"，否则无法判断是否需要手动 cleanup。仅给 public/private/total 不够——过期 entry 虽然还在 DB 里但已不可访问，这是运维关键指标 |
| S-2 | stats 应包含 **最近 entry 创建时间**（`entries.latest_created_at`） | 管理员判断系统是否还在被使用，最近创建时间比总数更有意义 |
| S-3 | stats 应包含 **API key 数**（`api_keys.total` / `api_keys.expired`） | API key 是系统认证面的一部分，运维需知道有多少 key 在用、多少已过期，属于安全审计指标 |
| S-4 | stats 端点响应时间必须 ≤ 500ms（正常负载下） | stats 涉及 DB 聚合 + 磁盘 stat，数据量大时可能慢；必须约束性能 |

### 2.2 cleanup 端点的语义和安全性

| # | 隐含需求 | 为什么必须 |
|---|----------|-----------|
| C-1 | cleanup 返回应包含 **被删 entry 的 slug 列表**（`deleted_slugs`） | 仅返回数量不够——管理员需确认"哪些被删了"，防止误删或排查问题。slug 列表比 ID 更可读 |
| C-2 | cleanup 端点必须 **幂等**：重复调用返回 `deleted_count: 0`，不报错 | 后台定时器和手动调用可能并发，幂等保证安全性。当前 `delete_entry` 已是幂等的（entry 不存在不报错），cleanup 复用同一逻辑即可 |
| C-3 | cleanup 返回应包含 **释放的磁盘空间**（`freed_mb`） | 计划文档明确要求"释放了多少磁盘空间"；实现时需在删除前后计算 data_dir 大小差值，或在逐 entry 删除时累加 |
| C-4 | cleanup 应与后台定时器 **互斥或可并发** | 如果后台定时器正在清理，手动 cleanup 不应冲突。由于 SQLite WAL 模式 + 行级锁，并发 cleanup 不会导致数据损坏，但可能重复工作。标记为可接受（幂等保证安全） |

### 2.3 架构和路由组织

| # | 隐含需求 | 为什么必须 |
|---|----------|-----------|
| A-1 | 新建 `api/admin.py` 路由文件，挂载为 `/api/v1/admin/*` | 现有路由文件按资源分（entries/files/auth/apikeys），admin 是独立关注点。新建 admin.py 让后续 FEAT-2/3/6 等也有归属，避免散落各处 |
| A-2 | 两个端点均使用 `require_admin` 依赖守卫 | T005 已实现 `require_admin`（`auth.py:211`），必须复用，保持一致。非管理员访问返回 403 |
| A-3 | stats/cleanup 端点不额外 rate limiting | admin 端点仅管理员可达，攻击面极小；且 stats 是只读、cleanup 是低频运维操作。适用全局默认限速即可，不设特殊限速 |
| A-4 | CLI 需新建 `admin` 子命令组 | 当前 CLI 有 `user`/`service`/`config`/`apikey`/`api` 子命令组，无 `admin` 组。新增 `@cli.group(name="admin")` 后，stats/cleanup/disk-usage 等后续命令都挂其下 |
| A-5 | CLI admin 命令需支持 **本地模式**（直接操作 DB）和 **远程模式**（HTTP API） | 现有 `user create/list` 等命令支持本地模式（直接 Session 操作），`apikey` 命令仅远程模式。admin 命令应同时支持两种模式：本地模式直接用 service 层，远程模式通过 PeekClient 调 HTTP API |
| A-6 | PeekClient 需新增 `admin_stats()` 和 `admin_cleanup()` 方法 | 远程模式下 CLI 需通过 PeekClient 调用 API，当前 client.py 无这些方法 |

### 2.4 多端一致性

| # | 隐含需求 | 为什么必须 |
|---|----------|-----------|
| M-1 | 不涉及前端改动 | 计划文档明确排除前端；stats/cleanup 是纯运维功能 |
| M-2 | 不涉及 MCP Server 改动 | 计划文档明确批次 1-2 不涉及 MCP；MCP agent 通常不需要 admin 级操作 |

### 2.5 数据和兼容性

| # | 隐含需求 | 为什么必须 |
|---|----------|-----------|
| D-1 | stats 端点对 DB 无副作用（纯 SELECT + 磁盘 stat） | 只读操作，不影响现有数据 |
| D-2 | cleanup 复用已有 `delete_entry` 逻辑（含 FTS5 同步删除、磁盘文件删除） | `entry_service.delete_entry` 已处理 FTS5 + 磁盘文件清理，必须复用，不能另写删除逻辑 |
| D-3 | 不破坏现有行为 | 新增端点 + 新增 CLI 子命令组，不修改已有路由/命令，零兼容风险 |

## 3. BDD 验收条件

### FEAT-1: admin stats

```
STATS-1: 管理员可获取系统统计
  Given 系统中存在 3 个用户、42 个 entry（30 public / 12 private / 5 expired）
  When 管理员发送 GET /api/v1/admin/stats
  Then 返回 200，body 包含:
    - users: 3
    - entries.total: 42
    - entries.public: 30
    - entries.private: 12
    - entries.expired: 5
    - entries.active: 37
    - entries.latest_created_at: <最新 entry 的 created_at>
    - api_keys.total: <int>
    - api_keys.expired: <int>
    - storage.data_dir_mb: <float>
    - storage.db_mb: <float>

STATS-2: 非管理员被拒绝
  Given 普通用户（is_admin=False）已认证
  When 发送 GET /api/v1/admin/stats
  Then 返回 403 FORBIDDEN

STATS-3: 未认证用户被拒绝
  Given 未认证请求
  When 发送 GET /api/v1/admin/stats
  Then 返回 401 NOT_AUTHENTICATED

STATS-4: CLI admin stats 本地模式
  Given 本地模式（无 --remote-url）
  When 执行 peekview admin stats
  Then 输出 Rich 表格包含 users/entries/storage 行

STATS-5: CLI admin stats 远程模式
  Given 远程模式（--remote-url 已配置）
  When 执行 peekview admin stats --remote-url <url>
  Then 通过 HTTP API 获取统计并输出

STATS-6: CLI admin stats JSON 输出
  When 执行 peekview admin stats --json-output
  Then 输出合法 JSON，字段与 API 响应一致

STATS-7: 空系统统计
  Given 系统无用户、无 entry、无 API key
  When 管理员发送 GET /api/v1/admin/stats
  Then 返回 200，users=0, entries.total=0, api_keys.total=0, storage 值为实际磁盘大小

STATS-8: stats 性能约束
  Given 系统有 1000 个 entry
  When 管理员发送 GET /api/v1/admin/stats
  Then 响应时间 ≤ 500ms
```

### FEAT-5: admin cleanup

```
CLEANUP-1: 管理员可触发过期 entry 清理
  Given 系统中存在 3 个已过期 entry（expires_at < now）
  When 管理员发送 POST /api/v1/admin/cleanup
  Then 返回 200，body 包含:
    - deleted_count: 3
    - deleted_slugs: [<slug1>, <slug2>, <slug3>]
    - freed_mb: <float>
  And 过期 entry 从 DB 和磁盘中被删除
  And FTS5 索引中对应记录被清除

CLEANUP-2: 无过期 entry 时 cleanup 幂等
  Given 系统中无过期 entry
  When 管理员发送 POST /api/v1/admin/cleanup
  Then 返回 200，deleted_count=0, deleted_slugs=[], freed_mb=0.0

CLEANUP-3: 重复调用 cleanup 幂等
  Given 系统中有 2 个过期 entry
  When 管理员连续两次发送 POST /api/v1/admin/cleanup
  Then 第一次返回 deleted_count=2
  And 第二次返回 deleted_count=0

CLEANUP-4: 非管理员被拒绝
  Given 普通用户（is_admin=False）已认证
  When 发送 POST /api/v1/admin/cleanup
  Then 返回 403 FORBIDDEN

CLEANUP-5: 未认证用户被拒绝
  Given 未认证请求
  When 发送 POST /api/v1/admin/cleanup
  Then 返回 401 NOT_AUTHENTICATED

CLEANUP-6: CLI admin cleanup 本地模式
  Given 本地模式，系统中有 1 个过期 entry
  When 执行 peekview admin cleanup
  Then 输出 "Cleaned up 1 expired entry(ies)" 和释放空间

CLEANUP-7: CLI admin cleanup 远程模式
  Given 远程模式
  When 执行 peekview admin cleanup --remote-url <url>
  Then 通过 HTTP API 触发清理并输出结果

CLEANUP-8: cleanup 不删除未过期 entry
  Given 系统中有 1 个未过期 entry 和 1 个已过期 entry
  When 管理员发送 POST /api/v1/admin/cleanup
  Then 返回 deleted_count=1
  And 未过期 entry 仍存在
```

## 4. 待确认清单

（无未决项。以下问题在分析过程中已自行判定，理由如下：）

| 问题 | 判定 | 理由 |
|------|------|------|
| stats 要不要包含 expired/active 区分？ | 是（S-1） | 过期 entry 未清理仍在 DB，运维需区分活跃 vs 过期；字段成本低 |
| cleanup 要不要返回 slug 列表？ | 是（C-1） | 数量不够可读，slug 列表是标准做法；列表大小受 entry 数限制，实际不会很大 |
| admin 命令组放哪里？ | 新建 `admin` 子命令组（A-4） | 与 `user`/`service`/`config` 同级，语义清晰，后续扩展方便 |
| 新建路由文件还是复用？ | 新建 `api/admin.py`（A-1） | admin 是独立关注点，与 entries/files/auth 路由正交 |
| cleanup 是否需要与定时器互斥？ | 否（C-4） | SQLite WAL + 幂等删除保证安全，互斥锁增加复杂度无收益 |

## 5. 裁剪说明

**任务复杂度**：小（2 个 API 端点 + 2 个 CLI 命令，无前端/MCP 改动，复用已有 require_admin 和 delete_entry 逻辑）

**阶段裁剪**：

| 阶段 | 是否执行 | 理由 |
|------|----------|------|
| P1 | ✅ | 当前阶段——需求基线 |
| P2 | ✅ | 需设计 API schema、service 方法签名、CLI 子命令组结构；虽小但多端（API+CLI+Client）需协调 |
| P3 | ⏭️ 跳过 | 小任务，测试用例可在 P5 直接编写；无需独立 TDD 阶段 |
| P4 | ✅ | 实现阶段 |
| P5 | ✅ | 验证 BDD 条件逐条通过 |
| P6 | ⏭️ 跳过 | 无前端改动、无 MCP 改动、无跨包发布；一致性检查无增量价值 |
| P7 | ⏭️ 跳过 | 随下个常规版本发布，无需独立发布准备 |

**phases: [P1, P2, P4, P5]**

## 6. 范围声明

- **packages**: `peekview`（PyPI patch 版本升级）
- **domains**: `backend`（API 路由 + service 方法 + CLI 命令 + PeekClient 方法）
- **ui_affected**: 无
