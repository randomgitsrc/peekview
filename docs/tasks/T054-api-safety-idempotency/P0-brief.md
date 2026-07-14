---
phase: P0
task_id: T054
task_name: api-safety-idempotency
type: brief
trace_id: T054-P0-20260714
created: 2026-07-14
status: draft
parent: 调研报告安全建议 + Agent 重试痛点 + 代码风格清理
---

# T054: 后端 API 安全加固 + 幂等 + 代码风格

## 任务简报

### 需求 A：默认 host 改 127.0.0.1

**问题**：默认 `PEEKVIEW_SERVER__HOST=0.0.0.0`，零配置启动即监听所有接口，匿名可公开发布条目。用户 `peekview serve` 即暴露公网。

**方案**：`config.py` 中 `PeekServer.host` 默认值从 `0.0.0.0` 改为 `127.0.0.1`。公网暴露需显式 `peekview serve -h 0.0.0.0` 或配置 `PEEKVIEW_SERVER__HOST=0.0.0.0`。

**改动**：1 行默认值。

### 需求 B：写入端点补限流

**问题**：`POST /api/v1/entries` 创建端点无限流。仅 login/register/captcha 有限流装饰器。

**方案**：在 `entries.py` 的 `create_entry` 端点加 `@limiter.limit()` 装饰器，复用 `rate_limit_per_minute` 配置值。

**改动**：1-2 行装饰器。

### 需求 C：移除 passlib，直接依赖 bcrypt

**问题**：`pyproject.toml` 声明 `passlib[bcrypt]>=1.7.4`，但代码从未 `import passlib`，直接 `import bcrypt`。passlib 5 年无更新（事实性废弃），只是作为 bcrypt 的间接安装通道。

**方案**：`pyproject.toml` 中 `passlib[bcrypt]>=1.7.4` 改为 `bcrypt>=4.0.0`。代码无需改动。

**改动**：1 行依赖声明。

### 需求 D：Create 接口 idempotency key

**问题**：Agent 网络超时重试 `POST /api/v1/entries` 时，每次都创建新条目（自动 slug 每次不同）。无任何幂等保护。

**方案**：
1. `CreateEntryRequest` 加可选 `idempotency_key: str | None` 字段
2. `Entry` 模型加 `idempotency_key: str | None` 列 + 唯一索引
3. `create_entry` 中先查 key 是否存在，存在则返回已有条目（200 而非 201）
4. MCP `createEntry` tool 加可选 `idempotency_key` 参数
5. idempotency_key 清理：条目删除时 key 自然清除，无需额外 TTL

### 需求 E：share_service text() SQL 统一

**问题**：`share_service.py` 中 6 处 ORM 风格 + 2 处 `text()` 风格混用。

**方案**：
- `SELECT COUNT(*)` 改为 `select(func.count()).select_from(EntryShare).where(...)`
- `UPDATE view_count += 1` 改用 SQLAlchemy `update()` 构造器（保持原子性）

**改动**：约 10 行。

### 需求 F：migration 注释文档化

**问题**：`entry_shares`、`entry_reads` 表无独立 migration，依赖 `create_all()` 隐式创建，缺乏历史可追溯性。

**方案**：在 `_run_migrations()` 顶部加注释说明 `create_all()` 负责建表、migration 只处理 ALTER。

**改动**：3-5 行注释。

## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 后端 `python3 -m ruff check` + `pytest` CI 强制

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 默认 host 改 127.0.0.1 | 现有公网部署启动脚本可能依赖默认值 | 配置文件/环境变量优先级高于默认值，已显式配置的不受影响 |
| idempotency_key 加列 | 需要 migration | 复用现有 `_run_migrations()` 模式 |
| view_count 递增改用 update() 构造器 | SQLModel 的 `session.exec()` 对 SQLAlchemy core `update()` 的返回值处理需确认 | 单独测试验证 |

## 裁剪倾向

- P3（TDD）保留：idempotency key 逻辑需要测试覆盖
- P6（验收）简化：纯后端改动，无需 Playwright 截图，pytest + curl 验证即可
- P7（一致性）可裁剪：改动集中后端，无跨包影响（MCP 侧改动极小）

## packages

- `backend/peekview/`：config.py、api/entries.py、services/entry_service.py、services/share_service.py、models.py、database.py、cli.py
- `packages/mcp-server/src/tools/`：createEntry.ts

## domains

- `api-safety`：默认 host + 限流 + passlib 移除
- `idempotency`：Create 接口幂等保护
- `code-style`：text() SQL 统一 + migration 注释
