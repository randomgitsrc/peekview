---
phase: P0
task_id: T033
task_name: share-semantic-security-fixes
type: fix
trace_id: T033-P0-20260629
created: 2026-06-29
status: draft
---

task: 分享功能语义+安全修复 — 3 项

1. compare_digest 永真（backlog #4）：share_service.py 的 hmac.compare_digest 永远为真，误导维护者。删除或加注释
2. share cookie 可枚举（backlog #9）：peekview_share_{entry_id} 改为 peekview_share_{slug}，防推断 entry 总量
3. max_views 语义模糊（backlog #5）：UI 文案与实际行为不一致。"最多看 N 次" vs "最多发 N 个"，需确认语义后统一

改动域: share_service.py + share cookie 命名 + ShareDialog UI 文案

known_risks:
  - cookie 命名改 slug 后，slug rename 会导致已分享的 cookie 失效
  - max_views 选"看 N 次"需 cookie 路径也递增 view_count，影响性能
  - max_views 选"发 N 个"只改 UI 文案，但语义不如"看 N 次"直观

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可裁剪 — 需 max_views 语义决策后是小改动

phase_hint: [P1, P4, P5, P6]
