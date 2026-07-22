---
phase: P0
task_id: T065
task_name: login-state-bug
type: bug
trace_id: T065-P0-20260722
created: 2026-07-22
status: draft
parent: 用户实测发现（冷打开审计后续）
---

task: 修复登录状态 bug——登录成功后不跳转 + 登录后 Sign in 按钮不消失（疑似 T060 回归）

现象（用户实测）：
1. 以前在 landing 页登录成功后会显示 "Logged in successfully" 并自动跳转到详情页/explore，现在登录成功了但停在 landing 不跳转
2. 登录成功后，landing 页仍然显示 Sign in 按钮，看起来像没登录——Sign in 的显隐没有绑定 authState

known_risks:
  - 很可能是 T060 引入的回归——T060 改了前端 authState watcher 处理登录/登出/过期，可能弄丢了登录后跳转逻辑，或 Sign in 显隐没绑定 authState。P1 必须先 git diff T060 确认根因，不可盲改
  - 登录跳转逻辑可能散落在多处（LoginDialog / auth store / router guard / authState watcher），需先理清调用链
  - Sign in 显隐绑定 authState 与 T067（详情页框架）的 Sign in 绑定有重叠——T065 先修好 authState 响应式，T067 复用，注意边界不要重复改

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug-restart (127.0.0.1:8888, /tmp/peekview-debug/)
  seed_data: make debug-seed (alice/bob/carol, password testpass123)
  ui_affected: true（登录 UI + landing 页，P6 需 Playwright 实跑截图验证）

pruning_tendency: 保守 — bug 修复需先定位根因（是否 T060 回归），不可盲改；UI 改动 P6 不可裁

phase_hint: [P1, P2, P3, P4, P5, P6]
