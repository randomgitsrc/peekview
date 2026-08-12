## P3 test-designer 进度

- 已读取: test-designer.md 角色定义, P3-dispatch-context-test-designer.md, P0-brief.md, P1-requirements.md(12条BDD), P2-design.md(6候选方案+data-testid清单)
- 已读取参照: frontend-v3/e2e/t084-scroll-architecture.spec.ts (viewport断点/滚动断言模式), EntryDetailMobileBar.vue(现有按钮结构,均无data-testid/position:fixed), EntryDetailHeader.vue(现有meta-tags-bar在header内,v-show+hidden class), EntryDetailContent.vue(content-area当前无data-testid), MarkdownViewer.vue(markdown-body移动端margin/padding非零)
- 确认: useResponsiveLayout.spec.ts + useResponsiveLayout.boundary.spec.ts 两个现有文件完整覆盖的是即将被删除的setupScrollHide/metaTagsHidden(T084/T085遗留测试),不覆盖保留导出isMobile/isDesktop/handleResize；后者已被T079/t067/t031等组件级测试间接覆盖，不新增单测（符合dispatch指引"不需要新增关于已删除功能的单元测试"）
- 确认 OverflowMenu.vue 已有 data-testid="overflow-menu-trigger"，复用不新增
- 确定 12 条 BDD 均设计为 Playwright E2E（ui_affected: true），选择器策略：P2清单内元素强制用data-testid；清单外但需要断言的中间态（抽屉打开/toast/菜单展开）改用role/aria-*/text匹配而非class选择器，避免违反"不用class名选择器"硬约束
- 设计测试数据：t090-long-markdown(单文件长markdown) / t090-long-code(单文件长python) / t090-md-multifile(2个markdown文件,含标题) / t090-py-multifile(2个python文件,非markdown非html)
- 开始写测试代码 frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts
- 测试代码已写完: frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts (12个test, 覆盖12条BDD, 3种viewport: 390x844/375x812/1280x800, 4个测试entry)
- tsc --noEmit 语法检查通过(无编译错误)
- P3-test-cases.md 已写完(含BDD映射表+测试数据说明+关键设计说明)
- 已启动 make debug-quick(:8888), 正在后台跑 playwright test 确认红灯类型(等待结果中)
- 实跑发现1: beforeAll 用了后端不存在的顶层 content 字段创建单文件entry(CreateEntryRequest无该字段,仅files数组),导致entry变成files:[]空态,已修正为 files:[{filename,content}] 正确格式
- 实跑发现2(关键): test_bdd_12 首次实跑为假绿——纯负向断言(toHaveCount(0))在data-testid尚未实现时(移动端也是0)恒真通过,不是有效红灯。已修正:先在移动端断言toBeVisible()正向前置,再切桌面端断言toHaveCount(0),使其在实现前必然因移动端正向断言失败而红
- 最终确认: 12/12 全部真红灯,均为B类(data-testid/content-area未找到导致的定位超时,BDD-7页面快照确认按钮本体已存在仅缺testid),无A类语法/编译错误
- P3-test-cases.md 已补全自检结果表格
- 任务完成,返回路径给主Agent
