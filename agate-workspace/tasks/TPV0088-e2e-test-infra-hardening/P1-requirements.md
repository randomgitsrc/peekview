---
phase: P1
task_id: TPV0088-e2e-test-infra-hardening
type: problems
parent: P0-brief.md
trace_id: TPV0088-P1-20260812
status: draft
created: 2026-08-12
agent: analyst
# ── v2.0 机器字段 ──
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
packages: [frontend-v3, makefile, scripts]
domains: [test-infra, frontend]
P1_simplified: true
follows_existing_pattern: [frontend-v3/e2e/viewer.spec.ts, scripts/e2e-safety-check.sh, Makefile]
capability_requirements:
  - need: debug-backend
    why: E2E 全部 19 用例需在 debug backend (:8888, /tmp/peekview-debug/) 实跑，隔离生产数据
    available:
      - "make debug-start + debug-seed（seed 数据已含 python-entry-service / markdown-test / mermaid-charts / json-api-config）"
    status: available
  - need: playwright-browser
    why: E2E 用 Playwright 跑真实浏览器（AGENTS.md 规定 CDP 连接 Chrome :18800）
    available:
      - "make debug-test（CDP 模式，playwright 1.60.0）"
    status: available
  - need: static-mtime-comparison
    why: 子任务 B 需要在 shell 中比对 frontend-v3/src/ 最新 mtime 与 backend/peekview/static/index.html mtime
    available:
      - "bash test/find/stat（标准 POSIX 工具，e2e-safety-check.sh 运行环境）"
    status: available
---

# P1 — 需求基线：E2E 测试基础设施加固（TPV0088）

## 1. 需求复述

T087 复盘发现两个测试基础设施缺口，本任务分别修复：

- **子任务 A**：`frontend-v3/e2e/viewer.spec.ts` 19 用例全部预期失败（注：P0 审计记为 20 用例，经逐条核实 `viewer.spec.ts` 实际仅 19 条 `test()`——Code Viewer 5 + Markdown 4 + Responsive 4 + Theme 2 + File Ops 3 + Entry List 1，无 skip/only/参数化扩增，本基线以实际 19 为准）。根因按 P0 审计：①路由格式过时（`/#/entry/{slug}` hash 模式 → 实际 `/{slug}` history 模式，AGENTS.md 铁律 7）；②硬编码 seed slug `lu4prg`/`ngajri` 已不存在。**P1 逐条核实后补充**：除路由+slug 外，另有 8+ 处死选择器/过时断言（见 §2），需一并修复，否则改完仍会假绿或假红。
- **子任务 B**：`make debug-test` 前置检查（`e2e-safety-check.sh`）加入 static 产物新鲜度校验，防止前端改源码后未 `make build-frontend` 时 E2E/验收基于过期产物假通过。

约束：不允许触碰生产 :8080 与 `~/.peekview/`；E2E 只在 debug backend :8888 实跑；本任务是测试基础设施修复，不改后端业务代码、无 schema 变更。

## 2. 隐含需求识别

### 数据（seed / 测试数据）
- **IMPL-D1**：TC-041 需单文件 entry（断言 `.file-sidebar` 数=0）。已核实 `json-api-config`（单文件 config.json，public）可用；`python-entry-service` 是 2 文件（entry_service.py + requirements.txt），**不能**用于 TC-041。
- **IMPL-D2**：TC-004/005/030/042 需 Python 代码 entry。`python-entry-service` 的 entry_service.py 含 8 处 `def`（TC-004 clipboard 断言 `toContain('def')` 成立）；`python-entry-service` 是 public（alice）。
- **IMPL-D3**：TC-010~013/020~023/040 需 markdown+TOC entry。`markdown-test`（rich-markdown.md 含 h1-h3 标题 + architecture.svg，2 文件）可满足 markdown+TOC+多文件（TC-040 需 `.file-item` 点第 2 个）；TC-013 需 mermaid → `mermaid-charts`（flowchart/gantt/sequence.md 均含 `mermaid` 块）。
- **IMPL-D4**：TC-001/002/003 用运行时 API 创建 `e2e-test-code`（slug='e2e-test-code', test.py 含 `def`）。已核实 `allow_anonymous_create` 默认 true（config.py:293），debug 模式 captcha 禁用，匿名创建强制 is_public=true，可行。**注意 TC-004/005 不能再依赖该运行时 entry**（TC-004 断言 clipboard 含 'def' 且 entry 需 Python，若用运行时 entry 亦可，但更稳妥用 seed slug python-entry-service）。

### 前端选择器（P0 审计存疑项，逐条核实）
- **IMPL-S1** `.code-header .filename` / `.code-header .lang`（TC-005）：**死选择器**。仅 styles/code.css 有 CSS，无 Vue 模板渲染。filename 实际只在 FileTree `.file-item .file-name` 渲染，lang 只在 markdown 代码块 `.code-lang` 渲染。TC-005 需改为断言 `entry_service.py`（文件名出现在 file tree）或删除/改写。
- **IMPL-S2** `.mobile-actions`（TC-021/022）：**死选择器**。实际移动端条是 `.mobile-bottom-bar`（EntryDetailMobileBar.vue）。
- **IMPL-S3** `.mobile-actions .menu-btn`（TC-022）：**死选择器**。`.menu-btn` 只在 DiagramBlock 图工具栏。移动端文件抽屉按钮是 `[data-testid="mobile-bar-filetree-btn"]`。
- **IMPL-S4** `.toc-btn`（TC-023）：**死选择器**（layout.css 有 CSS 无模板）。移动端 TOC 按钮是 `[data-testid="mobile-bar-toc-btn"]`。
- **IMPL-S5** `.list-header .btn-icon, .detail-header .btn-icon`（TC-030/031）：**死选择器**。`.list-header` 全库不存在；ThemeToggle 按钮 class 是 `.theme-toggle`（无 `.btn-icon`）。TC-030 在详情页应点 `.detail-header .theme-toggle` 或 entry 内容区 theme toggle；TC-031 在 landing 页（`/`）应点 ThemeToggle。
- **IMPL-S6** `button:has-text("Copy")`（TC-004/005）：桌面 Copy 是 icon-btn（aria-label="Copy"，无文本），`has-text("Copy")` 匹配不到。需改 `[aria-label="Copy"]` 或 `[data-testid]`（mobile-bar-copy-btn）。注意 markdown 代码块有 `.code-copy-btn` 文本 "Copy"，但 TC-004 目标是代码 entry 的 Copy 按钮。
- **IMPL-S7** `button:has-text("Wrap")`（TC-003/005）：**桌面端无 Wrap 按钮**。Wrap 仅移动端 `[data-testid="mobile-bar-wrap-btn"]`（icon 无文本）。TC-003 需改为移动端视口 + mobile-bar-wrap-btn，或删除（如果桌面 UI 已无 Wrap 功能则测试目标不存在）。
- **IMPL-S8** `a[download]`（TC-042）：**断言必然失败**。下载通过 JS 动态建 `<a>` 后立即移除（useEntryDetailComputed.ts:86-97），DOM 不留 a[download]。TC-042 需改为触发下载（click download item / mobile download）后断言文件名，或删除。
- **IMPL-S9** `.entry-card`（TC-050）：只在 `/explore`（EntryListView）渲染，**landing（/）不渲染**。TC-050 goto '/' 等 `.entry-card` 必超时 → 需改 goto `/explore`。
- **IMPL-S10** TC-050 URL 断言 `toHaveURL(/\/entry\//)`：路由是 `/{slug}`，**URL 不含 `/entry/`** → 断言必失败，需改 `/\/([^/]+)$/` 类断言。
- **IMPL-S11** TC-012 TOC 导航：TocNav a 是 `href="#id"` + `@click.prevent`（scrollIntoView，不改 URL）。history 模式下 URL 不出现 `#hash`，`toHaveURL(/.*${href}$/)` 必失败。需改断言滚动位置/active class。
- **IMPL-S12** TC-013 mermaid：`if (mermaidExists)` 条件式断言，无 mermaid 时静默通过（假绿）。改用 `mermaid-charts` 后应改为无条件断言 `.mermaid` 可见。

### 多端（MCP / CLI / API）
- **IMPL-M1**：无。本任务不动 MCP/CLI/API 行为。E2E 运行时 API 创建 entry（TC-001）依赖 `POST /api/v1/entries`，仅用于 debug backend，不影响生产。

### 边界
- **IMPL-B1**（子任务 B）：mtime 比对不能误伤正常流程——`make debug-quick`/`build-frontend` 先 copy dist→static，build 后 static 比 src 新，检查应放行；只有 src 改动但未 build 时才拦截。
- **IMPL-B2**（子任务 B）：校验基准统一为 `frontend-v3/src/` 最新 mtime vs `backend/peekview/static/index.html` mtime（即 `find frontend-v3/src -newer backend/peekview/static/index.html` 有输出即判过期）。`frontend-v3/dist/` 仅作 build 中间产物说明（`make build-frontend` 将 dist/* 复制进 static/），不作为比对基准，与 SUGGEST 表述口径一致。需防"src 未变但 static 被误判过期"：debug-stop 只清理 /tmp/peekview-debug（运行时数据目录），不涉及 static 产物——用户仅跑已有 static 时，只要 src 未比 static 新，检查应放行、不误拦截。
- **IMPL-B3**（子任务 A）：`.file-sidebar` 在单文件 entry 下不渲染（EntryDetailContent.vue:4 `v-if="isFileTreeOpen && isMultiFile"`），TC-041 断言 `count===0` 成立前提是 entry 单文件。

### 兼容
- **IMPL-C1**：`e2e-safety-check.sh` 现有 5 项检查（E2E_GUARD_ENABLED / :8888 health / DB 隔离 / 生产备份 / e2e- 前缀污染）必须保持，新增 mtime 校验不得破坏现有通过路径。脚本已被 CI 与本地共用（Makefile:636）。
- **IMPL-C2**：前端 `npm run build`（vite）产物 hash 文件名每次变，mtime 校验基于 index.html 而非 hash 文件名，稳定。
- **IMPL-C3**：`make debug`（完整 CI 级）先 build 后 start 后 test，顺序天然满足 mtime 校验放行条件；`make debug-test` 单独跑（依赖已有 static）时需用户先 build——校验报错信息要提示 `make build-frontend`。

## 3. 待确认清单

`[NO_NEED_CONFIRM]`

理由：
- 每个死选择器的修复方向均已对照当前 DOM 核实（见 §2 各 IMPL-S*），方向明确（改 selector / 改 entry / 删用例），无需人定夺。
- 子任务 A/B 的目标（19 用例通过 + mtime 拦截）P0 已定义，无业务方向歧义。
- 若 P4 实现中发现某用例在当前 UI 上"无对应功能可断言"（如桌面已无 Wrap 按钮，IMPL-S7），由实现者按"删除该用例并记录"处理——属于测试资产维护的正常决策，不阻塞。

`[SUGGEST: 子任务 B 的 mtime 比对放在 e2e-safety-check.sh 新增 Check 6，输出 FAIL 时提示 "make build-frontend"。比对用 find frontend-v3/src -newer backend/peekview/static/index.html。理由：脚本已是被 debug-test 调用的唯一前置入口，集中放置避免 Makefile 多处逻辑。]`

## 4. BDD 验收条件

### 子任务 A：viewer.spec.ts 19 用例修复

#### BDD-1: 全部 19 用例在 debug backend 实跑通过
- Given debug backend 运行于 :8888 且已 seed（含 python-entry-service / markdown-test / mermaid-charts / json-api-config）
- When 运行 `E2E_SPEC=e2e/viewer.spec.ts make debug-test`
- Then 19/19 用例 PASS（非抽样，非 skipped 计数为假绿）

#### BDD-2: 路由全部改为 history 模式
- Given 修复后的 viewer.spec.ts
- When 逐条检查所有 `page.goto` 的 entry 导航
- Then 无任何 `/#/entry/` 残留，全部为 `/{slug}` 或 API 创建的运行时 slug

#### BDD-3: 死选择器全部替换为现存 DOM 节点
- Given 修复后的 viewer.spec.ts
- When 对每条 locator 核对当前组件模板
- Then 无 `.code-header` `.mobile-actions` `.menu-btn`（移动端文件抽屉）`.toc-btn` `.list-header` `.btn-icon` 等死选择器；`.file-sidebar` `.toc-sidebar` `.mobile-bottom-bar` `.drawer-left` `.drawer-right` `.file-item` `.theme-toggle` `.markdown-body` `.toc-nav .toc-item` `[data-testid=...]` 为可用选择器

#### BDD-4: 硬编码 slug 全部映射到现存 seed entry
- Given `scripts/seed-data/` 现有目录
- When 检查 viewer.spec.ts 中每个 seed slug 引用
- Then 无 `lu4prg`/`ngajri` 残留；TC-041 用单文件 entry（json-api-config），TC-004/005/030/042 用 Python entry（python-entry-service），TC-010~012/020~023/040 用 markdown entry（markdown-test），TC-013 用 mermaid entry（mermaid-charts）

#### BDD-5: TC-041 单文件断言有数据支撑
- Given `json-api-config` entry（单文件 config.json，public）
- When 桌面视口（1280×800）访问 `/{json-api-config}` 并断言 `.file-sidebar` 数量
- Then `.file-sidebar` 元素数为 0（单文件 entry 不渲染 file sidebar），且该 entry 在 debug seed 中存在

### 子任务 B：static 新鲜度校验

#### BDD-6: 过期 static 被拦截
- Given frontend-v3/src/ 有比 backend/peekview/static/index.html 更新的文件（故意 touch src 文件不 rebuild）
- When 运行 `make debug-test`（debug backend 在线）
- Then Step 1 前置检查失败，非零退出，报错信息提示需 `make build-frontend`

#### BDD-7: 新鲜 static 放行
- Given 刚执行过 `make build-frontend`（static/index.html 不旧于 src）
- When 运行 `make debug-test`
- Then Step 1 前置检查通过，进入 E2E 执行

#### BDD-8: 先 build 后 debug-test 正常流程不被误伤
- Given 依次执行 `make debug-quick`（build-frontend-fast → debug-start → debug-seed）
- When 随后运行 `make debug-test`
- Then 前置检查通过（build 后 static 新鲜，检查不误拦截正常流程）

### 通用

#### BDD-9: 数据隔离不被破坏
- Given debug backend :8888 + 生产 :8080 在线
- When 运行修复后的 E2E suite
- Then e2e-safety-check.sh 全部 5 项既有检查仍通过，生产 DB 无新增 `e2e-` 前缀数据（若在线，验证 make debug-verify-isolation 或手动 sqlite 查 count）

## 5. 裁剪说明

- **P2 设计**：`follows_existing_pattern`——子任务 A 是修复现有 spec 文件（模式即 spec 内既有 helper + seed 数据引用），子任务 B 是往现有 shell 检查脚本加一段逻辑（模式即脚本既有 Check 1-5）。均非新功能，可单候选方案简化。
- **P3 TDD**：子任务 B（shell 校验逻辑）保留最小 TDD——用临时目录造"旧 static + 新 src"与"新 static + 旧 src"两种 fixture 断言脚本退出码（低风险但可测，非纯配置）。子任务 A 是测试代码本身，不适用传统 TDD 红灯，验收锚点即 BDD-1 的 19/19 实跑（P6）。
- **P5 技术验证**：跑 `make test-quick`（后端测试不受影响，应全绿）确认改动未波及后端；前端 `npm run test` 不跑（watch 挂 agent），typecheck 由 P7/P8 覆盖。
- **P6 验收**：不可裁剪。子任务 A 用 `E2E_SPEC=e2e/viewer.spec.ts make debug-test` 实跑 19 用例（非抽样）；子任务 B 实测 BDD-6/7/8 两态（造过期场景被拦 + 新鲜放行 + 正常流程不误伤）。
- **P7 一致性**：**不可裁剪**。涉及 viewer.spec.ts + Makefile + e2e-safety-check.sh 三文件改动（+可能 CHANGELOG），须跨文件核对 slug 映射、选择器、Makefile 顺序引用一致。
- **P8 发布准备**：本任务修改纯测试基础设施，不产生用户可见功能；若 CHANGELOG 记录则归 [Unreleased]。release 流程照常。

## 6. 范围声明

- `packages`: [frontend-v3, makefile, scripts]（spec 文件在 frontend-v3/；debug-test/Makefile 在根；e2e-safety-check.sh 在 scripts/）
- `domains`: [test-infra, frontend]（改动核心是测试基础设施；viewer.spec.ts 是前端 E2E 测试资产，不涉及后端业务代码）

## 7. 能力需求声明

见文件头 `capability_requirements`：debug-backend / playwright-browser / static-mtime-comparison 均 `available`。无 GAP。

## 8. 风险登记

| 风险 | 级别 | 缓解 |
|------|------|------|
| 测试修复无现成覆盖兜底，改错产生假绿 | medium | BDD-1 要求 19/19 实跑非抽样；BDD-3 逐条核对现存 DOM；P6 实跑截图为证 |
| 死选择器替换后断言变弱（如 .theme-toggle 误匹配） | medium | BDD-3 明确允许列表与禁止列表；P6 逐条实跑看断言是否真触发（非 hasText 匹配到零个元素） |
| static mtime 校验误伤正常流程 | medium | BDD-8 覆盖 make debug-quick → debug-test 全链路；比对基于 index.html（hash 文件名不稳定）|
| TC-003/042 等用例在桌面 UI 无对应功能（Wrap/下载链接）| medium | 实现者按 IMPL-S7/S8 处理（改移动端视口或删用例并记录），P6 逐条核对断言真实性 |
| seed 数据后续被删导致 slug 再次失效 | low | slug 映射集中在 spec 顶部常量或注释，P7 一致性核对 |
