---
phase: P8
task_id: T054
type: release
parent: P7-consistency.md
trace_id: T054-P8-20260714
status: draft
created: 2026-07-14
agent: releaser
---

# T054 P8: 发布准备

## Bump 信息
- `bump_type`: minor
- 理由：API 安全加固（限流、host 绑定）+ 写入幂等性（Agent 协同安全性）

## 收尾检查清单
- [x] 调试服务已停止
- [x] 临时调试数据已清理 (`/tmp/peekview-debug/`)
- [x] 生产数据库环境未触碰
- [x] 预发布测试全部通过

## CHANGELOG 检查
- [x] 0.6.3 版本内容已填充
