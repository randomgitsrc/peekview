---
phase: P1
task_id: TPV0104
type: progress
trace_id: TPV0104-P1-20261124
prod_touched: false
---
# P1-progress (analyst, TPV0104)

## 计划与预期耗时（第一条 bash 命令前）
- 将要跑的：① 读 P1-dispatch-context + analyst.md（read 工具，无 bash）；② agate-md-field-set --list（<2s）；③ P0-brief.md 全文（read）；④ 三份 docs/notes（read，其中 897 行报告按 V-01~V-08 节选读）；⑤ DESIGN.md 全屏/图标相关节；⑥ 源码/测试复核（read+grep）；⑦ 同类扫描 grep 全仓（grep 工具，5 组符号）；⑧ 写 P1-requirements.md + field-set 写 frontmatter（write + bash <5s）；⑨ 自检。
- 预期总耗时：约 25 分钟（最长单条 bash = agate-md-field-set --list，timeout 30s）

## 输入文件读取记录
- [16:55:57] R1 ✅ 读完 P1-dispatch-context-analyst.md（364 行）——目标/12 条约束/输入文件清单/objective_info 四处实测冲突+环境坑
- [16:55:57] R2 ✅ 读完 analyst.md（270 行）——产出七节结构、BDD 反模式自检清单、UX 形态声明、同类扫描、P0 时效性质疑
- [16:56:09] R3 ✅ 读完 P0-brief.md（378 行）——8 项缺陷/6 条决策/决策 7 完整设计/§7.5 四处冲突/§7.4.1 机制替换/已知风险 11 条/45 条 BDD 倾向（正文实为 45 项，P0 自述增至 40 条有误，P1 需记）
- [16:56:09] 发现 1：P0 风险段写「BDD 从 19 条增至 40 条」，但验收基线实际编号 1..45（V-02 5 + V-01 6 + V-02b 5 + V-03b 9 + V-04b 7 + V-05b 3 + V-04 3 + V-03 2 + V-06/07 3 + V-08 1 + V-05 1 = 45）→ 时效性核对点
- [16:56:26] R4 ✅ 读完 docs/notes/issues-20261124-1553.md（189 行）——URL 四组合语义/默认入口三级优先级（根 README.md > 根 index.md > 稳定排序首个，大小写不敏感、只匹配根目录、路径+ID tie-breaker）/§4.1 假设复用现有全屏入口（§7.5 冲突 2 已证伪）/§五 URL 状态同步 6 条/§七 V-01~V-05 验收
- [16:56:26] R5 ✅ 读完 docs/notes/issues-20261124-1612.md（172 行）——全屏入口要求：图标 Maximize + 文字「全屏阅读」、不得只放文件树、不得逐文件加按钮、不得新增文件选择器、桌面/移动均可发现可操作且不遮挡主要内容；情况 A/B 点击行为；默认入口不得假定 files[0]
- [16:57:08] R6 ✅ 读完 docs/notes/issus-20261124-1429.md（897 行，按 V-01~V-08 节分段读）——八项核实结论 + 每项代码事实/影响/建议 + 现有测试覆盖不足表（明确「assert "https:" in csp 是契约非遗漏」）+ 三批次修复顺序
- [16:57:08] R7 ✅ 读完 docs/reviews/v04-truncated-header-controls-20261124.md（51 行）——V-04 未修复，(25-31)/(32-37) 无 v-if；(58) 是唯一被隐藏项；方案 A 隐藏控件（推荐）vs B 让排序生效
- R7 ✅ docs/reviews/v04-truncated-header-controls-20261124.md（51 行）——V-04 未修复：`.th-sort-btn`(25-31)/`.th-filter`(32-37) 无 v-if；`.table-controls`(58) 是唯一被隐藏项；方案 A 隐藏控件（推荐）vs B 让排序生效
- R8 ✅ agate-md-field-set.py 就位（路径是 `.py` 后缀，非无后缀）；--list 需 FILE 环境变量且文件须先存在 → 顺序改为：先 write 正文，再 field-set 写 frontmatter。P1 task_fields = [risk_level, phases, packages, domains]（rules/phases.yaml:50），ui_render_shape/ui_ux_dimensions 属可选 schema 字段
- R9 ✅ 读完 DESIGN.md（337 行，重点节选 §6 Component/Icon Buttons 选型规则、§6 Zen Mode（`/f` locked，`f`/`Escape` 无效，需改 URL 离开）、§7 Iconography（Lucide，18/20px 按钮）、§9 Responsive（≤640px 移动端、触控 ≥44px、主操作→固定底部栏 + `--mobile-bar-height`）、§10 A11y
- R10 ✅ AGENTS.md 项目约定已在会话注入（铁律 1-11/环境隔离/常用命令/测试注意事项）
- R11 ✅ 复核源码现状（与主 Agent 实测一致，全部亲自验证）：EntryDetailView.vue:232-247（`:234` 读 firstFileId、`:236` loadEntry、`:238` `query:{}` 一锅端）、entryDetail.ts:36-71（`:50-52` files[0] 双兜底）、useEntryDetailComputed.ts:51-78（extractHeadings 独立逐行正则，去重逻辑 `-N` 后缀在 TOC 侧独有）、useMarkdown.ts:67-75 + :328-343（slugify 独立 + headings.push，无去重）、useCsvParser.ts:5-14（`:7` 全量 parse 在 `:12` slice 前，parseRows 无 maxRows 参数）、TableView.vue:23-39（.th-sort-btn/.th-filter 无 v-if）与 :44-56（截断分支遍历 parsed.rows）、HtmlViewer.vue:78-96（contentSize=content.length；SIZE_WARN=512KB/SIZE_BLOCK=2MB）、html_render_service.py:17-19 + :72（_MAX_INJECT_IDS=50 静默 break；_BINARY_SIZE_LIMIT=768KB 单文件）、files.py:35-51（RENDER_CSP connect-src https:）、entry_service.py:1423-1429（get_entry_files 无 order_by）、router.ts:57-63（/:slug/f meta.zen=locked）、useZenMode.ts（locked 时 keydown 直接 return）、EntryCard.vue:150-156 / EntryListRow.vue:153-159（无条件 files[0].id → ?firstFileId=）
- R12 ✅ 读 roadmap #57/#58（产物：57=is_primary+schema 迁移待排期；58=`/f` 无法指定文件，方案含"修清 query 坑"+"不给切文件 UI"）→ 本任务 V-01/决策 7 正是 57-A 轻量策略 + 58 的前两件，**59 项以外无重复立项**
- S1 ✅ 同类扫描（grep 工具 + grep 命令双通道，8 组符号）：
  - `extractHeadings` 命中 4 处（定义 1 + 消费 2 + 测试 mock 2；无第二消费方）
  - `slugify` 命中 2 处（useMarkdown.ts:67 定义 / :337 唯一调用；e2e 里的是另一字符串 `_slugify` 与本题无关）
  - `headings.push` 命中 2 处（useMarkdown.ts:339 正文侧 / useEntryDetailComputed.ts:69 TOC 侧）→ 双实现确认
  - `files[0]` 前端 src 命中 6 处有效（entryDetail.ts:51-52 双兜底 / EntryCard.vue:150 / EntryListRow.vue:153 / 测试 3 处）；后端 `select(File)` 命中 11 处且全部无 order_by；MCP getEntry.ts:88 一处
  - `query: {}` / `router.replace` 命中：EntryDetailView.vue:238（一锅端，唯一）；SettingsView.vue:92 与 StarManageView.vue:228 是**部分 query 合并**（非一锅端，不属同类）
  - `content.length` 类字节/字符混用命中 3 处：HtmlViewer.vue:94（V-08 本体）、TreeView.vue:75（同型，MAX_SIZE=2MB）、useCsvParser.ts:23（扫描游标，非大小判断）
  - `_MAX_INJECT_IDS` 命中 2（定义 :17 + 判据 :72）；`768 * 1024` 命中 2 处重复常量（html_render_service.py:18 与 files.py:48）
  - `firstFileId` 全仓命中 15 处（前端 5 + e2e 8 + 文档 5，含 roadmap #57/#58）
- S2 ✅ 附加实测：debug backend :8888 = 200（在线）、生产 :8080 = 000（零接触，[PROD_NOT_TOUCHED]）；`/api/v1/entries/k8s-deployment` 返回 files 顺序 README.md(id13) → deployment.yaml → service.yaml，**当前恰好 README 在前**（seed 数据按 sorted() 上传），说明"偶然正确"不构成契约；列表接口 `EntryListItem` **无 files 字段**，`transformListItem` 恒 `files: []` → EntryCard/EntryListRow 的 `files?.[0]?.id` **实际恒为 undefined**（现网卡片从未真传过 firstFileId，与 roadmap #57 描述有出入，需记入 P1）
- R13 ✅ 读完 P1-dispatch-context-analyst-supplement.md（100 行，与主 dispatch-context 同等强制力，冲突以本文件为准）——两项用户决策（A: `/f` 只读分享态不加退出按钮；B: Setext h1 生成 id 并纳入 TOC，层级扩为 h1-h4）、E-1~E-7 七组实测证据、剩余待定项由 4 收敛为 2
- 影响：① 需新增一条 BDD「`/f` 不引入退出按钮」；② Setext 相关 BDD 改为「正文 + TOC 双侧都正确」，且 TOC 层级扩 h1-h4 需一条 BDD；③ 卡片/列表 files[0] 相关 BDD 必须改为代码级断言（浏览器点卡片验证会假 PASS）；④ TOC 相关 BDD 的 When 必须写"点开 TOC 后"（`.toc-sidebar` 默认不渲染）；⑤ 全屏无文件树是**新增需求**不是回归守护（E-2）
- [17:44] 收到主 Agent 追加消息（三条新证据 + 决策 A 更正为「既有设计意图确认」）：① e2e 连带面 3 spec/8 处 → 写成回归等价性 BDD；② `useCsvParser.ts:57-59` 扫完才 throw 与「到上限即停」冲突 → 写成回归 BDD（超限+未闭合仍 throw）；③ V-06/V-07 零测试覆盖、插入点唯一 `api/files.py:330-343`。
- 状态：未卡住，正在做最后 3 项可行性核实（1MB inline 上限是否阻碍 2MB HTML 造件 / unicode README 是否含文件链接 / python-entry-service 内容用于跨 entry 断言），随后落盘 P1-requirements.md。
- [17:46] 追加证据 4/5 已收：④ `>= 2MB` 边界已有既有用例（HtmlViewer.spec.ts:354-365「恰好 2MB 不自动渲染」+ :338-350「恰好 512KB 警告仍渲染」）→ 左闭右开为既有契约，P1 写成回归项，取消待定项；且这些用例全用 TEST_SIZE_KEY 注入 → 必须新增一条走真实 file.size 的断言。⑤ `TreeView.vue:73-75` 同型缺陷（同 2MB、同 content.length 范式，作用于 JSON/YAML 树视图）→ V-08 修复面为两处共用同一字节数工具，TreeView props 需增 size。
- [17:58] ✅ 落盘 P1-requirements.md（689 行 / 55 条 BDD）。两项用户决策已体现：决策 A → BDD-31（约束型，`/f` 不引入退出入口，引 DESIGN.md:210-212 为既有设计意图）；决策 B → BDD-03（Setext 正文+TOC 双侧有 id）+ BDD-04（TOC 层级 h1-h4 且排除 h5）。
- [17:58] ✅ 主 Agent 新证据已纳入：E-4 死代码 → BDD-48 改代码级断言；`>=2MB` 左闭右开 → 取消待定项、改回归 BDD-44 + 反假 PASS 的 BDD-42/43/45；`TreeView` 同型 → BDD-45 + SUGGEST-3；V-03 throw 契约 → 回归 BDD-37；e2e 3 spec 迁移 → BDD-51；`/f` 无文件树 → BDD-30 按新增需求写。
- [17:58] ✅ 自检：BDD 55 条编号连续 1..55、每条 Given/When/Then 齐全、UX 类别 23 条（交互行为 16 / 视觉呈现 4 / 布局结构 3）、无禁用主观词（仅引用 P0 原文处的说明性提及）。
- [17:58] ✅ 机械验证（临时 probe 目录模拟 review 已 approved 的情形，事后删除 probe）：`check-gate.py P1` → **exit 2 通过**（仅 SUGGEST WARNING，无 NEED_CONFIRM 阻塞）；`check-pruning.py` → **exit 0**（phases ∪ pruned == P1..P8，0 mismatch）；`_gate_p1_vision_capability` → True；`_gate_p1_ui_shape` → True。
- [17:58] ✅ 环境状态：[PROD_NOT_TOUCHED] 生产 :8080 全程 000 不可达；debug :8888 在线（探活 200）；未触碰 ~/.peekview/；临时产物仅 .agate-tmp/（已清理 probe）。
- [19:20] ▶ r2 启动：已读 analyst.md + r2 dispatch-context + supplement + P1-review.md（11 BLOCKER/14 WARNING 全文）+ P1-requirements.md（689 行/55 BDD）。计划：先核 review 给出的关键源码行号（预计 2-3min），再逐 BLOCKER 组修订并逐条追加 progress。
- [19:34] ✅ 源码复核（无 bash 卡死，~3min）：确认 ①全局 zen 隐藏集在 `styles/layout.css:650-657`（含 .file-sidebar/.toc-sidebar），scoped 在 `EntryDetailView.vue:281-284`（4 项），两处不同；②`.file-sidebar`/`.toc-sidebar` 的 `v-if`（`EntryDetailContent.vue:4,78`）在多文件/多标题下为 true → /f 下 DOM 确实存在（display:none）；③`_BINARY_SIZE_LIMIT`（html_render_service.py:18）零消费、files.py:48/272 在二进制 serving 路径；④firstFileId 三 spec = 2/4/3 = 9，src+e2e+backend+packages+docs 共 27 行/8 文件（含 test-results 产物则 88 行）。B8 按主 Agent 追加指令：分支经 `create_app(config=PeekLimits(max_entry_files=60))` 可真实 HTTP 触发（配置可达，非死代码）。
- [19:40] ▶ 决策定稿（将在 §3/§11 落盘）：B8 选 **(a) 令超限分支可达**——P1 只定「预算上限 < max_entry_files − 1」这一可代码级断言的关系（现状 50==50 → FAIL），数值仍由 P2 冻结；理由：(b) 会让 V-07 的「超限显式告知」需求整条失去可验形态，而 (a) 保住原意图且可用 `create_app(config=PeekConfig(limits=PeekLimits(max_entry_files=N)))` 真实 HTTP 触发。B1 选 **(a)**：判据改「/f 下 .file-sidebar/.toc-sidebar DOM 不存在」（现状 DOM 存在+CSS 隐藏 → FAIL）。编号收敛：合并 old BDD-06→01、old BDD-24→20、old BDD-42+43→新 42，新增「普通态 f 键不改 URL」「文件树逐文件无全屏按钮」两条 → 总数 55→**54**，编号全局重排（§11 落映射表）。
- [19:52] ✅ §3 BDD 区整体重写并落盘（54 条，编号 01..54 连续校验通过）：B1→新 BDD-28/53；B2→全文统一幂等 When 表述；B3→BDD-08/12/13 换素材；B4→BDD-16/17/18 成对对照；B5→并入 BDD-19；B6→BDD-36 改回归；B7→BDD-05 增可见文本断言；B8→BDD-38 写造件路径+关系断言；B9→BDD-39 声明新增需求；B10→BDD-50 回归等价性；B11→BDD-40 合取断言。W1→BDD-23/24 排除 title；W2→42/43 合并为 42；W3→06 并入 01；W4→BDD-02 删后半；W5/W6/W6'→BDD-33/06/27 加「回归兼容：」；W9→新增 BDD-30；W11→新增 BDD-31；W13→BDD-35 去签名。下一步：修正文 §1/§2.2/§4/§5/§6.5/§6.6/§9/§11（预计 5min）。
- [20:05] ✅ 正文交叉引用同步 + B9/W8/W10 落盘：§6.5 重写（`_BINARY_SIZE_LIMIT` 更正为死常量/零消费/注入路径无单文件上限 → 本任务新增，`files.py:272` 属二进制 serving 路径）；§6.6 重写（口径 A=27 行/8 文件、口径 B=88 行含 Playwright 产物、旧 15/5 作废；三 spec=2+4+3=**9**，明文作废「共 8 处」）；§9 TOC 行改幂等表述；§5 P6/P8、§8、§10 编号与文案同步。下一步：§4 补 W9 结论行 + §11 变更记录（预计 3min）。
- [20:15] ✅ §4 新增 W9 结论行（普通态 f 不改 URL）+ §11 变更记录追加第 2 版条目（含 11 BLOCKER 处置表、B8 二选一理由、14 WARNING 处置、编号重排映射、54 条区分力自检表 42F/12P、新增/删除/合并汇总）。下一步：跑 check-gate/check-pruning 机械验证 + frontmatter 校验（预计 2min）。
- [20:24] ✅ 机械验证：`check-pruning.py TASK_DIR` → exit 0（RECONCILE 0 mismatches）；`check-gate.py P1` → exit 1 但唯一原因是 **P1-review.md status 仍为 needs-revision**（复审前必为红，符合预期）；在 .agate-tmp probe 目录内用 approved 副本复跑 → **exit 2 通过**（仅 3 个 SUGGEST WARNING，非阻塞），probe 已删。frontmatter 原值未改。下一步：最终全文一致性自检（编号连续/GWT 齐全/交叉引用无越界）。
- [20:30] 要跑：用 debug :8888 HTTP API 现造一个「UTF-8 字节 ≥2MB 且 content.length <2MB」的中文 HTML 探针 entry，验证 BDD-42 的 Given 素材可造（预期 <60s）；造完立即 DELETE。
- [20:36] ✅ BDD-42 的 Given 素材实测可造（造件路径验证）：中文 HTML `chars=700084 / bytes=2100088`（`content.length` <2MB ∧ 字节 ≥2MB）经 debug `POST /api/v1/entries` 201 成功、返回 `size=2100088` → 与断言一致。两个探针（slug `dbpztc` 字节不足的失败样本、`c3wwy9` 成功样本）已 **DELETE 清理**（均 200）。debug 现存 15 条匿名可见 entry（seed 原样，无残留）。[PROD_NOT_TOUCHED] 全程只碰 :8888。
- [20:44] ✅ 收尾补强：§1 增 V-07 事实口径注（休眠代码 → 本任务让它生效，与 BDD-38 关系断言呼应，修正表格排版）；BDD-38 Given 改写为可直接执行的造件路径（1 主 + N sibling，覆写 max_entry_files=N+1，并说明默认 50 会 413）+ ④ 关系断言明确读源码常量而非测试配置；BDD-42 Given 附实测数值 chars=700084/bytes=2100088；§3.2 判定基线去掉「除 BDD-12 外」的旧例外。下一步：最终 gate 复跑 + 全文复核（预计 2min）。
- [20:52] ✅ 最终自检全绿：54 条编号连续、无重复、GWT 各 1；交叉引用无越界（1..54）；无禁用主观词；11 BLOCKER 关键证据 11/11 命中、14 WARNING 关键证据 14/14 命中；未动项核对通过（risk_level/ceremony/packages/domains 原值、P0_STALE 3 条、NO_NEED_CONFIRM、status: draft）。gate 复跑 exit 2、check-pruning exit 0。BDD-53 的隐藏机制归属已按源码更正（meta-tags-bar 走 scoped CSS 而非 v-show）。
- [21:20] ▶ r3 启动：已读 r3 dispatch-context（343 行）+ analyst.md + P1-review.md 的 2 BLOCKER + 6 WARNING 全文 + P1-requirements.md 相关位置（§3 开头幂等表述/BDD-05/BDD-31/BDD-35/BDD-50/BDD-53/§10/L95/L541/L648/L649）。源码复核（read）：`useMarkdown.ts:480` 确认 `html: ''` 常量空串、`:414` `blocks.push({type:'html'})`；`useCsvParser.ts:7` 全量 `parseRows` 在 `:12` slice 之前、`:12 rows = dataRows.slice(0, maxRows)`、返回值仅 `{headers, rows, totalRows, truncated}`；`EntryDetailMobileBar.vue:14-16` mobile TOC 按钮**无 aria-expanded**；`DiagramBlock.vue:177` 有 `title="Fullscreen"`。计划：只改 8 处（2 BLOCKER + 6 WARNING）+ §11 追加第 3 轮条目，预计 20min。
- [21:21] 要跑：① 用 tsx 跑现状 `parseCsv`（1000 数据行 + maxRows=5）自检 B-NEW-2 的观测面——预期 <30s，验证 `rows.length==5`（假 PASS 面）且「构造行数」观测值现状为 `undefined`（有区分力面）；② 探活 debug :8888（预期 <3s）。两条并行、均带 timeout。
- [21:26] ✅ B-NEW-2 现状自检（tsx 跑仓库 `parseCsv`，1000 数据行 + maxRows=5）：返回字段仅 `headers,rows,totalRows,truncated`；`rows.length=5`（≤5 成立 ← 假 PASS 面）、`totalRows=1001`、`truncated=true`；`res.constructedRows/parsedRows/rowsParsed/parsedCount/stats/constructedCount` 全部 **undefined** → 「构造了多少行」观测面**现状不存在**，可作为收窄后的判据（有区分力）。
- [21:26] ✅ B-NEW-1 自检（现造 entry `95c9ny`/id24，`path+filename` 都给 → `language=markdown`）：桌面 1280×800 下 `.toc-btn[aria-label="Table of Contents"]` 的 `aria-expanded="true"`；`.toc-list a` 两条文本 `["**粗体**与[链接](other.md)","第二节"]`；`.markdown-body h2` = `[{id:"粗体与链接othermd",text:"粗体与链接"},{id:"第二节",text:"第二节"}]` → 推荐判据（TOC 可见文本不含 `**`/`[`/`](` 且去空白后与 h2.textContent 逐字相等）**现状 FAIL、可执行、有区分力** ✓。移动端 390×844 复核：命中 `[data-testid="mobile-bar-toc-btn"]`、`aria-expanded` **为 null**、`.toc-sidebar` `display:none` 且 `rect.width=0` → W-新 2 的 null 分支成立。探针 entry 已 **DELETE**（`DELETE /api/v1/entries/95c9ny` 200；`GET` 转 404；anon total 恢复 15）。[PROD_NOT_TOUCHED] 全程只碰 :8888。
- [21:28] 要跑：原地修订 8 处（write/edit 工具，无 bash 长任务）；顺序 = B-NEW-1(BDD-05) → B-NEW-2(BDD-35) → W-新1(§10) → W-新2(§3 头 + 6 条 Given) → W-新3(BDD-31) → W-新4(BDD-53) → W-新5(4 处改号) → W-新6(BDD-50) → §11 第 3 轮条目。预计 10min。
- [21:30] ✅ 修完 B-NEW-1（BDD-05）：When 由「vitest 层消费 `render()` 的 `headings` 与 `html`」改为「**Playwright 层真实 DOM**（桌面 1280×800 + 幂等展开态）」并明写「`render().html` 是常量空串、不可用，真实 HTML 在 `blocks[]`」；Given 补「`path` 与 `filename` 同时给，否则 `language=null` → `.toc-list` 为空」（B-NEW-1 附带前提）；断言①②语义不变。
- [21:33] ✅ 修完 B-NEW-2（BDD-35）：删去「既有返回值结构中的字段」这一假 PASS 观测面，When 改为「以本次改动**新增暴露**的『实际构造的数据行数』观测面」；Then 加 ① 上界 ≤ maxRows ② 3 行正向对照 == 3；新增「观测面定义」三条硬约束——① **不得**用 `rows.length`（现状 slice 已保证上界，实测 5）② 必须能区分「构造 1000 行再截 5 行」vs「只构造 5 行」（可用形态在正文列出，不写死签名）③ 现状该类字段实测全 `undefined`（改动前不存在）。未重新引入 W13（仍不指定函数签名）。
- [21:36] ✅ 修完 W-新 1（§10）：新增「V-03 依赖『构造行数观测面』先行」行（说明现状无该字段、缺它则 BDD-35 判 FAIL、不得回退用 `rows.length`）；原有 V-01 行完整保留（编辑时曾误覆盖，已回补并复核 §10 六行齐全）。
- [21:38] ✅ 修完 W-新 2（§3 幂等表述 + 6 条 BDD）：① §3 开头的 TOC 幂等表述补**第三分支** `null`（该视口不适用 → 改用桌面 1280×800 重跑），并加「`aria-expanded === null` 分支的实测依据」段（移动端命中 `mobile-bar-toc-btn` 无该属性、走 `showTocDrawer` 非 `.toc-sidebar` 的 v-if 链、实测 `display:none`/`rect.width=0`）；② BDD-01/02/03/04/06/52 的 Given 全部追加「**桌面视口 1280×800**」。
- [21:40] ✅ 修完 W-新 3（BDD-31）：断言② 名称口径补「**同样不含 `title` 属性**」（与 ① 及 BDD-23/24 统一，只取 `aria-label` + 可见文本）；Given 补「**正文不含图表块**」；说明段补 `DiagramBlock.vue:177` 的 `title="Fullscreen"` 为何不计入、及正文含图表会→计数 2→假 FAIL 的机理。
- [21:42] ✅ 修完 W-新 4（BDD-53 断言①）：把 `.meta-tags-bar` 从「四项 DOM 保留、仅样式隐藏」并列中**拆出**，注明「实测 DOM 计数 == 0、**非 `v-show`**」；`.detail-header` 等三项保留「DOM 1 / 可视 0（真 `v-show`）」表述。**判据（可视计数 == 0）不变**。
- [21:45] ✅ 修完 W-新 5（4 处交叉引用改号，改前逐处按语境核对）：① L95「写成回归 BDD-44」→ **BDD-43**（语境 = `>= 2MB` 左闭右开边界，BDD-43 正是该回归条）② L658（P0_STALE 第 3 条）「改写为回归 BDD-44」→ **BDD-43**（同语境）③ L550「补 `order_by`（BDD-14）」→ **BDD-13**（`order_by`/确定性排序 = BDD-13；BDD-14 是 `?file=` 深链）④ L657（P0_STALE 第 2 条）「代码级断言（BDD-48）」→ **BDD-47**（卡片/列表代码级断言 = BDD-47；BDD-48 是单文件 entry 回归）。核对了 4 个目标条目的实际标题语境，全部对应正确。
- [21:47] ✅ 修完 W-新 6（BDD-50）：Then ② 后补前提段——「P5 已按本节 Given 的基线数字产出 `known-failures.md`（**逐 case**）；**缺失该文件时本条判 FAIL 而非 PASS**」，并说明「无法对照 ≠ 没有 new failure」。
- [21:52] ✅ B-NEW-2 判据区分力**实测证明**（tsx 双实现对照：`gen-current.ts`=现状原样埋点、`gen-fixed.ts`=模拟 P4「到上限不 push 行数组但状态机扫完全文」埋点）：
  - `rows.length`：现状 5 / 修后 5 → **不可区分**（证实是假 PASS 面，与评审一致）
  - 「实际构造的数据行数」（行数组 push 次数 − 表头）：现状 **1000** / 修后 **5** → 断言① ≤5 在现状 **FAIL ✓ 有区分力**、修后 PASS ✓
  - 正向对照（3 数据行）：现状 3 / 修后 3 → 均 ==3，排除「恒返回 0」✓
  - **额外发现（已写入 BDD-35 说明）**：朴素「到上限就不 push」的实现会把 `totalRows` 从 1001 砍到 6 → BDD-36 变红。非判据冲突，而是联合约束「**计数与构造解耦**」，已明文写入本文件避免 P4 只满足一条踩坏另一条。
- [21:56] ✅ B-NEW-1 字面自检（**按新 When 逐字执行**，现造 entry `alqydw`/id24，`path+filename` 均给 → `language=markdown`）：
  - 先在**移动视口 390×844** 起步（刻意）→ 读得 `[data-testid="mobile-bar-toc-btn"]` 的 `aria-expanded === null` → **走第三分支**「该视口不适用本条，改用桌面 1280×800 重跑」✓（证明 W-新 2 的 null 分支按字面可用）
  - 改桌面 1280×800 重跑：`aria-expanded === "false"` → 点击一次 → `.toc-sidebar`/`.toc-list` 均出现（各 1）→ 命中目标 `<h2>` 与 TOC 条目
  - **Then① = PASS**（`h2.id = 粗体与链接othermd` == href 去 `#`，非空、无空格）；**Then② = FAIL**（TOC 可见文本 `**粗体**与[链接](other.md)` 含 `**`/`[`/`](`/`)`，与 `h2.textContent="粗体与链接"` 去空白后不相等）→ **整条现状 FAIL ✓，判据可执行且有区分力**
  - 探针已 **DELETE**（`DELETE /api/v1/entries/alqydw` 200 → GET 404），anon total 恢复 **15**。[PROD_NOT_TOUCHED]
- [22:00] ✅ §11 追加第 3 版条目（2 BLOCKER 处置表 / 6 WARNING 逐条 / 新增的 BDD-35↔36 联合约束 / 本轮自检实测结果 / 总数保持 54 未改号）；区分力自检表同步更新 BDD-05 与 BDD-35 两行（补实测数值）。
- [22:02] ✅ frontmatter：`agate-md-field-set.py`（`FILE=... set status draft`）→ `OK: status=draft`；`status` 保持 `draft`。受保护字段逐项复核**均未变**：`risk_level: medium`、`ceremony: standard`、`packages: [peekview, frontend-v3, docs]`、`domains: [frontend, backend]`、`ui_render_shape: layout`、`ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]`、`phases` P1-P8 全列。未动内容抽检保留：`[NO_NEED_CONFIRM]`、`[P0_STALE: ...]` 三条、决策 A/B 表述、同类扫描 9 组、裁剪说明、§11 的 12 条回归守护标签。
- [22:05] ✅ 机械验证：`check-pruning.py .` → **exit 0**（0 mismatches）；`check-gate.py P1 .` → **exit 1**，唯一原因 `P1-review.md` 仍 `needs-revision`（复审前必为红，符合预期）；在 .agate-tmp probe 目录用 approved 副本 + .state.yaml 复跑 → **exit 2 通过**（3 条 SUGGEST WARNING 不阻塞），probe 已删。
- [22:06] ✅ 最终自检：BDD 总数 **54**、编号 **01–54 连续**、交叉引用无越界（1–54）、54 条 GWT 齐全；4 处改号核对 BDD-43/13/47 引用数 8/7/9 均为目标条目。**P1-review.md 全程未改**（mtime 仍 21:03:44 / 43783B，与我启动前一致）。临时文件仅留 .agate-tmp/r3 的 tsx 探针脚本（诊断留痕，未落仓库）。
- [22:06] ✅ 环境：[PROD_NOT_TOUCHED] 生产 :8080 全程未访问；debug :8888 仅用 HTTP API；两个探针 entry（id24 两轮）均已 DELETE，anon total 恢复 **15**（= seed 基线）；未触碰 `~/.peekview/`；未 commit。
