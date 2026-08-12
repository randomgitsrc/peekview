---
phase: P2
task_id: T090-mobile-detail-ux-polish
role: architect
---

# 派发指引 — T090 P2 方案设计修订（第 1 轮，review needs-revision）

## 上轮产出

- 上轮 P2-design.md：`docs/tasks/T090-mobile-detail-ux-polish/P2-design.md`（不要重写，增量修订）
- 评审意见：`docs/tasks/T090-mobile-detail-ux-polish/P2-review.md`（status: needs-revision，候选方案本身不需要重新评估，只需在已选定方案基础上补写/修正）

## 修复目标（3 处必须 + 3 处建议）

### 必须 1：files_to_read 路径错误

第 46 行 `frontend-v3/src/components/entryDetailKeys.ts` 应为 `frontend-v3/src/composables/entryDetailKeys.ts`（已核实 `EntryDetailHeader.vue`/`EntryDetailMobileBar.vue`/`EntryDetailView.vue` 中 import 语句均为 `from '@/composables/entryDetailKeys'`）。直接改路径即可。

### 必须 2：zen-mode 下 content-area padding-bottom override 缺具体选择器

第 2 节候选 2-A 只说"zen-mode 下需要 override 回退为普通 `var(--space-3)`"，没说写在哪个文件、用什么选择器。请明确：追加到 `EntryDetailView.vue:251-254` 现有的 zen-mode `:deep()` 块里，新增一条类似 `.entry-detail.zen-mode :deep(.content-area) { padding-bottom: var(--space-3); }` 的规则（具体写法你可以核实现有 zen-mode 块的实际选择器风格后给出准确写法）。同时把这条新规则加入第 5 节"实现完成的标志"清单，作为 P4 的可核对项。

### 必须 3：完全缺失可访问性影响说明

dispatch-context 曾明确要求"是否影响可访问性需说明"，但全文没有任何 accessibility/键盘导航/屏幕阅读器讨论。请补充一节（可放在第 1 节"风险在哪"之后，或单独一个"可访问性影响"小节），至少覆盖评审指出的两点：
1. meta-tags-bar 从 header 移入 content-area 后 DOM 顺序/Tab 顺序变化（原：header 之后、content 之前；现：content 内部第一个子节点）对屏幕阅读器朗读顺序、Tab 遍历顺序是否有影响
2. `.mobile-bottom-bar` 改为 `position: fixed` 后是否造成视觉位置（底部）与 DOM 位置（与 content 同级紧随其后）不一致导致的 Tab 焦点跳转体验变化

哪怕结论是"无实质影响，理由是……"也必须显式写出，不能空缺。请给出你的实际判断（大概率影响很小，因为 DOM 结构本身未变，只是 CSS 定位方式变化——但需要你自己核实并给出理由，不是简单抄这句话）。

## 建议修复（不阻塞，但请顺手改掉）

### 建议 1：先例引用错误

候选 1-B"实现细节"第 3 点说"与 `.mobile-sticky-header`/`.mobile-bottom-bar` 现有做法一致"——经评审核实这两个组件实际上都同时带有 `v-show="!zenMode"` 且叠加父级 `:deep()`（两套机制并存），与文档描述的"只靠父级 `:deep()`"不符。真正一致的先例是原 `.meta-tags-bar` 自身（`EntryDetailHeader.vue:72`，只有 `v-show="isMobile"`，没有内部 zenMode 判断）。请把这句先例引用改为"与原 `.meta-tags-bar` 自身既有做法一致"（技术决策本身是对的，只是援引的参照物说错了）。

### 建议 2：loading/error/empty 状态下 content-area 底部留白

候选 2-A 的 `.content-area` padding-bottom 是纯 CSS（不依赖 JS 状态），但 `EntryDetailMobileBar.vue` 是 `v-if="isMobile && currentEntry"`（currentEntry 未加载完成前不渲染）。这意味着 loading/error/empty 状态下 bottom bar 不渲染，但 content-area 仍预留了它的底部净空，产生不必要的空白。请在"风险在哪"一节补充这一点并给出取舍结论（接受这个次要留白 / 或用 v-if 联动清除 padding，你判断哪个更合适并说明理由，不需要架构级改动）。

### 建议 3：底部栏按钮组合宽度量化依据

请把评审已经算过的估算补充进"风险在哪"一节（多文件+markdown+source-toggle+copy+overflow，或多文件+代码类+wrap+copy+overflow，实测按钮宽度组合在 300-340px 区间，小于 375px 最小验证宽度，正常场景不会触发换行；极端场景如浏览器文字缩放/超大字体属于已知限制，与本任务无关，不新增验证），把"正常场景不会触发"从隐含变为显式。

## 不要做的事

- 不要重新评估候选方案本身（1-A/1-B、2-A/2-B、3-A/3-B 的选型与理由已确认合格，不需要改）
- 不要改动 minimal_validation 字段（已确认站得住）
- 不要改动 DESIGN.md 修订文字（第 3 节，已核对准确）
- 不要改动 data-testid 清单（第 4 节，已确认清晰）

## 门槛（什么算完成）

- 3 处必须项均已修复，可被下一轮评审逐条核对
- 3 处建议项已顺手修正
- 其余部分保持不变

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P2

路径：phase-cards/P2-design.md
---
# P2 — 方案设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P2 不可裁剪。design_trivial / follows_existing_pattern 可简化（1 个候选方案），不可省略。

## 如果是首次进入本阶段

1. 派发 architect subagent → 产出 P2-design.md
   1.1 写 P2-dispatch-context-architect.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 C8 映射表派评审（见下方）
3. 评审通过 → P2-review.md status: approved
4. 预跑 check-gate.sh P2（脚本化检查）
5. 更新 .state.yaml phase=P2 → P3
6. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
7. git commit -m "wf({Txxx}-P2): {摘要}"

## 如果是重试

确认上一轮失败原因（方案选择有误 / 候选方案不足 / 评审 rejected）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P2 MAX=3）

## 前置条件

- [ ] P1-requirements.md 含 domains / risk_level / phases 声明
- [ ] P0-brief.md env_constraints 可查阅

## 派发

- **角色**：architect（`{agate_root}/assets/execution-roles/architect.md`）
- **输入**：P1-requirements.md + P0-brief.md
- **输出**：P2-design.md
- **派发 prompt 追加**：

```
## P2 最小验证
方案设计前，先用最小验证确认关键假设（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。
验证结果写入 P2-design.md 的 minimal_validation 字段。
- 方案依赖浏览器行为/安全模型/外部系统行为 → 必须做最小验证
- 纯代码逻辑 → 须在 minimal_validation 字段声明 `纯代码逻辑，无外部系统依赖`（须写明依赖了哪些内部函数/数据转换）
```

## 产出规格

P2-design.md 必须包含：
- **候选方案 ≥2** + 权衡 + 选择理由（design_trivial / follows_existing_pattern 时可只写 1 个，见下方）
- **`candidate_count: N` 必填**：本方案候选方案数（≥2，design_trivial/follows_existing_pattern 时可 1），gate 按此字段校验，不再解析标题。你写几个候选就填几个，与正文一致。
- **四字段**：`packages:` `domains:` `ui_affected:` `gate_commands:`
- **files_to_read**：实现时需要参考的文件清单（控制 P4 implementer 上下文）
- **env_constraints**：确认/细化 P0-brief 的环境约束
- **minimal_validation**：验证结果 或 声明"纯代码逻辑，无外部系统依赖"（声明时须附理由）

候选方案简化（须附理由，无理由视为无效声明，要求 ≥2 候选方案）：
- `design_trivial: true` + 理由（为什么 trivial）→ 可只写 1 个候选方案（P2 仍不可省略）
- `follows_existing_pattern: [src/foo.py]`（列出参照文件路径）→ 可只写 1 个候选方案，参照已有模式（P2 仍不可省略）

## gate_commands 声明

gate_commands 在 P2 固化，后续阶段按此执行：

```yaml
gate_commands:
  P3: "pytest"                  # 可选：测试运行器（verbose 输出，供 check-tdd-red.sh 自动读取）
  P5: "pytest -q --tb=no"       # 紧凑输出模式
  P5_e2e: "playwright test --reporter=line tests/e2e/"  # ui_affected: true 时必填
```

## 评审派发（C8 机械映射）

按 P1 声明的 domains + risk_level 机械映射评审：

| domain | risk_level | 必须派的评审 |
|--------|------------|------------|
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review |

多个评审角色 `专家组并行` → 组长汇总 → P2-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件（示例非穷举，按 C8 映射表触发）：
   - plan-eng-review → P2-review-eng.md
   - plan-design-review → P2-review-design.md
   - plan-ceo-review → P2-review-ceo.md
   - cso → P2-review-cso.md
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长输入：所有评审文件路径
5. 组长产出：P2-review.md（统一 status: approved / rejected）。**组长 subagent 产出的 P2-review.md 的 Header agent 字段必须是组长角色名（非 main）——check-gate.sh P2 硬拦截 agent=main 的 approved**
6. 组长规则：
   - 不发表新意见，只汇总
   - 任何专家标 BLOCKER → status: rejected
   - 多位专家分歧 → 标「专家组分歧」交人工
   - 全票无 BLOCKER → status: approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P2-review.md。

review 不通过 → architect 修改方案 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

**UI 测试选择器**：涉及前端时，P2 design 建议声明 UI 组件的稳定测试标识清单（如 `data-testid`，而非 class 命名）。P3 test-designer 用稳定标识定位元素，P4 implementer 按清单实现--class 命名可重构，稳定标识不变。具体方案由 P2 architect 决定。

## gate 规则

```bash
check-gate.sh P2 $TASK_DIR
```

- 候选方案数 ≥2（design_trivial / follows_existing_pattern 时可只写 1 个）
- P2-review.md 存在且 status: approved（agent≠main）— 不存在 → gate exit 1
- 四字段齐全（packages/domains/ui_affected/gate_commands）
- gate_commands.P3 可选（非 pytest 项目建议声明，供 check-tdd-red.sh 自动读取测试运行器）
- 候选方案 ≥2 时含权衡/选择理由

## 推进条件（全部满足才写 phase: P3）

- [ ] P2-design.md 候选方案 ≥2（或 design_trivial/follows_existing_pattern 须附理由时可只写 1 个）+ 四字段齐全
- [ ] P2-review.md 存在且 status: approved（agent≠main）
- [ ] gate_commands.P5_e2e 已声明（ui_affected: true 时）

## 常见错误

1. **忘了最小验证**：方案依赖外部系统行为（API MIME 类型、浏览器 CSP 等）但直接假设前提成立 → 到 P6 才发现不可行。跑一个 curl / 10 行 HTML 就能 5 分钟发现
2. **gate_commands.P5 只列单元测试**：UI 任务时缺少 P5_e2e → P5 不会跑端到端验证
3. **files_to_read 列太多文件**：把所有相关文件都列上 → P4 implementer 上下文爆炸。只列确实需要参考的
4. **忘了派评审**：按 C8 映射机械执行，不靠"觉得不需要"
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P4 依赖 files_to_read 导航代码阅读范围
- P5 依赖 gate_commands 执行验证命令
- P6 依赖 ui_affected 判断是否需要 vision-helper
- gate_commands 在 P2 固化后 P4-P6 不能改——设计阶段是声明验证契约的唯一窗口

> 完成 → 读 phase-cards/P3-tdd.md
<!-- AGATE_CARD_END -->
