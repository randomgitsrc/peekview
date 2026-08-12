---
phase: P8
task_id: T069
type: release
parent: P7-consistency.md
trace_id: T069-P8-20260726
status: draft
created: 2026-07-26
agent: main
---

## bump_type

patch

## 版本变更

- peekview: 0.11.1 → 0.11.2
- mcp_server: 0.10.0（不变）

## 理由

UI 打磨 + auth guard bug 修复，不改公共 API 行为，patch 合适。

## CHANGELOG

已在 CHANGELOG.md [Unreleased] 区域添加 T069 条目。

## 临时资源清单

- debug backend :8888（PID: 3165132，需停止）
- /tmp/peekview-debug/ 临时数据目录

## 发布检查

- [ ] make bump-version NEW_VERSION=0.11.2
- [ ] make pre-publish-quick
- [ ] make publish
- [ ] git push && git push origin v0.11.2
