---
phase: P3
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0102
role: test-designer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `P3-test-cases.md` + 测试代码目录——把 P1 的 **30 条 BDD**（`BDD-01`~`BDD-30`）逐条转成**当前必然失败**的测试用例，产出**真红灯**（`check-tdd-red.py` exit 0）。

### 约束

**1:1 BDD 映射（硬要求）**

- 每条 `#### BDD-NN` 至少一个测试用例，测试名**必须引用 BDD 编号**（如 `test_bdd_01_...`、`bdd22_...`、`it('BDD-16: ...')`）
- 30 条全覆盖，不许挑验
- **UI 任务**：`ui_affected: true` → **必须有 Playwright/E2E 用例**（不能只写后端单测）

**后端测试（pytest）**
- 用 `backend/tests/factories.py` 的既有构建器（`files_to_read` 有该文件）
- 新增文件建议：`backend/tests/test_utc_serialization.py`（**P2 的 `P5_fitness` 依赖此文件名 + 函数名 `mixin_not_in_table_mro`，必须精确创建**）
- 覆盖 BDD-07~BDD-12（序列化契约）
- **BDD-07 的遍历判据**：W当按「非 `table=True` 且**不被任何 `table=True` 模型继承**的类」遍历 `models.py`，**不要硬编码 15/31**（P2 §R6 已定：遍历口径为准，实际命中 16 类/34 字段）
- **BDD-08/09 是反向保护**：断言 `Entry` / `User` 等表模型 `model_dump()` / `model_dump(mode='json')` 时间字段**仍是 datetime 对象**（未被响应层 serializer 污染）
- **`P5_fitness` 要求的测试函数**：`test_...mixin_not_in_table_mro`（断言 `UtcSerializeMixin` 不出现在任何 `table=True` 模型的 MRO）；**函数名必须含 `mixin_not_in_table_mro`**（`-k` 过滤用，零命中 pytest exit 5）

**前端单元测试（vitest）**
- 覆盖时间格式化（BDD-01~06 的可单测部分）、文件数三态（BDD-13~15）、菜单选项构造（BDD-16~18、27~29 的 `visibility-options.ts` 纯函数）
- **`visibility-options.ts` 是 P2 §N-1 定下的纯函数**，入参 `{isPublic, currentTeamSlug, teams, teamsFailed?}`——按此签名测
- **vitest mock hoisting 反模式**（T079 教训）：`vi.mock()` 回调里**只用字符串字面量**，不引用外部变量；需要动态 mock 用 `vi.doMock` 在 `beforeEach`

**E2E（Playwright）**
- **必须创建 `frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts`**（**P2 的 `P5_e2e` 写死了这个文件名**，名字不符则 P5 零覆盖）
- 覆盖 UI 交互 BDD（16~26 中需真实交互的：悬停 tooltip、菜单展开、Team 子菜单、二次确认、失败回滚、键盘 Escape+焦点回归、0 文件空态）
- **BDD-02/03 的 tooltip 断言**（P2 §C2 + 主 Agent 实测）：**只有自定义 DOM 元素可断言**——原生 `title` 属性与 CSS `::after` 的 `getByText` 命中均 **0**；且 `opacity:0` 的 `isVisible()` **仍为 true**。测试必须按「自定义 DOM 元素 + `visibility` 切换 + `role="tooltip"`」写，断言悬停后 `isVisible()`=true 且 `textContent` 可读
- **BDD-04 固定 locale/timezone**：`test.use({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })`（P1 已定 BDD-04 的 Given 固定 locale）
- **BDD-01/03 的形态匹配**：`GMT±N` + 4 位年份，**不要硬编码 `GMT+8`**（BDD-01 不限定 locale/时区）
- **BDD-02 Then ③** 断言 IANA 时区名「等于运行时 `Intl.DateTimeFormat().resolvedOptions().timeZone` 值」（不要写「形如 `Area/City`」——UTC 下是 `"UTC"` 无斜杠）
- **窗口尺寸两档**：`desktop_1280x800` / `mobile_390x844`（P2 的 `variant` 派发依赖 `isMobile`，`useResponsiveLayout` 的断点是 `<=640`）
- **创建型用例清理钩子（强制）**：E2E 若创建 entry（尤其 **0 文件 entry 必须现造**），须注册清理钩子——创建即注册、`afterEach` 无条件删除（不因响应非 2xx 中止）、删除接受 200/204/404 为已清理。**0 文件 entry 走 debug backend HTTP API**（`POST /api/v1/entries` 传空 `files`），**禁止** `peekview create` CLI
- ⚠️ **`image-gallery` 不是 0 文件素材**：它虽只有 `meta.json`，但 `scripts/seed-debug.py:183-185` 对 `if not files: SKIP` → **不入库**

**红灯必须"真"**

- 每个红灯的失败原因必须是**被测模块未实现**（import 失败 / 模块不存在 / 组件未导出 / 断言失败），**不能**是"测试代码自身语法错"或"断言与测试数据矛盾"
- **P2 冻结的 P3 命令**（`gate_commands.P3`）：`( cd backend && .venv/bin/python -m pytest tests/ -n auto -q --tb=short ); b=$?; ( cd frontend-v3 && npx vitest run --reporter=dot ); f=$?; [ $b -eq 0 ] && [ $f -eq 0 ]` + `P3_formatter: "pytest.sh"`
- **三件事缺一即假红**（主 Agent 四格矩阵 + architect 深层根因共同定案）：① `--tb=short` ② `P3_formatter: pytest.sh` ③ **无 `| tail`**。你自己自跑验证红灯时也必须用这个形态

**平台假设扫描（强制自查）**

- 跑 `python3 {agate_root}/scripts/check-platform-assumptions.py <你的测试目录>` → **必须 0 命中**
- ⚠️ **注释里的字面量同样计命中**（R4 = 系统临时目录字面量、R1 = 裸 `python3`、R2 = 硬编码 PATH）。需要该路径时**运行时拼接**（如 `TMP = "/" + "tmp"`）
- ⚠️ **扫描面限定**：该脚本只扫 `.bats/.bash/.sh/.py` —— **TS/JS 用例（Playwright/vitest）不在扫描面内**，跑它恒绿不代表无平台假设

**环境约束**

- 严禁触碰生产 `:8080` 与 `~/.peekview/`；调试只用 `make debug`（`:8888`）
- E2E 需要 debug 服务在线——**本阶段你只写测试，不必实跑绿**（红灯是预期的），但需确认 E2E 文件语法可被 Playwright 解析（`npx playwright test --list <spec>` 能列出用例即可）
- 前端页面路由 `/{slug}`，不是 `/entries/{slug}`
- **严禁**在 `backend/tests/` / `frontend-v3/src/` 留 scratch 探针（前几轮评审误建过）
- 状态标记二值：`[PROD_NOT_TOUCHED]`

**命令与落盘纪律**

- 任何 bash 命令外层 `timeout`（预期耗时 ×1.5；全量 pytest/vitest 用 300s+）
- 每写完一个测试文件立刻 `bash >>` 追加到 `P3-progress.md`
- 临时产物落 `<项目根>/.agate-tmp/`（已 gitignore），**不要用 `/tmp`**

### 上游关联

P1 已 commit `290f4c43`，P2 已 commit `da0c85a7`。核心输入：

- **30 条 BDD**，编号 `01`–`30`（两位零填充）。分组：时间显示（01-06）、序列化契约（07-12）、文件数（13-15）、可见性菜单（16-24 + 27-30）、0 文件空态（25）、人工体验路径（26）
- **P2 方案**：A2（`UtcSerializeMixin` + `field_serializer("*", when_used="json")` 通配）/ B1（新建 `VisibilityMenu` 组件）/ C2（自定义 DOM tooltip）
- **P2 已定的关键契约**：`visibility-options.ts` 纯函数签名 `{isPublic, currentTeamSlug, teams, teamsFailed?}`；`variant` 由视图层按 `isMobile` 下发；`setVisibility` 返回 `{ok, revokedShares}` 且 **store 内不发 toast**（toast 由视图层唯一发）
- **P2 的 `P5_fitness`** 依赖 `backend/tests/test_utc_serialization.py` + `-k mixin_not_in_table_mro`
- **P2 的 `P5_e2e`** 依赖 `frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts`
- 组长汇总的 23 条执行约束（C-1~C-23）在 `P2-review.md`——**建议读**，那里有 P4/P6 都要遵守的禁区

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-requirements.md`（**30 条 BDD，测试的主要来源**）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P2-design.md`（**主输入**：`§6 测试策略` / `§3.8 稳定测试标识清单` / `§10 files_to_read` / `gate_commands` 块）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P2-review.md`（23 条执行约束 C-1~C-23，含 P6 两条禁令与 gate 冻结说明）
- `AGENTS.md`（项目约定：`make test-quick` / `make test-frontend` / `make debug-test` / 铁律）
- `{agate_root}/assets/execution-roles/test-designer.md`（角色定义）

按需读（按 P2 §10 `files_to_read` 的 50 条导航，**只读确实需要的**）：

- `backend/tests/factories.py`（既有测试构建器）
- `backend/peekview/models.py`（叶响应模型 15 类 + `EntryBase`/`UserBase`）
- `frontend-v3/e2e/team-visibility.spec.ts`（**TPV0095 BDD-40 断言现状**——本任务要改它，测试设计须显式声明取代关系）
- `frontend-v3/src/components/__tests__/tpv0095-*.spec.ts`（4 个需同步更新的单测）
- `frontend-v3/playwright.config.ts`（两个 project 配置）

### 产出文件字段

用 `FILE={AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P3-test-cases.md agate-md-field-set --list` 查字段，再逐个写入。

已确定值（直接复制）：phase=P3, task_id=TPV0102, parent=P2-design.md, trace_id=TPV0102-P3-20261110, agent=test-designer, status=draft, created=2026-11-10

由你判定：`test_code_dir`（**必须声明**，指向测试代码根，如 `backend/tests/` + `frontend-v3` 的组合表述或项目既有惯例）

⚠️ 工具坑：`agate-md-field-set.py` 的 list 字段按**空白拆分**，写 `"[a, b]"` 会被拆坏——写空格分隔裸值。
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

**主 Agent 已实测的事实（可直接使用）**

- 仓库 HEAD `da0c85a7`（P2 已提交），工作树干净
- P1 BDD 编号集合 = `01..30`，30 条连续
- **P3 命令形态（P2 冻结，勿改）**：`( cd backend && .venv/bin/python -m pytest tests/ -n auto -q --tb=short ); b=$?; ( cd frontend-v3 && npx vitest run --reporter=dot ); f=$?; [ $b -eq 0 ] && [ $f -eq 0 ]` + `P3_formatter: "pytest.sh"`
- **三件事的必要性已实测**：`--tb=short` / `P3_formatter: pytest.sh` / 无 `tail`（缺 formatter 时靠兜底分支也能判红，但加 formatter 不给 `--tb=short` 会落 A 类假红）
- **Playwright tooltip 可断言性（决定 E2E 写法）**：原生 `title` → `getByText` 命中 0；CSS `::after` → 命中 0 且 `textContent` 不含；`opacity:0` → `isVisible()` 仍 true；**只有自定义 DOM 元素 + `visibility` 切换 + `role="tooltip"` 可断言**
- `frontend-v3/playwright.config.ts` 现有两个 project：`chromium`（Desktop Chrome）/ `Mobile Chrome`（Pixel 5），**无 `locale`、无 `timezoneId`** → 需在 spec 内 `test.use(...)` 显式固定
- `scripts/run-e2e-tests.sh:78` `spec="${E2E_SPEC:-e2e/debug-server.spec.ts}"` → 裸调 `make debug-test` 只跑 1 个 spec
- `frontend-v3/e2e/team-visibility.spec.ts` 存在，含 TPV0095 BDD-40 断言（`:137-152`）`team entry 卡片无 visibility-toggle` —— **与本任务直接冲突，须显式取代**
- `backend/tests/test_architecture_fitness.py` **不存在**（勿引用）
- `frontend-v3/src/composables/useResponsiveLayout.ts` 存在：`isMobile = viewportWidth <= 640`，rAF 节流 `handleResize`
- 环境状态：debug 服务未启动；CDP Chrome `:18800` 属外部服务

**未查证（需你自查，不要凭记忆断言）**
- `backend/tests/` 现有测试文件的命名/组织惯例（决定新文件放哪、怎么 import factories）
- `frontend-v3/src/components/__tests__/` 里 vitest 用例的既有写法（mock 模式、mount 惯例）

</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.py` 审计失败。
