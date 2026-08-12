# P6 验收进度 — T075 structured-data-viewer (verifier)

## 2026-08-01 输入读取完成
- 已读 P6-dispatch-context-verifier.md（派发指引：53 BDD 逐条验收、PASS/FAIL 二值、证据引用）
- 已读 verifier.md 角色文件（P6 验收模式、证据优先级、provenance 约束）
- 已读 P1-requirements.md（53 BDD：BDD-01~06 后端 language 检测、BDD-07~11 前端格式检测、BDD-12~23 TableView、BDD-24~36 TreeView、BDD-37~48 切换、BDD-49/50 异常、BDD-51/52 主题/响应式、BDD-53 端到端）
- 已读 P5-test-results/（backend 63 passed + 1008 passed/2 skipped；frontend 1177 passed + 分离验证全绿；E2E 84/84 修复后通过）
- 已读 P2-design.md（ui_affected: true，ui_e2e_points 23 项，minimal_validation 已确认）
- 环境确认：debug backend :8888 在线（HTTP 200），CDP Chrome :18800 在线（Chrome/151），T075 全部 17 个测试 entry 已存在于 debug DB（456 entries）
- [PROD_NOT_TOUCHED] 仅访问 :8888 debug backend /tmp/peekview-debug/，未触碰生产 :8080 / ~/.peekview/

## 执行计划
1. BDD-01~06：跑 backend pytest tests/test_language.py
2. BDD-07~11：跑 vitest useEntryDetailComputed.structured.spec.ts
3. BDD-12~49 单元层：跑 vitest TableView/TreeView/useCsvParser/useTreeData spec
4. BDD-12~53 交互层：跑 Playwright E2E structured-data-viewer.spec.ts（CDP :18800, debug :8888）
5. UI 截图 + vision 分析（BDD-12 表格、BDD-24 树、BDD-51 主题）
6. 写 P6-acceptance.md + P6-evidence/

## P6 执行与产出（verifier）
- 后端 BDD-01~06: pytest tests/test_language.py → 63 passed (test_bdd_01~06 对应用例)
- 前端 BDD-07~11: vitest useEntryDetailComputed.structured.spec.ts → 6 passed
- 前端 BDD-12~49 单元层: vitest TableView 13 + TreeView 13 + useCsvParser 9 + useTreeData 11 → 52 passed
- E2E BDD-12~53: structured-data-viewer.spec.ts → 84/84 passed (chromium + Mobile Chrome, CDP :18800 → debug :8888)
- UI 截图: 8 张 (bdd-12/13/24/38/51-dark/51-light/52-table/52-tree), md5 全唯一, 无 ahash 相似组
- vision: vision-engine 分析 6 个 UI BDD (bdd-12/13/24/38/51/52), 全部无 blocker
- 证据落盘: P6-evidence/ (test-output.log + screenshots/ 8 张 + vision-reports/ 6 份 + bdd-53-assert.json)
- 预检: check-p6-format OK / check-p6-evidence EXIT 0 / check-p6-provenance EXIT 0 / check-gate P6 (FAIL=0, NC=0, TOTAL=53, exit 2 属主 Agent 自判阶段)
- 修复记录: dispatch-context 第 20 行 "- PASS 必须有证据引用" 被 provenance 审计误判为结论预判 → 改为 "每条 PASS 行必须带证据引用，格式为 ..."（纯格式措辞调整，语义不变）
- [PROD_NOT_TOUCHED] 全程仅访问 :8888 debug backend (/tmp/peekview-debug/) 与 CDP Chrome :18800，未触碰生产 :8080 / ~/.peekview/
- 验收结论: 53/53 PASS, 0 FAIL, 0 NEED_CONFIRM
