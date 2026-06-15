---
phase: P0
task_id: T009
task_name: raw-shortlink
type: brief
trace_id: T009-P0-20260615
created: 2026-06-15
status: complete
parent: docs/plans/raw-shortlink.md
---

task: 在 main.py 的 create_app() 中添加 /{slug}/raw → 302 redirect 到 /api/v1/entries/{slug}/raw 的短链接路由，并在 test_raw_api.py 中添加 redirect 测试用例

known_risks:
  - 路由注册顺序：/{slug}/raw 必须在 _setup_static_files(app) 之前注册，否则被 SPA catch-all /{path:path} 吞掉
  - slug 格式假设：当前 slug 是 6 位字母数字不含 /，若未来 slug 格式变化可能影响路由匹配

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/); cd backend && make test; cd backend && make lint

pruning_tendency: 激进 — 改动极小（1 条路由 + 1 个测试），方案已在 raw-shortlink.md 中完全确定，无设计空间

phase_hint: [P1, P4, P5, P8]
