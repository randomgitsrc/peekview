# P4 Progress — implementer（子任务 A：viewer.spec.ts 修复）

## 输入读取
- [x] P4-dispatch-context-implementer-a.md（修复清单 S1~S12 + D1~D4）
- [x] implementer.md 角色定义
- [x] P0-brief.md（20 用例审计 → P1 修正为 19）
- [x] P1-requirements.md（IMPL-S1~S12、IMPL-D1~D4、BDD-1~5）
- [x] P2-design.md（§2.1.1~2.1.5 方案、files_to_read）
- [x] P3-test-cases.md（19 用例修复清单）

## 待读
- [ ] viewer.spec.ts（被修文件）
- [ ] seed-data meta.json（slug 核实）
- [ ] Vue 组件片段（选择器核实）

---
# P4 Progress — implementer（子任务 B：Check 6 mtime 校验）

## 输入读取
- [x] P4-dispatch-context-implementer-b.md（实现规格 §Check 6 + --test-mtime + Makefile env）
- [x] implementer.md 角色定义
- [x] P0-brief.md（子任务 B：static 新鲜度校验，Makefile:553-563 只查存在不查新鲜）
- [x] P1-requirements.md（IMPL-B1~B3、IMPL-C1、BDD-6/7/8）
- [x] P2-design.md（§2.2 方案、files_to_read、gate_commands.P3、minimal_validation）
- [x] P3-test-cases.md（TC-B1~B7 断言：新鲜0/过期1/缺失1 + 输出字符串）
- [x] P3-test-code/test-mtime.sh（harness 断言：FATAL/不存在/过期文件/静态产物新鲜/make build-frontend）
- [x] scripts/e2e-safety-check.sh（被修文件，Check 1-5 现状）
- [x] Makefile:633-640（debug-test Step 1，现状仅 E2E_GUARD_ENABLED/NONINTERACTIVE）

## 关键发现
- 派发指引的 Check 6 代码片段用 "✗ Check 6 FAIL: 静态产物缺失"，但 P3 harness 断言 grep "FATAL" 与 "不存在"（TC-B2/B3）——派发片段无法让红灯变绿。采用 P2-design §2.2.1 approved 文本（FATAL + 不存在 + 过期文件），两态可测。

## 实现与自查
- [x] 修改 scripts/e2e-safety-check.sh：函数定义（Check 1 前）+ --test-mtime 自检块 + Check 6 调用（Check 5 后）
- [x] 修改 Makefile debug-test Step 1：传 PV_SRC_DIR/PV_STATIC_INDEX 绝对路径
- [x] 自查：`bash scripts/e2e-safety-check.sh --test-mtime` → exit 0（真实仓库 fresh）
- [x] 自查：P3 harness（test-mtime.sh）→ PASS=6 FAIL=0（TC-B1/B2/B3/B4/B6/B7 全绿）
- [x] bash -n syntax OK；make -n debug-test 渲染 $(CURDIR) 绝对路径
- [x] 产出 P4-implementation-b.md（含 [PROD_NOT_TOUCHED]）

## 选择器/数据核实（全部已对照当前源码）
- [x] EntryDetailMobileBar.vue:2 `mobile-bottom-bar` / :7 `mobile-bar-filetree-btn` / :15 `mobile-bar-toc-btn` / :35 `mobile-bar-wrap-btn` 均在
- [x] EntryDetailHeader.vue:36 `[aria-label="Copy"]` 桌面 header 唯一
- [x] TreeNodeItem.vue:23 `.file-item .file-name`
- [x] ThemeToggle.vue:4 `.theme-toggle`；EntryDetailView header 内 `.detail-header .theme-toggle`（EntryDetailHeader.vue:49）
- [x] TocNav.vue:10 `href="#id"` + `@click.prevent`（scrollIntoView）；`:activeId="null"`（无 scroll-spy）
- [x] EntryDetailContent.vue:23 `[data-testid="content-area"]` + :227 `overflow-y: auto`（scoped 覆盖 layout.css）
- [x] DiagramBlock.vue:187 `.diagram-viewer`；MermaidRenderer 渲染 `.diagram-svg-container svg`，无 `.mermaid` 类
- [x] OverflowMenu.vue:9 `overflow-menu-trigger`；useEntryDetailActions.ts:83 `Download`（hint=activeFile.filename）/ :102 `Download as Pack`
- [x] CodeViewer.vue:16 `wrap-enabled` class；canWrap 对 python 为 true
- [x] router.ts:8/13/38 `/` `/explore` `/:slug`（history 模式，createWebHistory）
- [x] EntryListView.vue:129-139 `.entry-card`（grid 视图，loadViewMode 默认 grid）在 `/explore` 渲染
- [x] seed-data：json-api-config（1 内容文件 config.json，public/bob）、python-entry-service（entry_service.py+requirements.txt，public/alice）、markdown-test（rich-markdown.md+architecture.svg，public/alice）、mermaid-charts（3 mermaid md，public/alice）
- [x] EntryDetailView.vue:212-213 多文件/有 TOC 时桌面默认开 file-sidebar/toc-sidebar

## 关键决策
- TC-012 改点 `.toc-item a` **last()** 而非 first()：rich-markdown.md 首个 toc 项是文档顶部 h1，click first 后 scrollTop 可能恒 0；last() 保证在折叠线以下，scrollTop>0 确定性成立
- TC-050 在 toHaveURL 之外追加 `.detail-header` visible 断言：`/\/([^/]+)$/` 会先匹配 `/explore`，单独用可能假绿；detail-header 可见才证明真正导航到 detail

## 自查（≠P5 gate）
- `npx tsc --noEmit --skipLibCheck --target ES2020 --module esnext --moduleResolution bundler e2e/viewer.spec.ts` → exit 0
- grep 确认无 `/#/entry/`、`lu4prg`、`ngajri`、`.code-header`、`.mobile-actions`、`.menu-btn`、`.toc-btn`、`.list-header`、`.btn-icon`、`has-text` 残留（grep-exit=1 无匹配）
- `grep -c "test("` = 19（用例数不变，未删用例）
- 未改 Makefile/e2e-safety-check.sh（git status 中这两处改动来自子任务 B，非本子任务）
- E2E 实跑需 debug backend :8888 → 留给 P5/P6
## P4 retry1 进度（implementer 追加）
- 已读 dispatch-context / P5 e2e.md / viewer.spec.ts / 相关 Vue 组件
- 根因确认：与 P5 判定一致。关键发现：
  - markdown-test files: architecture.svg(id=17), rich-markdown.md(id=18)，files[0]=svg
  - python-entry-service files: entry_service.py, requirements.txt（2 元素）
  - EntryDetailView.vue:203 支持 ?firstFileId= query（t091 已验证模式，MARKDOWN_FILE_ID=18）
  - EntryDetailContent.vue:245-248：drawer z-index 201 > overlay 200，drawer-left 宽 280px，overlay 中心点击(x≈187)落在 drawer 内被拦截
  - EntryDetailHeader.vue:13 isDesktop 才渲染 .detail-header；mobile-sticky-header 无 theme-toggle
  - EntryCard.vue:22 仅 .card-title anchor 有 navigateToEntry
  - waitForShiki 超时 5000ms 首轮不足
- 第一轮修复完成（TC-005 filter、openMarkdownFile helper + ?firstFileId=、TC-011/012 桌面视口、TC-022 position 点击、TC-023 openMarkdownFile、TC-030/040/050 桌面视口、TC-050 点 .card-title、waitForShiki 15s）
- 第一轮 E2E：36 passed + 2 flaky（TC-010 双项目 flaky，heading 渲染 race）→ 已改 waitForSelector('.markdown-body h1') 与 '.toc-nav .toc-item'
- 第二轮修复（TC-010 waitForSelector '.markdown-body h1' + TC-011 '.toc-nav .toc-item'）后重跑：38 passed，0 failed，0 flaky
- vue-tsc exit 0
- 完成 P4-implementation.md
