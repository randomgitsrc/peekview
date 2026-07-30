---
phase: P7
generated_by: agate-inject-card.sh + 主 Agent
task_id: T082-arch-refactor
role: consistency-reviewer
---

<dispatch_guide>
> 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
跨文件一致性检查。对照 P1-P6 全部产出，确认实现忠实方案设计、BDD 验收完整、DESIGN_GAP 全部配对 REVIEWED。

### 约束
- P4 有 3 条 DESIGN_GAP（2 后端 + 1 前端），必须在 P7-consistency.md 中逐条转抄 + 配 [DESIGN_GAP_REVIEWED] 标记
- 无 SCOPE+ 增补（P1 无 [SCOPE+] 标记）
- 检查跨文件一致性：P2 packages vs P4 实现范围、P1 BDD 数 vs P6 PASS 数、P4 实现路径 vs P2 方案设计
- 无残留 [NEED_CONFIRM]、[BLOCKER]、[DEVIATION-CRITICAL]
- agent 字段填 consistency-reviewer

### 上游关联
- P1: 41 条 BDD, domains=[backend, frontend], risk=high, 无裁剪
- P2: 6 项重构方案 R1~R7, packages=[backend, frontend], gate_commands 已固化
- P3: 32 条红灯测试
- P4: R1~R7 实现, 3 条 DESIGN_GAP
- P5: 985+1078 测试全绿
- P6: 41 BDD 全 PASS

### P4 DESIGN_GAP 清单（必须在 P7 转抄 + REVIEWED）

1. [DESIGN_GAP: P2 指定删除 get_entry_service 但未提及现有测试 test_get_entry_service_from_app_state。已更新测试。]
2. [DESIGN_GAP: P2 未提及更新旧格式测试文件。R3 错误格式统一后 3 个旧测试文件使用 detail 读取，已更新为 error.message/code。]
3. [DESIGN_GAP: P3 测试文件 t082-store-split.spec.ts 中 STORES_DIR 路径错误，已修复。]

### 输入文件
- docs/tasks/T082-arch-refactor/P1-requirements.md（BDD + 范围声明）
- docs/tasks/T082-arch-refactor/P2-design.md（方案设计 + packages + gate_commands）
- docs/tasks/T082-arch-refactor/P4-implementation-backend.md（实现记录 + DESIGN_GAP）
- docs/tasks/T082-arch-refactor/P4-implementation-frontend.md（实现记录 + DESIGN_GAP）
- docs/tasks/T082-arch-refactor/P6-acceptance.md（BDD 验收结果）
- docs/tasks/T082-arch-refactor/P5-test-results/unit.md（测试结果）
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
### 跨文件一致性检查项
1. P2 packages: [backend, frontend] → P4 实现范围一致
2. P1 BDD 数: 41 → P6 PASS 数: 41 → 一致
3. P2 gate_commands → P5 执行的命令一致
4. P4 DESIGN_GAP: 3 条 → P7 须逐条 REVIEWED
5. 无 SCOPE+ 增补
6. 无 [NEED_CONFIRM] 残留
7. 无 [BLOCKER] 残留
8. [NO_NEED_CONFIRM] 存在于 P1

### P2 声明的 packages
- backend: backend/peekview/ 目录
- frontend: frontend-v3/src/ 目录
</objective_info>
