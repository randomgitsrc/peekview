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
