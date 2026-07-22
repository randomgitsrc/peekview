NEXT: 派发 analyst subagent 执行 P1 需求基线
NEXT: 派发 requirements-review subagent 评审 P1
SUBAGENT FAIL: requirements-review rejected P1（P3 裁剪与 risk_level=medium 矛盾）
NEXT: 重派 analyst 修订 P1-requirements.md（带 review 反馈）
NEXT: 派发 requirements-review subagent 复审 P1
NEXT: 派发 architect subagent 执行 P2 方案设计
SUBAGENT FAIL: architect 空返回（读完9文件后认知过载，P2-design.md 未产出）
DIAGNOSIS: 读完9文件后面对"写完整设计文档"推理复杂度过高 → FIX: 补输入导航，明确根因已确认、方案方向明确，不需要再分析根因
NEXT: 派发 test-designer subagent 执行 P3 TDD 测试设计
NEXT: 派发 implementer subagent 执行 P4 代码实现
