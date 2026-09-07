# P1-progress — TPV0096（analyst 分阶段落盘）

## 2026-09-05

### 输入读取：P1-dispatch-context + P0-brief + analyst 角色文件
- 已核对 P0-brief 时效性：created 2026-09-05 = 当日立项当日启动，无间隔；3 个红灯 spec / seed 24 entry / 自建模式参照等核心事实待逐项复核（见下），暂无漂移迹象。

### 输入读取：frontend-v3/e2e/mermaid.spec.ts（依赖 test-mermaid-2）
- beforeEach：goto `/entries/test-mermaid-2` + networkidle + waitForTimeout(3000)
- 3 个 test 的断言反推 fixture 需求：
  1. "SVG fills container properly"：`.mermaid-content[data-mode="diagram"]` 可见；容器 height > 200px；svg 可见且 height > 100px
  2. "Code/Diagram toggle works"：`.diagram-block` 内 `.diagram-view-toggle` 可点击；切 code 后 codeMode 可见/diagramMode 隐藏；切回后 svg 可见 height > 100px
  3. "Fullscreen fills window"：`.mermaid-action-btn[title="Fullscreen"]` 可点击；`.diagram-modal-overlay` 可见且 height > 500px（viewport 内）
- 结论：fixture entry 必须是含 mermaid 代码块、渲染出可交互 diagram-block 的 entry

### 输入读取：frontend-v3/e2e/mermaid-check.spec.ts（依赖 playwright-test）
- 单 test：goto `/entries/playwright-test` + waitForTimeout(5000)
- 断言：`.diagram-block` count > 0；`.diagram-viewer` height > 200px；`.diagram-viewer svg` height > 100px
- 注意：选择器是 `.diagram-viewer`（与 mermaid.spec 的 `.mermaid-content` 不同类名，需在 frontend 组件中确认两者共存的渲染路径）

### 输入读取：frontend-v3/e2e/mermaid-visual.spec.ts（依赖 e2e-test）——dispatch 要求重点确认断言强度
- **P0 疑似"像素级对比"不成立**：全文无 toHaveScreenshot / 无图片 diff。实际断言 = 存在性 + boundingBox 尺寸（容器 height > 200 / svg height > 100 / modal height > 500）+ toggle/fullscreen 交互后 svg 仍可见
- **真实弱点**：test 1 的断言包在 `if (isVisible)` / `if (svgVisible)` 条件块内且 `.catch(() => false)`——diagram 不可见时 test 1 静默通过（假绿）。这是"长期红灯掩盖真回归"之外的第二类信号失真，BDD 需覆盖
- **结构性差异**：该 spec 不用 Playwright test fixture，每个 test 内 `chromium.launch({ headless: true })` 自起浏览器（viewport 1280x800 硬编码）+ `browser.close()`。P0 验收基线写"跑 3 spec（chromium+Mobile）"——自起 chromium 的 spec 在多 project 配置下会每个 project 各跑一遍（需查 playwright.config.ts 确认 project 列表）
- fixture 需求与 mermaid.spec 一致：含 mermaid 的 entry，容器/svg 高度满足阈值

### 输入读取：frontend-v3/e2e/render-regression.spec.ts（自建模式参照）
- 模式：`createEntry(request, slug, summary, files)`（POST /api/v1/entries，`is_public: true`，无认证头，`.catch(() => {})`）+ beforeAll 创建 + **无 afterEach 清理**（注释即 BDD-1~11 的 t085-* entry 留在 DB）
- teams-page.spec.ts 才是"创建+清理队列"完整模式（待读）
- 隐含依赖浮现：render-regression 的 createEntry 无认证即可创建成功（否则 t085-* 全 404）→ 需确认 debug 环境 POST /api/v1/entries 的认证要求

## 2026-09-07（续跑）

### 断点确认
- 底稿 09-05 已完成 5 节读取（dispatch-context+P0-brief / mermaid.spec / mermaid-check.spec / mermaid-visual.spec / render-regression.spec），本次续跑不重做，从 4 项待补开始：teams-page 清理队列 / POST /api/v1/entries 认证 / .diagram-viewer vs .mermaid-content 渲染链 / playwright.config.ts project 口径
- 已复核 P0-brief 与 DEBT0010 全文（文件现状与 09-05 底稿记录一致）；时效性复核在待补项完成后统一给结论

### 待补项 1：teams-page.spec.ts「创建+清理队列」完整模式（已复核）
- 清理队列本体：模块级 `const createdTeams: Array<{slug, token}> = []`；测试内创建成功后 `createdTeams.push({slug, token})`；`test.afterEach` 对 `createdTeams.splice(0)` 无条件逐个 DELETE，200/204/404 均接受（404=已删/未生成），其余状态码 throw（清理失败本身使 test fail）
- 关键设计注释（原文）："放测试末尾的清理在断言失败时会跳过→泄漏，必须走钩子"——清理必须放 afterEach 钩子而非测试体末尾
- fixture 建立方式：API 层 `apiLoginToken`（POST /api/v1/auth/login，alice/bob testpass123）取 Bearer token 后 POST /api/v1/teams；UI 层登录走 login() helper
- teams 创建需认证（Bearer）→ 与 entries 匿名可写与否对照，待补项 2 查证
- 对本任务的模板意义：TPV0096 的 entry 清理队列应同构（创建成功才 push + afterEach splice 无条件删 + 404 容忍 + 清理失败抛错）

### 待补项 2：debug 环境 POST /api/v1/entries 认证要求（已闭合）
- 创建：scripts/dev-server.sh L112 显式 `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE=true` → 匿名创建放行（entries.py L112-114 分支不触发）；匿名创建强制 is_public=True（entries.py L136-139），entry owner_id=NULL
- 全局 API key 中间件：dev-server.sh 未设 PEEKVIEW_SERVER__API_KEY（config.server.api_key 默认 ""）→ main.py L310-311 `if api_key:` 不启用中间件；RATE_LIMIT_ENABLED=false → 写路径限流关闭
- captcha 仅覆盖 /auth/register 与 /auth/login（config.py L298-300），entries 创建不经 captcha
- 删除（清理队列可行性）：DELETE /api/v1/entries/{slug}（entries.py L461-488）在 server.api_key 为空时 `allow_local = no_server_auth and current_user is None` = True → 匿名 DELETE 放行（entry_service.delete_entry L979-980 allow_local 直接 bypass）
- ⚠️ 配对约束（隐含依赖，BDD 覆盖）：匿名创建的 entry owner_id=NULL，service 层 delete（L1001-1002）对 owner_id=NULL 仅 admin 或 allow_local 可删——用 alice 等普通用户 JWT 删匿名 entry 会 404。创建/删除认证方式必须配对：匿名建→匿名删（allow_local）或 alice 建→alice 删；混用 = 清理失败残留
- 与底稿差异澄清：render-regression 无认证头可建不是"宽松特例"，是 debug 启动脚本的显式配置（allow_anonymous_create=true）；生产默认值同为 True（config.py L293-296），但生产 server.api_key 非空时全局中间件行为不同

### 待补项 3：.diagram-viewer 与 .mermaid-content 渲染链关系（已闭合，重大发现）
- 现状渲染链：useMarkdown 结构化 blocks → MarkdownViewer v-for → DiagramBlock.vue（.diagram-block[data-type] 根节点 → .diagram-view-toggle / .diagram-action-btn.fullscreen-btn(title=Fullscreen) / .diagram-viewer(v-show diagram) / .diagram-code(v-show code)）→ MermaidRenderer.vue（.diagram-svg-container + .diagram-modal/.diagram-modal-content/.diagram-modal-toolbar + openFullscreen defineExpose）。全屏 modal 类名是 .diagram-modal（无 overlay 后缀）
- `.mermaid-content` 在当前 src **不存在**（0 命中），git 历史属旧组件 MermaidDiagram.vue（f264e58a 2026-06-27 删除，同 commit 建 DiagramBlock）；static 构建产物同样 0 命中（正向对照：diagram-viewer/diagram-block/diagram-action-btn/diagram-modal 均 2 文件命中）
- `.mermaid-action-btn`（spec 全屏按钮选择器）当前 0 命中 → 死（现存 .diagram-action-btn.fullscreen-btn）；`.diagram-modal-overlay`（spec modal 选择器）当前 0 命中 → 死（现存 .diagram-modal）
- 时间线定案：66e83428（2026-06-27 16:01，"update class names for diagram refactor"）晚于 f264e58a，但该 commit 时 src 已无 mermaid-content/diagram-modal-overlay——它把 mermaid-check 的 .mermaid-content.diagram-mode 正确改成 .diagram-viewer（现存✓），却把 modal 改成 .diagram-modal-overlay（死✗），且 mermaid.spec 的 .mermouth-content[data-mode]/.mermaid-action-btn 完全没改（死✗）。两个 spec 的死选择器自 2026-06-27 存续至今
- **范围影响（SCOPE+ 级）**：仅自建 entry 无法让 mermaid.spec/mermaid-visual.spec 转绿——死选择器必先修复。mermaid.spec test1(.mermaid-content)/test3(.mermaid-action-btn+.diagram-modal-overlay) 死；test2 toggle 主体活。mermaid-check.spec 选择器全部存活（.diagram-block/.diagram-viewer），单 test 无 modal 部分，不涉及死选择器。mermaid-visual test1 的 .mermaid-content 被 if(isVisible)+catch 包裹→死选择器恰好被假绿掩盖；test3 modal 选择器死。P0-brief「仅 fixture 自建即全绿」的预期不成立，需并列「选择器迁移到现存 DOM」需求（仍在"只改测试代码"约束内）

### 待补项 4：playwright.config.ts project 口径（已闭合）
- projects 恰 2 个：chromium（Desktop Chrome）+ Mobile Chrome（Pixel 5，actionTimeout 45s、retries CI?3:2）；均支持 cdpEndpoint: CDP_ENDPOINT env
- run-e2e-tests.sh：export BASE_URL=http://127.0.0.1:$PORT(:8888)；CDP Chrome(:18800) 探活可用则 export CDP_ENDPOINT（本机有 → 默认走 CDP 模式）；`npx playwright test $spec` 不带 --project → **两个 project 都会执行**
- mermaid-visual.spec 每个 test 内 `chromium.launch({headless:true})` 自起浏览器（Playwright test 框架仍按 2 project 注册 → 同一 test 主体跑 2 遍）+ viewport 硬编码 1280x800
- **P0-brief 基线表述修正**：「chromium+Mobile」两 project 配置属实，但需补充：mermaid-visual 自起 chromium 与多 project 的叠加影响 = 该 spec 每 project 各跑一遍全部 test（2×3 test），断言 viewport 与 project 设备无关（自起实例 1280x800）；验收统计口径应按"每 project 内全绿"

### 即将执行（bash，预期 <30s）：P0 时效性复核 + 同类扫描
- seed-data 子目录计数与 3 slug 缺席复核；3 slug 全仓引用清单；e2e 目录 createEntry 使用者清单；goto /entries/ 旧路径实例；e2e spec 文件清单

### 同类扫描（已完成，结论将写入 P1 正文）
- 3 slug 全仓命中 11 文件：3 个目标 spec（处理）+ t022-diagram-refactor.spec.ts（7 test 全部死路径 /entries/* + 死选择器 .mermaid-action-btn/.toolbar-btn，依赖 test-plantuml-2/test-svg-2 等更多 fixture）+ verify-mermaid.spec.ts（死路径 /entries/test-mermaid-2-2）+ viewer.spec.ts（e2e-test-code 等自建、正确 /:slug 路径、无清理钩子）+ mcp-e2e.test.ts（clientInfo 名/时间戳 slug，子串巧合）+ CHANGELOG/docs/Makefile（文档与 run-e2e-tests 子串巧合）
- seed-data 24 条复核一致（今日重验）：无 test-mermaid-2/playwright-test/e2e-test；mermaid-charts 存在含 flowchart/gantt/sequence 图（viewer.spec 依赖存活）
- createEntry 无清理家族：render-regression（t085-*）/viewer/html-render/structured-data-viewer（t075-*）/mermaid 目标 3 spec 前身——同 DEBT0008 模式家族；t049 有 beforeEach 防御性预删（L9，404 容忍）无 afterEach
- router.ts 现状：仅 /:slug（L48），无 /entries/:slug 路由或 redirect——goto /entries/xxx 落入 pathMatch 通配 → NotFoundView，旧路径必死（与 AGENTS 铁律 7 一致）
- t022/verify-mermaid 判定：本次不处理（超 P0 三 spec 范围，DEBT0010 closure criteria 仅列 3 spec），SUGGEST 延后并登记 roadmap/debt

### P0-brief 时效性核对（已完成）
- 今日复核 seed 现状（24 条/3 slug 缺席）与 P0 实证一致；debug 环境/dev-server 配置未变；task 目标方案（自建 entry 化）仍成立；executor_env 前提（:8888 隔离/CDP）未变
- 结论：已核对，无漂移。死选择器发现属 P0 known_risks 预留口子（"断言强度未知需 P1 实读确认"）的定案，走 [SCOPE+ from P1] 增补基线，不构成 P0 字段漂移；"chromium+Mobile" 口径修正属 P1 细化本职（P0 明文交 P1 细化）

### 即将执行（write + field-set + check-frontmatter + grep，预期 <60s）
- 产出 P1-requirements.md 正文 → agate-md-field-set.py --list → 逐字段 set → check-frontmatter.py 校验 → grep -c BDD 确认落盘

### 产出完成（2026-09-07）
- P1-requirements.md 落盘：13 条 BDD（BDD-1~13 连续编号，Given/When/Then），含同类扫描节（11 文件命中+逐条判定）与 P0 时效性核对（已核对无漂移），[NO_NEED_CONFIRM] + 4 条 [SUGGEST]，[SCOPE+ from P1] 死选择器增补基线
- frontmatter（agate-md-field-set 写入）：risk_level=medium / phases=P1-P8 / packages=[frontend-v3, docs] / domains=[frontend] + phase/task_id/parent/trace_id/status/created Header 字段；check-frontmatter.py exit 0
- 工具白名单限制（已报告主 Agent）：agent / ui_render_shape / ui_ux_dimensions / ceremony / design_trivial / follows_existing_pattern / internal_only 等不在本版 field-set 合法 key 清单——ceremony 缺省 standard（fail-closed 不薄化）、形态缺省 layout 型、其余字段语义在正文第 7 节以文字声明
- [PROD_NOT_TOUCHED]：全程仅读仓库文件与 git 历史对比，未启动服务、未触碰 :8080 与 ~/.peekview/

### 修复轮（2026-09-07，P2-review needs-revision，主 Agent 批准基线变更）
- §7 顶部插入行首顶格 design_trivial: true（L226）与 follows_existing_pattern: [...]（L227）+ [BASELINE_CHANGE] 标注行（主 Agent 2026-09-07 批准，P2 评审 P-1：顶格供 check-gate.py P2 机械扫描）；§7 原文字说明保留对账
- 校验：check-frontmatter.py exit 0；grep -n ^design_trivial 命中 L226；BDD 13 条/8 节结构零变更
