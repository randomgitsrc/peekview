---
phase: P2
task_id: T091-mobile-detail-visual-polish
role: architect
---

# 派发指引 — T091 P2 方案设计

## 目标

为 13 条 BDD（`P1-requirements.md`）产出正式设计文档。**方案本身已在 P0-brief/P1 阶段与用户逐条讨论定型**，你的工作重心不是探索新候选，是：①正式声明 `files_to_read`/`gate_commands`/data-testid 清单 ②对"Image/HtmlViewer 滚动架构例外场景"做一次真实的 minimal_validation（这是唯一还没被实测验证过的不确定点）③给出 DESIGN.md 精确修订文字 ④吸取 T090 的教训，把 gate_commands.P3 声明对，不要重蹈"P3 红灯确认命令覆盖不到实际新增测试"的覆辙。

## 上游关联

- P1-requirements.md（approved，13 条 BDD）是需求基线，`follows_existing_pattern: [EntryDetailHeader.vue, EntryDetailMobileBar.vue]` 已声明，Copy 对齐 `EntryDetailHeader.vue` 的 `.icon-btn`（L36-38/163-166），Wrap 对齐 `EntryDetailMobileBar.vue` 自身的 `source-toggle`/`.toggle-btn`（L18-27/100-113）——这两处每个只需 1 个候选方案，不需要重新探索
- P1 两条 `[SUGGEST]` 已被主 Agent 采纳：①DESIGN.md L158-160 补充"带持久状态的图标按钮用 `.toggle-btn`，无状态一次性动作用 `.icon-btn`，带文字标签的用 `BaseButton`"判断准则 ②DESIGN.md 补充 content-area 8px 是详情页刻意的例外覆盖说明（消除与 L113"16px mobile"通用规则的字面矛盾）
- **T090 的一个具体教训必须在本次 gate_commands 声明里体现**：T090 的 `gate_commands.P3` 只声明了 `make test-frontend`（vitest），但新增测试都在 Playwright E2E spec 里，导致 `check-tdd-red.sh` 误报"测试全绿"，靠主 Agent 独立重跑原始命令才发现。本次请直接声明能覆盖实际新增测试文件的 P3 确认命令（可以是 `E2E_SPEC=...` 形式的 Playwright 命令，不要只填 `make test-frontend` 应付了事）

## 必读输入文件

1. `docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（**核心输入**，13 条 BDD + 视觉断言占比说明 + 隐含需求）
2. `docs/tasks/T091-mobile-detail-visual-polish/P0-brief.md`（已定型方案的完整讨论过程）
3. `frontend-v3/src/components/EntryMetaTagsBar.vue`
4. `frontend-v3/src/components/MarkdownViewer.vue`
5. `frontend-v3/src/components/EntryDetailMobileBar.vue`
6. `frontend-v3/src/components/EntryDetailHeader.vue`（L36-38/163-166，Copy `.icon-btn` 视觉基准，只读参照不改）
7. `frontend-v3/src/components/ImageViewer.vue` / `HtmlViewer.vue`（只读参照，滚动架构例外，BDD-10/11 的 minimal_validation 对象）
8. `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts`（T090 遗留的 E2E 测试，其中已有 Copy/Wrap 相关断言，本次实现后这些断言的部分内容会变化——如 Copy 不再有"Copy"文字、不再靠 `.bottom-btn.primary` class 判断，需要评估是新建独立 spec 文件还是修改这个既有文件，请给出明确决定并说明理由）
9. `DESIGN.md`（L113 通用容器规则、L149-160 Buttons/Icon Buttons、L218-223 Meta Tags Bar/Markdown Body Spacing、L265-278 Touch targets/底部栏/滚动架构）

## minimal_validation 要求（主 Agent 已实测完成，你只需核实+采纳+写入文档，不需要重新跑）

**上一轮 architect 派发因触发 API 额度上限提前终止，主 Agent 已亲自用 Playwright CDP 完成了这部分验证，数据如下，请直接采纳写入 `minimal_validation` 字段（可花 1-2 分钟用同样方法快速复核一次，不需要重新设计验证方案）：**

1. **`html-csp-test`（HtmlViewer 例外场景）**：用 `page.addStyleTag` 实时注入 T091 目标 CSS（`padding:16px 16px; overflow-x:visible; flex-wrap:wrap`）后测量：`.html-viewer` 的 `getBoundingClientRect()`：`top:157, height:623`；meta-tags-bar：`height:89, bottom:157`——两者衔接处 `viewerTop(157) === metaBottom(157)`，无重叠无遮挡，`overflow:hidden` 正常生效，viewer 可用高度 623px（在 844px 视口下合理，未被压缩到不可用尺寸）。

2. **`product-screenshots`/`image-gallery`（原计划的 ImageViewer 例外场景 entry）**：**当前 debug 环境两者均不可用**——`product-screenshots` 实际文件是 `README.md`+`logo.svg`（无真实二进制图片，不会路由到 ImageViewer）；`image-gallery` 在当前 debug-quick 灌入的 16 个公开 entry 里不存在（seed-data 目录里有但这次没被灌入/或为私有）。

3. **重要发现（源码核实，非猜测）**：`useEntryDetailComputed.ts` L29-34 的 `isImage` 计算属性对 `mime === 'image/svg+xml'` 直接返回 `true`——**SVG 文件实际上是走 `ImageViewer` 组件的**（不是常规文档流路径）。用同样方法验证 `svg-standalone`（confirmed 走 `.image-viewer`）：`height:623, top:157`，与 html-csp-test 数值完全一致，无重叠无遮挡。**建议 BDD-10（Image viewer 例外场景）改用 `svg-standalone` 作为实际测试 entry**（P1 approved 的 BDD-10 原文写的是"image-gallery 或 product-screenshots"，这两个都不可用，`svg-standalone` 是当前 debug 环境唯一真实可用、且技术上确实路由到 `ImageViewer` 的选择，不违背 BDD-10 的原始意图——它验证的是"ImageViewer 例外机制"这个技术路径，不是"图片"这个内容类型本身）。这不需要走 `[BASELINE_CHANGE]`（P1 的 BDD-10 措辞留了"或"的余地，测试 entry 选择本来就是 P2/P4 该定的实现细节，不是 P1 需求本身的变化）。

**结论：两种滚动架构例外场景实测均无遮挡/挤压/滚动冲突问题，`follows_existing_pattern` 声明成立（沿用 T090 已确定的 meta-tags-bar 嵌入内容流机制，不需要为 Image/HtmlViewer 做特殊处理）。**

## 候选方案要求

- Copy/Wrap 图标化：`follows_existing_pattern` 适用，各 1 个候选即可，不需要探索替代方案
- **Image/HtmlViewer 交互处理**：如果 minimal_validation 发现存在遮挡/挤压问题，这里需要给出 ≥2 个候选方案权衡（如调整 ImageViewer/HtmlViewer 的高度计算方式、或调整 meta-tags-bar 的挂载位置等）；如果验证结果一切正常，可以declare `follows_existing_pattern`（沿用 T090 已确定的 meta-tags-bar 嵌入内容流机制，不做改动）
- `candidate_count` 字段必须如实反映你写了几个候选

## DESIGN.md 精确修订文字（必须给出，不能只说"需要改"）

对照 P0-brief/P1 列出的 4-5 处，逐处给出修订前/修订后的精确文字：
1. L221-223 Markdown Body Spacing (Mobile)
2. L267 fixed bottom bar 的 padding-bottom 描述
3. L218-219 Meta Tags Bar (Mobile) 换行说明
4. L158-160 Icon Buttons 判断准则补充（P1 SUGGEST-1）
5. L113 附近 content-area 例外说明（P1 SUGGEST-2）

## data-testid 核对

T090 已有 `mobile-bar-wrap-btn`/`mobile-bar-copy-btn`/`meta-tags-bar`/`markdown-body`/`content-area`/`mobile-bottom-bar` 等 data-testid，本次改动（Copy/Wrap 图标化）不应移除这些既有 testid（否则 T090 遗留的 E2E 测试会失效），只是元素内部结构变化（去掉文字、加图标）。请在设计文档里明确声明"保留既有 data-testid 不变"。

## 四字段声明提示

```yaml
packages: [frontend-v3]
domains: [frontend]
ui_affected: true
gate_commands:
  P3: "{声明能真正覆盖新增测试文件的命令，吸取T090教训}"
  P5: "make test-frontend"
  P5_e2e: "{声明具体的 E2E_SPEC 命令}"
```

## 门槛（什么算完成）

- P2-design.md 含候选方案 + `candidate_count` 字段与正文一致
- 四字段齐全，`gate_commands.P3` 明确覆盖新增 E2E 测试（不是只填 vitest 应付）
- `minimal_validation` 含 Image/HtmlViewer 真实截图/CDP验证结果
- DESIGN.md 5 处精确修订文字（前/后对照）
- files_to_read 清单
- 明确声明保留既有 data-testid
- 明确决定 T090 遗留 E2E spec 是修改还是新建独立文件，并说明理由

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
