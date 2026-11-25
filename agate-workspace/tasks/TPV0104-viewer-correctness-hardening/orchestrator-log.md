# TPV0104 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- DECISION: 7 项合为一个任务而非拆多个——同属 Viewer 展示层与资源边界，V-01/V-02/V-04/V-08 全在前端渲染链路上，拆开会重复改动同一批文件（useMarkdown / useEntryDetailComputed / TableView / HtmlViewer / entryDetail）
- DECISION: V-01 只做轻量策略（前端优先级挑文件 + 后端确定性 order_by），**不新增 is_primary 字段**——该字段属 roadmap #57（含 schema 迁移 + MCP primary_path），报告亦明确建议"暂时不要增加 main_file 数据库字段"
- DECISION: V-04 选"截断时隐藏表头控件"而非"让排序过滤生效"——后者需把截断数据喂给 TanStack，且"前 N 行内排序"≠"全量排序"语义模糊易误导
- DECISION: V-05 只记录策略 + 补安全测试，**不改默认 CSP**——HTML Demo 是核心场景；且 `test_html_render.py` 的 `assert "https:" in csp` 是明确契约，改策略须同步改契约，属独立决策
- DECISION: V-03 只做第一阶段（提前终止 + 字节上限），**不引入 Web Worker**——报告明确建议"不要因为 CSV Viewer 存在就把 Peekview 变成数据分析平台"
- CORRECTION: 主 Agent 初判 V-04"已修复"是错的——把 `TableView.vue:60` 的 `v-if="!parsed.truncated"`（控制底部 table-controls）误当成表头控件已隐藏。用户指出后复核确认：`.th-sort-btn`(25-31) 与 `.th-filter`(32-37) 无 v-if，截断态 tbody 走 `parsed.rows` 而非 `pageRows`(=table.getRowModel().rows)，排序过滤与显示数据脱钩。已写 docs/reviews/v04-truncated-header-controls-20261124.md
- EVIDENCE: 8 项复验基准 `9a47df77`（main, 2026-11-24），逐条源码比对见 P0-brief"需求来源与复验结论"表
- NEXT: 等用户「开工」指令后进 P1（写 P1-dispatch-context-analyst.md + 注入 AGATE_CARD）
- DECISION（2026-11-24 16:10）: P0 范围扩展——合并 `docs/notes/issues-20261124-1553.md`。该文档把 V-01 从"默认入口优先级"扩展为「默认入口 + `?file=` 深链 + 全屏文件定位 + URL 状态同步」完整闭环，**取代**原 V-01 的一句话描述。BDD 19→40 条。
- EVIDENCE（实测 `9a47df77`）: 文档与现状有**四处冲突**，已写入 P0-brief §7.5：①参数名现状 `firstFileId`（EntryDetailView:234 / EntryCard:150 / EntryListRow:153），文档要求 `file` ②**详情页没有全屏按钮**（zen 仅靠 `f` keydown，EntryDetailView:239；唯一"全屏"是 DiagramBlock:177 的图表全屏）→ 文档 §4.1"复用现有全屏入口"前提不成立 ③`EntryDetailView:238` 的 `router.replace({query:{}})` 会**清空全部 query**，正是文档 §5.100 警告的误删坑 ④`EntryCard:150` / `EntryListRow:153` **无条件**传 `files[0].id` 作为 firstFileId，会绕过默认入口 resolver（文档 §3.49 警告）
- DECISION（2026-11-24 16:20）: 再合并 `docs/notes/issues-20261124-1612.md`。它与 1553 是**互补**关系：1553 定义 URL 语义与默认入口规则，1612 补上"普通详情页 → 全屏"的操作入口——恰好解决 1553 §4.1 假设但实测不存在的环节。决策 7.3 从"待 P1 定"改为**确定新增按钮**，含位置优先序（Header 工具区优先）与五条禁止项（不得只放文件树/不得每文件一个按钮/不得加选择器/不遮挡内容/不得假定 files[0]）。BDD 40→44。
- CORRECTION（2026-11-24 16:35）: **概念错误已修正**——此前把 `firstFileId` 与 `file` 当成「同一参数的两种拼写」并让 P1「二选一」，**这是错的**（用户指出）。实测二者语义不同：`firstFileId` 是**一次性种子**（`EntryDetailView.vue:238` 加载完即 `router.replace({query:{}})` 清除，页内切文件从不更新，刷新即丢），`file` 要求是**持续态**（刷新保留、切换同步、切回默认才移除）。**不是改名，是机制替换**。已写 §7.4.1 专节 + 冲突表第 1 行改写 + 5 处相关表述修正 + 新增 1 条 BDD（`?file=` 加载后必须仍在 URL）。BDD 44→45。
- EVIDENCE（补充实测）: `share` 参数为何能「消费即清」——`isShareAccess` 读的是 `currentEntry.shareContext?.isShareAccess`（服务端返回），不依赖 URL。所以 share 有服务端上下文兜底，而 `file` 没有 → 若照抄 share 的清除逻辑，刷新必丢。
- NEXT: 等用户「开工」进 P1。P1 剩余待定项：全屏按钮**具体位置**（Header 工具区 vs 新增轻量入口，含移动端不遮挡方案）；`?file=` 旧链接失效是否需兼容重定向。**参数名已无争议——必须是 `file`（持续态），`firstFileId` 机制被替换。**
- DECISION（2026-11-24 16:50，用户「开工」）：进 P1。范围**不再扩**——P0 已三次扩展（1429 → +1553 → +1612 → 概念修正），BDD 45 条。P1 的任务是**收敛可判定性 + 清 4 项待定**，不是再写需求。
- EVIDENCE（环境自检，本次会话实测）：步骤 1 全 PASS（pytest 9.1.1 / vue-tsc 5.9.3 / vitest 1.6.1 / ruff 0.15.18 / MCP node_modules 就绪）；步骤 2 debug `:8888` 已由后台 job 托底启动 + seed（19 entries / 24 seed / alice,bob,carol,dave）；步骤 3 版本 `peekview=0.27.1` 一致、git 干净；步骤 4 Chrome CDP 158 在线 + Playwright 截图实测成功（`.agate-tmp/env-check/desktop.png` 60844B / `mobile.png` 54172B，DOM 实测 75 个链接、title=PeekView）。生产 `:8080` 全程 000。**一处环境坑新发现**：`npx tsx` 因 `~/.npm` 只读必失败（EROFS），须用 `/home/kity/oclab/deepseek-harness/node_modules/.bin/tsx`；vision-engine 的 `~/.local/share/vision-engine/ratelimit` 只读，须 `HOME=<项目>/.agate-tmp/vhome` 重定向 + `PYTHONPATH=~/.local/lib/python3.12/site-packages`。
- EVIDENCE（视觉能力定论，继续上一条步骤 4）：`vision-engine` 可用但**默认 role 链不可靠**——quick role 首选 `xrouter/nx-vision` 实测 50s+ 延迟，280s 外层超时仍被 `connect_timeout` 掉；`alibailian/qwen3-vl-flash` 404、`google-free/gemini-flash-latest` 503。**可用配方：显式 `--model` 钉模型 + 90s 超时**，实测两个模型均返回正确描述（`xrouter/nx-vision` exit 0 / `volcengine/doubao-seed-2-0-lite-260428` exit 0，后者还准确数出 6 条卡片、recognize 搜索框与主题切换）。**结论：视觉能力 = available（supplementable 不需要），但 P6 派发必须写明用 `--model` 钉模型**，否则会踩默认链的 404/503/超时。`--self-test` 不做结论依据（280s 跑不完）。
- EVIDENCE（P5 基线预建，本任务改动前实测）：`make test-quick` = **1205 passed / 1 failed / 3 skipped**（33.4s）；唯一失败 `test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` 实测根因 `OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`（沙箱 `~/.peekview/` 只读），**与本任务无关的预存失败**，P5 须登记 known-failures.md。`make test-frontend` = **119 files / 1456 passed / 4 skipped / 0 failed**（19.4s）。这两组数字是本任务的对比基线。`make typecheck` exit 0、`make lint` exit 0（`All checks passed`），均实测。
- CORRECTION（2026-11-24 17:10，**我的 P0 记录被实测推翻**）：P0 §7.5 冲突表第 4 行称「`EntryCard.vue:150` / `EntryListRow.vue:153` 无条件传 `files[0].id` 会让 README 优先规则失效」——**表述不准确，该传递当前从不生效**。analyst 在 P1 期间报出后我**亲自实测三条证据**：① 列表接口 `GET /api/v1/entries` 响应**无 `files` 字段**（实见响应体只有 `file_count`）；② `client.ts:91-99` 的 `transformListItem` **硬编码 `files: []`**；③ 两组件唯一挂载点 `EntryListView.vue:169/184` 的 `entries` 全部来自 `listEntries`。**浏览器实跑印证**：点多文件 entry `multi-format-demo`（4 文件）卡片后 URL = `http://127.0.0.1:8888/multi-format-demo`，**无 `firstFileId`**。→ 那段分支是**死代码**，改动性质是「删除死代码 + 消除错误范式」而非修正在生效的 bug。**已回写 P0-brief §7.5 冲突表第 4 行**，并明确 BDD 判据必须改为**代码级断言**（不能靠"点卡片看 URL"验证——现状本来就通过，那会得到假 PASS）。
- EVIDENCE（同批实测，确认其它冲突仍成立）：`/xml-maven-pom` 单文件 entry 点击后 URL 无参数、`fetch` 返回 `["pom.xml"]`；`extractHeadings`/`slugify` 双套解析、`useCsvParser.ts:7` 全量 parse、`TableView.vue` 表头无 v-if、`HtmlViewer.vue` 用 `content.length`、`html_render_service.py:17/72` 静默截断、`entry_service.py:1425` 无 order_by —— 全部与 P0 记录一致。
- EVIDENCE（默认入口 BDD 的 seed 素材，P6 实跑要用）：`scripts/seed-data/` 实测多文件 entry 10 个——**根目录有 README.md**：`k8s-deployment`(3 files) / `product-screenshots`(2) / `unicode-filenames`(8)；**根目录无 README 也无 index.md**：`edge-case-data`(6) / `markdown-test`(2) / `mermaid-charts`(3) / `multi-format-demo`(4) / `python-entry-service`(2) / `svg-icons`(2)；`image-gallery` 0 文件。→ **seed 里没有「有 index.md 无 README.md」的 entry**，BDD 中「无 README 但有 index.md → 展示 index」这条 P6 必须**现造 entry**（走 debug HTTP API，禁 CLI），不能指望 seed。这是 P1 需要写进 BDD 的环境约束。
- EVIDENCE（**P6 实跑的两个硬约束，P1 必须写进 BDD 的环境前提**）：
  ① **CSV 截断态无法靠 seed 触发**——`TableView.vue:127` `maxRows` 默认 **50000**，全仓**没有任何 view/组件覆盖它**（`grep maxRows` 除 TableView 自身与单测 `:184` 外零命中）；seed 里最大的 CSV `tsv-server-metrics.tsv` 只有 61 行。→ V-04（截断态隐藏表头控件）、V-03（提前终止）两类 BDD 的 P6 实跑**必须**用 `maxRows` prop 注入小值（如 5）或现造 5 万+ 行数据走 HTTP API，不能指望 seed。
  ② **「无 README 但有 index.md」的 entry 在 seed 中不存在**——须现造（走 debug HTTP API，禁 CLI）。根目录有 README 的仅 `k8s-deployment` / `product-screenshots` / `unicode-filenames`。
  若 P1 未声明这两个前提，P6 会在"以为能跑"时才发现跑不了，属验收路径缺失。
- EVIDENCE（**验收手段分层的实测定论，决定 P6 每类 BDD 该在哪一层验**）：
  - **后端 V-06/V-07（注入预算）→ pytest 层可完全自足**：`backend/tests/test_html_render.py:27` 的 `client` fixture 用 `create_app(data_dir, db_path)` + `tempfile.mkdtemp()` 建**独立临时 app/DB**，`:45` 的 `_create_entry` 可按需造任意多文件 entry（现有 `test_render_inject_css/js` 即二文件构造）。→ 50 个上限、总字节预算、单文件超限、超限反馈全部可用 pytest 造，**不依赖 debug 服务与 seed**。
  - **前端 V-04（截断态控件）/ V-03（提前终止）→ 须注入 `maxRows` 小值**：`TableView.vue:127` 默认 50000 且无 view 覆盖，seed 最大 CSV 仅 61 行。单测可直接传 `maxRows: 5`（`TableView.spec.ts:184` 已有先例）；E2E 层则须现造 5 万+ 行或接受只在单测层验。
  - **前端 V-01/V-02b（默认入口、`?file=`）→ 须走 debug `:8888` + 现造 entry**：seed 无「有 index.md 无 README」样本，且 `?file=` 的刷新保留/切换同步是**跨请求行为**，单测靠 mock router 无法证真。
  - **V-08（字节数）→ 单测可证**：`HTML_VIEWER_TEST_SIZE_KEY` 已有注入后门，但**注意**：用它注入 size 会绕开"从 `file.size` 取值"这一被测行为本身，P6 须同时有一条走真实 `file.size` 的断言（否则是假 PASS 风险）。
- EVIDENCE（**V-02 的修复面比 P0 预估更窄，且已有一条现成通路**）：`MarkdownViewer.vue:109-111` 已经 `headings.value = result.headings` **并 `emit('headings', result.headings)`**——即 markdown-it token 流产生的正确 headings 数组**已经流出到组件外**，但全仓**没有任何父组件监听该事件**（`grep "@headings"` 在非测试代码零命中）。→ V-02 可以是**接线 + 补去重**级改动（P0 决策 1 判断成立），不需要重写渲染管线。
  - **一处自我更正**：我最初写"传给 MarkdownViewer 的 `:headings` prop 是单向输入、与内部 ref 同名冲突"——**错了**。复核 `MarkdownViewer.vue:22-31` 确认：`defineProps` 只有 `content/pathMap/slug` **三个**，**没有 `headings` prop**；`:28` 的 `headings: [headings: TocHeading[]]` 是 `defineEmits` 的类型声明，`:37` 的 `const headings = ref<TocHeading[]>([])` 是内部 ref，`:3` 的 `<slot name="toc" :headings="headings">` 消费的是该内部 ref。三者各有其职，**不存在同名冲突**。教训与 TPV0103 同源：把"看起来像 prop 的 emit 声明"当成 prop，属未核对权威源就下判断。
  - 留给 P2 的真实设计问题（不是冲突，是选择）：`EntryDetailContent.vue:56` 传的 `:headings="tocHeadings"` 实际**没有对应 prop**（Vue 会当 attr 透传，无功能作用），TOC 数据真正来源是 `MarkdownViewer` 内部的 ref / emit。若 P2 选"接线 emit"，这个无效绑定应一并清掉。
- EVIDENCE（**`/f` 全屏态现状实测：文件树仍在，BDD-24 现状 FAIL**）：Playwright 实跑 `http://127.0.0.1:8888/k8s-deployment/f`（3 文件 entry）得 `.entry-detail` class = `entry-detail zen-mode`（zen 生效）、`.detail-header` 存在但 `display:none`（被 CSS 隐藏）、**`[class*="file-tree"]` = true（可见）**、`.toc-sidebar` 存在。根因两条：① `EntryDetailView.vue:281-284` 的 zen-mode CSS 只隐藏 `.detail-header` / `.mobile-sticky-header` / `.mobile-bottom-bar` / `.meta-tags-bar`，**没有文件树**；② `:244` 与 `:273` 在多文件 entry 下**自动** `isFileTreeOpen.value = true`，`:4` 的 `<aside v-if="isFileTreeOpen && isMultiFile">` 因此渲染。
  - 同时实测 `/k8s-deployment/f?firstFileId=15` 确实选中了第 3 个文件（内容为 Service 的 `apiVersionv1kindServicestring...`），**但 URL 被清成 `/k8s-deployment/f`** —— 这印证 §7.4.1：`firstFileId` 能被消费，但**消费即从 URL 消失**，正是 `file` 必须改为持续态的直接证据（若沿用 `firstFileId`，全屏分享链接无法表达"看哪个文件"）。
  - **对 P1 的影响**：BDD-24「全屏模式无文件树/无选择器/无 Header」在当前实现下**不成立**，是真实新增需求而非回归守护。P1 必须把它写成**新增行为**，且 P2 要决定"zen 态是否强制收起文件树"（涉及 `isFileTreeOpen` 的自动展开逻辑是否按 zen 分支）。
- EVIDENCE（**V-02 三类缺陷全部实测复现，不再只是静态比对**）：现造 entry `ol7sxy`（`probe.md`，含重复 `## 设计方案`×2 + 围栏内 `## 示例` + Setext `Setext 标题`）后 Playwright 实读：
  | 缺陷 | 实测 | 判定 |
  |---|---|---|
  | 重复标题 ID 不唯一 | 正文两个 `<h2 id="设计方案">`，**ID 完全相同** | 缺陷成立，第二个标题无法被锚点命中 |
  | 围栏内标题误入目录 | TOC `.toc-list` 含「示例（代码块内）」，但正文 h2 列表**无此项** | 缺陷成立，TOC 条目指向不存在的锚点 |
  | Setext 标题收不到 | 正文 `<h1>Setext 标题</h1>`（**无 id**），TOC 无此项 | 缺陷成立；注意**双向都缺**：正文没给它 id，TOC 也没收它 |
  - **一处比 P0 更精确的发现**：P0 决策 1 只提"TOC 收不到 Setext"，实测是**正文侧也没给 Setext 标题 id**（`useMarkdown.ts:332` 的 `level >= 2 && level <= 4` 过滤把 Setext `===` 产生的 **h1** 排除了）。→ 若 P1/P2 只让 TOC 消费 `useMarkdown` 的 headings，Setext 仍然不会出现（因为 headings 里压根没有它）。**要修就得同时决定"是否给 h1 也生成 id"**，这是 P0 未覆盖的决策点，必须进 P1。
  - **TOC 的 DOM 结构**（P6 判据要用，已实测）：`.toc-sidebar` → `nav.toc-nav` → `h3.toc-title` + `ul.toc-list` → `li.toc-item.toc-level-{N}` → `a[href="#{id}"]`（`TocNav.vue:1-14`）。默认 `.toc-sidebar` **不渲染**（需点 `[aria-label="Table of Contents"]` 按钮，`:toggle-btn`）；关闭后整块从 DOM 消失。BDD 判据必须写明"先点开 TOC"这一前置。
- EVIDENCE（**全屏按钮落点已实测：header 是全屏时最先消失的东西**）：`EntryDetailHeader.vue:3`（移动端 `.mobile-sticky-header`）与 `:13`（桌面端 `.detail-header`）**都带 `v-show="!zenMode"`**；`EntryDetailMobileBar.vue:2` 同样 `v-show="!zenMode"`；`EntryDetailView.vue:281-284` 的 zen CSS 又叠了一层 `display:none`。→ **把「全屏阅读」按钮放在 header 工具区，则一进全屏该按钮立即消失**——这不是缺陷（全屏里本就不需要它），但它意味着**退出全屏没有任何可视入口**：`useZenMode.ts:19` 的 `handleZenKeydown` 在 `locked()`（即 `/:slug/f` 路由）时**首行直接 return**，`f` 与 `Escape` 全部失效，唯一出路是手动改 URL 或浏览器后退。DESIGN.md §6 对此的表述是"需改 URL 离开"。
  - **对 P1 的直接影响**：BDD 现有一条「移动端全屏入口可触达且不遮挡主要内容」，但**没有任何一条**规定"进入 `/f` 后如何退出"。这是 P0 与 1612/1553 两份文档都未覆盖的空白。P1 须显式决策：`/f` 是**只读分享态**（无退出，靠浏览器后退，现状语义）还是**可交互态**（需加退出按钮）。若选后者，按钮不能放 header（会一起隐藏），须放内容区或独立浮层——与 1612 的"不遮挡主要内容"要求直接冲突，需权衡。**这是本阶段必须收敛的待定项，不得推给 P2。**
- DECISION（2026-11-24 17:28，**用户定夺，两项 P0 未覆盖的空白已收敛**）：
  1. **`/{slug}/f` 语义 = 只读分享态**：不加退出按钮，靠浏览器后退离开。依据：现状 `useZenMode.ts:19` 在 `locked()` 时 `f`/`Escape` 全部失效、header 因 `v-show="!zenMode"` 自动隐藏，本就是纯只读态；加退出按钮必然落在内容区、与 1612「不遮挡主要内容」（尤其移动端）冲突，而 `/f` 的设计意图（1553/1612）是深链分享而非日常阅读器。→ **P1 须写一条 BDD 显式规定"`/f` 不引入退出按钮"**，避免 P4 阶段有人"顺手加个按钮"违反设计意图。
  2. **Setext 标题 = 给 h1 生成 id 并纳入 TOC**：依据：P0 BDD 已要求「Setext 标题 When 渲染 Then TOC 包含该项」，若维持 h2-h4 过滤则该 BDD 永不成立；实测已确认正文侧 h1 也无 id（`useMarkdown.ts:332` 的 `level>=2 && level<=4` 过滤），双向都缺。→ TOC 层级扩为 **h1-h4**，且正文对所有进 TOC 的层级**统一生成 id + 统一去重**。P1 须据此改写 V-02 相关 BDD（原 BDD-3「Setext 标题进 TOC」变为可达），并注意副作用：文档首个 h1 大标题会出现在目录中（属预期，非缺陷）。
  - 两项决策均由用户明确选择，不是主 Agent 推断。**P1-requirements.md 必须体现这两条**，未体现则评审打回。
- EVIDENCE（决策 A 的文档依据，**补强而非新造**）：`DESIGN.md:210-212`（§6 Zen Mode）原文已写 "Fullscreen link `/{slug}/f`: same view, entered by URL for sharing. Zen is **locked** — `f` / `Escape` change nothing, and the announcement does not advertise an exit. Leaving requires editing the URL. Works with `?share=<token>`." → **用户选的「只读分享态」是既有设计意图的确认，不是语义变更新增**。这对 P1 很关键：BDD 应写成「保持既有锁定的全屏语义，不引入退出入口」这一**约束型**验收，而不是新功能验收。同时说明我在提问时把"退出无入口"描述为"P0 与两份文档未覆盖的空白"**不够准确**——DESIGN.md 覆盖了，只是 P0-brief 与 1553/1612 没引用它。已在此更正。
- EVIDENCE（**V-07 的静默截断是「前端不知道自己被截断」，数据流已实测**）：`HtmlViewer.vue:143-153` 的 `renderUrl` **无任何上限**地把 `props.siblingFileIds.join(',')` 全量拼进 `?inject=`；后端 `html_render_service.py:55-75` `parse_inject_ids` 才截到 `_MAX_INJECT_IDS=50`（`:72` 静默 `break`，返回值**不含"被截掉多少"的信息**）。前端拿到渲染结果**无从得知少了文件**——这正是 P0 决策 4 所说"用户看到的是渲染成功但资源不全的假象"。→ **P2 的设计新点**：超限反馈必须由**后端把截断信息带到响应里**（如响应头/注记注释/DOM 标记），或前端先自行限流并提示；两条路各有代价（前者改渲染契约、后者前端需知道上限），**P1 只须把"必须显式反馈"写成 BDD，选哪条留 P2**。
  - 另注意 `:44`/`:48` 的 `_BINARY_SIZE_LIMIT = 768*1024` 在 **`api/files.py` 与 `services/html_render_service.py` 两处重复定义同一数值**——P2 若统一预算模型，须先决定这个常量的单一来源（否则改一处漏一处）。
- CORRECTION（**analyst 发现我漏掉的同类实例，已亲自复核确认**）：V-08 的"字符数当字节数"不止 `HtmlViewer.vue` 一处——`TreeView.vue:73-75` 有 `const MAX_SIZE = 2 * 1024 * 1024` + `const truncated = computed(() => props.content.length > MAX_SIZE)`，**同一错误范式、同一数值**，作用于 YAML/JSON 树视图的截断判断（seed 中有 `yaml-docker-compose` / `json-api-config` 等真实样本）。→ V-08 的修复面应为**两处共用同一字节数工具函数**，而非只改 HtmlViewer。P1 须把这条纳入同类扫描结论并在 BDD 中覆盖；P2 须给出单点实现（避免又出现两处各自算）。**我的扫描此前只查了 HtmlViewer，属覆盖不全，已并入。**
- EVIDENCE（**V-08 改用 `file.size` 可行，已实测确认是真实字节数**）：前端 `client.ts:70-80` 的 `transformFile` **已映射 `size: file.size`**，即 `Entry.files[].size` 在前端**现成可用**，无需改后端契约。后端 `entry_service.py:319` `size=len(content)`，而 `:291` 的 `content = fi.get("content_bytes", b"")` 是 **bytes**（不是 str）→ `len()` 就是字节数。**实测交叉验证**：`multi-format-demo` 四个文件的 API `size` 与 `wc -c` **逐项相同**（466/335/255/756），其中 `notes.md` 含中文、字符数远小于 756，证明是字节而非字符。
  - **一处自我更正（当轮内）**：我中途曾判断"`size=len(content)` 是 Python 字符数、改用 `file.size` 仍会算错"——**错了**，因为 `content` 来自 `content_bytes`（bytes）。已当场核对字节值并撤回该判断。教训：`len()` 的语义取决于操作数类型，**必须回看到赋值源**，不能凭函数名 `len`/`size` 推断。
  - 结论：V-08 的方案（P0 决策 5「优先 `file.size`、`content.length` 兜底」）**技术上零阻力**；`TreeView.vue` 同型缺陷也可用同一 `file.size` 修（其 props 需增 `size` 传入）。
- EVIDENCE（**V-03 有一个 P0 未记录的硬冲突：提前终止 vs 未闭合引号校验**）：`useCsvParser.ts:57-59` 在扫描结束后 `if (inQuotes) throw new Error('CSV 解析失败：存在未闭合的引号')`，而 `useCsvParser.spec.ts:68` 有**明确契约** `expect(() => parseCsv('a,b\n"unclosed', ',')).toThrow()`；`TableView.vue:187-189` 捕获后 `emit('parse-error')` 展示给用户。
  - **冲突本质**：要判断"引号是否闭合"必须扫到输入末尾；而 V-03 要"达到 maxRows 就停止构造数组"。**这两件事可以共存但不显然**——正确解法是**拆成两个职责**：① 行数预算只限制**把行 push 进结果数组**（`rows.length >= maxRows` 后不再 push，但仍逐字符推进状态机以维持 `inQuotes` 正确性与 `totalRows` 计数）；② 扫描本身仍然走完全文。→ P0 决策 2 说的"达到上限即停止构造数据数组，但仍继续扫描输入以统计 totalRows"**方向正确且已隐含此解**，但 P0 没提"必须同时保住 unclosed-quote 校验"。**P1 须把这条写成 BDD 回归项**（超限且引号未闭合 → 仍 throw），否则 P4 若图省事直接 `break` 出循环就会静默破坏既有契约。
  - 另：V-03 调用点极集中——`parseCsv` 全仓仅 `TableView.vue:186` 一处生产调用，改动面小、风险低。
- EVIDENCE（**V-06/V-07 零测试覆盖 + 插入点唯一**）：`backend/tests/` 全仓 grep `MAX_INJECT|parse_inject_ids|budget|50` **零命中**（`test_html_render.py` 46 个测试里只有 `test_process_css_refs_depth_limit` 涉及 CSS 递归深度，与注入数量/字节预算无关）。→ 50 上限、总字节预算、单文件超限**都是纯新增覆盖**，没有既有契约要迁就（与 V-03 的 unclosed-quote 契约形成对比）。
  - **插入点唯一且清晰**：`api/files.py:330-343` 是"解析 inject IDs → `get_files_by_ids` 取记录 → `_build_sibling_data` 组装 → `inject_resources` 注入"的唯一通道。预算累计可在 `:332-338` 的组装循环里做，超限信息可挂到 `:345-355` 的 `Response` headers 或注入注记——**不需要改动 `inject_resources` 内部**（它只负责 HTML 变换）。这降低了 P2 的设计自由度但也降低了风险。
  - `parse_inject_ids` 目前**只回传 list[int]**（`:55-75`），丢失"被截掉多少"的信息 → 若要显式反馈，签名需扩展为返回 `(ids, dropped_count)` 之类的结构。P2 须决定是改签名还是另算。
- EVIDENCE（**默认入口 resolver 无可复用件，须新建；但命名易混淆点已澄清**）：全仓 grep `resolveDefaultFile|is_primary|primary_path` 在非测试代码**零命中**（只有 `AuthButton/TableView/TreeView` 等的 CSS 变量 `--text-primary` 同词噪音）。唯一看着相关的是 `utils/path-map.ts` 的 `PathMapEntry.priority`（1/2/3），但实测其语义是**同一 key 有多条候选时的取值优先级**（`:28-52`：`file.path` 精确匹配=1、`filename`=2、basename 兜底=3），用于路径引用解析（`resolvePath`），**与"哪个文件是默认入口"毫无关系，不可复用**。→ resolver 必须新建，且 P2 须明确它的**输入是完整 `Entry.files`（含 path/filename/id）**，输出是单个 File。
  - **给 P2 的命名提醒**：新函数不要叫 `priority`/`primary` 之类与他人撞词的词，否则后续 grep 会把两套语义混在一起（本次扫描已经踩到 CSS 变量噪音）。
- EVIDENCE（**`firstFileId` 机制替换的 e2e 连带面清单，P4/P5 必须一并迁移否则大面积变红**）：全仓 e2e 引用 `firstFileId` 共 **3 个 spec / 8 处**（analyst 统计 8 处，我复核一致）：
  | spec | 处 | 用途 |
  |---|---|---|
  | `viewer.spec.ts` | `:21`（`openMarkdownFile()` 辅助函数）+ `:214`（TC-023 注释说明依赖） | `/markdown-test?firstFileId=<md.id>` 打开非默认的 markdown 文件 |
  | `t091-mobile-detail-visual-polish.spec.ts` | `:95` + `:321` + `:10/:12`（注释） | `${MARKDOWN_ENTRY}?firstFileId=${MARKDOWN_FILE_ID}` 打开非默认 markdown 文件测移动端 padding |
  | `tpv0099-fullscreen-link-auth.spec.ts` | `:101` + `:65/:99`（注释） | `/{slug}/f?firstFileId=` 全屏 + 指定文件的组合 |
  - **关键**：`tpv0099:99` 的注释明确写「须带 `?firstFileId`；fileId 动态解析」，且 `:65` 有「P2 §8 硬约束：勿硬编码 `?firstFileId=43`」的动态解析辅助函数 —— 说明这些 spec **本就依赖该参数生效**。机制替换为 `?file=` 后，这 8 处必须同步改，否则 **3 个 spec 全红**。
  - **反向价值**：这 8 处恰好是「`?file=` 持续态」的现成验收素材——改完后它们应全部继续通过，可作为**回归等价性证据**（旧行为在新参数下仍成立）。P1 应把这条写成 BDD 或至少写进环境约束，P5 须实跑这 3 个 spec。
- EVIDENCE（**完整 gate 基线已建齐，P5 直接对比**）：本次会话实测全部本任务相关 gate——`make test-quick` 1205 passed / 1 failed（预存，`~/.peekview/` 沙箱只读）/ 3 skipped；`make test-frontend` 119 files / 1456 passed / 4 skipped / 0 failed；`make typecheck` exit 0；`make lint` exit 0（All checks passed）；`make check-docs` exit 0（文档一致性全过）。→ P5 的判据是「这五组数字不劣化 + 新增测试全绿」，不劣化基线已固定。
- EVIDENCE（**P0 决策 5 的遗留待定「`>= 2MB` 是否为预期」→ 已有确定答案：是预期，且已被测试锁定**）：`HtmlViewer.spec.ts:354-365` 有一条明确用例 **「恰好 2MB：不自动渲染，显示手动触发按钮」**（断言 `iframe` 不存在、`manual-render-btn` 存在），与 `:338-350`「恰好 512KB：显示警告但仍自动渲染」配对。→ 语义是**左闭右开**：512KB 含（`>=`）、2MB 含（`>=` 即阻断）。**P1 不需要再"确认是否预期"**，只需在 BDD 中保持该边界语义不被破坏（回归项），并注意 V-08 改造（改用 `file.size`）后这两条边界测试**必须仍全绿**——若改成字节数后阈值数值也调整，须同步改这两条断言，否则是"自己改标准 + 自己判通过"。
  - 附带：这些用例都用 `HTML_VIEWER_TEST_SIZE_KEY` 注入假 size 来避免造真实大字符串 → 印证了我先前的假 PASS 风险判断：**全套现有 size 测试都没走过 `file.size` 真实路径**，V-08 必须新增至少一条走真实 size 的断言。
- EVIDENCE（**造 2MB+ HTML 测试素材的可行性已实测确认，无阻碍**）：`config.py:34-56` 的 `PeekLimits` 有三个 size 限额——`max_file_size=20MB`、`max_content_length=1MB`（注释"Maximum content length for **inline uploads**"）、`max_entry_size=100MB`。**关键**：`max_content_length` 在代码中**没有任何强制执行点**（全仓仅 3 处引用：`config.py:42` 定义、`:90` validator、`tests/test_config.py:17` 断言默认值），真正生效的只有 `entry_service.py:1235-1245` 的 `max_entry_size` 与 `max_file_size`。→ **造 2MB / 3MB 的 HTML 文件走 HTTP API 完全可行**（远低于 20MB），V-08 的 P6 实跑不需要 stub。analyst 主动提出的"1MB inline 上限是否阻碍 2MB 造件"这个疑问，答案是**不阻碍**（该限额未被使用）。
  - 这条同时是个**既有缺陷线索**（不属本任务范围）：`max_content_length` 是死配置——声明了却没校验。若后续要治，应单独立项，**本任务不处理**（避免范围蔓延）。
- CORRECTION（**我误判 P1 产出，当轮已自纠**）：初读 `P1-requirements.md` 前 9 行即断言"frontmatter 缺 `risk_level/phases/packages/domains` 四个必填机器字段"。**错**——字段完整存在于 frontmatter 第 10-31 行（`risk_level: medium` / `ceremony: standard` / `phases: P1..P8` / `packages: [peekview, frontend-v3, docs]` / `domains: [frontend, backend]` / `ui_render_shape: layout` / `ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]`），`agate-md-field-set.py --list` 也显示四个字段"当前值"齐全。我漏看的原因是把 `sed -n 1,40p` 的输出截断处误当文件头结束。教训：**判断"字段缺失"必须以完整 frontmatter 块（首尾 `---` 之间）为准，不能用行数窗口推断**。
- EVIDENCE（P1 产出规格实测通过）：`P1-requirements.md` 56871 字节 / 54 条 `#### BDD-` 编号（P0 的 45 条倾向 + 补充决策带来的 9 条）；`[NO_NEED_CONFIRM]` 已声明；决策 A/B 均写入正文第 1 节；`capability_requirements` 在 `:602`。
- EVIDENCE（**seed 完整性 + 一处既有 e2e 隐患，均实测**）：
  - **我之前对 seed 的判断是错的**：首轮读到的「15 匿名 / 19 alice 可见」是**seed 尚未跑完的中间态**（`make debug-start && make debug-seed` 在后台 job 里串行执行，我在中途就查了）。重跑 `make debug-seed` 后实测 **22 entries 入库**（`Total entries: 22`），alice 可见 22、匿名可见 15。差异来源：`team_id` 会 **`Forces is_public=false`**（`entry_service.py:200` 注释原文）→ 归属团队的那几个 entry 匿名 404。`image-gallery` 仍 404 是**真实情况**：其 `files=0`，seed 的 `:184` `SKIP {slug}: no content files` 直接跳过（与 TPV0102 记录一致）。
  - **`markdown-test` 匿名 404 是真实约束**：其 `meta.json` 写 `owner: alice` + `team_id: frontend-team`（**同时写 `is_public: true` 但被 team 强制覆盖为 false**），所以匿名必 404、alice 登录后 200。
  - **由此暴露一处既有 e2e 隐患（非本任务引入，但本任务 P5 会遇到）**：`viewer.spec.ts:18,184,198,282` 直接 `page.request.get('/api/v1/entries/markdown-test')` 与 `page.goto('/markdown-test...')`，**而 `playwright.config.ts` 完全没有配置 `storageState`/登录态**（`use` 块只有 baseURL/trace/screenshot/timeouts）→ 这些用例在匿名下应得 404/空态。**P5 须实跑确认它是否已红**；若已红则登记 known-failures（既有），**不得算作本任务引入**。analyst 已在 P1 §10「依赖与前置条件」正确标注该约束并避开用它做人工体验样本。
- CORRECTION（**评审者推翻我的一条实测记录，我已复核确认它正确，我的更错**）：我先前记「`.toc-sidebar` **默认不渲染**，须先点 `[aria-label="Table of Contents"]` 按钮」——**错**。`EntryDetailView.vue:245` `if (isMarkdown && tocHeadings.length > 0) isTocOpen.value = true` → **markdown 有标题时 TOC 默认就是展开的**。我先前探针之所以读到空 TOC，是因为我**先点了一次按钮，把默认展开态关掉了**。重新实测（不点击，直接读）：
  - `.toc-sidebar` 存在、`[aria-label="Table of Contents"]` 的 `aria-expanded="true"`；
  - TOC 条目：`设计方案` / `设计方案` / `示例（代码块内）` / `结论`，对应 href `#设计方案` / `#设计方案-1` / `#示例代码块内` / `#结论`；
  - 正文 h1/h2：`大标题`(H1, **id 空**) / `设计方案`(H2) / `设计方案`(H2, **id 与前者相同**) / `Setext 标题`(H1, **id 空**) / `结论`(H2)。
  - **由此得到两条比我先前更精确的结论**：① **TOC 侧的去重是正常的**（`设计方案-1` 后缀生效）——缺陷在**正文侧不去重**，两者对不上；② 围栏内标题确实误入 TOC；③ h1（含 Setext）正文无 id、TOC 也无该项。
  - **对 P1 的实质影响**：BDD-01~04/06/53 等所有 TOC 相关 BDD 若把 When 写成「点开 TOC」，**在桌面端会把默认展开态关掉 → 判据反向 FAIL**。必须以**不点击的默认态**为前提（或按视口分别说明）。这条已反馈给评审者，P1 须据此修正 When。
- EVIDENCE（**BDD-38 与 BDD-51 的可执行性，评审者提出、我已独立复核**）：
  - **BDD-38（超数量上限 → 跳过清单）当前措辞不可执行**：它要求「sibling 数量 N = 上限常量 + 1 = 51」的 entry，但 `entry_service.py:1230` `_validate_limits` 在 **`len(files_info) > max_entry_files`（默认 50）** 时直接 `raise PayloadTooLargeError` → **entry 层面根本造不出 51 个文件**，该 Given 不可达。**但并非无解**：`create_app(config=...)` 接受注入（`main.py:145-153`），且实测 `PeekLimits(max_entry_files=5)` 可覆盖默认值 → 正解是**在 pytest 里把 `max_entry_files` 与注入上限一起调小**（如 limits=3、上限=2），用少量文件达成同一语义。P1 须据此改写 BDD-38 的 Given，否则 P3/P6 会卡在造件上。
  - **BDD-51（迁移后 3 个 e2e spec 全绿）基线存疑**：`viewer.spec.ts` 依赖 `markdown-test`（team 可见 → 匿名 404）且 playwright **无 storageState**（`playwright.config.ts` 的 `use` 块只有 baseURL/trace/screenshot/timeouts）→ 该 spec **基线可能已红**。若已红，则「迁移后全绿」是**不可达判据**，须改为「迁移后失败集与基线失败集相同（无新增失败）」。评审者正在实跑确认。
- EVIDENCE（**`viewer.spec.ts` 基线已红的根因已溯源到具体 commit，属既有回归**）：评审者实跑 `E2E_SPEC=viewer.spec.ts` 得 **18 failed / 20 passed**，根因 `Cannot read properties of undefined (reading 'find')` —— `page.request.get('/api/v1/entries/markdown-test')` 匿名 404 → `entry.files` undefined → `openMarkdownFile()` 的 `.find()` 崩。**git 溯源**：
  - `viewer.spec.ts` 最后修改 `d4b05ee4`（2026-08-12，TPV0088-P5），当时记录「E2E 38/38 全过」——**那时 `markdown-test` 还是公开的**；
  - `59182590`（**2026-09-03，TPV0095**）给 `markdown-test`/`mermaid-charts`/`csv-employees` 的 `meta.json` 加 `team_id`，而 `team_id` 会 `Forces is_public=false`；
  - 该 commit 的验证记录是「**E2E 26 passed 验证零冲突**」——但那是**定向跑 TPV0095 自己的新 spec**，**没有回归 `viewer.spec.ts`**。→ 这是一次典型的「局部绿掩盖全局红」，回归自 2026-09-03 起已存在 2 个多月，与本任务无关。
  - **对 P1 的直接影响**：BDD-51「迁移后 3 个 e2e spec **全绿**」是**不可达判据**（基线就红）。必须改为「**迁移后失败集 ⊆ 基线失败集**（无新增失败）+ `firstFileId` 字面量归零」。同时 P5 须把 `viewer.spec.ts` 的既有 18 failed 登记 `known-failures.md`（WARNING 级，不阻断），并明确**不是本任务引入**。
  - **附带发现（不属本任务范围，建议登记 roadmap）**：`markdown-test` / `mermaid-charts` 归 team 后，所有依赖它们的匿名 e2e 都会红。这不一定只影响 `viewer.spec.ts`——P5 跑全量 E2E 时须留意同类连带面。
- EVIDENCE（**评审者发现三处「判据缺区分力 = 假 PASS」缺陷，我已逐条独立复核，全部成立**）：
  1. **BDD-09（README 优先）无区分力**：其 Given 写 `files = [aaa.txt, README.md]`「按路径字典序 aaa.txt 在前」——**前提就错了**。ASCII 下 `R`=82 < `a`=97，实测 `sorted(['aaa.txt','README.md'])` → **`['README.md', 'aaa.txt']`**，即 README 本就在首位。这样「README 优先规则生效」与「回落取排序首个」**结果相同，不可区分**。有区分力的写法：`[AAA.txt, readme.md]`（`A`=65 < `r`=114，实测 sorted 后 `AAA.txt` 在前），或用小写 `readme.md` + 大写开头的干扰文件。P1 须改。
  2. **BDD-10（index 优先）无此问题**：实测 `sorted(['aaa.md','index.md'])` → `['aaa.md','index.md']`，`a` < `i`，干扰文件确实在前 → 判据有区分力，**无需改**。
  3. **BDD-25（全屏入口可发现）会命中图表全屏按钮**：判据「可访问名称含『全屏』或 `fullscreen`」——`DiagramBlock.vue:177` 的 `<button class="diagram-action-btn fullscreen-btn" title="Fullscreen">⧉</button>` **完全命中**，而它由 `MarkdownViewer.vue:7` 在渲染 mermaid/plantuml 图时挂载，桌面端可见（`:557-567` 的移动端媒体查询只是缩小尺寸、未隐藏）→ 任何含图的 markdown entry 都会**假 PASS**。须把判据收紧为「指向页面级全屏（导航到 `/{slug}/f`）」或显式排除 `.diagram-block` 后代。
  - 另一条已由评审者指出的同类问题：**BDD-01~04/06/53 的 When「点开 TOC」在桌面端会反向关掉默认展开的 TOC**（见上一条 CORRECTION）。
  - **共性根因**：这些 BDD 的判据在「现状/错前提」下也能通过，正是我在 P1 派发约束第 2 条点名要防的假 PASS。评审者用**实跑 + 构造有区分力的材例**找出来，方法正确。
- CORRECTION（**评审者推翻我另一条核心实测结论，我复核后确认它对、我错 —— 这是本阶段我第二次因"只看局部"而误判**）：
  - 我此前的结论（记在 E-2、并被 analyst 写进 P1 §2.2 与 P0 objective_info）：「`/f` 全屏态**文件树仍在**（可见），因为 `EntryDetailView.vue:281-284` 的 zen CSS 只隐藏 header/mobile-bar/meta-tags」。
  - **实际**：`frontend-v3/src/styles/layout.css:650-657`（**全局**样式，`main.ts:8` 引入）另有一条 `.zen-mode` 隐藏集，**明确包含 `.file-sidebar` 与 `.toc-sidebar`**。我只查了 `EntryDetailView.vue` 的 **scoped** 规则，漏了全局那条。
  - **Playwright 复测（1280×800，`/k8s-deployment/f`，等 3s）**：`.file-sidebar` `sidebarInDOM: true` 但 **`display: none`、宽 0**；`.toc-sidebar` 同样 `display:none`；`.content-area` 宽 1280 / `innerWidth` 1280 = **1.00**。
  - **结论反转**：**BDD-30（全屏无文件树）与 BDD-54（全屏纯内容）现状即通过 → 无区分力，属假 PASS**。所谓「全屏无文件树是新增需求」**不成立**，它是既有行为。若要保留该验收，判据必须改成有区分力的形式（如断言 `/f` 下 `.file-sidebar` **不存在于 DOM**，现状是"DOM 在 + CSS 隐藏"）；或按 `[BASELINE_CHANGE]` 降级删除。
  - **教训（与 TPV0102/TPV0103 同源，已第二次犯）**：Vue 项目的样式作用域有 **scoped 与 global 两套**，判断"某元素是否被隐藏"**必须同时查 `styles/*.css` 与组件的 `<style scoped>`**，只查一处即漏判。
- CORRECTION（**我的两处计数/性质判断错误，评审者指出后我逐一实测确认它对**）：
  1. **`firstFileId` 计数：我记「3 spec / 8 处」是错的，实为 9 处**。实测 `grep -c firstFileId`：`viewer.spec.ts` = **2**、`t091` = **4**、`tpv0099` = **3**，合计 **9**。我此前写「analyst 统计 8 处，我复核一致」——**那次复核是错的**（我按"引用了该参数的行"数，漏了注释行或重复行）。教训：**声称"复核一致"前必须真的重跑计数命令并给出逐文件数字**，否则是假复核。
  2. **`html_render_service.py` 的 `_BINARY_SIZE_LIMIT` 是死常量，不是活跃的单文件上限**。实测 `grep -n _BINARY_SIZE_LIMIT` 该文件只有 **`:18` 定义一行、零消费**；`inject_resources()` 对文本 sibling **无任何大小检查**。`files.py:272`（`file_record.is_binary and file_record.size > _BINARY_SIZE_LIMIT`）在**二进制内容 serving** 路径，不在注入路径。→ analyst 的同类扫描 §6.5 判定「`_BINARY_SIZE_LIMIT` → 本次处理：纳入统一预算（保留单文件语义）」**把死代码当成了活跃机制**，会误导 P4 的改动边界；且 BDD-39 描述的"单文件文本超上限"其实是**新增需求**而非"纳入既有上限"。
  - **共性**：这两条都属于"读到了某处定义就当作有机制/有引用"，与前面 scoped-vs-global CSS 的漏判同源——**判断"某常量/样式是否生效"必须查到消费点/生效作用域，不能只看定义**。
- GATE FAIL（`check-gate.py P1` → **exit 1**）：`P1-review.md frontmatter status 非 approved（当前: needs-revision）`。**这是预期的红**——评审 11 BLOCKER 未修完，gate 正确拦截。不修改产出凑绿，按流程回派 analyst 修订。
- SUBAGENT FAIL（工具层，已修复）：`agate-inject-card.py` 报 `P1-dispatch-context-analyst-supplement.md 中未找到 AGATE_CARD_START/END 占位符`，GATE `1/4 注入失败`（RM-AG0104 / DEBT0052），exit 1。**根因**：我第 1 轮写 supplement 文件时漏了占位符注释块。**修法**：在文件末尾补 `<!-- AGATE_CARD_START -->` / `<!-- AGATE_CARD_END -->` 后重跑脚本 → 4/4 全部注入成功、exit 0。**未用 python3 或手写替代**（协议禁止）。
- DECISION（P1 第 2 轮派发）：按 `P1-review.md` 的 11 BLOCKER + 14 WARNING 回派 analyst 修订，`retries[P1]` 计 1（上限 3）。新写 `P1-dispatch-context-analyst-r2.md`（原 dispatch-context 已冻结，不改）+ 注入卡片。**未回退到 P0**——评审明确判定需求方向成立、8 项缺陷源码事实全对，问题只在判据区分力与两条不可执行 Given。
- DECISION（**评审结论采纳，不改 domains**）：评审认可 `domains: [frontend, backend]` 不含 `security` 的理由（V-05 只出文档+测试、不改 CSP、声明 security 会触发无实际改动的 cso 评审），并核对了 `risk_level: medium` / `ceremony: standard` / `packages` / `phases` 全部匹配、无裁剪不合理项。**保持原声明**，不因"V-05 是安全边界"而机械补 security。
- EVIDENCE（**协议侧工具缺口，实测确认，建议报上游**）：`check-gate.py:818-837` 对非 legacy 任务**强制**要求 `P1-review.md` 声明 `reviewed_bdds` 且须与 `P1-requirements.md` 的 BDD 集合**严格相等**，但 `agate-md-field-set.py` 的 key 白名单**不含 `reviewed_bdds`**（`agate-frontmatter-check.py::SCHEMAS` 的 P1-review 条目无此字段），`set`/`append` 均被拒 → 评审者只能"工具写 6 个字段 + 对该字段定向补插"。**门禁要求某字段、写入工具却拒写该字段，属机制内部矛盾**；TPV0102/TPV0103 前例同样手写。本轮不受阻（字段已正确写入，gate 未报该项），但建议登记 upstream debt。
- EVIDENCE（**探针残留已清零，数据回到 seed 基线**）：评审者留 6 个 `rv-*` 探针 entry + E2E 跑出 2 个 `e2e-test-code*`（`viewer.spec.ts:33` 自建），我全部经 **debug HTTP API** 逐个 `DELETE`（均 200）并复核：**alice 可见 22 / 匿名 15**，与本轮 seed 基线一致（22 entries 入库、其中 team 归属的匿名不可见）。生产 `:8080` 全程 000 零接触。
- CORRECTION（**analyst 在 r2 纠正了我 B8 的"死代码"结论，我的表述不完整**）：我先前的推理是「`_MAX_INJECT_IDS=50` == `max_entry_files=50`，主文件占 1 → 最多 49 sibling → `>= 50` 永不触发 → 死代码」。**成立范围只在"默认配置"下**。analyst 指出并我已实测验证：`create_app(config=PeekConfig(limits=PeekLimits(max_entry_files=60)))` 覆盖后，最多 59 sibling ≥ 50 → **分支可真实 HTTP 触发**。所以准确定性是「**默认配置下不可达，但经配置覆盖可达**」，不是"从上线起就是死代码"。
  - **实测**：`PeekLimits(max_entry_files=60)` 构造成功，`cfg.limits.max_entry_files = 60`。
  - **影响**：BDD-38 因此**可以在 P6 用真实 HTTP 请求验**（不必降级为构造性单测），P1 只需在 Given 里写明造件路径（配置覆盖 + 同时确保注入上限 < N−1）。这比我先前建议的"二选一（调低上限 / 承认不可达）"更省事，也更贴合"验真实行为"的原则。
  - **教训**：判断"某分支不可达"时，**必须把"运行期可覆盖的配置"计入可达性分析**——只看默认常量值会得出过强结论。
- SUBAGENT FAIL（环境层，已自行恢复）：承担调试服务的后台 job（`sleep 10800`）**到时自然结束** → `:8888` 停止（探活 000）。按 `agate-protocol` 平台注意「长驻服务存活跟随发起它的调用」，**不靠加长 sleep**，直接新起后台 job `( make debug-start; sleep 14400 )` 托底 → 探活恢复 200。
  - **连带发现（本环境关键约束，必须每次重启后都做）**：debug 数据目录在 `/tmp/peekview-debug/`，而 `/tmp` 是**per-invocation tmpfs** → **服务重启后 seed 数据全丢**（实测重启后 `anon total: 0`）。已重跑 `make debug-seed` **两遍**恢复（第一遍只到 19，第二遍幂等补齐到 **22**）→ 现 `alice 22 / 匿名 15`，与基线一致。
  - **教训**：本环境"服务存活"与"数据存活"是**两个独立易失项**。重启服务后必须：① 探活端口 → ② 立刻 `make debug-seed` → ③ 用 `alice total == 22 && anon total == 15` 复核基线。只做①会得到"服务在但数据空"的假就绪。
- EVIDENCE（P1 第 2 轮修订产出，主 Agent 亲验）：`P1-requirements.md` **817 行 / 54 条 BDD**（编号 01..54 连续无缺口，我跑 `grep -oP` + awk 校验）；`P1-review.md` **mtime 未被改动**（19:03:36，评审产出未被修订者污染）。analyst 自报区分力自检：**42 条改动前 FAIL（有区分力）+ 12 条显式标注的回归兼容/约束型守护**，无未标注假 PASS。抽查确认：BDD-28 改为断言 `.file-sidebar` **DOM 计数 == 0**（现状 DOM 存在+CSS 隐藏 → FAIL）并**并列引用 scoped/global 两处隐藏集**；BDD-05 增加「TOC 可见文本不含 `**`/`[`/`](` 且与正文 `textContent` 逐字相等」（现状 FAIL）；BDD-38 给出 `create_app(config=PeekConfig(limits=PeekLimits(max_entry_files=N+1)))` 造件路径 + ④ 代码级关系断言；§6.5 已把 `_BINARY_SIZE_LIMIT` 更正为死常量并声明"单文件文本上限属本任务新增"。
- DECISION（P1 第 2 轮评审派发）：新写 `P1-dispatch-context-requirements-review-r2.md` + 注入卡片（5/5 成功、exit 0）。派发要点：**这是复审不是从零**——只核查 11 BLOCKER 是否真修好、14 WARNING 是否到位、编号重排是否造成交叉引用错位、§11 的 42F/12P 自检是否可信（尤其那 12 条是否真属回归守护而非换标签的假 PASS）；并明确「**只剩 WARNING 级问题应给 approved**，不要为完美继续打回」（按 retries[P1] 预算管理）。
- EVIDENCE（**我在等第 2 轮评审期间独立发现 analyst 第 2 轮引入的一处新缺陷**）：修正后的 `BDD-05` 把 When 写成「vitest 层，直接消费 `useMarkdown.render()` 返回的 `headings` 与 **`html`**」——但 `useMarkdown.ts:480` 的返回值是 `{ blocks, headings, html: '', ... }`，**`html` 是常量空串**，真正的 HTML 在 `blocks[]` 里（`:414` `blocks.push({ type: 'html', html: segment })`）。→ **该 When 不可执行**：vitest 里永远取不到 HTML，断言②（TOC 可见文本 vs 正文 `textContent` 逐字相等）**无法在 vitest 层完成**。
  - 这是「修好旧问题、引入新问题」型缺陷，恰是我要求第 2 轮评审重点核查的「修订是否引入新问题」。
  - 正确改法二选一：① vitest 层改为消费 `blocks` 中的 html 段拼接后再取 `<h2>` 的 `textContent`；② 把断言②移到 **Playwright 层**（真实 DOM，我此前就是这么实测的：`.toc-list .toc-item` 文本 vs `.markdown-body h2` 的 `textContent`）。**优选 ②**——真实 DOM 才能反映用户所见，且我已验证可执行。
  `P1-review.md` 尚未被第 2 轮覆盖（仍是第 1 轮 41960B/19:03），评审者正在实测同一处，等其结论后一并回派。
- CORRECTION（**第 2 轮评审中途我抓到一个危险中间态，已要求重写，最终已修正**）：第 2 轮评审者先用 `agate-md-field-set.py` 试探字段可写性，那一跑把**第 1 轮旧文件**的 frontmatter 改成 `status: approved`（正文仍是"BLOCKER 11 须全部闭环"），并清空重写 `reviewed_bdds` 为 01–55。我实跑 gate 得到 `reviewed_bdds 55 项 vs P1 的 54 项不相等 → exit 1`，并发现正文与 status 直接矛盾 → 发消息要求「正文整体重写为第 2 轮复审 + reviewed_bdds 改 01–54 + 未改对前不得定 approved」。最终文件已覆盖为 43783B 完整第 2 轮复审（21:03），`status: needs-revision`、`reviewed_bdds` = 01–54。**教训：核实评审结论时要同时核对 frontmatter 与正文是否自洽，不能只看 status 字段。**
- EVIDENCE（**第 2 轮评审结论：needs-revision，BLOCKER=2 / WARNING=6**）：11 项原 BLOCKER **10 项已闭环**（每项均有评审实测证据，其中 B8 它实跑复现了"请求 51 siblings → 内联 50、无跳过清单"的静默截断真缺陷），B7 部分闭环并派生出我的发现。**§11 自检表裁定**：那 12 条"回归守护"逐条抽验**全部真属回归守护、无一条是假 PASS 换标签**，但 42F 里有 1 条不成立 → 真实分布 **41F / 12P / 1 未标注假 PASS**。
- EVIDENCE（**两条 BLOCKER 我已独立复现确认，均成立**）：
  1. **B-NEW-1（BDD-05 When 不可执行）**：`useMarkdown.ts:480` 是该渲染函数**唯一 return 点**且 `html: ''` 是常量空串，真实 HTML 在 `blocks[]`（`:414`）。→ vitest 层照字面取 `html` 必为空，断言②要么报错要么退化成断言空串（**静默失去区分力**）。**这是我先发现、评审确认并采纳为 BLOCKER 的。**
  2. **B-NEW-2（BDD-35 假 PASS，由 B6 修法派生）**：BDD-35 的 When 允许「既有返回值结构中的字段」作为观测面，而现状 `rows = dataRows.slice(0, maxRows)` **已保证 `rows.length ≤ maxRows`**。我用 node 复现：1000 数据行 + maxRows=5 → `rows.length = 5 (<=5 true)`、`totalRows=1001`、`truncated=true` → **Then 现状全满足 = 假 PASS**，V-03 的真缺陷（先全量构造再 slice）完全未被验证。
  - 两条都落在「判据不可执行 / 假 PASS」同一族，与该任务 §3 自己明文要求的「判据必须在改动前 FAIL」直接冲突 → 我**认同 needs-revision**，不接受"为省重试预算而 approve"。两条都是"一句话可修"，不是方向问题。
- EVIDENCE（**W-新 5 的 4 处交叉引用错位我已逐条核实，评审者判断全部正确**）：
  | 位置 | 现写 | 应为 | 实际拥有该语义的 BDD |
  |---|---|---|---|
  | L95 | `回归 BDD-44` | **BDD-43** | BDD-43 = 「512KB 与 2MB 的左闭右开边界语义不变」；**BDD-44 实为「TreeView 的截断判断改用真实字节数」** |
  | L649（P0_STALE 第 3 条） | `回归 BDD-44` | **BDD-43** | 同上 |
  | L541 | `补 order_by（BDD-14）` | **BDD-13** | BDD-13 = 「后端文件列表顺序具有确定性契约」；**BDD-14 实为「`?file=` 打开指定文件且参数加载后保留」** |
  | L648（P0_STALE 第 2 条） | `代码级断言（BDD-48）` | **BDD-47** | BDD-47 = 「卡片与列表的导航不再引用 files[0]（代码级断言）」；**BDD-48 实为「单文件 entry 的详情页行为不变」** |
  → 全部属实，已并入 r3 修订清单。这类错位不影响 P6 判 PASS/FAIL（BDD 正文自身正确），但会误导 P4/P7 实施者按错条目去改代码。
- GATE PASS（P1 收口，主 Agent 亲跑）：`check-gate.py P1` → **exit 2**（`P1-review.md approved + agent≠main + 含 BDD 锚点`；仅 3 条 SUGGEST WARNING 不阻塞）；`check-pruning.py` → **exit 0**（`0 mismatches across 2 fields`）。**第 3 轮终审 approved**：第 2 轮仅剩的 2 BLOCKER + 6 WARNING **全部 8 处闭环**（评审逐项实测，非文字承诺），另新增 2 项纯文字级 WARNING 列入建议（BDD-35 观测面定义双重否定措辞绕 / BDD-53 ① 的 DOM 归宿并列事实有 3 项不准），**均不影响 P6 判 PASS/FAIL**，按派发尺度判 approved。`retries[P1]` 最终 **2/3**（未耗尽）。
- SUBAGENT FAIL（工具层，已修复）：`git commit` 三次被 gate 拦，逐层修复——
  1. **`P1-requirements.md` 缺 `prod_touched`**（非 legacy 必填）→ 用 `agate-md-field-set.py set prod_touched false` 写入（exit 0）。
  2. **`P1-progress-review.md` 缺 frontmatter 块** → gate 要求声明文件带 `---` 块。给 4 个 progress 文件（`P1-progress.md` / `-review` / `-review-r2` / `-review-r3`）统一补 frontmatter（`phase/task_id/type/trace_id/prod_touched`）。
  3. 提交成功：**`4e09219e`**，17 files changed / +3985 行。
  - **附一条工具缺口（评审者实测发现，建议报上游）**：`agate-md-field-set.py` 对**列表值只写入第一段**（`phases: [P1, P2, ..., P8]` 被写成 `- '[P1,'`），评审者已直接修正为合法 YAML 并用 `yaml.safe_load` 校验。我复核确认 `P1-requirements.md` 的 `phases/packages/domains` 与 `P1-review.md` 的同名字段**均为合法列表**。
- DECISION（**P1 阶段收口，进 P2**）：`.state.yaml` 已写 `phase: P1` + history 追加 `completed` 条目（含三轮评审收敛过程、两项用户决策、P0 四项待定收敛、gate 结果）。按 P1 卡流程，`phase` 随 P1 产出 commit 写入；**P2 的 phase 不预写**，随 P2 产出 commit 一起。
- NEXT: 进 P2 方案设计。按 C8 机械映射：`domains: [frontend, backend]` + `risk_level: medium` → **P2 须派 plan-eng-review（backend 域）+ plan-design-review（frontend 域）双评审**。`ui_affected: true`（V-01/V-04/V-08 均用户可见）→ P2-design.md 必须含 `## UI 设计` 节（渲染形态 + 维度 + 按形态 checklist），且与 P1 的 `ui_render_shape: layout` 一致。
- DECISION（进 P2，**不引入 goal**）：用户要求按 agateon 执行完任务。已确认 goal 属 DSH 平台能力对照表条目（`platform-notes.md:147`「跨轮续跑 | 手动重开会话 | goal」）与 skill 的"食谱 3"，**非协议要求**——`orchestrator-template.md` 全文零命中。且 skill 明说 goal「与 Agateon 自身的状态落盘**正交**」，引入它会与 `.state.yaml` 形成第二个协调基质。改用会话内连续推进 + 每阶段 commit + `.state.yaml` 落盘（中断重开会话读状态即可）。
- NEXT: 派 P2 architect（`P2-dispatch-context-architect.md` 已写 + AGATE_CARD 已注入）。产出后按 C8 派**双评审**（plan-eng-review → `P2-review-eng.md`、plan-design-review → `P2-review-design.md`），再派组长汇总出 `P2-review.md`。
- SUBAGENT FAIL（环境层，已自行恢复，P2 期间）：承担 debug 服务的后台 job（`sleep 14400`）**到期结束** → `:8888` 停止（探活 000），此时 architect 正在做最小验证（Playwright/DOM 探针）。按平台约束「长驻服务存活跟随发起它的调用」**不靠加长 sleep**，直接新起后台 job `( make debug-start && make debug-seed && make debug-seed; sleep 21600 )` 托底 → 恢复 200、`alice 22 / anon 15`（基线一致）。
  - **注意**：本次在后台 job 内**连跑两遍 seed**（第一遍只到 19，幂等第二遍补齐 22），因为 `make debug-seed` 首次可能因服务刚起未就绪而少建几条。以后恢复流程固定为「探活 → seed ×2 → 复核 alice==22 && anon==15」。
- EVIDENCE（P2 产出，主 Agent 亲验）：`P2-design.md` **80033B / 683 行**；frontmatter `candidate_count: 3` / `packages: [peekview, frontend-v3, docs]` / `domains: [frontend, backend]` / `ui_affected: true` / `ui_design_section: true` / `dispatch_plan.mode: static-batch`，全部合规；`## UI 设计` 节形态声明 `layout` 与 P1 的 `ui_render_shape: layout` **一致**、维度 `布局结构/交互行为/视觉呈现` 与 P1 一致；`gate_commands` **21 个 key**、全部复用 Makefile target、每个 key 都有 `{key}_timeout_seconds`、`P5_e2e` 钉死新建 spec、3 个 legacy spec 独立 key。`check-gate P2` 预跑唯一红灯是 `P2-review.md 不存在`（符合预期）、`RECONCILE 0 mismatches`。
- EVIDENCE（**architect 两条关键实测，我已独立复核**）：
  1. **`judge_result` 对 exit 124 是 fail-open（=P3 通过）**：`check-tdd-red.py:102-104` 实测源码为 `if exit_code == 124: print("测试命令超时，视为红灯可推进"); return 0`。结合 `agate_common.py:752` 的 `AGATE_TDD_TIMEOUT` 默认 **120s** 包住**整条**命令 → architect 实测 frontend 22-25s + backend 31-34s，**复合 107s，距上限仅 13s**。→ **我给的方案 A（复合命令）被正确否决**：它的失败模式是"P3 gate 永久空转（假绿）"，比我说的"失去 A/B 区分度"严重得多。**archieve 比我看得准，采纳其'方案 B + 规定动作'。**
  2. **V13 硬约束（P3 必须遵守）我已亲手复现**：造一个 `import` 不存在模块的探针 spec → vitest 输出 `Test Files 1 failed / Tests no tests`、formatter 得 `{exit_code:1, failed:0, **errors:1**, import_errors:[], syntax_errors:[]}` → `judge_result:154-156` 的 `if errors > 0` 分支判 **A 类错误 → return 1 = gate FAIL**。而经典断言红灯（`failed>0`）走 `:161-165` 判 `classic red-light → return 0` **通过**。→ **P3 写红灯必须用断言形态**（引用已存在模块 + 断言新行为），不能 import 尚未存在的模块。探针已删（`git status` 确认无残留）。
  - **一处未复现（保留但降级）**：architect 称 `make test-quick` 的预存失败计数不稳定（2F/1F/1F，xdist 竞态）。我**连续 3 次实测均为 `1 failed, 1205 passed, 3 skipped`**（31.50/31.66/31.86s），**未复现不稳定**。其核心结论（`make test-quick` 从不全绿 → 并入 P3 会让"有红"恒真）**仍成立**，但"xdist 竞态导致计数漂移"这个归因我未能证实——P5 按"失败集不劣于基线"判时以**失败集合**（而非计数）为准更稳妥。
- NEXT: 派 P2 双评审（`plan-eng-review` → `P2-review-eng.md`、`plan-design-review` → `P2-review-design.md`，dispatch-context 均已写 + 卡片已注入），**并行派发**，返回后派组长汇总出 `P2-review.md`。
- CORRECTION（**P2 eng-review 推翻了我与 architect 共同的错误结论，我复核确认它对**）：关于「补 `order_by` 后哪些测试会红」——
  - 我与 architect 都断言：`test_render_inject_js` 的构造序 `[index.html, app.js]` 会被 `order_by` 改成 `[app.js, index.html]` → `files[0]` 语义改变 → 该用例会红（architect 记为 R1，我还"独立验证"了字典序并宣布"归因准确"）。
  - **eng-review 实测跑全量后零新增失败**，并指出根因：`_create_entry`（`test_html_render.py:44-55`）返回的是 **POST 响应**的 `entry["files"]`，而 **`order_by` 只作用于 GET 查询**，POST 返回的是构造顺序 → `files[0]` 仍是 `index.html`，**用例不受影响**。我复核源码确认无误。
  - **我的错误性质**：只核了「字典序会变」这个**局部事实**，没有追 `files` 这个变量的**数据来源**（POST 响应 vs GET 查询）。这正是我在 P1 反复犯的同一类错误（只看局部、不追消费点）在 P2 的重演。
  - **附带**：eng-review 还发现 POST 与 GET 的响应序**不一致**（POST 构造序、GET 字典序）——这本身是个值得注意的行为差异，但本任务不加断言（P1 未要求 POST 也排序）。
- EVIDENCE（**eng-review 另两个高价值发现，待其正式产出后核**）：① **既有静默丢弃点被方案漏登记**——`_build_sibling_data` 对 >768KB 的 binary sibling 直接 `return None`，响应无任何跳过记录，这是**已存在的静默丢弃**，P2 的 skipped 记账只覆盖了新加的三个上限；② **`inject_resources` 若改为返回 `(html, skipped)` 元组，会连带 13 处直接调用它的测试**（`test_html_render.py` 里 `result = inject_resources(...)` 后对 `result` 做 `in` 断言 → 变成对 tuple 做 `in` → TypeError 或假绿），方案未登记该连带面、未给兼容包装。
- EVIDENCE（**P2 eng-review 3 项阻塞，我全部独立复现确认，其中 B3 是方案新引入的安全漏洞**）：
  - **B1（我已承认判断错误）**：见上一条 CORRECTION——R1 归因不成立，`_create_entry` 返回 POST 响应而非 GET 查询。
  - **B2（实测确认）**：① `grep -c "= inject_resources(" tests/test_html_render.py` = **13** 处，方案要改返回 `(html, skipped)` 元组 → 这 13 处会全红；② **既有静默丢弃点**——`api/files.py:270-273` 的 `_build_sibling_data` docstring 自己写着 "None if skipped (oversized binary)"，对 `>768KB` 二进制直接 `return None` 且**无任何记录**；实测 900KB png → 请求 2 / 内联 1 / 静默丢 1 / 无清单。BDD-40② 要求「每个未内联的都必须可查」→ **方案的三级预算没覆盖这条既有路径，P6 造件即 FAIL**。方案 §0.2 还把 P1 对 `files.py:272`（**二进制 serving 路径**）的判定**错误扩展到注入路径的同名行号**上——这是对 P1 结论的误读。
  - **B3（我自己复现，最严重）**：方案用 `<script type="application/json" id="peekview-inject-report">` 嵌跳过清单，而 `json.dumps` **不转义 `<`**；同时 `path` 字段**完全未过滤**（我实测 `POST /api/v1/entries` 带 `path: "</script><img src=x onerror=alert(1)>.css"` → **201 接受**）。我按方案形态构造后实测：首个 `</script>` 出现在**位置 71**（JSON 字符串内部）→ 其后 `<img src=x onerror=alert(1)>` 成为**活跃 DOM**，而 `RENDER_CSP` 有 `unsafe-inline`/`unsafe-eval` → **`onerror` 会执行**。→ 这不是"取证通道不便"，而是**方案自己新引入了 XSS 面**；且同一形态让方案规定的 BS4 取证失效（`.string` 取到半截 → `json.loads` 失败）。
    探针 entry（`mjcfg7` / `xprla2`）已 DELETE、anon 复位 15。
  - **B3 的教训**：P2 的 minimal_validation V9 只用**中文文件名**验证了 `<script type="application/json">` 在 CSP 下不执行，**从未覆盖 HTML 敏感字符** → 结论被**过度外推**成"实测可行"。这正是"验证了 A 就宣称 A∪B 可行"的典型。
- NEXT: 等 plan-design-review 产出，然后派组长汇总（`P2-review.md`）。eng 给了 `rejected` + 3 阻塞，预计需回 P2 修订一轮。
- EVIDENCE（**P2 design-review 完成：rejected，2 BLOCKER + 2 MAJOR。其中一条更正了我与它自己的读数，我已实测确认**）：
  - **D-1（BLOCKER）布局层零候选**：角色定义 `plan-design-review.md:27-29` 括号注明要求「架构级 candidate_count **下沉** UI 布局层」；而 P2 的 3 候选全在架构层（锚点生成点 / 超限反馈承载），且 `:171` **自认**「其余实现三方案一致，不制造假分叉」→ UI 设计节 `:432-457` grep「候选/备选/权衡」= **NONE**。→ `candidate_count: 3` 只满足 P2 gate 机器校验，不满足该角色的 UI 层要求。
  - **D-2（BLOCKER）`.toc-level-1 { padding-left: 0 }` 是 no-op**：`.toc-item` 只有 margin 无 padding，该属性默认已 0 → h1 与 h2 在 TOC 内 `paddingLeft/marginLeft/fontSize/fontWeight/x` **逐项相同** → 决策 B 扩 h1 后**层级视觉不可区分**。且 **BDD-04 只验「h1–h4 计数==4」，不验层级可区分** → P6 会 PASS，缺陷无 BDD 捕获（属 P1 判据的盲区，但**不回 P1**，P2 补样式即可）。
  - **D-3（MAJOR）移动端最小支持宽度未声明**：实测 **360px 视口底栏溢出 10px**（`overflow-menu-trigger` 右缘 370 > 360）、375 恰好用尽、390 有余量；栏高四档恒 64px。方案只测 390（BDD-24 的 Given 也是 390）→ 360 缺陷无 BDD 捕获。**修法**：把移动入口移入 `OverflowMenu` 可一并解 D-3。
  - **MAJOR-4（它发现、我未提）桌面全屏按钮缺 `v-if` 守卫**：404 页 `.actions-area` 仍渲染但 `activeFile` 为 null → 点击走 `activeFile.id` 会 **TypeError**。移动端安全（整栏 `v-if="isMobile && currentEntry"`），桌面端 `v-if="isDesktop"` 与 entry 状态无关。
  - **CORRECTION（它自我更正，我实测确认）**：「桌面 `.actions-area` 插入按钮溢出 40px」是**误读**。我实测 1280×800：`clientW 423 == scrollW 423`、`gap: 4px`、`bodyScrollW 1280 == innerW 1280`、`.actions-area` 右缘 1256 → **不溢出、无横向裁切**，那 4px 是 flex 尾槽 gap。**正面结论**：弹性布局结构安全，但"标题让出 36px"方案零交代，已列为补一条「标题未被截断」度量点。
  - **正面结论（供 P4 保留）**：截断态表头换成 `span.th-label` 后**不塌陷**（thead −28px、tbody 首行同步 −28px、标签居中偏差 −0.25px、7 列列名全留）→ 方案 R12 缓解措施成立；对比度全过 AA（亮 5.25/5.19/5.25、暗 7.26/5.57）；`focus-visible` 2-3px solid 既有于 `.icon-btn`。
  - **七维评分**：交互状态覆盖 8 / AI Slop 9 / **移动端 5** / 可访问性 8 / 组件完整性 7 / 视觉设计 7（布局 2 对比度 3 **字体间距 1** **组件一致性 1**）/ 交互设计细节 6（输入态 3 键盘 3 **过渡禁用态 0**）。
  - **一条与 B3 不重复的设计观察**：方案 `:446` ② 声明跳过清单「**不新增视觉横幅**」→ 清单对用户**完全不可见**，与 P0 决策 4「消除用户看到的假象」有语义落差（用户仍见"渲染成功但资源不全"）。需 architect 说明"P1 未要求可见横幅"是否足够。
- NEXT: 派组长汇总出 `P2-review.md`（规则：任一专家 BLOCKER → rejected），然后回 P2 修订（retries[P2] 计 1，上限 3）。
- CORRECTION（**组长汇总指出我 dispatch-context 里的一处归因错误，我已核实它对**）：我在给组长的派发里写「eng 的 B3（跳过清单 XSS）与 design 的观察（跳过清单对用户不可见、与 P0 决策 4 有语义落差）是同一机制的两个角度，可合并陈述」——**这个归因错了**。实测：`P2-review-design.md` 全文 grep「决策 4」「用户不可见」「不可查」「显式反馈」= **0 命中**；design 评审提及「跳过清单/注入超限反馈」共 3 处，**全部中性或正面**（作为"候选全在架构层"的论据 / 交互状态覆盖率的**正面得分项**）。而「不新增视觉横幅——P1 未要求可见横幅，避免超出基线」这句实际在 **`P2-design.md:446`**（方案自述，非评审意见）。→ 真实状态是「design **看见并接受**了不给可见横幅；eng **单方**就同一载体的 XSS 提阻塞」，二者不冲突但**不能表述为两位专家的合并陈述**。组长已正确记为 eng 单方 BLOCKER，并另行记录「P0 决策 4 与'仅机读 JSON'确有语义落差，但本轮无专家单独就此提阻塞」供我判断。
  - **我的错误性质**：把我自己读 `P2-design.md` 得到的信息，错误归到了 `P2-review-design.md` 名下。属**来源混淆**——与 P1 期间那次"凭空归因"同源（引用他人意见前必须核实来源文档）。
- NEXT: P2 修订（`retries[P2]` 计 1，上限 3）。5 项 BLOCKER（B1/B2/B3/D-1/D-2）+ 7 项 MAJOR（M1–M7）+ 13 项非阻塞，按 `P2-review.md §6` 的修订清单派 architect 修订。
- DECISION（**批准 P1 基线的一处实现层勘误，标注 [BASELINE_CHANGE]，Then 语义未动**）：P2 修订者独立复核发现 `P1-requirements.md:589` 判「`api/files.py:272` 属**二进制 serving** 路径、不在注入路径上」**失实**。我亲自验证：全仓 `_BINARY_SIZE_LIMIT` **只有 1 个消费点**（`files.py:48` 定义 / `:272` 消费）；`:272` 在 `def _build_sibling_data`（`:270`）体内，**唯一调用方是 `render_html_file`（`:336`）→ 注入路径**；`download_file`/`get_file_content`（`:185-268`）内零 size 判断 → **全仓不存在"按大小挡二进制的 serving 逻辑"**。
  - **这条错误我也有份**：我在 P1 期间照抄了这个判断，并在 P2 派发时把它当既定事实转述（"`files.py:272` 在二进制 serving 路径"）。eng-review 的 B2 也沿用了"同文件两个不同函数"的说法（实际是**同一行**）。→ 三方都错了，修订者独立复核才对。
  - **处理**：按 P1 基线保护规则（P1 卡片「P1 基线保护」：主 Agent 显式批准 + 标 `[BASELINE_CHANGE: 理由]` + **不改 Given/When/Then 语义**），我批准并更正 3 处：① §6.5 表格该行判定改写；② §6.5 结论句「只有 1 个真实生效常量」→「2 个」（数量上限 50 休眠 + `_BINARY_SIZE_LIMIT` 在注入路径上）；③ BDD-39 的 Given 括号内附注。共 4 处 `[BASELINE_CHANGE]` 标记。**BDD-39/40 的 Then 语义完全未动**（超限文本仍不内联+仍记录；未内联的仍须可查），54 条 BDD 编号连续无改动。
  - **影响**：结论方向不变（`_BINARY_SIZE_LIMIT` 本来就要处理），只是理由从「漏了另一条路径」变成「它就是唯一那条路径」。P2 的 §0.2 已据此整条重写为「必须改」。
- NEXT: P2 第 2 轮评审（`retries[P2]` 仍计 1 次——修订不算新重试轮，评审重跑才计）。派双评审复核 5 BLOCKER + 7 MAJOR 是否闭环。
- EVIDENCE（**P2 eng-review 第 2 轮：rejected，但 3 项原 BLOCKER 全部已闭环；新增 1 项 B4。我已逐条独立验证，全部成立**）：
  - **B1/B2a/B2b/B3 全部「已闭环」**：eng 自跑补丁验证 B1（73 passed / 0 failed，POST≠GET 序成立）；B2a `skipped_out` 可选出参（13 处零改动）；B2b `binary_too_large` 已入记账；B3 转义后 `stray <img>=False` / `json.loads` 通过 / `path` roundtrip 一致，并确认修订者重做的 V9「可信、四关键面覆盖齐全」。
  - **B4（新增阻塞，我已逐条实证）**：`reason` 五元闭集（`not_found`/`count_limit`/`file_too_large`/`total_budget`/`binary_too_large`）**全部是 `inject_resources()` 之前的判定点**；而函数内部还有一条成规模的静默丢弃路径：
    ① `_detect_kind`（`html_render_service.py:77-90`）实测**只认 `.css`/`.js`**（含 `language ∈ {css, javascript, js}`），`.md`/`.json`/`.csv`/`.yaml`/`.txt` 一律返回 `None`；
    ② `html_render_service.py:258-260` 的 `if not kind: continue` **直接静默跳过、无任何记录**；
    ③ **决定性证据**：前端 `useEntryDetailComputed.ts:42-46` 的 `siblingFileIds` **只排除主文件本身、完全不过滤 kind** → HTML entry 带一个 `README.md` 就会被请求，然后被静默丢弃。
    ④ P2 全文 grep「未引用/unreferenced/不可注入/not_injectable」= **0 命中** → 零覆盖。
  - **为何是 BLOCKER 而非 WARNING**：`reason` 闭集是 **P2 冻结项**（P4 无权扩集）；且 D7 从未定义 `inlined` 是「预算放行数」还是「实际进入响应体数」——后者让 BDD-40②「未被内联的每一个都必须可查」不可满足，前者直接违反它。**两条路都得改设计。**
  - **连带发现（minimal_validation 选材缺口）**：V8 的素材（bootstrap/vue/d3/app.css/chart.js/logo.svg）**六个全是资源文件，恰好绕开 kind 这一维**——与第 1 轮指 V9「只用中文文件名」同类：**验证了 A 就宣称 A∪B 可行**。
  - **eng 自我更正两处**：①「同文件两个不同函数」说错了，`files.py:272` 就在 `_build_sibling_data:270` 体内、唯一消费点（**与我和修订者一致**）；② `P2-review.md §6.1-3` 括号旁证以它 §1.3 为准（不改动作）。
  - **4 项非阻塞（我已核实 3 项）**：**N5** 双名并存——`:710` 的 P3 取证命令指向 `test_entry_order.py`，但设计另有 5 处用 `test_entry_file_order.py`；且 `:710` 命令带 `| tail -30`，**按字面跑会 exit 0 = 假绿**（实测裸跑 exit 4 才可归因）；**N7** 设计称「119P/0F/0E 基线」，**实测两文件 = 73 passed**（我用 `-v` 覆盖 `addopts=-q` 才拿到汇总行），数字错；**N8** `backend-render-budget` 批的 `output` 未含新建的排序测试文件；N6 `files_to_read` 的 useCsvParser spec 路径写成 `components/__tests__/`（实际在 `composables/__tests__/`）。
  - `retries[P2]` 已用 **2/3**。
- NEXT: 等 design-review 第 2 轮结果，然后决定是否需第 3 轮修订（预算只剩 1 次）。
- EVIDENCE（**P2 design-review 第 2 轮：approved（七维全部 9 或 8），但发现 2 项 MAJOR 新问题。我已逐条验证成立**）：
  - 七维评分（本轮→第 1 轮）：交互状态 9(8) / AI Slop 9(9) / **移动端 9(5)** / 可访问性 9(8) / 组件完整性 8(7) / 视觉设计 9(7) / 交互设计细节 9(6)。**移动端从 5→9 是该维度最大进步**。
  - **D-1/D-2/D-3 全闭环**：D-1 三组**布局层**候选（L/V/I 各 3 个，否决理由基于 BDD 判据而非偏好，且都经它独立核实源码）；D-2 实测 `fw 600 / #e9eef4 / marginTop 12px`、对比度 **15.26:1**（它手算吻合）；D-3 逐位复现 V14（含 5.39/20.39/35.39 三个小数），落点唯一性独立确认。
  - **D-3 最终定级 = MAJOR（不计入 BLOCKER）**：它承认第 1 轮 §0/§5 口径不一致是自己的问题，本轮统一。理由：不影响任何 BDD 可执行性（BDD-24 钉 390）、危害是 360 档功能损失、单点可闭环。
  - **R2-1（MAJOR，我已验证）**：h1 新规则会**吃掉 `.active` 强调色**。`.toc-item.active a`（`TocNav.vue:41`）与设计新增的 `.toc-item.toc-level-1 a` **特异性同为 (0,2,1)**，新规则源码在后 → 顺序胜出。实测 h1 `.active` 色变 `rgb(233,238,244)`，h2 仍 `rgb(77,141,255)`。**更关键**：现状校验点⑦ 只断 `fontWeight`/`marginTop`/`x`，**R2-1 存在时三项全真 = 判据漏检** → 须补反向断言「h1 active 时 color == `--c-accent`」。处方：加 `:not(.active)`。
  - **R2-2（MAJOR，我已验证）**：`activeFile` 与 `'fullscreen'` 在 `EntryDetailHeader.vue` 作用域内**均不存在**——我实测 `grep -c activeFile` = **0**、`defineEmits`（`:146-155`）**无 `'fullscreen'`**、props 无 `activeFile`、view 未传 `:active-file`。按设计字面直写 → `vue-tsc --noEmit` 报 **TS2339 + TS2345** → `make typecheck` 必红（`P5_typecheck` 会抓，非静默）。处方：加 `activeFile: File|null` prop + 传 `:active-file` + emits 加 `'fullscreen': []` + `@fullscreen`。
  - **它为何判 approved**：dispatch 尺度「仅判据不可执行 / P4 会真出事才 rejected」——R2-1 判据实测全真（是**漏检**不是不可执行）、R2-2 被 typecheck 兜住（非静默），且两条都有**它已实测有效的一行级处方**；判 rejected 会耗掉 `retries[P2]` 最后 1 次。**我认同这个判断**（理由充分且不让步于问题）。
- DECISION（**P2 整体仍 rejected，须第 3 轮修订**）：按组长规则「任一专家标 BLOCKER → rejected」，eng 的 B4 是 BLOCKER → P2 整体 `rejected`。第 3 轮修订清单 = **B4（阻塞）+ R2-1 + R2-2（MAJOR，避免 P4 返工）+ N5–N8（非阻塞）**。`retries[P2]` 将用满 **3/3**——这是最后一轮，必须一次改对。
- GATE PASS（**P2 收口，两位专家均 approved、阻塞 0**）：`P2-review-eng.md` **approved**（320 行，B4 已闭环、阻塞 0）+ `P2-review-design.md` **approved**（348 行，七维全 9/8）。按组长规则「全票无 BLOCKER → approved」，P2 可收口。
  - **eng 第 3 轮的验证方式值得记**：它**不读设计的探针代码，只按 D7 文字从零重写原型**，跑设计 V17 的 7 形态（数字逐项吻合）+ **自造 9 个设计未覆盖形态**（srcset/preload/manifest/`<a href>`/`<object data>`/`<video poster>`/`<embed src>`/同名 basename×2/CSS `url()`）+ 3 组递归边界，并采用**比设计更强的双向对账**（报告 inlined ⇒ 内容真在响应里；报告 skipped ⇒ 内容真不在）→ **19 组无一撒谎**。
  - **eng 明确承认自己的处方被证伪**：它第 2 轮建议的 `used_text_keys` 钩子经复核确只有 3 个写入点（`:231`/`:249`/`:298`），不含 `@import`/`url()`/favicon → **修订者的反驳成立**，它把这条记进自己文件的 §9。**评审链的自我纠错再次运转。**
  - eng 还自报一处自己的探针坑（`@import` 整段被替换导致 marker 消失，误判为埋点漏洞）——如实记录，未掩盖。
- EVIDENCE（**eng 的 W4/W5 我已验证成立，影响 `skipped[]` schema，须 P4 前定死**）：
  - **W4**：`SiblingFileData`（`html_render_service.py:26-32`）只有 **6 字段、无 `size`** → `skipped[].size` 无可靠来源（文本 `len()` 是字符数、二进制 base64 需 ×3/4）。
  - **W5**：`get_files_by_ids`（`entry_service.py:1431-1441`）只返回**命中行** → `not_found` / `count_limit` 项**拿不到 `filename`/`path`**（溢出 id 从未查询；跨 entry id 查不到）。
  - 而设计 D7 的 schema（`:396-400`）声明了 `filename`/`path`/`reason`/`size` 四字段。→ 需二选一：补轻量查询 / schema 加 `file_id` 并允许 filename 为空。
  - **其余 WARNING 不阻断**：W1（D7 样例 `45/40/5` 机制上不自洽——limit 40 下 count_limit 应 5 项、inlined 应 36）、W2（`<a href>` 记 inlined 但 href 悬空，属既有行为）、W3（BDD-40③ 在 D10 无落点）、W6（`_process_css_refs` 实测 **8 处**调用，设计称 5 处、所引 `:372-410` 漏后 4 处）。
  - eng 另提两条测试缺口建议：**G11 双向对账断言**（势断言在"报表撒谎"时仍会绿——正是驳倒最小钩子的形态）、**G12 两跳 `@import` 用例**（V17 的 S3 只测单层）。
- NEXT: 派组长汇总 `P2-review.md`（全票 approved → approved），并让 architect 补 W4/W5 的 schema 定死（eng 说"补一句即可，不必重开评审"）。
- GATE PASS（**P2 收口已提交 `519321ab`**）：`check-gate.py P2` exit 2（通过码，`gate_pass_exit=2`）+ `check-structure-consistency` S0-S6 全 OK。`.state.yaml` 已写 `phase: P2` + history 追加 `completed`（含三轮评审全过程、12 处真实缺陷、主 Agent 3 处错误）。commit 时先被 gate 拦两次：① `P2-design.md` 缺 `prod_touched` → 用 `agate-md-field-set.py` 补 `false`；② 首次 commit 有 "暂存了 P1 产出但 phase=P2" 的 WARNING（非阻塞）。
- EVIDENCE（**我亲手补定了 eng 的 W4/W5（影响 `skipped[]` schema，P4 实现前必须定死）**）：
  - **W4 已核实**：`SiblingFileData`（`html_render_service.py:26-32`）**6 字段中无 `size`** → `skipped[].size` 无可靠来源（文本 `len()` 是字符数、二进制 base64 需 ×3/4）。→ 定死为「**已知时的近似值，取不到就 `null`**」，且**不得**为此给 `SiblingFileData` 加字段（会破坏 B2a 的「13 处既有调用零改动」）；判据不断言 `size` 数值。
  - **W5 已核实**：`get_files_by_ids`（`entry_service.py:1431-1441`）**只返回命中行** → `not_found`/`count_limit` 项拿不到 `filename`/`path`。→ 定死为「schema **必须含 `file_id`**（必填），`filename`/`path` 允许 `null`」，且**不为这两类补额外查询**（避免新增 DB 往返与穿透风险）。
  - **连带修正**：不变式的「不重复计数」断言从「按 `filename`」改为「**按 `file_id`**」——否则多个 `null` 会误判为重复而假红。
  - **W1 已修正**：D7 样例原写 `requested 45 / inlined 40`（limit 40 下机制上不自洽）→ 改为完整自洽 `45 / 36 / 9`（5 项 `count_limit` + 4 项其余），并明确「P3 造件**不得照抄本节数值**，须按实际 limits 与素材重算」。
- NEXT: P3 TDD。已跑 `agate-capture-env-baseline.py`（exit 0，stderr 的 no-formatter 提示按 P3 卡可忽略）。派发 test-designer（`P3-dispatch-context-test-designer.md` 已写 + AGATE_CARD 已注入）。
- SUBAGENT FAIL（环境层，P3 期间，已自行恢复）：承担 debug 服务的后台 job（`sleep 21600`）**到期结束** → `:8888` 停（探活 000）。P3 test-designer 正在工作（可能要跑 E2E），故立即新起后台 job `( make debug-start && make debug-seed; sleep 28800 )` 托底 → 恢复 200。
  - **数据恢复流程再次验证必要**：服务重启后 `/tmp` 数据全丢，第一遍 seed 只到 **19**（alice），补跑第二遍幂等补齐到 **22** → 现 `alice 22 / anon 15` 与基线一致。
  - **风险提示**：本次重启会冲掉 test-designer 可能已造的探针 entry。P3 的用例设计**不依赖持久数据**（造件在测试内部自建自清），故影响可控；但若它正跑到一半会看到连接失败——需在它返回时核对 `[PROD_NOT_TOUCHED]` 与自跑结果。
- NEXT: 等 P3 test-designer 产出（54 条 BDD 全映射 + 红灯）。
- GATE PASS（**P3 收口已提交 `de03b466`**）：`check-gate.py P3` exit 2 + `check-tdd-red.py` **exit 0（classic red-light）**（我亲自复跑，与 subagent 一致）。`.state.yaml` 已写 `phase: P3`。commit 时被 gate 拦一次：`P3-test-cases.md` 缺 `prod_touched` → 补 `false`。
- EVIDENCE（**P3 产出，主 Agent 逐项亲验**）：
  - **54/54 BDD 全映射**（我从 `§1.1` 表格首列提取编号，与 P1 的 54 条做 `comm` 对差：**missing=none / extra=none**）。注意：最初 grep `BDD-\d+` 只得 27 个是**误判**——该表首列是纯数字 `| 01 |` 而非 `BDD-01`，换正则后 54/54。
  - **零既有回归**（关键）：前端 31 failed 的 **7 个失败文件全是本任务新增 spec**（`tpv0104-*`）；后端 13 failed **全为本任务的 `_bdd_`/`_g11_`/`_g12_` 用例**。→ 用 `grep -c` 双向核过。
  - **冻结项零改动**：`= inject_resources(` **13**、`_process_css_refs(` **8**、legacy `firstFileId` **9 处全归零**（viewer 2 / t091 4 / tpv0099 3）。`make typecheck` exit 0。
  - **test-designer 的两处关键处置（我认可）**：① `constructedRows` 未声明为类型成员会让 `vue-tsc` 报 TS2339 → 把「行为未实现」（B 类）误判成「测试写错」（A 类）；它用 `constructedRowsOf()` 局部类型放宽 + **新增代码级断言锁死「必须是必填成员」**（放宽不放水）。② P2 §0.1A 与 §5.1 的取证命令不一致（预算用例归属）→ 按**冻结命令**收敛，把预算测试合并进 `test_html_render.py`（追加 402 行），确保 `tests_filter` 真能跑到；期间曾把 `= inject_resources(` 推到 14，已修回 13。
  - **一处它的回报笔误**：它报「`test_tpv0104_inject_budget.py` 写完自跑 10F/3P」，但该文件**已删**（合并进 `test_html_render.py`）——我按 `.pyc` 残留 + `find` 确认，非缺陷。
- DECISION（**P4 并行编排**）：P2 的 4 批 output **两两零重叠**（我用脚本核过）。故：
  - **并行跑**：`backend-render-budget`（只改 `backend/`）+ `data-viewers`（只改 `frontend-v3/src/`，且与 detail 批文件不重叠）
  - **串行**：`detail-navigation` **逻辑依赖** `detail-outline`（前者要调后者提供的 `setTocHeadings()`）→ 等 `detail-outline` 完成后再启动
  - 已写 `P4-dispatch-context-implementer-{backend-render-budget,data-viewers}.md` + 注入卡片。
- NEXT: 等这两批返回；同时准备 `detail-outline` 的派发上下文。
- CORRECTION（**P4 派发时我自己制造的批间范围越界，已发现并纠正**）：我给 `detail-outline` 写的 dispatch-context 把 P2 的 **D5「全屏入口」+ zen 侧栏**（涉及 `EntryDetailView.vue` / `EntryDetailContent.vue` / `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue`）也列进了该批，但 P2 的 `dispatch_plan` 把这 4 个文件**全部划给 `detail-navigation` 批**。
  - **发现过程**：我在给 `detail-navigation` 写上下文时凭印象写下"与 detail-outline 有 3 个文件重叠"→ 回头用脚本核 design 的 `output` 集合，**交集为空**（说明 design 的划分是对的）→ 真正的问题在我的派发，不在 design。
  - **处理**：① 在 `detail-outline` 的上下文里加「⛔ B/C 组范围更正」段，明确本批**只做 A 组 4 个文件**（`useMarkdown`/`useEntryDetailComputed`/`MarkdownViewer`/`TocNav`），已做的 BC 组须 `git checkout --` 还原；② 给 `detail-navigation` 上下文**补写 C 段**（D5 全屏入口 + zen 侧栏，11 条实现要点），并更新目标段说明「范围含 D5」；③ 给正在运行的 `detail-outline` subagent 发消息说明是我的错、请收窄。
  - **教训**：批间边界要**从 design 的 `output` 集合脚本核对**，不能凭印象；我这次是"先写派发、后核边界"，顺序反了。
- NEXT: 等 `backend-render-budget`（改 backend 中）+ `detail-outline`（收窄后跑 A 组）。`detail-navigation` 待 `detail-outline` 完成后再派（它需要 `useEntryDetailComputed` 的改动就绪）。
- GATE PASS（**P4 前 3 批已落地**，主 Agent 亲验）：`make typecheck` exit 0、`make lint` **exit 0**（我修了 P3 留的 SIM300 Yoda 条件：`_MAX_INJECT_IDS < declared - 1` → `declared - 1 > _MAX_INJECT_IDS`，语义等价、该断言仍通过）。前端红灯 **31F → 12F**（`BDD-47×4 + tpv0104-default-file×8`，全属 navigation 批）。
  - **第 1 批 `backend-render-budget`**：13 条红灯全转绿，`tests_filter` **89P/0F**；全量 backend **仅 1 预存失败**（`test_cli_remote` 沙箱只读）→ 零回归。冻结计数 `= inject_resources(` **13** / `_process_css_refs(` **8** 保持。新建 `docs/architecture/html-preview-security-modes.md`。
  - **第 4 批 `data-viewers`**：3 个红灯 spec 全绿（22P），`tests_filter` **70P/0F**，31F→21F，零新增失败。既有契约（`:51-57` 空输入、`:68` throw、`HtmlViewer.spec:338-365` 左闭右开）全保。
  - **第 2 批 `detail-outline`**（收窄后只做 A 组 3 文件）：`tests_filter` **241P/1S/0F**，`tpv0104-markdown-headings` 4F/2P→**6P/0F**，BDD-07 逐行正则归零。21F→12F。
- CORRECTION（**第 1 批发现 P3 的一个真实夹具缺陷，我已复现确认**）：`test_html_render.py:62` 的 `_render_url` 是 **P3 之前的既有 helper**，却对传入的 list 做 f-string 插值 → 生成 `?inject=[10, 11]` → 服务端按逗号切出 `"[10"` 与 `"11]"`，`int()` 双失败 → **实际请求到 0 个 sibling**（实测 `[123,124,125]` 只偶然命中 `[124]`）。**P3 期间被「报表块不存在」这个更早的失败掩盖，故未暴露**。第 1 批按前端既有契约（`HtmlViewer.vue:152` 的 `join(',')`）修 helper，**未动任何断言**。→ 这是"红灯阶段的上游失败遮蔽下游缺陷"的实例。
- CORRECTION（**`detail-outline` 报出一处我的派发疏漏，已补**）：我给它写的上下文误把 **D5 全屏入口 + zen 侧栏**（4 个文件）划进该批，而 P2 的 `dispatch_plan` 把它们全划给 `detail-navigation`。它按我的更正消息收窄为 A 组 3 文件（`MarkdownViewer.vue` 经核**无需改**——`emit('headings')` 早已存在，设计 `:107` 提到的 `select-heading` emit 在现仓**从不存在**，已记 `[DESIGN_GAP]`）。
  - **它还发现一处真实跨批缺口**：`tocHeadings` 已改 `ref` + `setTocHeadings()`，但**全仓无一处调用 `setTocHeadings`** → 真实页面 TOC 恒空 → E2E 的 BDD-01/02/03/04/05/06/52 全红，而 **vitest 看不出来**（`t031`/`t067` 整体 mock 掉了）。P2 `:191` 其实写了这条数据流，**是我漏进 navigation 的 dispatch-context**。已补 **C0 段**（三段接线 + grep 自查）。
  - **连带发现时序问题**（我复核确认）：`EntryDetailView.vue:242-246` 用 `await nextTick()` 判 `tocHeadings.value.length > 0`，但 headings 现在**异步到达** → 该时点恒为 0 → 桌面默认展开永不触发。已在 C0 里补 `watch(tocHeadings, ..., {flush:'post'})` + `userToggledToc` 守卫的确切形态。
- NEXT: 等 `detail-navigation`（最后一批）。完成后按 C8 派 P4 评审（`domains: [frontend, backend]` → `review` + `design-review` 双评审 + 组长汇总）。
- GATE PASS（**P4 四批全部完成，主 Agent 亲验全绿**）：
  - **前端** `make test-frontend`：**127 files / 1514P / 4S / 0F**（基线 1456P → +58 新用例；**零失败**）
  - **后端** `make test-quick`：**1221P / 1F / 3S**（基线 1205P → +16 新用例；**唯一失败仍是预存 `test_cli_remote`** 沙箱只读）→ **零回归**
  - `make typecheck` **exit 0**；`make lint` **exit 0**；`make build-frontend` **exit 0**（dist 7 文件，已同步到 `backend/peekview/static/`——满足 P4 卡「须实际产出并确认构建产物」）
  - `check-platform-assumptions.py` 0 命中；`= inject_resources(` **13** / `_process_css_refs(` **8** 保持
  - 前端红灯 **31F → 0F** 全清
- EVIDENCE（**P4 期间发现并修复的真实缺陷，含我自己的两处疏漏**）：
  1. **P3 夹具缺陷**（第 1 批发现，我已复现）：`test_html_render.py:62` 的 `_render_url` 对 list 做 f-string 插值 → `?inject=[10, 11]` → 服务端切出 `"[10"`/`"11]"` 双 `int()` 失败 → **实际请求到 0 个 sibling**（`[123,124,125]` 只偶然命中 `[124]`）。P3 期间被「报表块不存在」这个更早的失败掩盖。按前端 `join(',')` 契约修 helper，**未动断言**。
  2. **我的派发疏漏 1**：给 `detail-outline` 的上下文误含 D5 全屏入口 4 文件（P2 划给 navigation）→ 已发消息更正、它收窄为 A 组 3 文件。
  3. **我的派发疏漏 2**：**漏了 `setTocHeadings` 接线**（P2 `:191` 写了数据流，我没进 navigation 的上下文）→ `detail-outline` 报出后我补了 **C0 段**（三段接线 + grep 自查）。若不补，真实页面 TOC 恒空 → E2E 的 7 条 TOC 类 BDD 全红，而 vitest 因整体 mock 看不出来。
  4. **连带时序缺陷**（我复核确认）：headings 改异步到达后，`EntryDetailView` 的 `await nextTick()` 判 `tocHeadings.length > 0` 恒为 0 → 桌面默认展开永不触发。补 `watch(...,{flush:'post'})` + `userToggledToc` 守卫。
  5. **`detail-navigation` 的两处高质量自主决策**：① `loadEntry` 加 `targetFile.id === fileId` 守卫（否则 `?file=A` 会展示 B 的正文——P2 D3 字面没覆盖）；② **不放宽既有 t082 行数契约**（`EntryDetailView<300` / `entryDetail.ts<150`），把 URL 同步抽到 `useEntryDetailUrlSync.ts`，最终 295/145 行。
- EVIDENCE（**P4 的标记统计，我按行首格式核**）：`[DESIGN_GAP:` **5 条**（`:334`/`:336` 来自 outline 批 2 条 + `:507`/`:508`/`:509` 来自 navigation 批 3 条）+ `[SCOPE+]` **1 条**（`:511`，注意它是 `### [SCOPE+]` 的节标题格式，用 `^\[SCOPE+:` grep 会漏）。**P7 须逐条转抄 + 配对 `[DESIGN_GAP_REVIEWED:]`**。
- NEXT: 按 C8 派 P4 双评审（`domains: [frontend, backend]` → `review` + `design-review`）+ 组长汇总出 `P4-review.md`。
- EVIDENCE（**P4 design-review 判 `approved`，8 条 UI 判据全实测通过**）：
  - **TOC h1 两向**：非 active 时 `fw 600` + `--c-text`（与 h2 的 `fw 400` + 次要色可区分）；**active 时仍保强调色**（暗 `rgb(77,141,255)` / 亮 `rgb(9,105,218)`）**且仍保 fw 600** → P2 的「颜色/字重拆两条规则」生效、**R16 未复发**。对比度暗 15.26:1 / 亮 15.8:1。
  - **360px 档**：5 素材 × 3 档 = 15 组全部 `scrollWidth == clientWidth`（overflow 0）、`height == 64`、spacer 余 **5.39px**（与 P2 预测逐位一致）；最坏形态（含 wrap 共 7 按钮）仍 0 溢出。
  - **`/f` 下两侧栏 DOM 均 0**（用**多文件** entry 实测；普通态各 1，排除了单文件误导样本）。
  - **全屏按钮可访问名称仅靠 `aria-label`**（`title=null`）→ 在含 **13 个 `DiagramBlock`**（各带 `title="Fullscreen"`）的页面上全页计数**仍 == 1**（强于 BDD-31 的 Given）。图标 16px、无 `disabled`、过渡继承。
  - 截断态表头 `thead 37.5px` **不塌陷**、4 个 `.th-label` 文字可见、sort/filter 均 0、垂直居中偏差 −0.25px；banner 含 `5` 与 `11`；AI Slop 暗+亮双主题扫描渐变 0 / 紫 0。
  - 4 项发现均**不要求改代码**：F1 表头行高跃迁（P2 R12 已接受的既定代价）、F2 既有 `overflow-trigger` 38px 热区（`layout.css` 不在 diff，改 44px 会破 @360 的 5.39px 余量）、F3 `TocNav.vue:45` no-op 声明（既有行）、F4 见下。
- **⇒ 必须转抄到 P6 dispatch-context 的一条**（design-review 发现，我已核实）：`EntryDetailContent.vue:90/120` 的 **`:activeId="null"` 是硬编码**，全仓**无任何 scroll-spy / IntersectionObserver**（我 grep 确认）→ **TOC 的 active 态永远不会自然出现**。因此 **P2 UI 校验点 ⑦ 括注的「等价于滚到文章开头让 scroll-spy 点亮它」不成立**——P6 若照字面滚动会读到非 active 值，把 R2-1 误判为回归（**假 FAIL**）。
  - **正确验法**：`h1.classList.add('active')` → `waitForTimeout(400)`（**必须 > `--transition-fast` 150ms**，否则读到过渡中间值——design-review 首测即踩此坑）→ 读 `getComputedStyle` → `remove('active')`。
  - **范围纪律**：**不要**在 P4 为此扩范围去接真实 scroll-spy——那是 P1 未声明的需求。
  - 环境：`[PROD_NOT_TOUCHED]`，3 个临时 entry（含一个 **50001 行真实触发 maxRows=50000**）全部经 API 建/删，复查 404、全库 16 条无残留。
- NEXT: 等 P4 `review`（后端侧代码评审）返回，然后派组长汇总 `P4-review.md`。
- GATE FAIL（**P4 评审 `review` 判 `rejected`：3 CRITICAL + 2 MAJOR。我逐条独立复现，全部成立**）：这是本任务**最有价值的一次评审**——在全绿（1514P/1221P/typecheck/lint/build 全过）的情况下找出了**任务核心诉求失效**的真缺陷。
  - **C1（api/files.py:389）总预算记账单位错配**：`cost = len(data.content)` 是**字符数**，而单文件检查 `record.size` 是**字节数**。我实测：`len('中'*670000)=670000`（字符）vs `len(encode)=2010000`（字节，**3 倍**）；12 个中文 CSS 按字符数累计 8,040,000（< 8MiB → **全放行**），按字节数实际 24,120,000（**3.0 倍超限 → 应拦截**）。评审实测 emoji 达 **2.98×**、报表 `skipped=[]` **自称合规**。→ **本任务的存在理由（BDD-38~41 资源边界）在该形态下完全失效，且报表说谎，比不设预算更危险**。
  - **C2（api/files.py:430-436）`lower()` 变长致下标错位**：`idx = html.lower().rfind("</body>")` 在**变形后**串上取下标，`html[:idx]` 却切**原串**。我实测 `İ`（U+0130）`lower()` 后从 1 码点变 2（`i`+U+0307），使 `html.lower()` 长 1 → 下标**偏移 1** → 把 `</body>` **劈成两半**（`<` + 报表块 + `/body>`）。全 Unicode **仅此一个码点变长**，但一定触发。
  - **C3（html_render_service.py:449-456）`not_injectable` 缺 `file_id`**：违反 P2 `:411` 冻结 schema（`file_id` 必填）。预算层五类都填了，只有第六类漏。我核代码确认。→ 两类 reason 共存时 P3 的 BDD-38③ `assert isinstance(item["file_id"], int)` 会 **KeyError**。
  - **MAJOR 3-1**：`select_inject_ids` 删掉唯一的 `break` → `overflow` 无界，`?inject=` 500 个假 id → 响应放大 **13×**（`Query(None)` 无 `max_length`，未认证可传）。
  - **MAJOR 3-2**：`owners` 单命名空间，text/binary 同名键互相覆盖 → 「已注入」被登记为「未注入」。评审还找到**一个 HTTP 可达的近亲**：同 entry 两份同名 `app.css`（一 text 一 binary，POST 201 接受）→ 报表 `inlined=1` 但**两份都没进响应**（谎报）。
  - **三条各自的「为何测试绿」都是素材取值域缺口**：BDD-40 用 `"y"`（ASCII ⇒ 字符==字节）、BDD-40③ 的 evil 素材纯 ASCII（`lower()` 保长）、BDD-38 素材无非 css/js sibling（`not_injectable` 恒 0 项）。**不是同一处，是三个正交维度**。
  - **评审同时确认**：P3 测试**一字未改**（10 份归档副本 `diff -q` 全 SAME；`test_html_render.py` 段级 diff 仅我改的 SIM300 一行）；5 条 `[DESIGN_GAP]` + 1 条 `[SCOPE+]` **全部合理**；前端专项全过；`make lint` 的 SIM300 修是**必要**（评审用 `ruff --isolated --select SIM300` 跑 `de03b466` 原始文件确认当时确实红）。design-review 已判 `approved`。
- NEXT: P4 重试 #1（`retries[P4]` 计 1，上限 3）——派 implementer 修 3 CRITICAL + 2 MAJOR + MINOR。
- EVIDENCE（**P4 重试 #1 完成，三条 CRITICAL 的修复我已独立验证**）：
  - **C1 我亲跑进程内 app**：12 个中文 CSS → `requested 12 / inlined 4 / skipped 8`、`reasons={'total_budget':8}`、响应 **7.67 MiB ≤ 8 MiB**、势成立、**每条 skipped 都有 `file_id`**。修复前是 23.0 MiB / 2.88× / `skipped=[]`。→ **核心缺陷已修**。
  - **C2 我亲验**：`İ`（U+0130）三种形态（`<p>İstanbul</p>` / `İİİ` / 大写 `<BODY>`）下 `</body>` **均完整保留**、报表插入位置正确。
  - **C3 代码确认**：`file_ids[id(f)]` 旁路 map 已在 `:479` 落地。
- **DECISION（裁决修复者申报的 4 点）**：
  1. **M1 接受方案 C**（`inject: Query(None, max_length=4096)`）。理由：修复者实测证明评审推荐的 B **必然破坏 P2 冻结的势不变式**（K=100/500 个 id 时两种落法 `100 vs 500`、`101 vs 500` 均不成立），且汇总项无 `file_id` 违反必填 → **A/B 都需回 P2 授权改契约**，成本高于收益。C 的诚实边界我已核算：4KB inject ≈ 585–1365 个 id → 响应 53–123 KB（6.6–15.3×），**确实不是压到 1×**，但把原本无界（5000 id → 460 KB）压到了有界可控。→ **这是可接受的契约级取舍，记入 P7**。
  2. **确认 C2 不照抄评审的 `re.search` 是对的**：原实现 `rfind` 语义是「**最后**一个 `</body>`」，评审建议的 `re.search` 取**首个** —— 照抄会静默改变行为（把已登记的 MINOR「正文含字面 `</body>`」从"插错位"变成"插到首个 `</body>` 后"）。修复者的 `matches[-1].start()` 只消除根因（`lower()` 非保长），语义保持。**我复核代码确认 `:441` 用的正是 `matches[-1]`。**
  3. **确认评审 §3-2 的「HTTP 可达近亲」根因判断有误，修复者是对的**（我实测证实）：POST 两份同名 `dup.css`（一 text 一 binary）→ **DB 保留 2 行**（id 47 text / id 48 binary），但 **两行读到的内容都是 PNG**（后者覆盖前者，磁盘实际只有 1 个文件）。→ `inlined=1` **不是谎报**（记录 48 的内容确实进了响应），评审的「owners 互相覆盖致谎报」归因错了，根因是**存储层同名覆盖**。→ **不修**（会动 entry 写入命名策略，超 P1 范围），**登记为 `[SCOPE+]` 待 P7 判定**。探针 entry（`fngefq` + 残留 `gizqeg`）已全 DELETE、anon 复位 15。
  4. **接受「势不变式 vs skipped 逐项上限 不可兼得」为契约级取舍**，P7 登记。
- CORRECTION（**重要环境事实，影响 P5/P6**）：`:8888` **跑的是 P4 之前的代码且无 `--reload`**——我实测 `render` 响应**完全无报表块**（grep `peekview-inject-report` = 0），`files.py` 的 mtime（08:30）远晚于服务启动时间（06:20）。→ **P5/P6 在做任何依赖报表块的验证前必须先重启 debug 服务**，否则验的是旧代码（修复者正是识别到这点才改用进程内 app 自测，判断正确）。
- NEXT: 修复已完，回派 `review` 复审（3 CRITICAL + 2 MAJOR 是否闭环）。
- CORRECTION（**重要环境事实 + 我的一次诊断弯路，必须记入 P5/P6 的 dispatch-context**）：
  - **`:8888` 无法重启到新代码**：我在 P4 提交后 `make debug-stop` + `make debug-start`，但服务响应始终是**旧代码**。根因诊断过程：① 用 `cache-control` 判断（源码 `no-store, no-cache, must-revalidate` vs 响应 `no-store`）→ 误以为服务旧；② 查 pyc 时间一致、源码常量正确（`_MAX_INJECT_IDS=40`）→ 排除缓存；③ 最终用**报表块是否存在 + `maxInjectIds: 40`** 判断才可靠。
  - **真正根因有两条**：**(a)** `scripts/dev-server.sh:118-135` 启动后**只探 `/health` 是否可达**——若旧进程仍占着 8888，新进程绑定失败但 `/health` 立刻返回 200 → **脚本误报"✓ 服务已启动"**，而实际仍是旧进程在服务。**(b)** 旧进程由**宿主侧持有**，我这边 `make debug-stop` 报告"✓ 服务已停止"、`pkill` 也杀不到（进程在沙箱外），→ **`:8888` 上的旧代码不可替换**。
    - **`cache-control` 不能作为判据**：`main.py:265-269` 的中间件对所有 `/api` 路由统一覆写 `Cache-Control: no-store`，覆盖了 `files.py:427` 的值 → 新旧代码响应头相同。**这是既有行为，非 P4 缺陷。**
  - **绕过方案（已验证可行，P5/P6 用这个）**：`make debug-extra PORT=8890` + `make debug-seed PORT=8890`，**挂在后台 job 托底**（`( make debug-extra PORT=8890 && make debug-seed PORT=8890; sleep 28800 )`）。我实测 8890 跑**新代码**：报表块存在、`maxInjectIds: 40`、`maxFileBytes: 2097152`、`maxTotalBytes: 8388608`、`notes.md` 正确归 `not_injectable` 且 **`file_id` 齐全**。
  - **教训**：本环境"服务存活"是三层易失（端口被旧进程占 / 新进程静默失败 / 脚本误报成功）。判断"跑没跑新代码"要用**行为特征**（报表块、常量值），不能用响应头（会被中间件覆写）。
- NEXT: P5 用 **8890**（新代码）做技术验证；`:8888` 只能用于不依赖新行为的场景或明确标注"旧代码"。
- EVIDENCE（**P5 第 1 条已完成 + 一个协议/工具链缺口**）：
  - `P5`（`make test-quick`）：exit 1，**1 failed / 1221 passed / 3 skipped**（34.41s）。唯一失败 `test_cli_remote::TestCLIRemoteConfig::test_config_set_remote_api_key`（`OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`）= **预存失败**。passed 1221 与 P4 后基线**逐项吻合** → 零回归。
  - **工具链缺口（verifier 发现，我裁决不在本任务修）**：`agate-run.py --task`（P5 卡推荐的执行入口）把输出写 `<TASK_DIR>/runs/<k>.log`，而仓库 `.gitignore:87` 的 `*.log` 命中它（`:94` 只给 `P6-evidence/logs/*` 开例外、**没给 `runs/**`**）→ `agate-run.py` 打印「任务内日志被 .gitignore 覆盖（证据须入库）」并 **return 1** ⇒ **无论命令真结果如何都返回 1（假红）**。
    - **裁决：不加取反规则**。理由：① P5 卡明确「直接 bash 执行也能跑」；② 改 `.gitignore` 属工具链改进，会让 P5 commit 混入非产出改动（违反 P5 卡 R9「P5 commit 不得混入非产出文件改动」）；③ 应单独立项。
    - **处置（verifier 已执行）**：改用 `timeout` + 直接 bash，完整输出落 `P5-test-results/` + 逐条 exit code 记录。`runs/1.log` 由 agate-run 落盘但不 commit。
    - **建议报上游**：`runs/**` 应与 `P6-evidence/logs/*` 同等豁免（两者都是「证据须入库」的 agate 产出）。
- NEXT: verifier 继续跑剩余 10 条（2 个新 e2e spec + 3 个 legacy e2e + frontend/typecheck/lint/docs）。
- EVIDENCE（**P5 前 10 条结果 + 两类失败归因，均已我亲自诊断**）：
  - **通过**：`P5`（1221P/1F 预存/3S）、`P5_frontend`（127 files/1514P/4S/0F）、`P5_typecheck` exit 0、`P5_lint` exit 0、`P5_docs` exit 0、**`P5_e2e_mobile_widths` 18 passed / 0 failed**（本任务新 spec，三档全绿）。
  - **`P5_e2e`（本任务主 spec）：47 passed / 24 failed / 7 flaky** → **根因是 P3 测试断言写错，不是 P4 实现 bug**。我实测确认：YAML 文件走 **TreeView 树渲染**（`EntryDetailContent.vue:59-62`），`textContent` 是 `apiVersionv1stringkindServicestringmetadata...`（**键值间无冒号空格**）→ `toContain('kind: Service')` **永远失败**。受影响 8 处断言（spec `:357/372/383/432/458/486/615/781`）。**可用修法我已验证**：改为 `toContain('Service')` / `toContain('Deployment')`（只留值），两文件互为反例（service 文件 hasDeployment=false）。**TreeView 是 T075 既有实现、非本任务改动** → 这 8 条在 P3 设计时就该红。
  - **`P5_e2e_legacy_viewer`：18 failed / 20 passed = 与基线完全一致** ✓（根因 TPV0095 遗留的 `markdown-test` 匿名 404）。
  - **`P5_e2e_legacy_t091`：14 failed / 12 passed（基线记 12F/12P）** → 多 2 条，待精确定性。
  - **`P5_e2e_legacy_tpv0099`：4 failed / 2 passed（基线 6P/0F）** → 我诊断出**根因是 seed 数据缺失，不是代码回归**：`markdown-test`/`mermaid-charts`/`csv-employees` 三个 team entry **未在 DB 中**（alice 22 条里没有），而基线是在它们存在时测的。**重跑 `make debug-seed` 后 `Total entries: 25`，三者均 200、`markdown-test/raw` 200 → 重跑 `tpv0099` 全绿（"✓ 所有 E2E 测试通过"）**。
  - `image-gallery` 仍 404 = **真实 0 文件**（seed `:184` `SKIP no content files`），与既有记录一致。
- DECISION（**P5 判定**）：① `tpv0099` 的 4 failed = **环境问题（seed 数据缺失）**，已修复并验证全绿，**不计为本任务失败**；② `P5_e2e` 的 24 failed = **P3 测试断言缺陷**（YAML 树渲染形态），需修测试 → 属 P3 产出缺陷，按 P5 卡「真 bug → 回 P4」的同类处理（修正测试后重跑）；③ `t091` 的 14F 需与基线 12F 精确对比。
- NEXT: 修正 `P5_e2e` 的 8 处 YAML 断言 → 重跑；同时让 verifier 补齐 `t091` 的 2 条增量归因 + 产出 `P5-test-results/`。
- EVIDENCE（**P5 收口：我亲自修完 5 类测试缺陷，主 spec 从 24F → 0F**）：
  verifier 的 11 条全跑完，7 条 PASS、2 条 FAIL 均为**测试产物缺陷**（不是实现 bug）。我逐条独立诊断并修复：
  1. **yaml 断言形态**（8 处）：YAML 走 TreeView 树渲染，`textContent` 无 `": "` 分隔 → `toContain('kind: Deployment')` 恒假。改为只留值（`Deployment`/`Service`）。**24F → 16F**。
  2. **BDD-06 素材撑不出滚动**：我实测 `docH == winH == 800`（400 字符段落太短），`scrollIntoView` 无效、标题停自然位置 239.59px → 断言 ≤200 恒假。改为 4000 字符。
  3. **BDD-44 字节数算错**：`'中'.repeat(350000)` UTF-8 = **1,050,011 B < 2 MiB**，断言 `>= 2MiB` 恒假。中文 3 B/字，改 `repeat = 700_000`（字符 700k < 2MB 而字节 2.1MB ≥ 2MB，正好落在 BDD-43/44 判据区间）。
  4. **BDD-22/49 的 `share.token` 字段不存在**：API 实返 `token_prefix` / `share_url`（完整 token 在 url query），`.token` 恒 `undefined` → `share=undefined`。改为从 `share_url` 解析。（**verifier 独立诊断出同一结论**）
  5. **BDD-49「匿名 404」是假假设**：登录接口返回 `Set-Cookie: peekview_token=...`，Playwright 的 `APIRequestContext` **自动保存并携带** → 「匿名」请求实际带认证，返回 200。**后端权限本身是对的**（我用 curl 无认证访问私有 entry 实测 **404**）。改用 `pwRequest.newContext()` 独立未登录 context。
  6. **BDD-51 反例选错**：我把 `not.toContain('kind: Service')` 改成 `not.toContain('Service')` 后，撞上 README 里本就有的「ClusterIP Service」。改为 `apiVersion`（README 是 markdown 无该键，YAML 渲染才有）。
  7. **BDD-24 未滚到底**：`lastBottom` 统计了视口外元素 → 恒大于底栏 top。加「先滚到底」+ 只统计已进入视口（`r.top < innerHeight`）的元素。
  - **结果**：串行 `78 passed / 0 failed`（exit 0）；**官方 `make debug-test`（多 worker）实测 `✓ 所有 E2E 测试通过`、exit 0、70 passed**。
- EVIDENCE（**t091 14F vs 基线 12F 的归因**）：spec 实为 **13 test × 2 project = 26 项**，而 P1 记的 `12F/12P = 24 项` **比可执行项少 2** → **疑 P1 基线漏计 2 个**。14 个失败**全部**指向 `markdown-test` 匿名 404（TPV0095 遗留，与 viewer 18F 同源）；P4 对该 spec 仅 4 处 `firstFileId→file`，`git diff 4ec6b1b6~1 4ec6b1b6 -- frontend-v3/e2e/` 为空 → **非本任务引入**。→ 判为**既有失败 + 基线计数瑕疵**，登记 known-failures，不阻断。
- NEXT: 登记 known-failures、让 verifier 产出最终 P5-test-results、跑 check-gate P5、提交 P5。
- GATE PASS（**P6 验收通过：54/54 BDD PASS，0 FAIL。主 Agent 亲验全部 gate**）：
  - `check-p6-format.py --fix` **exit 0**
  - `check-p6-evidence.py <TASK_DIR>` **exit 0**（`54 条 BDD，证据目录非空`）
  - `check-gate.py P6 <TASK_DIR>` **exit 2（通过码）**（`结构化 results 判据 D1–D10 通过`）
  - `check-p6-provenance.py` **exit 2，但全部是历史 progress 文件的 `缺 agent 字段`（协作规范，不阻塞）**，无 P6 级错误
  - **我独立核的证据真实性**：`P6-evidence/screenshots/` **27 张 PNG，md5 全部唯一**（最小 11936B，非空壳）；`P6-evidence/logs/` 13 个；`vision-reports/` **22 个 YAML，`blocker_count` 全为 0 且无 -1**（说明真解析到模型自报数，非写死）；`P6-acceptance.md` frontmatter `pass: 54 / fail: 0 / ui_affected: true`，`results` 每条带 evidence 数组 + vision 引用。
  - **抽查 BDD-38 的 live HTTP 证据**：日志含完整请求/响应与报表数据（`maxInjectIds: 40`、`requested=41 / inlined=0 / skipped=41`、`limits` 三值），是真实跑出来的。
- EVIDENCE（**verifier 两处主动推翻自己的产出，值得记**）：① 第一版 vision 脚本把 `blocker_count` 写死 0 且 prompt 问的是自造要求 → **整个废弃重做**，改为只问渲染缺陷 A–E、`blocker_count` 取模型自报数、解析不到则 **-1（fail-closed）**；② 第一轮残留检查用了非法 `per_page=200` 静默拿到错误响应 → 改分页拉全量重做。**这两条都是"看起来通过了但其实没验到"的典型，它自己发现并纠正，质量高于一般自述。**
- CORRECTION（**我修了一个会复发的证据落点缺陷**）：verifier 指出 `frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts:20` 的 `EVIDENCE_DIR` 是**相对 cwd** 路径，而 `make debug-test` 的 cwd 是 `frontend-v3/` → 证据被写到 `frontend-v3/agate-workspace/...`（**P5 与 P6 各踩一次**）。**根因在 spec 不在执行方式。** 我已改为基于 `fileURLToPath(new URL('.', import.meta.url))` 的绝对路径（`../../agate-workspace/tasks/TPV0104-.../evidences`），并实测验证：路径解析正确、E2E 重跑**无误落**。
- EVIDENCE（**E2E 的 flaky 定性与我的独立确认**）：修路径后重跑 `1 failed / 71 passed / 6 flaky`。唯一 failed 是 **BDD-27**、失败上下文是 BDD-30 的 `waitForSelector` 20s 超时 → **并发资源竞争**。我**串行单跑 `bdd_27|bdd_30` → 4 passed**，确认是 flaky 而非功能缺陷。P6 验收的取证用的是串行方式，结论正确。
- DECISION（**接受 verifier 的 `p5_evidence_reuse: false`**）：它声明未复用 P5 结论、独立实跑全部 54 条（vitest 50/50、pytest 62 passed、E2E 主 spec exit 0、后端全量 1221P/1F、前端 1514P/0F、自建 Playwright 37/37）。这比复用 P5 证据更强，符合 P6「功能验证和格式都必须满足」的要求。
- NEXT: 提交 P6（`.state.yaml` 写 phase: P6）→ 派 P6.5 judge（fresh context 独立复核）→ 过 gate → 写 phase: P7。
