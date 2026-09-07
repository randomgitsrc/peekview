---
risk_level: medium
phases:
- P1
- P2
- P3
- P4
- P5
- P6
- P7
- P8
packages:
- frontend-v3
- docs
domains:
- frontend
phase: P1
task_id: TPV0096
parent: P0-brief.md
trace_id: TPV0096-P1-20260907
status: draft
created: '2026-09-07'
---
# P1 需求基线 — E2E 红灯 spec 自建 entry 化（TPV0096）

[NO_NEED_CONFIRM]

> 人工体验路径 BDD：不适用——本任务产出为测试代码与文档，无新增用户可见页面；既有渲染页面的人工体验已由 BDD-10 的真实页面断言覆盖。

## 1. 需求复述

三个渲染类 E2E spec（`mermaid.spec.ts`、`mermaid-check.spec.ts`、`mermaid-visual.spec.ts`）依赖的 seed entry（test-mermaid-2 / playwright-test / e2e-test）在现行 seed-data/ 中不存在，干净 debug 环境必然 404 红灯，长期掩盖真回归（DEBT0010）。本任务把三个 spec 改为**自建 entry**（测试内 API 创建 + afterEach 清理队列），并**附带修复 P1 查证发现的同类信号失真**（死选择器、条件包裹假绿、死 goto 路径），使三个 spec 在干净 debug 环境、chromium 与 Mobile Chrome 两个 project 下全绿且可重复跑，最终环境无残留。

范围边界：

- 只改测试代码（`frontend-v3/e2e/`）与文档（`docs/`），不改产品代码（`backend/`、`frontend-v3/src/`）；不 bump 版本
- 本任务不做硬等待清理（`waitForTimeout(3000/5000)` 保留原样，TPV0097 范围）；fixture 只需在现有等待策略下稳定
- t022-diagram-refactor.spec.ts 与 verify-mermaid.spec.ts 的同型缺陷**本次不修**（见第 4 节逐条判定），倾向项延后

## 2. 隐含需求识别

P0-brief 的「自建 + 清理」之外，P1 查证发现以下未言明但技术上必须的依赖：

### 2.1 [SCOPE+ from P1] 死选择器迁移——仅自建 entry 无法转绿

三个 spec 自 2026-06-27 起部分选择器指向**已删除的 DOM**（组件重构 f264e58a 删除旧 MermaidDiagram 系组件，DiagramBlock.vue 接管渲染；spec 修正 commit 66e83428 晚于重构但本身引入/遗留死类名）：

| spec | 选择器 | 现状 | 现存替代（src 实证） |
|------|--------|------|----------------------|
| mermaid.spec.ts test1/test2 | `.mermaid-content[data-mode=…]` | 死（src 0 命中） | `.diagram-viewer`（diagram）/ `.diagram-code`（code） |
| mermaid.spec.ts test3 | `.mermaid-action-btn[title="Fullscreen"]` | 死 | `.diagram-action-btn.fullscreen-btn` |
| mermaid.spec.ts test3 | `.diagram-modal-overlay` | 死 | `.diagram-modal` |
| mermaid-visual.spec.ts test1/test2 | `.mermaid-content[data-mode="diagram"]` | 死 | `.diagram-viewer` |
| mermaid-visual.spec.ts test3 | `.mermaid-action-btn[…]` + `.diagram-modal-overlay` | 死 | 同上两行 |
| mermaid-check.spec.ts | `.diagram-block` / `.diagram-viewer` | 存活 | 无需改 |

- **为什么必须**：死选择器使 `locator()` 匹配 0 元素——`expect(count).toBeGreaterThan(0)` 类断言必 FAIL（mermaid.spec test1/test3 即使 entry 存在也红灯）；而 mermaid-visual 的死选择器恰好被 `if (isVisible)` + `.catch(() => false)` 包裹，形成静默假绿（见 2.4）。不迁移选择器，「3 spec 全绿」验收不可达
- **约束兼容性**：改的是 `e2e/*.spec.ts` 内的字符串选择器与 goto 路径，不触碰 `src/`——仍在「只改测试代码」边界内
- [BASELINE_SCOPE_NOTE] 此项为 P1 新识别的隐含需求（P0 改动清单只列了 beforeEach/afterEach 改造），按 [SCOPE+ from P1] 增补基线，待主 Agent 确认并入 P2 设计

### 2.2 goto 路径迁移——`/entries/:slug` 是死路由

`router.ts` 仅有 `path: '/:slug'`（L48），无 `/entries/:slug` 路由亦无 redirect；`/entries/xxx` 两段路径落入 `/:pathMatch(.*)*` → NotFoundView。三个 spec 的 goto 全部使用 `/entries/{slug}` 旧写法，页面必然 404。这是 AGENTS.md 铁律 7 明文的反复复发陷阱。**必须**改为 `/${slug}`（render-regression.spec 的 `gotoEntry` helper L59-60 是正确写法参照）。

### 2.3 fixture 创建与删除的认证配对

- debug 环境匿名创建放行：`scripts/dev-server.sh` L112 显式 `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE=true`；匿名创建强制 `is_public=True`（`entries.py` L136-139），entry `owner_id=NULL`
- 匿名删除放行条件：`server.api_key` 为空（debug 未配置）→ `allow_local=True`（`entries.py` L477-478 + `entry_service.delete_entry` L979-980 bypass）
- **配对约束**：匿名建的 entry（owner_id=NULL）用普通用户 JWT 删除会被拒（`entry_service` L1001-1002 仅 admin 或 allow_local 可删 owner_id=NULL）→ 返回 404。创建与删除必须同认证上下文：匿名建+匿名删，或登录用户建+同一用户删。混用 = 清理失败 = 残留
- captcha 只覆盖 `/auth/register`、`/auth/login`（config.py L298-300），entry 创建/删除不经 captcha；debug 关闭限流（`RATE_LIMIT_ENABLED=false`），fixtures 不会触发 429

### 2.4 条件包裹假绿修复——「断言无条件执行」

mermaid-visual.spec test1 的断言链包在 `if (isVisible)` / `if (svgVisible)` 内且 `isVisible()` 带 `.catch(() => false)`：diagram 不可见时整段断言静默跳过 → test PASS。这是「长期红灯」之外的第二类信号失真：即使 fixture 修好，若未来渲染回归导致 diagram 消失，test1 依旧绿。**必须**把断言改为无条件执行（P0-brief known_risks 的「断言强度未知」已定案：无像素级对比，实际为存在性 + boundingBox 尺寸 + 交互后可见性）。

### 2.5 fixture 稳定性约束（不做硬等待重构）

现有 spec 依赖 `waitForTimeout(3000)`（mermaid/mermaid-visual）与 `waitForTimeout(5000)`（mermaid-check）等待 mermaid 异步渲染。本任务**不改等待策略**，fixture 只需保证：entry 创建成功后页面可达、内容含 ≥1 个 mermaid 代码块、渲染出的 svg 在现有等待窗口内达到既有阈值（容器 >200px、svg >100px）。seed-data/mermaid-charts 的 flowchart 类图证明该阈值可由普通 mermaid 内容满足。

### 2.6 防生产护栏

自建 entry 的 spec 直接写 DB（POST/DELETE `/api/v1/entries`）。teams-page.spec 已有护栏范式（beforeAll 校验 BASE_URL 非 :8080/prod 即 fail-fast）。三个渲染 spec 现状无此护栏，改造时**必须**一并提供（成本一行，防止未来误指生产）。

### 2.7 E2E 编写规范落点

P0-brief 验收基线 4 要求规范成文。repo 无 project.md；`docs/process/debug-workflow.md` 是既有 E2E 流程文档（调试/验证入口），规范节落在该文件（倾向项见 8.2）。规范内容至少两条：① 页面路由是 `/:slug` 不是 `/entries/:slug`（API 才是 `/api/v1/entries`）；② spec 依赖的 entry 必须存在于 seed-data/ 或测试内自建且带 afterEach 清理队列。

### 2.8 隐含需求清单（逐维度）

- 数据：fixture entry 写入 debug DB，必须可清理且不与 seed-data 24 条现有 slug 冲突 → 新 slug 前缀（倾向 `e2e-` 前缀，见 8.3），不碰 seed slug
- 前端：不改 src；`domains: frontend` 因被测对象是前端渲染链。UI 形态声明：本任务不新增/不改页面 UI，仅以断言验证既有渲染，形态按缺省（layout 型）处理；BDD-10/11 以「渲染正确性」类别写入标题并采用可量化判据（实测 boundingBox 尺寸）。本版本 agate-md-field-set 白名单不含 ui_render_shape/ui_ux_dimensions（已报告主 Agent），字段缺省语义下 gate 不拦
- 多端：MCP/CLI 不涉及（无产品代码改动）
- 边界：清理钩子在任何断言失败路径都必须执行（afterEach 钩子语义天然覆盖——teams-page 注释明言「放测试末尾的清理在断言失败时会跳过→泄漏，必须走钩子」）
- 兼容：不破坏既有 spec；其余渲染 spec（svg-inline-render / render-regression SVG 用例）结果不劣化（BDD-12）

## 3. BDD 验收条件

> 判据均可二值判定；执行环境统一为：干净 debug 环境（`make debug-start` + `make debug-seed`），BASE_URL=:8888，本机 CDP Chrome :18800 可用（run-e2e-tests.sh 自动注入 CDP_ENDPOINT）。

### 3.1 fixture 自建与清理

#### BDD-1: 干净环境 3 spec 自建后全绿
- Given 干净 debug 环境（debug-start + debug-seed，DB 中不存在 test-mermaid-2 / playwright-test / e2e-test）
- When 依次运行 mermaid.spec.ts、mermaid-check.spec.ts、mermaid-visual.spec.ts
- Then 每个 spec 的每个用例在其运行的两个 project（chromium、Mobile Chrome）下均为 PASS，failed=0、skipped=0（以 playwright 退出码 0 为准）

#### BDD-2: 运行后 DB 无 fixture 残留
- Given 一次完整运行（任一被改造 spec 跑完）
- When 以本次运行创建的 fixture slug 清单查询 debug DB
- Then 每条 slug 查询结果均为 0 行（`sqlite3 /tmp/peekview-debug/peekview.db` 逐 slug count=0）

#### BDD-3: 连续重跑 2 次结果稳定且无累积残留
- Given BDD-1 通过后的同一 debug 环境
- When 连续重跑 3 spec 各 2 次
- Then 每次退出码均为 0，且第 2 次跑完后 BDD-2 的残留查询仍全部为 0 行

#### BDD-4: fixture 不与 seed 数据冲突
- Given seed-data/ 现有 24 条 slug 清单
- When 审查被改造 spec 的 fixture slug
- Then 无任何 fixture slug 与 seed slug 重名，且清理后 seed 24 条逐一仍可访问（抽验 ≥3 条返回 200）

#### BDD-5: 清理失败必须显式失败
- Given 清理队列模式（teams-page 范式：创建成功才入队 + afterEach 对队列 splice 无条件逐条删除）
- When 删除请求返回 200/204/404 以外的状态码
- Then afterEach 抛错使该用例 FAIL（不允许静默吞掉清理失败）；404 视为「已删除」容忍场景

### 3.2 断言有效性（假绿修复）

#### BDD-6: mermaid-visual 断言无条件执行
- Given 改造后的 mermaid-visual.spec.ts
- When 对文件做条件包裹静态检查
- Then 不存在 `if (…isVisible…)` / `.catch(() => false)` 包裹 `expect()` 的路径，所有 expect 无条件执行——diagram 未渲染时对应用例必须 FAIL 而非 PASS

#### BDD-7: 死选择器清零
- Given 改造后的 3 spec
- When 收集 spec 中全部 class 选择器并在 `frontend-v3/src/`（构建产物 backend/peekview/static/assets/ 作辅助正向对照）中核对
- Then 每个被断言/交互的选择器类名均存在于当前组件 DOM（死类名 .mermaid-content / .mermaid-action-btn / .diagram-modal-overlay 命中 0 处）

### 3.3 路径与口径修正

#### BDD-8: goto 全部使用 `/:slug` 页面路由
- Given 改造后的 3 spec
- When 检查全部 `page.goto` 调用
- Then 3 spec 中 `/entries/` 路径命中 0 处，entry 详情页跳转均为 `/{slug}` 形式且能到达渲染视图（非 NotFoundView）

#### BDD-9: 双 project 口径全绿
- Given 干净 debug 环境
- When 运行 3 spec（不指定 --project，配置仅含 chromium 与 Mobile Chrome 两个 project）
- Then chromium project 全部用例 PASS 且 Mobile Chrome project 全部用例 PASS（两 project 分开统计均 0 failed；mermaid-visual 因测试体内自起 chromium 浏览器，在两个 project 各执行一遍，两遍均计入 PASS 统计）

### 3.4 渲染正确性（UX 类）

#### BDD-10: 渲染正确性：自建 fixture 的 mermaid SVG 渲染输出
- Given 自建 fixture entry（含 ≥1 个 mermaid 代码块）
- When 打开其详情页 `/{slug}` 并等待渲染
- Then 每个 diagram-block 渲染出 svg 元素，boundingBox 实测容器高度 >200px 且 svg 高度 >100px（沿用既有断言阈值；本任务维持存在性+尺寸断言口径，不引入像素级对比）

#### BDD-11: 渲染正确性：交互后结束状态断言
- Given BDD-10 的 fixture 详情页
- When 执行 code/diagram 视图切换与 Fullscreen 开启
- Then 切换后 code 视图容器可见且 diagram 容器隐藏、切回后 svg 恢复可见；fullscreen modal 可见且高度 >500px（1280x800 视口内，mermaid-visual 自起浏览器实例的硬编码视口）

### 3.5 回归拦截

#### BDD-12: 其余渲染 spec 不回归
- Given 改造前的基线运行结果（svg-inline-render.spec.ts、render-regression.spec.ts 的 t085 SVG 用例）
- When 改造合入后重跑这两个 spec
- Then 结果与基线一致（不出现基线中不存在的新失败；render-regression 的 bdd_4/bdd_5 既有 flaky 互换不计入新失败）

#### BDD-13: E2E 编写规范落盘
- Given 规范写入 `docs/process/debug-workflow.md`（新「E2E 编写规范」节，落点变更见 8.2）
- When 打开该文档
- Then 同时存在两条规则：页面路由 `/:slug` 而非 `/entries/:slug`（API 与页面路由区分）；spec 依赖的 entry 必须存在于 seed-data/ 或测试内自建且带 afterEach 清理队列

## 4. 同类扫描结论

**扫描动作**：对 3 个失败 slug、`createEntry` 模式、`/entries/` goto 路径、e2e 目录 39 个 spec 做全仓 grep（排除 node_modules/static/agate-workspace/.git/dist），命中与判定如下。

**命中清单 + 逐条判定**：

| 命中 | 内容 | 判定 |
|------|------|------|
| mermaid.spec.ts / mermaid-check.spec.ts / mermaid-visual.spec.ts | 3 失败 slug 依赖 + 死选择器 + /entries/ goto | 本次处理（本任务主体） |
| t022-diagram-refactor.spec.ts | 7 个 test 全部 goto `/entries/test-mermaid-2`、`test-plantuml-2`、`test-svg-2`（均不在 seed）；死选择器 `.mermaid-action-btn`、`.toolbar-btn` | 本次不处理——超出 P0 三 spec 范围，DEBT0010 closure criteria 仅列 3 spec；同型缺陷（死路径+死选择器+无 fixture），延后立项（见 8.4） |
| verify-mermaid.spec.ts | goto `/entries/test-mermaid-2-2`（不存在且不在 seed）；`.diagram-block`/`.diagram-viewer` 选择器存活 | 本次不处理——同上，1 个用例，延后（见 8.4） |
| viewer.spec.ts | 自建 `e2e-test-code` 等条目、goto 正确 `/:slug` 路径、依赖的 `markdown-test`/`mermaid-charts`/`python-entry-service` 均在 seed；但**无 afterEach/afterAll 清理钩子**（自建条目残留） | 本次不处理——不属 3 spec 范围且当前全绿；清理缺失是 DEBT0008 已登记的家族性问题（见 8.4） |
| html-render.spec.ts / structured-data-viewer.spec.ts / render-regression.spec.ts | createEntry 无清理家族（t085-\*、t075-\*、e2e-html-\* 残留 debug DB） | 本次不处理——同 DEBT0008 家族问题，DEBT0008 closure criteria 已含「创建型 E2E 均带 afterEach 清理」的推广路径；本任务 BDD-13 规范落盘即为拦截手段 |
| t049-mobile-header-diagram-sanitize.spec.ts | 自建 `t049-multi-tag`，beforeEach 防御性预删（404 容忍），无 afterEach | 本次不处理——已有防御性预删，残留面小，家族问题归 DEBT0008 |
| packages/mcp-server/tests/e2e/mcp-e2e.test.ts | `e2e-test` 为 clientInfo 名称与 `e2e-test-${Date.now()}` 动态 slug（自建自清），与失败 slug 仅子串巧合 | 本次不处理——非同一问题 |
| CHANGELOG.md / docs/reviews/\* / Makefile | `e2e-test` 为文档叙述与 `run-e2e-tests.sh` 文件名子串巧合 | 本次不处理——非 fixture 引用 |

**回归拦截声明**：同型缺陷（spec 依赖消失 entry / 死选择器 / 死 goto 路径）未来新增的拦截手段 = BDD-13 的 E2E 编写规范（seed 或自建+清理、路由写法），落盘后由 code review 对照执行；存量家族问题由 DEBT0008/DEBT0010 跟踪。机械 gate 脚本类拦截（如 spec 死选择器静态检查进 CI）超出本任务范围，不作要求。

**结论**：`/entries/` goto 死路径与死选择器问题在三 spec 之外**确有同类实例**（t022、verify-mermaid），非只此一处；「依赖已消失 entry」问题在无清理 createEntry 家族中同样**非只此一处**（viewer/html-render/structured-data-viewer/render-regression/t049 共 5 文件）。本次按 P0 范围处理 3 spec，其余显式延后并留倾向项。

## 5. P0-brief 时效性核对

已核对 P0-brief 时效性，无漂移。核对过程：2026-09-07 复核 seed-data/（24 条、3 slug 缺席）与 P0 实证一致；dev-server.sh debug 环境配置（:8888 / /tmp/peekview-debug/ / 匿名创建 / 关限流）未变；「自建 entry 化」目标方案前提（entry 无法恢复、自建模式现成）成立；`executor_env` 平台前提（:8888 隔离、CDP :18800）未变。P1 新发现的死选择器问题属 P0 known_risks「断言强度未知需 P1 实读确认」预留口子的定案结果，走第 2.1 节 [SCOPE+ from P1] 增补基线，不构成 P0 字段漂移；「chromium+Mobile」表述修正（BDD-9 补充 mermaid-visual 双遍执行口径）属 P0 明文交 P1 细化的本职工作。

## 6. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: 渲染正确性 BDD（BDD-10/11）的 P6 验收需对照页面渲染结果与截图证据（svg 可见性、modal 高度）
    available:
      - "vision-analyst（agate 内置执行角色，首选）"
      - "playwright-cdp skill（已注入，作为补充）"
    status: available
  - need: debug-server-env
    why: 全部 BDD 依赖干净 debug 环境（make debug-start + debug-seed + debug-stop 还原）
    available:
      - "make debug-start/debug-seed/debug-stop（项目标准操作，dev-server.sh 三级隔离）"
    status: available
```

verification_env：本任务所有验收依赖 debug 服务在 :8888 运行，属标准可准备环境（`make debug-start`），按 dispatch-protocol「环境准备职责边界」由主 Agent 准备，无需人工介入路径。

```yaml
verification_env: "debug server http://127.0.0.1:8888（make debug-start + make debug-seed）"
verification_env_budget: "止损轮次 2（独立计数，不占 retries[P5/P6]）；轮次追踪由主 Agent 在 dispatch-context 记录"
```

## 7. 裁剪说明

`risk_level: medium`——理由：不改产品代码，破坏面限于测试与文档；但涉及认证语义（匿名创建/删除配对）、清理可靠性（残留即污染后续验证）与渲染断言修复，失败模式隐蔽（假绿/残留不立刻暴露），不宜按 low 薄化。`ceremony: standard`（缺省档，不声明 thin）。

`phases` 裁剪声明（frontmatter 为准，此处写理由）：

- P1：本文件（核心阶段，不可裁）
- P2：保留——虽 follows_existing_pattern（teams-page 清理队列 + render-regression createEntry），但 fixture 认证配对（匿名 vs 登录）与 slug 策略需方案定稿；声明 `design_trivial: true`（1 候选方案）+ `follows_existing_pattern: [frontend-v3/e2e/teams-page.spec.ts, frontend-v3/e2e/render-regression.spec.ts]`
- P3：保留——被测对象即测试自身，BDD 红灯→绿灯即 TDD 闭环（P0 裁剪倾向一致）
- P4：保留（实现）
- P5：保留——pytest 全绿 + 测试环境隔离验证（debug 隔离不受影响需证据）
- P6：不可裁——BDD-1~13 逐条实跑 + 截图/日志证据 + 残留查询证据
- P7：保留——多文件改动（3 spec + docs），跨文件一致性（slug 策略、清理模式、规范文本与实际改动一致）需交叉核对
- P8：保留（phases 含 P8）——按 releaser 只产出文件执行（不 commit/tag），主 Agent 不做 bump-version：纯测试改动无用户可见行为变化；CHANGELOG [Unreleased] 记录即可（P0 裁剪倾向一致）。internal_only 简化形态未启用（本版本 agate-md-field-set 白名单不含该可选字段）

## 8. 待确认清单与倾向项

[NO_NEED_CONFIRM]——无真无方向的阻塞项。以下为 [SUGGEST] 倾向项（主 Agent 可自行采纳，不阻塞）：

1. [SUGGEST: 推荐按 2.1 节把死选择器迁移并入本任务范围，理由：不并入则 P0 验收基线「3 spec 全绿」不可达，且改动仍限于测试文件、与 fixture 工作同文件同 commit 粒度]
2. [SUGGEST: 推荐 E2E 编写规范落点为 docs/process/debug-workflow.md 新增「E2E 编写规范」节，理由：该文件是既有 E2E 流程文档（调试/验证入口），repo 无 project.md，另建文件增加查找成本]
3. [SUGGEST: 推荐 fixture slug 采用 e2e- 前缀（如 e2e-mermaid / e2e-mermaid-check / e2e-mermaid-visual），理由：与 seed-data 24 条 slug 天然隔离、残留可按前缀批量审计（BDD-2 判据）；具体 slug 命名 P2 定稿]
4. [SUGGEST: 推荐 t022-diagram-refactor.spec.ts 与 verify-mermaid.spec.ts 的同型缺陷（死路径/死选择器/消失 fixture）延后单独立项并登记 debt/roadmap，理由：超出 DEBT0010 closure criteria 范围，混入会扩大本任务验收面；viewer/html-render/structured-data-viewer 的清理缺失已由 DEBT0008 跟踪，不重复登记]
