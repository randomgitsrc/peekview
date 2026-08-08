---
phase: P2
task_id: T090-mobile-detail-ux-polish
role: architect
---

# 派发指引 — T090 P2 方案设计

## 目标

为 12 条 BDD（`P1-requirements.md`）设计技术方案，覆盖三个问题点：①meta-tags-bar 嵌入内容流消除跳变 ②底部操作栏改为真正 `position: fixed` + safe-area 兼容 ③markdown 移动端边距缩减。

## 上游关联

- P1-requirements.md 已 approved（12 条 BDD），是本阶段的需求基线，不可修改 BDD 语义
- `[BASELINE_CHANGE]`：DESIGN.md:219 现有滚动隐藏规则将被推翻，P2 方案必须同步给出 DESIGN.md 的具体修订文字（不只是代码改动，文档也要更新）
- `[SUGGEST]` 已被主 Agent 采纳：问题 2 是"修复 `EntryDetailMobileBar.vue` 现有组件的定位机制"，不是新建组件
- 隐含需求"架构约束保留"：必须保留 `.content-area` 作为唯一滚动容器（DESIGN.md L270-275, T084/T085 决策），方案不能引入第二个滚动容器或改变 viewer 组件的 `overflow-y`/`height:100%` 约束

## 必读输入文件

1. `docs/tasks/T090-mobile-detail-ux-polish/P1-requirements.md`（**核心输入**，12 条 BDD + 隐含需求 + [CORRECTION] + [BASELINE_CHANGE]）
2. `docs/tasks/T090-mobile-detail-ux-polish/P0-brief.md`（环境约束）
3. `DESIGN.md`（L219、L254-275，需要修订的既有规则）
4. `frontend-v3/src/composables/useResponsiveLayout.ts`（`setupScrollHide`/`metaTagsHidden` 现有实现，问题 1 的直接改造对象）
5. `frontend-v3/src/components/EntryDetailHeader.vue`（`.meta-tags-bar` 结构与 CSS，L72/L192-193）
6. `frontend-v3/src/components/EntryDetailContent.vue`（`.content-area` 滚动容器 + padding，问题 1/3 都可能需要改动这里）
7. `frontend-v3/src/components/EntryDetailMobileBar.vue`（底部操作栏，问题 2 的改造对象，含 `canWrap`/`isMarkdown` 等 v-if 条件）
8. `frontend-v3/src/views/EntryDetailView.vue`（组件编排顺序、`.entry-detail` 的 `min-height: 100vh` flex 布局、zen-mode 隐藏规则）
9. `frontend-v3/src/components/MarkdownViewer.vue`（`.markdown-body` 间距，L124-136）
10. `frontend-v3/src/components/OverflowMenuSheet.vue`（L130-144，已有 `position: fixed; bottom: 0; padding-bottom: env(safe-area-inset-bottom, 0px)` 先例，`follows_existing_pattern` 候选）
11. `frontend-v3/src/styles/variables.css`（`--space-*` token 定义）

## 需要方案设计判断的关键技术点（不是穷举答案，是你需要给出候选对比的点）

1. **meta-tags-bar 嵌入内容流的具体位置**：是移到 `EntryDetailHeader.vue` 内部改为非 sticky 的普通文档流元素（跟随 header 一起滚出视口），还是移到 `EntryDetailContent.vue`/各 viewer 顶部（作为 content 的第一个子元素随内容滚动）？这直接决定了组件边界改动范围，请给出至少 2 个候选并比较对哪些文件的改动面更大、是否符合"公共组件不重复"的隐含需求（BDD-2 范围收窄声明要求逻辑仍是与 viewer 类型无关的单一路径）。
2. **底部操作栏可视高度问题**：`.entry-detail` 当前用 `min-height: 100vh` 导致移动浏览器地址栏收起/展开时可视区域计算不稳定（这是 P1 [CORRECTION] 已定位的根因）。候选方向包括但不限于：使用 `100dvh`（dynamic viewport height，现代移动浏览器支持较好但仍有兼容性边界）、或不依赖 viewport height 单位改用纯 `position: fixed` 脱离文档流（此时 `.content-area` 需要额外 `padding-bottom` 等于底部栏高度，避免内容被遮挡）。请给出候选对比 + 决定用哪种，并在 `minimal_validation` 里验证该方案在浏览器里的实际行为（例如写一个最小 HTML 测试页用 CDP 检查 `position: fixed; bottom: 0` 元素在 viewport resize 时的表现）。
3. **markdown 边距分层问题**：当前 `.content-area` padding（移动端 8px 左右）+ `.markdown-body` margin（16px）+ padding（16px）三层叠加。方案需要决定去掉哪些层/合并到哪层，达成 BDD-8 "相对基线缩减 ≥75%"的量化要求，同时不破坏其他 viewer（非 markdown）依赖 `.content-area` padding 的既有布局（Code/Table/Tree 等也用同一个 `.content-area`，不能只优化 markdown 而破坏其他 viewer 的间距观感）。

## DESIGN.md 修订要求

方案必须包含对 DESIGN.md 具体文字的修订建议（哪几行改成什么），至少覆盖：
- L219（滚动隐藏规则替换为内容流嵌入描述）
- 若涉及移动端 markdown 间距新规则，需要补充新的条目（当前 L113 的"32px desktop, 16px mobile"不是 markdown 专属，需要判断是否需要单独声明）

## minimal_validation 要求（必填，本任务方案依赖浏览器行为，不可声明"纯代码逻辑"）

以下两点必须做最小验证（10 行 HTML 测试页 / Playwright CDP 脚本均可）后再定方案，不能只靠假设：
1. `position: fixed; bottom: 0` + `env(safe-area-inset-bottom)` 元素在移动 viewport 下的实际渲染表现（可用 Playwright CDP mobile device emulation 做，参考 `playwright-cdp` skill）
2. 若候选方案 2 选择使用 `100dvh`，验证其浏览器兼容性假设是否成立（可查 caniuse 数据或直接在 CDP headless Chrome 里验证渲染行为，说明验证方式和结果）

验证结果写入 `P2-design.md` 的 `minimal_validation` 字段，不能跳过。

## 四字段声明提示

```yaml
packages: [frontend-v3]
domains: [frontend]
ui_affected: true
gate_commands:
  P3: "make test-frontend"
  P5: "make test-frontend"
  P5_e2e: "make debug-test"   # 或声明具体 E2E_SPEC，若判断需要自定义 Playwright CDP 脚本请说明理由
```

`ui_affected: true` 是硬性的（本任务全部是视觉/交互改动），必须列出需要 E2E/Playwright 覆盖的交互点（对照 12 条 BDD）。

## UI 测试选择器

请为底部操作栏、meta-tags-bar 等新增/改造的关键元素声明稳定的 `data-testid`（而非依赖 class 名），供 P3/P4/P6 的 Playwright 脚本定位使用，避免 CSS 重构后测试选择器失效。

## 候选方案要求

本任务**不适用** `design_trivial` 或单一 `follows_existing_pattern` 简化——三个问题点均涉及真实的工程权衡（尤其问题 1 的组件边界选择、问题 2 的 viewport 单位选择），候选方案数需 ≥2，需在 `P2-design.md` 声明 `candidate_count: N` 且与正文候选数一致。`OverflowMenuSheet.vue` 的 safe-area 处理可作为问题 2 其中一个候选的参照（`follows_existing_pattern` 提示，非整体简化理由）。

## 门槛（什么算完成）

- P2-design.md 含 ≥2 候选方案 + 权衡 + 选择理由，`candidate_count` 字段与正文一致
- 四字段齐全（packages/domains/ui_affected/gate_commands），`gate_commands.P5_e2e` 已声明
- `minimal_validation` 字段含真实验证结果（不是声明"纯代码逻辑"）
- files_to_read 清单已给出（供 P4 implementer 导航）
- DESIGN.md 具体修订文字已给出
- data-testid 清单已声明

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
