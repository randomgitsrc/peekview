# P4 派发指引 — T075 frontend implementer

## 目标

按 P2-design.md §3.2~3.13 实现 T075 前端部分：TableView + TreeView + 源码/渲染切换 + 格式检测属性，让 P3 的红灯测试变绿。产出 `P4-implementation-frontend.md` + 代码改动。

## 任务背景

为 PeekView 详情页新增结构化数据富渲染：
- A. TableView（CSV/TSV）— TanStack Table v8 headless + 复用 Pagination.vue
- B. TreeView（JSON/YAML/XML）— 递归树节点 + 展开/折叠 + 类型标签 + 搜索 + 复制
- C. 源码/渲染切换 — 统一机制（状态在 EntryDetailView），补齐 Markdown 源码切换缺口
- D. 格式检测 — useEntryDetailComputed 新增 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable

## 约束

- 只改 frontend 包文件（P2-design.md §2.1「前端 — 修改文件」列出的文件 + 新增文件）
- 不改后端、不改 MCP、不改 DB schema
- 不改测试代码（P3-test-code/ 是规范副本，**复制到实际位置**；复制后不改测试内容，只实现让它变绿）
- 新增 npm 依赖：`@tanstack/vue-table` + `js-yaml`（P2 §3.12 版本）
- 遵循 DESIGN.md 设计系统 + AGENTS.md 项目规范
- 最小实现原则：只做 P2 方案里的事，不擅自扩大范围

## 上游关联

- P2-design.md：§3.2~3.13 前端详细设计 + files_to_read + gate_commands
- P3-test-cases.md：53 BDD 总表 + 测试文件清单 + 最终落位
- P3-test-code/：测试代码（需复制到实际位置）

## 输入文件（按 P2 files_to_read 清单读取）

1. `frontend-v3/src/composables/useEntryDetailComputed.ts` — 新增 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable
2. `frontend-v3/src/components/EntryDetailContent.vue` — 调度链插入 TableView/TreeView + 源码/渲染切换 v-if + parse-error 降级 + TOC 条件
3. `frontend-v3/src/views/EntryDetailView.vue` — sourceViewMode 状态管理 + watch(activeFile) 重置
4. `frontend-v3/src/components/EntryDetailHeader.vue` — actions-area 加切换按钮
5. `frontend-v3/src/components/EntryDetailMobileBar.vue` — 移动端加切换按钮
6. `frontend-v3/src/components/Pagination.vue` — 分页复用（props/emit 接口）
7. `frontend-v3/src/components/CodeViewer.vue` — 源码视图复用（props 接口）
8. `frontend-v3/src/components/TreeNodeItem.vue` — 递归树组件参考
9. `frontend-v3/src/stores/entryDetail.ts` — activeFile/selectFile 理解
10. `frontend-v3/src/styles/variables.css` — CSS 变量语义别名
11. `frontend-v3/src/types/index.ts` — File interface（language 字段）

## 客观查证信息

### 测试文件复制（P3-test-code/ → 实际位置）

| P3-test-code/ 文件 | 复制到 | BDD |
|--------------------|--------|-----|
| `useCsvParser.spec.ts` | `frontend-v3/src/composables/__tests__/useCsvParser.spec.ts` | BDD-14/15/16/22/23/49 |
| `useTreeData.spec.ts` | `frontend-v3/src/composables/__tests__/useTreeData.spec.ts` | BDD-24/25/26/29/32/36 |
| `useEntryDetailComputed.structured.spec.ts` | `frontend-v3/src/composables/__tests__/useEntryDetailComputed.structured.spec.ts` | BDD-07~11 |
| `TableView.spec.ts` | `frontend-v3/src/components/__tests__/TableView.spec.ts` | BDD-12~22/23/49 |
| `TreeView.spec.ts` | `frontend-v3/src/components/__tests__/TreeView.spec.ts` | BDD-24~36 |
| `structured-data-viewer.spec.ts` | `frontend-v3/e2e/structured-data-viewer.spec.ts` | BDD-12~53 E2E |

### 新增文件（P2 §2.1）

| 文件 | 职责 |
|------|------|
| `src/components/TableView.vue` | CSV/TSV 表格渲染器（TanStack Table + Pagination） |
| `src/components/TreeView.vue` | JSON/YAML/XML 树渲染器 |
| `src/components/DataTreeNode.vue` | 递归树节点 |
| `src/components/TruncationBanner.vue` | 截断提示条 |
| `src/composables/useCsvParser.ts` | CSV/TSV 状态机解析 |
| `src/composables/useTreeData.ts` | JSON/YAML/XML → TreeDataNode |
| `src/types/structured-data.ts` | TreeDataNode/NodeType/CsvParseResult 类型 |

### 修改文件（P2 §2.1）

| 文件 | 改动 |
|------|------|
| `src/composables/useEntryDetailComputed.ts` | 新增 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable |
| `src/components/EntryDetailContent.vue` | 调度链 + 切换 v-if + parse-error 降级 + TOC 条件 |
| `src/components/EntryDetailHeader.vue` | 桌面端切换按钮 |
| `src/components/EntryDetailMobileBar.vue` | 移动端切换按钮 |
| `src/views/EntryDetailView.vue` | sourceViewMode + watch(activeFile) 重置 + props 传递 |
| `package.json` | @tanstack/vue-table + js-yaml |

### 测试选择器契约（P3 测试定义了实现必须满足的选择器）

TableView：
- 根容器 `class="table-view"`，内部语义 table/thead/tbody/tr/th/td
- 列头 th 绑定 aria-sort（ascending/descending，原序无）
- 筛选输入框 aria-label="Filter {列名}"
- 每页行数选择器 `select.per-page-select`（50/100/500，默认 100）
- 分页复用 Pagination（class="pagination"）
- 截断提示 `class="truncation-banner"` + 下载按钮

TreeView：
- 根容器 `class="tree-view"`，递归节点
- 节点展开/折叠按钮 aria-expanded
- 类型标签（string/number/boolean/array/object/null）
- 搜索框 aria-label="Search tree nodes" + aria-live 匹配数播报
- 叶子值点击复制 → useToast 反馈

### 调度链（P2 §3.3）

```
isHtml → HtmlViewer
isMarkdown && !sourceViewMode → MarkdownViewer
isMarkdown && sourceViewMode → CodeViewer (language=markdown)
isCsv/isTsv && !sourceViewMode && !parseError → TableView
isCsv/isTsv && (sourceViewMode || parseError) → ParseErrorBanner + CodeViewer
isJson/isYaml/isXml && !sourceViewMode && !parseError → TreeView
isJson/isYaml/isXml && (sourceViewMode || parseError) → ParseErrorBanner + CodeViewer
isImage → ImageViewer
else → CodeViewer
```

### 自查命令

```bash
cd frontend-v3 && npx vitest run src/composables/__tests__/useCsvParser.spec.ts src/composables/__tests__/useTreeData.spec.ts src/composables/__tests__/useEntryDetailComputed.structured.spec.ts src/components/__tests__/TableView.spec.ts src/components/__tests__/TreeView.spec.ts --reporter=dot
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && npm run build
```

## 门槛

- 代码改动落盘（新增 7 文件 + 修改 6 文件 + package.json）
- P3 测试复制到实际位置
- vitest 新测试全绿（5 个 spec 文件）
- vue-tsc 零错误
- npm run build 成功
- 不改测试代码内容

## 返回给主 Agent

只返回两行：产出文件路径 + 一句话摘要（实现完成，N 个测试全绿）。

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
