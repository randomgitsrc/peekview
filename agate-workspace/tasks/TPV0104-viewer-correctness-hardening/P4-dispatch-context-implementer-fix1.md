---
phase: P4
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: implementer
round: retry-1
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**P4 重试 #1（`retries[P4]` 计 1 / 上限 3）**：修复 `P4-review.md` 的 **3 条 CRITICAL + 2 条 MAJOR + 4 条 MINOR**。

**只修这些，不重做已通过的部分**。前端（design-review 已 `approved`）、`order_by` 收敛、`<` 转义基础、七处埋点、CSP 保持、P3 测试零篡改——**全部已确认通过，不要动**。

### ⚠️ 三条 CRITICAL（全部已由主 Agent 独立复现，不是推测）

#### C1 — `api/files.py:389` 总预算记账单位错配（**触发 rejected 的那条**）

```python
cost = len(data.content)          # ← str 字符数
if total_bytes + cost > _MAX_INJECT_TOTAL_BYTES:
```
单文件检查用的是 `record.size`（**字节数**，正确），累计却用 `len(data.content)`（**UTF-8 字符数**）。

**主 Agent 实测**：`len('中'*670000)` = **670000**（字符），`len('中'.encode())`... 即 `len(encode('utf-8'))` = **2010000**（字节，3 倍）。12 个中文 CSS：按字符数累计 8,040,000 < 8 MiB → **全放行**；按字节数实际 24,120,000 = **3.0 倍超限**。评审实测 emoji 达 **2.98×**，响应 23.8 MiB，且报表 `skipped=[]` **自称合规**。

**Fix（一行级，推荐 A）**：
```python
cost = len(data.content.encode("utf-8"))     # 与 record.size 同口径
```
> 不要为此给 `SiblingFileData` 加字段——那会破坏 P2 的「13 处既有 `inject_resources` 调用零改动」。

#### C2 — `api/files.py:430-436` `_append_inject_report` 下标错位

```python
idx = html.lower().rfind("</body>")      # 在【变形后】的串上取下标
return html[:idx] + block + html[idx:]   # 却切【原串】
```
`str.lower()` **不是保长变换**：`İ`（U+0130）小写化为 2 个码点（`i` + U+0307）。主 Agent 实测 `<html><body><p>İstanbul</p></body></html>`：`html.lower()` 比原文**长 1**，`rfind` 下标**偏移 1** → 把 `</body>` 劈成 `<` + 报表块 + `/body>`。

**Fix**：免去变形，直接在原串上大小写无关查找
```python
m = re.search(r"</body\s*>", html, re.IGNORECASE)
idx = m.start() if m else -1
```
> 顺带覆盖 `</BODY>` / `</body >` 等变体。

#### C3 — `html_render_service.py:449-456` `not_injectable` 缺 `file_id`

```python
skipped_out.append({
    "filename": f.filename, "path": f.path,
    "reason": "not_injectable", "size": None,
})   # ← 缺 "file_id"
```
违反 P2 `:411` **冻结** schema（`file_id: int` 必填）。预算层五类都填了，只有第六类漏。→ 两类 reason 共存时 P3 的 BDD-38③ `assert isinstance(item["file_id"], int)` 会 **KeyError**。

**Fix 难点**：`SiblingFileData` **没有** `file_id` 字段，且 P2 明令**不得加**（保 13 处零改动）。→ 需在 `render_html_file` 交给 `inject_resources` 前建 **`id(SiblingFileData) -> file_id` 的旁路 map**，以**关键字可选参数**传入（与既有 `owners`/`consumed_out` 同风格）。

### ⚠️ 两条 MAJOR

#### M1 — `select_inject_ids` 删掉唯一的 `break` ⇒ `overflow` 无界

原实现 `if len(result) >= _MAX_INJECT_IDS: break` 是**唯一的入参上限**。新实现把溢出全进 `overflow`，而 `overflow` **逐项**写进 `skipped[]`（每项约 92 B）。评审实测：`?inject=` 500 个假 id → 响应 **46.2 KB / 请求 3.5 KB = 13.0×**；5000 个 → 460 KB（13.1×）。`?inject=` 是**未认证可传且无长度上限**的 query。

**三选一（请在 `P4-implementation.md` 记录你选了哪个及理由）**：
- **A**：`overflow` 只留计数不逐项 → 违反 P2「未被内联的每一个都必须可查」，**需 P2 授权，不推荐**
- **B（推荐，不破契约）**：`overflow` 截断到第一个 `K`（如 100）逐项 + 追加一条 `{"reason":"count_limit","truncated_at":K,"total":N}` 汇总项
- **C（最小）**：`inject: str | None = Query(None, max_length=4096)`，把无界转成 422（与 `max_slug_length` 等既有风格一致）

> **B 与 C 可叠加**（C 挡 URL 长度、B 挡条目数）。若你选 C，注意 `test_html_render.py` 现有用例的 `inject` 长度须仍合法。

#### M2 — `owners` 单命名空间，text/binary 同名键互相覆盖

`owners` 由 text 的 `_sibling_keys` 与 binary 的 `binary_map` **写同一命名空间**（`:288-315`），冲突时后者覆盖前者；随后 `consumed.add(id(owners[key]))` 加的是**被覆盖后的对象**。→ 「真已注入」被登记为「未注入」，「真未注入」被判已消费而漏记。

**评审还找到一个 HTTP 可达的近亲**：同一 entry 上传两份 `filename='app.css'`（一 text 一 binary，POST 201 接受）→ 报表 `inlined=1` 但**两份内容都没进响应**（谎报），违反 BDD-40②。

**Fix**：`owners` 拆 `text_owners` / `binary_owners` 两命名空间，或 value 改 `dict[str, tuple[SiblingFileData, str]]`（携带 `"text"|"binary"`），冲突时按 `_lookup_key` 命中的具体分支取对象。

### MINOR（4 条，一并处理）

| 位置 | 动作 |
|---|---|
| `html_render_service.py:132 parse_inject_ids` | 全仓**零调用**（评审 grep 确认）→ **删**或标 `@deprecated`（你选，说明理由） |
| `html_render_service.py:21 _BINARY_SIZE_LIMIT` | 本文件内零消费，同值常量在 `api/files.py:51` 另定义 → 建议单源 import |
| `html_render_service.py:26 REASONS` | 模块常量无生产消费点，`test_html_render.py:684` 又自建一份 → 两份可独立漂移。**改测试须主 Agent 批准（P3 冻结）**：**你只改生产代码侧，不要动测试里的那份** |
| `frontend-v3/src/composables/useCsvParser.ts:64-65` | `commit()` 内已重置，调用点又重置一次 → 删掉语义不变 |

### ⚠️ 严格边界（不可越线）

1. **不得修改 P3 的测试断言**。评审已确认 P3 测试一字未改。若 C1/C3 的修复让某条 P3 用例**变红**，那是**发现真问题**——**停下来报告主 Agent**，不要改断言。
   > 评审预估：C1 修后 BDD-40 的 ASCII 素材**不受影响**（ASCII 字符==字节）；C3 修后 BDD-38③ 在「两类共存」素材上才真正有区分力——**新用例由 P5 补，P4 不得改 P3**。
2. **不得动前端**（design-review 已 `approved`）。唯一例外：MINOR 里那条 `useCsvParser.ts:64-65` 的冗余重置。
3. **`_MAX_INJECT_TOTAL_BYTES` 仍是 8 MiB**、`_MAX_INJECT_IDS` 仍是 **40**、`REASONS` 仍六元——这些是 P2 冻结值，不改。
4. **CSP 与响应头一字不改**（BDD-46）。

### 必须自查

```bash
cd backend && .venv/bin/python -m pytest tests/test_html_render.py tests/test_entry_service.py tests/test_entry_file_order.py -q
```
- **`= inject_resources(` 必须仍是 13**、**`_process_css_refs(` 必须仍是 8**
- **`make lint` 必须 exit 0**（注意 SIM300 类规则）
- `make test-quick`（全量后端）应仍为 **1F（预存 `test_cli_remote`）/ 其余全绿**
- 若你改前端那条 MINOR：`make test-frontend` 须仍 **1514P/0F**、`make typecheck` exit 0

**并请自测你修的三个 CRITICAL**（这是关键，不能只靠既有用例）：
- C1：造非 ASCII 素材（如 12 个中文 CSS）验总预算**真的拦截**
- C2：造含 `İ`（U+0130）的 HTML 验 `</body>` **未被劈开**（`'</body>' in body == True`）
- C3：造「count_limit + not_injectable 共存」素材验每条都有 `file_id`

### 环境隔离（强制）
- 只用 `:8888`（**严禁** `:8080`、**严禁** `~/.peekview/`）
- 状态标记二值：`[PROD_TOUCHED]` / `[PROD_NOT_TOUCHED]`
- 造/删 entry 只经 debug HTTP API、**禁 CLI**、用完即删（**用 slug**）、须同时给 `path` + `filename`
- 临时文件放 `<项目根>/.agate-tmp/`（**不用 `/tmp`**）
- **不要 commit**

### 产出
- 在 `TASK_DIR/P4-implementation.md` **追加「重试 #1」章节**（逐条对应 C1/C2/C3/M1/M2/MINOR + 你选了哪个方案 + 自测结果）
- 每修完一条立刻往 `TASK_DIR/P4-progress.md` 追加一行

### 输入文件
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P4-review.md`（**核心：§7 修复清单 + §2/§3 的逐条证据**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-design.md`（D6 预算模型 `:364`、D7 schema `:411`、R17）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（BDD-38~41）
- `{project_root}/AGENTS.md`
- 源码：`backend/peekview/api/files.py`、`backend/peekview/services/html_render_service.py`、`frontend-v3/src/composables/useCsvParser.ts:64-65`

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
- 环境：debug `:8888` 在线、`alice 22 / anon 15`；生产 `:8080` 不可达；git HEAD=`de03b466`（P4 改动全在工作树，**未 commit**）。
- **当前测试状态（主 Agent 亲验）**：前端 **1514P / 4S / 0F**；后端 **1221P / 1F / 3S**（唯一失败 = 预存 `test_cli_remote::test_config_set_remote_api_key`，根因 `OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`）；`make typecheck` exit 0；`make lint` exit 0；`make build-frontend` exit 0。
- **P4 四批已完成**：`backend-render-budget` / `data-viewers` / `detail-outline` / `detail-navigation`。
- **我实测确认的 C1 数据**：`len('中'*670000)` = 670000；`len(('中'*670000).encode('utf-8'))` = 2010000；12 个 → 字符累计 8,040,000 / 字节累计 24,120,000。
- **我实测确认的 C2 数据**：`'İstanbul'` len 8 → `lower()` len **9**；`<html><body><p>İstanbul</p></body></html>` 的 `lower().rfind('</body>')` = 28，`rfind('</body>')` = 27 → **偏移 1**。
- **我核实的 C3 代码**：`html_render_service.py:449-456` 的 `not_injectable` 条目只有 `filename`/`path`/`reason`/`size`，**确缺 `file_id`**。
- 评审另确认：**P3 测试一字未改**（10 份归档副本 `diff -q` 全 SAME）；5 条 `[DESIGN_GAP]` + 1 条 `[SCOPE+]` 全部合理；前端专项全过。
- 环境坑：临时产物落 `.agate-tmp/`（不用 `/tmp`）；造件须给 `path`+`filename`；DELETE 用 slug；`check-platform-assumptions.py` 只扫 `.py/.sh/.bash/.bats`。
</objective_info>
