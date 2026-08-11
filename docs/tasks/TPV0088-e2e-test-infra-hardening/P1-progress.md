# P1 Progress — TPV0088 (analyst)

## 读取进度
- [x] P1-dispatch-context-analyst.md（目标/约束/输入/已确认事实）
- [x] analyst.md 角色定义
- [x] P0-brief.md（两个子任务审计结果）
- [x] AGENTS.md（铁律 7：URL 是 /{slug}）
- [x] frontend-v3/e2e/viewer.spec.ts（20 用例，6 describe）
- [x] Makefile:540-650（debug-build 553-563 / debug-test 633-639）
- [x] scripts/e2e-safety-check.sh（Step 1 前置检查 5 项）

## 关键发现

### P0 审计结论"选择器基本未过时"存疑 — 多个选择器实为死选择器
1. `.code-header`（TC-005）：仅 styles/code.css 有 CSS，**无任何 Vue 模板渲染该结构**。`code-header .filename/.lang` 断言必然失败。filename/lang 仅出现在 FileTree 的 `.file-item .file-name`，lang 仅出现在 markdown 代码块的 `.code-lang`。
2. `.mobile-actions`（TC-021/022）：仅 layout.css 有 CSS，**实际组件是 `.mobile-bottom-bar`**（EntryDetailMobileBar.vue）。
3. `.menu-btn`（TC-022）：仅在 DiagramBlock.vue 的 `.diagram-action-btn menu-btn`（图工具栏），**不是移动端文件抽屉按钮**。移动端文件抽屉按钮是 `[data-testid="mobile-bar-filetree-btn"]`。
4. `.toc-btn`（TC-023）：仅 layout.css 有 CSS，实际 TOC 按钮是 `[data-testid="mobile-bar-toc-btn"]`。
5. `.list-header`（TC-030/031）：**全代码库不存在**。ThemeToggle 按钮 class 是 `.theme-toggle`（无 `.btn-icon`）。
6. `button:has-text("Copy")`（TC-004/005）：桌面 Copy 按钮是 icon-btn（aria-label="Copy"，无文本）；有文本 "Copy" 的是 markdown 代码块 `.code-copy-btn`。
7. `button:has-text("Wrap")`（TC-003/005）：**桌面端不存在 Wrap 按钮**。Wrap 仅在移动端 `[data-testid="mobile-bar-wrap-btn"]`（icon，无文本）；ActionBar.vue 有文本 Wrap 但**未被任何组件引用**。
8. `a[download]`（TC-042）：下载通过 JS 动态创建 `<a>` 后立即移除（useEntryDetailComputed.downloadFile），**DOM 中不会残留 a[download]**，toBeVisible 必然失败。
9. `.entry-card`（TC-050）：只在 EntryListView（/explore）渲染，**landing（/）不渲染**。TC-050 goto '/' 后 waitForSelector('.entry-card') 必超时 → 需 goto /explore。
10. TC-050 URL 断言 `toHaveURL(/\/entry\//)`：路由是 `/{slug}`，**URL 不含 `/entry/`** → 断言必然失败，需改为 `/{slug}` 正则。

### 已核实可用的选择器（P0 正确）
`.file-sidebar .toc-sidebar .drawer-left .drawer-right .drawer-overlay .entry-card .markdown-body .toc-nav .toc-item .file-item .code-body .line-number .line .theme-toggle .mobile-bottom-bar .toc-title` 均存在。Shiki 输出含 `class="line"` 和 inline color style（TC-001/002 可用）。

### TC-012 TOC 导航断言过时
TocNav 的 a 是 `href="#id"` + `@click.prevent`（scrollIntoView 平滑滚动，不改变 URL）。TC-012 `toHaveURL(/.*${href}$/)` 在 history 模式下 URL 不会带 #hash → 断言失败。需改为断言滚动位置或 active class。

### TC-013 mermaid 弱断言
`if (mermaidExists)` 条件式断言，无 mermaid 时静默通过（假绿风险）。目标 entry 换 mermaid-charts 后应改为无条件断言 `.mermaid` 渲染。

### slug 替换映射（已核实存在）
- `lu4prg`（TC-004/005/030/041/042，需 Python 代码 entry）→ `python-entry-service`（2 文件：entry_service.py 含 8 处 'def'，requirements.txt；public）。但 TC-041 需**单文件** entry → `json-api-config`（单文件 config.json，public）。
- `ngajri`（TC-010~013/020~023/040，需 markdown+TOC+mermaid）→ markdown 用 `markdown-test`（2 文件：rich-markdown.md+architecture.svg，多文件使 file-sidebar 显示）；mermaid（TC-013）用 `mermaid-charts`。
- `e2e-test-code`（TC-001/002/003）：运行时 API 创建（allow_anonymous_create=true 默认，debug 下 captcha 禁用），匿名强制 public，可行。

### 子任务 B
- debug-build 只查 index.html 存在（Makefile:557-560），无 mtime 比对。
- debug-test Step 1（Makefile:636）调 e2e-safety-check.sh，此处加 mtime 校验最合适。
- 正常流程：debug-quick/build-frontend 先 copy dist→static，build 后 static 比 src 新 → 不误伤。
- 需保证 build 源（frontend-v3/src + dist）都在比对范围。

## 结论
- 子任务 A 工作量远超 P0 估计（路由+slug 之外还有 8+ 个死选择器/过时断言），属"逐条对着真实 DOM 重写"级。
- risk_level: medium。
- P7 不可裁剪（viewer.spec.ts + Makefile + e2e-safety-check.sh 多文件）。

## 2026-08-12 analyst rev1（修订轮）
- 已读 P1-dispatch-context-analyst-rev1.md + P1-review.md，完成 20→19 全量修订
- 修订项1：§1/§3/§4标题/BDD-1/§5 P3/P6/§8风险表 + capability_requirements why 全部改为 19；§1 增加 P0 审计 20 系误记的说明
- 建议项2：IMPL-B2 统一 mtime 口径（src 最新 vs static/index.html，dist 仅中间产物），与 SUGGEST 对齐
- 建议项3：IMPL-B2 debug-stop 示例改为"仅清理 /tmp/peekview-debug，不涉及 static"
- 建议项4：§5 P6 与 §8 风险表引用同步为 19/19
- 自检：grep 无残留 20/20、20 用例；BDD-1~9 连续；frontmatter 机器字段未动
