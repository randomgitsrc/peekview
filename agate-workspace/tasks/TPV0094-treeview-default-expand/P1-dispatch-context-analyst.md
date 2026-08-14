---
phase: P1
task_id: TPV0094-treeview-default-expand
type: requirements
parent: P0-brief.md
trace_id: TPV0094-P1-analyst-20260813
status: ready  # 2026-08-14 恢复现场：内容完整可直接复用（前一次派发的 subagent 挂掉，P1-requirements.md 未产出，恢复点=重派 analyst）
---

# P1 派发上下文 — analyst

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：phase-cards/P1-requirements.md
---
# P1 — 需求基线

> 当前状态：[首次 / 重试 #N]
> P1 不可裁剪（核心阶段）

## 如果是首次进入本阶段

1. 派发 analyst subagent → 产出 P1-requirements.md
   1.1 写 P1-dispatch-context-analyst.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 确认：BDD 验收条件 ≥1 条 + 无未决 NEED_CONFIRM
2.5 派发 requirements-review subagent（角色文件：{agate_root}/assets/review-roles/requirements-review.md）
     2.5.1 写 P1-dispatch-context-requirements-review.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
    输入：P1-requirements.md
    产出：P1-review.md（agent≠main，含 BDD 编号引用 + 覆盖维度标注）
    review 不通过 → analyst 修改 → 再 review → … → approved（⑩迭代循环）
3. 预跑 check-gate.sh P1（exit 2，主 Agent 自判）
4. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P1，不要提前写 P2——phase = 本 commit 的产出阶段
5. git commit -m "wf({Txxx}-P1): {摘要}"（phase=P1，P1 产出含 P1-requirements.md + P1-review.md）
6. P1 commit 完成后进入 P2：**phase 推进 P2 随 P2 产出 commit 一起**（P2-design.md + P2-review.md 就绪后），不是单独 phase commit

## 如果是重试

确认上一轮失败原因（BDD 不完整 / domains 声明错 / NEED_CONFIRM 未处理）
→ review 不通过时：analyst 修改需求 → 重派 requirements-review → 共享 retry 预算
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P1 MAX=3）

## 前置条件

- [ ] P0-brief.md 完成（四字段齐全）

## 派发

- **角色**：analyst（`{agate_root}/assets/execution-roles/analyst.md`）
- **输入**：P0-brief.md（env_constraints / known_risks / executor_env）
- **输出**：P1-requirements.md
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

P1-requirements.md 必须包含：
- BDD 验收条件（至少 1 条，Given/When/Then 格式）
- `domains:` 声明（backend / frontend / mcp / security）
- `packages:` 声明（受影响的包/模块）
- `risk_level:` 声明（low / medium / high）→ 决定 P2 评审强度
- `phases:` 裁剪声明（跳过哪些阶段 + 理由）
- `capability_requirements:` 能力需求声明（available / supplementable / GAP 三态）
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）；无待确认项时写 `[NO_NEED_CONFIRM]`

`risk_level`/`phases`/`packages`/`domains` 写在文件头 **frontmatter**（`---` 分隔块），不写正文。
**可直接复制的完整样例**：
```yaml
---
phase: P1
task_id: TAG0001           # 替换为实际任务编号
type: problems
parent: P0-brief.md
trace_id: T001-P1-20260101 # {task_id}-P1-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: analyst
# ── v2.0 机器字段 ──
risk_level: low             # low / medium / high，必填
phases: [P1, P4, P5, P6, P8]   # list of P\d+，必填
packages: [pkg-a]           # list，必填
domains: [backend, frontend]  # list，必填
# 可选字段：override / implicit_coupling / coupling_checklist / internal_only /
# internal_only_reason / 跳过风险 / design_trivial / follows_existing_pattern
# ── v2.0 refactor 任务类型声明（可选，缺省 = 功能任务）──
# change_type: refactor   # 当前仅支持 refactor；枚举非法值由 frontmatter schema 拦截
# ── v2.0 标记"已解决/已确认"状态（可选，仅标记存在时写）──
# need_confirm_resolved: []   # list[str]：已解决的 NEED_CONFIRM 项描述（逐条匹配正文）
# suggest_resolved: []        # list[str]：已采纳的 SUGGEST 项描述
# scope_resolved: []          # list[str]：已解决的 SCOPE+ 项描述
---
```

**NEED_CONFIRM 分级**：
- `[SUGGEST: 推荐 X，理由 Y]` - 有倾向但求确认。主 Agent 可自行采纳倾向（除非涉及破坏性变更/业务方向），不必问用户
- `[NEED_CONFIRM]` - 真无方向需人定夺。阻塞推进，主 Agent 问用户

## gate 规则

check-gate.sh P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式为 `#### BDD-NN:`）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件（全部满足才写 phase: P2）

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）
- [ ] P1-review.md status: approved（agent≠main，含 BDD 编号锚点）

## 常见错误

1. **BDD 写成技术实现而非用户行为**：BDD 应该描述"用户能看到什么/系统应该做什么"，不是"调用哪个 API"
2. **domains 声明不全**：漏了某个受影响域 → P2 不派该域的评审 → 实现方向错误
3. **capability_requirements 漏声明**：P6 验收时才发现需要但不可用的能力 → 返工
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P2 设计依赖 domains + risk_level 决定评审角色
- P6 验收逐条对照 P1 的 BDD（PASS/FAIL 总数必须 ≥ P1 BDD 总数）
- P7 一致性检查依赖 packages 声明做跨文件交叉核对

## 评审

P1 评审通用必有（所有任务都走 requirements-review），P2/P4 评审是 C8 域触发（见 review-mapping.md）——二者在"是否通用"上不对称，仅在"独立 subagent、agent≠main"上类比。P1 评审不可裁剪。
review 不通过 → analyst 修改需求 → 再 review（⑩迭代循环），直至 approved。

> 完成 → 读 phase-cards/P2-design.md


## P1 基线保护

P1-requirements.md 是需求基线，后续阶段（P2-P8）不应直接修改。如需变更（如 P4 发现 BDD 矛盾需补充注释），必须：
1. 主 Agent 显式批准
2. 在变更处标注 `[BASELINE_CHANGE: 理由]`
3. 不改 BDD 的 Given/When/Then 语义（只补充注释/优先级说明）
<!-- AGATE_CARD_END -->

## 目标

产出 `P1-requirements.md`（需求基线）：TreeView 默认展开行为优化的 BDD 验收条件 + frontmatter 机器字段。必须含 ≥1 条 BDD（Given/When/Then），无未决 NEED_CONFIRM。

## 任务背景（已读代码，非猜测）

详情页 TreeView（JSON/YAML/XML 结构化数据查看器）目前**默认只展开根节点**，用户想看内容必须手动逐层点开。用户倾向"默认全展开，性能受限再按需"。

**代码事实（已读，勿重查）**：
1. `frontend-v3/src/components/TreeView.vue:127-133` `resetExpansion()`：
   ```ts
   function resetExpansion() {
     if (treeData.value.length === 1 && treeData.value[0].children?.length) {
       expandedPaths.value = new Set([treeData.value[0].path])  // 只展开根
     } else {
       expandedPaths.value = new Set()
     }
   }
   ```
2. `DataTreeNode.vue` 是**递归自引用组件**（`<DataTreeNode v-for="child">`），每节点一个 Vue 组件实例，**无虚拟滚动**
3. **性能含义**：全展开渲染成本 ≈ 节点数 × 组件实例开销。估算：≤100 流畅、100~500 轻微卡顿、500~2000 明显卡顿、>5000 白屏风险——**红线需实测确定（P2 minimal_validation 或 P6 实测）**
4. `TreeView.spec.ts` 现有 13 用例（T075 BDD-24/25/26 相关）
5. `types/structured-data.ts` `TreeDataNode` 有 `path`/`children`/`key`/`value`/`type`

## 核心需求（用户确认）

1. **默认全部展开**（小/中文件直接一眼看完）
2. **性能保护**：节点数超红线时降级折叠 + 提示"内容较大，已折叠部分"
3. **红线需实测**：Playwright CDP 测不同量级（100/500/1000/2000/5000 节点）首帧时间，据实定阈值

## 约束

1. **BDD 必须描述用户可观察行为**，不是实现细节（例：「打开小 JSON → 全部节点可见」，不是「resetExpansion 遍历所有 path」）
2. **domains**：frontend
3. **packages**：frontend-v3/src/components/TreeView.vue（+ 可能 DataTreeNode.vue，由你判断）
4. **risk_level**：low（P0-brief 已定；纯前端单文件）
5. **phases**：默认全走；P3 保留（新增节点计数/阈值逻辑有可测行为）；P6 不可裁（Playwright 实测多量级首帧时间，ui_affected: true）；P7 单文件改动可裁（若只改 TreeView.vue）
6. **capability_requirements**：P6 需要 Playwright CDP 实测（能力 available）+ 构造多量级 JSON fixture（需说明如何构造——可写脚本生成测试 entry 或 seed-data）
7. **无 [NEED_CONFIRM]** 或全部转为 [SUGGEST]；无法自决的写 [NEED_CONFIRM] 列表，主 Agent 会人工处理
8. **标记格式**（前两轮教训）：`[NO_NEED_CONFIRM]` 和 `[SUGGEST: ...]` 必须**行首无反引号**（gate 正则匹配 `^\s*-?\s*\[NO_NEED_CONFIRM\]` / `^\s*-?\s*\[SUGGEST:`）
9. **环境隔离**：只读代码，不得修改任何文件（P1 是分析产出阶段）
10. 产出写 `agate-workspace/tasks/TPV0094-treeview-default-expand/P1-requirements.md`
11. 每读完一个输入文件，把发现追加到 `P1-progress.md`

## 输入文件

1. `agate-workspace/tasks/TPV0094-treeview-default-expand/P0-brief.md`（任务简报，env_constraints/known_risks）
2. `frontend-v3/src/components/TreeView.vue`（resetExpansion + parseTree + expandedPaths 机制）
3. `frontend-v3/src/components/DataTreeNode.vue`（递归渲染 + isExpanded 机制）
4. `frontend-v3/src/components/__tests__/TreeView.spec.ts`（13 现有用例）
5. `frontend-v3/src/composables/treeExpandKey.ts`（provide/inject 契约）
6. `frontend-v3/src/types/structured-data.ts`（TreeDataNode）
7. `AGENTS.md`（铁律）

## 验证手段（可用）

- 读代码（勿改）
- 如需看渲染行为可查现有 E2E spec（frontend-v3/e2e/ 下 t075 相关）

## 产出规格

P1-requirements.md 必须包含（frontmatter 见 P1 阶段卡片样例）：
- `---` frontmatter：phase/task_id/type/parent/trace_id/status/created/agent + risk_level/phases/packages/domains
- BDD 验收条件（`#### BDD-NN:` 编号锚点格式，Given/When/Then）
- capability_requirements（available/supplementable/GAP 三态）
- 无未决 [NEED_CONFIRM]（有则写列表；无则行首 `[NO_NEED_CONFIRM]`）

## 返回

路径 + 一句话摘要（BDD 条数、domains、有无 NEED_CONFIRM）。
