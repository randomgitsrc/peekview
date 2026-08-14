---
phase: P2
task_id: TPV0094-treeview-default-expand
type: design
parent: P2-design.md
trace_id: TPV0094-P2-rev1-20260814
status: draft
---

# P2 Dispatch Context — architect（修订轮 rev1）

> 修订对象：`P2-design.md`（经 plan-design-review 评审为 **needs-revision**）
> 上轮 dispatch-context：`P2-dispatch-context-architect.md`（复用其全部约束——四字段/gate_commands/files_to_read/minimal_validation 要求等，本文件只做增量修订）
> 上轮评审意见：`P2-review.md`

## 修订原则

- **不重写完整目标/约束**——引用上轮 dispatch-context 与评审文件，只做增量修订
- 逐条处理评审「必须修订项」R1/R2/R3；「次要建议」逐条给出采纳/不采纳决策（不采纳写明理由）
- 修订后 P2-design.md 的 frontmatter 四字段 / gate_commands / minimal_validation 仍完整合规

## 必须修订项（评审明确列出，全部处理）

### R1（F2 实质缺陷）：大平层树边界 + 性能保护

评审指出的缺陷：`<tree-view>` 单根+海量叶子（`{"list":[...]}`）与顶层宽数组（`[1..5000]`）在 `totalNodeCount > 阈值` 时会显示「内容较大，已折叠部分」banner 但**实际未折叠任何内容**（违反 BDD-3 Then「.tree-node 数量小于节点总数」语义），且单根形态性能保护失效。

**按评审推荐方案修订**（写进 §3 边界处理）：
1. `> 阈值` 时 `expandedPaths` 置**空 Set**（折叠根也折叠）——保证任何超阈值树都真实折叠
2. `shouldCollapse` 定义：`computed(() => totalNodeCount.value > DEFAULT_EXPAND_THRESHOLD && 存在含子节点的节点)`——顶层宽数组（无含子节点节点）不显示 banner，诚实
3. BDD-4（大文件折叠态手动展开）首步点击根 toggle 即可展开第一层，语义自洽
4. 同步检查：此修订对 BDD-3（10000 节点大 JSON 折叠+banner）与 BDD-4 的 fixture 影响——大文件 fixture 用「根→多个中等子树分支」（§4.3 保留）时根含子节点 → banner 显示条件满足；单根+海量叶子的平铺 fixture 走 BDD-8 红线实测（见 R3），不用于 BDD-3

### R2（F1 规格）：补 shouldCollapse 定义

在 §3 补 `shouldCollapse` 的完整定义（与 §2 代码块一致，按 R1 语义）：
- 满足 R1 的语义：`totalNodeCount > 阈值 && 存在含子节点节点`（可写成 `treeData.value.some(...)` 递归判断，或等价 computed）
- 明确 banner 渲染条件 = `shouldCollapse` 为 true 且在非 truncated 分支

### R3（F3 规格）：红线协议 fixture 结构 + 括注修正

§8 redline_protocol 修订：
1. **声明红线 fixture 为平铺结构**：单根 + N-1 叶子（如 `{"data": [leaf, leaf, ...]}`，根含 N-1 叶子），保证单次点击根 toggle 即达 N 个 `.tree-node`——消除「深层 fixture 单次根点击无法达到 N」的协议悬挂
2. **删除错误括注**：「阈值以上量级初始折叠，直接测」与 §2 else 分支矛盾——统一改为**所有量级走同一测量路径**：`折叠 → T0 → 点击根 toggle → 等 .tree-node == N → T1`（阈值以下初始展开则先折叠；阈值以上初始折叠则直接 T0→点击）
3. 各量级（100/500/1000/2000/5000）fixture 均为该平铺结构，量级=N（节点总数）

## 次要建议（逐条决策，不阻断）

- F5：candidate B 否决理由「P0-brief 明确要求不改」改为引用 P1 隐含需求 #4（事实准确性）→ **采纳**（顺手修订表述）
- F4：frontmatter `packages:` 补入 `frontend-v3/scripts/measure-treeview-perf.ts` → **采纳**（与 [SCOPE+] 自述一致）
- P3 单测 BDD-3 用 >阈值 fixture（约 2001 节点）注意 jsdom 挂载耗时，可用深层链结构降低渲染面 → **采纳**（写进 §9 或实现提示）
- 移动端：补一句「移动端同受单阈值保护，未分端」显式说明 → **采纳**（§7 env_constraints 或正文）

## 修订产出

更新 `agate-workspace/tasks/TPV0094-treeview-default-expand/P2-design.md`（在原文件上修订，保留四字段/gate_commands/minimal_validation 合规）：
- §2 代码块（else 分支 expandedPaths 空 Set + shouldCollapse 条件）+ §3 边界处理 + §8 redline_protocol + frontmatter packages + 移动端说明
- 修订处不必专门标注（P2 阶段文档可改；P1 基线保护只约束 P1-requirements.md）

## 返回

路径 + 一句话摘要（修订要点，含 R1/R2/R3 处理结论）。

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
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P2，不要提前写 P3——phase = 本 commit 的产出阶段
6. git commit -m "wf({Txxx}-P2): {摘要}"（phase=P2，P2 产出含 P2-design.md + P2-review.md）
7. P2 commit 完成后进入 P3：**phase 推进 P3 随 P3 产出 commit 一起**（P3-test-cases.md 就绪后），不是单独 phase commit

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

`candidate_count`/`packages`/`domains`/`ui_affected` 写在文件头 **frontmatter**（`---` 分隔块），
不写正文；`gate_commands:`/`files_to_read:`/`env_constraints:`/`minimal_validation:` 留正文。
**可直接复制的完整样例**：
```yaml
---
phase: P2
task_id: TAG0001           # 替换为实际任务编号
type: design
parent: P1-requirements.md
trace_id: T001-P2-20260101 # {task_id}-P2-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2                # int ≥1，必填
packages: [pkg-a]                 # list，必填
domains: [backend, cli]           # list，必填
ui_affected: false                # bool，必填
---
```

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
| backend | 任意 | plan-eng-review（P2 方案评审） |
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review |

> **去重说明**：同一任务命中多行且触发同一评审角色时，去重只派发一次（如 backend + high 均命中 plan-eng-review，只派 1 个 plan-eng-review，不重复派发）。

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

<objective_info>
- 环境状态：P2 阶段，debug backend 未启动（红线实测留 P6）；只读设计
- 关键标识：修订对象 P2-design.md（评审 needs-revision，3 必须修订项 R1/R2/R3 + 4 次要建议）
- 上轮评审文件：P2-review.md（plan-design-review 产出）
</objective_info>
