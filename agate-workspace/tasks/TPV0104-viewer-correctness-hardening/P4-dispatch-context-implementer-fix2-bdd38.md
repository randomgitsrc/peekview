---
phase: P4
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: implementer
round: retry-2-p65
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**P4 重试 #2（因 P6.5 judge 判 `needs-revision`）**：修复 **BDD-38 Then③**。

**这是一条实质实现缺陷，不是验收证据问题。**

### 缺陷是什么

**P1 BDD-38 Then③ 原文**：
> ③ 清单中每一项**可对应到具体文件名**

**现状（judge 从证据里揪出来的直接证据）**：
```
P6-evidence/logs/bdd38-41-live-http.log:19
③ 每项可对应到具体文件名 = False
skipped[0] = {"file_id":143, "reason":"count_limit", "filename":null, "path":null, "size":null}
```

**根因**：`backend/peekview/api/files.py:334-343` 对 `count_limit` 项**硬编码 `"filename": None`**：
```python
for overflow_id in inject_ids.overflow:
    skipped.append({
        "file_id": overflow_id,
        "reason": "count_limit",
        "filename": None,      # ← 主动放弃，不是查不到
        "path": None,
        "size": None,
    })
```

**⚠️ 关键：这是「选择不查」，不是「查不到」。我已实测证明 Then③ 完全可满足**：
`count_limit` 的 id 来自 `select_inject_ids()` 的 `overflow` —— 它们只是**超过 40 上限、未被选中的 id**，**文件本身在 DB 中存在**。
我现造 42 文件 entry 实测：`ids[40]=87` 在 `GET /raw` 中能查到 `filename='s39.css'`。

→ **只需对 `inject_ids.overflow` 补一次 `get_files_by_ids(entry_id, inject_ids.overflow)`**，即可拿到 `filename`/`path`/`size`。

**为什么当初没做**：P2-design `:410` 当时的判断是「`get_files_by_ids` 只返回命中行 → 溢出 id 从未被查询 → 拿不到文件名」，**但这是把"未查询"当成了"查不到"**。P2 基于该误判允许 `filename: null`，**却没有走 [BASELINE_CHANGE] 程序** → 等于用实现决策悄悄削弱了 P1 判据。judge 判 FAIL 是正确的。

### 要做什么

1. **`api/files.py`**：`count_limit` 项补查文件名。
   - 在 `select_inject_ids` 之后、构造 `skipped` 之前，对 `inject_ids.overflow` 做一次 `get_files_by_ids(entry_id, inject_ids.overflow)`（**一次 IN 查询，不要 N+1**）
   - `count_limit` 项填 `filename`/`path`/`size`（从查询结果取）
   - **若某个 overflow id 在 DB 中确实不存在**（客户端传了瞎编的 id）→ 该 id 的 `filename` 保持 `null`，**但 `reason` 应改为 `not_found`**（它确实不存在的，不是"超上限"）
     > 语义要点：`count_limit` = "文件存在但超了数量上限"；`not_found` = "DB 里没这个 id"。二者不能混。当前代码把不存在的 id 也可能归到 `count_limit`（如果它排在 40 之后），这是错的。
   - **`not_found` 类仍允许 `filename: null`**（真不可知，客户端传的 id 不存在）—— 这是合理的、**不是削弱判据**，因为 BDD-38 的 Then③ 语境是「被跳过清单里的项」能对应到文件名；不存在的 id 无文件名可言。**但请在 `P4-implementation.md` 里显式说明这一边界**。

2. **`backend/tests/test_html_render.py` 的 `test_bdd_38_*`**：**把判据收紧回 P1 原文语义**。
   - 当前它把 ③ 写成「可按 `file_id` 定位、`filename` 可为 `null`」= **未经批准的判据替换**
   - 改为：**对 `count_limit` 类的每一项，断言 `filename` 是 `str` 且非空**（文件真实存在，必须能对应到文件名）
   - `not_found` 类仍可断言 `filename is None`
   - **这是恢复基线，不是新增需求** —— 你改的是测试判据回 P1 原文，不是改 P1 文本。

3. **补一条正向覆盖**：现有 `test_bdd_38` 用「N 个 CSS」构造，`count_limit` 的 id 都存在 → 修复后应能取到文件名。确保该用例真的断言了「`count_limit` 项的 `filename` 非空」。

### ⚠️ 严格边界（不可越线）

1. **不得修改 P1-requirements.md**（基线，P2–P8 禁改）。
2. **不得放宽 P2 的其他冻结项**：`_MAX_INJECT_IDS=40`、单文件 2 MiB、总字节 8 MiB、`REASONS` 六元闭集（**不新增 reason**）、`skipped[]` 五字段 schema。
3. **`file_id` 仍必填**（`not_found` 类也有）。
4. **CSP 与响应头一字不改**（BDD-46）。
5. **不动前端**（本轮只修后端 BDD-38）。
6. **性能**：新增的 `get_files_by_ids` 查询只加**一次**（批量 IN），不要 N+1。

### 必须自查

```bash
cd backend && .venv/bin/python -m pytest tests/test_html_render.py tests/test_entry_service.py tests/test_entry_file_order.py -q --tb=short
```
- 该批应全绿（含收紧后的 `test_bdd_38`）
- **`= inject_resources(` 必须仍是 13**、**`_process_css_refs(` 必须仍是 8**
- **`make lint` exit 0**（注意 SIM300 类规则）
- **全量后端** `make test-quick` 应仍为 `1221P / 1F（预存 test_cli_remote）/ 3S`（新增用例数可能 +1，passed 数相应变化，但**失败集不变**）

**并请自测三条**（这是关键，不能只靠既有用例）：
- **① count_limit 项有文件名**：造 N=41 sibling（`max_entry_files=42` 覆写），请求 `?inject=` 全部 41 个 id → 报表里 `count_limit` 项**必须**有 `filename`（非 null）
- **② 存在的 id 归 count_limit、不存在的归 not_found**：混合传入 41 个真实 id + 1 个瞎编 id → 前者超 40 的归 `count_limit` 且有文件名，后者归 `not_found`（filename 可为 null）
- **③ 势不变式仍成立**：`requested - inlined == len(skipped)`

### 环境隔离（强制）
- 只用 `:8888`（**严禁** `:8080`、**严禁** `~/.peekview/`）
- 状态标记二值：`[PROD_TOUCHED] {描述}` / `[PROD_NOT_TOUCHED]`
- 造/删 entry 只经 debug HTTP API、**禁 CLI**、用完即删（**用 slug**）、须同时给 `path` + `filename`
- 临时文件放 `<项目根>/.agate-tmp/`（**不用 `/tmp`**）
- **不要 commit**
- **注意**：`:8888` 与 `:8890` 都可能在跑；用 `:8888`

### 产出
- 代码改动落地 `backend/`
- 在 `TASK_DIR/P4-implementation.md` **追加「重试 #2（P6.5 judge 退回）」章节**：逐条对应 BDD-38 Then③ 的修复 + **显式说明 `not_found` 类允许 `filename: null` 的边界** + 三条自测结果
- 每修完一项立刻往 `TASK_DIR/P4-progress.md` 追加一行

### 输入文件
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（**BDD-38 原文，这是判据来源**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-design.md`（`D7` 的 skipped schema `:410-412`；**注意 `:410` 的 "filename 可为 null" 判断已被证明过度保守**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P6.5-judge-verdict.md`（judge 的 FAIL 论证）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P6-evidence/logs/bdd38-41-live-http.log`（**含 `③ = False` 的直接证据**）
- `{project_root}/AGENTS.md`
- 源码：`backend/peekview/api/files.py`（`:334-343` 硬编码 None 处）、`backend/tests/test_html_render.py`（`test_bdd_38_*`）

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
- 环境：`:8888` 在线（跑新代码，报表块存在、`maxInjectIds: 40`）；生产 `:8080` 不可达；git HEAD=`a918b092`（P6 已提交）。
- **我实测确认的两条关键事实**：
  1. `select_inject_ids`（`html_render_service.py:110`）的 `overflow` = 「前 `limit` 个之外的 id」，**这些 id 对应的文件通常存在**（只是没被选上）
  2. 我现造 42 文件 entry 实测：`ids[40]=87` 在 `GET /raw` 中查到 `filename='s39.css'` → **Then③ 可满足**
- **当前测试基线**：后端 `make test-quick` **1221P / 1F（预存 `test_cli_remote`，沙箱只读）/ 3S**；前端 1514P/0F；typecheck/lint exit 0。
- **P2 的 `:410` 判断**：「`get_files_by_ids` 只返回命中行 → `count_limit` 拿不到文件名」——**前半对、后半错**：没查 ≠ 查不到。
- **judge 的另一条 WARNING（不阻断，但可顺手改）**：`known-failures.md` 未逐 case 列名（P1 W-新6 要求）。若有余力可在该文件里把 3 条的**具体 case 名**列出（`viewer.spec.ts` 的 18 个、`t091` 的 14 个失败 case 名，从 `P6-evidence/logs/` 的 E2E 日志里可提取）。
- 环境坑：临时产物落 `.agate-tmp/`（不用 `/tmp`）；造件须给 `path`+`filename`；DELETE 用 slug。
</objective_info>
