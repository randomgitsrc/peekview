---
phase: P7
task_id: T059
type: dispatch-context
created: 2026-07-20
agent: main
---

# P7 Dispatch Context: T059 Markdown Extensions

## Task Summary
Add KaTeX math, task-list checkbox, footnote, and sub/sup support to PeekView's Markdown renderer.

## Key Information for Consistency Reviewer

### DESIGN_GAP from P4 (MUST be transcribed + paired with REVIEWED)
1. `[DESIGN_GAP: P2 未指定 KaTeX throwOnError 选项。实现中设为 false，原因：插件默认在错误时抛异常并渲染 class='katex-error' span（无颜色标记），而 P3 TC05 断言输出含 #cc0000/mathcolor。设 throwOnError: false 后 KaTeX 自身渲染红色错误标记，与 P3 测试预期一致。]`

### SCOPE+ Status
- P1 has `[SCOPE_RESOLVED] 无范围增补——P1-P4 执行过程中未发现超出基线的隐含需求`
- No unresolved SCOPE+ items

### Cross-file Consistency Check Points
1. **P1 BDD count vs P6 PASS count**: P1 has 30 Given lines, P6 has 30 PASS lines — verify content mapping
2. **P2 packages vs P4 implementation**: P2 chose 方案A (global CSS import + scrollIntoView), P4 implemented exactly that
3. **P2 design decisions vs P4 code**: KaTeX CSS global import in main.ts, scroll intercept in MarkdownViewer.vue, DOMPurify config unchanged
4. **P3 test cases vs P5 test results**: 36 test cases defined, 36 tests green in P5
5. **P1 BDD domains vs P6 evidence**: E1(KaTeX 9 BDD), E2(Task List 5 BDD), E3(Footnotes 6 BDD), E4(Sub/Sup 4 BDD), Cross(6 BDD) = 30 total

### Files to Review
- P1: `docs/tasks/T059-markdown-extensions/P1-requirements.md`
- P2: `docs/tasks/T059-markdown-extensions/P2-design.md`
- P3: `docs/tasks/T059-markdown-extensions/P3-test-cases.md`
- P4: `docs/tasks/T059-markdown-extensions/P4-implementation.md`
- P5: `docs/tasks/T059-markdown-extensions/P5-test-results/`
- P6: `docs/tasks/T059-markdown-extensions/P6-acceptance.md`

### Unresolved Items Check
- No [NEED_CONFIRM] in any P1-P6 production file (template references in dispatch-context/progress files are not actual markers)
- No [BLOCKER] in any file
- No [DEVIATION-CRITICAL] in any file

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P7

路径：agate/phase-cards/P7-consistency.md
---
# P7 — 一致性检查

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P7 + 源文件数 ≤5 + 无 implicit_coupling + 有 coupling_checklist → 跳过，读 P8 卡片
> ⑨ P7 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 consistency-reviewer subagent 执行交叉检查
2. 对照 P1-P6 产出做跨文件一致性审查
3. 产出 P7-consistency.md
4. 预跑 check-gate.sh P7
5. git commit → 更新 .state.yaml phase=P7 → P8

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P7 MAX=2）

## 前置条件

- [ ] P1-P6 全部产出文件就绪

## 执行方式

consistency-reviewer subagent 执行。检查清单：

1. **DESIGN_GAP 配对**：P4-implementation.md 中的 DESIGN_GAP 声明 → 必须在 P7-consistency.md 中逐条转抄 + 配 REVIEWED 标记。未配对 → gate 不通过
2. **SCOPE+ 闭环**：P1-requirements.md 有 [SCOPE_RESOLVED] 标记，确认所有 SCOPE+ 增补已纳入基线
3. **跨文件一致性**：P2 声明的 packages 与 P8 release 的 bump 范围一致？P1 的 BDD 和 P6 的验收结果数量匹配？P4 的实现路径和 P2 的方案设计吻合？
4. **未决项清零**：全阶段产出文件中无残留的 [NEED_CONFIRM]、[BLOCKER]、[DEVIATION-CRITICAL]

## 实质锚点要求（N3⑨）

| gate 断言 | 实质锚点（P7 产出须包含） |
|-----------|--------------------------|
| BLOCKER=0 | DESIGN_GAP 配对项 + REVIEWED 标记 |
| CRITICAL=0 | 跨文件检查项 + 源文件节名 |
| SCOPE+ 闭环 | 条目 + SCOPE_RESOLVED |

gate 脚本校验说明：
- DESIGN_GAP_REVIEWED：P4 声明的每条 DESIGN_GAP 在 P7 产出中须有对应行含 `DESIGN_GAP_REVIEWED`
- 跨文件引用关键词：P7 产出中须含源文件节名（如 `P2§packages`、`P4§impl-path`），否则 WARNING

## 产出规格

- P7-consistency.md：一致性审查结论
- 逐条检查结果，无 [BLOCKER] 标记

## gate 规则

```bash
check-gate.sh P7 $TASK_DIR
```

- [BLOCKER] 存在 → exit 1
- [DEVIATION-CRITICAL] 存在 → exit 1
- DESIGN_GAP 未配对（P4 有但 P7 无 REVIEWED）→ exit 1
- 含 DESIGN_GAP_REVIEWED 但缺跨文件引用关键词 → WARNING（不改变 exit code）
- 全部通过 → exit 0

BLOCKER → consistency-reviewer 修改 → 再验 gate → … → 通过（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 推进条件

- [ ] P7-consistency.md 存在
- [ ] 无 [BLOCKER] / [DEVIATION-CRITICAL]
- [ ] DESIGN_GAP 全部 REVIEWED 配对
- [ ] SCOPE+ 闭环（P1 有 [SCOPE_RESOLVED]）

## P7 输入文件数量

P7 是输入文件数量限制的例外，不拆分。原因：
1. 跨文件一致性比较需要全部源文件同时可见
2. 角色文件（consistency-reviewer）已列出所需输入清单
3. dispatch-context 为 subagent 提供摘要，无需逐文件全文注入

## 常见错误

1. **漏转抄 P4 的 DESIGN_GAP**：P4 implementer 声明了实现偏差但 P7 没转抄 → gate 拦截
2. **一致性检查只看标题不对内容**：P1 BDD 数 = 15，P6 PASS 数 = 15 → 数量对，但 BDD-8 的内容在 P6 里被映射到错误的验收结果
3. **裸 'BLOCKER=0' 不引用锚点**：未做实质交叉检查，只写 '一致' → gate WARNING 提醒

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P8 发布前最后一道质量门——P7 通过后进入机械发布步骤

> 完成 → commit 产出 + .state.yaml → 读 phase-cards/P8-release.md
<!-- AGATE_CARD_END -->
