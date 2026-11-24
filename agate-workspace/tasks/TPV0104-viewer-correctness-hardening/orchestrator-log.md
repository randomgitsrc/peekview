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
