# P2 Dispatch Context — architect

## 任务目标

为 TPV0088（e2e-test-infra-hardening）产出方案设计 `P2-design.md`。P1 已固化 9 条 BDD + 12 项死选择器 + 4 项数据依赖，你的职责是**将测试基础设施修复转化为可实现方案**（两个子任务），并给出实现导航。

## 上游关联

- 输入文件（必读）：
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P0-brief.md`（环境约束 + 代码审计）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P1-requirements.md`（需求基线 + 9 BDD + IMPL-S1~S12 + IMPL-D1~D4 + IMPL-B1~B3）
  - `docs/tasks/TPV0088-e2e-test-infra-hardening/P1-review.md`（评审意见）
  - `AGENTS.md`（项目约定）
  - `frontend-v3/e2e/viewer.spec.ts`（子任务 A 被修文件，必读）
  - `scripts/e2e-safety-check.sh`（子任务 B 加固点，必读）
  - `Makefile:540-650`（debug-build/debug-test 现状）

## 已确认事实（P1 结论，直接采用）

1. **子任务 A**：viewer.spec.ts 19 用例（P0 审计 20 是错的）
   - 路由：`/#/entry/{slug}` → `/{slug}`（17 处需改）
   - slug：`lu4prg`→python-entry-service、`ngajri`→markdown-test/mermaid-charts
   - **12 项死选择器/过时断言**（IMPL-S1~S12）：.code-header/.mobile-actions/.toc-btn/.list-header/.btn-icon 等禁止，.file-sidebar/.toc-sidebar/.mobile-bottom-bar/.theme-toggle/[data-testid] 等允许
   - **4 项数据依赖**（IMPL-D1~D4）：TC-041 用 json-api-config（单文件）、TC-004/005/030/042 用 python-entry-service、TC-010~012/020~023/040 用 markdown-test、TC-013 用 mermaid-charts
2. **子任务 B**：e2e-safety-check.sh 加 Check 6（mtime 校验）——`find frontend-v3/src -newer backend/peekview/static/index.html` 有输出即判过期，报错提示 `make build-frontend`（[SUGGEST] 已采纳，主 Agent 批准）
3. **P7 不可裁**：三文件改动（viewer.spec.ts + Makefile + e2e-safety-check.sh）
4. **P3 最小 TDD 仅子任务 B**（shell 逻辑可测）；子任务 A 是测试代码本身，验收锚点 = BDD-1 的 19/19 实跑

## 约束

- P2 可简化单候选方案（`follows_existing_pattern`，P1 已声明）：子任务 A 沿用 spec 内 helper + seed 引用模式，子任务 B 沿用脚本 Check1-5 模式
- 但两个子任务的方案都要写清楚（不是只写一个子任务）
- 产出文件必须含四字段：packages / domains / ui_affected / gate_commands（P2 固化）
- `ui_affected: false`（这是测试基础设施改动，无用户可见 UI 变化）——但 E2E 验证需要浏览器，gate_commands.P5_e2e 仍应声明（验证测试本身）
- 必须产出 `files_to_read`（P4 implementer 上下文地图）
- 必须产出 `minimal_validation`（子任务 B 的 mtime 校验逻辑可先用 shell 命令验证可行性）
- frontmatter：candidate_count（可 1，附理由）/ packages / domains / ui_affected

## 输入文件列表（按序读取，每读完一个追加 P2-progress.md）

1. `docs/tasks/TPV0088-e2e-test-infra-hardening/P1-requirements.md`
2. `docs/tasks/TPV0088-e2e-test-infra-hardening/P0-brief.md`
3. `frontend-v3/e2e/viewer.spec.ts`
4. `scripts/e2e-safety-check.sh`
5. `Makefile:540-650`
6. `AGENTS.md`

## 产出要求

`docs/tasks/TPV0088-e2e-test-infra-hardening/P2-design.md`

frontmatter 样例（四字段必填）：
```yaml
---
phase: P2
task_id: TPV0088-e2e-test-infra-hardening
type: design
parent: P1-requirements.md
trace_id: TPV0088-P2-20260812
status: draft
created: 2026-08-12
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 1
packages: [peekview]
domains: [test-infra]
ui_affected: false
---
```

gate_commands 建议（供参考，可调整但必须声明）：
```yaml
gate_commands:
  P3: "bash scripts/e2e-safety-check.sh --test-mtime"  # 子任务 B 的 TDD 测试命令（或等价）
  P5: "make test-quick"
  P5_typecheck: "make typecheck"
  P5_e2e: "E2E_SPEC=e2e/viewer.spec.ts make debug-test"
  project_module: ""
```

## 返回给主 Agent

两行：产出文件路径 + 一句话摘要（方案要点，不超过 30 字）

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

<objective_info>
- 环境状态：debug backend :8888 当前未运行（P3/P6 需启动）；CDP Chrome :18800 可用
- 关键标识：viewer.spec.ts（19 用例，17 处 hash 路由 + 12 死选择器 + 4 slug 映射）；e2e-safety-check.sh（现有 5 项检查，需加 Check 6 mtime）
- 查证结果：P1 基线 9 BDD，P7 不可裁，P3 最小 TDD 仅子任务 B
</objective_info>
