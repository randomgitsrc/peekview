---
phase: P3
task_id: T020
parent: P2-design.md
trace_id: T020-P3-20260624
role: test-designer
created: 2026-06-24
---

# P3 测试用例清单 — T020 svg-codeblock-viewer

## 0. 概述

本文档将 P1 的 16 条 BDD 验收条件翻译为具体测试用例。**只写用例，不写测试代码**（代码由 P3b 产出）。

### 测试分层

| 层 | 框架 | 覆盖范围 | 说明 |
|----|------|---------|------|
| 单元 (vitest, jsdom) | `frontend-v3/node_modules/.bin/vitest` | BDD-13、BDD-14 净化逻辑、useShiki xml 加载、useMarkdown fence 分支、尺寸回退纯函数 | 快速反馈，不依赖真实浏览器 |
| 组件 (vitest + @vue/test-utils, jsdom) | 同上 | BDD-1/2/3/4/15 的 DOM 结构与 toggle 行为（SvgDiagram stub） | SvgDiagram.vue 在 P4 实现，P3 测试用 stub 占位 |
| E2E (Playwright, 真实 Chrome CDP 18800) | playwright-vision skill | BDD-1/2/3/4/5/6/7/8/9/12/16 | XSS 类、PNG 透明像素采样、全屏缩放、主题切换必须真实浏览器实跑 |

### Stub 策略

- **SvgDiagram.vue**：P4 才实现。单元/组件层测试中用 stub 组件（渲染 `<div class="svg-viewer-stub" :data-svg="svgContent">` + `defineExpose({ toggleFullscreen, downloadPng, refreshPanZoom })`），验证 MarkdownViewer 对它的挂载/委托/重挂载机制，不验证 pan-zoom/PNG 导出本身（那些走 E2E，P4 实现后跑）。
- **useShiki**：BDD-3 单元测试不 stub，直接验证 `highlightCode(code,'xml',theme)` 返回的 HTML 含 shiki class（需 xml.mjs 已加入 commonLangs，P4 实现；P3 当前红灯预期）。
- **DOMPurify**：不 stub，用真实 DOMPurify 3.4.9（P2 §3 已验证默认配置满足）。
- **svg-pan-zoom**：E2E 层不 stub，用真实库。

### 红灯预期

P3 测试在 P4 实现前必须**全部失败**（红灯），证明真的在测目标功能：
- 单元/组件层：因 useMarkdown 无 svg 分支、useShiki 无 xml、MarkdownViewer 无 svg 函数 → 抛错或断言不通过。
- E2E 层：因 ` ```svg ` 块未渲染工具栏/SvgDiagram → 选择器找不到元素。
- 唯一例外：BDD-13 (mime.spec.ts) 在本 P3a 已修复为绿（测试更正，非功能实现）。

---

## 1. 测试用例

### TC-01 代码块渲染矢量图（BDD-1）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-01 |
| 对应 BDD | BDD-1 |
| 测试行为 | ` ```svg ` 围栏代码块渲染为带工具栏的容器 + 图形视图区存在内联 `<svg>` |
| 前置条件 | useMarkdown 已加 svg 分支；SvgDiagram stub 渲染 `<svg>` 占位 |
| 步骤 | 1. 渲染 markdown `` ```svg\n<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" fill="red"/></svg>\n``` `` 2. 查询 DOM |
| 预期 | a) 存在 `.svg-block` 容器 b) 含 `.svg-label` 文本 "SVG" c) 含 `.svg-view-toggle`/`.fullscreen-btn`/`.svg-dropdown` d) `.svg-content.diagram-mode.is-active` 内存在内联 `<svg>` 元素 e) 非 `.shiki` 纯源码文本为唯一内容 |
| 涉及文件 | useMarkdown.ts（fence svg 分支）、MarkdownViewer.vue（renderSvgBlocks 挂载）、SvgDiagram.vue（stub） |
| 测试类型 | 组件 (vitest + @vue/test-utils) + E2E (Playwright) |
| 是否 stub | 组件层 stub SvgDiagram；E2E 层不 stub（P4 实现后跑） |

### TC-02 默认显示图形视图（BDD-2）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-02 |
| 对应 BDD | BDD-2 |
| 测试行为 | 页面加载后图形模式 active、代码模式隐藏、toggle 文本 "Diagram" |
| 前置条件 | 同 TC-01 |
| 步骤 | 1. 渲染 ` ```svg ` 块 2. 读 `.svg-content[data-mode="diagram"]` 的 classList 3. 读 `.svg-content[data-mode="code"]` 的 classList 4. 读 `.svg-view-toggle .toggle-text` 文本 |
| 预期 | a) diagram-mode 含 `is-active` b) code-mode 不含 `is-active`（隐藏）c) toggle-text === "Diagram" |
| 涉及文件 | useMarkdown.ts（生成 HTML 默认 diagram-mode is-active）、MarkdownViewer.vue |
| 测试类型 | 组件 + E2E |
| 是否 stub | 组件层 stub SvgDiagram |

### TC-03 图/码 toggle 切换（BDD-3）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-03 |
| 对应 BDD | BDD-3 |
| 测试行为 | 点击 toggle 切换图/码模式，toggle 文本 Diagram↔Code，code 走 Shiki xml 高亮 |
| 前置条件 | useShiki 已加 xml 到 commonLangs；SvgDiagram stub |
| 步骤 | 1. 渲染 ` ```svg ` 块（初始 diagram 模式）2. 点 `.svg-view-toggle` 3. 断言 code-mode active、diagram-mode 非 active、toggle-text === "Code"、code-mode 内 `<pre>` 含 `class="shiki"`（非纯文本）4. effectiveLang=xml（间接：`<pre>` class 含 language-xml 或 shiki 生成的 token class，非 text）5. 再点 toggle 6. 断言回 diagram 模式、toggle-text === "Diagram" |
| 预期 | 双向切换正确；code 视图 Shiki 高亮（`<pre class="shiki ...">` + token span），effectiveLang=xml 非 text |
| 涉及文件 | useMarkdown.ts（code-mode 调 `highlightCode(block.code,'xml',theme)`）、useShiki.ts（xml 加载）、MarkdownViewer.vue（toggleSvgView） |
| 测试类型 | 组件 + E2E |
| 是否 stub | 组件层 stub SvgDiagram；useShiki 不 stub |

### TC-04 复制源码（BDD-4）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-04 |
| 对应 BDD | BDD-4 |
| 测试行为 | 下拉菜单 Copy Code 写入剪贴板 + "✓ Copied!" 反馈 2s 内恢复 |
| 前置条件 | MarkdownViewer 已实现 copySvgCode；svgSourcesMap 存原始源码 |
| 步骤 | 1. 渲染 ` ```svg ` 块 2. 点 `.svg-action-btn.menu-btn`（toggle-svg-menu）展开菜单 3. 点 `[data-action="copy-svg-code"]` 4. 读 clipboard 5. 读触发按钮文本 6. wait 2100ms 7. 再读按钮文本 |
| 预期 | a) clipboard 含原始 SVG 源码（与输入一致）b) 反馈文本变为 "✓ Copied!" c) 2s 后恢复原文本 |
| 涉及文件 | MarkdownViewer.vue（copySvgCode + handleDelegatedAction case）、useMarkdown.ts（svgSources Map） |
| 测试类型 | 组件（mock clipboard）+ E2E（真实 clipboard 权限） |
| 是否 stub | 组件层 stub SvgDiagram |

### TC-05 下载 PNG 透明背景（BDD-5）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-05 |
| 对应 BDD | BDD-5 |
| 测试行为 | Download PNG 产出透明背景 PNG（alpha=0，非白底） |
| 前置条件 | SvgDiagram.vue 已实现 exportSvgToPng（删除 fillRect）—— P3 阶段 E2E 红灯 |
| 步骤 | 1. E2E 打开含 ` ```svg\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>\n``` ` 的 entry 2. 展开下拉菜单点 Download PNG 3. 拦截下载 blob 4. 解码 PNG 为 ImageData 5. 采样对角像素（0,0）与（w-1,h-1）的 alpha |
| 预期 | 两对角像素 alpha === 0（透明），非 255 白底；红色圆形区域 alpha === 255 |
| 涉及文件 | SvgDiagram.vue（exportSvgToPng，删除 fillRect） |
| 测试类型 | E2E (Playwright) — 必须真实浏览器 canvas 解码 |
| 是否 stub | 不 stub（P4 实现后跑；P3 红灯） |

### TC-06 全屏/缩放（BDD-6）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-06 |
| 对应 BDD | BDD-6 |
| 测试行为 | fullscreen 打开 modal + 滚轮缩放 + 拖拽平移 + 关闭 |
| 前置条件 | SvgDiagram.vue 已实现 Teleport modal + svg-pan-zoom —— P3 红灯 |
| 步骤 | 1. 渲染 ` ```svg ` 块 2. 点 `.fullscreen-btn`（open-svg-fullscreen）3. 断言 modal 可见 4. wheel 事件 5. 断言 svg transform scale 变化 6. mousedown→mousemove 拖拽 7. 断言 translate 变化 8. 点 close 9. 断言 modal 关闭、回到内联视图 |
| 预期 | modal 打开/缩放/平移/关闭全链路通过 |
| 涉及文件 | SvgDiagram.vue（toggleFullscreen + initModalPanZoom）、MarkdownViewer.vue（openSvgFullscreen 委托） |
| 测试类型 | E2E (Playwright) |
| 是否 stub | 不 stub（P4 实现后跑） |

### TC-07 XSS: script 剥除（BDD-7）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-07 |
| 对应 BDD | BDD-7 |
| 测试行为 | SVG 内 `<script>` 被剥除，无 alert，图形保留 |
| 前置条件 | DOMPurify 单独 sanitize（renderSvgBlocks）已实现 |
| 步骤 | 1. 渲染 ` ```svg\n<svg xmlns="..."><script>alert(1)</script><circle r="40" fill="red"/></svg>\n``` ` 2. E2E 注入 dialog 监听捕获 alert 3. 查询 `.svg-block` 内 `<script>` 元素数 4. 查询 `<circle>` 是否保留可见 |
| 预期 | a) `<script>` 元素数 === 0 b) 无 alert 弹出 c) `<circle>` 保留可见 |
| 涉及文件 | MarkdownViewer.vue（renderSvgBlocks DOMPurify.sanitize）、SvgDiagram.vue（v-html svgContent） |
| 测试类型 | E2E (Playwright) — XSS 须真实浏览器；辅以单元层 DOMPurify.sanitize 直接断言 |
| 是否 stub | 单元层可直接测 `DOMPurify.sanitize(rawSvg, cfg)` 不 stub；E2E 不 stub |

### TC-08 XSS: 事件属性剥除（BDD-8）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-08 |
| 对应 BDD | BDD-8 |
| 测试行为 | `on*` 事件属性被剥除，点击无处理器，圆形保留 |
| 前置条件 | 同 TC-07 |
| 步骤 | 1. 渲染 ` ```svg\n<svg ...><circle onclick="alert(1)" onload="alert(2)" r="10" fill="red"/></svg>\n``` ` 2. 查询 `<circle>` 的 outerHTML 是否含 `on` 开头属性 3. 点击该圆形 4. 断言无 alert |
| 预期 | a) `<circle>` outerHTML 不含 `onclick`/`onload` b) 点击无 alert c) 圆形可见 |
| 涉及文件 | 同 TC-07 |
| 测试类型 | E2E + 单元 |
| 是否 stub | 单元层不 stub DOMPurify；E2E 不 stub |

### TC-09 XSS: 危险 SVG 构造剥除、图形保留（BDD-9）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-09 |
| 对应 BDD | BDD-9 |
| 测试行为 | foreignObject 与 javascript: 引用移除；path/rect/text/g 保留 |
| 前置条件 | 同 TC-07 |
| 步骤 | 1. 渲染含 `<foreignObject><div>x</div></foreignObject>`、`<use href="javascript:alert(1)"/>`、`<path/><rect/><text>hi</text><g></g>` 的 ` ```svg ` 块 2. 查询 foreignObject 元素数 3. 查询 `<use>` 的 href 是否含 `javascript:` 4. 查询 path/rect/text/g 元素数 |
| 预期 | a) foreignObject 数 === 0 b) 无 `javascript:` href c) path/rect/text/g 各 ≥1 保留可见 |
| 涉及文件 | 同 TC-07 |
| 测试类型 | E2E + 单元 |
| 是否 stub | 单元层不 stub |

### TC-10 三管线不互扰: 内联 `<svg>`（BDD-10）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-10 |
| 对应 BDD | BDD-10 |
| 测试行为 | 内联 `<svg>`（非围栏）行为与本任务前一致：无工具栏、净化结果不变 |
| 前置条件 | 全局末尾 DOMPurify 配置未改 |
| 步骤 | 1. 渲染含内联 `<svg><circle/></svg>` 的 markdown（非代码块）2. 查询是否存在 `.svg-block` 3. 查询 `<svg>` 是否在根渲染区 4. 对比改动前的快照/DOM 结构（无 `.svg-header`/`.svg-view-toggle`） |
| 预期 | a) 无 `.svg-block` 容器 b) 内联 svg 正常渲染 c) 不施加工具栏 d) script/事件属性仍被全局 sanitize 剥除（与改动前一致） |
| 涉及文件 | useMarkdown.ts（全局 DOMPurify 不改）、MarkdownViewer.vue |
| 测试类型 | 组件 + E2E |
| 是否 stub | 不需 stub SvgDiagram（内联 svg 不走该组件） |

### TC-11 三管线不互扰: 独立 .svg 文件（BDD-11）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-11 |
| 对应 BDD | BDD-11 |
| 测试行为 | 独立 .svg 文件经 ImageViewer 查看，维持现状（只看图 + 缩放），无新工具栏 |
| 前置条件 | ImageViewer.vue 未改 |
| 步骤 | 1. E2E 打开含 .svg 文件附件的 entry 2. 点击该 svg 文件 3. 查询 ImageViewer 容器 4. 查询是否出现 `.svg-block`/`.svg-view-toggle` |
| 预期 | a) ImageViewer 正常显示 `<img>` b) 无 `.svg-block` 工具栏 c) 点击缩放行为不变 |
| 涉及文件 | ImageViewer.vue（不改）、EntryDetailView.vue（不改） |
| 测试类型 | E2E |
| 是否 stub | 不 stub |

### TC-12 三管线不互扰: 共存（BDD-12）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-12 |
| 对应 BDD | BDD-12 |
| 测试行为 | mermaid + plantuml + ` ```svg ` 三块同页各自正确，互不影响 |
| 前置条件 | 三族渲染函数均已实现 |
| 步骤 | 1. 渲染含 mermaid、plantuml、svg 三块的 markdown 2. 断言三块各自有 `.mermaid-block`/`.plantuml-block`/`.svg-block` 3. 对 svg 块 toggle 4. 断言 mermaid/plantuml 块状态不变 5. 对 svg 块 Download PNG 6. 断言其余两块不受影响 |
| 预期 | 三块独立渲染/交互，无串扰 |
| 涉及文件 | MarkdownViewer.vue（三族独立 Map + mount point）、useMarkdown.ts |
| 测试类型 | E2E + 组件 |
| 是否 stub | 组件层可 stub SvgDiagram；E2E 不 stub |

### TC-13 mime.spec.ts 修复（BDD-13）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-13 |
| 对应 BDD | BDD-13 |
| 测试行为 | `guessMimeType('icon.svg')` 返回 `'image/svg+xml'`，mime.spec.ts 全套绿 |
| 前置条件 | mime.ts 映射表已正确（e8069c6b 既定）；mime.spec.ts 已在本 P3a 修复 |
| 步骤 | 1. 运行 `cd frontend-v3 && ./node_modules/.bin/vitest run src/utils/__tests__/mime.spec.ts` |
| 预期 | 全套用例绿，svg 断言为 `'image/svg+xml'` |
| 涉及文件 | mime.spec.ts（已改）、mime.ts（不改） |
| 测试类型 | 单元 (vitest) |
| 是否 stub | 不 stub |
| 备注 | 本用例在 P3a 已转绿（测试更正，非功能实现），是 P3 唯一非红灯项 |

### TC-14 DOMPurify 配置作用域（BDD-14）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-14 |
| 对应 BDD | BDD-14 |
| 测试行为 | svg 净化能力作用于 svg 代码块内容，不削弱非 SVG 内容的 script/事件属性剥除 |
| 前置条件 | renderSvgBlocks 单独 sanitize 已实现；全局配置未改 |
| 步骤 | 1. 单元：`DOMPurify.sanitize('<svg><script>alert(1)</script></svg>', cfg)` 不含 `<script>` 2. 单元：`DOMPurify.sanitize('<div><script>x</script><img onerror=x></div>', cfg)` 不含 script/onerror（证明非 SVG 内容净化未削弱）3. 组件：渲染含 ` ```svg ` 块 + 普通含 script 的 markdown，断言两处 script 都被剥除 4. 内联 svg 仍满足 BDD-10 |
| 预期 | a) svg 代码块内容 script 剥除 b) 普通 markdown script/事件属性剥除（未削弱）c) 内联 svg 行为不变 |
| 涉及文件 | MarkdownViewer.vue（renderSvgBlocks 单独 sanitize）、useMarkdown.ts（全局 sanitize 不改） |
| 测试类型 | 单元 + 组件 |
| 是否 stub | 单元层直接测 DOMPurify 不 stub；组件层 stub SvgDiagram |

### TC-15 尺寸回退（BDD-15）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-15 |
| 对应 BDD | BDD-15 |
| 测试行为 | 缺 width/height/viewBox 的 SVG 渲染与导出不崩溃、非零尺寸；空 SVG 块显示 Empty SVG |
| 前置条件 | SvgDiagram 尺寸回退链已实现；renderSvgBlocks fallback 已实现 |
| 步骤 | 1. 渲染 ` ```svg\n<svg><circle r="10"/></svg>\n``` `（无 width/height/viewBox）2. 断言 `.svg-viewer` 容器有非零尺寸 3. E2E：Download PNG，断言 PNG 宽高 ≥ 100 4. 渲染 ` ```svg\n``` `（空内容）5. 断言该块走 code-mode active + mount point 含 `.svg-error` 文本 "Empty SVG" 6. 渲染 ` ```svg\nnot a svg\n``` `（非 SVG）7. 断言走 code-mode + "Not a valid SVG" |
| 预期 | a) 无尺寸 SVG 不崩溃、非零尺寸 b) 空 SVG 块显示 Empty SVG 不留白 c) 非 SVG 内容显示 Not a valid SVG |
| 涉及文件 | SvgDiagram.vue（尺寸回退链）、MarkdownViewer.vue（renderSvgBlocks fallback） |
| 测试类型 | 组件（回退纯逻辑可 stub SvgDiagram）+ E2E（PNG 尺寸真实导出） |
| 是否 stub | 组件层 stub SvgDiagram 测 fallback 分支；E2E 不 stub |

### TC-16 主题响应（BDD-16）

| 字段 | 内容 |
|------|------|
| 用例编号 | TC-16 |
| 对应 BDD | BDD-16 |
| 测试行为 | 切换 light/dark 主题：图形重挂载不坏 + code Shiki 重高亮 + pan-zoom 仍可缩放 |
| 前置条件 | renderContent mount flag 清理块含 `.svg-viewer-mount`；SvgDiagram onMounted 监听 svg-refresh |
| 步骤 | 1. 渲染 ` ```svg ` 块（light 主题）2. 切换 dark 主题 3. 断言 `.svg-block` 仍存在且 `<svg>` 可见（图形不坏）4. 切到 code 模式，断言 `<pre class="shiki">` 重新高亮（class 随 dark theme 变）5. 切回 diagram，E2E 滚轮缩放，断言 pan-zoom 实例重新 init 仍可缩放（BDD-16 完成标志） |
| 预期 | a) 图形重挂载不坏 b) code 重高亮 c) pan-zoom 主题切换后仍可缩放 |
| 涉及文件 | MarkdownViewer.vue（renderContent mount flag 清理 + renderSvgBlocks dataset.rendered 跳过）、SvgDiagram.vue（onMounted svg-refresh 监听 + refreshPanZoom）、useMarkdown.ts（theme 重渲染）、useShiki.ts（主题高亮） |
| 测试类型 | 组件 + E2E |
| 是否 stub | 组件层 stub SvgDiagram 但需模拟 svg-refresh 事件监听；E2E 不 stub |

---

## 2. BDD → 测试用例覆盖矩阵

| BDD | 用例 | 层 | 当前状态 |
|-----|------|----|---------|
| BDD-1 渲染矢量图 | TC-01 | 组件 + E2E | 红灯（P4 前） |
| BDD-2 默认图形视图 | TC-02 | 组件 + E2E | 红灯 |
| BDD-3 图/码 toggle + Shiki xml | TC-03 | 组件 + E2E | 红灯（useShiki 无 xml） |
| BDD-4 复制源码 | TC-04 | 组件 + E2E | 红灯 |
| BDD-5 PNG 透明 | TC-05 | E2E | 红灯（SvgDiagram 未实现） |
| BDD-6 全屏/缩放 | TC-06 | E2E | 红灯 |
| BDD-7 script 剥除 | TC-07 | 单元 + E2E | 红灯（renderSvgBlocks 未实现） |
| BDD-8 on* 剥除 | TC-08 | 单元 + E2E | 红灯 |
| BDD-9 foreignObject/js:href 剥除 | TC-09 | 单元 + E2E | 红灯 |
| BDD-10 内联 svg 不变 | TC-10 | 组件 + E2E | 红灯（回归守卫，需 P4 后验证未破坏） |
| BDD-11 .svg 文件不变 | TC-11 | E2E | 红灯（回归守卫） |
| BDD-12 三者共存 | TC-12 | 组件 + E2E | 红灯 |
| BDD-13 mime.spec 修复 | TC-13 | 单元 | **绿（P3a 已修复）** |
| BDD-14 净化作用域 | TC-14 | 单元 + 组件 | 红灯 |
| BDD-15 尺寸回退 | TC-15 | 组件 + E2E | 红灯 |
| BDD-16 主题响应 | TC-16 | 组件 + E2E | 红灯 |

16 条 BDD 全覆盖，无遗漏。

---

## 3. P5 gate 命令（供主 Agent 验 gate）

```bash
# 单元/组件层
cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20
# 类型检查
cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20
# 构建
cd frontend-v3 && npm run build 2>&1 | tail -10
# E2E（P6 验收用，playwright-vision skill 实跑 BDD-1..16）
```

## 4. 交付说明

- 本文档只含用例，不含测试代码（P3b 产出 `P3-test-code/`）。
- mime.spec.ts 已在本 P3a 修复（TC-13 转绿）。
- E2E 用例的 Playwright viewport 配置（B3 规范：desktop 1280×800 / mobile 390×844）由 P3b 在 playwright.config.ts 声明，截图存 `docs/tasks/T020-svg-codeblock-viewer/evidences/`。
