# TPV0095 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- NEXT: P0 补齐立项文件（P0-brief 字段/.state.yaml）+ 环境自检 → 完成后派发 P1 analyst（写 P1-dispatch-context-analyst.md → agate-inject-card.py → subagent）

- NEXT: P1 analyst 已派发（P1-dispatch-context-analyst.md + AGATE_CARD 注入完成）→ 等待产出 P1-requirements.md → 派 requirements-review

- NEXT: P1 gate exit 2 通过（43 BDD approved）→ commit P1 → 进入 P2（读 P2 卡片 → 写 P2-dispatch-context-architect.md → 派 architect → plan-eng-review + plan-design-review）

- NEXT: P2 architect 已派发（dispatch-context 注入完成）→ 等待 P2-design.md → 并行派 plan-eng-review + plan-design-review → 组长汇总 P2-review.md → gate P2 → commit

- DECISION: P2 SCOPE+ 裁定——①detail 状态标签 team 显示 Private 误导 → 采纳，P1 增补 BDD-44（[BASELINE_CHANGE] 标注）；②MCP get_entry 需 raw 响应补 team → 采纳为实现约束（files.py + EntryRawResponse），scope_resolved 回写 P1；③restore merge 不拷 teams → 不采纳（超验收路径，记 backlog）；④CLI --user 语义 → 记录不扩
- NEXT: P2 双评审并行已派发（plan-eng-review=810f9c17 / plan-design-review=8693c412）→ 等两评审返回 → 组长汇总 P2-review.md → gate P2 → commit P2

- NEXT: P2 双评审均 needs-revision（无 BLOCKER）——eng R1-R4+N1-N4 / design N1-N3 → 派 architect rev1 定向补钉（R1 CLI 迁移/R2 422 错误类/R3 gate 拆键+frontend/R4 --user 契约入 BDD-31~34 需 [BASELINE_CHANGE]/N1-N4 + design N1-N3 data-testid 清单/表单规格/三态文案）→ 复审 approved → 组长汇总 → gate P2 → commit P2

- NEXT: architect rev1 已落实全部 R/N 修订 → P2 复审并行已派发（eng=8e3917f4 / design=e28bd803）→ 等复审 approved → 组长汇总 P2-review.md → gate P2 → commit P2

- NEXT: P2 gate exit 2 通过（双评审 approved + 组长 approved）→ commit P2 → 进入 P3（capture-env-baseline → 派 test-designer → check-tdd-red 红灯 → commit）

- NEXT: P3 三批 test-designer 已派发（backend=待派/frontend/mcp）→ 等三批红灯测试产出 → 主 Agent 合并 P3-test-cases.md → check-tdd-red.py 验红灯 → commit P3

- NEXT: P3 三批红灯测试齐（backend 37红/mcp 10红/frontend 24fail B 类）+ check-tdd-red exit 0 → commit P3 → 进入 P4（3 批 implementer 并行 + C8 评审 review/design-review/cso）
