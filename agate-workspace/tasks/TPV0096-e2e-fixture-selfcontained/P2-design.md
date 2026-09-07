---
type: design
phase: P2
task_id: TPV0096
agent: architect
parent: P1-requirements.md
trace_id: TPV0096-P2-20260907
status: draft
created: '2026-09-07'
candidate_count: 1
packages:
- frontend-v3
- docs
domains:
- frontend
ui_affected: false
---
# P2 方案设计 — E2E 红灯 spec 自建 entry 化（TPV0096）

> 上游：P1-requirements.md（13 条 BDD，BDD-1~13）

## 0. 简化声明（candidate_count: 1 的理由）

- `design_trivial: true`：本任务是测试代码改造，不引入新架构面——fixture 创建（HTTP POST）、清理（afterEach 队列）、护栏（beforeAll 校验）三机制在 repo 均有可直接复制的成熟先例，无新依赖、无 schema/接口变更、无并发模型变化。
- `follows_existing_pattern: [frontend-v3/e2e/teams-page.spec.ts, frontend-v3/e2e/render-regression.spec.ts]`：teams-page 提供护栏 + 清理队列 + 「创建成功才入队」范式（L20-45），render-regression 提供 createEntry helper + `gotoEntry` 正确路由写法（L39-61），t049 提供创建前防御性预删先例（L7-11）。合并三个先例即覆盖本任务全部机制需求，不存在需要多方案权衡的开放分叉。
- 唯一两个开放决策点（非方案分叉，属方案内定稿）：① mermaid-visual 自起 chromium 保留还是归一 → **保留**（§2.3 定稿理由）；② fixture slug 并发唯一化策略 → **显式枚举 slug**（§2.4 定稿理由）。

简化声明同时以顶格字段形式存在于 P1 §7（[BASELINE_CHANGE] 已批准），供 check-gate.py P2 机械扫描读取。

## 1. 影响面梳理（强制节）

> 证据来源：e2e 目录 3 个改造对象全文读取、src 选择器 grep（89 命中逐一核对）、Makefile/dev-server.sh/run-e2e-tests.sh/playwright.config.ts 读码、seed-data/ 目录清单（24 条）。逐条证据见 P2-progress.md。

### 1.1 改什么（Modify）

**M1 `frontend-v3/e2e/mermaid.spec.ts`（全文件重构，75 行 → 预计 ~140 行）**

| 改动点（现位置） | 改为 | 关联 BDD |
|---|---|---|
| 无护栏 | 新增 `test.beforeAll`：BASE_URL 含 `:8080`/`prod` → throw + `/health` 探活（teams-page L20-26 范式） | §2.6 护栏（BDD-1 前置） |
| 无 fixture，goto 死 entry `test-mermaid-2`（L7） | 新增 fixture helper（预删→POST→入队）+ 3 个 test 各自 `e2e-mermaid-<case>-<project>` entry（含 mermaid flowchart 内容块） | BDD-1/2/4 |
| `page.goto(\`${BASE_URL}/entries/test-mermaid-2\`)`（L7） | `page.goto(\`${BASE_URL}/${slug}\`)`（render-regression gotoEntry 写法 L59-61） | BDD-8 |
| 死选择器 `.mermaid-content[data-mode="diagram"]`（L13） | `.diagram-viewer`（DiagramBlock.vue L187 实证） | BDD-7 |
| 死选择器 `.mermaid-content[data-mode="code"]`（L35） | `.diagram-code`（DiagramBlock.vue L212 实证） | BDD-7 |
| 死选择器 `.mermaid-action-btn[title="Fullscreen"]`（L57） | `.diagram-action-btn.fullscreen-btn`（DiagramBlock.vue L177 实证） | BDD-7 |
| 死选择器 `.diagram-modal-overlay`（L61） | `.diagram-modal`（MermaidRenderer.vue L9 实证，Teleport 到 body，page 级定位不变） | BDD-7 |
| 无清理 | 新增 `createdEntries: string[]` + `test.afterEach`：splice(0) 逐条匿名 DELETE，`[200,204,404]` 容忍、其余 throw（teams-page L35-45 范式，队列只存 slug——匿名上下文无 token） | BDD-2/5 |
| 等待策略 `networkidle + waitForTimeout(3000)`（L8-9） | 不变（P1 §2.5 约束） | — |

**M2 `frontend-v3/e2e/mermaid-check.spec.ts`（27 行 → 预计 ~70 行）**

| 改动点（现位置） | 改为 | 关联 BDD |
|---|---|---|
| URL 硬编码 `http://127.0.0.1:8888/entries/playwright-test`（L4） | 提取 `BASE_URL` const + fixture `e2e-mermaid-check-<project>` + `goto \`${BASE_URL}/${slug}\`` | BDD-1/4/8 |
| 无护栏/无清理 | 同 M1（护栏 + afterEach 清理队列） | §2.6 / BDD-2/5 |
| `waitForTimeout(5000)`（L5） | 不变 | — |
| `if (count > 0)` 条件包裹（L16-26） | 移除包裹，断言无条件执行。注：L14 `expect(count).toBeGreaterThan(0)` 已无条件先行，此包裹属 fail-safe 而非假绿（与 P1 §2.4 点名的 mermaid-visual 不同类），顺带清零以满足 BDD-6 的「无条件执行」静态检查口径 | BDD-6（同型清理） |

**M3 `frontend-v3/e2e/mermaid-visual.spec.ts`（101 行 → 预计 ~170 行）**

| 改动点（现位置） | 改为 | 关联 BDD |
|---|---|---|
| `BASE_URL` 硬编码（L3） | 提取 const | 一致性 |
| goto `/entries/e2e-test` ×3（L12/51/81） | fixture `e2e-mermaid-visual-<case>-<project>` + `/${slug}` | BDD-1/4/8 |
| test1 假绿：`isVisible().catch(() => false)` + 双层 `if` 包裹 expect（L20-41） | 拆除条件包裹：`await expect(diagram).toBeVisible()` + boundingBox >200 + `await expect(svg).toBeVisible()` + svgBox >100 无条件执行 | BDD-6/10 |
| test2 条件断言 `expect(svgVisible).toBe(true)`（L69-71） | `await expect(svg).toBeVisible()` + `.mermaid-content[data-mode="diagram"] svg` → `.diagram-viewer svg` | BDD-6/7 |
| test3 死选择器 `.mermaid-action-btn[…]`（L85）+ `.diagram-modal-overlay`（L92）+ 条件断言（L93-97） | `.diagram-action-btn.fullscreen-btn` + `.diagram-modal` + 断言无条件化（modal 可见 + height>500） | BDD-6/7/11 |
| 自起 `chromium.launch({headless, viewport 1280x800})` 结构（L7-8/47-48/78-79） | **保留不动**（§2.3 定稿） | BDD-9/11 口径 |
| 无护栏/无清理 | 护栏 + afterEach 清理队列（清理经 Playwright `request` fixture，与自起浏览器无关） | §2.6 / BDD-2/5 |

**M4 `docs/process/debug-workflow.md`（新增「E2E 编写规范」节，插入点：「调试检查清单」（L228-243）之后、「常见问题」（L245）之前）**

规范节含 4 条（BDD-13 判据只要求前 2 条存在，后 2 条为本次任务沉淀）：

1. 页面路由是 `/:slug`，不是 `/entries/:slug`（API 才是 `/api/v1/entries`；`/entries/xxx` 落入 `/:pathMatch(.*)*` → NotFoundView）
2. spec 依赖的 entry 必须存在于 seed-data/ 或测试内自建且带 afterEach 清理队列（创建成功才入队；清理失败必须显式 FAIL，404 视为已删除）
3. 直写 DB 的 spec（POST/DELETE `/api/v1/entries`）必须加 BASE_URL 防生产护栏（beforeAll fail-fast）
4. fixture 的创建与删除必须同认证上下文（debug 匿名建配匿名删；登录用户建配同一用户删——混用即残留）

### 1.2 不改什么（Not Modify）

| 范围 | 理由 |
|---|---|
| `backend/` 全部（含 entries.py/auth.py/config.py） | 无产品代码改动（P1 §1 范围边界）；仅作认证语义只读参照 |
| `frontend-v3/src/` 全部（含 DiagramBlock.vue/MermaidRenderer.vue） | 死选择器的替代物已在 src 存活（grep 实证），改 src 反而超出「只改测试代码」边界 |
| `frontend-v3/playwright.config.ts` | fullyParallel/双 project/CDP 配置维持——slug 冲突问题在 spec 层解决（§2.4），不动全局并发模型 |
| `scripts/run-e2e-tests.sh` / `scripts/dev-server.sh` / `Makefile` | 运行机制与守卫不动，gate_commands 只引用不修改 |
| `scripts/seed-data/`（24 条） | BDD-4 只要求 fixture 不与 seed 冲突；`e2e-` 前缀 slug 与 24 条现有 slug（admin-private-config…yaml-docker-compose，无 e2e- 前缀）天然隔离 |
| 其余 36 个 e2e spec（t022/verify-mermaid/viewer/html-render/structured-data-viewer/render-regression/t049 等） | P1 §4 同类扫描已逐条判定延后：t022/verify-mermaid 待立项（SUGGEST-4），清理缺失家族归 DEBT0008，本次不顺手修 |
| `waitForTimeout(3000/4000/5000)` 硬等待 | P1 §2.5 明文不做（TPV0097 范围） |
| `VERSIONS.json` / 版本号 | P1 §7：纯测试改动不 bump，CHANGELOG 记录归 P8 |
| `CHANGELOG.md` | 本任务无用户可见行为变化，P8 releaser 阶段统一记录 |

### 1.3 风险在哪（Risk）

| # | 风险 | 证据/场景 | 缓解 |
|---|---|---|---|
| R1 | **并发 slug 冲突**：fullyParallel: true（config L5）+ 双 project 并发 → 同名 fixture 并发创建 409 / 互删 | playwright.config.ts L5 + L20-41；render-regression 用固定 t085-* slug 无并发场景先例 | slug 显式枚举且含 project 维度（§2.4）：`e2e-<spec>-<case>-<chromium|mobile>`，同 spec 内不同 case 不同名，跨 project 不重名 |
| R2 | **认证混用 → 清理 404 静默残留**：匿名建（owner_id=NULL）+ 带 token 删被拒返回 404，恰落入 BDD-5 的 404 容忍窗口 | entries.py L477-478/L979-1002（P1 §2.3） | 创建/预删/清理全程不带 Authorization 头（匿名同上下文）；清理后不留 token 字段（队列只存 slug，结构上杜绝混用）；BDD-2 逐 slug count=0 查询作验收级兜底；规范文档第 4 条成文拦截 |
| R3 | **创建失败被吞 → 渲染断言红灯被误读**（render-regression `.catch(()=>{})` 模式的缺陷） | render-regression.spec L39-43 | 新 helper 不吞错：预删 404 容忍，POST 非 201/200 直接 throw——fixture 失败红灯语义清晰 |
| R4 | **匿名创建被拒**（ALLOW_ANONYMOUS_CREATE 配置漂移/未生效） | dev-server.sh L112 为唯一启用点 | 护栏 beforeAll 即 `/health` 探活 + 首次创建失败立即红灯（fail-fast 于测试体内）；minimal_validation 固化 6 步 curl 复验脚本（§5），P3 红灯运行天然复验 |
| R5 | **mermaid 渲染时序不稳定**：waitForTimeout 窗口内 svg 未达阈值 | P1 §2.5（不改等待策略） | fixture 内容用 flowchart 类图（seed-data/mermaid-charts 同风格，实证可在 3-5s 窗口达标：容器>200/svg>100） |
| R6 | **`.diagram-viewer`/`.diagram-code` 是 v-show**（display 切换非卸载） | DiagramBlock.vue L187/L212 | `toBeVisible`/`toBeHidden` 对 display:none 语义正确（mermaid.spec test2 既有断言模式即依赖此），无额外适配 |
| R7 | **modal 定位层级**：modal 经 Teleport 挂 body，不在 block 内 | MermaidRenderer.vue L6-30 | 三个 spec 现状即 page 级定位 `.diagram-modal*`，迁移后写法不变（`.diagram-modal`），无回归面 |
| R8 | **Mobile Chrome project 下 modal height>500 断言**：Pixel 5 viewport 393x851 是否容纳 | config L29-40 | 851>500 成立；mermaid-visual 的断言在自起 1280x800 实例内执行，与 project viewport 无关（保留自起的独立收益） |
| R9 | **gate 命令键位腐化**（P3_xxx 静默收集 / && 短路） | P2 卡禁令 | gate_commands 遵守：裸 P3、每键单命令、per-key timeout、E2E 三键分列（§6） |

## 2. 候选方案（candidate_count: 1）

### 2.1 方案：三先例合并的「自建 + 护栏 + 清理」spec 内 fixture 范式

每个被改造 spec 内联（不抽共享模块——e2e 目录无共享 helper 先例，teams-page/render-regression 均内联，遵循现状最小 diff）以下四件套：

1. **护栏**（beforeAll）：BASE_URL 含 `:8080`/`prod` → throw + `/health` 探活（teams-page L20-26 逐字范式）。
2. **fixture helper**：`ensureEntry(request, slug, files)` = 防御性预删（匿名 DELETE，404 容忍——t049 L7-11 先例，保证 BDD-3 重跑确定性）→ 匿名 POST（body 含 `is_public: true`、files 含 mermaid 代码块；非 201/200 throw，不吞错）→ push 入清理队列。
3. **清理队列**（afterEach）：`createdEntries.splice(0)` 逐条匿名 DELETE，`[200,204,404]` 容忍、其余 throw（teams-page L35-45 范式，去掉 token 字段——匿名上下文不需要，见 R2）。
4. **断言迁移**：按 §1.1 三个表逐行执行，阈值（容器>200/svg>100/modal>500）与等待策略全部原样保留。

### 2.2 fixture 内容定稿

- 每 test 一份独立内容（同 spec 内 test 互不依赖 entry）：单 `mermaid` 代码块 flowchart（约 4-6 节点），与 seed-data/mermaid-charts 同风格。
- 文件名 `diagram.md`，content 为 markdown 内嵌 ```mermaid 块（EntryDetail 经 DiagramBlock 渲染为 `.diagram-block[data-type="mermaid"]`）。
- 匿名创建强制 `is_public=true`（entries.py L136-139），body 中显式声明该字段保持与 render-regression 一致。

### 2.3 mermaid-visual 自起 chromium 定稿：**保留**

理由（四点，均为「归一」方案的真实成本）：
1. **P1 基线口径已固化自起语义**：BDD-11 明文「自起浏览器实例的硬编码视口」、BDD-9 明文「因测试体内自起 chromium 在两个 project 各执行一遍」——归一需回改 P1 基线措辞，成本>收益。
2. **隔离性**：自起实例不受 CDP Chrome 共享状态影响（CDP :18800 是共享真实 Chrome，连接数与状态被其他会话共用）；3 test × 2 project = 6 次自起完全独立。
3. **最小 diff**：改造面限于 goto/fixture/断言，launch 结构不动，符合 follows_existing_pattern。
4. **R8 的独立收益**：modal>500 断言在硬编码 1280x800 视口内，与 project viewport 解耦。

### 2.4 fixture slug 定稿：显式枚举 `e2e-<spec>-<case>-<projectKey>`

- 命名：`e2e-mermaid-svg|toggle|fullscreen-<chromium|mobile>`、`e2e-mermaid-check-main-<…>`、`e2e-mermaid-visual-height|toggle|fullscreen-<…>`（共 3+1+3=7 case × 2 project = 14 slug 上限，写死于各 test 内）。
- 为什么不用 Date.now 动态 slug：BDD-3 要求重跑确定性 + BDD-2 要求按已知 slug 清单查残留——动态 slug 迫使运行时导出清单，增加机制复杂度；确定性 slug + 预删防御（R3）已覆盖重跑场景。
- 为什么不用 `testInfo.workerIndex` 等运行时维度：worker 编号跨运行不稳定，违背 BDD-2 可枚举性。
- projectKey 派生：`test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'`（一行，spec 内联）。
- 与 seed 隔离：`e2e-` 前缀在 seed-data 24 条中零命中（§1.2），BDD-4 成立。

### 2.5 实现完成的标志（供 P3/P5 判定）

- 三个 spec 经 `E2E_SPEC=… make debug-test` 各自退出码 0（chromium + Mobile Chrome 双 project 全 PASS，failed=0 skipped=0）。
- 14 个（上限）fixture slug 在运行后逐条 `sqlite3 /tmp/peekview-debug/peekview.db` count=0。
- BDD-6 静态检查：3 spec 内 `if (…isVisible…)`/`.catch(() => false)` 包裹 expect 命中 0 处。
- BDD-7 静态检查：3 spec 中 `.mermaid-content`/`.mermaid-action-btn`/`.diagram-modal-overlay` 命中 0 处。
- BDD-8 静态检查：3 spec 中 `page.goto` 无 `/entries/` 路径。
- `make test-frontend` / `make typecheck` 退出码 0。
- BDD-12 基线对照：svg-inline-render.spec.ts 与 render-regression.spec.ts 的 t085 用例改造前后结果一致（既有 flaky bdd_4↔5 互换不计新失败）。

## 3. files_to_read

```yaml
files_to_read:
  - path: frontend-v3/e2e/mermaid.spec.ts
    why: 改造对象 M1，全文 75 行，逐行迁移
  - path: frontend-v3/e2e/mermaid-check.spec.ts
    why: 改造对象 M2，全文 27 行
  - path: frontend-v3/e2e/mermaid-visual.spec.ts
    why: 改造对象 M3，全文 101 行（自起结构保留）
  - path: frontend-v3/e2e/teams-page.spec.ts:16-45
    why: 护栏 + 清理队列逐字范式
  - path: frontend-v3/e2e/render-regression.spec.ts:39-61
    why: createEntry body 结构 + gotoEntry 路由写法
  - path: frontend-v3/e2e/t049-mobile-header-diagram-sanitize.spec.ts:7-11
    why: beforeAll 防御性预删先例（BDD-3 重跑确定性）
  - path: frontend-v3/src/components/DiagramBlock.vue:163-215
    why: 存活选择器 DOM 结构参照（只读，不改）
  - path: frontend-v3/src/components/renderers/MermaidRenderer.vue:1-31
    why: modal Teleport 结构参照（只读，不改）
  - path: docs/process/debug-workflow.md:228-245
    why: M4 新节插入点上下文
  - path: frontend-v3/playwright.config.ts
    why: project 定义/fullyParallel 语义参照（只读，不改）
```

## 4. env_constraints

```yaml
env_constraints:
  debug_env: "make debug（127.0.0.1:8888，数据 /tmp/peekview-debug/）；PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE=true（dev-server.sh L112）；RATE_LIMIT_ENABLED=false（L114）；captcha 默认禁用（L96-105）"
  auth_pairing: "fixture 创建/预删/清理全部不带 Authorization 头（匿名同上下文）；匿名创建强制 is_public=true（entries.py L136-139）；严禁匿名建+带 token 删混用（R2）"
  prod_isolation: "严禁触碰 :8080 与 ~/.peekview/；entry 操作只经 HTTP API（禁 sqlite3 直写、禁 peekview CLI create——AGENTS.md 铁律 5/6）；三 spec 内置 BASE_URL 护栏兜底"
  e2e_entry: "E2E 运行唯一入口 E2E_SPEC=e2e/<spec>.ts make debug-test（run-e2e-tests.sh 强制 E2E_GUARD_ENABLED）；CDP Chrome :18800 由脚本自动探测注入；mermaid-visual 自起 chromium 不依赖 CDP"
  db_audit: "残留审计用只读查询：sqlite3 /tmp/peekview-debug/peekview.db \"SELECT COUNT(*) FROM entries WHERE slug='…'\"（BDD-2）；seed 抽验走 HTTP GET 200（BDD-4）"
  runtime_prereq: "本平台服务不跨 bash 调用驻留：需 debug 服务的阶段（P3/P5/P6）必须在单次 bash 调用内自包含完成 make debug-start + make debug-seed + <验证/测试> + make debug-stop（外层 timeout 300s 起；严禁漏 debug-stop——其会清理 /tmp/peekview-debug/ 保证 0 残留）；失败分支同样必须清理——执行形态 `…; rc=$?; make debug-stop; exit $rc`（先取退出码、无条件 stop、再透传），防红灯/失败跳过 debug-stop 致下阶段脏 DB"
```

## 5. minimal_validation

- **状态：confirmed（2026-09-07 实测通过，HTTP 状态码级证据 + DB 0 残留）**
- **假设**：debug 匿名创建（`PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE=true`）+ 匿名删除（debug 未配 API key → allow_local）同上下文配对可用。
- **方法**：单次 bash 调用内自包含执行（本平台服务不跨 bash 调用驻留，主 Agent 环境修正）：`make debug-start` + `make debug-seed` + curl 配对验证 + sqlite3 残留复查 + `make debug-stop`，探针 entry `e2e-probe-p2`（e2e- 前缀，全程无认证头）。
- **实测结果**：
  1. `GET /health` → **200**
  2. `POST /api/v1/entries`（匿名）→ **201**，响应体 `"is_public":true,"owner_id":null`——P1 §2.3「匿名创建放行 + 强制 is_public + owner NULL」推断成立
  3. `GET /api/v1/entries/e2e-probe-p2`（匿名）→ **200**（公开可匿名读）
  4. `DELETE /api/v1/entries/e2e-probe-p2`（匿名）→ **200**——匿名删除放行，**配对约束关键确认点**
  5. `GET` 复查 → **404**
  6. `sqlite3 /tmp/peekview-debug/peekview.db` 残留 count：probe slug = **0**，`e2e-%` 前缀全量 = **0**
  7. `make debug-stop` exit 0，`/tmp/peekview-debug/` 已清理（环境还原）
- **对方案的直接影响**：fixture helper 断言阈值定稿——匿名 POST 预期 201（非 201/200 throw）、匿名 DELETE 预期 200（afterEach `[200,204,404]` 容忍集维持，200 为主形态）；认证配对采用「全程无认证头」实现（R2 结构性排除混用）。
- **复跑备注（同日）**：主 Agent 保活窗口下曾安排二次复跑，因保活服务实际未在 :8888 监听（对照证据：同一 CDP Chrome 访问 ：18800 正常、:8888 ERR_CONNECTION_REFUSED）而未能发出任何请求——零副作用零残留，不构成对首次实测结论的反证；首次自包含实测（上列 7 步）仍为 minimal_validation 的权威证据。
- **代码级复核（与实测互证）**：dev-server.sh L112/L114/L96-105 + entries.py L136-139/L477-478/L979-1002，全部与实测一致。
- **平台执行模式（下游 P3/P5/P6 必读）**：本平台服务不跨 bash 调用驻留——任何需要 debug 服务的阶段（P3 红灯、P5 E2E、P6 验收）必须**单次 bash 调用内**完成 `make debug-start` + `make debug-seed` + <验证/测试> + `make debug-stop` 全链（外层 timeout 300s 起），**严禁漏 make debug-stop**（会让下阶段遇脏环境）；gate_commands 中每条 E2E key 按此模式由执行方包裹，key 本身不变。失败分支显式形态：测试命令失败也必须清理——执行形态 `…; rc=$?; make debug-stop; exit $rc`（先取退出码、无条件 stop、再透传），防红灯/失败路径跳过 debug-stop 致下阶段脏 DB。

## 6. gate_commands

> 约束执行：测试键只允许裸 P3（禁 P3_xxx）；每键单命令禁 && 链；全部引用 Makefile target（经 E2E_SPEC 变量定向单 spec，run-e2e-tests.sh 原生支持）；E2E 档 900s（P5_e2e 三键，外层余量避让 run-e2e-tests.sh 内层 E2E_TIMEOUT=600）、单测档 300s；P3 键 = TDD 红灯确认命令（P3 先红灯后绿灯）。

```yaml
gate_commands:
  P3: "E2E_SPEC=e2e/mermaid.spec.ts make debug-test"
  P3_timeout_seconds: 600
  P5: "make test-frontend"
  P5_timeout_seconds: 300
  P5_typecheck: "make typecheck"
  P5_typecheck_timeout_seconds: 300
  P5_e2e: "E2E_SPEC=e2e/mermaid.spec.ts make debug-test"
  P5_e2e_b: "E2E_SPEC=e2e/mermaid-check.spec.ts make debug-test"
  P5_e2e_c: "E2E_SPEC=e2e/mermaid-visual.spec.ts make debug-test"
  P5_e2e_timeout_seconds: 900
  P5_e2e_b_timeout_seconds: 900
  P5_e2e_c_timeout_seconds: 900
```

说明：
- P3 红灯命令选 mermaid.spec.ts（改造面最大、红灯最明确：fixture+选择器+路由三重红灯）；timeout_seconds 仅作静态声明，P3 运行时仍走 AGATE_TDD_TIMEOUT 机制（P2 卡规则 1）。
- P3 键运行时消费 AGATE_TDD_TIMEOUT（默认 120s），P3 红灯一轮含 debug-start+seed+test（内层上限 600s），主 Agent 派发 P3 时须显式设 `AGATE_TDD_TIMEOUT=600`（或 ≥600）。
- `P5_e2e` 声明义务：ui_affected: false 但被测对象是 E2E，三 spec 分键声明（run-e2e-tests.sh 的 E2E_SPEC 单值机制决定必须分键；teams-page 的 P5_e2e_b 先例）。
- 后端 pytest 不入本表：backend/ 零改动，P5 卡通用基线（test-quick）由主 Agent 按 P5 卡执行，非本任务特有命令。

## 7. UI 测试选择器清单（P2 卡建议项）

本任务不改产品代码，无法新增 data-testid——**沿用既有 class 作稳定标识**（迁移目标全部来自 src 实证，见 §1.1 表），BDD-7 静态核对以本清单为基准：

`.diagram-block`（data-type="mermaid"）/ `.diagram-viewer` / `.diagram-code` / `.diagram-view-toggle` / `.diagram-action-btn.fullscreen-btn` / `.diagram-modal`（Teleport 至 body，page 级定位）

## 8. dispatch_plan

不声明（可选字段）：单 spec 改造面、3+1 个产出文件、无多包并行需求 → 单发派发，无批次拆分。
