# P3 补充测试 dispatch-context — T022

## 重要：BaseDiagram 实际结构 vs P3a 计划的差异

P3a 计划假设按钮在 BaseDiagram template 里（emit 事件）。**实际实现**：按钮在 useMarkdown 生成的 HTML 字符串里（data-action 协议），由 MarkdownViewer 事件委托处理。BaseDiagram template 只有 viewer + modal overlay。

**调整策略**：
- 3.1-3.3（svgContent/codeViewHtml/classPrefix 渲染）：可测（BaseDiagram template 有这些）
- 3.4-3.9（emit 按钮）：**跳过**（按钮不在 BaseDiagram 里，在 HTML 字符串里。事件委托由 MarkdownViewer 处理，已由 e2e 覆盖）
- 3.10-3.11（resizeEnabled/touchEnabled 差异）：可测
- 3.12-3.14（modal toggle/close）：可测

## BaseDiagram 可测的 props（实际 template 渲染的）

BaseDiagram template 渲染：
```html
<div ref="containerRef" :class="classPrefix + '-viewer'" @wheel="onWheel">
  <div ref="svgContainer" :class="classPrefix + '-container'" v-html="svgContent"></div>
</div>
<Teleport to="body">
  <div v-if="isFullscreen" :class="classPrefix + '-modal-overlay'" @click.self="closeFullscreen">
    <div :class="classPrefix + '-modal'">
      <div :class="classPrefix + '-modal-toolbar'">
        <span class="modal-title">{{ modalTitle }}</span>
        <button class="toolbar-btn" @click="zoomInModal">+</button>
        ...
        <button class="toolbar-btn close-btn" @click="closeFullscreen">×</button>
      </div>
      <div ref="modalContainer" :class="classPrefix + '-modal-container'">
        <div ref="modalSvgWrapper" :class="classPrefix + '-wrapper'" v-html="svgContent"></div>
      </div>
    </div>
  </div>
</Teleport>
```

## 三薄包装实际结构（可测的差异 props）

薄包装通过 `baseProps` computed + `v-bind` 传给 BaseDiagram。可通过 stub BaseDiagram 后检查 data-* 属性验证差异。

## 快照测试策略

useMarkdown.render() 返回 `sources` Map。可对 `result.html` 做快照（字符级一致）。
- mermaid block HTML 含 `.mermaid-block` + header + content + viewer-mount
- svg block HTML 含 `.svg-block` + header
- 非围栏 code block 走默认 Shiki 高亮

## 错误处理测试策略

- preRender error 标记：mock useMermaid.render 抛错，检查 sourcesMap 的 error 字段
- mount 阶段错误 UI：需要 mount MarkdownViewer（较重），或直接测 useCodeBlockRenderer 的 error getter
