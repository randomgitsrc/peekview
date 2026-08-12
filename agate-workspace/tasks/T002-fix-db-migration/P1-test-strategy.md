---
phase: P1
task_id: T002
task_name: fix-db-migration
type: test-strategy
trace_id: T002-P1-20250611
created: 2026-06-11
status: draft
parent: T002/P1-problems.md
---

# P1：测试策略 — 数据库迁移机制修复

## 测试类型标注

| 问题 | 测试类型 | 理由 |
|------|----------|------|
| Issue 1: CLI 崩溃 | 单元 + 集成 | CLI 逻辑可单元测试；与 DB 交互需集成测试 |
| Issue 2: 迁移权责错位 | 单元 + 集成 | `init_db` 行为变更需单元测试；Server/CLI 交互需集成 |
| Issue 3: 未来列兼容 | 单元 | 纯逻辑验证，无需端到端 |
| AC1: 重启后修复 | E2E / 手工 | 涉及真实 Server 进程生命周期 |
| AC2: 自动补列 | 单元 | Mock Server 启动场景 |
| AC3: CLI 不崩溃 | 集成 + E2E | 需要真实 DB + Server |
| AC4: 升级指引 | 单元 | 纯输出验证 |
| AC5: 新库完整 | 单元 | 现有测试已有覆盖 |
| AC6: 超时重试 | 单元 | Mock 锁超时场景 |

## 测试层级

```
       ┌─────────┐
       │  E2E    │ ← Playwright: 完整 Server 启动 → CLI 访问 流程
       ├─────────┤
       │ 集成测试 │ ← pytest + temp dir: Server 生命周期 + CLI 交互
       ├─────────┤
       │ 单元测试 │ ← pytest: init_db / check_schema / _run_migrations 独立验证
       └─────────┘
```

## 关键风险

| 风险 | 缓解措施 |
|------|----------|
| `ALTER TABLE` 在 WAL 模式下的锁行为可能因 SQLite 版本而异 | 测试覆盖 Python 3.12 捆绑的 SQLite 版本 |
| 集成测试需要模拟 Server 运行状态 | 使用独立临时目录，各自启动 uvicorn 进程 |
| 时序列测试（Server 先启动，CLI 后访问）需串行执行 | 放在单独的测试文件，避免并行冲突 |
