---
phase: P3
task_id: TPV0096
parent: P2-design.md
trace_id: TPV0096-P3-20260907
status: draft
test_code_dir: frontend-v3/e2e
---
# P3 测试用例设计 — TPV0096 E2E 红灯 spec 自建 entry 化

> 上游：P1-requirements.md（BDD-1~13，唯一验收源）/ P2-design.md（M1-M3 逐行改动表 + §2 定稿 + §6 gate_commands）/ P2-review.md（§1 实证锚点，approved）。
> 本任务特殊性：**测试代码即 P4 实现对象**（改造后的 3 个 spec）——P3 只做用例设计落盘，不写 spec 代码；本文「改造后 test 结构」即 P4 implementer 的实现规格。

## 1. test_code_dir 声明

test_code_dir = `frontend-v3/e2e`（以 frontmatter 字段为准）。

- P4 改造产物落点：`frontend-v3/e2e/mermaid.spec.ts`、`frontend-v3/e2e/mermaid-check.spec.ts`、`frontend-v3/e2e/mermaid-visual.spec.ts`（全为既有文件改造，无新增测试文件）。
- P3 不新建目录、不写任何 spec 代码；红灯确认由主 Agent 亲自执行（见 §5）。
- 不抽共享 helper 模块：三件套（护栏/fixture/清理）逐 spec 内联（P2 §2.1，e2e 目录无共享 helper 先例）。

## 2. 改造后 test 结构总览（P4 实现对象）

设计约束：断言阈值全部原样保留（容器 >200px、svg >100px、modal >500px）；等待策略不改（`waitForTimeout(3000/4000/5000)` 原样，P1 §2.5）；每个 test 独立 fixture entry（同 spec 内 test 互不依赖）；内容定稿按 P2 §2.2（`diagram.md`，单 mermaid flowchart 代码块 4-6 节点，显式 `is_public: true`）。

### 2.1 mermaid.spec.ts（M1，75 行 → 预计 ~140 行）

结构：`test.beforeAll` 护栏（BASE_URL 含 `:8080`/`prod` → throw + `/health` 探活，teams-page L20-26 范式）→ 每 test 内 fixture 创建（预删→POST→入队）→ goto `` `${BASE_URL}/${slug}` `` → networkidle + waitForTimeout(3000) → 断言 → `test.afterEach` 清理队列。

| TC | 改造后 test 标题 | fixture slug | 核心断言 | BDD | 关联 M 行 |
|---|---|---|---|---|---|
| TC-01 | `SVG fills container properly [BDD-10]` | `e2e-mermaid-svg-<project>` | `.diagram-viewer` toBeVisible；containerBox.height > 200；svg toBeVisible；svgBox.height > 100（全部无条件执行） | 1/4/8/10 | M1 goto 行 + L13/L35 选择器迁移行 |
| TC-02 | `Code/Diagram toggle works [BDD-11]` | `e2e-mermaid-toggle-<project>` | toggle 后 `.diagram-code` toBeVisible + `.diagram-viewer` toBeHidden；切回后 svg toBeVisible + height > 100 | 1/4/8/11 | M1 L35 选择器迁移行 |
| TC-03 | `Fullscreen fills window [BDD-11]` | `e2e-mermaid-fullscreen-<project>` | `.diagram-action-btn.fullscreen-btn` click → `.diagram-modal` toBeVisible + height > 500 + modal 内 svg 可见；Esc 关闭 | 1/4/8/11 | M1 L57/L61 选择器迁移行 |

### 2.2 mermaid-check.spec.ts（M2，27 行 → 预计 ~70 行）

结构：`test.beforeAll` 护栏 + `BASE_URL` const 提取（替换 L4 硬编码）→ test 内 fixture 创建 → goto → waitForTimeout(5000)（原样）→ 断言 → `test.afterEach` 清理队列。

| TC | 改造后 test 标题 | fixture slug | 核心断言 | BDD | 关联 M 行 |
|---|---|---|---|---|---|
| TC-04 | `mermaid rendered and visible [BDD-10]` | `e2e-mermaid-check-main-<project>` | `.diagram-block` count > 0（无条件先行，L14 既有）；`.diagram-viewer` height > 200 + svg height > 100（**移除 L16-26 `if (count > 0)` 包裹**，断言无条件执行） | 1/2/4/6/8/10 | M2 goto 行 + L16-26 移除行 |

### 2.3 mermaid-visual.spec.ts（M3，101 行 → 预计 ~170 行）

结构：`test.beforeAll` 护栏 → 每 test 内 fixture 创建 → goto → 自起 `chromium.launch({ headless: true })` + viewport 1280x800（**保留不动**，P2 §2.3 定稿）→ 断言 → `test.afterEach` 清理队列（清理经 Playwright `request` fixture，与自起浏览器解耦）。

| TC | 改造后 test 标题 | fixture slug | 核心断言 | BDD | 关联 M 行 |
|---|---|---|---|---|---|
| TC-05 | `check mermaid container height [BDD-10]` | `e2e-mermaid-visual-height-<project>` | `.diagram-viewer` toBeVisible（**无条件**，替换 L20-41 `isVisible().catch(() => false)` + 双层 if）+ box.height > 200 + svg toBeVisible（**无条件**）+ svgBox.height > 100 | 1/4/6/8/10 | M3 test1 拆除行 |
| TC-06 | `check toggle functionality [BDD-11]` | `e2e-mermaid-visual-toggle-<project>` | toggle 往返后 `await expect(svg).toBeVisible()`（**无条件**，替换 L69-71 条件断言；svg 定位改 `.diagram-viewer svg`） | 1/4/6/7/8/11 | M3 test2 行 |
| TC-07 | `check fullscreen [BDD-11]` | `e2e-mermaid-visual-fullscreen-<project>` | `.diagram-action-btn.fullscreen-btn` click → `.diagram-modal` toBeVisible（**无条件**，替换 L93-97 条件断言）+ height > 500 | 1/4/6/7/8/11 | M3 test3 行 |

### 2.4 fixture slug 枚举（14 slug 上限定稿，P2 §2.4）

projectKey 派生（spec 内联一行）：`test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'`。

| spec | case | slug（×2 project） | 数量 |
|---|---|---|---|
| mermaid.spec.ts | svg / toggle / fullscreen | `e2e-mermaid-svg-{chromium,mobile}`、`e2e-mermaid-toggle-{chromium,mobile}`、`e2e-mermaid-fullscreen-{chromium,mobile}` | 6 |
| mermaid-check.spec.ts | main | `e2e-mermaid-check-main-{chromium,mobile}` | 2 |
| mermaid-visual.spec.ts | height / toggle / fullscreen | `e2e-mermaid-visual-height-{chromium,mobile}`、`e2e-mermaid-visual-toggle-{chromium,mobile}`、`e2e-mermaid-visual-fullscreen-{chromium,mobile}` | 6 |

写死于各 test 内（拒绝 Date.now / workerIndex——BDD-2 可枚举性 + BDD-3 重跑确定性）；`e2e-` 前缀与 seed-data 24 条零交集（P2-review §1 实证）。

## 3. 13 BDD 1:1 用例映射表

> 1:1 不挑验：BDD-1~11 由运行用例承载（TC-01~07），BDD-6/7/8 由命令级静态判据承载（§6），BDD-2/3/4/5/12/13 由机制 + 验收动作承载（A-01~A-07）。执行环境统一为干净 debug 环境（P1 §3 判据头部；运行级动作遵循 P2 §5 平台自包含执行模式）。

| BDD | 承载用例 / 动作 | 断言·判据要点 | 清理钩子 | 关联 M 行 | 执行归属 |
|---|---|---|---|---|---|
| BDD-1 | TC-01~07 全量运行 | 3 spec 依次运行 exit 0，failed=0 skipped=0（chromium + Mobile Chrome 两 project） | afterEach 队列（§4） | M1/M2/M3 fixture + 护栏行 | P5 gate（P5_e2e 三键）+ P6 实跑 |
| BDD-2 | A-01：清理钩子 + DB 审计 | 运行后 14 slug 逐条 `sqlite3` count=0 | 创建成功才入队；afterEach 无条件删除 | M1/M2/M3 清理行 | P6 只读查询 |
| BDD-3 | A-02：预删防御 + 重跑 | 确定性 slug + 预删 404 容忍（t049 先例）；连跑 2 次 exit 0 且残留仍 0 | 预删为钩子前置步骤 | M1/M2/M3 fixture 行 + §2.4 | P6 重跑实跑 |
| BDD-4 | A-03：slug 命名空间审查 | `e2e-` 前缀与 seed 24 条零交集；抽验 ≥3 条 seed slug GET 200 | 不适用（只读抽验） | M1/M2/M3 slug 列 + §2.4 | P6 grep + HTTP 抽验 |
| BDD-5 | A-04：容忍集行为审查 | `[200,204,404]` 容忍（404=已删除）；其余状态码 throw → 该用例 FAIL | 本身即钩子规范（§4） | M1/M2/M3 清理行 | P6 静态审查 + code review 对照 teams-page L35-45 |
| BDD-6 | §6.1 命令级判据 | `if (…Visible` / `.catch(() => false)` / `if (count` 三模式命中 0 处 | 不适用（静态检查） | M2 L16-26 移除行 + M3 L20-41/69-71/93-97 拆除行 | P6（P7 可复用） |
| BDD-7 | §6.2 命令级判据 | 死类名 3 spec 命中 0 处；存活选择器 spec 与 src 双向正向对照命中 ≥1 | 不适用（静态检查） | M1 4 处 + M3 3 处迁移行 | P6（P7 可复用） |
| BDD-8 | §6.3 命令级判据 | `/entries/` 3 spec 命中 0 处；`` goto `${BASE_URL}/{slug}` `` 每 spec ≥1 处；「到达渲染视图」由 BDD-10 运行断言兜底（NotFoundView 无 `.diagram-block`） | 不适用（静态检查） | M1 goto 行 + M2 L4 行 + M3 L12/51/81 行 | P6 命令级 + 运行兜底 |
| BDD-9 | A-05：双 project 口径运行 | 不指定 `--project`；chromium 与 Mobile Chrome 分组统计各 0 failed；mermaid-visual 自起 chromium 在两 project 各执行一遍、两遍均计入 PASS | afterEach 队列（§4.4） | M3 自起保留行（§2.3） | P5 gate 三键 + P6 实跑 |
| BDD-10 | TC-01 / TC-04 / TC-05 | `.diagram-viewer` 可见 + 容器 >200 + svg 可见 + svg >100（无条件，不引入像素级对比） | afterEach 队列 | M1 test1 + M2 断言行 + M3 test1 | P5/P6 运行 + 截图证据 |
| BDD-11 | TC-02 / TC-03 / TC-06 / TC-07 | toggle：code 可见 + diagram 隐藏 + 切回 svg 恢复；fullscreen：modal 可见 + height > 500（1280x800 自起视口内） | afterEach 队列 | M1 test2/3 + M3 test2/3 | P5/P6 运行 + 截图证据 |
| BDD-12 | A-06：基线对照 | svg-inline-render（dsh-architecture 1 用例）+ render-regression t085 用例改造前后结果一致；既有 flaky bdd_4↔5 互换不计新失败 | 不适用（不触碰 2 spec） | §1.2「不改」行 | 基线记录 P4 合入前（主 Agent）；对照 P5/P6（详见 §7.2） |
| BDD-13 | A-07：文档核对 | `docs/process/debug-workflow.md` 存在「E2E 编写规范」节 + 两条规则文本（§6.4 判据） | 不适用（文档类用例，无资源创建） | M4 | P6 grep + 内容核对；P7 一致性交叉 |

## 4. 清理钩子要求（逐 spec 标注，P3 卡强制节）

### 4.1 通用四件套（P2 §2.1 定稿，三 spec 同构内联）

1. **护栏**（beforeAll）：BASE_URL 含 `:8080`/`prod` → throw；`/health` 探活。
2. **fixture helper** `ensureEntry(request, slug, files)`：防御性预删（匿名 DELETE，404 容忍）→ 匿名 POST（非 201/200 直接 throw，不吞错——R3）→ **创建成功才入队**。
3. **清理队列**（afterEach）：`createdEntries.splice(0)` **先取走队列**再逐条匿名 DELETE——单条失败不中止其余条目清理；`[200, 204, 404]` 容忍（404 = 已删除容忍场景），**其余状态码 throw → 该用例显式 FAIL**（不静默吞掉清理失败）。队列只存 slug（无 token 字段，匿名同上下文配对——R2 结构性杜绝混用）。
4. **断言迁移**：按 §2 各 TC 无条件执行。

「afterEach 无条件删除」语义：清理在钩子内执行，任何断言失败路径天然覆盖（Playwright afterEach 钩子语义；teams-page 注释范式）。环境残留由清理钩子与 post-test 残留检查共同兜底（BDD-2，见 P6 卡）。

### 4.2 逐 spec 清理钩子归属表

| spec | 创建型用例（创建即入队点） | afterEach 归属 | 容忍集 | 失败显式 FAIL |
|---|---|---|---|---|
| mermaid.spec.ts | TC-01/02/03 各自 `ensureEntry(e2e-mermaid-{svg,toggle,fullscreen}-<project>)` | `test.afterEach`：splice(0) 逐条匿名 DELETE | `[200, 204, 404]` | 其余状态码 throw → 用例 FAIL |
| mermaid-check.spec.ts | TC-04 `ensureEntry(e2e-mermaid-check-main-<project>)` | 同上（同构内联） | `[200, 204, 404]` | 其余状态码 throw → 用例 FAIL |
| mermaid-visual.spec.ts | TC-05/06/07 各自 `ensureEntry(e2e-mermaid-visual-{height,toggle,fullscreen}-<project>)`；清理经 Playwright `request` fixture（与自起浏览器解耦） | `test.afterEach`：splice(0) 逐条匿名 DELETE | `[200, 204, 404]` | 其余状态码 throw → 用例 FAIL |

机械辅助判据（P6 可与 §6 合并执行，判定均为每 spec 命中 ≥1 处）：

```bash
grep -cF 'splice' frontend-v3/e2e/mermaid.spec.ts frontend-v3/e2e/mermaid-check.spec.ts frontend-v3/e2e/mermaid-visual.spec.ts
grep -nE '204' frontend-v3/e2e/mermaid.spec.ts frontend-v3/e2e/mermaid-check.spec.ts frontend-v3/e2e/mermaid-visual.spec.ts
```

## 5. 红灯基线

- **红灯命令** = `gate_commands.P3` = `E2E_SPEC=e2e/mermaid.spec.ts make debug-test`（P2 §6；主 Agent 亲自执行 check-tdd-red.py，`AGATE_TDD_TIMEOUT=600`，P2-review S-1）。
- **执行形态**：跑在**改造前代码**上（现状 spec 原样），按 P2 §5 平台自包含模式单次 bash 内完成 `make debug-start` + `make debug-seed` + 红灯命令 + `make debug-stop`（失败分支 `…; rc=$?; make debug-stop; exit $rc`）。
- **预期红灯形态**（三类红灯源，均为 fixture/404/断言失败类 B 类错误）：
  1. fixture 404 类：goto `test-mermaid-2` → seed 中不存在 → NotFoundView → beforeEach 内失败/断言 0 元素 FAIL；
  2. 死选择器类：`.mermaid-content[data-mode=…]` / `.mermaid-action-btn[…]` 匹配 0 元素 → toBeVisible 断言超时 FAIL（TC-01~03 对应的 test1/test3 即使 entry 存在也红灯）；
  3. 死路由类：goto `/entries/test-mermaid-2` 落入 `/:pathMatch(.*)*` → NotFoundView。
- **判定口径**：check-tdd-red.py exit 0 = 真红灯（推进 P4）；exit 1 = 假红灯（SyntaxError / 第三方 import = A 类，测试代码自身错误）→ 诊断重试；exit 2 = 绿了（违反 TDD）；exit 3 = 无测试运行器。
- **真红灯不含**：SyntaxError、第三方 import 失败、护栏误触生产（护栏在改造前代码上无 fixture 路径，不会触发）。

> **[P3-RED-BASELINE: 已回填 — 主 Agent 2026-09-07]**
>
> - check-tdd-red.py 结果：**exit code = 0（真红灯）**，分类输出 `TDD_CHECK: red-light (unexpected test failure)`（exit-code-only 模式，未声明 P3_formatter）。
> - 红灯摘要：改造前 mermaid.spec.ts 在干净 debug 环境红灯，机制核验 = `/tmp/peekview-debug.log` 中测试导航 `/entries/test-mermaid-2` 触发 **NotFoundView 资源加载**（死路由 + 死 entry 的 B 类 fixture 红灯，非 SyntaxError/第三方 import 的 A 类）；P1 §2 预判三类红灯源成立。（failed 计数未保留：check-tdd-red 内部消费命令输出，exit-code-only 模式不下发明细。）
> - 执行时间戳与环境：2026-09-07（本会话）；BASE_URL http://127.0.0.1:8888（宿主服务在线，主 Agent bash 直连宿主网络）；`AGATE_TDD_TIMEOUT=600`；完成后 `make debug-stop` 还原（/tmp/peekview-debug/ 已清理确认）。
> - **BDD-12 基线记录（同链顺带执行，3 轮采样）**：
>   - `E2E_SPEC=e2e/svg-inline-render.spec.ts make debug-test`：**exit 0，2 passed（3.1s），0 failed** —— 基线全绿。
>   - `E2E_SPEC=e2e/render-regression.spec.ts make debug-test`：3 轮均 **exit 2**；failed/flaky/passed = 4/2/16（首轮·干净 DB）→ 5/3/14（次轮）→ 6/1/15（三轮）。
>   - 失败家族并集（title 级，双 project）：`test_bdd_4_source_view_scroll_to_bottom`、`test_bdd_5_fallback_source_scroll_to_bottom`、`test_bdd_7_mobile_markdown_padding_16px`、`test_bdd_8_bottom_scroll_no_jitter`、`test_bdd_3*real-click-per-page-select`（Mobile）。逐轮波动为既有 flaky（P1 §5「bdd_4↔5 互换」的扩展实证：bdd_7/bdd_8 同属该家族）。
>   - **污染警示（DEBT0008 实证）**：render-regression 的 t085-* 条目无清理钩子，跨轮累积（第 3 轮 seed 输出 Total entries: 187）——次轮/三轮失败数抬升与 DB 污染相关。**P5/P6 判定口径：仅以干净 debug 环境（fresh start+seed）的重跑结果对照基线**；任何不在上述并集内的新失败 = 回归，并集内 flaky 互换不计。
>   - 基线日志（主 Agent 会话内 /tmp，未入库）：bdd12-svg-baseline.log / bdd12-rr-baseline.log / bdd12-rr-baseline3.log；关键数据已完整转录于本节。

## 6. BDD-6/7/8 静态检查机械判据（命令级，P6 直接执行）

> 对象：改造后的 3 spec 文件。判定约定：负向判据「命令无输出（grep exit 1）= PASS」；正向判据「命中行数满足标注 = PASS」。命令均在 repo 根目录执行。

### 6.1 BDD-6：断言无条件执行（负向三模式 + 正向对照）

```bash
# 负向①：条件包裹 isVisible 类（if (isVisible) / if (svgVisible) / if (modalVisible) 等）——合计命中 0 处
grep -nE 'if \([A-Za-z]*[Vv]isible' frontend-v3/e2e/mermaid.spec.ts frontend-v3/e2e/mermaid-check.spec.ts frontend-v3/e2e/mermaid-visual.spec.ts

# 负向②：isVisible().catch(() => false) 静默假绿模式——合计命中 0 处
grep -nF '.catch(() => false)' frontend-v3/e2e/mermaid.spec.ts frontend-v3/e2e/mermaid-check.spec.ts frontend-v3/e2e/mermaid-visual.spec.ts

# 负向③：M2 移除的 if (count > 0) fail-safe 包裹——命中 0 处
grep -nF 'if (count' frontend-v3/e2e/mermaid.spec.ts frontend-v3/e2e/mermaid-check.spec.ts frontend-v3/e2e/mermaid-visual.spec.ts
```

正向对照（证明断言仍在且无条件）：三 spec 合计 `expect(` 计数不减少——改造前基线（实测 `grep -c 'expect('`）= 21 处：mermaid.spec.ts 13 + mermaid-check.spec.ts 3 + mermaid-visual.spec.ts 5；改造后逐文件计数 ≥ 基线值。

### 6.2 BDD-7：死选择器清零（负向清零 + 双向正向对照）

```bash
# 负向：死类名（.mermaid-content / .mermaid-action-btn / .diagram-modal-overlay）——合计命中 0 处
grep -nE '\.mermaid-content|\.mermaid-action-btn|\.diagram-modal-overlay' frontend-v3/e2e/mermaid.spec.ts frontend-v3/e2e/mermaid-check.spec.ts frontend-v3/e2e/mermaid-visual.spec.ts

# 正向①：spec 侧存活选择器——mermaid.spec 与 mermaid-visual.spec 各命中 ≥1 处
grep -nE '\.diagram-viewer|\.diagram-code|\.diagram-action-btn|\.diagram-modal' frontend-v3/e2e/mermaid.spec.ts frontend-v3/e2e/mermaid-visual.spec.ts

# 正向②：src 侧存活对照（选择器类名在组件 DOM 实存；P2-review §1 锚点）——各命中 ≥1 处
grep -n 'diagram-viewer' frontend-v3/src/components/DiagramBlock.vue
grep -n 'fullscreen-btn' frontend-v3/src/components/DiagramBlock.vue
grep -n 'diagram-modal' frontend-v3/src/components/renderers/MermaidRenderer.vue
```

辅助正向对照（构建产物，P1 BDD-7 允许）：`grep -rl 'diagram-viewer' backend/peekview/static/assets/` 命中 ≥1 文件（构建产物含改动后前端时）。

### 6.3 BDD-8：goto 全部 `/:slug`（负向清零 + 正向对照）

```bash
# 负向：/entries/ 死路由路径——合计命中 0 处
grep -nF '/entries/' frontend-v3/e2e/mermaid.spec.ts frontend-v3/e2e/mermaid-check.spec.ts frontend-v3/e2e/mermaid-visual.spec.ts

# 正向：goto 均为 ${BASE_URL}/<slug> 形式——每 spec 命中 ≥1 处
grep -nE 'goto\(`\$\{BASE_URL\}/' frontend-v3/e2e/mermaid.spec.ts frontend-v3/e2e/mermaid-check.spec.ts frontend-v3/e2e/mermaid-visual.spec.ts
```

「能到达渲染视图（非 NotFoundView）」为运行时语义，由 BDD-10 的 `.diagram-block`/`.diagram-viewer` 运行断言兜底（NotFoundView 下二者均匹配 0）。

### 6.4 BDD-13 附带判据（A-07 文档核对，M4 落点）

```bash
grep -n 'E2E 编写规范' docs/process/debug-workflow.md        # ≥1：新节存在
grep -nF '/entries/:slug' docs/process/debug-workflow.md     # ≥1：规则 1 文本
grep -n 'afterEach 清理队列' docs/process/debug-workflow.md  # ≥1：规则 2 文本
```

## 7. BDD-9 / BDD-12 / BDD-13 验收动作归属

### 7.1 BDD-9 双 project 口径 → P5 gate + P6 实跑

- **P5**：`P5_e2e` / `P5_e2e_b` / `P5_e2e_c` 三键（各 900s，P2 §6），键命令不含 `--project`，天然覆盖双 project；退出码 0 = 两 project 全 PASS（failed=0 skipped=0 以 playwright 汇总为准）。
- **P6**：逐 spec 自包含链实跑并留存输出证据；按 project 分组统计 chromium 与 Mobile Chrome 各 0 failed。
- **mermaid-visual 双遍口径**（P1 BDD-9 原文）：测试体内自起 chromium 的 3 个 test 在两个 project 下各执行一遍（3×2=6 次执行），两遍均计入 PASS 统计——自起实例 viewport 1280x800 与 project viewport（393x851）解耦（P2 §2.3/R8）。

### 7.2 BDD-12 基线对照 → 基线记录窗口 P4 合入前（主 Agent），对照执行 P5/P6

- **基线记录（P4 合入前，唯一窗口）**：主 Agent 在 P3 红灯确认运行（或单独一次自包含链）中先跑 `E2E_SPEC=e2e/svg-inline-render.spec.ts make debug-test` 与 `E2E_SPEC=e2e/render-regression.spec.ts make debug-test`，记录各用例 PASS/FAIL 清单（含既有失败）为基线（svg-inline-render 现状 1 个用例 `dsh-architecture`，依赖 seed entry `dsh-architecture`、无 t085；t085 用例在 render-regression 内——grep 实证 svg-inline-render.spec.ts 中 `t085` 命中 0）。改造合入后无法再取得「改造前」结果，故窗口硬性在 P4 之前。
- **对照执行（P5/P6）**：改造合入后重跑同两 spec，与基线逐用例对照：不出现基线中不存在的新失败；render-regression 既有 flaky bdd_4↔5 互换不计入新失败（P1 BDD-12 原文口径）。
- **范围边界**：两 spec 本任务零改动（P2 §1.2「不改」行）；对照结果记录进 P6 验收证据。

### 7.3 BDD-13 E2E 编写规范落盘 → P6 文档核对 + P7 一致性交叉

- **用例性质**：文档类用例（M4），无运行时断言、无资源创建 → 清理钩子不适用；对应验收动作 = 文档存在性 + 两条规则内容核对（§6.4 机械判据先行，语义核对补充）。
- **P6 动作**：§6.4 三条 grep 判据执行 + 打开 `docs/process/debug-workflow.md`「E2E 编写规范」节核对：规则 1（页面路由 `/:slug` 而非 `/entries/:slug`，API 与页面路由区分）与规则 2（spec 依赖的 entry 必须存在于 seed-data/ 或测试内自建且带 afterEach 清理队列）两条文本齐备（M4 前 2 条即 BDD-13 判据；第 3/4 条为任务沉淀，不属 BDD-13 判据但应同节存在）。
- **P7 交叉**：规范文本与 3 spec 实际改造一致（清理队列模式、`/:slug` 写法、护栏）属 P7 一致性检查范围。

## 8. 与 P2 改动表对账说明

- §2 各 TC 的「关联 M 行」列即用例 ↔ M1-M3 逐行改动表的对账关系：M1 每行至少被 TC-01~03 之一引用，M2 每行被 TC-04 引用，M3 每行被 TC-05~07 之一引用；M4 由 A-07 引用。无游离改动行，无未映射 BDD。
- §6 判据与 P2 §2.5「实现完成的标志」静态检查三条一一对应（BDD-6/7/8），并扩展 BDD-13 文档判据与 §4 清理钩子辅助判据；P2 §2.5 其余三条（运行退出码 / slug 残留 count=0 / test-frontend+typecheck）分别由 BDD-1（A-05 归属）、BDD-2（A-01）、P5 gate 通用基线承接。
- 本文档为用例设计，不含任何 spec 代码；红灯结果引用位（§5）由主 Agent 回填，不阻塞本文档落盘。
