---
phase: P0
task_id: T034
task_name: max-views-semantic-fix
type: fix
trace_id: T034-P0-20260629
created: 2026-06-29
status: draft
---

task: max_views 语义对齐 — UI 文案与实际行为不一致

来源: improvement-backlog #5

问题: verify_share_cookie 不递增 view_count，只有 verify_share_token 递增。导致 max_views 实际语义是"最多发给 N 个人"（最多 N 个 token 被使用），但 UI 的 views 标签暗示"最多被看 N 次"。

方案方向: 两种选择——
A. 语义改为"最多看 N 次"：cookie 路径也递增 view_count，更符合用户预期
B. 语义保持"最多发 N 个"：UI 文案改为"Max shares"等对齐措辞

需用户确认选择。

known_risks:
  - 选 A 会在 cookie 路径加 view_count 递增，可能影响性能（每次访问都写 DB）
  - 选 B 只需改 UI 文案，但语义不如"看 N 次"直观

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可裁剪 — 需求决策明确后是小改动

phase_hint: [P1, P4, P5, P6]
