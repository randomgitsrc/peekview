---
phase: P7
task_id: T091-mobile-detail-visual-polish
role: consistency-reviewer
---

# 派发指引 — T091 P7 一致性检查

## 目标

对照 P1-P6 全部产出做跨文件一致性审查，产出 `P7-consistency.md`。这是发布前最后一道质量门。

## 必须处理的核心项：DESIGN_GAP 配对

`docs/tasks/T091-mobile-detail-visual-polish/P4-implementation.md` 第 39 行有一条 `[DESIGN_GAP: markdown-body 左侧 inset 断言的测量方法与 CSS box model 矛盾，导致 4 处测试恒定失败]`。请完整读取这一节（L39-62），把这条 DESIGN_GAP 的内容**逐条转抄**到 `P7-consistency.md`，并配对写明 `DESIGN_GAP_REVIEWED`（说明该问题最终如何被处理——已通过 P3 阶段的测试修正 subagent 定向修复测量目标解决，`t090`/`t091` 两个 spec 文件里 `boundingBox()` 的测量对象从 `.markdown-body` 自身改为其第一个子元素，P4 gate 通过后的多轮 E2E 已确认这两条测试转绿）。这不是可选项，gate 会硬拦截未配对的 DESIGN_GAP。

## 其他检查清单

1. **SCOPE+ 闭环**：本任务没有产生任何 `[SCOPE+]` 增补（P0-brief 已明确"9 viewer 范围扩展是 P1 派发前已定型，非事后 SCOPE+"），请核实 P1-requirements.md 全文确实没有 `[SCOPE+]` 标记，如无则无需 `[SCOPE_RESOLVED]`，在 P7-consistency.md 里写明"无 SCOPE+ 项，此项天然闭环"
2. **跨文件一致性**：
   - P1-requirements.md 第 3 节声明 13 条 BDD，P6-acceptance.md 的"Summary"是否精确为 13/13 PASS（数量匹配 + 内容对应，不是只看数字）
   - P2-design.md 第 1 节"改什么"表格列出的文件（`EntryMetaTagsBar.vue`/`MarkdownViewer.vue`/`EntryDetailMobileBar.vue`/`DESIGN.md`/2 个 e2e spec）与 P4-implementation.md 实际改动文件清单（含 P4 重试 #1 追加的改动）是否吻合
   - P2-design.md 声明 `packages: [frontend-v3]`，本任务全部改动是否确实都在 `frontend-v3/` 目录下（无 backend/mcp 改动）
3. **未决项清零**：grep 全部 P1-P6 产出文件确认无残留行首 `[NEED_CONFIRM]`、`[BLOCKER]`、`[DEVIATION-CRITICAL]`（本任务此前的 grep 显示这些标记只出现在 dispatch-context 文件的"角色说明"文字里，不是真实触发的标记，请确认这个判断）
4. **P6 退回重做的完整性**：本任务经历了一次 P6→P5→P4 的规范回退（`.retreat-history.md` 记录），请确认：回退前的 P6 产出已正确归档在 `.archived/20260809-175444-P6/`；重新验收的 P6-acceptance.md（`retry: 1`）是完整独立的 13 条重新验收，不是"挑几条改改"；P4 重试 #1 的修复范围与回退诊断原因（meta-tags-bar CSS 冲突）精确对应

## 必读文件

1. `docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`
2. `docs/tasks/T091-mobile-detail-visual-polish/P2-design.md`
3. `docs/tasks/T091-mobile-detail-visual-polish/P4-implementation.md`（含"P4 重试 #1"一节）
4. `docs/tasks/T091-mobile-detail-visual-polish/P6-acceptance.md`（`retry: 1` 版本，最终验收结果）
5. `docs/tasks/T091-mobile-detail-visual-polish/.retreat-history.md`
6. `docs/tasks/T091-mobile-detail-visual-polish/.state.yaml`（完整历史记录，含所有阶段的 action 记录）

## 输出

`docs/tasks/T091-mobile-detail-visual-polish/P7-consistency.md`，逐条给出检查结论，引用具体源文件节名（如 `P2§改什么`、`P4§P4重试#1`），不接受"一致"这类裸结论。无 `[BLOCKER]`/`[DEVIATION-CRITICAL]` 标记。

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
