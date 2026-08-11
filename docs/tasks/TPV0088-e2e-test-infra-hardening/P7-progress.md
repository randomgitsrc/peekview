# P7 分阶段落盘 — consistency-reviewer

## 已读输入（2026-08-12）
- [x] P7-dispatch-context-consistency-reviewer.md（强制指令，9 BDD ↔ 9 PASS；P4 并行 + P5 回退；三文件交叉核对）
- [x] consistency-reviewer.md 角色定义（DESIGN_GAP 逐条配对 / SCOPE+ 闭环 / 跨文件实质锚点）
- [x] P0-brief.md（19 用例 spec 修复 + Check 6 mtime；环境隔离）
- [x] P1-requirements.md（9 BDD + IMPL-S1~S12 + [NO_NEED_CONFIRM]；无 [SCOPE+]）
- [x] P2-design.md（§2.1 slug 映射 + S1~S12 + §2.2 Check 6/Makefile env；gate_commands 固化）
- [x] P3-test-cases.md（TC-B1~B7 shell 契约 + 子任务 A 19 用例修复清单）
- [x] P4-implementation.md（retry1：7 项修复，无 [DESIGN_GAP] 标记）
- [x] P4-implementation-b.md（Check 6 + --test-mtime + Makefile env，[PROD_NOT_TOUCHED]）
- [x] P4-review.md（approved；文档化 GAP-1/GAP-2 两处 DESIGN_GAP 审查结论）
- [x] P5-test-results/（e2e.md 首轮 18 failed + 复跑 38/38；unit/typecheck/fail-list）
- [x] P6-acceptance.md（9/9 PASS，38/38，mtime 三态）
- [x] 实现代码：viewer.spec.ts（343 行）、e2e-safety-check.sh（145 行）、Makefile:633-643
- [x] known-failures.md、.state.yaml、P3-test-code/test-mtime.sh

## 关键发现

### FINDING-1：P4-implementation.md（retry1）缺失 [DESIGN_GAP] 标记
- 已提交版 P4-implementation.md（commit 8faa147a）含 2 处 [DESIGN_GAP]（TC-012 last()、TC-050 .detail-header 断言）
- 当前 retry1 重写版 P4-implementation.md **无** [DESIGN_GAP] 标记（grep 零命中）
- 但 P4-review.md §[DESIGN_GAP] 审查 文档化了 GAP-1/GAP-2 且 approved；实现代码确实实现了两处（spec:146 last()、spec:340 .detail-header）
- 处置：P7 逐条转抄 + REVIEWED 配对，design_gap_count=2, design_gap_reviewed_count=2

### FINDING-2：SCOPE+ 闭环 N/A
- P1 无 [SCOPE+] 标记，只有 [NO_NEED_CONFIRM] + [SUGGEST]；SUGGEST（Check 6 放 e2e-safety-check.sh + make build-frontend 提示）已被采纳（P2 §2.2.1/实现一致）

### FINDING-3：BDD 数量匹配
- P1 9 BDD（BDD-1..BDD-9）↔ P6 9 条 PASS 一一对应 ✓

### FINDING-4：代码级交叉核对全部命中
- 路由：15 处 page.goto 均 /{slug} 或 / 或 /explore，无 /#/entry/（grep 零命中）✓
- slug：python-entry-service×5、markdown-test×6、mermaid-charts×1、json-api-config×1，与 P6 BDD-4 一致 ✓
- 死选择器：无 .code-header/.mobile-actions/.menu-btn/.toc-btn/.list-header/.btn-icon/has-text/a[download]/mermaidExists ✓
- Check 6：函数定义 line 11（Check 1 前）、--test-mtime line 32、Check 6 调用 line 123（Check 5 后）✓
- Makefile:636-639 传 PV_SRC_DIR/PV_STATIC_INDEX $(CURDIR) 绝对路径 ✓
- TC-B1~B7：harness 含 B1/B2/B3/B4/B6/B7 显式断言 + B5 诊断 helper，P4-b PASS=6 一致 ✓

### FINDING-5：未决项清零
- P1 无残留 [NEED_CONFIRM]/[BLOCKER]/[DEVIATION-CRITICAL] ✓

### 非阻塞观察
- OBS-1：P6 BDD-4 "×5/×6" 是 spec 内字符串出现次数而非测试用例数（TC 数分别 4/8）——措辞歧义，实质一致
- OBS-2：P2 §2.1.1 说原文件 17 处 goto，现文件 15 处 goto（helper 合并 openMarkdownFile 后减少）——BDD-2 语义不受影响
