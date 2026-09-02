# TPV0095 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- NEXT: P0 补齐立项文件（P0-brief 字段/.state.yaml）+ 环境自检 → 完成后派发 P1 analyst（写 P1-dispatch-context-analyst.md → agate-inject-card.py → subagent）

- NEXT: P1 analyst 已派发（P1-dispatch-context-analyst.md + AGATE_CARD 注入完成）→ 等待产出 P1-requirements.md → 派 requirements-review

- NEXT: P1 gate exit 2 通过（43 BDD approved）→ commit P1 → 进入 P2（读 P2 卡片 → 写 P2-dispatch-context-architect.md → 派 architect → plan-eng-review + plan-design-review）
