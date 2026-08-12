---
phase: P0
task_id: T037
task_name: search-content-expansion
type: feature
trace_id: T037-P0-20260629
created: 2026-06-29
updated: 2026-06-30
status: draft
---

task: 搜索能力扩展 — FTS5 索引文件内容

当前 FTS5 只索引 summary + tags，扩展为可搜文件内容。需后端 FTS5 索引扩展（content 字段 + 触发器 + 回填已有数据）+ 前端搜索 UI 提示搜索范围。

> **注意**: 原 P0-brief 中"HTML 多文件引用提示"部分已拆出至 T041/T042/T043。

改动域: 后端 database.py(FTS5) + entry_service.py(搜索逻辑) + 前端 SearchInput

known_risks:
  - FTS5 索引扩展到文件内容会增大索引体积，需评估性能影响
  - 已有 entry 的文件内容需回填索引（migration 策略）
  - 二进制文件内容不应进入 FTS5 索引
  - 大文件内容截断策略（索引前 N 字符？全文？）

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 保守 — 涉及后端数据模型 + FTS5 索引，方案不明确须走 P2

phase_hint: [P1, P2, P3, P4, P5, P6]
