---
phase: P4
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0102
role: review
assignment: 专家组组长（P4 汇总，不发表新意见）
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**你是 P4 专家组组长，唯一职责是"汇总"，不发表新意见。**

产出 `P4-review.md`——把两份专家评审（`P4-review-backend.md` + `P4-review-design.md`）机械汇总为统一门槛文件。P4 gate 只认这个文件。

### 组长规则（严格遵守）

1. **不发表新意见**：不自行发现缺陷、不补充专家没说过的问题、不推翻专家结论
2. **任何专家非 approved → 你的 status 必须非 approved**
3. **多位专家分歧 → 标「专家组分歧」交人工**
4. **全票无 BLOCKER → status: approved**
5. **Header `agent` 字段必须是 `review`，不得写 `main`**——`check-gate.py P4` 硬拦截 `agent=main` 的 approved

### 当前事实（主 Agent 已核实）

| 评审 | status | agent | 备注 |
|---|---|---|---|
| `P4-review-backend.md` | **approved** | review | 0 CRITICAL；16 类/34 字段全覆盖、`parse_iso` 安全、表模型无污染 |
| `P4-review-design.md` | **approved** | design-review | 复审轮：F-1~F-4 全闭合；bdd25/bdd04/vc06 三处测试改动均判「修正错误断言」非降强度 |

两份都 approved → 汇总结论应为 **approved**。

### 汇总内容要求

1. **结论**：status + 一句话（专家票型 2/2 approved）
2. **各专家结论摘要**：
   - `review`（后端）：0 CRITICAL；四条硬约束落实、16 类/34 字段全覆盖（多出 `ShareCreateResponse` 经继承命中，属预期）、`parse_iso` 安全（ISO 时间体不含 Z，畸形输入只抛错不静默错值）；2 条 INFORMATIONAL（CLI apikey local/remote 显示不对称，建议进 backlog）
   - `design-review`（前端）：**两轮轨迹** —— 首轮 `needs-revision`（F-1~F-4 四阻塞 + F-5~F-9 五建议）→ implementer rev1 修复 → 复审 `approved`（F-1~F-4 全闭合，含反向对照验证；bdd25/bdd04/vc06 三处测试改动判为"修正错误断言"）
3. **必须转抄给 P5/P6/P7 的执行约束与遗留项**（这是汇总的实质价值）：
   - **P6 两条禁令**（沿用 P2）：① 不得写「对比度已满足 WCAG AA」（tertiary 暗 3.84:1 / 亮 3.04:1，低于 AA 4.5:1）② 不得把既有 28×28 按钮写成「已达标」（VC-4 只断言新增 `VisibilityMenu` 按钮）
   - **P5 必跑命令**（P2 冻结的 `gate_commands`，7 条）：`make test-quick` / `make test-frontend` / `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test` / `E2E_SPEC=e2e/team-visibility.spec.ts make debug-test` / `make lint` / `make typecheck` / `-k mixin_not_in_table_mro`。**E2E 需 debug 服务**（挂后台 job 托底 + 每次用前探活 `curl :8888/health`）
   - **预存失败**：`test_cli_remote::test_config_set_remote_api_key` 因沙箱 `~/.peekview/` 只读必红 → P5 须登记 `known-failures.md`（**仅此一条**；本任务引入的 8 项 E2E 已修至 0 failed，**不得**登记为预存）
   - **已知 fixture 问题**：`team-visibility.spec.ts` 的 BDD-40 若因 `proj-a` 团队不存在（创建 422）而红，属**既有 spec 的 fixture 缺失**，与 TPV0102 无关
   - **转 P7 的判据瑕疵（3 条，`design-review` §9 列出）**：
     - ① **BDD-25 后半条对有文件 entry 不可测**（`entryDetail.ts:49-53` 的 `loadEntry` 恒选 `files[0]` → `empty-select-file` 分支不可达）
     - ② **P2 VC-5 的 `<=2px` 基线几何上不可满足**（280px 卡宽 + 207px 绝对时间下 en-US 桌面 20/20 卡都换行）
     - ③ `F-12`：`.entry-detail{overflow:hidden}` 是潜在裁剪祖先（当前实测无裁剪）
   - **建议级遗留（不阻塞，P7 决定是否登记技术债）**：F-5（icon 变体 16px 宽 vs 相邻 28px 不齐）/ F-6（inline 变体 14px 破坏 meta-row 层级）/ F-8（`EntryDetailView.vue` 289 行，距 `t082` <300 门槛仅 11 行）/ F-9（sheet 内语言混排）/ F-10（卡片元信息换行后分隔点悬空）/ F-11（vc05 wrapped 分支判别力低）
   - **`[DESIGN_GAP]` 清单**：`P4-implementation.md` 现有 6 节，累计约 12 条 `[DESIGN_GAP]` + 2 条 `[SCOPE+]` → **P7 须逐条配对 `[DESIGN_GAP_REVIEWED:]`**（P7 卡片强制）
   - **F-1 的最终实现取舍**：选了「去 `.entry-panel` 的 `overflow:hidden`」而非 Teleport（理由：VTU `wrapper.find` 不穿透 Teleport，选 Teleport 会打断 7 个已通过的 P3 契约 spec；视觉代价实测为零）。`[DESIGN_GAP]` 第 3 条的记述已相应改正
4. **专家组分歧**：无则显式写「无分歧」

### 只读纪律（强制）
- **禁止** `git checkout -- .` / `restore` / `reset` / `stash` / `clean` / `add` / `commit` / `switch -f`
- **禁止**对真实仓库运行写类工具（`agate-inject-card.py` / `agate-md-field-set.py` / `agate-state-set.py` / `agate-task-init.py`）
- 唯一允许写入的是你自己的产出文件 `P4-review.md`
- 结束前核验 `git status --porcelain`

### 环境约束
- 严禁触碰生产 `:8080` 与 `~/.peekview/`（**`:8080` 现在应是 000**）
- 状态标记二值：`[PROD_NOT_TOUCHED]`
- 任何 bash 命令外层 `timeout`
- 临时产物落 `<项目根>/.agate-tmp/`

### 输入文件
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P4-review-backend.md`
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P4-review-design.md`（**§9 有转 P7 清单**）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P4-implementation.md`（6 节 + DESIGN_GAP 清单，仅在有疑问时查证）

### 产出文件字段

用 `FILE={AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P4-review.md agate-md-field-set --list` 查字段。

已确定值（直接复制）：phase=P4, task_id=TPV0102, parent=P4-implementation.md, trace_id=TPV0102-P4-review-20261110, agent=**review**, created=2026-11-10

由你判定：`status`（应为 approved）

⚠️ 工具坑：list 字段按**空白拆分**，不要写 `"[a, b]"`。
</dispatch_guide>

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

<objective_info>

**仓库状态**：HEAD `20fd76b3`（P3）。P4 全部改动未 commit（工作树大量 M/??）。

**主 Agent 已实测的事实（可直接使用）**
- 前端全量：**119 files / 1456 passed / 0 failed / 4 skipped**，无 `Errors` 行
- E2E（`tpv0102-explore-card-list-ux.spec.ts`）：**61 passed / 0 failed / 3 skipped**
- `make typecheck` ✓ / `make lint` ✓ / `make check-docs` ✓
- `:8080` 探活 = **000**（生产未触碰）；`:8888` 已停且端口释放
- `EntryDetailView.vue` = **289 行**（`t082` 门槛 <300，余量 11）

**未查证（需你自己读文件确认）**
- `P4-review-design.md` §9 的转 P7 清单具体条目
- `P4-implementation.md` 的 DESIGN_GAP 精确条数（主 Agent 估 ~12 条）

</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.py` 审计失败。
