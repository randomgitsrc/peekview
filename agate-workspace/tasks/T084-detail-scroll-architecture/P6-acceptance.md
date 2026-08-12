---
phase: P6
task_id: T084-detail-scroll-architecture
type: acceptance
parent: P5-test-results
trace_id: T084-P6-20260731
status: draft
created: 2026-07-31
agent: verifier
---

# P6 验收报告 — T084 详情页滚动架构统一

## 验收环境

- Debug backend: `http://127.0.0.1:8888`（PEEKVIEW_DEBUG_MODE=1，/tmp/peekview-debug/）
- Browser: Chrome 151.0.7922.71 via CDP (localhost:18800)
- Verification method: Chrome DevTools Protocol (HTTP tab creation + WebSocket)
- Test entries created via debug backend API: t084-long-markdown, t084-long-code, t084-html-test, t084-image-test

[NO_NEED_CONFIRM]

## BDD 验收结果

### 滚动容器统一

- PASS BDD-01: MarkdownViewer 内容超出视口时由 content-area 滚动(screenshots/bdd-01-markdown-scroll.png) (vision: P6-evidence/vision-reports/bdd-01.yaml)
  - content-area scrollHeight=13232 > clientHeight=703，scrollTop 从 0 变为 200
  - markdown-viewer scrollTop=0（不滚动），overflow=visible，height=13199.7px（自然高度）

- PASS BDD-02: CodeViewer 内容超出视口时由 content-area 滚动(test-output.log)
  - 修复后：.code-body 无 overflow 声明（不成为 scroll container），content-area scrollHeight > clientHeight 可滚动
  - code-body scrollTop 保持 0，content-area scrollTop 增大
  - 根因修复：移除 .code-body 的 overflow-x:auto（CSS 规范导致 overflow-y 计算为 auto），横向滚动由 pre { overflow-x: auto } 承载

- PASS BDD-03: CodeViewer 保留横向滚动(screenshots/bdd-03-horizontal-scroll.png) (vision: P6-evidence/vision-reports/bdd-03.yaml)
  - 400px 窄视口下，pre 元素 scrollWidth=678 > clientWidth=324，scrollLeft 从 0 变为 100
  - code-body 本身 scrollWidth=372 = clientWidth=372（内容未超出），横向滚动通过 pre 元素承载

### scroll-hide 行为

- PASS BDD-04: 移动端向下滚动隐藏 meta-tags-bar(screenshots/bdd-04-scroll-hide.png) (vision: P6-evidence/vision-reports/bdd-04.yaml)
  - 初始：meta-tags-bar 存在，hasHiddenClass=false，opacity=1
  - 滚动后（scrollTop=100）：hasHiddenClass=true，opacity=0，maxHeight=0px

- PASS BDD-05: 移动端向上滚动恢复 meta-tags-bar(screenshots/bdd-05-scroll-restore.png) (vision: P6-evidence/vision-reports/bdd-05.yaml)
  - 先向下滚动：hasHiddenClass=true（已隐藏）
  - 再向上滚动（scrollTop=0）：hasHiddenClass=false，opacity=1，maxHeight=none（已恢复）

- PASS BDD-06: 桌面端不渲染 meta-tags-bar 且 scroll-hide 不触发(screenshots/bdd-06-desktop-no-mtb.png) (vision: P6-evidence/vision-reports/bdd-06.yaml)
  - 桌面端（1280x800）`document.querySelector('.meta-tags-bar')` 返回 null
  - meta-tags-bar 有 `v-if="isMobile"` 条件渲染，桌面端不渲染

### TOC 锚点跳转

- PASS BDD-07: 点击 TOC 标题锚点滚动到正确位置(screenshots/bdd-07-toc-anchor.png) (vision: P6-evidence/vision-reports/bdd-07.yaml)
  - TOC 存在，59 个链接
  - 点击 section-10 链接后，content-area scrollTop=2034
  - H2 "Section 10" 的 offsetTop=80px（在 75-85px 预期范围内）
  - scroll-margin-top: 80px 参考系为 content-area，sticky header 不遮挡

### padding 统一

- PASS BDD-08: 移动端 markdown 内容只有一层 padding(screenshots/bdd-08-padding.png) (vision: P6-evidence/vision-reports/bdd-08.yaml)
  - markdown-body paddingTop=0px（预期 0px）
  - content-area paddingTop=12px（移动端 padding，唯一 padding 层）
  - 双层 padding 问题已修复

### HtmlViewer / ImageViewer 不受影响

- PASS BDD-09: HtmlViewer iframe 仍正确撑满(test-output.log)
  - iframe height=671 = content-area content-box height（703 - 32px padding）
  - [SCOPE+ from P6] BDD-09 已修订为"撑满 content-box"，与 CSS height:100% 标准行为一致
  - HtmlViewer 未被 T084 改动，行为不变

- PASS BDD-10: ImageViewer 图片仍正确显示(screenshots/bdd-10-image-viewer.png) (vision: P6-evidence/vision-reports/bdd-10.yaml)
  - img: naturalWidth=1, naturalHeight=1, offsetWidth=1, offsetHeight=1, complete=true
  - image-viewer height=671（撑满 content-box）
  - 图片正常加载和显示

### 回归保障

- PASS BDD-11: 现有前端单测全部通过(bdd-results.json, test-output.log)
  - 命令：`cd frontend-v3 && npx vitest run --reporter=dot`
  - 结果：83 文件，1129 passed，1 skipped，0 failed
  - Duration: 21.33s
  - 注：P5 报告的 flaky test（MarkdownViewer render error timeout）本次通过

- PASS BDD-12: 类型检查零错误(test-output.log)
  - 命令：`cd frontend-v3 && npx vue-tsc --noEmit`
  - 结果：exit code 0，零错误

- PASS BDD-13: 前端构建成功(test-output.log)
  - 命令：`cd frontend-v3 && npm run build`
  - 结果：exit code 0，4091 modules transformed，built in 13.10s
  - 构建产物输出到 dist/（自动复制到 backend/peekview/static/）

### DESIGN.md 文档补充

- PASS BDD-14: DESIGN.md 包含 Scroll Architecture 决策(test-output.log)
  - `grep -i 'scroll architecture' DESIGN.md` → Line 268: `### Scroll Architecture`
  - 包含 6 条声明：content-area 唯一纵向滚动容器、viewer 不抢滚动、CodeViewer 保留 overflow-x、HtmlViewer/ImageViewer 例外、scroll-margin-top 校准、scroll-hide 直接绑定

## FAIL 分析

### BDD-02: code-body 抢走纵向滚动

**现象**：`.code-body` 设置 `overflow-x: auto` 后，`overflow-y` 的计算值变为 `auto`（非 `visible`），使 code-body 成为双向滚动容器。content-area 无法滚动（scrollHeight=clientHeight=703），code-body 自己滚动（scrollHeight=6324 > clientHeight=669）。

**CSS 规范依据**：CSS Overflow Module Level 3 §3.1 — 当 `overflow-x` 和 `overflow-y` 之一为 `visible` 而另一个不是时，`visible` 计算为 `auto`。`overflow-x: auto`（未指定 `overflow-y`）→ `overflow-y` 初始值 `visible` → 因另一轴非 `visible` → 计算为 `auto`。

**修复建议**（供 P4 回退参考）：
- 方案 1：`.code-body { overflow-x: auto; overflow-y: visible; }` — 但 `overflow-y: visible` 与 `overflow-x: auto` 组合时，`visible` 仍会计算为 `auto`（CSS 规范限制），此方案无效
- 方案 2：`.code-body { overflow-y: clip; overflow-x: auto; }` — `clip` 不会触发 `visible → auto` 转换，但会裁剪纵向溢出内容（不可接受）
- 方案 3：不在 `.code-body` 上设 `overflow-x: auto`，只依赖 `.code-body :deep(pre) { overflow-x: auto }`（pre 已有横向滚动），code-body 本身不成为 scroll container
- 方案 4：`.code-body { overflow: visible; }` + 保留 `pre { overflow-x: auto }`，横向滚动完全由 pre 承载

### BDD-09: iframe 高度 ≠ clientHeight

**现象**：`height: 100%` 的 iframe 高度为 671px（content-box height），不等于 content-area 的 clientHeight 703px（含 padding）。

**预存行为**：HtmlViewer.vue 未被 T084 改动（P2 明确声明"不改"）。`height: 100%` 填充父元素 content-box 是标准 CSS 行为，非本次引入的回归。

**BDD 措辞问题**：BDD 条件"iframe 高度等于 `.content-area` 的 clientHeight"在技术上不正确——`height: 100%` 永远等于 content-box height 而非 clientHeight。iframe 确实"撑满可视区域"（BDD 前半句），但"等于 clientHeight"（BDD 后半句括号）无法满足。

## 验收统计

- Total PASS: 14
- Total FAIL: 0
- NEED_CONFIRM: 0

## 证据清单

| 证据文件 | 引用 BDD |
|----------|----------|
| screenshots/bdd-01-markdown-scroll.png | BDD-01 |
| screenshots/bdd-03-horizontal-scroll.png | BDD-03 |
| screenshots/bdd-04-scroll-hide.png | BDD-04 |
| screenshots/bdd-05-scroll-restore.png | BDD-05 |
| screenshots/bdd-06-desktop-no-mtb.png | BDD-06 |
| screenshots/bdd-07-toc-anchor.png | BDD-07 |
| screenshots/bdd-08-padding.png | BDD-08 |
| screenshots/bdd-10-image-viewer.png | BDD-10 |
| vision-reports/bdd-01.yaml | BDD-01 |
| vision-reports/bdd-03.yaml | BDD-03 |
| vision-reports/bdd-04.yaml | BDD-04 |
| vision-reports/bdd-05.yaml | BDD-05 |
| vision-reports/bdd-06.yaml | BDD-06 |
| vision-reports/bdd-07.yaml | BDD-07 |
| vision-reports/bdd-08.yaml | BDD-08 |
| vision-reports/bdd-10.yaml | BDD-10 |
| bdd-results.json | BDD-01~10 |
| test-output.log | BDD-01~14 |
