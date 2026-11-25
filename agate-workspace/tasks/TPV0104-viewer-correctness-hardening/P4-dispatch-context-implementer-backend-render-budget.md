---
phase: P4
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: implementer
batch: backend-render-budget
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**P4 第 1 批 `backend-render-budget`（complexity: high）**：实现后端 HTML sibling 注入的统一资源预算 + 超限显式反馈 + 文件顺序确定性 + 安全边界文档。

**这一批要把后端那批红灯测试转绿**（P3 已写好的 `test_html_render.py` 的 TPV0104 段 + `test_entry_file_order.py`），**不得修改 P3 测试本身**。

### ⚠️ 核心铁律（RM-AG0107 / DEBT0054，违反必返工）

**契约驱动优先于既有测试全绿**：设计要求（P1 BDD / P2 设计）与既有测试冲突时，**必须实现设计要求**，并**同步更新受影响的既有测试/夹具**——**不得**以「这样会让既有测试转红」为由回退设计要求。

- 正确动作：实现设计要求 → 跑测试 → **逐条列出因此转红的既有用例与需更新的夹具** → 一并改到位
- 错误动作：保留旧行为让测试继续绿，把设计要求降级为注释/TODO
- 若你认为设计要求**本身**有误 → 写 `[CLARIFY: …]` 并停下来报告主 Agent，**不要**静默回退

### 本批要实现的 P2 设计（逐条，来自 `P2-design.md`）

1. **`_MAX_INJECT_IDS` 50 → 40**（`html_render_service.py:17`）。理由：须满足 `_MAX_INJECT_IDS < PeekLimits.model_fields["max_entry_files"].default - 1`（40 < 49），否则 `if len(result) >= _MAX_INJECT_IDS` 在真实配置下永不触发。
2. **单文件文本注入上限 `2 MiB` + 总字节预算 `8 MiB`**（两个都是**新增**，现状不存在）。
3. **`parse_inject_ids` → `select_inject_ids(inject, main_file_id, limit) -> InjectSelection`**（`selected: list[int]` + `overflow: list[int]`）；**保留 `parse_inject_ids` 作为薄包装**（回 `list[int]`，供旧签名调用者）。`break` 处把溢出 id 落进 `overflow` 而非静默丢。
4. **`_build_sibling_data` 的 >768KB 二进制静默丢弃纳入记账**（`files.py:272`，`return None` 时由调用方补记 `reason="binary_too_large"`）。**函数签名不变**（仍 `-> SiblingFileData | None`）。
5. **`inject_resources(html, siblings, *, skipped_out=None) -> str`**——**可选出参，返回仍是 `str`**（这保证 13 处既有调用零改动）。函数内做**完整消费追踪**：
   - `consumed: set[int]`（存 `id(SiblingFileData)`）+ `owners: dict[str, SiblingFileData]`（text 与 binary **共用一张**）
   - **七处埋点（缺一处不变式即破）**：① `<link rel=stylesheet>`（`:231`）② `<script src>`（`:249`）③ kind 追加 css/js（`:263`）④ `img/video/audio/source/track[src]`→二进制（`:292`）⑤ 同处→文本 SVG（`:298`）⑥ `<link rel=icon|shortcut icon>`（`:315`）⑦ **CSS 内部消费**——把 `owners` 与 `consumed_out` 透传进 `_process_css_refs()`（`:127`），在 `_replace_import()` 的 `_lookup_key` 处（`:145`）与 `_replace_url()` 的二进制/SVG 两处（`:162`/`:166`）登记，**含递归分支**（`:151` 自调用必须继续透传）。
   - `_process_css_refs` 新参数**必须是关键字可选**（默认 `None`）→ 该函数**既有 8 处**调用零改动。
   - 函数返回前遍历 `siblings`，对**不在 `consumed`** 的项追加 `{"file_id", "reason": "not_injectable", "filename", "path", "size"}` 到 `skipped_out`。
   - **⚠️ 不能用 `used_text_keys` + `_sibling_keys()` 做消费判定**——实测该钩子会漏三条真实消费路径（CSS `@import`、CSS `url()`、`<link rel=icon>`）并给出**假绿报表**（P2 的 V17-④ 有决定性反例）。
6. **`render_html_file()` 的预算编排**：`select_inject_ids` → `get_files_by_ids` → 逐文件大小检查 → 累计总量检查 → `inject_resources(..., skipped_out=skipped)`；汇总六类 `reason`；响应体尾部追加 `<script type="application/json" id="peekview-inject-report">`，内容用 `json.dumps(report, ensure_ascii=False).replace("<", "\\u003c")`（**必须转义 `<`**，否则 `path` 用户可控会提前闭合 script 并注入 DOM）。**响应头与 CSP 一字不改**。
7. **`skipped[]` schema（P2 已定死）**：每项 `file_id: int`（**必填**）+ `reason: str`（**六元闭集** `count_limit`/`file_too_large`/`binary_too_large`/`total_budget`/`not_found`/`not_injectable`）+ `filename: str|null` + `path: str|null` + `size: int|null`。
   - **`size`**：`SiblingFileData` **6 字段中无 `size`** → 取不到就写 `null`；**不得**为此给 `SiblingFileData` 加字段（会破坏 13 处零改动）。
   - **`not_found` / `count_limit` 的 `filename`/`path` 可为 `null`**：`get_files_by_ids` 只返回命中行 → 这两类拿不到文件名。**不要**为它们补额外查询。
8. **`inlined` 语义**：**实际进入响应体的 sibling 个数**（≠「预算层放行数」）。不变式 `requested - inlined == len(skipped)`。
9. **`entry_service.py` 补确定性 `order_by`**：`get_entry_files`（`:1431`）与 `get_entry` 的 `entry.files =`（`:1423`）等**所有详情页分支**都要按 path + id tie-breaker 排序。
   > **注意**：P2 的 R1 已实测更正——补 `order_by` 后**后端既有测试零连带失败**（`_create_entry` 读的是 POST 响应、不经 `select(File)`）。**不要**去改 `test_render_inject_js` 的取 id 方式（那是错的）。
10. **新建 `docs/architecture/html-preview-security-modes.md`**：记录「安全预览 vs 交互式 Demo」两档定义 + **当前默认是后者** + **`connect-src` 仍允许 `https:`（外传通道存在，收紧属独立决策）**。三要素缺一即 BDD-45 红。
11. **BDD-41 回归项**：报表块**始终存在**（`skipped` 为空数组时也要有块），D7 未豁免「无跳过时省略块」。

### `REASONS` 闭集（唯一来源，防双源漂移）

```python
REASONS = {"count_limit", "file_too_large", "binary_too_large", "total_budget", "not_found", "not_injectable"}
```

**不得**在别处再写一份字面量。

### 必须自查（P3 测试不许改）

本批 `tests_filter`：
```
python -m pytest tests/test_html_render.py tests/test_entry_service.py tests/test_entry_file_order.py -q
```
**在 `backend/` 下用 `.venv/bin/python -m pytest`**（项目 Makefile 的 venv 约定）。

- **`= inject_resources(` 的计数必须仍是 13**（P2 §3 完成标志 #7 锁定；P3 期间曾误增到 14 已修回）
- **`_process_css_refs(` 的计数必须仍是 8**
- 本批红灯用例（`test_html_render.py` 的 TPV0104 段 + `test_entry_file_order.py`）应**转绿**
- **既有测试若因设计要求转红 → 按 RM-AG0107 更新它们并逐条列出**，不要回退设计
- 跑 `python3 {agate_root}/scripts/check-platform-assumptions.py backend/tests/` 须 0 命中

### 环境隔离（强制）

- **严禁**接触生产 `:8080`、**严禁**触碰 `~/.peekview/`
- 状态标记二值：`[PROD_TOUCHED] {描述}` / `[PROD_NOT_TOUCHED]`
- 造/删测试 entry 只经 debug HTTP API（`:8888`，已运行，`alice 22 / anon 15`），**禁 CLI**
- 临时文件放 `<项目根>/.agate-tmp/`（**不用 `/tmp`**）
- **不要 commit**
- **写入隔离（DEBT0040）**：测试用 `tmp_path`，**不得**把仓库内已提交的状态文件（`gate-events.jsonl` / `active-tasks.md` / `.state.yaml`）写脏

### 产出

- 代码改动落地到 `implementation_dir`（本项目多包，见 P2 `packages`）
- **`P4-implementation.md`** 必须声明 `implementation_dir: backend` + 记录本批改动摘要、遇到的 `[DESIGN_GAP]` / `[SCOPE+]` / `[CLARIFY]`（如有）
- 每完成一个模块立刻往 `TASK_DIR/P4-progress.md` 追加一行

### 输入文件（按 P2 的 `files_to_read` 导航，按需读片段，不要整目录全读）

- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-design.md`（**1070 行，本批的设计依据**；重点 §0.1A 落点表、D7 超限反馈形态、D8 字节工具、R17 七处埋点、§5.1）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P3-test-cases.md`（**红灯测试清单，你的验收依据**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（54 条 BDD）
- `{project_root}/AGENTS.md`（铁律、环境隔离、Makefile 命令真相源）
- 源码：`backend/peekview/services/html_render_service.py`、`backend/peekview/api/files.py`、`backend/peekview/services/entry_service.py`、`backend/tests/test_html_render.py`（TPV0104 段）、`backend/tests/test_entry_file_order.py`

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
- 环境（主 Agent 实测）：debug `:8888` 在线、`alice 22 / anon 15`；生产 `:8080` 不可达；git HEAD=`de03b466`（工作树干净）。
- **测试基线**：`make test-quick` **1205P/1F/3S**（唯一失败 `test_cli_remote::test_config_set_remote_api_key` 根因 `OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`，沙箱只读，**与本任务无关**，连跑 3 次均 1 failed）；`make test-frontend` 119 files/**1456P**/4S/0F；`make typecheck` exit 0；`make lint` exit 0；`make check-docs` exit 0。
- **本批红灯现状**（P3 交付，我实测）：`pytest test_html_render.py + test_entry_file_order.py` = **13 failed / 49 passed**，全为 assertion failure（10 条因「报表块不存在」、2 条因「50 < 49 关系不成立」、1 条因「顺序仍为 rowid」）。
- **关键实测事实（可直接引用）**：
  - `_MAX_INJECT_IDS = 50`（`html_render_service.py:17`）== `max_entry_files = 50`（`config.py:46`）→ 主文件占 1 名额 → 最多 49 sibling → `>= 50` 永不触发
  - `_BINARY_SIZE_LIMIT` 全仓**唯一消费点** = `files.py:272`（在 `_build_sibling_data:270` 体内，唯一调用方 `render_html_file:336` → **注入路径**）；`download_file`/`get_file_content` 内零 size 判断
  - `_detect_kind`（`:77-90`）只认 `.css`/`.js`；`:258-260` `if not kind: continue` 静默跳过
  - `used_text_keys` 全仓**只有 3 个写入点**（`:231`/`:249`/`:298`）——**不含** CSS `@import`/`url()`/favicon
  - `create_app(config=...)` 可覆写 `PeekLimits`（实测 `max_entry_files=60` 生效）
  - `get_files_by_ids`（`entry_service.py:1431-1441`）**只返回命中行**
  - `SiblingFileData`（`html_render_service.py:26-32`）**6 字段无 `size`**
  - `_create_entry`（`test_html_render.py:44-55`）返回 **POST 响应**的 `files`（构造序，不经 `select(File)`）→ `order_by` 不影响这 15 个既有用例
  - 后端两文件实测 **73 passed**（须加 `-v`；`addopts=-q` 会吞汇总行）
- 环境坑：临时产物落 `.agate-tmp/`（不用 `/tmp`）；造/删 entry 只经 debug API、用完即删、须同时给 `path`+`filename`、**DELETE 用 slug**；`check-platform-assumptions.py` 只扫 `.py/.sh/.bash/.bats`。
</objective_info>
