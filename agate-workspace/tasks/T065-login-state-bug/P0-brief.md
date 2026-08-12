---
phase: P0
task_id: T065
task_name: login-state-bug
type: bug
trace_id: T065-P0-20260722
created: 2026-07-22
revised: 2026-07-22
status: draft
parent: 用户实测发现（冷打开审计后续）+ 主 Agent 代码核查纠正
---

task: 修复登录状态 bug——登录后 Sign in 按钮不消失（已确认）+ 登录跳转异常（需重新复现）

⚠️ 重要纠正（2026-07-22 主 Agent 代码核查，推翻原 brief 的"T060 回归"框架）：
- 跳转 watcher 存在于 LandingView.vue:206 `watch(authState, s => { if (s==='authenticated') router.replace('/explore') })`，git blame 显示建于 2026-06-28（commit 33a8fe15c），比 T060（2026-07-21）早三周
- T060 的 P4 实现（commit f529acb7）只改了 EntryListView.vue / entry.ts / 后端 / MCP，从未碰 LandingView.vue
- 因此"不跳转"**不是** T060 弄丢跳转逻辑。P1 不要去 git diff T060——那是无关 commit

现象（重新界定）：
1. 【已确认·真实 bug】登录成功后 landing 页 Sign in 按钮不消失——LandingView.vue:19 的 Sign in 按钮 `<button ... @click="showLogin = true">Sign in</button>` 无任何 v-if/authState 绑定，无条件渲染。这是**既有设计缺口**（landing 的 Sign in 从未做过 auth-aware），不是回归
2. 【需重新复现】"登录成功不跳转"——代码里跳转 watcher 存在（LandingView.vue:206）。P1 必须先实跑复现确认症状是否真实；若真实，根因在别处（LoginDialog 登录流 / authState 响应式 / router.replace 时机），不是缺 watcher

known_risks:
  - P1 第一步是**实跑复现两个症状**（make debug-restart + make debug-seed，用 alice 登录），不是 git diff T060。复现前不要预设根因
  - 两个症状可能同根：若跳转 watcher 失效，用户停在 landing，自然看到没绑定的 Sign in。复现后先厘清因果——可能修好跳转后 Sign in 问题在 landing 上自然消失（用户已被带去 /explore）
  - 症状②（Sign in 显隐）确认真实，修复方向明确：Sign in 按钮绑定 authState（authenticated 时隐藏）
  - 症状①（不跳转）若复现不出来，要诚实记录"无法复现"并 PAUSED 问用户具体操作路径，不可硬造根因
  - Sign in 显隐绑定 authState 与 T067（详情页框架）的 Sign in 绑定有重叠——T065 先修好 authState 响应式 + landing Sign in，T067 复用；注意边界不要重复改
  - 登录跳转逻辑可能散落在多处（LoginDialog / auth store / router guard / authState watcher），复现后需理清调用链再动手

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug-restart (127.0.0.1:8888, /tmp/peekview-debug/)
  seed_data: make debug-seed (alice/bob/carol, password testpass123)
  ui_affected: true（登录 UI + landing 页，P6 需 Playwright 实跑截图验证）
  env_check: P1 启动前须跑 docs/process/env-check-protocol.md（至少快速版 1-3）
  key_files: frontend-v3/src/views/LandingView.vue（:19 Sign in 按钮, :206 跳转 watcher）, frontend-v3/src/stores/auth.ts（authState computed）, frontend-v3/src/components/LoginDialog.vue

pruning_tendency: 保守 — 症状①需先复现确认（可能无法复现→PAUSED 问用户），不可盲改；UI 改动 P6 不可裁

phase_hint: [P1, P2, P3, P4, P5, P6]
