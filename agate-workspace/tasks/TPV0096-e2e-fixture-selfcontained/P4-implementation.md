---
phase: P4
task_id: TPV0096
task_name: e2e-fixture-selfcontained
parent: P2-design.md
trace_id: TPV0096-P4-20260907
agent: implementer
status: draft
created: '2026-09-08'
implementation_dir: frontend-v3/e2e
---

# P4 实现记录 — TPV0096 E2E 红灯 spec 自建 entry 化

`implementation_dir: frontend-v3/e2e`（docs 改动文件 `docs/process/debug-workflow.md` 为 P2 packages 声明的 docs 包落点）

改动范围 = P2 §1.1 封闭清单 4 文件，零外溢（未动 src/backend/config/其余 spec）。

## 逐文件改动说明（与 P2 §1.1 M 表逐行对账）

### M1 `frontend-v3/e2e/mermaid.spec.ts`（75 行 → 141 行，全文件重写）

- 护栏：新增 `test.beforeAll`——BASE_URL 含 `:8080`/`prod` throw + `/health` 探活（teams-page L20-26 范式）。
- fixture：新增 `ensureEntry(request, slug, files)`（防御性预删匿名 DELETE 404 容忍 → 匿名 POST 非 201/200 throw 不吞错 → push 入队）；3 个 test 各自创建 `e2e-mermaid-{svg,toggle,fullscreen}-<project>` entry，`diagram.md` 内嵌 4-6 节点 mermaid flowchart 代码块、显式 `is_public: true`。
- goto 迁移：`/entries/test-mermaid-2` → `` `${BASE_URL}/${slug}` ``（render-regression gotoEntry 写法）。
- 选择器迁移：`.mermaid-content[data-mode="diagram"]` → `.diagram-viewer`；`[data-mode="code"]` → `.diagram-code`；`.mermaid-action-btn[title="Fullscreen"]` → `.diagram-action-btn.fullscreen-btn`；`.diagram-modal-overlay` → `.diagram-modal`（Teleport 至 body，page 级定位不变）。
- 清理：新增 `createdEntries: string[]`（只存 slug，无 token 字段）+ `test.afterEach` splice(0) 逐条匿名 DELETE，`[200,204,404]` 容忍、其余 throw。
- 保留：networkidle + waitForTimeout(3000) 等待策略、toggle/svg/modal 阈值断言（>200/>100/>500）与截图路径原样。

### M2 `frontend-v3/e2e/mermaid-check.spec.ts`（27 行 → 62 行）

- URL 硬编码 `http://127.0.0.1:8888/entries/playwright-test` → `BASE_URL` const + fixture `e2e-mermaid-check-main-<project>` + `` goto `${BASE_URL}/${slug}` ``。
- 新增同构护栏 + afterEach 清理队列（四件套逐 spec 内联）。
- 移除 L16-26 `if (count > 0)` 包裹：`.diagram-viewer` height >200 + svg height >100 断言无条件执行（`expect(count).toBeGreaterThan(0)` 无条件先行保留）。
- 保留：waitForTimeout(5000)、截图与 console.log 诊断输出。

### M3 `frontend-v3/e2e/mermaid-visual.spec.ts`（101 行 → 140 行）

- `BASE_URL` 硬编码 → `process.env.BASE_URL || 'http://127.0.0.1:8888'` const（与 M1/M2 一致）。
- goto `/entries/e2e-test` ×3 → fixture `e2e-mermaid-visual-{height,toggle,fullscreen}-<project>` + `` `${BASE_URL}/${slug}` ``。
- test1 假绿拆除：`isVisible().catch(() => false)` + 双层 `if` → `await expect(diagram).toBeVisible()` + box >200 + `await expect(svg).toBeVisible()` + svgBox >100 全部无条件。
- test2：`expect(svgVisible).toBe(true)` → `await expect(svg).toBeVisible()`；svg 定位 `.mermaid-content[data-mode="diagram"] svg` → `.diagram-viewer svg`。
- test3：死选择器 → `.diagram-action-btn.fullscreen-btn` + `.diagram-modal`；`isVisible().catch` 条件断言 → `await expect(modal).toBeVisible()` + height >500 无条件。
- 自起 `chromium.launch({ headless: true })` + viewport 1280x800 结构保留不动（P2 §2.3 定稿）；waitForTimeout(4000/3000/1500/500/1000) 原样。
- 清理经 Playwright `request` fixture（afterEach），与自起浏览器实例解耦。

### M4 `docs/process/debug-workflow.md`（新增「E2E 编写规范」节）

- 插入点：「调试检查清单」之后、「常见问题」之前（原 L243/L245 之间）。
- 4 条规则按 P2 §1.1 M4 清单写全：① 页面路由 `/:slug` 非 `/entries/:slug`（含 NotFoundView 机制说明）；② entry 必须存在于 seed-data/ 或测试内自建且带 afterEach 清理队列（创建成功才入队；清理失败显式 FAIL，404 视为已删除）；③ 直写 DB 的 spec 必须 BASE_URL 防生产护栏（beforeAll fail-fast + /health 探活）；④ fixture 创建与删除同认证上下文（清理队列只存 slug 杜绝混用）。

## 四件套范式与铁律落实（P3 §4 对账）

- 护栏/ensureEntry/afterEach 清理队列三件套逐 spec 内联（不抽共享模块，P2 §2.1）；三 spec 结构同构。
- 创建即注册：`createdEntries.push(slug)` 仅在 POST 2xx 后执行；afterEach 无条件清理（Playwright 钩子语义，断言失败路径天然覆盖）。
- 清理容忍集 `[200, 204, 404]`，其余状态码 throw → 用例显式 FAIL。
- 认证配对铁律（R2）：创建/预删/清理全程不带 Authorization 头，队列结构上无 token 字段（grep 验证 0 命中，见自查）。
- slug 显式枚举：7 case × 2 project = 14 slug 上限，写死于各 test 内（projectKey = `test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'`），无 Date.now/workerIndex。

## 新增文件核对表

未采用骨架/CODE-MAP 机制（`P2-skeleton.md` 与 `agents/CODE-MAP.md` 均不存在）→ 本节按 P4 卡省略；且本次 4 个文件全为既有文件改造，无新增文件。

## 自查结果（自查 ≠ P5 gate）

### make test-frontend（P2 gate_commands.P5）

- 退出码 **0**；110 test files 全绿：1343 passed / 4 skipped / 0 failed（只改 e2e/ 与 docs/，vitest 单测无回归）。

### 静态判据（P3 §6 命令级 grep 自查）

| 判据 | 命令要点 | 结果 |
|---|---|---|
| BDD-6 负向①②③ | `if (…Visible` / `.catch(() => false)` / `if (count` | 三 spec 合计 **0 命中**（grep rc=1） |
| BDD-6 正向 | `grep -c 'expect('`（基线 13/3/5） | **13 / 3 / 7**（≥基线） |
| BDD-7 负向 | `.mermaid-content` / `.mermaid-action-btn` / `.diagram-modal-overlay` | **0 命中** |
| BDD-7 正向① | spec 侧存活选择器 | mermaid.spec **5** 处 / mermaid-visual.spec **4** 处 |
| BDD-7 正向② | src 侧对照 | DiagramBlock.vue `diagram-viewer`/`fullscreen-btn`、MermaidRenderer.vue `diagram-modal` 均 ≥1 |
| BDD-8 负向 | `/entries/` | **0 命中** |
| BDD-8 正向 | `` goto(`\${BASE_URL}/` `` | 每 spec ≥1（7 处合计，全为 `/${slug}` 形式） |
| slug 枚举 | `e2e-mermaid[a-z-]*` 去重 | **7 个 case 模式** × 2 project = 14 slug 上限 |
| 清理钩子辅助 | `splice` / `204` / `is_public: true` | 每 spec 各 ≥1 |
| R2 认证铁律 | `Authorization` / `Bearer` / `token` | **0 命中** |
| BDD-13 文档 | `E2E 编写规范` / `/entries/:slug` / `afterEach 清理队列` | 3 条全命中 |

### 语法/收集级验证

- `npx playwright test e2e/mermaid*.spec.ts --list`（frontend-v3 下）：**14 tests in 3 files**（chromium + Mobile Chrome 各 7），无解析/收集错误。

### E2E 实跑

- 归 P5/P6（P2 gate_commands 三键 `E2E_SPEC=… make debug-test`）；本沙箱 bash 为单调用自包含约束，P4 未跑实跑冒烟（dispatch 明示可选项，不强求）。

## 声明

- [PROD_NOT_TOUCHED]：全程未操作 :8080 生产服务与 `~/.peekview/`；未启动任何服务、未写任何生产路径；仅静态文件编辑 + vitest/playwright --list 本地验证。
- 无 `[SCOPE+]`（未发现清单外隐含需求）、无 `[DESIGN_GAP:]`（实现严格按 P2 §1.1 M 表与 §2 定稿执行）、无 `[SCOPE_GAP]`（P2 声明改动与 prompt 一致）。
- P3 红灯对应关系：改造前三类红灯源（死 entry 404 / 死选择器 / 死路由 `/entries/`）在本次改造中分别由 fixture 自建、选择器迁移、goto `/${slug}` 迁移消除；红灯→绿灯的运行级确认归 P5。
