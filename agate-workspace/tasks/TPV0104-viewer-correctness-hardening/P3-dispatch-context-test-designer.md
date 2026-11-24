---
phase: P3
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: test-designer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `P3-test-cases.md` + `P3-test-code/`：把 P1 的 **54 条 BDD** 全部转成测试用例（**1:1 映射，一条不漏**），且**当前全部红灯**（因为实现还没写）。

### ⚠️ 最关键的一条：写红灯必须用「断言形态」（V13）

**实测确认**（我用探针跑过）：`import` 一个**尚不存在**的模块 → vitest 报 `Failed to resolve import` → `vitest.sh` formatter 输出 `{exit_code:1, failed:0, **errors:1**}` → `check-tdd-red.py:154-156` 的 `if errors > 0` 分支判 **A 类错误 → return 1 = P3 gate FAIL**。

而**经典断言红灯**（引用**已存在**的模块 + 断言新行为，如 `expect(result.constructedRows).toBe(5)` 而该字段尚不存在 → `undefined`）→ `failed:1` → 判 `classic red-light → return 0` **通过**。

**所以**：红灯必须写成「引用已存在的模块/导出 + 断言尚无的新行为」，**不得** import 不存在的模块或文件。`P2-design.md` 的 `P3_formatter: vitest.sh` 决定了这条。

同理后端 pytest：同理，用**已存在模块** + 断言新行为。

### 测试范围（按 P2 的 4 批 + gate_commands）

**`gate_commands`（P2 冻结，你按此设计）**：
```
P3: "make test-frontend"          ← 只跑前端（exit 124 fail-open 已证，不并入后端）
P3_formatter: "vitest.sh"
P5: "make test-quick"             ← 后端全量
P5_frontend / P5_typecheck / P5_lint / P5_docs
P5_e2e: "E2E_SPEC=e2e/tpv0104-viewer-hardening.spec.ts make debug-test"
P5_e2e_legacy_{viewer,t091,tpv0099}   ← 三个 legacy spec 各自独立 key
P5_e2e_mobile_widths: 独立 spec（360/375/390 三档，design M1 专用）
```

**你必须产出**：
1. **vitest 单测**（进 `frontend-v3/src/**/__tests__/` 或 `frontend-v3/src/**/*.spec.ts`）——覆盖 CSV 观测面、resolver、headings、截断态控件、字节判断、源码扫描断言
2. **pytest 后端用例**（进 `backend/tests/`）——覆盖注入预算六态、跳过清单可解析、`order_by` 确定性
3. **Playwright E2E**（进 `frontend-v3/e2e/`）——`tpv0104-viewer-hardening.spec.ts`（V-01/`?file=`/默认入口/全屏）+ `tpv0104-mobile-bar-widths.spec.ts`（360/375/390 三档）
4. **3 个 legacy spec 的 `firstFileId` → `file` 迁移**（共 **9 处**：`viewer.spec.ts` 2 / `t091` 4 / `tpv0099` 3）——属测试产物，归 P3

### 必读的关键约束（每条都有实测依据）

1. **`maxRows` 默认 50000 且无 view 覆盖** → V-04/V-03 的 vitest 用例**必须注入小值**（如 `maxRows: 5`；`TableView.spec.ts:184` 有先例）。seed 最大 CSV 仅 61 行，E2E 层造不出截断态。
2. **TOC 默认展开态分视口**：桌面（>640px）**默认已展开**、移动端**默认不渲染**。所有 TOC 类用例的 When 必须写**幂等表述**（读 `aria-expanded`：`"true"` 不点、`"false"` 点一次、**`null` 表示移动端不适用**）。按字面「点开 TOC」会在桌面把它**关掉** → 假 FAIL。
3. **`?file=` 是全新参数**（现状 `firstFileId` 是一旦消费即清空全部 query 的一次性种子）。V-01/`?file=` 类用例**必须在 debug `:8888` + 现造 entry + Playwright**，mock router 证不了刷新保留与历史记录。
4. **V-08 字节数必须有走真实 `file.size` 的断言**——既有 `HtmlViewer.spec.ts:338-365` 全用 `HTML_VIEWER_TEST_SIZE_KEY` 注入假值，**绕开了「从 `file.size` 取值」这个被测行为本身**，只用假值会假 PASS。
5. **代码级断言（源码扫描）**：BDD-47（`EntryCard`/`EntryListRow` 的 `files[0]` 命中数 == 0）与 BDD-08（`extractHeadings` 逐行正则归零）**必须是代码级**——浏览器点卡片看 URL **现状本来就通过**，会假 PASS。仓库已有源码扫描先例：`t080-admin-route-guard.test.ts`、`t082-store-split.spec.ts`、`backend/tests/test_dependency_guard.py`。
6. **e2e legacy 基线已红，不是全绿**：`viewer.spec.ts` **18F/20P**、`t091` **12F/12P**、`tpv0099` **6P/0F**。前两者根因 = `markdown-test` 归 `frontend-team` 致匿名 404（**TPV0095 遗留，非本任务引入**）。BDD-50 要求的是「迁移后 `firstFileId` 字面量 == 0 **且** 失败集合不劣于基线」，**不是全绿**。→ **不要**去改 `markdown-test` 可见性或加 `storageState`（那是范围蔓延）。
7. **造件必须同时给 `path` 与 `filename`**——只给 `path` 时实测 `filename=untitled`、`language=null` → 前端退化 CodeViewer、`.toc-list` 为空。
8. **banner 文案**：P2 已定 `已显示前 ${constructedRows} 行，共 ${totalRows} 行`（BDD-34 须含 `5` 与 `11`）。
9. **`skipped[]` schema（P2 已定死）**：每项 `file_id: int`（必填）+ `reason: str`（六元闭集 `count_limit`/`file_too_large`/`binary_too_large`/`total_budget`/`not_found`/`not_injectable`）+ `filename: str|null` + `path: str|null` + `size: int|null`。**去重断言按 `file_id` 而非 `filename`**（后者可为 null）。**不断言 `size` 数值**。
10. **`<script type="application/json">` 清单已定转义 `<` → `\u003c`**，pytest 取证走 `BeautifulSoup(...).find("script", {"id":"peekview-inject-report"}).string` → `json.loads`。
11. **BDD-35 观测面 = `CsvParseResult.constructedRows`**（P2 锁定）；且**不得 `break`**（保 BDD-37 的 unclosed-quote throw 契约）。补 **G11 双向对账断言**（报告 inlined ⇒ 内容真在响应里；报告 skipped ⇒ 内容真不在）+ **G12 两跳 `@import` 用例**（V17 只测单层）。
12. **`skipped` 六元闭集势断言**：`requested - inlined == len(skipped)`（势）+ `{reason} ⊆ REASONS`（值）+ 按 `file_id` 去重。

### 创建型测试清理钩子（P3 卡强制）

含创建资源用例（建 entry/团队）时：**创建即注册、测试结束无条件删除**（不因响应非 2xx 中止删除）；删除接受 **200/204/404** 为已清理（afterEach 清理队列模式）。**DELETE 用 slug 不用 id**；匿名造的 entry（`owner_id=null`）需 admin 才能删。

### 交付前自查（强制，角色文件要求）

1. **平台假设扫描**：`python3 {agate_root}/scripts/check-platform-assumptions.py <你的测试目录>` 必须 **0 命中**。注意注释里的字面量同样计命中；需要临时目录时**运行时拼接**（如 `TMP = "/" + "tmp"`）。
   > 注：该脚本只扫 `.py/.sh/.bash/.bats`，**TS/JS 不在扫描面**——但你写 Python 测试时必须跑。
2. **测试自跑**：确认每个红灯的失败原因都是「被测模块未实现」（classic assertion red-light），**而非**「断言与测试数据矛盾」或 A 类错误。
3. **写入隔离**：用 `tmp_path` 等临时目录，**不写仓库内已提交的文件**。

### 双 viewport（UI 任务必须）

`ui_affected: true` → Playwright 用例须覆盖多 viewport，截图文件名固定：`desktop_1280x800.png` / `mobile_390x844.png`，存入 `{AGATE_WORKSPACE}/tasks/{Txxx}/evidences/`。**另需 360px 档**（P2 定死的最小支持宽度，`P5_e2e_mobile_widths` 专用 spec）。

### 环境隔离（强制）

- 只用 `http://127.0.0.1:8888`（debug backend，已运行，`alice 22 / anon 15`）
- **严禁**接触生产 `:8080`，**严禁**触碰 `~/.peekview/`
- 状态标记二值：`[PROD_TOUCHED] {描述}` / `[PROD_NOT_TOUCHED]`
- 造/删测试 entry 只经 debug HTTP API，**禁 CLI**（可能加载非 debug 配置误写生产 DB）
- 临时文件放 `<项目根>/.agate-tmp/`（**不用 `/tmp`**，per-call tmpfs 跨调用不可见）
- `npx tsx` 不可用（`~/.npm` 只读 EROFS）→ Playwright 用 `/home/kity/oclab/deepseek-harness/node_modules/.bin/tsx` + `NODE_PATH=$(npm root -g)`
- **不要 commit**

### 上游关联

- **P2 三轮评审收敛**（5 BLOCKER + 7 MAJOR → 1 → 0，两位专家均 approved）。方案已锁定：锚点单点 `heading_open`、`constructedRows` 观测面、resolver 单点、`resolveFileSize` 单点、`/f` 改 `v-if`、删键清理、预算数值 `40/2MiB/8MiB`、`consumed: set[id]` + 七处埋点。
- **P2 的 6 项残留 WARNING + G11/G12 建议**（`P2-review.md` 有清单）——你设计用例时应覆盖 G11/G12。
- **54 条 BDD 全部可二值判定**，每条的区分力都经三轮评审实测确认。你**不得**改动 BDD 语义；若发现某条与实现现实冲突，**停下来报告主 Agent**。

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（**54 条 BDD，测试的主要来源**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-design.md`（**1070 行，批准的方案**；重点 D1–D10、七处埋点、skipped schema、gate_commands、files_to_read）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-review.md`（approved，含 W1–W6 + G11/G12 交接要点）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P0-brief.md`（环境约束、已知风险）
- `{project_root}/AGENTS.md`（铁律、环境隔离、Makefile 命令真相源）
- 既有测试参考（**判断"哪些是既有契约不得改"**）：`backend/tests/test_html_render.py`（含 13 处 `= inject_resources(...)` 与 8 处 `_process_css_refs` 调用）、`frontend-v3/src/composables/__tests__/useCsvParser.spec.ts`（`:51-57`、`:68` throw 契约）、`frontend-v3/src/components/__tests__/HtmlViewer.spec.ts`（`:338-365` 左闭右开边界）、`frontend-v3/e2e/{viewer,t091-mobile-detail-visual-polish,tpv0099-fullscreen-link-auth}.spec.ts`
- 源码（P2 的 `files_to_read` 有完整清单）

</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.py $TASK_DIR`（自动捕获环境基线）。**必须执行**。
   该步骤不阻塞流程——脚本的 stderr 输出（含 WARNING）均可忽略，执行完直接继续步骤 1。

**创建型测试清理钩子（强制要求）**：测试含创建资源用例（建团队/条目等）时，须声明清理钩子要求——创建即注册、测试结束无条件删除（不因响应非 2xx 中止删除）、删除接受 200/204/404 为已清理（afterEach 清理队列模式）；验收环境残留由清理钩子与 post-test 残留检查共同兜底（见 P6 卡）。

1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
   1.1 写 P3-dispatch-context-test-designer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 跑 check-tdd-red.py 确认红灯
3. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P3，不要提前写 P4——phase = 本 commit 的产出阶段
4. git commit -m "wf({Txxx}-P3): {摘要}"（phase=P3，P3 产出含 P3-test-cases.md + 测试代码）
5. P3 commit 完成后进入 P4：**phase 推进 P4 随 P4 产出 commit 一起**（P4-implementation.md 就绪后），不是单独 phase commit

## refactor 任务：回归测试口径

> 适用：P1 frontmatter 声明 `change_type: refactor` 的任务（P2-design.md §3.4）。功能任务（缺省）走上方既有 TDD 口径，不受本节影响。

refactor 任务无新增功能行为可断言，P3 测试设计改用**回归测试口径**：

- **测试设计 = 回归测试口径**：复用/保留既有测试用例，标注每条回归用例覆盖了重构涉及的哪些文件/路径；**不新增功能行为断言**（无新行为可断言）。
- **跳过 check-tdd-red 红灯步骤**：重构无新功能断言，测试套件本就全绿，红灯语义不适用（check-tdd-red 对 refactor 任务会误报 exit 2 绿灯）。回归质量由 P5 全量回归（gate_commands.P5）+ P6 的 `regression.log`（全量回归重跑）兜底。CI 兜底（`agate-ci-verify.py`）逐提交回放 pre-commit 与 commit-msg hook 判定，不单独执行 TDD 红灯检查。
- **P3 gate 不变**：仍为文件存在性检查——refactor 的 P3 产出是 P3-test-cases.md（回归口径声明 + 既有用例覆盖映射），文件存在即满足 gate。

## 如果是重试

确认上一轮失败原因（测试设计不合理 / 未覆盖关键 BDD / 非真红灯）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P3 MAX=2）

## 前置条件

- [ ] P2-design.md files_to_read 完整（测试设计需要知道实现导航）
- [ ] P2-review.md status: approved（P2 不可裁剪）

## 派发

- **角色**：test-designer（`{agate_root}/assets/execution-roles/test-designer.md`）
- **输入**：P2-design.md + P1-requirements.md（BDD 验收条件，每条 `#### BDD-NN` 对应一个测试用例）
- **输出**：P3-test-cases.md + test_code_dir/
- **派发 prompt**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

- P3-test-cases.md 必须声明 `test_code_dir: {路径}`
- 每条测试用例对应一条 P1 的 `#### BDD-NN` 验收条件（1:1 映射）
- UI 任务（P2 ui_affected: true）：必须含 Playwright/E2E 用例

## gate 规则

**check-gate.py P3**（hook + 主 Agent 预跑，秒级文件检查）：
- exit 1：P3-test-cases.md 不存在
- exit 2：P3-test-cases.md 存在（TDD 红灯由 check-tdd-red.py 独立确认）

**check-tdd-red.py**（主 Agent 手动确认红灯 + CI backstop P3 兜底）：

```bash
check-tdd-red.py $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

**技术栈无关**：check-tdd-red.py 通过 formatter 将测试输出标准化为 JSON，不直接解析任何框架的输出格式。formatter 在 gate_commands.P3_formatter 中声明（可选）。不提供 formatter 时退化为 exit-code-only（所有红灯 = 可推进）。

**探测链**：`$TEST_RUNNER` 环境变量 → `gate_commands.P3`（P2-design.md 声明）→ `which pytest` → exit 3。`$TEST_RUNNER` 始终优先（退化为 exit-code-only，无 formatter）。

**formatter 选择**：见 `assets/formatters/README.md` 速查表。常用：pytest → `pytest.sh`，vitest → `vitest.sh`，go test → `go-test.sh`，其他 → `generic-exit-only.sh`。

## 按包拆分并行（条件触发，非强制）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry / 共享文件统一后处理见 dispatch-protocol「派发编排机制」并行规则。

当 P2 声明多个 packages 且包间无数据依赖时，P3 可拆分并行：

1. 每个 package 派一个 test-designer subagent
2. 各自写各自的测试文件（不同目录）
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit

拆分判据（本阶段特定）：
- P2 packages > 1 且包间无数据依赖 → 可并行
- 单包或包间有依赖 → 串行（不拆分）
- P2 未声明 packages → 串行

每个 subagent 的 dispatch-context 必须明确其负责的 package 范围（约束节写"只写 {pkg} 目录下的测试"）。

## 推进条件（全部满足才写 phase: P4）

- [ ] check-tdd-red.py exit 0（真红灯确认）
- [ ] P3-test-cases.md 存在且含 test_code_dir
- [ ] 测试代码目录存在
- [ ] UI 任务：Playwright/E2E 用例存在
- [ ] **新增/改动的测试文件通过平台假设扫描**：`python3 {agate_root}/scripts/check-platform-assumptions.py <测试目录>` → **0 命中**
  - 用 `{agate_root}`（协议根占位符）而非裸 `agate/scripts/`：本卡其余处写 `agate/scripts/...` 是**面向 agateon 自身**的惯例，而本条对**任何使用者项目**都成立（`{agate_root}` 由 `agate-resolve.py` 解析）
  - 扫 R1~R6（裸 `python3` / 硬编码 `PATH` / 系统临时目录字面量 / 其它平台假设 / **`subprocess` 文本模式缺 `encoding=`**）。**注释里的字面量也算命中**——writer 最常踩的就是这个
  - 来历（DEBT0048）：P3 曾只查"红灯对不对"，平台假设要到 **P4 全量 pytest** 才由 `check-platform-assumptions.py` 的 bdd-8（全树 0 命中）抓出 ⇒ 多一个"收口小修"回合。**本仓 2026-09-29 两批修复各自又踩了一次**（新测试注释写系统临时目录字面量）
  - 修法：需要该路径字面量时**运行时拼接**（如 `TMP = "/" + "tmp"`），仓库既有惯例
  - ⚠️ **扫描面限定**：`check-platform-assumptions.py` 只扫 `.bats/.bash/.sh/.py` 四种后缀（源码 `L128`）——**TS/JS 测试文件不在扫描面内**。故本条对 **Python/shell 测试项目**成立；**前端项目（Playwright/vitest 等 .ts/.js 用例）跑该自查恒绿，不等于无平台假设**——那类项目的平台无关性需另想办法（已知缺口，见 DEBT0048 记录）。

## 常见错误

1. **测试绿了才 commit**：测试已在 P4 之前通过 → 违反 TDD"测试先于实现"原则。P3 的 gate 要求红灯
2. **忘记声明 test_code_dir**：后续阶段找不到测试代码 → P5 跑 gate_commands 时找不到测试路径
3. **测试覆盖不全**：只为部分 BDD 写了测试 → P6 验收时那些 BDD 没有自动化验证
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。
5. **只覆盖交互路径，忽略前置状态**：测试设计应覆盖 BDD Given 隐含的前置状态，不只覆盖 When/Then 路径（详见 WORKFLOW.md §P3 测试设计指导）

## 下游影响

- P4 用测试驱动实现（implementer 看测试理解预期行为）
- P5 跑同一套测试验证实现正确性（gate_commands.P5）

> 完成 → 读 phase-cards/P4-implementation.md
<!-- AGATE_CARD_END -->

<objective_info>
- 环境状态（主 Agent 实测）：
  - debug backend `:8888` 在线、`alice 22 / anon 15`；生产 `:8080` 不可达，零接触
  - 协议 v0.83.3；git HEAD=`519321ab`（工作树干净）
  - **测试基线（改动前）**：`make test-quick` **1205P/1F/3S**（唯一失败 `test_cli_remote::test_config_set_remote_api_key`，根因 `OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'` 沙箱只读，**与本任务无关**，我连跑 3 次均 1 failed）；`make test-frontend` **119 files / 1456P / 4S / 0F**；`make typecheck` exit 0；`make lint` exit 0；`make check-docs` exit 0
  - **E2E 基线**：`viewer.spec.ts` **18F/20P**、`t091` **12F/12P**、`tpv0099` **6P/0F**
- **关键实测事实（可直接引用，不必重跑）**：
  - `useCsvParser.ts:7` 全量 `parseRows` → `:12` `slice`；`:57-59` 扫完才 `if (inQuotes) throw`；`useCsvParser.spec.ts:68` 有 `expect(() => parseCsv('a,b\n"unclosed', ',')).toThrow()` 契约
  - `TableView.vue:127` `maxRows` 默认 **50000**，全仓无 view 覆盖；`TableView.spec.ts:184` 有传 `maxRows: 5` 先例
  - `HtmlViewer.vue:92-94` 用 `props.content.length`；`HtmlViewer.spec.ts:338-350`（恰好 512KB 警告仍渲染）/`:354-365`（恰好 2MB 不自动渲染）= 左闭右开既有契约
  - `TreeView.vue:73-75` `MAX_SIZE = 2*1024*1024` + `content.length > MAX_SIZE`（props **不含 size**，P2 要求增传）
  - `file.size` 是**真实字节数**（API `size` 与 `wc -c` 逐项相同：466/335/255/756）
  - `_MAX_INJECT_IDS=50` == `max_entry_files=50`；P2 已定改为 **40**（满足 `40 < 49`）
  - `_BINARY_SIZE_LIMIT` 全仓唯一消费点 = `files.py:272`（在 `_build_sibling_data:270` 体内，唯一调用方 `render_html_file:336` → **注入路径**）
  - `create_app(config=...)` 可覆写 `PeekLimits`（实测 `max_entry_files=60` 生效）→ 超限分支可真实 HTTP 触发
  - `client.ts:91-99` `transformListItem` 硬编码 `files: []` → EntryCard/EntryListRow 的 `files[0]` 是**死代码**
  - `useEntryDetailComputed.ts:42-46` `siblingFileIds` **不过滤 kind**
  - `_detect_kind`（`html_render_service.py:77-90`）只认 `.css`/`.js`；`:258-260` `if not kind: continue` 静默跳过
  - `used_text_keys` 只有 3 个写入点（`:231`/`:249`/`:298`）——**不含** CSS `@import`/`url()`/favicon，故 P2 改用 `consumed: set[id]` + 七处埋点
  - `.toc-item` 只有 margin 无 padding；`TocNav.vue:42-44` 只有 `.toc-level-2/3/4`，**无 `.toc-level-1`**
  - 桌面 TOC **默认已展开**（`EntryDetailView.vue:243-246`）；移动端 TOC 按钮 `[data-testid="mobile-bar-toc-btn"]` 无 `aria-expanded`
  - `.actions-area`（1280×800）`clientW == scrollW`、`bodyScrollW == innerW` → **不溢出**
  - 360px 底栏：插 44px 按钮 `scrollW 370 / clientW 360` **溢 10px**；`gap` 8→4px 后溢 0
  - `EntryDetailHeader.vue` **无** `activeFile`、`defineEmits` **无** `'fullscreen'`（P2 要求补）
  - `_process_css_refs` 实测 **8 处**调用（设计曾称 5 处，W6 已修正）
  - 后端两文件实测 **73 passed**（须加 `-v`，`addopts=-q` 会吞汇总行）
- 环境坑：见上文「环境隔离」节。
</objective_info>
