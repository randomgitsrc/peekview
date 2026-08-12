---
phase: P8
task_id: T053
type: release
parent: P7-consistency.md
trace_id: T053-P8-20260713
status: complete
created: 2026-07-13
agent: main
---

# T053 P8 发布准备

## bump_type: patch

理由：纯后端行为变更，无公共 API 破坏性变更，无 schema 变更。Content Negotiation 是新增能力，不影响现有 API 行为（Accept: */* 和 Accept: text/html 行为与改动前一致）。

## 版本变更

当前版本：v0.6.2
目标版本：v0.6.3（patch）

## packages

- backend/peekview: 已改动（main.py, api/files.py）

## CHANGELOG

[Unreleased] 已包含 T053 条目。bump 时归入 v0.6.3。

## 临时服务/数据

- 无（debug backend 已停止，/tmp/peekview-debug/ 已清理）

## 生产残留

- 无（未触碰生产环境）

## READY 收尾

- [x] 调试服务已停止
- [x] 临时数据已清理
- [x] 生产环境无残留
- [x] 开发环境已还原
