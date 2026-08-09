## P2 重派 - architect (retry)
- 已读取角色定义 architect.md、P2-dispatch-context-architect.md、P0-brief.md、P1-requirements.md
- minimal_validation 数据已由主 Agent 提供（html-csp-test + svg-standalone 实测），无遮挡问题，采纳 follows_existing_pattern
- 下一步：读取源码文件 EntryMetaTagsBar.vue/MarkdownViewer.vue/EntryDetailMobileBar.vue/EntryDetailHeader.vue/ImageViewer.vue/HtmlViewer.vue/DESIGN.md/t090 E2E spec
- 已读 EntryMetaTagsBar.vue（L35 padding 8/12, overflow-x:auto）、MarkdownViewer.vue（L131-136 mobile 0/0）、EntryDetailMobileBar.vue（L83-158 bottom-btn/toggle-btn/padding bug 位置确认，L100-113 toggle-btn 已有 44x44）、EntryDetailHeader.vue（L36-38 Copy icon-btn 用法、L163-166 .icon-btn 定义）
- 下一步：读 ImageViewer.vue/HtmlViewer.vue 滚动架构、DESIGN.md 相关行、T090 E2E spec
- 已读 ImageViewer.vue(L156-161 height:100%;overflow:hidden)、HtmlViewer.vue(L189-194 同)、DESIGN.md(L104-278 相关章节全文)、EntryDetailContent.vue(L23-24 content-area挂载点, L227-231 mobile padding var(--space-3) var(--space-2)=12px 8px)
- 已读 t090-mobile-detail-ux-polish.spec.ts 关键测试：BDD-6(L240-283,数据testid点击,基本不受影响)、BDD-7(L285-303, 断言class toContain('primary') 会因Wrap改.toggle-btn而失败,需改为'active')、BDD-8(L305-326, reductionRatio>=0.75断言的前提被T091反转[8px->24px],需要改写而非沿用)
- 已核实 lucide-vue-next 存在 WrapText 具名导出(dist/cjs/lucide-vue-next.js:227)，isImage computed 对 svg mime 返回 true（useEntryDetailComputed.ts L29-35），confirmed svg-standalone 走 ImageViewer
- 决定：T090 spec 文件做外科手术式修改（BDD-7 class 断言、BDD-8 阈值改写为新目标值），同时新建 t091-mobile-detail-visual-polish.spec.ts 承载 13 条新 BDD，理由见设计文档
- 下一步：撰写 P2-design.md 全文
- P2-design.md 已产出完成，自检通过：candidate_count:1（唯一候选，follows_existing_pattern，正文与字段一致）、四字段齐全（packages/domains/ui_affected/gate_commands）、files_to_read 9 条、env_constraints、minimal_validation（采纳主 Agent 实测数据 + svg-standalone 作为 BDD-10 实测 entry 说明）、DESIGN.md 5 处精确修订前后对照、data-testid 保留声明表格、T090 spec 决定（两者都做：手术式改 BDD-7/8 + 新建 t091 spec，理由充分）
- 任务完成

## plan-design-review (2026-08-10)

- 读取 P2-design.md、P1-requirements.md、P0-brief.md、DESIGN.md、EntryDetailHeader.vue、EntryDetailMobileBar.vue、EntryMetaTagsBar.vue、MarkdownViewer.vue、useEntryDetailComputed.ts、t090 spec、run-e2e-tests.sh、playwright 源码（util.js/common/index.js）、lucide-vue-next 导出、seed-data 目录实测。
- 5 项重点检查逐一核实：#1（T090 E2E 冲突判断）通过；#2（E2E_SPEC 子串匹配）技术判断通过但脆弱性承认不足；#3（Copy tooltip）确认遗漏，并发现 Wrap 按钮 aria-label 缺失的真实可访问性回归；#4（svg-standalone 替代）通过，证据更扎实；#5（candidate_count=1）通过。
- 评分：交互状态覆盖率 8、AI Slop 风险 9、移动端考虑 9、可访问性 5、组件完整性 6。
- 产出 P2-review.md，status: needs-revision。建议 architect 补丁式修订 3 点（Wrap aria-label/aria-pressed、tooltip 去留显式声明、E2E_SPEC 脆弱性承认），不需要重新走候选方案评估。

## P2 修订 - architect (retry1, review needs-revision)
- 已读取 architect.md、P2-dispatch-context-architect-retry1.md、P2-review.md 全文、当前 P2-design.md 全文
- 已核实 EntryDetailMobileBar.vue L18-27 source-toggle 按钮既有 aria 写法：`:aria-label="sourceViewMode ? 'Show rendered view' : 'Show source code'"` + `:aria-pressed="sourceViewMode"`，作为 Wrap 按钮补丁的直接参照
- 修复点1完成：第1节 EntryDetailMobileBar.vue 改动行③补充 Wrap 按钮 `:aria-label`/`:aria-pressed`（对齐 source-toggle），并在第9节"实现完成的标志"新增一条可核验项
- 修复点2完成：第1节 Copy 按钮改动行②补充"不新增 `.tooltip` span"及理由（移动端无 hover 语义 + 组件内既有 toggle-btn 无 tooltip 的一致性）
- 修复点3完成：第5节 gate_commands 说明后补充一段，显式承认 `E2E_SPEC=e2e/t09` 子串匹配的未来脆弱性是本任务范围内有意识接受的技术债，非疏忽
- 自检：3 处修复点均已落笔；minimal_validation、DESIGN.md 3.1/3.3/3.4/3.5、T090 E2E 处理决定第4节、candidate_count=1 均未改动，原样保留
- 任务完成，覆写 P2-design.md（同一路径，status 保持 draft）

## plan-design-review 第2轮复核 (2026-08-10, revised)
- 读取 plan-design-review.md、P2-dispatch-context-plan-design-review-retry1.md、P2-design.md（修订版）、P2-review.md（上轮旧版）、EntryDetailMobileBar.vue（独立核实 source-toggle 现有 aria 写法 L21-24）
- 逐项复核 3 处上轮缺口：
  1. Wrap aria-label/aria-pressed：确认第1节改动行③、第9节完成标志均已补齐，写法（三元表达式+引号嵌套）与 source-toggle 实际代码逐字符对应，非表面像
  2. Copy tooltip 去留：确认第1节②已明确写"不新增 .tooltip span"+两条理由（无 hover 语义/组件内既有先例一致性），与 EntryDetailMobileBar.vue 现有三个 toggle-btn 均无 tooltip 的实测相符
  3. E2E_SPEC 脆弱性承认：确认第5节末尾新增段落已明确"有意识接受这个取舍"，给出具体触发场景+接受理由，不止步于"现在没问题"
- 3 处均判定真正修复，无表面应付
- 评分（复核后）：交互状态覆盖率8、AI Slop风险9、移动端考虑9、可访问性9（较上轮5分回升）、组件完整性9（较上轮6分回升）
- 覆写 P2-review.md，status: approved
- 任务完成
