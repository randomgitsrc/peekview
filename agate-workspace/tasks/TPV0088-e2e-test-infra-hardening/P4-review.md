---
phase: P4
task_id: TPV0088-e2e-test-infra-hardening
type: review
parent: P4-implementation.md
trace_id: TPV0088-P4-review-20260812
status: approved
created: 2026-08-12
agent: design-review
---

# P4 Review — e2e-test-infra-hardening

[PROD_NOT_TOUCHED] 纯代码评审：未启动任何服务，未触碰生产 :8080 / `~/.peekview/`；仅做了只读 grep/read/git diff 与一次基于 /tmp 临时 fixture 的 `--test-mtime` 自检（不读数据库）。

## 结论

**Status: approved**

实现与 P2-design.md 契约一致，两个子任务均无越界改动，断言为真实可测（未弱化、未删用例），两处 [DESIGN_GAP] 均为增强性修订且理由成立。附两条非阻塞 MINOR 观察供 P6 参考。

## 子任务 A：viewer.spec.ts（评审重点 1）

### 覆盖与残留（全过）

- **19 用例全覆盖**：`grep -c 'test('` = 19、`test.describe` = 6，与 P1 §1 基线（19 条）一致；git diff 显示 TC-005/TC-042 仅改名（"Code block header displays correctly"→"File tree shows filename and copy button"、"Download button exists"→"Download button downloads file"），**无用例被删**。
- **无残留**：`/#/entry/`、`lu4prg`、`ngajri` 均 grep = 0。
- **无死选择器残留**：`.code-header`/`.mobile-actions`/`.menu-btn`/`.toc-btn`/`.list-header`/`.btn-icon`/`has-text`/`a[download]`/`mermaidExists` 均无匹配（grep 命中的 `mobile-bar-toc-btn` 是活 data-testid，非 `.toc-btn`）。

### 关键断言真实性（S7/S8/S11，逐条核对源码）

- **S7 (TC-003，viewer.spec.ts:53-70)**：移动端视口 375×812 → `mobile-bar-wrap-btn` 点击（EntryDetailMobileBar.vue:35 `v-if="canWrap"` + `@click="$emit('toggle-wrap')"`）→ EntryDetailView.vue:74/96 `@toggle-wrap="entryDetailStore.toggleWrap()"` → CodeViewer.vue:16 `:class="{ 'wrap-enabled': wrap }"`。链路闭环，`.code-body` wrap-enabled 两态切换断言真实。`isMobile = width <= 640`（useResponsiveLayout.ts:19），375px 下移动条必然渲染。
- **S8 (TC-042，viewer.spec.ts:282-296)**：`overflow-menu-trigger` 存在（OverflowMenu.vue:9）；菜单项 label `Download`（useEntryDetailActions.ts:83）与 `Download as Pack`（:102）——`getByText('Download', { exact: true })` 精确匹配仅命中前者，避免 strict mode 双子串歧义；`waitForEvent('download')`（:290）先于 click（:291）注册，时序正确；`downloadFile` 动态 `<a download=activeFile.filename>`（useEntryDetailComputed.ts:88-97）⇒ `suggestedFilename()` 含 `entry_service.py` 断言成立。默认视口 1280×720 下 isMobile=false，仅桌面一个 OverflowMenu，无重复元素。
- **S11 (TC-012，viewer.spec.ts:127-139)**：滚动容器 `[data-testid="content-area"]`（EntryDetailContent.vue:23，:227 `overflow-y: auto`），外层 `.entry-detail` `height:100dvh; overflow:hidden`（layout.css）⇒ `window.scrollY` 恒 0，以 `.content-area` scrollTop 为锚正确。TocNav `@click.prevent` → `scrollIntoView({behavior:'smooth'})`（TocNav.vue:8-15），`expect.poll` 容忍 smooth 异步，last() 项在折叠线以下 ⇒ scrollTop>0 确定性成立。删除 `.toc-item.active` 辅助断言正确（EntryDetailContent.vue:77/107 `:activeId="null"`，无 scroll-spy，active 永不出现）。
- **S12 (TC-013，viewer.spec.ts:146)**：无条件断言 `.diagram-viewer svg`（DiagramBlock.vue:187 `.diagram-viewer` 内嵌 MermaidRenderer → renderers/MermaidRenderer.vue:2 `.diagram-svg-container` + :3 `v-html="svgContent"`）——已从"if (mermaidExists) 条件式假绿"改为无条件渲染断言。其余 S1~S6/S9/S10 均逐一核对当前 DOM（`.file-item .file-name` TreeNodeItem.vue:23、`[aria-label="Copy"]` EntryDetailHeader.vue:36、`.detail-header .theme-toggle` EntryDetailHeader.vue:13+49、landing `.theme-toggle` ThemeToggle.vue:4、`.entry-card` EntryCard.vue:2），全部命中。

### slug 映射数据支撑（BDD-4/5，全过）

`python-entry-service`（entry_service.py `def`×8，is_public/alice）、`markdown-test`（rich-markdown.md h1-h3×69 + architecture.svg，2 文件）、`mermaid-charts`（flowchart.md 含 ` ```mermaid `，is_public/alice）、`json-api-config`（仅 config.json 一个内容文件，is_public/bob）——均核实 seed-data 存在且 meta.json 配置匹配 P2 §2.1.2 映射表。TC-041（viewer.spec.ts:272-280）桌面 1280×800 断言 `.file-sidebar` count===0，isMultiFile=false 不渲染的前提成立。

### [DESIGN_GAP] 审查（评审重点 4）

- **GAP-1（TC-012 改点 last()）**：P3 清单仅写"点 .toc-item a"，未限定 first/last。last() 避免首个 toc 项（文档顶部 h1）scrollTop 恒 0 的抖动——修订增强确定性，合理。
- **GAP-2（TC-050 追加 `.detail-header` 可见断言）**：`toHaveURL(/\/([^/]+)$/)` 同时匹配 `/explore`，单独使用在导航未发生时即可假绿；追加 detail-header 可见（仅 detail 页渲染）证明真实进入。修订堵住假绿，合理。

两处 GAP 均在 P4-implementation.md 声明，均属于"增强断言真实性"而非弱化，可接受。

## 子任务 B：e2e-safety-check.sh + Makefile（评审重点 2）

- **Check 6 与 P2 §2.2.1 规格一致**：函数定义（e2e-safety-check.sh:11-29）置于 Check 1 之前，含 `[ ! -f "$static_index" ]` 先判缺失（:14，防 find -newer 对不存在文件静默放行）+ `find "$src_dir" -type f -newer "$static_index"`（:20，`-type f` 防目录 mtime 假阳性）+ 过期列出前 5 个 + 提示 `make build-frontend`；`--test-mtime` 自检块（:32-35）紧跟函数定义、在 Check 1 之前，绕过 E2E_GUARD。
- **Check 1-5 未破坏**：git diff 显示 e2e-safety-check.sh 仅纯新增（函数定义 + 自检块 + Check 6 调用），Check 1-5 逻辑零改动（IMPL-C1）；Check 6 调用（:123-125）位于 Check 5 之后、`=== ✓ 安全检查通过 ===`（:128）之前。
- **Makefile debug-test Step 1（Makefile:636-639）**：`PV_SRC_DIR=$(CURDIR)/frontend-v3/src` + `PV_STATIC_INDEX=$(CURDIR)/backend/peekview/static/index.html` 绝对路径 env 传递正确，E2E_GUARD_ENABLED/NONINTERACTIVE 保留。
- **--test-mtime 独立三态实测**（/tmp fixture + env 注入）：stale → exit 1 + 列过期文件 + 提示 build-frontend；static 缺失 → exit 1 + FATAL；fresh → exit 0 + `✓ 静态产物新鲜`。真实仓库当前状态 `--test-mtime` → exit 0。TC-B1~B7 全部行为满足。
- 另有正面证据：P4-implementation-b.md 自查 `bash -n` + `make -n debug-test` + P3 harness PASS=6/FAIL=0，与我的独立复测一致。

## 范围控制（评审重点 3）

`git diff --stat` 恰好 3 个文件：`frontend-v3/e2e/viewer.spec.ts`（子任务 A 唯一）、`scripts/e2e-safety-check.sh` + `Makefile`（子任务 B 唯二），无交叉越界，无后端/MCP/生产改动。

## 非阻塞 MINOR（不阻断 approved，供 P6 参考）

1. **TC-041 纯负断言**（viewer.spec.ts:277-279）：`.file-sidebar` count===0 无任何正向断言兜底，若 json-api-config 从 seed 消失仍会假绿。当前 seed 已核实存在，且与 P2/P1 批准设计（BDD-5）一致，不构成偏离；P6 实跑时建议肉眼确认该 entry 实际渲染了内容。
2. **TC-001 运行时可重入性**：`POST /api/v1/entries` 未检查响应状态，entry 已存在时（复用未清理的 debug DB）409 会静默吞掉。属既有模式（P0/P1 未要求改），P6 在同一次 debug-seed 生命周期内串行执行即可通过。
