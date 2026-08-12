---
phase: P2
task_id: T037-search-content-expansion
type: review
parent: P2-design.md
trace_id: T037-P2-review-20260630
status: approved
created: 2026-06-30
---

## 评审结论：approved

方案采用 contentless+contentless_delete=1 模式，应用层管理 content 列：
- FTS5 触发器只同步 summary/tags ✅
- content 列由 entry_service 在 create/update 后填充 ✅
- 启动时回填已有 entry ✅
- 前端搜索 placeholder 提示搜索范围 ✅
- gate_commands 含 P5 验证命令 ✅
