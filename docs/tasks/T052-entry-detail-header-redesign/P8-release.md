---
phase: P8
task_id: T052-entry-detail-header-redesign
type: release
parent: P7-consistency.md
trace_id: T052-P8-20260711
status: completed
created: 2026-07-11
agent: main
bump_type: patch
packages:
  - peekview
version_before: 0.6.0
version_after: 0.6.1
---

# P8 — Release

## bump_type: patch

**理由**: 前端 header 视觉重构 + 2 个 bugfix（CSS scoping、scroll-hide）。无 API 变更，无 schema 变更。patch 级别。

## 临时资源清单

| 资源 | 状态 | 清理方式 |
|------|------|---------|
| Debug backend :8888 | running | `make debug-stop` |
| Debug data /tmp/peekview-debug/ | exists | `make debug-stop` 自动清理 |
| Test entries (t052-*) | in debug DB | 随 debug data 清理 |
| Chrome CDP :18800 | external service | 不归本任务管理 |
| lucide-vue-next (npm) | installed | 保持（正式依赖） |

## READY 收尾检查

| 检查项 | 状态 |
|--------|------|
| .state.yaml phase == DONE | ✅ |
| active-tasks.md 已更新 | ✅ |
| git 工作区干净 | ✅ |
| git tag v0.6.1 已创建 | ✅ |
| 调试服务已停止 | ✅ |
| 临时数据已清理 | ✅ |
| 端口 :8888 已释放 | ✅ |
| 项目依赖无污染 | ✅ |
| 无 PROD_TOUCHED 标记 | ✅ |
| P5 gate 重跑全绿 (811 pass) | ✅ |

## 发布步骤

1. [x] P7 gate passed
2. [x] bump-version 0.6.0 → 0.6.1
3. [x] CHANGELOG [Unreleased] → 0.6.1
4. [x] git commit + tag v0.6.1
5. [x] P5 gate 重跑（全绿确认）
6. [x] READY 收尾清理
7. [x] .state.yaml → DONE
