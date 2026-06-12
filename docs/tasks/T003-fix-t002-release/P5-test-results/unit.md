---
phase: P5
task_id: T003-fix-t002-release
parent: T003-P4/P4-implementation.md
trace_id: T003-P5-20260612
---

# P5 单元测试结果 — T002 发布准备收尾

## 测试命令

```bash
make pre-publish-quick
```

内部执行: `cd backend && python3 -m pytest tests/ -v --tb=short`

## 结果摘要

| 指标 | 数值 |
|------|------|
| 收集 | 487 |
| 通过 | 486 |
| 失败 | **0** |
| 跳过 | 1 |
| 警告 | 7 |
| 耗时 | 56.56s |
| 退出码 | 0 |

## 跳过详情

| 测试 | 原因 |
|------|------|
| `TestApiKeyAuthBypass::test_timing_attack_resistance` | 预先存在的 skip（非本次引入）|

## 警告详情

| 文件 | 类型 | 说明 |
|------|------|------|
| `test_cli_remote.py` | `PytestUnknownMarkWarning` | `integration` marker 未注册（预存）|
| `test_auth.py` (6) | `DeprecationWarning` | httpx per-request cookies 弃用（预存）|

## 迁移测试 (T002 范围)

14/14 通过，全部在 `test_migration.py` — 验证 T002 改动无回归。

## 门禁判定

**failed=0** → 门槛通过。
