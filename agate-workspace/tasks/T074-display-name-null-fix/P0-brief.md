---
phase: P0
task_id: T074
task_name: display-name-null-fix
type: brief
trace_id: T074-P0-20260728
created: 2026-07-28
status: draft
parent: T068 预存失败
---

## 任务简述

Account Settings 页清空 display_name 时，前端 PATCH 请求发送 `""`（空字符串）而非 `null`，导致后端不认为字段被清空，用户名实际不生效。

## 问题

T068 P5 发现的预存失败：`test_update_profile_clear_display_name` 断言失败。前端 `AccountSettings.vue` 表单空值序列化为 `""`，后端 `PATCH /auth/me` 的 Pydantic schema 区分 `None`（未传/清空）和 `""`（空字符串），导致清空操作不生效。

## 任务范围

- 前端：`AccountSettings.vue` 表单提交时，空字符串字段转为 `null`
- 后端：确认 `PATCH /auth/me` schema 对 `display_name: None` 的处理逻辑正确
- 测试：修复 T068 预存失败用例

## 环境约束

- 改动 ≤3 行（前端序列化逻辑）
- 后端可能无需改动（需确认 schema 语义）
- 现成测试覆盖（T068 的 test case）

## 已知风险

- risk=low：单字段序列化修复，不影响其他字段
- 需确认其他 Optional 字段（如 email）是否有同样问题

## 裁剪倾向

- risk=low，≤3 行改动 + 现成测试
- P3 可跳（测试已存在，T068 预存失败即红灯）
- P7 可简化（单文件改动，无跨文件一致性风险）

## 验证标准

- 清空 display_name 后 PATCH 发送 `null` 非 `""`
- 后端正确将 display_name 设为 null
- T068 预存失败用例通过
