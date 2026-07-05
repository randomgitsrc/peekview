---
phase: P1
task_id: T032-entry-read-tracking
type: requirements
parent: P0-brief.md
trace_id: T032-P1-20260630
status: draft
created: 2026-06-30
---

# T032 需求基线：Entry 读取路径埋点

## 1. 需求复述

给 PeekView 的 entry 读取路径加最小探针，记录三个维度：

1. **读取者身份**：是否非创建者、是否不同 API key / 用户
2. **读取频率**：每个 entry 被读取的次数和时间分布
3. **读取方式**：API 直接调用 vs MCP 代理 vs Share 链接

**目的**：这些数据是判断"多 Agent 总线"愿景是否成立的唯一信号源。半年零信号 → 总线降级；出现信号 → 按真实形状加强。当前完全无数据，无法决策。

**范围**：仅限读取路径的探针埋入，不含分析面板的完整实现（但须预留数据查询接口）。

## 2. 隐含需求识别

### 2.1 数据：新表 + 聚合策略

**必须**：需要一个新 SQLite 表存储读取事件。现有 `EntryShare.view_count` 是 share-scoped 的计数器，不记录读取者身份、时间和方式，无法复用。

**为什么必须**：P0 明确要求"记录读取者身份、频率、方式"，现有数据模型无法满足任何一个维度。

### 2.2 数据：高频写入的聚合/采样

**必须**：设计聚合策略，防止高频读取（如 Agent 循环 poll）产生海量行。

**为什么必须**：SQLite WAL 单写者模型下，每次读取写一行会串行化读请求。即使异步写，数据量增长也需要处理。P0 已识别此风险。

### 2.3 后端：异步写入不阻塞 API 响应

**必须**：读取埋点的写入不能在请求关键路径上同步执行。

**为什么必须**：P0 明确要求"读取埋点不能影响 API 响应速度"。埋点是探针，不是业务逻辑，不应增加读取延迟。

### 2.4 后端：所有读取入口统一埋点

**必须**：以下路径都必须触发埋点：
- `GET /api/v1/entries/{slug}`（API 直接读取 + MCP getEntry）
- `GET /api/v1/entries`（列表 + MCP listEntries）
- `GET /api/v1/entries/{slug}/raw`（Agent raw 读取）
- Share 链接访问（`?share=` token + cookie）

**为什么必须**：遗漏任何路径都会导致信号失真。MCP 读取走 HTTP API，所以 API 层埋点自动覆盖 MCP——但须在记录中区分来源。

### 2.5 后端：读取方式标识（channel）

**必须**：埋点须区分读取来源：`api` | `mcp` | `share` | `cli`。

**为什么必须**：P0 要求"记录读取方式"。不同来源的读取行为模式完全不同——MCP 高频 poll vs Share 人肉点击 vs API 一次性调用。

**隐含**：MCP 和 API 走同一个 HTTP 端点，需从请求特征推断来源。方案选项：
- A) MCP client 传 `X-PeekView-Source: mcp` header（需改 MCP server）
- B) 后端从 User-Agent / auth 方式推断
- C) 混合：MCP 主动声明 + 后端 fallback 推断

### 2.6 后端：list_entries 的读取埋点语义

**必须**：明确 `list_entries` 是否算"读取"以及如何记录。

**为什么必须**：list 返回多条 entry 的摘要，P0 提到 MCP listEntries 也需埋点。但 list 对"哪个 entry 被读"是模糊的——是所有返回的 entry 都算被读？还是 list 本身算一种"发现"行为？

**初步判定**：list 操作记为 `discover` 类型（区别于 `read`），只记录 list 事件本身（含查询参数），不逐一为返回的 entry 记录 read。这样数据量可控，且 list 和 get 的语义不混淆。

### 2.7 前端：读取数据的展示

**必须**：owner 在 entry 详情页能看到自己 entry 的读取统计。

**为什么必须**：如果数据采集了但没人能看，等于没采。至少需要最小的展示面：entry 详情页显示"被读取 N 次（API x, MCP y, Share z）"。

**隐含**：需要 API 端点返回 entry 的读取统计。`GET /api/v1/entries/{slug}` 的响应可扩展 `read_stats` 字段（仅 owner/admin 可见）。

### 2.8 前端：匿名读取的计数

**必须**：匿名用户读取公开 entry 也须计数。

**为什么必须**：公开 entry 的匿名读取是真实信号，不计数会严重低估。匿名无法记录 reader_id，但须记录 `reader_type=anonymous` 和读取事件。

### 2.9 多端：MCP server 需配合传递来源标识

**必须**：MCP server 的 HTTP 请求需标识自身为 MCP 来源。

**为什么必须**：见 2.5。当前 MCP client.ts 的请求不带任何来源标识，后端无法区分 MCP 和直接 API 调用。

### 2.10 兼容：不破坏现有 API 响应和性能

**必须**：埋点纯增量——不改变现有 API 响应 schema（除非显式新增可选字段），不增加可观测的延迟。

**为什么必须**：埋点是观察者，不是参与者。破坏现有行为会失去用户信任。

## 3. BDD 验收条件

### B01: API 读取 entry 记录读取事件

- **Given** 一个公开 entry 存在
- **When** 通过 `GET /api/v1/entries/{slug}` 读取该 entry
- **Then** 读取事件被记录，包含 `entry_id`、`channel=api`、`reader_type`（authenticated/anonymous）、`reader_id`（如有）、`read_at` 时间戳

### B02: MCP 读取 entry 记录 channel=mcp

- **Given** MCP server 配置了 `X-PeekView-Source: mcp` header
- **When** MCP getEntry 读取一个 entry
- **Then** 读取事件被记录，`channel=mcp`

### B03: Share 链接访问记录 channel=share

- **Given** 一个私有 entry 有有效的 share token
- **When** 通过 `?share={token}` 访问该 entry
- **Then** 读取事件被记录，`channel=share`

### B04: 非创建者读取被标识

- **Given** 用户 A 创建了一个 entry，用户 B 拥有读取权限
- **When** 用户 B 读取该 entry
- **Then** 读取事件记录 `is_self_read=false`，`reader_id=B`

### B05: 创建者读取自己的 entry 被标识

- **Given** 用户 A 创建了一个 entry
- **When** 用户 A 读取自己的 entry
- **Then** 读取事件记录 `is_self_read=true`，`reader_id=A`

### B06: 匿名读取公开 entry 被计数

- **Given** 一个公开 entry 存在
- **When** 无认证的请求读取该 entry
- **Then** 读取事件被记录，`reader_type=anonymous`，`reader_id=null`

### B07: 读取埋点不阻塞 API 响应

- **Given** 读取事件记录采用异步写入
- **When** 并发读取请求发生
- **Then** API 响应时间与无埋点时相比无可观测差异（<5ms 增加）

### B08: 高频读取的聚合/采样

- **Given** 同一 reader 在短时间内对同一 entry 发起多次读取（如 1 分钟内 60 次）
- **When** 读取事件被记录
- **Then** 不是每次读取都生成独立行，而是按时间窗口聚合（如同 1 分钟窗口内同一 reader+entry 只记录 count）

### B09: Owner 可查看 entry 读取统计

- **Given** 用户 A 是 entry 的 owner，该 entry 有若干读取记录
- **When** 用户 A 请求 `GET /api/v1/entries/{slug}`
- **Then** 响应中包含 `read_stats` 字段，含 `total_count`、按 channel 分组的计数、`unique_readers`（非创建者去重计数）

### B10: 非 owner 无法看到读取统计

- **Given** 用户 B 不是 entry 的 owner
- **When** 用户 B 请求 `GET /api/v1/entries/{slug}`
- **Then** 响应中不包含 `read_stats` 字段（或该字段为 null）

### B11: list 操作记录 discover 事件

- **Given** 用户通过 `GET /api/v1/entries` 列出 entry
- **When** 列表请求返回结果
- **Then** 记录一个 `action=discover` 事件（含查询参数），不为每个返回的 entry 逐一记录 read

### B12: /raw 端点读取也记录

- **Given** 一个 entry 存在
- **When** 通过 `GET /api/v1/entries/{slug}/raw` 读取
- **Then** 读取事件被记录，`action=read`，`channel=api`（或根据来源推断）

### B13: 读取统计 API 端点

- **Given** owner 或 admin 需要查询 entry 的读取历史
- **When** 请求 `GET /api/v1/entries/{slug}/reads`
- **Then** 返回该 entry 的读取事件列表（分页），含时间、channel、reader_type、is_self_read

### B14: MCP listEntries 记录 discover + channel=mcp

- **Given** MCP server 发起 listEntries 调用
- **When** 列表请求完成
- **Then** 记录 `action=discover`，`channel=mcp`

## 4. 待确认清单

（无 [NEED_CONFIRM] 项。所有隐含需求已根据 P0 方向和现有架构做出合理判定。）

关键判定依据：
- **list 语义**：记录 discover 事件而非逐一 read，避免数据膨胀且语义更清晰
- **channel 识别**：MCP 主动声明 header + 后端 fallback 推断，是最小侵入方案
- **聚合窗口**：1 分钟窗口内同一 reader+entry 合并计数，平衡精度与存储
- **前端展示**：最小展示（read_stats 字段），不做分析面板——面板留给后续数据驱动决策

## 5. 裁剪说明

```
phases: [P1, P2, P3, P4, P5, P6]
```

| 阶段 | 跳过？ | 理由 |
|------|--------|------|
| P1 | 否 | 需求基线——当前阶段 |
| P2 | 否 | 存储方案（表设计 vs 聚合策略）+ 异步写入机制需设计 |
| P3 | 否 | 新 service + 新 API 端点 + MCP 改动，需 TDD |
| P4 | 否 | 实现阶段 |
| P5 | 否 | 异步写入正确性、聚合精度、并发安全性需验证 |
| P6 | 否 | 跨端（后端+前端+MCP），需实跑验收 |
| P7 | 否 | 涉及 models.py + entry_service + MCP client + 前端 store，多文件一致性需检查 |
| P8 | 否 | 后端版本需 bump（新 API 端点 + schema 变更），MCP 版本独立 |

## 6. 范围声明

```yaml
packages:
  - peekview        # 后端：新表、新 service、新 API 端点、entry_service 改动
  - @peekview/mcp-server  # MCP client：添加 X-PeekView-Source header

domains:
  - backend         # 新表 entry_reads、ReadTrackingService、/reads 端点
  - api             # GET /entries/{slug}/reads 新端点、现有端点埋点调用
  - frontend        # EntryDetailView 显示 read_stats
  - mcp             # client.ts 添加来源标识 header

ui_affected:
  - EntryDetailView  # owner 可见 read_stats（读取次数 + channel 分布）
  - (无新页面)

gate_commands:
  - "cd backend && .venv/bin/python -m pytest tests/ -v --tb=short"
  - "cd frontend-v3 && npx vue-tsc --noEmit"
  - "make test-mcp-unit"
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: backend-testing
    why: 新 service + API 端点的单元/集成测试
    available:
      - pytest + conftest.py（autouse 隔离）
    status: available

  - need: mcp-testing
    why: MCP client header 改动的单元测试
    available:
      - make test-mcp-unit
    status: available

  - need: browser-vision
    why: P6 验收需截图验证 read_stats 在 entry 详情页的展示
    available:
      - playwright-cdp skill
      - vision-analyst（agate 内置执行角色）
    status: available

  - need: performance-verification
    why: 验证异步写入不阻塞 API 响应（B07）
    available:
      - pytest + time measurement
      - debug backend (:8888)
    status: available
```
