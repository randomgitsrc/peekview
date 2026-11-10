---
phase: P4
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0102
role: implementer
batch: frontend-shared
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**只做 `frontend-shared` 这一批**：把"时间格式化 / 可见性选项构造 / 可见性目标映射 / 菜单组件 / store 能力"这些**共享叶子件**做好（**本批不挂载到任何视图**）。让本批对应的 vitest 用例转绿。

### 约束

**本批改动范围（严格限定——只改这些文件）**

| 文件 | 改动 |
|---|---|
| `frontend-v3/src/composables/useRelativeTime.ts` | 改 `formatRelativeTime`（修 `NaNm ago` / 未来时间两处边界）+ 新增带时区的绝对时间格式化 |
| `frontend-v3/src/components/TimeDisplay.vue`（**新建**） | 时间显示组件：主显绝对时间（`shortOffset`），悬停显示自定义 DOM tooltip（相对 · 绝对 `longOffset` + IANA 名） |
| `frontend-v3/src/utils/visibility-options.ts`（**新建**） | 纯函数 `buildVisibilityOptions` |
| `frontend-v3/src/utils/visibility-target.ts`（**新建**） | 纯函数 `toPatchPayload` / `needsConfirm` |
| `frontend-v3/src/components/VisibilityMenu.vue`（**新建**） | 可见性菜单组件（icon / inline / sheet 三变体） |
| `frontend-v3/src/stores/entryList.ts` | 新增 `setVisibility`（返回 `{ok, revokedShares}`，**store 内不发 toast**），替代 teamId 守卫 |
| `frontend-v3/src/stores/entryDetail.ts` | `syncVisibility` 扩展为同步 `{isPublic, teamId, team}` |

**严禁**改：`EntryCard.vue` / `EntryListRow.vue` / `EntryListView.vue` / `EntryDetailHeader.vue` / `EntryMetaTagsBar.vue` / `EntryDetailContent.vue` / `EntryDetailView.vue` / `useEntryDetailActions.ts`（那是 `mount-explore` 与 `mount-detail` 两批的范围）。

**四条已实测的硬约束（违反必错）**

1. **`Team` / `TeamRef` 都没有数字 id**（`types/index.ts:14-18` = `{slug,name,memberCount}`；`:9-12` = `{slug,name}`）。「当前团队」的**唯一派生路径**是 `entry.team?.slug ?? null`。**不得**写 `teams.find(t => t.id === ...)`——`tsc` 会直接报错（CI 强制）
2. **tooltip 必须是自定义 DOM 元素 + `visibility` 切换**（P2 决策 C2，主 Agent 实测）：原生 `title` 属性与 CSS `::after` 的 Playwright `getByText` 命中均 **0**；`opacity:0` 的 `isVisible()` **仍为 true**（会破坏 BDD-02 的 Given/When 区分）。必须 `role="tooltip"`
3. **`dateStyle`/`timeStyle` 与 `timeZoneName` 不能共存**（`TypeError: Invalid option`）→ 必须逐字段写 `year/month/day/hour/minute/second`
4. **时区名位置随 locale 变**（`zh-CN` 下在时间之前）→ **禁止字符串拼接**，整体交给 `toLocaleString`；用 `shortOffset` / `longOffset`（`short` 有歧义：`CST` 四种含义）

**`visibility-options.ts` 契约（P2 §3.5 已写死，照抄）**

```ts
type VisibilityTarget =
  | { kind: 'public' }
  | { kind: 'private' }
  | { kind: 'team'; teamSlug: string; teamName: string }
type TeamOption = Team   // 无 id

function buildVisibilityOptions(input: {
  isPublic: boolean
  currentTeamSlug: string | null
  teams: Team[]
  teamsFailed?: boolean
}): { items: VisibilityTarget[]; teamSubmenu: TeamOption[]; teamsFailed: boolean }
```
规则：当前态项**不出现**（BDD-16）；`teams.length === 0` → 无 Team 入口（BDD-17）；Team 恒为子菜单且**排除当前团队**（按 slug 比对，BDD-18）；`teamsFailed: true` → 子菜单空但返回 `teamsFailed: true` 供组件渲染**禁用项 + 失败文案**（而非静默隐藏）

**`visibility-target.ts` 契约（P2 §3.5 已写死）**
```ts
toPatchPayload({kind:'public'})  → { is_public: true,  team_id: null }   // 两字段同传！
toPatchPayload({kind:'private'}) → { is_public: false, team_id: null }   // 也清团队
toPatchPayload({kind:'team',teamSlug}) → { team_id: teamSlug }
needsConfirm(t) → t.kind === 'public'    // 只有升 Public 要二次确认
```
> **`public` 必须两字段同传**：后端 `entry_service.py:846-856` 的 `is_public` 分支在 `team_id !== null` 时无法变 public；清团队要 `team_id_set` 为真且 `team_id is None`（`:808-818`）。只传 `is_public: true` 会停在 private（BDD-19 判据）。

**`VisibilityMenu.vue` props 契约（P2 §3.5，照抄）**

| prop | 类型 | 必填 | 说明 |
|---|---|---|---|
| `entry` | `Entry` | ✓ | 取 `isPublic` / `team?.slug` |
| `teams` | `Team[]` | ✓ | `teamStore.allTeams` |
| `variant` | `'icon' \| 'inline' \| 'sheet'` | — | 默认 `icon`；**组件内不做自动切换**，由父组件按 `isMobile` 下发 |
| `disabled` | `boolean` | — | 触发按钮 `disabled` + `aria-disabled`，菜单项不响应点击（BDD-24） |
| `teamsFailed` | `boolean` | — | Team 位渲染禁用项 + 失败文案 |

emits：`select(payload)` / `confirm-cancel()`（载荷 `[]`）
内部状态 5 项：`isOpen` / `isTeamSubmenuOpen` / `pendingTarget` / `isConfirming` / `triggerRef`

**a11y（BDD-30 + D-12，硬要求）**
- 复用 `OverflowMenu.vue` 的 a11y 惯例（**抄模式不改组件**）：`Escape` → `close()` → `triggerRef.value?.focus()`（焦点回归）、Tab 分支、监听成对增删
- `aria-haspopup` / `aria-expanded`
- **所有变体的触发按钮必须有 `aria-label`**（`OverflowMenu.vue:15` 有先例）；icon-only 变体尤其必须有
- `:focus-visible` 焦点环（`DESIGN.md:290` 强制；参照 `.icon-btn:focus-visible` 在 `layout.css:279`）
- sheet 变体关闭按钮 `aria-label="Close"`

**可见文案（P2 §3.5 三子表，照抄）**
- `inline` 三态**逐字沿用现状**：`Public` / `Private` / `仅团队可见 · {team.name}`
- `icon`：无可见文字，仅 14/16px Lucide 图标
- `sheet`：浮层标题 `可见性`
- `aria-label="Visibility: {statusLabel}"`（**共用同一纯函数**，防漂移）

**尺寸（N-3 已拆分，注意别改既有）**
- **本任务新增的 `.visibility-toggle` 在移动端 ≥ 44×44**（写 `@media (max-width: 640px)` 块）
- **既有 28×28 按钮（`card-action-btn` / `action-btn`）本任务不改**——**不要**动它们

**`entryList.setVisibility`（P2 §3.5，E-2 已定）**
```ts
type SetVisibilityResult = { ok: boolean; revokedShares: number | null }
```
- 返回 `{ok, revokedShares}`；**store 内不得出现 `toast.show` / `useToast`**（toast 统一由视图层发，避免双 toast）
- 替代现有 `toggleVisibility` 的 **teamId 守卫**（新语义允许 team entry 切换）；`toggleVisibility` 是否保留看你判断（P2 倾向保留供旧调用点，但须不阻碍新路径）

**环境约束**
- 严禁触碰生产 `:8080` 与 `~/.peekview/`
- **严禁**在 `frontend-v3/src/` 留 scratch 探针（前几轮评审误建过）
- 状态标记二值：`[PROD_NOT_TOUCHED]`

**命令与落盘纪律**
- 任何 bash 命令外层 `timeout`（预期耗时 ×1.5；vitest 用 300s+）
- 每完成一个文件改动立刻 `bash >>` 追加到 `P4-progress.md`，行首加 `[frontend-shared]` 前缀
- 临时产物落 `<项目根>/.agate-tmp/`，**不要用 `/tmp`**

### 上游关联

P1 `290f4c43` / P2 `da0c85a7` / P3 `20fd76b3` 均已提交。

- **P3 已写好 vitest 用例**：`useRelativeTime.spec.ts` / `visibility-options.spec.ts` / `visibility-target.spec.ts` / `time-display.spec.ts` / `visibility-menu.spec.ts` / `entry-list-visibility.spec.ts`（共 30 个用例）
- **你的验收依据就是这些用例**——**不要改它们**；若认为某条与 BDD 矛盾，标 `[DESIGN_GAP]` 报告
- `useResponsiveLayout.ts`（`isMobile = viewportWidth <= 640`）已存在，**本批不需要用它**（挂载批才用）

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P3-test-cases.md`（测试映射，§前端部分）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P2-design.md`（**§3.4 时间显示 / §3.5 可见性菜单 / §3.8 稳定测试标识清单 / §5 UI 设计**）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P2-review.md`（C-1~C-23 执行约束）
- `DESIGN.md`（§9 bottom sheet / 44px、§10 focus-visible 规范）
- `AGENTS.md`
- `{agate_root}/assets/execution-roles/implementer.md`

按需读：`useRelativeTime.ts`、`OverflowMenu.vue`（**a11y 模式来源**）、`ConfirmDialog.vue`（二次确认复用）、`visibility-options.spec.ts` 等 6 个新 spec（契约）

### 产出文件字段

用 `FILE={AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P4-implementation.md agate-md-field-set --list` 查字段。**若该文件已存在（`backend-serialize` 批可能已创建），不要覆盖**——只追加 `[frontend-shared]` 节。

主 Agent 已确定：phase=P4, task_id=TPV0102, parent=P2-design.md, trace_id=TPV0102-P4-20261110, agent=implementer, status=draft, created=2026-11-10

**主动 set**：`prod_touched false`（hook 会要求它）

### 门槛（什么算完成）

- 6 个新建文件 + 3 个改动文件齐备
- `cd frontend-v3 && timeout 300s npx vitest run src/composables/__tests__/useRelativeTime.spec.ts src/utils/__tests__/visibility-options.spec.ts src/utils/__tests__/visibility-target.spec.ts src/components/__tests__/time-display.spec.ts src/components/__tests__/visibility-menu.spec.ts src/stores/__tests__/entry-list-visibility.spec.ts` → **全绿**
- `make typecheck` 通过（`vue-tsc --noEmit`，CI 强制）——**特别确认无 `Team.id` 引用**
- `make lint` 通过
- 既有测试无回归（`npx vitest run src/components/__tests__/tpv0095-*` 可能因 teamId 守卫被替代而转红——**若转红，按 P2 的「显式取代」要求处理并报告我，不要静默删断言**）

### 返回给我

只返回四行：
  1. 改动文件路径列表
  2. 一句话摘要（不超过 40 字）
  3. 测试结果：本批 6 个 spec 的 passed/failed 数 / typecheck / lint / 既有 tpv0095 是否有转红
  4. files_modified: [...]
**绝对不要返回代码全文或完整测试输出。**

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P4

路径：phase-cards/P4-implementation.md
---
# P4 — 代码实现

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P4 且有合规理由（check-pruning.py 已检查）→ 跳过，读 P5 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.py $TASK_DIR`（自动捕获环境基线）。
   该步骤不会阻塞流程——任何 stderr 输出（含 WARNING）均可忽略，直接继续步骤 1，
   无需查看结果、无需判断、无需因为看到 WARNING 而停下来处理。

**创建型测试清理钩子（强制要求，与 P3 卡同源）**：实现含创建资源用例时，须落地清理钩子——创建即注册、测试结束无条件删除（不因响应非 2xx 中止删除）、删除接受 200/204/404 为已清理（afterEach 清理队列模式）；只修 P3 卡不修本卡即复发，两处须同步。

1. 派发 implementer subagent → 产出代码文件
   1.1 写 P4-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 P2 的 gate_commands 跑单元测试（非 gate，只是自查）
3. 按 C8 映射表派发评审（见下方）
4. 预跑 check-gate.py P4（确认暂存区有代码文件）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/ + 代码文件（含 .state.yaml，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P4，不要提前写 P5——phase = 本 commit 的产出阶段
6. git commit -m "wf({Txxx}-P4): {摘要}"（phase=P4，P4 产出含 P4-implementation.md + 代码文件）
7. P4 commit 完成后进入 P5：**phase 推进 P5 随 P5 产出 commit 一起**（P5-test-results/ 就绪后），不是单独 phase commit

## 如果是重试

确认上一轮失败原因（来自 gate 输出 / review rejected 理由）
→ 只修复失败项，不重做已通过的部分
→ 修复后重跑全量测试（T027 教训：修复可能引入回归）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P4 MAX=3）

**若这次是从 P6（或其他更后的阶段）退回来的**：`{AGATE_WORKSPACE}/tasks/{Txxx}/` 下不会再有旧的 P6-acceptance.md（已被归档），但当初具体是哪条 BDD 失败、失败原因是什么，会摘要在 `{AGATE_WORKSPACE}/tasks/{Txxx}/.retreat-history.md` 里——**重新派发 implementer 时，dispatch-context 必须引用这份摘要**，不能让 implementer 只看到"现有代码"却不知道具体要修哪里。已有代码不会被撤销、也不需要重新实现，是在已有实现基础上定向修复。**回退落地后必须建 DEBT 条目**（`source: retreat`，`evidence` 引用 retreat 提交哈希，模板 `assets/templates/tech-debt-template.md`——TAG0001 强制，见 `agate/rules/state-transitions.md` 回退规则节）。

## 前置条件

- [ ] P2-design.md 存在且 files_to_read 字段完整（导航清单）
- [ ] P2-review.md status: approved（P2 不可裁剪）
- [ ] P3-test-cases.md 存在（测试已设计）
- [ ] check-tdd-red.py 确认红灯（测试先于实现）
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
UI/前端等需构建任务：单元测试全绿不代表可用，implementer 在 P4 完成后应构建并确认 dist 等构建产物存在，不能只跑单元测试就认为完成。
**这是本卡明确的 checklist 条目**（RM-AG0083 / DEBT0015 的落点）：`gate_commands` 声明了**构建 / 打包 / 部署**类命令时，P4 完成后须**实际产出并确认产物存在**（如 UI 任务的 `dist`）；协议**无**对应机械 gate（产物路径项目各异）⇒ 该条目即「无机械 gate 时的既定出口」，主 Agent 在 P4 gate 前逐项确认，不得只凭单元测试全绿判完成。

## 生产环境隔离
任何写入生产环境/生产数据库/生产 API 的操作都必须先 PAUSED 报告人工。
```

## 产出规格

- P4-implementation.md 必须声明 `implementation_dir: {实际路径}`
- 代码文件在声明的目录下
- 遵守 P2-design.md 的方案设计 + 现有项目代码规范

## 批级证据 P4-evidence（MVWU 阶段 1，不阻断，TAG0036）

> 适用于 P2 声明了 `dispatch_plan.batches` 的任务：每批一个证据日志，回答"这一批的 `tests_filter` 跑出了什么"。**记录不阻断**——它不是 gate、hook 或 CI 的一部分，非零退出的批仍可 commit。

- **路径**：任务目录下 `P4-evidence/{batch}.log`。`{batch}` = 该批在 `dispatch_plan` 中的 `id`，须 filename-safe（匹配 `[A-Za-z0-9._-]+`）。
- **写入方**：主 Agent 在该批 commit 前运行该批 `tests_filter`，并把运行结果**机械转录**入日志（重定向/脚本落盘，不是撰写内容；内容只来自命令实际结果）。
- **格式**：逐行 `key: value`，最小内容：
  - `command`：实际运行的命令
  - `exit_code`：命令退出码
  - `git_head`：运行时的 HEAD，须为全长 commit 对象名
  - `timestamp`：运行时间
  - `expected_red`：预期为红的用例，默认 `[]`
  - `duration_seconds`：耗时秒数
  - `failed_tests`（可选）：实际失败的用例，默认 `[]`
- **列表编码**：`expected_red` / `failed_tests` 的值为单行 flow 序列，元素为用双引号包裹的 pytest node id（如 `["tests/a.py::test_x[case 1]"]`）；元素相等按 node id 精确字符串相等比对，不可解析时观测器给 UNKNOWN。
- **观测**：`python3 agate/scripts/check-mvwu.py <task_dir>`（默认每批一行契约行）或 `--observe`（每批一行观察表）。观测**不阻断**；UNKNOWN 不等价于 PASS——无法核对时不得当作通过。
- **边界**：该目录不进 judge 白名单，也不登记进 rules / dispatch-protocol；P6.5 judge 不读取它。

## 新增文件核对表

> 仅当项目已采用骨架（`P2-skeleton.md` 存在）或 CODE-MAP（`{AGATE_WORKSPACE}/agents/CODE-MAP.md`
> 存在）机制时填写；未采用则本节可省略。

implementer 为本阶段**每个新增文件**填一行：

| 新增文件路径 | 骨架归属 | CODE-MAP 处理 |
|------------|---------|--------------|
| {path} | `within <dir>` / `[SKELETON_DEVIATION: 理由]` | `[CODE_MAP_UPDATED]` / `[CODE_MAP_EXEMPT: 理由]` |

- **骨架归属列**：新增文件落在骨架声明的目录内 → `within <dir>`；落在骨架外 → 标
  `[SKELETON_DEVIATION: 理由]`（不阻断，供 P7 核对）
- **CODE-MAP 处理列**：新增文件已同步更新 `agents/CODE-MAP.md` → `[CODE_MAP_UPDATED]`；判断
  该文件不需要更新 CODE-MAP（如临时/测试脚手架）→ `[CODE_MAP_EXEMPT: 理由]`

`change_type: refactor` 同样适用本表（不因换用回归口径而豁免）。

## 评审派发（C8 机械映射）

**在 P4 实现完成后、gate 前**，按 P1 声明的 domains 和 risk_level 派评审。C8 映射表是机械规则，不靠判断"需不需要"：

| domain | 派哪些评审 | 产出 |
|--------|----------|------|
| backend | review | P4-review.md |
| frontend | design-review | P4-review.md |
| mcp | review（关注 MCP 接口契约）| P4-review.md |
| security | cso | P4-review.md |
| risk=high | P4 实现评审（按 domains 派 review/design-review/cso；P2 plan-eng-review 已审方案，P4 实现评审不可省）| P4-review.md |
| full（tier=full 或声明 ceremony: full）| P4 实现评审（按 domains 派 review/design-review/cso，同 risk=high 不可省；P2 plan-eng-review 已审方案）+ cso（security 域）+ P7 不可裁（full 档任务 P7 为强制阶段）| P4-review.md |

多个评审角色 `专家组并行` → 所有返回后派组长汇总 → 统一 P4-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长产出：P4-review.md。**agent 字段必须非 main**（与 P2 评审同规则，check-gate.py 在 P2 分支硬拦截 agent=main 的 approved）
5. 组长规则：不发表新意见，只汇总；任何 BLOCKER → rejected；分歧 → 交人工；全票无 BLOCKER → approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P4-review.md。

**评审 checklist（RM-AG0046）**：`agate/scripts/check-maintainability.py` 检出 violations 非空时，评审角色 approve 前必须读过任务目录 `known-violations.md` 的登记理由——"是否接受该反模式"的判断权在评审角色，登记与数量对齐不单独构成放行依据。

review 不通过 → implementer 修改代码 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 按包拆分并行（条件触发，需额外约束）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry / 共享文件统一后处理见 dispatch-protocol「派发编排机制」并行规则。

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

## gate 规则（check-gate.py 会跑）

```bash
check-gate.py P4 $TASK_DIR
```

- **exit 0**：暂存区含非 md/yaml 代码文件（git diff --cached --name-only）
- **exit 1**：暂存区仅 .md/.yaml 文件（无实际代码变更）→ 不能推进
- **exit 1**（RM-AG0046 三重门槛）：检测 violations 非空时，`known-violations.md` 必须存在且登记条目数 ≥ violation 数（评审检查复用上方既有 exit 1 条件；violations 为空 / 检测未部署 / git 通道不可用时不阻断）
- WARNING（不改变 exit code）：骨架/CODE-MAP 机制已采用（P2-skeleton.md 或 agents/CODE-MAP.md 存在）但缺「新增文件核对表」标题

## 推进条件（全部满足才写 phase: P5）

- [ ] 暂存区含代码文件（非 .md/.yaml）
- [ ] 按 C8 映射表触发的评审全部完成：P4-review.md status: approved（所有任务都要求——risk=high 的 P2 plan-eng-review 审方案，P4 实现评审按 domains 另行派发，不可省）
- [ ] SCOPE+ 已处理（若本阶段产生）：P1-requirements.md 有 [SCOPE_RESOLVED]（行首声明格式）
- [ ] git commit 完成

## 常见错误

1. **不读 files_to_read，在项目里乱翻**：implementer 拿到 P2 的 files_to_read 清单后应按清单阅读，不要在项目里全文搜索或整目录全读——上下文会爆炸
2. **自行加范围外改动**：发现需要做但不在 P1 范围内的改动 → 标 [SCOPE+]（行首声明格式：裸 `[SCOPE+]` / `- [SCOPE+]` / `**[SCOPE+]**` / `> [SCOPE+]` 均可；句中引用与反引号包裹不触发 gate）而非直接做
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