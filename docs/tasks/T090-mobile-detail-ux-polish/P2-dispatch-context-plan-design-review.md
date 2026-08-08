---
phase: P2
task_id: T090-mobile-detail-ux-polish
role: plan-design-review
---

# 派发指引 — T090 P2 方案设计评审

## 目标

评审 `P2-design.md`（architect 产出，6 个候选方案：问题 1 组件边界 2 个、问题 2 viewport 定位 2 个、问题 3 边距归零 2 个）。按角色定义的评分维度逐项评审，重点关注移动端布局方案的完整性、交互状态覆盖、组件完整性。

## 上游关联

- P1-requirements.md（approved，12 条 BDD）是需求基线
- P2-design.md 的 minimal_validation 用 Playwright CDP 做了真实验证：assumption_1（position:fixed 贴底稳定性）confirmed，assumption_2（100dvh 增量收益）inconclusive，按此结论选择候选 2-A（仅 position:fixed，不改 100dvh）——请核实这个"inconclusive → 不采用"的推理链是否站得住，而不是想当然接受
- `[BASELINE_CHANGE]` 落实：P2-design.md 第 3 节给出了 DESIGN.md 具体修订文字，请核对修订文字是否准确反映了代码改动（文档与代码是否会保持一致）

## 必读输入文件

1. `docs/tasks/T090-mobile-detail-ux-polish/P2-design.md`（待评审主文件）
2. `docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（核对候选方案是否真的覆盖全部 12 条 BDD，尤其 BDD-6/7 wrap 拆分场景、BDD-9 极小屏、BDD-10/11/12 桌面不回归）
3. `DESIGN.md`（核对第 3 节修订文字与现有文字的上下文是否吻合，行号是否准确）

## 重点检查项

1. **组件完整性**：`EntryMetaTagsBar.vue` 新组件的 props（`currentEntry`/`relativeTime`）+ 触发条件（`v-if="isMobile && currentEntry"`）+ zen-mode 隐藏机制（依赖父级 `:deep()` 选择器 + 保留 `class="meta-tags-bar"`）是否描述完整，P4 implementer 能否凭这份描述直接实现，不需要猜测。
2. **文档里有一处"见正文 [DESIGN_GAP 提示]"的引用**（在 files_to_read 的 entryDetailKeys.ts 条目里，关于 zen-mode 是否要求 meta bar 也隐藏），但全文搜索未见真正的 `[DESIGN_GAP:]` 标记段落——请核实这个问题是否已经在第 2 节候选 1-B"实现细节"第 3 点里被实际回答（"不需要 inject(ZenModeKey) 自己隐藏，统一由父级 :deep() 选择器处理"），如果已经回答就是一处措辞遗留（无实质缺口，只是文字没删干净），如果没有真正回答清楚则是真实缺口，需要打回补充。
3. **移动端布局方案**：候选 2-A 里 `.content-area` 新增的 `padding-bottom: calc(var(--mobile-bar-height) + env(safe-area-inset-bottom, 0px))` 与 zen-mode override 的具体 CSS 选择器写法是否清楚（P4 能否照着实现，还是需要自己设计选择器）。
4. **边界/异常状态**：底部操作栏内容溢出/按钮换行导致高度超出 `--mobile-bar-height` token 这一风险点（第 1 节"风险在哪"已提及但缓解措施较弱），是否需要更明确的兜底方案，还是接受作为已知限制。
5. **候选方案权衡是否充分**：尤其问题 2 的两个候选，选择理由是否真正基于 minimal_validation 的实测数据（而非套话），检查 assumption_1/assumption_2 的验证方法本身是否合理（CDP `Emulation.setDeviceMetricsOverride` 模拟三种可视高度是否足以代表"地址栏收起/展开"这个真实场景，还是过度简化）。

## 评分维度（角色定义已列出，逐项打分）

- 交互状态覆盖率（loading/error/empty/edge case）
- AI Slop 风险（spec 有没有给实现留"随便搞"的空间）
- 移动端考虑
- 可访问性（键盘导航/屏幕阅读器，本任务改动的是布局定位，是否影响可访问性需说明）
- 组件完整性

## 门槛（什么算完成）

- 产出 P2-review.md，Header `status:` 字段准确反映结论
- 各维度评分 + 具体理由（不是裸分数）
- 结论明确指出是否需要补充 spec，若 approved 需说明"以上重点检查项均已核实通过"

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
