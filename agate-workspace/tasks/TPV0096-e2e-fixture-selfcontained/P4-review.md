---
phase: P4
task_id: TPV0096
parent: P4-implementation.md
trace_id: TPV0096-P4-20260907
agent: design-review
status: approved
implementation_dir: frontend-v3/e2e
---

# P4 实现评审 — TPV0096 E2E 红灯 spec 自建 entry 化

> 评审角色：design-review（只审不写）。评审对象 = git 工作区未提交 diff（4 文件封闭清单）。
> 本任务 ui_affected: false、无 UI 组件改动——design-review 角色的视觉/排版/间距/交互状态清单**不适用**（见 §2 显式声明），评审焦点按 dispatch-context 适配为 6 项（§3-§8）。

## 1. 评审范围与方法

- 评审对象：`frontend-v3/e2e/mermaid.spec.ts`、`frontend-v3/e2e/mermaid-check.spec.ts`、`frontend-v3/e2e/mermaid-visual.spec.ts`、`docs/process/debug-workflow.md`（git diff 全文逐行读取）。
- 对账基准：`P2-design.md` §1.1 M1-M4 表 + §2 定稿；`P3-test-cases.md` §2/§4/§6；范式参照 `teams-page.spec.ts`、`render-regression.spec.ts`、`t049-*.spec.ts` 先例片段。
- 亲跑复核命令（全部本会话实跑）：P3 §6 全部 grep 判据（rc 显式判定）、slug 枚举/R2/清理钩子辅助 grep、`npx playwright test --list`（14 tests）、`make test-frontend` × 3 轮采样。
- 未跑完整 E2E 套件（P5/P6 职责）；未启动任何服务；未触碰 :8080 与 `~/.peekview/`。

## 2. UI 清单适用性声明（角色适配）

design-review 角色 checklist 的 4 类清单对本任务**全部不适用**，显式声明如下，不虚构任何视觉/交互发现：

| 角色 checklist 项 | 适用性 | 理由 |
|---|---|---|
| AI Slop 视觉项（紫色渐变/泛化文案/居中布局/同质 grid） | 不适用 | 0 UI 组件改动；M4 文档面的 AI Slop 检查适配至 §8 |
| Typography（字号层级/行高/16px 下限） | 不适用 | 未触碰任何 `.vue`/CSS 文件 |
| Spacing（间距 scale/44px 点击区） | 不适用 | 同上 |
| 交互状态（hover/focus/disabled/loading/empty） | 不适用 | 同上 |

适配后的 6 项评审焦点（dispatch-context 指定）：方案对账（§3）、四件套质量（§4）、静态判据复核（§5）、范围纪律（§6）、清理钩子完备性（§7）、AI Slop/文档质量（§8）。

## 3. 焦点 1：方案对账（P2 §1.1 M 表逐行）

### 3.1 M1 `mermaid.spec.ts`（75 行 → 141 行）逐行对账

| P2 M1 改动行（现位置） | 落地情况 | 证据 |
|---|---|---|
| 新增 beforeAll 护栏（:8080/prod throw + /health 探活） | ✅ | `mermaid.spec.ts:6-12`，与 teams-page.spec.ts:22-27 逐字范式一致 |
| 无 fixture → ensureEntry（预删→POST→入队）+ 3 test 各自 entry | ✅ | `mermaid.spec.ts:25-34`（helper）+ `:43/:75/:113`（svg/toggle/fullscreen 各自调用） |
| goto `/entries/test-mermaid-2` → `${BASE_URL}/${slug}` | ✅ | `mermaid.spec.ts:51/:83/:119`；beforeEach 已删除，goto 移入各 test |
| `.mermaid-content[data-mode="diagram"]` → `.diagram-viewer` | ✅ | `mermaid.spec.ts:55/:89` |
| `.mermaid-content[data-mode="code"]` → `.diagram-code` | ✅ | `mermaid.spec.ts:90` |
| `.mermaid-action-btn[title="Fullscreen"]` → `.diagram-action-btn.fullscreen-btn` | ✅ | `mermaid.spec.ts:123` |
| `.diagram-modal-overlay` → `.diagram-modal`（page 级定位不变） | ✅ | `mermaid.spec.ts:127`（page.locator，Teleport 至 body 语义保持） |
| 新增清理队列（splice + 匿名 DELETE + [200,204,404]） | ✅ | `mermaid.spec.ts:14-23`，队列只存 slug（`string[]`） |
| 等待策略 networkidle + waitForTimeout(3000) 不变 | ✅ | `mermaid.spec.ts:52-53/:84-85/:120-121` |

### 3.2 M2 `mermaid-check.spec.ts`（27 行 → 62 行）逐行对账

| P2 M2 改动行 | 落地情况 | 证据 |
|---|---|---|
| URL 硬编码 → BASE_URL const + fixture + `goto ${BASE_URL}/${slug}` | ✅ | `mermaid-check.spec.ts:3/:37-45`；slug 采用 `e2e-mermaid-check-main-<project>`，与 P2 §2.4 定稿命名一致（M2 表 L54 简写 `e2e-mermaid-check-<project>`，以 §2.4 定稿为准，实现正确） |
| 新增护栏 + afterEach 清理队列（同构内联） | ✅ | `mermaid-check.spec.ts:6-23` |
| waitForTimeout(5000) 不变 | ✅ | `mermaid-check.spec.ts:46` |
| 移除 `if (count > 0)` 包裹，断言无条件执行 | ✅ | `mermaid-check.spec.ts:53-61`；`expect(count).toBeGreaterThan(0)` 无条件先行（`:53`）保留 |

### 3.3 M3 `mermaid-visual.spec.ts`（101 行 → 140 行）逐行对账

| P2 M3 改动行 | 落地情况 | 证据 |
|---|---|---|
| BASE_URL 硬编码 → const（`process.env.BASE_URL \|\| 'http://127.0.0.1:8888'`） | ✅ | `mermaid-visual.spec.ts:3`，与 M1/M2 写法一致 |
| goto `/entries/e2e-test` ×3 → fixture + `/${slug}` | ✅ | `mermaid-visual.spec.ts:55/:91/:123`（height/toggle/fullscreen） |
| test1 假绿拆除：无条件 toBeVisible + box >200 + svg toBeVisible + svgBox >100 | ✅ | `mermaid-visual.spec.ts:61-74`，`isVisible().catch` 与双层 if 全部移除 |
| test2 条件断言 → `await expect(svg).toBeVisible()` + `.diagram-viewer svg` | ✅ | `mermaid-visual.spec.ts:105-106` |
| test3 死选择器 + 条件断言 → `.diagram-action-btn.fullscreen-btn` + `.diagram-modal` + 无条件 toBeVisible + height >500 | ✅ | `mermaid-visual.spec.ts:126-136` |
| 自起 chromium.launch({headless}) + viewport 1280x800 保留不动 | ✅ | `mermaid-visual.spec.ts:51-53/:87-89/:119-121`，结构与改造前同构 |
| 新增护栏 + afterEach 清理（经 Playwright request fixture，与自起浏览器解耦） | ✅ | `mermaid-visual.spec.ts:6-23`；3 个 test 签名 `({ request })`（`:41/:79/:111`），清理用 request 实例、断言用自起 page，解耦正确 |

### 3.4 M4 `docs/process/debug-workflow.md` 对账

4 条规则与 P2 §1.1 M4 清单逐条一致：规则 1（`/:slug` 非 `/entries/:slug` + NotFoundView 机制）`debug-workflow.md:249`、规则 2（seed 或自建 + afterEach 清理队列 + 显式 FAIL + 404=已删除）`:250`、规则 3（BASE_URL 护栏 beforeAll fail-fast + /health）`:251`、规则 4（同认证上下文 + 队列只存 slug）`:252`。插入点在「调试检查清单」之后、「常见问题」之前（`:245`），与 P2 M4 声明一致。

### 3.5 §2 定稿遵守

- **slug 显式枚举**：grep 实测 7 个 case 模式（`e2e-mermaid-{svg,toggle,fullscreen}-` / `e2e-mermaid-check-main-` / `e2e-mermaid-visual-{height,toggle,fullscreen}-`）× 2 project = 14 slug 上限，projectKey 派生一行内联（`mermaid.spec.ts:42` 等 7 处）；`Date.now`/`workerIndex` 负向 grep 0 命中——BDD-2 可枚举性 + BDD-3 确定性成立。
- **mermaid-visual 自起结构未动**：`chromium.launch({ headless: true })` + viewport 1280x800 三处原样（P2 §2.3 定稿）。
- **等待策略未动**：三 spec 合计 14 处 waitForTimeout（3 个 3000/4000/5000 主等待 + 既有 toggle/modal 短等待），数值与改造前一致。
- **is_public 显式**：3 处 `is_public: true`（各 spec `:28`），与 render-regression createEntry body 一致。

**对账结论：M1-M4 全部行落地，无缺失行，语义零偏差（仅行号漂移，P2 已明示可接受）。**

## 4. 焦点 2：四件套质量

### 4.1 与先例对账

| 机制 | 先例 | 实现一致性 |
|---|---|---|
| 护栏（BASE_URL 含 :8080/prod throw + /health 探活） | teams-page.spec.ts:22-27 | 三 spec `:6-12` 逐字同构 ✅ |
| 清理队列（splice(0) + 循环 DELETE + [200,204,404] + 其余 throw） | teams-page.spec.ts:35-45 | 三 spec `:14-23` 同构；去 token 字段为 P2 §2.1 声明的合法适配（匿名上下文）✅ |
| 防御性预删（DELETE + catch 容忍 404） | t049 spec:9 | 三 spec `:26` 同构 ✅（见 F3 吞错范围说明） |
| gotoEntry 写法（`${BASE_URL}/${slug}`） | render-regression.spec.ts:59-61 | 7 处 goto 全部一致 ✅ |
| POST body 结构（slug/summary/is_public/files） | render-regression createEntry | 一致，且比先例更强：非 201/200 throw（R3「不吞错」要求，先例 `.catch(()=>{})` 缺陷未带入）✅ |

### 4.2 认证配对铁律（R2）——结构性成立

- 队列类型 `string[]`（3 spec `:14`），结构上无 token 字段——「匿名建 + 带 token 删」混用被类型层面杜绝。
- `Authorization|Bearer|token` 负向 grep 三 spec 合计 **0 命中**（rc=1，本会话亲跑）。
- 预删/清理/创建全部使用无 header 的 request 调用——匿名同上下文配对成立。

### 4.3 发现

```text
[CONFORMANCE] 清理循环 throw 会中止同队列其余条目删除
  文件：mermaid.spec.ts:17-22（mermaid-check/mermaid-visual 同构 :17-22）
  问题：for-of 循环体内 throw 使后续 slug 不再尝试删除；P3 §4.1.3 写「先取走队列，
        单条失败不中止其余条目清理」，字面语义与实现不符。但 teams-page 先例
        （:38-44）即为此形态，P3 引用的范式自身与该句表述存在张力。
  判级：非阻塞。本任务每用例至多 1 个 fixture slug（单 spec 单用例场景队列长度为 1，
        双 project 并行时每 worker 队列独立），「多 slug 部分残留」在当前用例结构下
        不可达；BDD-2 的逐 slug count=0 审计（P6）兜底可发现任何残留。
  Fix ：建议 P7 一致性检查时对齐口径——维持实现与 teams-page 先例一致，修正 P3 §4.1.3
        表述为「单条失败不中止队列取空」或反向收紧实现（循环内失败先记录、循环结束再
        throw）。本评审不要求 P4 返工。
```

```text
[QUALITY] ensureEntry 预删 .catch(() => {}) 吞掉全部失败形态（含网络错误）
  文件：mermaid.spec.ts:26（mermaid-check/mermaid-visual 同构 :26）
  问题：预删 DELETE 的 catch 不仅容忍 404，也吞掉连接拒绝等网络层错误；若 debug 服务
        未启动，预删静默通过、随后 POST 才失败——首错报告点后移一步。
  判级：非阻塞。承袭 t049 先例（:9）形态；R3 的「不吞错」约束锚定 POST（非 201/200
        throw，:30-32 已严格落地），创建失败仍会立即红灯，fixture 红灯语义未被破坏。
  Fix ：可选优化（不要求）：预删按状态码判定容忍——`const r = await request.delete(…);
        if (![200, 204, 404].includes(r.status())) r.markAsError?.()` 或 try/catch 仅包
        404 路径。属后续改进项，不构成本次通过的条件。
```

```text
[QUALITY] mermaid-visual 自起 browser 无 try/finally 保护，断言失败时 browser 进程滞留
  文件：mermaid-visual.spec.ts:51-77/:87-109/:119-139
  问题：`await browser.close()` 在断言之后；断言失败路径不执行 close（Playwright 会
        在 test 结束后回收子进程，但属隐式依赖）。改造前即此形态，P2 §2.3 定稿「保留
        不动」，属既有债务非本次引入。
  判级：非阻塞，不计入本次评审通过条件。
  Fix ：后续任务可将 test 体包 try/finally 或改用 `test.use` 管理自起实例；与 P1 §2.5
        「不改等待策略」同级，留作 DEBT 候选，不在本任务处理。
```

## 5. 焦点 3：静态判据复核（亲跑）

### 5.1 P3 §6 判据逐条复核（本会话实跑，rc 显式判定）

| 判据 | 复核结果 | 与 implementer 自查一致性 |
|---|---|---|
| BDD-6 负向① `if \([A-Za-z]*[Vv]isible` | rc=1，0 命中 | ✅ 一致 |
| BDD-6 负向② `.catch(() => false)` | rc=1，0 命中 | ✅ 一致 |
| BDD-6 负向③ `if (count` | rc=1，0 命中 | ✅ 一致 |
| BDD-6 正向 `expect(` 计数 | 13 / 3 / 7（合计 23 ≥ 基线 21） | ✅ 一致（mermaid-visual 基线 5 → 7，源自无条件断言新增） |
| BDD-7 负向（死类名三模式） | rc=1，0 命中 | ✅ 一致 |
| BDD-7 正向① spec 侧存活选择器 | mermaid.spec 5 处 / mermaid-visual.spec 4 处 | ✅ 一致 |
| BDD-7 正向② src 侧对照 | DiagramBlock.vue:187（diagram-viewer）/ :177（fullscreen-btn）/ MermaidRenderer.vue:9（diagram-modal）全命中 | ✅ 一致 |
| BDD-8 负向 `/entries/` | rc=1，0 命中 | ✅ 一致 |
| BDD-8 正向 `goto \`${BASE_URL}/` | 7 处（mermaid 3 + check 1 + visual 3），全为 `/${slug}` 形式 | ✅ 一致 |
| BDD-13 文档判据 | `debug-workflow.md:245/:249/:250` 三条全命中 | ✅ 一致 |
| slug 枚举 | 7 个 case 模式 × 2 project = 14 上限 | ✅ 一致 |
| 清理钩子辅助（splice / 204 / is_public: true） | 每 spec 各 1 / 各 1 / 各 1 | ✅ 一致 |
| R2 认证铁律（Authorization/Bearer/token） | rc=1，0 命中 | ✅ 一致 |

**静态判据复核全部通过，implementer 自查声明与亲跑结果零偏差。**

### 5.2 playwright --list 收集验证

- `npx playwright test --list e2e/mermaid.spec.ts e2e/mermaid-check.spec.ts e2e/mermaid-visual.spec.ts`（frontend-v3 目录下，timeout 120s）：**Total: 14 tests in 3 files**（chromium 7 + Mobile Chrome 7），无解析/收集错误。
- 方法论勘误（记录供 P6 复用）：从 repo 根目录直接 `npx playwright test --list -c frontend-v3/playwright.config.ts frontend-v3/e2e/…` 会触发「two different versions of @playwright/test」解析错误（repo 根与 frontend-v3 各有一套 node_modules 解析）——**收集/执行命令必须在 `frontend-v3/` 目录内发起**，文件参数用相对路径。implementer 自查声明的调用形态正确；P6 卡执行该判据时应沿用此口径。

### 5.3 make test-frontend 复核（3 轮采样）

| 轮次 | 结果 | 失败文件 |
|---|---|---|
| 第 1 轮 | 1 failed / 1342 passed / 4 skipped | ThemeToggle.spec.ts（toggle 计数断言） |
| 第 2 轮 | 2 failed / 1341 passed / 4 skipped | t068-account-settings.spec.ts + tpv0095-entry-list-view-teams.spec.ts |
| 第 3 轮 | **0 failed / 1343 passed / 4 skipped（rc=0）** | — |

- 判定：三轮失败文件**逐轮不同**、全部位于 `frontend-v3/src/`，与本任务改动面（`e2e/` + `docs/`，且 `vitest` 配置 `exclude: ['e2e/**']`，spec 不入 vitest 收集）**零交集**——判定为套件既有 flaky（测试间状态污染类），非本次实现引入。
- implementer 声明的「1343 passed / 4 skipped / 退出码 0」在第 3 轮精确复现，自查声明可复现成立。
- 本复核不替代 P5 gate：P5 若遇 1-2 文件级失败，建议复跑判定（失败文件是否与改动面交集 + 是否逐轮漂移），与本节方法一致。

## 6. 焦点 4：范围纪律

- `git diff --name-only`（未提交 diff）：代码与文档改动 = `docs/process/debug-workflow.md` + 3 个 spec，**恰好等于 P2 §1.1 封闭清单 4 文件**，零外溢。
- 工作区另有任务状态文件改动（`.state.yaml`/`gate-events.jsonl`/`orchestrator-log.md`/`active-tasks.md`）与 untracked 的 P4 dispatch/implementation/progress——均为 agate 流程产物，不属代码改动面，不计范围外。
- `frontend-v3/src/`、`backend/`、`playwright.config.ts`、其余 36 个 e2e spec、seed-data/：grep/diff 核对零触碰（P2 §1.2「不改」清单全部守住）；render-regression/t049/svg-inline-render 零改动，BDD-12 基线对照前提（两 spec 本任务零改动）成立。
- 无 `[SCOPE+]`、无 `[DESIGN_GAP:]` 声明，与实际 diff 一致（未发现应标未标的范围外改动）。
- M4 规范节 4 条与 P2 §1.1 M4 清单一致且插入点正确（§3.4）。
- **机制衔接提示（非发现，供主 Agent 排 commit）**：P3 §7.2 要求 BDD-12 基线记录窗口在「P4 合入前」——当前改造处于未提交工作区，主 Agent 应确保 P4 commit 之前基线已记录（P3 §5 已回填 3 轮采样数据），P4 commit 后无法再取得改造前基线。

## 7. 焦点 5：清理钩子完备性（P3/P4 卡强制要求）

| 检查项 | mermaid | mermaid-check | mermaid-visual | 证据（各 spec 同构） |
|---|---|---|---|---|
| 创建即入队（POST 2xx 后 push） | ✅ | ✅ | ✅ | `:30-33`：非 [200,201] throw 在前，push 在后——失败不污染队列 |
| afterEach 无条件 splice 删除 | ✅ | ✅ | ✅ | `:16-23`：钩子内执行，断言失败路径天然覆盖 |
| [200,204,404] 容忍 | ✅ | ✅ | ✅ | `:19` |
| 其余状态码 throw → 用例 FAIL | ✅ | ✅ | ✅ | `:20-21` |
| 队列只存 slug（无 token 字段） | ✅ | ✅ | ✅ | `:14` `string[]` |
| request fixture 解耦（visual） | — | — | ✅ | 清理用 Playwright request（`:16-23`），断言用自起 browser page（`:51-53`），零共享状态 |

- mermaid-visual 的解耦正确性：3 个 test 签名只解构 `{ request }`（`:41/:79/:111`），自起 browser 实例仅用于 page 断言，afterEach 清理不依赖自起实例存活——即使断言失败导致 browser 未显式 close，清理仍可执行。
- 唯一语义张力为 F2（throw 中止其余条目，§4.3），已判级非阻塞并给出 P7 对齐建议。

## 8. 焦点 6：AI Slop/文档质量（M4 文档面）

- 4 条规则全部为**可执行规则**而非口号：规则 1 给出具体反例路径与 NotFoundView 机制、规则 2 给出容忍语义与入队条件、规则 3 给出触发条件（POST/DELETE `/api/v1/entries`）与执行形态（beforeAll fail-fast）、规则 4 给出配对矩阵（匿名/登录两行）与结构性杜绝手段。无「Unlock/Get started」类泛化文案，无空话。
- 规则 1 的 goto 模板 `` page.goto(`${BASE_URL}/${slug}`) `` 与 3 spec 实际写法一致（BDD-8 正向判据 7 处命中可互证）；规则 3 与 3 spec 护栏实现逐字对应；规则 4 与 R2 实现对应——规范文本与代码实现零漂移。

```text
[QUALITY] 规则 2 末句「确定性 slug 加 e2e- 前缀，避免与 seed-data 条目冲突」为 M4 清单外增补
  文件：docs/process/debug-workflow.md:250
  问题：P2 §1.1 M4 规则 2 原文止于「404 视为已删除」；e2e- 前缀句为 implementer 增补。
  判级：非阻塞（正向增补）。内容与 P2 §2.4「e2e- 前缀与 seed 24 条零交集」定稿完全
        一致，且提升规则可执行性；属 M4 意图内沉淀，不构成范围外改动。
  Fix ：无需修复；P7 一致性检查时如核对「M4 清单逐字一致」，应将此句登记为已知增补。
```

## 9. 发现汇总与判级

| # | 类别 | 定位 | 判级 |
|---|---|---|---|
| F1 | [QUALITY] M4 规则 2 增补句 | docs/process/debug-workflow.md:250 | 非阻塞（正向增补，P7 登记） |
| F2 | [CONFORMANCE] 清理 throw 中止其余条目 vs P3 §4.1.3 字面 | mermaid.spec.ts:17-22 等 3 处 | 非阻塞（与 teams-page 先例一致，P7 对齐口径） |
| F3 | [QUALITY] 预删 catch 吞网络错误 | mermaid.spec.ts:26 等 3 处 | 非阻塞（承袭 t049，R3 未破坏） |
| F4 | [QUALITY] 自起 browser.close 无 finally | mermaid-visual.spec.ts:51-77 等 3 处 | 非阻塞（既有形态，P2 §2.3 定稿保留） |
| F5 | [QUALITY] P4-implementation.md 自查表「mermaid.spec 13 处」为三 test 合计语义 | P4-implementation.md:77 | 非阻塞（文档表述精度，代码无偏差） |

无 BLOCKER：方案对账无缺失行、认证配对结构性成立、清理钩子四件套齐备、静态判据亲跑全过、范围零外溢。

## 10. 结论

- **status: approved**——6 项评审焦点全部通过；5 条发现均为非阻塞（1 条 P7 口径对齐建议、3 条后续改进候选、1 条文档登记项），不构成 P4 返工条件。
- 运行级确认（E2E 三键实跑、BDD-2 残留审计、BDD-12 对照）归 P5/P6，本评审静态与收集级证据不足以预判其结果。

[PROD_NOT_TOUCHED] 评审全程未启动/停止任何服务，未操作 :8080 与 `~/.peekview/`，未跑完整 E2E 套件；仅 git diff/read/grep、`npx playwright test --list`（只收集不执行）、`make test-frontend`（vitest 单测）与 check-maintainability.py（violations 为空）。
