---
phase: P0
task_id: T032
task_name: entry-read-tracking
type: feature
trace_id: T032-P0-20260629
created: 2026-06-29
status: draft
---

task: Entry 读取路径埋点 — 记录谁在读、读频率、读取方式

来源: improvement-backlog #3

问题: MCP getEntry / listEntries 路径无任何读取埋点。T027 的 view_count 只服务分享链接，不区分人/agent，也不在 MCP/API 读取路径上。无法知道"有没有 agent 真的去读另一个 agent 的产出"——这是判断多 Agent 总线愿景是否成立的唯一信号源。

方案方向: 给 entry 读取路径（API GET /entries/{slug} + MCP getEntry/listEntries）加最小探针——记录读取者身份（是否非创建者/是否不同 API key）、读取频率、读取方式（API vs MCP vs share）。数据用于驱动多 Agent 总线方向的优先级决策。

known_risks:
  - 埋点数据存储方案需评估（SQLite 表 vs 日志文件 vs 独立分析）
  - 高频读取可能产生大量埋点数据，需考虑采样或聚合策略
  - 读取埋点不能影响 API 响应速度（异步写入）

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 保守 — 涉及后端数据模型 + API 变更 + 存储策略，方案不明确须走 P2

phase_hint: [P1, P2, P3, P4, P5, P6]
