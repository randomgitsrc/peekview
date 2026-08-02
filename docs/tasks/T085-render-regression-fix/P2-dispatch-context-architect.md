# P2 派发指引 — T085 architect

## 目标

为 T085（5 个渲染缺陷修复）设计方案，产出 `P2-design.md`。

## 任务背景

5 个缺陷根因已在 P0-brief 定位，P1 已产出 11 条 BDD。本阶段设计修复方案（不实现）。

## 5 个缺陷 + P1 确认的修复方向

| # | 缺陷 | 修复方向（P1 已确认） |
|---|------|---------------------|
| P1 | SVG→TreeView | 新增 isSvg，调度链 isXml 改为 `isXml && !isSvg`，isRichRenderable 不含 SVG，SVG 走 ImageViewer |
| P2 | 源码视图不滚动 | .code-body 恢复 `flex:1; min-height:0`（不恢复 overflow:auto），让 content-area 滚动 |
| P3 | Markdown 边距丢失 | MarkdownViewer .markdown-body 恢复 scoped padding（方案 B，只影响 Markdown） |
| P4 | 滚动抖动 | content-area 加 overscroll-behavior:none + setupScrollHide 加边界保护 |
| P5 | per-page 下拉框选不中 | 原生 select 改自定义组件或加 appearance:none + 触达目标≥44px + E2E 改真实点击 |

## 约束

- 只设计方案，不实现
- ui_affected: true（涉及详情页渲染 + per-page 下拉框交互）
- domains: frontend（C8 映射需 plan-design-review）
- risk_level: medium
- 不改后端/MCP/DB schema/路由
- DESIGN.md §6（32px/16px padding）+ §9（滚动架构）+ §10（a11y ≥44px）为设计基准
- gate_commands 用 .venv/bin/python（不用 python）

## 上游关联

- P1-requirements.md：11 BDD
- P0-brief.md：根因分析 + 范围声明
- T075 复盘教训：gate_commands 命令可执行性 + 断言必须可推导

## 输入文件

1. `docs/tasks/T085-render-regression-fix/P1-requirements.md`（11 BDD）
2. `docs/tasks/T085-render-regression-fix/P0-brief.md`（根因 + 范围）
3. `frontend-v3/src/composables/useEntryDetailComputed.ts`（isXml/isImage/isRichRenderable 现状）
4. `frontend-v3/src/components/EntryDetailContent.vue`（调度链 + content-area CSS）
5. `frontend-v3/src/styles/code.css`（.code-body 现状）
6. `frontend-v3/src/components/MarkdownViewer.vue`（padding 现状）
7. `frontend-v3/src/styles/markdown.css`（全局 padding 现状）
8. `frontend-v3/src/composables/useResponsiveLayout.ts`（setupScrollHide 现状）
9. `frontend-v3/src/components/TableView.vue`（per-page select 现状）
10. `frontend-v3/src/components/Pagination.vue`（分页组件接口）
11. `DESIGN.md`（§6 间距 + §9 滚动 + §10 a11y）
12. `frontend-v3/e2e/structured-data-viewer.spec.ts`（BDD-19/20 selectOption 盲区）

## gate_commands 要求

```yaml
gate_commands:
  P3_frontend: "cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P5_frontend: "cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  P5_build: "cd frontend-v3 && npm run build"
  P5_e2e: "E2E_SPEC=e2e/render-regression.spec.ts make debug-test"
  project_module: "src/"
```

## 门槛

- P2-design.md 含四字段（packages/domains/ui_affected/gate_commands）
- 候选方案 ≥2（或 design_trivial/follows_existing_pattern 声明 + 理由）
- files_to_read 清单
- minimal_validation
- env_constraints

## 返回

路径 + 一句话摘要。

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
## P2 最小验证
方案设计前，先用最小验证确认关键假设（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。
验证结果写入 P2-design.md 的 minimal_validation 字段。
- 方案依赖浏览器行为/安全模型/外部系统行为 → 必须做最小验证
- 纯代码逻辑 → 须在 minimal_validation 字段声明 `纯代码逻辑，无外部系统依赖`（须写明依赖了哪些内部函数/数据转换）
```

## 产出规格

P2-design.md 必须包含：
- **候选方案 ≥2** + 权衡 + 选择理由（design_trivial / follows_existing_pattern 时可只写 1 个，见下方）
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
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review / office-hours |

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
