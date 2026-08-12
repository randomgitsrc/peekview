---
phase: P1
task_id: T054
type: requirements
parent: P0-brief.md
trace_id: T054-P1-20260714-r1
status: revised
created: 2026-07-14
agent: analyst
---

# T054 P1: 需求基线

## 1. 需求复述

T054 包含 6 个子需求，聚焦后端 API 安全加固和代码风格统一：

- **A. 默认 host 改 127.0.0.1**：`config.py` 中 `PeekServer.host` 默认值从 `0.0.0.0` 改为 `127.0.0.1`，零配置启动不再暴露公网
- **B. 写入端点加显式限流装饰器**：`create_entry`、`update_entry`、`delete_entry` 三个端点加显式 `@limiter.limit()` 装饰器，使限流值可独立于 `default_limits` 调整（当前 `default_limits` 已对所有端点施加 60/分钟限流，显式装饰器优先级更高，可配置更严格的值）
- **C. 移除 passlib 依赖**：`pyproject.toml` 中 `passlib[bcrypt]>=1.7.4` 改为 `bcrypt>=4.0.0`（代码已直接 `import bcrypt`）
- **D. Create 接口幂等保护**：`CreateEntryRequest` 加可选 `idempotency_key`（max_length=128），重复 key 返回已有条目；key 绑定 owner，不同用户用相同 key 返回 409 Conflict
- **E. share_service text() SQL 统一**：2 处 `text()` 风格改为 ORM/构造器风格
- **F. migration 注释文档化**：`_run_migrations()` 加注释说明 `create_all()` 负责建表

## 2. 隐含需求识别

### 2.1 数据维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| ID-1 | idempotency_key 列需要数据库 migration（ALTER TABLE） | 现有数据库无此列，不加 migration 则启动报错或列缺失 |
| ID-2 | idempotency_key 需要唯一索引（UNIQUE constraint） | 并发竞态下两个请求同时用相同 key，没有唯一索引会创建重复条目，破坏幂等语义 |
| ID-3 | Entry 删除时 idempotency_key 自然清除 | key 存在 entries 表上，entry 删除后 key 不复存在；删除后相同 key 允许重新创建（key 随 entry 生命周期） |
| ID-NEW-1 | idempotency_key 列应为 NULL（可选字段），migration 中明确 DEFAULT NULL | 不带 key 的 entry 不应互相冲突 |
| ID-NEW-2 | idempotency_key 输入需 max_length=128 限制 | 防止超长 key 攻击（存储/索引/日志开销） |
| ID-NEW-3 | UNIQUE 约束对 NULL 的行为：SQLite 允许多个 NULL，这是期望行为 | 不带 key 的 entry 互不冲突，只有显式提供 key 时才触发唯一约束 |

### 2.2 多端维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| ID-4 | MCP `createEntry.ts` 需加可选 `idempotency_key` 参数 | MCP 端是 Agent 调用入口，不加参数则 Agent 无法利用幂等保护 |
| ID-5 | MCP `createEntry.ts` 的 Zod schema 和 `inputSchema` 需同步更新 | schema 不加字段则参数被 Zod 丢弃，传了也无效 |
| ID-NEW-4 | MCP `publishFiles` 不暴露 idempotency_key | publishFiles 是 local 模式，语义不同于 remote createEntry（local 模式由 MCP 自行管理文件→entry 映射），不需要幂等 key |
| ID-NEW-5 | MCP client.ts 的 `createEntry` 方法签名需同步更新 | client 层也需传参，否则 tool 层收到参数后无法传递到 API |

### 2.3 边界维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| ID-6 | idempotency_key 并发竞态下不能创建重复条目 | 先查后插存在 TOCTOU 窗口，需保证竞态下仍只创建一个 entry |
| ID-7 | 幂等返回的 HTTP 状态码：新创建 201 vs 幂等命中 200 | 需确保 API 路由层根据幂等命中切换 status_code |
| ID-8 | view_count 递增必须原子且正确 | 改用构造器风格后，递增操作仍需保证原子性 |
| ID-NEW-6 | idempotency_key 为空字符串 `""` 应视为无效输入（422） | 空字符串与不传 key 语义不同，不应静默忽略，应明确拒绝 |
| ID-NEW-7 | idempotency_key 绑定 owner：不同用户用相同 key 应返回 409 Conflict | 防止用户 B 通过相同 key 命中用户 A 的私有 entry，导致信息泄露 |

### 2.4 兼容维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| ID-9 | CLI `--host` help 文本需同步修改 | `cli.py:141` 当前写 `default: 0.0.0.0`，改默认值后 help 文本必须一致 |
| ID-10 | `peekview config list` 的 host 描述需同步 | `cli.py:739` 当前写 `# 绑定地址 (0.0.0.0 为所有接口)`，默认值改后描述应反映新默认值 |
| ID-11 | 已有部署脚本如果依赖默认 `0.0.0.0` 行为，升级后服务变为只监听 localhost | 这是预期行为（安全加固），但需在 CHANGELOG 中明确标注为 breaking change |
| ID-12 | entry 删除后 idempotency_key 可重新使用 | key 随 entry 删除已清除，相同 key 可被后续请求重新使用创建新 entry |

### 2.5 限流范围维度

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| ID-13 | entries 三个写入端点（create/update/delete）加显式限流装饰器 | 显式装饰器优先级高于 default_limits，可独立配置更严格的限流值；当前 default_limits 已提供 60/分钟基础保护，显式装饰器允许针对写入端点设置更严格阈值 |

## 3. BDD 验收条件

### A. 默认 host 改 127.0.0.1

**BDD-A1**: Given 未设置 `PEEKVIEW_SERVER__HOST` 环境变量且无 config.yaml host 配置, When 实例化 `PeekConfig()`, Then `config.server.host` 值为 `"127.0.0.1"`

**BDD-A2**: Given 设置了 `PEEKVIEW_SERVER__HOST=0.0.0.0`, When 实例化 `PeekConfig()`, Then `config.server.host` 值为 `"0.0.0.0"`

**BDD-A3**: Given CLI `--help` 输出, When 查看 `--host` 参数帮助, Then 描述中 default 值显示 `127.0.0.1`

**BDD-A4**: Given `peekview config list` 输出, When 查看 host 配置项描述, Then 描述中包含 `127.0.0.1` 而非 `0.0.0.0`

### B. 写入端点加显式限流装饰器

**BDD-B1**: Given `rate_limit_enabled=True` 且 `rate_limit_per_minute=60`, When 同一 IP 在 1 分钟内对 `POST /api/v1/entries` 发送第 61 次请求, Then 返回 HTTP 429

**BDD-B2**: Given `rate_limit_enabled=True` 且 `rate_limit_per_minute=60`, When 同一 IP 在 1 分钟内对 `POST /api/v1/entries` 发送 60 次以内请求, Then 所有请求正常响应（非 429）

**BDD-B3**: Given `rate_limit_enabled=True` 且 `rate_limit_per_minute=60`, When 同一 IP 在 1 分钟内对 `PUT /api/v1/entries/{slug}` 发送第 61 次请求, Then 返回 HTTP 429

**BDD-B4**: Given `rate_limit_enabled=True` 且 `rate_limit_per_minute=60`, When 同一 IP 在 1 分钟内对 `DELETE /api/v1/entries/{slug}` 发送第 61 次请求, Then 返回 HTTP 429

**BDD-B5**: Given `rate_limit_enabled=False`, When 对 `POST /api/v1/entries` 发送任意次请求, Then 无 429 响应

**BDD-B6**: Given `rate_limit_enabled=True` 且 entries 写入端点有显式 `@limiter.limit()` 装饰器, When 检查装饰器限流值, Then 该值可独立于 `default_limits` 配置（显式装饰器优先级高于 default_limits）

### C. 移除 passlib

**BDD-C1**: Given `pyproject.toml` 的依赖声明, When 检查依赖列表, Then 不包含 `passlib`，包含 `bcrypt>=4.0.0`

**BDD-C2**: Given 已有用户用旧 passlib 间接安装的 bcrypt 生成的哈希密码, When 用新依赖 `bcrypt>=4.0.0` 直接验证该密码, Then 验证成功（向后兼容）

### D. Create 接口幂等保护

**BDD-D1**: Given 请求 `POST /api/v1/entries` 携带 `idempotency_key="abc123"`, When 该 key 首次出现, Then 创建新 entry，返回 HTTP 201，响应体包含 files 列表

**BDD-D2**: Given 已有 entry 的 `idempotency_key="abc123"`, When 同一 owner 再次请求 `POST /api/v1/entries` 携带相同 `idempotency_key="abc123"`, Then 返回已有 entry（相同 slug），HTTP 200，响应体包含 files 列表（与正常创建返回体一致）

**BDD-D3**: Given 数据库中 idempotency_key 列有 UNIQUE 约有 UNIQUE 约束, When 插入时触发 IntegrityError（key 冲突）, Then catch 后查询并返回已有 entry，HTTP 200

**BDD-D4**: Given 请求 `POST /api/v1/entries` 不携带 `idempotency_key`, When 创建 entry, Then 行为与改动前完全一致（每次创建新 entry，HTTP 201）

**BDD-D5**: Given 一个用 `idempotency_key="del-test"` 创建的 entry 已被删除, When 再次用 `idempotency_key="del-test"` 创建, Then 创建新 entry，HTTP 201（key 随 entry 删除已清除）

**BDD-D6**: Given MCP `createEntry` tool 传入 `idempotency_key="test-key"`, When 后端收到请求, Then 请求体包含 `idempotency_key` 字段且值为 `"test-key"`，后端按幂等逻辑处理（首次创建 201 / 已有返回 200）

**BDD-D7**: Given 用户 A 用 `idempotency_key="shared-key"` 创建了 entry, When 用户 B 用相同 `idempotency_key="shared-key"` 请求创建, Then 返回 HTTP 409 Conflict（key 绑定 owner，不同用户不可命中同一 key）

**BDD-D8**: Given 请求 `POST /api/v1/entries` 携带 `idempotency_key=""`（空字符串）, When 后端处理请求, Then 返回 HTTP 422（空字符串视为无效输入）

**BDD-D9**: Given 请求 `POST /api/v1/entries` 携带 `idempotency_key` 长度超过 128 字符, When 后端处理请求, Then 返回 HTTP 422（超出 max_length 限制）

**BDD-D10**: Given 多个 entry 不携带 `idempotency_key`（数据库中 key 列为 NULL）, When 查询数据库, Then 多个 NULL 值不触发 UNIQUE 冲突（SQLite 允许多个 NULL）

### E. share_service text() SQL 统一

**BDD-E1**: Given `share_service.py` 代码, When 检查所有 SQL 查询, Then 不存在 `text()` 风格的查询（全部使用 ORM `select()` 或 SQLAlchemy `update()` 构造器）

**BDD-E2**: Given share token 验证成功且当前 view_count=N, When 验证完成后重新查询该 share, Then view_count=N+1

### F. migration 注释

**BDD-F1**: Given `_run_migrations()` 函数顶部, When 检查前 10 行注释, Then 包含关键词 `create_all` 和 `ALTER TABLE`

## 4. 待确认清单

所有待确认项已由主 Agent 决定，无残留。

| 原编号 | 决定 |
|--------|------|
| NC-1 | 采纳 (b)：entries 三个写入端点（create/update/delete）加限流 |
| NC-2 | 采纳 P0 方案：key 随 entry 生命周期，删除后可重用 |

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

| 阶段 | 裁剪 | 理由 |
|------|------|------|
| P0 | ✅ 已完成 | 主 Agent 已写 P0-brief |
| P1 | ✅ 当前 | 需求基线 |
| P2 | 保留 | idempotency_key 并发处理和 view_count update() 兼容性需要设计方案 |
| P3 | 保留 | idempotency key 逻辑和限流需要测试覆盖 |
| P4 | 保留 | 代码实现 |
| P5 | 保留 | pytest 验证 |
| P6 | 简化 | 纯后端改动，无需 Playwright 截图，但涉及 schema 变更和安全相关，BDD 逐条实跑 |
| P7 | 保留 | 涉及 backend + MCP 两个 package 改动，需跨包一致性检查 |
| P8 | 保留 | 需 bump 版本 + CHANGELOG（默认 host 改动是 breaking change） |

## 6. 范围声明

```yaml
packages:
  - backend/peekview/          # 6 个子需求全部涉及
  - packages/mcp-server/       # D 需求的 MCP 端改动（createEntry tool + client）

domains:
  - api-safety      # A(默认host) + B(限流) + C(passlib移除)
  - idempotency     # D(幂等保护)
  - code-style      # E(text()统一) + F(migration注释)

risk_level: medium
# 理由：默认 host 改动是 breaking change（影响现有部署），idempotency_key 需要 migration
# 但改动范围小且向后兼容（key 可选），限流和 passlib 移除风险低
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: backend-testing
    why: P5/P6 需要 pytest 验证幂等逻辑、限流、migration
    available:
      - "backend/.venv Python + pytest (autouse conftest 隔离)"
      - "make test-quick"
    status: available

  - need: debug-backend
    why: P6 验收需要运行中的 debug backend 做 curl 验证
    available:
      - "make debug-start (:8888, /tmp/peekview-debug/)"
    status: available

  - need: mcp-testing
    why: D 需求的 MCP 端改动需要验证
    available:
      - "make test-mcp-unit"
    status: available
```
