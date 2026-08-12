---
phase: P1
task_id: T054
type: dispatch-context
created: 2026-07-14
---

# T054 P1 Dispatch Context

## 任务上下文

T054 包含 6 个子需求（A-F），涉及后端 API 安全加固、幂等保护、代码风格统一。

## 主 Agent 已查证的客观信息

### 需求 A：默认 host
- `config.py:152` — `PeekServer.host` 默认值 `"0.0.0.0"`
- `cli.py:141` — CLI `--host` help 文本写 `default: 0.0.0.0`，需同步修改
- 改动范围：config.py 1 行 + cli.py 1 行 help 文本

### 需求 B：写入端点限流
- `api/entries.py:131` — `create_entry` 无 `@limiter` 装饰器
- `api/auth.py:36,122` — login/register 已有 `@limiter.limit(login_rate_limit)` 装饰器
- `api/captcha_router.py:29,45,59` — captcha 已有限流
- 限流装饰器模式：`@limiter.limit(rate_limit_var)` + 从 `request.app.state.config` 读取配置
- 其他写入端点（update_entry, delete_entry）也应考虑是否加限流

### 需求 C：passlib → bcrypt
- `pyproject.toml` 声明 `passlib[bcrypt]>=1.7.4`
- 代码中无 `import passlib`，直接 `import bcrypt`
- 改动：pyproject.toml 1 行

### 需求 D：idempotency key
- `models.py` — `Entry` 模型需加 `idempotency_key` 列
- `models.py` — `CreateEntryRequest` 需加 `idempotency_key` 字段
- `services/entry_service.py` — `create_entry` 需加 key 查重逻辑
- `database.py` — `_run_migrations()` 需加 ALTER TABLE 添加列
- `packages/mcp-server/src/tools/createEntry.ts` — 需加可选参数
- 需考虑：key 的唯一索引、并发创建竞态、key 清理策略

### 需求 E：share_service text() SQL
- `share_service.py:68-74` — `SELECT COUNT(*)` 用 `text()` 风格
- `share_service.py:222-228` — `UPDATE view_count += 1` 用 `text()` 风格
- 其余 6 处用 ORM `select()` 风格
- view_count 递增需保持原子性（SQLAlchemy `update()` 构造器或 F() 表达式）

### 需求 F：migration 注释
- `database.py` — `_run_migrations()` 函数
- entry_shares / entry_reads 表依赖 `create_all()` 隐式创建

## 关注点

1. idempotency key 的并发竞态处理（两个请求同时用相同 key）
2. 默认 host 改 127.0.0.1 的向后兼容影响（CLI help、文档、现有部署脚本）
3. 限流范围：只加 create_entry 还是所有写入端点
4. view_count 原子递增改用 update() 构造器时 SQLModel session.exec() 的兼容性
