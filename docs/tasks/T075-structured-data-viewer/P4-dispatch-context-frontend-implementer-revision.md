# P4 修复派发指引 — T075 frontend implementer（design-review 修订）

## 目标

按 P4-review-frontend.md 修复 3 项 BLOCKER + 11 项 MINOR，修复后重派 design-review 复验。

## 任务背景

P4 前端实现已完成，design-review 结论 needs-revision：3 BLOCKER（a11y 键盘可达 + 类型标签对比度）+ 11 MINOR。需 implementer 定向修复。

## 约束

- 只改 P4-review-frontend.md §3 列出的问题对应文件
- 不改测试代码内容（但若 a11y 结构改动影响测试选择器，可同步调整测试——评审 §5 已提醒）
- 遵循 DESIGN.md + P2-design.md
- 最小修复：只修评审列出的问题，不带入其他改动
- 修复后自查：vue-tsc / build / 相关 spec 全绿

## 上游关联

- P4-review-frontend.md：问题清单（§3-A~N）+ 通过项（§2）+ P2 一致性核对（§4）
- P4-implementation-frontend.md：原实现
- P2-design.md：设计基准

## 输入文件

1. `docs/tasks/T075-structured-data-viewer/P4-review-frontend.md`（问题清单）
2. `frontend-v3/src/components/DataTreeNode.vue`（A/C/F/N 涉及）
3. `frontend-v3/src/components/TableView.vue`（B/E 涉及）
4. `frontend-v3/src/components/TreeView.vue`（G/K/M/L 涉及）
5. `frontend-v3/src/components/TruncationBanner.vue`（H 涉及）
6. `frontend-v3/src/components/EntryDetailHeader.vue`（D/I 涉及）
7. `frontend-v3/src/components/EntryDetailMobileBar.vue`（D/I/J 涉及）
8. `frontend-v3/src/components/EntryDetailContent.vue`（D 涉及）

## 修复清单（摘自 P4-review-frontend.md §3）

### BLOCKER

**A. 树节点值复制无键盘可达性**（DataTreeNode.vue:15-23, 78-87）
- `<span class="tree-node-label" @click="copyValue">` → 改为 `<button type="button" class="tree-node-label">`（保留样式，补 `:focus-visible` 焦点环）
- 或 `role="button" tabindex="0" @keydown.enter.prevent @keydown.space.prevent="copyValue"`
- 注意：button 默认样式需重置（背景透明、边框无、文字继承）

**B. 列头排序无键盘可达性**（TableView.vue:18-23）
- th 内嵌可聚焦排序控件：`th-content` 加 `<button>` 或 th 加 `tabindex="0" role="button" @keydown.enter.self/@keydown.space.self`
- 补 `:focus-visible`；注意与内部筛选 input 焦点流不冲突
- 若改结构影响测试选择器（如 click th），同步调整 TableView.spec.ts（P3-test-code + frontend-v3 两处副本必须一致）

**C. 类型标签字级与浅色主题对比度**（DataTreeNode.vue:162-168）
- 字级 `10px` → `var(--font-xs)`（12px）
- 浅色主题文案色加深（如 string `#1a7f37`→`#116329`、number `#0969da`→`#0550ae`、boolean `#9a6700`→`#825a00` 档位）
- null 标签 ≥3:1
- 深色主题保持已达标值

### MINOR（建议一并处理）

**D. parseError 期间切换按钮失效**（EntryDetailContent.vue:150, 41-43）
- toggle-source-view 处理器里 `parseError.value = null`

**E. 可排序列头无 hover 反馈**（TableView.vue:191-202）
- `.table-scroll thead th:hover { background: var(--bg-tertiary); }`

**F. type-tag 硬编码非 token 值**（DataTreeNode.vue:163-166）
- `font-size: var(--font-xs)`；`border-radius: var(--radius-sm)`；padding 走 `var(--space-1) var(--space-2)` 档

**G. 搜索匹配数不播报 0 匹配**（TreeView.vue:18, 142-146）
- n===0 时输出 "No matches"（或 `0 matches`）

**H. TruncationBanner 无角色/播报**（TruncationBanner.vue:2-9）
- 加 `role="status"`（或 `aria-live="polite"`）

**I. 视图切换按钮语义属性**（EntryDetailHeader.vue:30, EntryDetailMobileBar.vue:20）
- `aria-expanded` → `aria-pressed`（toggle button 语义）

**J. 移动端底部栏按钮触摸目标 < 44px**（EntryDetailMobileBar.vue:89-99）
- 底部栏按钮统一 `min-width/height: 44px`（覆盖 3 个按钮而非仅新按钮）

**K. iOS 聚焦缩放风险**（TreeView.vue:161-170）
- 移动端 media query 内 search input `font-size: var(--font-md)`

**L. TreeExpandKey 跨 SFC 循环引用**（TreeView.vue:38-47 ← DataTreeNode.vue:45）
- symbol 移到独立模块 `src/composables/treeExpandKey.ts`，两组件各自 import

**M. 空容器文案准确性**（TreeView.vue:21-23）
- 区分 "Empty object/array" 与真正无数据；标量根渲染为单叶子节点

**N. 复制 toast 信息过长**（DataTreeNode.vue:82）
- 展示截断值（前 80 字符 + `…`），完整值走 clipboard

## 自查命令

```bash
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && npm run build
cd frontend-v3 && npx vitest run src/components/__tests__/TableView.spec.ts src/components/__tests__/TreeView.spec.ts --reporter=dot
```

## 门槛

- 3 BLOCKER + 11 MINOR 修复落盘
- vue-tsc 零错误 / build 成功 / TableView+TreeView spec 全绿
- 若改了测试选择器，P3-test-code 与 frontend-v3 两处副本一致
- 更新 P4-implementation-frontend.md 追加修订记录

## 返回给主 Agent

只返回两行：修改的文件路径列表 + 一句话摘要（修复完成，全绿）。

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
4. git add 代码文件 → git commit
5. 预跑 check-gate.sh P4（确认暂存区有代码文件）
6. 更新 .state.yaml phase=P4 → P5

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
4. **写完代码不改 .state.yaml 就 commit**：commit 后更新 phase 标记为 P5
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P5 验证依赖：P5 跑 gate_commands.P5 的命令（在 P2 声明），确保你的实现能通过
- P6 验收依赖：实现路径的端点行为必须可验证（确认 API 返回正确的 Content-Type、状态码等）
- 代码改动文件路径：P8 发布时确认版本文件变更需要知道你改动了哪些 package

> 完成 → 读 phase-cards/P5-verification.md
<!-- AGATE_CARD_END -->
