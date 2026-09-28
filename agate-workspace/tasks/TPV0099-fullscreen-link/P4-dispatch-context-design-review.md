# P4-dispatch-context-design-review — TPV0099

---
phase: P4
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: design-review
---

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

> ⚠️ 以下派发指引是本次任务的强制指令。**只审不写**：不修改任何实现文件或测试文件。

## 目标

对 TPV0099（全屏模式链接 `/{slug}/f`）的 **P4 实现**做独立评审，产出 `P4-review.md`。

**C8 映射依据**：P1 声明 `domains: [frontend]`、`risk_level: medium` → 仅触发 **design-review** 一个角色（无 high/full/security，故无需专家组汇总，你直接写 `P4-review.md`）。

## 你是独立视角

implementer 在隔离上下文里写的实现可能有盲区。**不要转述其自述**——对关键声明回到源码 read/grep **与真实浏览器实跑**实证。

**本任务的历史警示（P1/P2 已实证 4 次"验证失效"）**，请特别注意：
1. 判据与需求互斥（必 FAIL）→ 修完反向失效为**恒真**（必 PASS）
2. 主 Agent 的 importlib 探针因缺 `sys.path` 落到**降级 stub**，产出与真实 gate **相反**的结论
3. 把一个根因标签贴在两个不同事实上
4. **并行评审互相污染验证前提**（一方"不抬高基线"的结论被另一方后续写入推翻）

→ **验证工具与验证结论本身都要被验证**。你给任何"通过/不通过"结论时，请附**可复现的命令或代码**。

## 评审对象与输入

- **实现代码**（P4 产出）：`frontend-v3/src/composables/useZenMode.ts`、`frontend-v3/src/router.ts`、`frontend-v3/src/views/EntryDetailView.vue`
- **实现声明**：`P4-implementation.md`（含 §8 两条 `[DESIGN_GAP]`）
- **方案权威**：`P2-design.md` —— **§1.1「最终规格」表（`:60-77`）+ 三个禁止变体**是实现的唯一权威
- **需求基线**：`P1-requirements.md`（19 条 BDD）
- **测试**：`P3-test-cases.md` + 3 个测试文件
- 你的角色定义：`/home/kity/.agate/v0.76.0/agate/assets/review-roles/design-review.md`

## 评审重点（按重要性排序）

### 1. 实现形态是否与 P2 §1.1「最终规格」表**逐字一致**（最高优先）

请自己 `read` 源码确认（不要采信 `P4-implementation.md` 的自述）：

| 面 | 期望 |
|---|---|
| composable 签名 | `useZenMode(locked: () => boolean = () => false)` |
| 调用点 | `useZenMode(() => route.meta?.zen === 'locked')`（**thunk + `?.` 二者缺一不可**） |
| 内部读取 | 一律 `locked()` |
| `zenMode` | **`computed(() => locked() \|\| manualZen.value)`**（**不得落 ref**） |
| `zenAriaText` | computed；**不含** `Escape` / `exit` 子串（BDD-6 词表为闭集） |
| 返回对象 | `{ zenMode, zenAriaText, handleZenKeydown }`（**无 `updateZenAria`**） |
| 锁死短路 | `handleZenKeydown` 首行 `if (locked()) return` —— **不 `preventDefault`、不 `stopPropagation`** |
| 路由 | `/:slug/f` + `meta: { zen: 'locked' }`，位于 `/:slug` 之后、catch-all 之前 |

**特别核三个禁止变体**是否被避开：
- ❌ 裸值 `route.meta.zen === 'locked'`（会让既有 mock 缺 `meta` 的两 spec 挂载即抛）
- ❌ `zenAriaText` 保留 ref 却给 `updateZenAria` 加赋值（TS2540）
- ❌ 签名改 `locked: boolean`（**能同时通过 typecheck 与 test-frontend**，但把锁定态固化为 setup 期快照 → 组件复用下状态残留 → **假绿**）

### 2. 真实浏览器行为是否满足 BDD（给证据，不只看测试绿）

**必须用 Chrome CDP 实跑**（`connectOverCDP('http://127.0.0.1:18800')`），至少独立复核：
- **BDD-1/2/3**：`/{slug}/f` 下 8 项 chrome 全隐藏、内容区占满视口（桌面 1280×800）
- **BDD-3 的 A/B 排除集**：**不可简化**为"排除容器链"（已实测会退化成恒真）。请按 P2 §6.4 的 A/B 规则复现，并做**三态负向对照**证明判据有拦截力（正确实现命中 0；强制 `.detail-header` 可见应命中 > 0）
- **BDD-4/5**：锁死态按 `f`/`F`/`Ctrl+f`/`Escape` → chrome 可见性 / 内容区几何 / URL **三者均不变**
- **BDD-6**：公告文本不含退出词；**全屏视图自身 chrome 范围内**（排除内容区及后代）可聚焦元素为 0 或无一命中词表
- **BDD-7**：锁死态下 `TableView` 分页浮层可开、按 Escape **可关**，且全屏视图保持
- **BDD-9/10/15**（需登录/自建，见下）
- **BDD-11/12**（回归）：`/{slug}`（无 f）与 f 键 zen **行为完全不变**——这是本任务最关键的回归面
- **BDD-14**：移动 390×844 几何

### 3. 独立复核 §8 的两条 `[DESIGN_GAP]`（**这是本次评审的实质判断点**）

`P4-implementation.md` §8 声明了两条 `[DESIGN_GAP]`，主张"auth spec 的 4 个失败是**测试缺陷**而非实现缺陷"。**请不要采信，独立复核**：

- **DG-1（BDD-9 auth spec `:151`）**：断言 `pathname === '/markdown-test'`，而该用例 Given 自己导航到 `/markdown-test/f`。
  **要核的**：P1 BDD-9 的 Then 原文（`P1-requirements.md:218-224`）**到底要求什么**？把 pathname 断言删掉/改锚定，是否是**放宽判据**？它与 BDD-2/8/13/14/18 的"保留 `/f`"是否真的互斥？
- **DG-2（BDD-10 auth spec `:288`）**：匿名基线断言得 200 而非 404，主张原因是 Playwright `request` 夹具的 **cookie 存储**被 `aliceToken(request)` 污染。
  **要核的**：这个机制**是否真实**（请自己写探针验证：同一 context 与全新 context 各发一次无 Authorization 的 `GET /entries/{slug}/raw`，对比状态码）？BDD-10 的 **Then 本体**（真 token 可见 / 无 token 与伪 token 均不可见 / 三元组互异）**是否真的满足**？

**主 Agent 已独立复核并确认两条均成立**（DG-1 已读 P1 原文确认 Then 不含 pathname 且期望值搬错语境；DG-2 已写探针复现 `SAME context=200 / FRESH context=404`）。**但请你自己再验一遍**——若你的结论与主 Agent 不同，**给出你的实证锚点**，那正是独立评审的价值。

### 4. Not Modify 清单是否被遵守（防止"顺手改进"）

- **P1 §4.3 三处存量问题**：死选择器 `.mobile-actions` / 重复的 `zen-shortcut.spec.ts` 两文件 / `t052:141` 恒真假绿测试 —— **均不应被改动**
- **`.archived-banner` / `.expired-warning-banner`**：**不应**被加 zen 隐藏规则（P2 已裁决不处理，登记 DEBT0013）
- `zen-shortcut.ts` / `entryDetailKeys.ts` / `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue` 不应被改
- **既有 E2E spec** 不应为"让 E2E 全绿"而被改（`viewer.spec.ts` 的预存红灯**不得**被当成本任务问题）
- **零 CSS 改动**（元信息条隐藏早已存在）

### 5. 文档同步面

`DESIGN.md`（Zen Mode 节）/ `CHANGELOG.md`（`[Unreleased]`）/ `docs/roadmap/improvement-backlog.md` #56 是否已同步且准确（**项目铁律 8：CHANGELOG 及时记录**）。

## 环境与纪律（强制）

- debug backend `http://127.0.0.1:8888` 已运行。**开工前先探** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health`（本任务该服务已掉线 3 次）
- Chrome CDP `:18800`；Playwright 用全局包 `require('/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules/playwright')`，`connectOverCDP('http://127.0.0.1:18800')`。脚本须 `try/finally { await page.close() }` + `process.exit(0)`，**不要** `browser.close()`（会杀 Chrome）
- **跑 E2E 前先 `make build-frontend-fast`**（~15s）——否则 `e2e-safety-check.sh` 的 Check 6（`find frontend-v3/src -newer static/index.html`）会 **FATAL 拒绝运行**
- 跑 E2E 必须定向 spec：`E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test`（**裸 `make debug-test` 只跑 1 个无关 spec**）
- **严禁**触碰生产 `:8080` 与 `~/.peekview/`；**严禁** `uvicorn`/`make debug`/`npm run dev`。返回标注 `[PROD_NOT_TOUCHED]`
- **临时/探针文件严禁放 `frontend-v3/` 下**（`vitest.config.ts` 未设 `include`，默认收集 `**/*.spec.ts` → 会抬高基线；本任务已因此踩过一次坑）→ 放 `/home/kity/oclab/peekview/.agate-tmp/`
- **任何 bash 命令设 `timeout 180s <cmd>`**（E2E 类 600s+）
- 前端基线：`111 files / 1350 passed | 4 skipped (1354)`（`DiagramBlock.spec.ts` 有一条**已知 flaky**，隔离复跑确认即可）
- **不要**改 `debt/tech-debt.md`（如需登记债，在评审里给建议，主 Agent 统一登记）
- 子派发能力：不启用

## 产出

- `agate-workspace/tasks/TPV0099-fullscreen-link/P4-review.md`
- frontmatter：`phase: P4` / `task_id: TPV0099` / `parent: P4-implementation.md` / `trace_id: TPV0099-P4-20260928` / `agent: design-review` / `status:` **终态**（`approved` / `rejected` / `draft`）
  - ⚠️ **`P4-review.md` 允许 `needs-revision`**（`agate-md-field-set.py` 的 `STATUS_ENUM_BY_BASENAME` 含 `P4-review.md`）
  - `agent` 须为 `design-review`（**不能是 `main`**，`check-gate.py` P4 硬拦截）
- 正文**避免行首 `- PASS` / `- FAIL`** 格式（触发 provenance 审计拦截）；用「阻塞级 / 非阻塞」表述
- 结论须**明确二值**：有阻塞级 → `rejected` 或 `needs-revision`；无 → `approved`

## 返回给我（只两行）

1. 产出文件路径
2. 一句话结论（含 status + 阻塞级问题数 + 对两条 DESIGN_GAP 的独立判断）

**不要返回文件全文。**

> 本文件不含通过/失败预判。
