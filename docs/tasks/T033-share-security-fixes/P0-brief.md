---
phase: P0
task_id: T033
task_name: share-security-fixes
type: fix
trace_id: T033-P0-20260629
created: 2026-06-29
status: draft
---

task: 分享功能安全修复 — compare_digest 永真 + share cookie 可枚举

来源: improvement-backlog #4 + #9

问题 1: share_service.py 的 hmac.compare_digest(computed_hash, share.token_hash) 永真——share 是用 WHERE token_hash = computed_hash 从 DB 查出的，两个 hash 都由自己计算。保留会误导维护者以为这里有安全考量。

问题 2: share cookie 用 peekview_share_{entry_id} 命名，entry_id 是自增整数，外部可枚举推断 entry 总量和 ID 范围。

方案方向:
- #4: 删除 compare_digest 或加注释说明保留意图
- #9: 改用 peekview_share_{slug}，注意 slug rename 时 cookie 失效的 trade-off

known_risks:
  - cookie 命名改 slug 后，slug rename 会导致已分享的 cookie 失效
  - compare_digest 删除需确认无其他调用路径依赖其返回值

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可裁剪 — 2 个小修复，逻辑清晰，可跳 P2/P3 直接实现

phase_hint: [P1, P4, P5, P6]
