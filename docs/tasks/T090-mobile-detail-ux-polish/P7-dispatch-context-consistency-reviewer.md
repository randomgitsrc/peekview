---
phase: P7
task_id: T090-mobile-detail-ux-polish
role: consistency-reviewer
---

# 派发指引 — T090 P7 一致性检查

## 目标

对照 P1-P6 全部产出做跨文件一致性审查，确保 P4 实现未偏离 P2 设计、P1 需求已全部在 P6 验收闭环、无残留未决项。

## 上游关联与已知情况（先读，避免重复排查）

- **DESIGN_GAP 格式说明**：P4-implementation.md 有一节"## [DESIGN_GAP] 声明"，但里面的条目是**未采用**协议标准 `[DESIGN_GAP: 描述]` 行首格式（analyst/implementer 当时用了带小标题的段落式写法，不是单行 tag）。这意味着 `grep -cE '^\s*-?\s*\[DESIGN_GAP:'` 在 P4-implementation.md 里会匹配到 0 条，check-gate.sh P7 的 P4/P7 数量交叉核对会因此认为"P4 声明 0 条、P7 转抄 0 条"而自动一致（不会报缺失）。**但这不代表内容上没有需要交叉核实的偏差**——P4-implementation.md 里实际记录了 3 处需要你核实是否已妥善收口的问题（非行首 tag 格式，但内容真实存在）：
  1. T079-entry-detail-header.spec.ts 联动修改（未在 P2 files_to_read 清单内，但删除 `.meta-tags-bar` 后必须联动改）
  2. BDD-8 测量口径不一致（P1/P3 计量口径 bug，已通过 P1 追加 `[BASELINE_CHANGE]` 澄清注释 + E2E 测试修正解决）
  3. BDD-6 FileTree 选择器歧义 + 后续发现的 copy 断言问题（均为纯测试代码 bug，已修复，详见 P4-gate-diagnosis.md）
  请你核实这 3 处在 P6 验收阶段是否都已经在实际测试结果中体现为 PASS（即问题确实已解决，不是被回避），并在 P7-consistency.md 里用你自己的 `[DESIGN_GAP: ...]` + `[DESIGN_GAP_REVIEWED: ...]` 标准格式转抄这 3 条（即使 P4 原文没用这个格式，你转抄时按标准格式写，这样才能被 gate 脚本正确识别为"已配对审查"，也让这份记录对后续维护者更清晰）。

- **SCOPE+ 情况**：全文搜索确认 P1-requirements.md 和 P4-implementation.md 均无 `[SCOPE+]` 标记（本任务未发现范围外的隐含需求），因此不需要 `[SCOPE_RESOLVED]` 闭环，请核实这一判断（搜索确认无遗漏），若确认无 SCOPE+，直接说明"无 SCOPE+，闭环检查项自动满足"即可。

- **[BASELINE_CHANGE] 情况**：P1-requirements.md 有 2 处 `[BASELINE_CHANGE]`（DESIGN.md L219 滚动隐藏规则替换 + BDD-8 计量口径澄清），均已获主 Agent 批准且未改变 BDD 的 Given/When/Then 语义（后者是追加澄清注释，前者是需求方向的合法变更，非静默覆盖）。请核实这两处变更是否已在 P4 实现和 DESIGN.md 中正确落实。

## 必读输入文件

1. `docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（12 条 BDD + 2 处 [BASELINE_CHANGE]）
2. `docs/tasks/T090-mobile-detail-ux-polish/P2-design.md`（6 候选方案、packages/domains 声明、DESIGN.md 修订文字）
3. `docs/tasks/T090-mobile-detail-ux-polish/P4-implementation.md`（改动清单 + [DESIGN_GAP] 声明）
4. `docs/tasks/T090-mobile-detail-ux-polish/P4-gate-diagnosis.md`（主 Agent 对 DESIGN_GAP 的诊断与批准记录）
5. `docs/tasks/T090-mobile-detail-ux-polish/P6-acceptance.md`（12 条 BDD 验收结果）
6. `docs/tasks/T090-mobile-detail-ux-polish/P0-brief.md`（环境约束）

## 检查清单（按你角色定义的 4 项，逐一给出锚点引用）

1. **DESIGN_GAP 配对**：按上方"已知情况"转抄 3 条 + REVIEWED 标记
2. **SCOPE+ 闭环**：确认无 SCOPE+（如上），说明"自动满足"
3. **跨文件一致性**（需引用具体文件节名，不要写裸"一致"）：
   - P2 §0 `packages: [frontend-v3]` 与实际改动文件（P4-implementation.md 改动清单）是否都在 frontend-v3 目录下
   - P1 的 12 条 BDD 与 P6-acceptance.md 的 12 条 PASS 结果是否逐条编号对应（不是只对比总数，要对比每条 BDD-N 在 P6 里是否有对应编号的验收结果，内容是否匹配该条 BDD 的 Given/When/Then）
   - P4 的实现改动（新建 EntryMetaTagsBar.vue、EntryDetailMobileBar.vue 改 position:fixed、MarkdownViewer.vue 边距归零）与 P2 §2 选定的候选方案（1-B/2-A/3-A）是否吻合，没有偷偷换成被否决的候选
4. **未决项清零**：搜索 P1-requirements.md 确认无残留行首 `[NEED_CONFIRM]`（应只有已采纳的 `[SUGGEST]` 和 `[NO_NEED_CONFIRM]`）、无 `[BLOCKER]`、无 `[DEVIATION-CRITICAL]`

## 门槛（什么算完成）

- 产出 P7-consistency.md，Header `status:` 准确反映结论
- 3 条 DESIGN_GAP 转抄 + REVIEWED 配对，每条引用具体文件节名
- 跨文件一致性检查项引用具体锚点（P1 BDD 编号 / P2 packages / P4 implementation 改动路径）
- 结论明确：BLOCKER=0 / DEVIATION-CRITICAL=0

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P7

路径：phase-cards/P7-consistency.md
---
# P7 — 一致性检查

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P7 + 源文件数 ≤5 + 无 implicit_coupling + 有 coupling_checklist（须列出至少 2 个已检查的耦合点，空清单不合规）→ 跳过，读 P8 卡片
> ⑨ P7 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 consistency-reviewer subagent 执行交叉检查
   1.1 写 P7-dispatch-context-consistency-reviewer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 对照 P1-P6 产出做跨文件一致性审查
3. 产出 P7-consistency.md
4. 预跑 check-gate.sh P7
5. 更新 .state.yaml phase=P7 → P8
6. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
7. git commit -m "wf({Txxx}-P7): {摘要}"

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P7 MAX=2）

## 前置条件

- [ ] P1-P6 全部产出文件就绪

## 执行方式

consistency-reviewer subagent 执行。检查清单：

1. **DESIGN_GAP 配对**：P4-implementation.md 中的 DESIGN_GAP 声明 → 必须在 P7-consistency.md 中逐条转抄 + 配 REVIEWED 标记。未配对 → gate 不通过
2. **SCOPE+ 闭环**：P1-requirements.md 有 [SCOPE_RESOLVED] 标记，确认所有 SCOPE+ 增补已纳入基线
3. **跨文件一致性**：P2 声明的 packages 与 P8 release 的 bump 范围一致？P1 的 BDD 和 P6 的验收结果数量匹配？P4 的实现路径和 P2 的方案设计吻合？
4. **未决项清零**：P1-requirements.md 无残留行首 [NEED_CONFIRM]（P6 不再有 NEED_CONFIRM）、[BLOCKER]、[DEVIATION-CRITICAL]

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

## 推进条件（全部满足才写 phase: P8）

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

> 完成 → 读 phase-cards/P8-release.md
<!-- AGATE_CARD_END -->
