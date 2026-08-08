---
phase: P4
task_id: T090-mobile-detail-ux-polish
role: implementer
---

# 派发指引 — T090 P4 代码实现

## 目标

按 P2-design.md 选定的方案（1-B/2-A/3-A）实现代码，让 P3 的 12 个 Playwright E2E 用例从红转绿。

## 上游关联

- P2-design.md（approved）是实现方案的唯一依据，候选 1-B（`EntryMetaTagsBar.vue` 独立组件）/ 2-A（仅 `position:fixed`，不改 `.entry-detail` 的 `min-height:100vh`）/ 3-A（`.markdown-body` mobile 断点归零）已选定，不要重新设计
- P3-test-cases.md 的 12 个 E2E 用例是验证依据，实现完成后应能让这些测试转绿（不要求你自己跑通全部——P3 已确认真红灯，P5 会正式验证，但建议实现完关键部分后抽查 1-2 个测试确认方向正确）
- **P2 评审第 2 轮发现一个未阻塞但需要你处理的问题**：zen-mode 下 `.content-area` 的 `padding-bottom` override 规则缺少 `@media (max-width: 640px)` 保护，会误伤桌面端 zen-mode 的 padding-bottom（从 16px 意外缩到 12px）。P2-design.md 第 5 节给出的 override 规则写法请你在实现时加上 mobile 媒体查询保护，不要照抄字面公式而不检查作用域
- **已知限制**：P2-design.md 的 `gate_commands.P3` 声明是 `make test-frontend`（vitest），不包含本任务新增的 E2E spec（`frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts`）。这不影响你的实现工作，但如果你想自查验证，请直接跑 Playwright 命令（`BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/t090-mobile-detail-ux-polish.spec.ts --project=chromium`），不要依赖 `make test-frontend`

## 必读输入文件（严格按 P2-design.md files_to_read 清单，按需读取，不要整目录乱翻）

1. `docs/tasks/T090-mobile-detail-ux-polish/P2-design.md`（**核心输入**，第 1/2/3/5 节：改什么/候选方案实现细节/DESIGN.md 修订文字/实现完成标志清单）
2. `docs/tasks/T090-mobile-detail-ux-polish/P3-test-cases.md`（12 个测试用例，理解预期行为 + 用到的 data-testid）
3. `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts`（测试代码本身，理解具体断言细节）
4. P2-design.md 第 0 节 `files_to_read` 列出的全部源码文件（含精确行号范围），逐一按需读取：
   - `frontend-v3/src/composables/useResponsiveLayout.ts`
   - `frontend-v3/src/components/EntryDetailHeader.vue`
   - `frontend-v3/src/components/EntryDetailContent.vue`
   - `frontend-v3/src/components/EntryDetailMobileBar.vue`
   - `frontend-v3/src/views/EntryDetailView.vue`
   - `frontend-v3/src/components/MarkdownViewer.vue`
   - `frontend-v3/src/components/OverflowMenuSheet.vue`（参照模式，只读不改）
   - `frontend-v3/src/styles/variables.css`
   - `frontend-v3/src/composables/entryDetailKeys.ts`（注意：路径是 composables 不是 components，P2 已修正过这个错误）
   - `frontend-v3/src/components/BaseTag.vue`（新组件渲染 tags 需要复用）

## 实现要点（按 P2-design.md 已选定方案，不要偏离）

1. 删除 `useResponsiveLayout.ts` 的 `setupScrollHide`/`metaTagsHidden` 导出；同步删除/改写依赖它们的既有单测文件 `useResponsiveLayout.spec.ts`/`useResponsiveLayout.boundary.spec.ts`（P3-test-cases.md 已提示这是 P4 待办，否则 TS 编译失败）
2. `EntryDetailHeader.vue` 删除 mobile `.meta-tags-bar` 模板块 + CSS + `metaTagsHidden` prop
3. 新建 `EntryMetaTagsBar.vue`，根节点保留 `class="meta-tags-bar"` + `data-testid="meta-tags-bar"`，props: `currentEntry`/`relativeTime`，挂载在 `EntryDetailContent.vue` 的 `<main>` 内第一个子节点，`v-if="isMobile && currentEntry"`
4. `EntryDetailMobileBar.vue` 改 `position: fixed; bottom:0; left:0; right:0`，加 `padding-bottom: env(safe-area-inset-bottom, 0px)`、`z-index`、`min-height: var(--mobile-bar-height)`、`data-testid="mobile-bottom-bar"`；各按钮加 P2 data-testid 清单声明的 testid（`mobile-bar-wrap-btn`/`mobile-bar-copy-btn`/`mobile-bar-filetree-btn`/`mobile-bar-toc-btn`/`mobile-bar-source-toggle-btn`）
5. `EntryDetailContent.vue` mobile 断点新增 `padding-bottom: calc(var(--mobile-bar-height) + env(safe-area-inset-bottom, 0px))`；`content-area` 元素加 `data-testid="content-area"`
6. `EntryDetailView.vue` 的 zen-mode `:deep()` 块（约 L251-254）新增一条 override 规则回退 `.content-area` 的 `padding-bottom`，**务必包在 `@media (max-width: 640px)` 内**（这是本次修订新加的保护，避免误伤桌面端）
7. `MarkdownViewer.vue` mobile 断点 `.markdown-body` 的 `margin`/`padding` 归零；加 `data-testid="markdown-body"`
8. `variables.css` 新增 `--mobile-bar-height: 64px`
9. `DESIGN.md` 按 P2-design.md 第 3 节文字修订 L218-219/L263/L275，新增 Markdown Body Spacing 小节

## 环境隔离（强制）

本任务的环境约束见 P0-brief.md 的 env_constraints 字段。debug backend 已在 :8888 运行（测试数据 entry 已由 P3 阶段创建，可复用）。如需重启环境用 `make debug-quick`。严禁触碰生产 :8080。

## 完成后必须跑的检查（自查，非 gate）

- `cd frontend-v3 && npx vue-tsc --noEmit`（CI 强制，实现阶段务必自查确保通过）
- `make test-frontend`（vitest 单元测试，确认没有因为删除 setupScrollHide 导致既有测试崩溃）
- 建议抽查跑 1-2 个 E2E 用例确认方向正确（不要求全部转绿，P5 会正式验证）

## 产出文件（除代码本身外，还需要写这个）

`docs/tasks/T090-mobile-detail-ux-polish/P4-implementation.md`，必须声明 `implementation_dir: frontend-v3/src`，列出改动/新增的文件清单 + 简述每个文件改了什么，供后续阶段（P5/P6/P7）快速定位。

Header：
```
---
phase: P4
task_id: T090-mobile-detail-ux-polish
type: implementation
parent: P2-design.md
trace_id: T090-P4-20260809
status: draft
created: 2026-08-09
agent: implementer
---
```

若实现过程中发现 P1/P2 未覆盖的隐含需求或设计缺口，用 `[SCOPE+]`（新隐含需求）或 `[DESIGN_GAP: 描述]`（P2 方案的具体缺口）行首标注在 P4-implementation.md 里，不要擅自决定，交主 Agent 处理。

## 门槛（什么算完成）

- P2-design.md 第 5 节"实现完成的标志"清单逐项达成
- `npx vue-tsc --noEmit` 通过
- `make test-frontend` 通过（含删除/改写后的 useResponsiveLayout 相关单测）
- DESIGN.md 已按 P2 第 3 节文字修订
- P4-implementation.md 已产出，声明 implementation_dir + 改动文件清单

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P4

路径：phase-cards/P4-implementation.md
---
# P4 — 代码实现

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P4 且有合规理由（check-pruning.sh 已检查）→ 跳过，读 P5 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.sh $TASK_DIR`（自动捕获环境基线）。
   该步骤不会阻塞流程——任何 stderr 输出（含 WARNING）均可忽略，直接继续步骤 1，
   无需查看结果、无需判断、无需因为看到 WARNING 而停下来处理。
1. 派发 implementer subagent → 产出代码文件
   1.1 写 P4-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 P2 的 gate_commands 跑单元测试（非 gate，只是自查）
3. 按 C8 映射表派发评审（见下方）
4. 预跑 check-gate.sh P4（确认暂存区有代码文件）
5. 更新 .state.yaml phase=P4 → P5
6. git add docs/tasks/{Txxx}/ + 代码文件（含 .state.yaml，若 .gitignore 忽略需 git add -f）
7. git commit -m "wf({Txxx}-P4): {摘要}"

## 如果是重试

确认上一轮失败原因（来自 gate 输出 / review rejected 理由）
→ 只修复失败项，不重做已通过的部分
→ 修复后重跑全量测试（T027 教训：修复可能引入回归）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P4 MAX=3）

**若这次是从 P6（或其他更后的阶段）退回来的**：`docs/tasks/Txxx/` 下不会再有旧的 P6-acceptance.md（已被归档），但当初具体是哪条 BDD 失败、失败原因是什么，会摘要在 `docs/tasks/Txxx/.retreat-history.md` 里——**重新派发 implementer 时，dispatch-context 必须引用这份摘要**，不能让 implementer 只看到"现有代码"却不知道具体要修哪里。已有代码不会被撤销、也不需要重新实现，是在已有实现基础上定向修复。

## 前置条件

- [ ] P2-design.md 存在且 files_to_read 字段完整（导航清单）
- [ ] P2-review.md status: approved（P2 不可裁剪）
- [ ] P3-test-cases.md 存在（测试已设计）
- [ ] check-tdd-red.sh 确认红灯（测试先于实现）
- [ ] 未跳过 P4（如有裁剪理由，见上方裁剪跳阶）

## 派发

- **角色**：implementer（`{agate_root}/assets/execution-roles/implementer.md`）
- **输入**：P2-design.md（files_to_read 导航 + gate_commands）+ P3-test-cases.md + P0-brief.md（env_constraints）
- **输出**：代码文件（在 P4-implementation.md 声明的 implementation_dir 下）
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md` + 以下阶段特定追加：

```
## 上下文控制
读取代码文件以 P2-design.md 的 files_to_read 清单为准，按需读取（标了行号范围的只读片段）。
不要在项目里盲目搜索或整目录全读。

## 自查≠gate
写完代码后应自跑测试确认基本功能（自查），但自查通过 ≠ P5 gate 通过。
P5 由主 Agent 派发 verifier subagent 执行 gate_commands.P5，主 Agent 验 gate（检查产出 + failed 计数 + N5 最小校验）。
不要在返回中声称"P5 已过"或"全部测试通过"——只返回路径 + 摘要。

## 生产环境隔离
任何写入生产环境/生产数据库/生产 API 的操作都必须先 PAUSED 报告人工。
```

## 产出规格

- P4-implementation.md 必须声明 `implementation_dir: {实际路径}`
- 代码文件在声明的目录下
- 遵守 P2-design.md 的方案设计 + 现有项目代码规范

## 评审派发（C8 机械映射）

**在 P4 实现完成后、gate 前**，按 P1 声明的 domains 和 risk_level 派评审。C8 映射表是机械规则，不靠判断"需不需要"：

| domain | 派哪些评审 | 产出 |
|--------|----------|------|
| backend | review | P4-review.md |
| frontend | design-review | P4-review.md |
| mcp | review（关注 MCP 接口契约）| P4-review.md |
| security | cso | P4-review.md |
| risk=high | —（plan-eng-review 在 P2 已派）| — |

多个评审角色 `专家组并行` → 所有返回后派组长汇总 → 统一 P4-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长产出：P4-review.md。**agent 字段必须非 main**（与 P2 评审同规则，check-gate.sh 在 P2 分支硬拦截 agent=main 的 approved）
5. 组长规则：不发表新意见，只汇总；任何 BLOCKER → rejected；分歧 → 交人工；全票无 BLOCKER → approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P4-review.md。

review 不通过 → implementer 修改代码 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 按包拆分并行（条件触发，需额外约束）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

当 P2 声明多个 packages 且包间无数据依赖时，P4 可拆分并行，但**有额外约束**：

1. 每个 package 派一个 implementer subagent
2. **各 implementer 只改自己 package 目录下的文件**——跨包的共享文件（类型定义、接口、配置）由主 Agent 在所有并行 implementer 返回后统一处理
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit
5. 主 Agent 在所有 implementer 返回后，统一处理共享文件改动（如果有）

**冲突预防**：
- dispatch-context 约束节必须写明：`只改动 {pkg}/ 目录下的文件。共享文件（{列出}）不在本次改动范围内`
- 如果某个 implementer 必须改共享文件 → 该包不能并行，改为串行（主 Agent 先派其他包并行，再串行处理含共享改动的包）
- 无法确定是否有共享改动 → 串行（安全默认值）

**基础设施隔离（并行时强制）**：
- debug server 端口：每个 implementer 的 dispatch-context 约束节分配不同端口（如 pkg-a: 3001, pkg-b: 3002）
- 测试数据库：每个 implementer 用独立数据库路径（如 `test-{pkg}.db`），不共享同一 test.db
- 环境变量：dispatch-context 写明各 subagent 独立的环境变量值（如 `PORT=3001` vs `PORT=3002`）
- 临时文件：各 subagent 写入 `P4-implementation/{pkg}/` 独立目录

主 Agent 在并行派发前**必须**为每个 subagent 的 dispatch-context 分配上述隔离参数。当前无 gate 脚本检查（已知缺口），但未分配导致运行时冲突（端口占用/数据库锁）时计为重试，不算环境问题。

## gate 规则（check-gate.sh 会跑）

```bash
check-gate.sh P4 $TASK_DIR
```

- **exit 0**：暂存区含非 md/yaml 代码文件（git diff --cached --name-only）
- **exit 1**：暂存区仅 .md/.yaml 文件（无实际代码变更）→ 不能推进

## 推进条件（全部满足才写 phase: P5）

- [ ] 暂存区含代码文件（非 .md/.yaml）
- [ ] 按 C8 映射表触发的评审全部完成：P4-review.md status: approved（无触发评审角色时此项自动满足）
- [ ] SCOPE+ 已处理（若本阶段产生）：P1-requirements.md 有 [SCOPE_RESOLVED]（行首声明格式）
- [ ] git commit 完成

## 常见错误

1. **不读 files_to_read，在项目里乱翻**：implementer 拿到 P2 的 files_to_read 清单后应按清单阅读，不要在项目里全文搜索或整目录全读——上下文会爆炸
2. **自行加范围外改动**：发现需要做但不在 P1 范围内的改动 → 标 [SCOPE+]（行首声明格式）而非直接做
3. **只跑单元测试不验证集成**：单元测试全绿 ≠ 功能可用。P5 会跑 gate_commands 做技术验证，但要确保实现时路径依赖的端点行为已验证
4. **先更新 .state.yaml 再 commit**：state 和产出在同一 commit 里——不要先 commit 产出再单独 commit state
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P5 验证依赖：P5 跑 gate_commands.P5 的命令（在 P2 声明），确保你的实现能通过
- P6 验收依赖：实现路径的端点行为必须可验证（确认 API 返回正确的 Content-Type、状态码等）
- 代码改动文件路径：P8 发布时确认版本文件变更需要知道你改动了哪些 package

> 完成 → 读 phase-cards/P5-verification.md

6. **修改 P1 文档**：P4 发现 BDD 矛盾时标 DESIGN_GAP，不直接改 P1-requirements.md。需变更 P1 时标 `[BASELINE_CHANGE: 理由]` 并经主 Agent 批准。
<!-- AGATE_CARD_END -->
