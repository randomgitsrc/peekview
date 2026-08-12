---
phase: P2
task_id: T020
parent: P2-design.md
trace_id: T020-P2-review-20260624
status: approved
role: plan-design-review
reviewed: 2026-06-24
revision: 2
---

# P2 设计评审（第 2 轮）— T020 svg-codeblock-viewer

评审基线：P2-design.md (revision 2) 对照上一轮评审意见，并实读源码二次核对。

本轮评审重点：上一轮 2 个 [BLOCKER] 是否真正修正 + 是否引入新问题 + 非 BLOCKER 建议处理情况。

## 源码二次核实记录（本轮新读）

| 核实项 | 源码位置 | 事实 | 设计声称 | 一致 |
|--------|---------|------|---------|------|
| xml.mjs 存在性 | `node_modules/shiki/dist/langs/` | `xml.mjs` + `xml.d.mts` 存在，**无 svg.mjs** | "有 xml.mjs、无 svg.mjs，SVG 归 xml grammar" | ✓ |
| commonLangs 现状 | `useShiki.ts:25-41` | 14 项，不含 xml/svg | "commonLangs 不含 xml/svg" | ✓ |
| effectiveLang 回退 | `useShiki.ts:105-107` | `loadedLangs.includes(lang) ? lang : 'text'` | "未加载语言回退 text" | ✓ |
| createHighlighter 注册 | `useShiki.ts:61-63` | `langs: commonLangs` 静态注册，无动态加载 | "static import + commonLangs 追加即生效" | ✓ |
| renderContent flag 清理 | `MarkdownViewer.vue:388-397` | 清理 `.mermaid-viewer-mount` + `.plantuml-viewer-mount`，**无 svg** | "需追加 .svg-viewer-mount" | ✓（修正方向正确） |
| mermaid 跳过逻辑 | `MarkdownViewer.vue:417` | `dataset.rendered === 'true'` 跳过 | "renderSvgBlocks 镜像 :417" | ✓ |
| mermaid-refresh 监听 | `MermaidDiagram.vue:431` | `containerRef.value.addEventListener('mermaid-refresh', refreshPanZoom)` | "SvgDiagram 镜像 :431 监听 svg-refresh" | ✓ |
| mermaid dispatch 时机 | `MarkdownViewer.vue:242-246` | toggle 切回 diagram 时 `viewer.dispatchEvent(new CustomEvent('mermaid-refresh', {bubbles:true}))` | "toggle-svg-view 镜像 dispatch svg-refresh" | ✓ |
| fence renderer 插入点 | `useMarkdown.ts:264-294` plantuml 分支后、`:296` highlightCode 默认前 | 可插入 svg 分支 | "在 plantuml 之后、highlightCode 之前" | ✓ |
| ADD_ATTR 白名单 | `useMarkdown.ts:329` | 含 data-action/data-code/data-line/data-block-id/data-index/data-mode/target/rel | "svg 用到的 data-* 均在白名单，无需改 DOMPurify 配置" | ✓ |
| mermaid action 计数 | `MarkdownViewer.vue:342-346` | 5 个 case（toggle/fullscreen/menu/download/copy） | "mermaid 实为 5 action" | ✓ |

## BLOCKER-1 修正确认 — Shiki xml grammar 加载

**上一轮问题**：useShiki.ts commonLangs 不含 xml，highlightCode(code,'xml',theme) 会回退 text，BDD-3 落空；且 useShiki.ts 未列入"改什么"。

**本轮修正**（设计 §1 改什么表 + §2 + §8 BDD-3 + §11）：
- §1 改什么表（第 69 行）明确列出 `useShiki.ts`：static import `shiki/langs/xml.mjs` + `commonLangs` 追加 `xml`。
- files_to_read（第 358 行）补充 useShiki.ts 全文。
- §2（第 136 行）说明前置条件：useShiki.ts 已把 xml 加入 commonLangs，否则 effectiveLang 回退 text。
- §8 BDD-3 完成标志（第 337 行）加 "effectiveLang=xml 非 text" + "code `<pre>` 含 Shiki 生成的 class"。
- 风险表（第 93 行）评估 Shiki xml 加载失败：static import 构建期打包，运行期无网络依赖，异常 catch 回退 text 不崩。
- §11（第 395 行）"Shiki code-mode 用 xml grammar（已核实 xml.mjs 存在）"。

**核实结论**：修正方案与源码结构完全吻合。加入 commonLangs 后，`createHighlighter({langs: commonLangs})` 会注册 xml grammar，`getLoadedLanguages()` 包含 xml，`effectiveLang = 'xml'`（非 text），`codeToHtml(code, {lang:'xml'})` 产出 Shiki 高亮 HTML。BDD-3 可满足。xml.mjs 是静态 import（构建期打包），无运行期加载风险。**BLOCKER-1 真正修正**。

## BLOCKER-2 修正确认 — 主题切换重挂载

**上一轮问题**：renderContent 主题切换时 v-html 替换 DOM 销毁旧 SvgDiagram，但设计未声明清理 .svg-viewer-mount 的 dataset.rendered，renderSvgBlocks 若镜像 mermaid 跳过逻辑则不重挂载 → pan-zoom 失效。

**本轮修正**（设计 §2 + §3 + §8 BDD-16）：
- §2（第 166-186 行）明确 renderContent 调用链：清理三族 mount flag（含新增 `.svg-viewer-mount`）→ renderMermaidDiagrams → renderPlantUmlDiagrams → renderSvgBlocks。
- §2（第 166-171 行）给出清理代码片段：
  ```js
  const svgMountPoints = contentRef.value.querySelectorAll('.svg-viewer-mount')
  svgMountPoints.forEach(mp => { delete (mp as HTMLElement).dataset.rendered })
  ```
- §3（第 197 行）renderSvgBlocks 伪码镜像 `renderMermaidDiagrams:417` 的 `dataset.rendered === 'true'` 跳过逻辑。
- §3（第 231-239 行）SvgDiagram onMounted 显式注册 `svg-refresh` 监听（镜像 MermaidDiagram.vue:431），调 refreshPanZoom。
- §2（第 152 行）toggle-svg-view 切回 diagram 时 dispatch `svg-refresh` 事件（镜像 :243-246）。
- §8 BDD-16 完成标志（第 350 行）加 "主题切换后 pan-zoom 仍可缩放（SvgDiagram 重挂载，pan-zoom 实例重新 init）"。

**核实结论**：修正方案与 mermaid 蓝本完全镜像。主题切换流程：
1. `watch([content, theme])` 触发 → `renderContent()`
2. `renderedHtml = result.html`（v-html 替换 DOM，旧 SvgDiagram 实例随 unmount 销毁，pan-zoom destroy）
3. 清理 `.svg-viewer-mount` 的 `dataset.rendered`（新 DOM 的 mount point 无 rendered 标记）
4. `renderSvgBlocks()` 遍历，mount point 无 rendered 标记 → 重新挂载 SvgDiagram
5. SvgDiagram `onMounted` → `initPanZoom()` → pan-zoom 实例重建

pan-zoom 在主题切换后可用。BDD-16/BDD-6 可满足。**BLOCKER-2 真正修正**。

## 非 BLOCKER 建议处理确认

| 建议 | 上轮描述 | 本轮处理 | 状态 |
|------|---------|---------|------|
| 1. mermaid action 计数笔误 | "6 个"应为 5 | §2 第 148 行 + 修正说明第 25 行，统一为 5 | ✓ 已处理 |
| 2. 空 SVG 块走 fallback | 空内容留空白 diagram-mode | §3 第 219 行 + §6 第 309 行，空内容走 fallback 显示 "Empty SVG" | ✓ 已处理 |
| 3. svg-refresh 监听显式注册 | §3 defineExpose 列了但未写监听 | §3 第 231-239 行 onMounted 显式 addEventListener | ✓ 已处理 |
| 4. toggleSvgMenu 只管 svg 族 | 应明确不互关 mermaid/plantuml | §2 第 154 行 "只管 svg 族，不互关" | ✓ 已处理 |
| 5. PNG 导出源 + BDD-5 采样 SVG | 确认 DOMPurify 未剥导出属性 + 采样用合法 SVG | §4 第 273 行明确 + 给出采样 SVG 示例 | ✓ 已处理 |
| 6. 可访问性（Esc/aria/焦点） | 非阻塞，记 backlog | 未处理（本就非阻塞，mermaid 亦缺） | — 可接受 |
| 7. 超大 SVG 字节级保护 | 非阻塞，记 backlog | 未处理（mermaid 亦无） | — 可接受 |
| 8. fullscreen 工具栏按钮列举 | "同 mermaid" 可接受 | §3 第 227 行 "对照 MermaidDiagram.vue:16-23" | ✓ 已处理 |

## 是否引入新问题

逐项检查修正过程：

1. **useShiki.ts 加入 xml 是否影响现有高亮**：xml 是新增项，不改现有 commonLangs 项，不改 effectiveLang 回退逻辑（:106-107 保留）。现有语言高亮零影响。xml grammar 与 html grammar 独立，不冲突。**无新问题**。
2. **renderContent 追加 svg flag 清理是否影响 mermaid/plantuml**：追加在现有清理块之后，独立 querySelectorAll('.svg-viewer-mount')，不触碰 mermaid/plantuml mount point。**无新问题**。
3. **renderSvgBlocks 镜像跳过逻辑是否引入竞态**：伪码含 `if myToken !== renderToken: return`（第 195 行），同 plantuml 防竞态。**无新问题**。
4. **[SCOPE+] svg code-mode 走 Shiki 与 mermaid/plantuml 分叉**：设计明确这是为满足 BDD-3 的必要选择，mermaid/plantuml code-mode 不属本任务范围（BDD-10/12 只要求"行为不变"）。分叉合理，不引入回归。**无新问题**。
5. **§6 非 SVG fallback**：rawSvg 空 或 sanitize 后无 `<svg` → 切 code-mode + svg-error 提示 + `dataset.rendered='true'` 防重复。健壮性提升，不引入风险。**无新问题**。
6. **packages/domains/gate_commands 声明**：packages: [frontend-v3]、domains: [frontend, security]、ui_affected: true、gate_commands（P5 vitest/build/vue-tsc + P6 Playwright）齐全。符合 P2 声明字段要求。发版映射说明（frontend-v3 产物进 static/，P8 bump peekview）正确。**无新问题**。

**未发现修正过程引入的新设计缺陷**。

## 评分维度（0-10，本轮）

| 维度 | 上轮 | 本轮 | 说明 |
|------|------|------|------|
| 交互状态覆盖率 | 7 | 9 | 空 SVG fallback + 主题切换重挂载已补；error/edge 完备 |
| AI Slop 风险 | 8 | 9 | 源码行号、伪码、镜像蓝本均具体，留白极少 |
| 移动端考虑 | 7 | 7 | 复用 mermaid onTouch*，未单独展开但可接受 |
| 可访问性 | 4 | 4 | 未补 Esc/aria/焦点（mermaid 亦缺，非阻塞，记 backlog） |

## 通过项确认（本轮保留）

上轮"通过项确认"的 8 项（三管线隔离、DOMPurify 策略、PNG 透明、尺寸回退链、交互委托 data-action、mime.spec 修复、copy 反馈、menu click-outside）本轮均未变动，设计明确"保留不动"（第 30 行）。继续通过。

## 结论

两个 [BLOCKER] 均真正修正：
1. BLOCKER-1：useShiki.ts 已列入改什么，static import xml.mjs + commonLangs 追加 xml 的方案经源码核实有效，effectiveLang 将为 'xml' 非 text，BDD-3 可满足。
2. BLOCKER-2：renderContent flag 清理块追加 .svg-viewer-mount、renderSvgBlocks 镜像 dataset.rendered 跳过逻辑、SvgDiagram onMounted 监听 svg-refresh，三重机制确保主题切换后重挂载 + pan-zoom 重建，BDD-16/BDD-6 可满足。

4 项非 BLOCKER 建议已采纳处理，3 项非阻塞建议（可访问性/超大 SVG/fullscreen 工具栏列举）可接受不处理。未发现修正过程引入的新设计缺陷。

**status: approved**。可进入 P3（TDD 测试）。
