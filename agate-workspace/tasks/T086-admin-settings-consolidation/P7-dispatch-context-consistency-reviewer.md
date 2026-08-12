---
phase: P7
task_id: T086-admin-settings-consolidation
type: dispatch-context
role: consistency-reviewer
trace_id: T086-P7-20260807
created: 2026-08-07
---

# P7 派发指引 — consistency-reviewer

## 目标

对照 P1-P6 全部产出做跨文件一致性审查，确认实现未偏离设计、DESIGN_GAP 已闭环、无残留未决项。本任务改动文件较多（router.ts/SettingsView.vue/UserManagerTab.vue新建/AdminView.vue删除/UserMenu.vue/admin.spec.ts/t080-admin-route-guard.test.ts + P5 阶段追加的 router.ts 二次修复），且经历过两次真实的 gate 失败回退（P4→P5→P4 路由 bug + P5→P3 PAUSED 跨阶段回退测试选择器 bug），一致性检查需覆盖这些回退带来的产出碎片化。

## 约束

- **DESIGN_GAP 配对（重点，本任务有 1 条需要转抄）**：
  `P4-implementation.md` 第 29 行 `## [DESIGN_GAP: t068-account-settings.spec.ts 的 useAuthStore mock 需要同步修复]`——**注意该行是 markdown H2 标题格式（`## [DESIGN_GAP:...]`），gate 脚本的正则 `^\s*-?\s*\[DESIGN_GAP:` 不会匹配到 `##` 前缀，你在 P7-consistency.md 转抄时必须用 gate 契约要求的行首格式**（`[DESIGN_GAP: 描述]`，不带 `##`），否则即使你写了转抄，gate 也可能因为格式不对而误判。转抄后配对 `[DESIGN_GAP_REVIEWED: ...]`，你的审查结论：mock 修复是否合理（P4-implementation.md 已给出完整根因分析，只改了 mock 的 isAdmin 字段从字面量改为 computed，未改任何测试断言，且参照了同项目 UserMenu.spec.ts 已有的正确 mock 写法）
- **另一处间接相关的 DESIGN_GAP 决策**（非严格意义的 P4 声明，但同一机制下产生，建议一并复核）：`P2-design.md §3.6` 预先标注的 `[DESIGN_GAP: t080 的 15b/15c...]`，由 P3 test-designer 实际执行判断（it.skip + 详细理由，见 `P3-test-cases.md` 第 2 节），P2-review.md"核查②"已初步认可这个处理方式合理。P7 应基于 P3-test-cases.md 的实际理由（loading→resolve 时序已被 `t069-auth-guard.test.ts` 覆盖）独立复核这个判断是否站得住脚，而不是简单转抄 P2-review 的结论
- **回退历史交叉核对**：本任务 P5 阶段两次发现真 bug 并回退（第一次 P5→P4 修 router.ts 路由拦截问题；第二次 P5→P3 PAUSED 后修 admin.spec.ts 选择器 scope 问题）。P7 需确认：① 两次修复是否都已正确反映在最终代码/测试状态中（不是"曾经修过又被覆盖"）② P4-implementation-retry2.md 的路由修复与 P2-design.md §3.1 的原始设计意图是否一致（P2 假设 catch-all 天然生效，retry2 是对这个错误假设的修正，不是推翻设计）③ P3-fix-record.md 的选择器修复是否与 P2-design.md §4 UI 测试标识清单保持一致
- **跨文件一致性**：
  - P2 packages（`[peekview]`）与后续 P8 bump 范围应一致（P8 暂未执行，此处只需确认 P2 声明本身合理）
  - P1 的 17 条 BDD 与 P6-acceptance.md 的 17 条验收结果一一对应，编号无遗漏无错位
  - P4 的实现路径（router.ts/SettingsView.vue/UserManagerTab.vue/AdminView.vue删除/UserMenu.vue）与 P2-design.md §2"改什么"清单吻合
- **未决项清零**：确认 P1-requirements.md 无残留 `[NEED_CONFIRM]`（P1 当初就是 `[NO_NEED_CONFIRM]`，只有 3 条 SUGGEST，需确认这 3 条 SUGGEST 的采纳情况——P1-review.md 已判定"可直接采纳"，P7 应确认实际实现是否真的采纳了：① router.ts 死代码清理已随 P4 一并做（已做）② t080 测试文件原地重写而非新建删旧（已做）③ UserMenu 复用 Settings 按钮而非新增（已做，P4-implementation.md 已确认）

## 上游关联

parent: P6-acceptance.md（验收结果，17/17 PASS）
祖先: P1-requirements.md（BDD + SUGGEST）、P2-design.md + P2-review.md（方案 + DESIGN_GAP 预标注）、P3-test-cases.md（DESIGN_GAP 判断执行）、P4-implementation.md + P4-implementation-retry2.md（实现 + DESIGN_GAP 声明）、P5-gate-diagnosis.md + P5-gate-diagnosis-2.md（两次回退根因）、PAUSED-resolution.md（人工批准的跨阶段回退决策）

## 输入文件（按顺序读取）

1. `docs/tasks/T086-admin-settings-consolidation/P1-requirements.md`
2. `docs/tasks/T086-admin-settings-consolidation/P2-design.md`
3. `docs/tasks/T086-admin-settings-consolidation/P2-review.md`
4. `docs/tasks/T086-admin-settings-consolidation/P3-test-cases.md`
5. `docs/tasks/T086-admin-settings-consolidation/P4-implementation.md`
6. `docs/tasks/T086-admin-settings-consolidation/P4-implementation-retry2.md`
7. `docs/tasks/T086-admin-settings-consolidation/P5-gate-diagnosis.md`
8. `docs/tasks/T086-admin-settings-consolidation/P5-gate-diagnosis-2.md`
9. `docs/tasks/T086-admin-settings-consolidation/PAUSED-resolution.md`
10. `docs/tasks/T086-admin-settings-consolidation/P3-fix-record.md`
11. `docs/tasks/T086-admin-settings-consolidation/P6-acceptance.md`

## 客观查证信息

- 全部代码改动文件（最终状态）：`frontend-v3/src/router.ts`、`frontend-v3/src/views/SettingsView.vue`、`frontend-v3/src/components/settings/UserManagerTab.vue`（新建）、`frontend-v3/src/views/AdminView.vue`（已删除）、`frontend-v3/src/components/UserMenu.vue`、`frontend-v3/src/components/__tests__/t068-account-settings.spec.ts`（DESIGN_GAP 修复）、`frontend-v3/e2e/admin.spec.ts`、`frontend-v3/src/__tests__/t080-admin-route-guard.test.ts`
- P6 已 17/17 BDD PASS，gate 全部通过（主 Agent 已独立复核）

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
