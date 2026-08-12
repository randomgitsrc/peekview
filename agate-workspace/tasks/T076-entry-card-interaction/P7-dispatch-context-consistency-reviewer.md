---
phase: P7
generated_by: agate-inject-card.sh + 主 Agent
task_id: T076
role: consistency-reviewer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

作为 P7 一致性检查 consistency-reviewer，对 T076 的 P1-P6 产出做跨文件一致性审查（技术视角：实现是否偏离 P2 设计），产出 `docs/tasks/T076-entry-card-interaction/P7-consistency.md`。

### 约束

- 你是独立审查角色，agent 字段必须填 `consistency-reviewer`（≠ main）
- 检查清单（逐项做实质交叉核对，不只是标题对比）：
  1. DESIGN_GAP 配对：P4-implementation.md 的 DESIGN_GAP 声明须逐条转抄 + 配 REVIEWED 标记（本任务 P4 声明 0 个 DESIGN_GAP，需明确核实并声明"无 DESIGN_GAP，实现忠实 P2 方案"）
  2. SCOPE+ 闭环：确认无未闭环 SCOPE+（本任务无 SCOPE+）
  3. 跨文件一致性：P1 BDD 数（21）== P6 验收 PASS 数（21）且编号一一对应（内容映射正确，不只数量对）；P2 packages=[frontend-v3] 与 P4 实际改动范围吻合；P4 实现路径与 P2 方案 A 吻合（card-body→div、title/username/tag 独立 <a>、BaseTag 多态 href、searchUrl.logic tags 扩展、FilterChip 复用）
  4. 未决项清零：全阶段产出无残留 [NEED_CONFIRM]/[BLOCKER]/[DEVIATION-CRITICAL]；确认 [NO_NEED_CONFIRM] 存在
- 实质锚点要求：P7 产出含源文件节名引用（如 P2§packages、P2§files_to_read、P4§implementation_dir、P1§BDD、P6§验收）
- 无问题用声明行格式 `[BLOCKER]: 0 条` / `[DEVIATION-CRITICAL]: 0 条`（声明行被 gate 排除，不计为实际 BLOCKER）

### 上游关联

P4 implementer 声明实现忠实 P2 方案 A（0 DESIGN_GAP）；P6 验收 21 BDD 全 PASS（vision×19 全 blocker=0）；全程无 SCOPE+。P5 有 1 轮 retry（修 12 个测试侧缺陷，非实现偏差）。

### 输入文件

- `docs/tasks/T076-entry-card-interaction/P1-requirements.md`（21 BDD 基线 + domains/packages/risk_level/phases）
- `docs/tasks/T076-entry-card-interaction/P2-design.md`（方案 A + packages + files_to_read + gate_commands）
- `docs/tasks/T076-entry-card-interaction/P4-implementation.md`（实现报告 + implementation_dir + 改动清单）
- `docs/tasks/T076-entry-card-interaction/P6-acceptance.md`（21 BDD 验收结果）
- `docs/tasks/T076-entry-card-interaction/P0-brief.md`（范围 A/B/C/D）
- `AGENTS.md`（项目约定）
</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P7

路径：phase-cards/P7-consistency.md
---
# P7 — 一致性检查

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P7 + 源文件数 ≤5 + 无 implicit_coupling + 有 coupling_checklist → 跳过，读 P8 卡片
> ⑨ P7 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 consistency-reviewer subagent 执行交叉检查
   1.1 写 P7-dispatch-context-consistency-reviewer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
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
4. **未决项清零**：全阶段产出文件中无残留的 [NEED_CONFIRM]、[BLOCKER]、[DEVIATION-CRITICAL]；检查 `[NO_NEED_CONFIRM]` 存在性

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

> 完成 → 读 phase-cards/P8-release.md
<!-- AGATE_CARD_END -->

<objective_info>
- 环境状态：debug backend http://127.0.0.1:8888（隔离 DB），版本 0.11.2
- 客观事实（主 Agent 核实）：
  - P4-implementation.md DESIGN_GAP 声明数 = 0（grep -cE '\[DESIGN_GAP:' = 0）
  - 全任务无 SCOPE+（grep 行首 [SCOPE+] = 0）
  - P1 BDD 总数 = 21（#### BDD-NN 标题数）；P6 验收 PASS 行 = 21（行首 - PASS 数），FAIL = 0
  - P2 packages = [frontend-v3]，domains = [frontend]，ui_affected = true
  - P4 implementation_dir = frontend-v3/src（改动 5 实现文件 + 6 旧测试适配）
- 实现文件（供核对 P2 方案吻合度）：frontend-v3/src/components/EntryCard.vue / EntryListRow.vue / BaseTag.vue、frontend-v3/src/views/EntryListView.vue、frontend-v3/src/views/searchUrl.logic.ts
</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.sh` 审计失败。
