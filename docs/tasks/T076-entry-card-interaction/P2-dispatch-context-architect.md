---
phase: P2
generated_by: agate-inject-card.sh + 主 Agent
task_id: T076
role: architect
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `docs/tasks/T076-entry-card-interaction/P2-design.md`：为 T076 设计实现方案（EntryCard/EntryListRow `<a>` 拆分 + BaseTag 可点击 + Explore tag 过滤 + tag-overflow tooltip），含 ≥2 候选方案 + 权衡 + 选择理由 + 四字段（packages/domains/ui_affected/gate_commands）+ files_to_read + env_constraints。

### 约束

- 纯前端（Vue 3 + TypeScript），**不改后端**（tag 过滤 API 已就绪）
- 必须遵循 `DESIGN.md` 设计系统（CSS 变量、spacing、typography、radius），不引入 UI 框架
- `ui_affected: true`（前端 UI 任务）→ `gate_commands.P5_e2e` 必填（Playwright 端到端）
- `gate_commands` 用紧凑输出模式，**引用 Makefile target**（Makefile 是测试命令唯一真相源）：typecheck / test-frontend / build-frontend / debug-test
- `files_to_read` 只列实现确实需要参考的文件（控制 P4 implementer 上下文，不要整目录全列）
- 必须覆盖移动端（tag 点击跳转、tag-overflow tooltip 在 touch 下可用）和键盘可访问性（`<a>` focus 样式）
- 范围边界：不含 tag 共现/自动补全/颜色编码（P0 已排除）

### 上游关联

P1 analyst 建立 21 条 BDD 基线，requirements-review approved（覆盖完整）。关键修正：tag 过滤目标路径从 P0 约定的 `/?tags=xxx` 修正为 `/explore?tags=xxx`（已核实 router.ts 路由）。设计时以 P1-requirements.md 的 BDD 为准。

### 输入文件

- `docs/tasks/T076-entry-card-interaction/P1-requirements.md`（21 条 BDD 验收条件 + domains/packages/risk_level/phases）
- `docs/tasks/T076-entry-card-interaction/P0-brief.md`（范围 A/B/C/D + 目标 HTML 结构 + 不做清单）
- `AGENTS.md`（项目约定、铁律、前端架构、常用命令）
- `DESIGN.md`(前端设计系统)
- 现状组件（按需读，理解当前结构）：`frontend-v3/src/components/EntryCard.vue`、`EntryListRow.vue`、`BaseTag.vue`、`frontend-v3/src/views/EntryListView.vue`、`frontend-v3/src/router.ts`、`frontend-v3/src/api/client.ts`
</dispatch_guide>

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
## P2 最小验证（若方案依赖浏览器行为/安全模型/外部系统行为）
方案设计前，先用最小验证确认关键假设（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。
验证结果写入 P2-design.md 的 minimal_validation 字段。纯代码逻辑不需要最小验证。
```

## 产出规格

P2-design.md 必须包含：
- **候选方案 ≥2** + 权衡 + 选择理由（design_trivial / follows_existing_pattern 时可只写 1 个，见下方）
- **四字段**：`packages:` `domains:` `ui_affected:` `gate_commands:`
- **files_to_read**：实现时需要参考的文件清单（控制 P4 implementer 上下文）
- **env_constraints**：确认/细化 P0-brief 的环境约束
- **minimal_validation**（若方案依赖外部行为）

候选方案简化：
- `design_trivial: true` → 可只写 1 个候选方案（P2 仍不可省略）
- `follows_existing_pattern: [src/foo.py]` → 可只写 1 个候选方案，参照已有模式（P2 仍不可省略）

## gate_commands 声明

gate_commands 在 P2 固化，后续阶段按此执行：

```yaml
gate_commands:
  P5: "pytest -q --tb=no"       # 紧凑输出模式
  P5_e2e: "playwright test --reporter=line tests/e2e/"  # ui_affected: true 时必填
```

## 评审派发（C8 机械映射）

按 P1 声明的 domains + risk_level 机械映射评审：

| domain | risk_level | 必须派的评审 |
|--------|------------|------------|
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| 业务方向不明 | 任意 | plan-ceo-review / office-hours |

多个评审角色 `专家组并行` → 组长汇总 → P2-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
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

## gate 规则

```bash
check-gate.sh P2 $TASK_DIR
```

- 候选方案数 ≥2（design_trivial / follows_existing_pattern 时可只写 1 个）
- P2-review.md status: approved（文件存在时检查）
- 四字段齐全（packages/domains/ui_affected/gate_commands）
- 候选方案 ≥2 时含权衡/选择理由

## 推进条件

- [ ] P2-design.md 候选方案 ≥2（或 design_trivial/follows_existing_pattern 可只写 1 个）+ 四字段齐全
- [ ] P2-review.md status: approved（P2 未被裁剪时）
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
- 环境状态：debug backend http://127.0.0.1:8888（隔离 DB /tmp/peekview-debug/），版本 0.11.2；CDP Chrome 150 + vision 验收能力完整；`make debug-seed` 可灌测试数据（alice/bob/carol + 12 条目含多 tag）
- 关键标识（前端文件，均存在）：
  - frontend-v3/src/components/EntryCard.vue（card-body 当前是 `<a>`，需拆分为 `<div>` + 子级独立 `<a>`）
  - frontend-v3/src/components/EntryListRow.vue（同源结构问题，同步修复）
  - frontend-v3/src/components/BaseTag.vue（当前纯 `<span>`，需变 `<a href="/explore?tags=xxx">`）
  - frontend-v3/src/views/EntryListView.vue（需读 URL query `tags` 传 API + UI chips 指示）
  - frontend-v3/src/router.ts（页面路由 /:slug；Explore 列表路由 /explore）
  - frontend-v3/src/api/client.ts:111（已有 `tags: params?.tags?.join(',')` 入参，无需改 API 层）
- 查证结果（后端已就绪，无需后端改动）：backend/peekview/api/entries.py:194 `tags: str|None = Query(None)`，:209 `tags.split(",")` → GET /api/v1/entries?tags=a,b 已支持
- 测试基础设施：
  - 前端单测：vitest + jsdom（`make test-frontend`），现有 frontend-v3/src/components/__tests__/BaseTag.spec.ts、EntryListRow.spec.ts（改组件需同步更新）
  - 前端 E2E：Playwright CDP（`make debug-test` 或 `E2E_SPEC=e2e/xxx.spec.ts make debug-test`），现有 e2e/*.spec.ts 多个
  - 类型检查：`make typecheck`（vue-tsc --noEmit，CI 强制）
  - 构建：`make build-frontend`（构建 + 复制到 static/，debug-start 依赖 static/index.html）
- 客观事实：P1 声明 risk_level=low / domains=[frontend] / packages=[frontend-v3] / phases=[P1-P8]（供你确认，不作为设计结论）
</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.sh` 审计失败。
