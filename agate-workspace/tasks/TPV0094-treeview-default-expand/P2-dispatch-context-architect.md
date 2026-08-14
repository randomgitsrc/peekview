---
phase: P2
task_id: TPV0094-treeview-default-expand
type: design
parent: P1-requirements.md
trace_id: TPV0094-P2-20260814
status: draft
---

# P2 派发上下文 — architect

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

## 目标

产出 `P2-design.md`（方案设计 + 实现导航）：把 P1 需求基线（8 条 BDD）转化为可实现的技术方案，固化 gate_commands / files_to_read / minimal_validation。本任务 `design_trivial: true` + `follows_existing_pattern`（P1 已声明）→ 候选方案可只写 1 个，但 P2 不可省略。

## 关键设计输入（P1 已定，勿重做）

- **需求**：默认全展开 + 节点数超红线降级折叠+提示；红线需 Playwright CDP 实测（100/500/1000/2000/5000 节点首帧时间）
- **红线机制**：单一可配置常量（如 `DEFAULT_EXPAND_THRESHOLD`），值由实测后定（SUGGEST 采纳倾向）
- **改动面**：3 文件（TreeView.vue + TreeView.spec.ts + e2e/structured-data-viewer.spec.ts）——隐含需求 #1 发现现有 test_bdd_27/28 断言"初始折叠"必须同步改
- **requires_minimal_validation: true**（P1 frontmatter）→ **P2 必须产出 `minimal_validation` 块且 result 为 confirmed**——红线判定依赖浏览器渲染行为，P2 须给出实测协议（量级、首帧定义、判定口径），而非仅声明"纯代码逻辑"
- **不引入虚拟滚动**（P0-brief 明确：红线阈值降级替代虚拟滚动；DataTreeNode.vue 不改）

## 约束

1. **frontmatter 四字段**：`candidate_count` / `packages` / `domains` / `ui_affected` 必填。预期：packages=[frontend-v3/src/components/TreeView.vue, frontend-v3/src/components/__tests__/TreeView.spec.ts, frontend-v3/e2e/structured-data-viewer.spec.ts]，domains=[frontend]，ui_affected=true
2. **gate_commands 必须引用 Makefile target**（project.md 硬性要求：Makefile 是测试命令唯一真相源）：
   - P3/P5 单测：`make test-frontend`（vitest 非 watch）
   - P3_e2e/P5_e2e：`make debug-test` 或 `E2E_SPEC=<spec> make debug-test`（需 debug backend；CDP 模式可能超时——若需多量级实测，P5/P6 用自定义 Playwright 脚本，gate_commands 可声明 `make debug-quick` + 脚本路径）
   - 类型检查：`make typecheck`（CI 强制）
   - 注意 project.md：不跑完整 `make debug`（CDP 超时），优先 debug-quick + 自定义脚本
3. **files_to_read** 只列实现确实需要参考的文件（控制 P4 上下文）：
   - frontend-v3/src/components/TreeView.vue（resetExpansion/parseTree/matchCount/watch）
   - frontend-v3/src/components/DataTreeNode.vue（递归渲染 + aria-expanded 契约，确认不改）
   - frontend-v3/src/components/__tests__/TreeView.spec.ts（现有 13 用例 + test_bdd_27/28 需同步）
   - frontend-v3/src/types/structured-data.ts（TreeDataNode path/children/key/value/type）
   - frontend-v3/e2e/structured-data-viewer.spec.ts（现有 E2E 断言 + beforeAll 建 entry 先例）
4. **minimal_validation 必须包含红线实测协议**：量级选择（100/500/1000/2000/5000）、首帧渲染时间起止点口径（review 建议精确定义：导航起点？.tree-node 渲染完成判定？）、判定标准（如 5000 节点 < X ms 可全展开）、以及 P6 实测证据承接方式。若 P2 阶段无法实测（无 debug backend），必须给出"实测协议设计 + P6 执行"的明确交接，并在 minimal_validation 声明假设与验证方法——**result 必须是 confirmed 或设计为 P6 可执行验证的具体方案**（P1 requires_minimal_validation 要求 P2 产出 minimal_validation 块；若红线实测必须在 P6 完成，P2 的 minimal_validation 块声明方法/口径/判定标准 + result: 标注待 P6 实测确认的方式）
5. **BDD-5 的 fixture 选型依赖红线实测结果**（review 建议 100 vs 10000 固定余量规避依赖）——设计中给出明确 fixture 策略
6. **BDD-4 大文件手动展开 fixture 拆多个中等子树**（控制单次点击渲染量，review 建议）
7. **多量级 fixture 统一紧凑格式**（5000/10000 节点 < 2MB 截断线，review 已核实）
8. **UI 测试选择器**：声明稳定测试标识（如 data-testid）供 P3/P4 使用，避免绑定 class 命名
9. **环境隔离**：只读代码；设计期间不修改源码；如需最小验证运行环境，用 debug 隔离（:8888），严禁触碰 :8080/~/.peekview/
10. **P1 纯净性边界**：SUGGEST 倾向（常量名、提示样式复用 TruncationBanner 视觉模式、搜索命中自动展开留 backlog）由你在设计中定稿，P2 拥有设计决策权
11. 产出写 `agate-workspace/tasks/TPV0094-treeview-default-expand/P2-design.md`
12. 每读完一个输入文件，把发现追加到 `P2-progress.md`

## 输入文件

1. `agate-workspace/tasks/TPV0094-treeview-default-expand/P1-requirements.md`（需求基线 + 8 BDD + frontmatter 机器字段）
2. `agate-workspace/tasks/TPV0094-treeview-default-expand/P1-review.md`（评审意见，4 条非阻塞建议须承接）
3. `agate-workspace/tasks/TPV0094-treeview-default-expand/P0-brief.md`（env_constraints / known_risks）
4. `frontend-v3/src/components/TreeView.vue`（resetExpansion/parseTree/matchCount/watch 机制）
5. `frontend-v3/src/components/DataTreeNode.vue`（递归渲染 + isExpanded 契约）
6. `frontend-v3/src/components/__tests__/TreeView.spec.ts`（13 用例 + test_bdd_27/28）
7. `frontend-v3/src/types/structured-data.ts`（TreeDataNode）
8. `frontend-v3/e2e/structured-data-viewer.spec.ts`（E2E 断言 + beforeAll 建 entry 先例）
9. `AGENTS.md`（铁律）

## 验证手段（可用）

- 读代码（勿改）
- 如需看渲染行为可查现有 E2E spec 或 debug backend（:8888）——严禁触碰生产

## 产出规格

P2-design.md 必须包含（frontmatter 见 P2 阶段卡片样例）：
- `---` frontmatter：phase/task_id/type/parent/trace_id/status/created/agent + candidate_count/packages/domains/ui_affected
- 正文：候选方案（含权衡+选择理由，design_trivial 可 1 个但须附理由）+ gate_commands + files_to_read + env_constraints + minimal_validation（红线实测协议）
- 设计中发现新隐含需求 → 标 `[SCOPE+]`（行首声明格式）

## 返回

路径 + 一句话摘要（方案要点 + minimal_validation 结论 + candidate_count）。
