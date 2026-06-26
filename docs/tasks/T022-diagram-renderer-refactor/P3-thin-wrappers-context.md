---
phase: P3
task_id: T022-diagram-renderer-refactor
type: dispatch-context
parent: P3-test-cases.md
trace_id: T022-P3-thin-wrappers-20260626
created: 2026-06-26
---

# thin-wrappers.spec.ts 测试上下文

## 任务
写 `frontend-v3/src/components/diagrams/__tests__/thin-wrappers.spec.ts`（12 测试点）

## 输入（只读这 2 个文件）
1. `/home/kity/oclab/peekview/docs/tasks/T022-diagram-renderer-refactor/P3-test-cases.md` — 读第 2 节"文件 4"测试点表（12 行）
2. 已实现的薄包装：`frontend-v3/src/components/diagrams/{Mermaid,PlantUml,Svg}Diagram.vue`

## 关键约束（基于实际实现）

### Mermaid/PlantUml/Svg 都是 BaseDiagram 的薄包装
薄包装模式：
- `defineProps<{ blockIndex, blockId, svgContent?, codeViewHtml?, theme }>()`
- `defineEmits<{...}>` （Mermaid 有 5 emit，PlantUml/Svg 无 emit）
- `baseProps` computed 包含 mermaid/plantuml/svg 差异（pngBackground/panZoomMaxZoom/touchEnabled/resizeEnabled/label 等）
- `template` 是 `<BaseDiagram ref="baseRef" v-bind="baseProps" v-on="$attrs" />`

### 测试策略：stub BaseDiagram，检查 data-* 属性
stub BaseDiagram 让其渲染 `data-*` 属性，可通过 `wrapper.find('.bd-stub').attributes()` 验证薄包装传的 props：

```typescript
const BaseDiagramStub = {
  template: `<div class="bd-stub" :data-prefix="classPrefix" :data-png-bg="pngBackground" :data-touch="touchEnabled" :data-resize="resizeEnabled" :data-brfix="pngBrFix" :data-filename="pngFilenamePrefix" :data-vb="pngViewBoxFallback" :data-size="pngFinalSize.width + 'x' + pngFinalSize.height" :data-touch-zoom="touchEnabled" :data-txt-upd="toggleTextUpdates" :data-refresh-toggle="refreshOnToggle" :data-copy-fb="copyFeedback" :data-menu-co="menuClickOutside" :data-menu-cl="menuCloseOthers" :data-label="label" :data-modal="modalTitle" :data-refresh-evt="refreshEventName" />`,
  props: ['classPrefix','pngBackground','touchEnabled','resizeEnabled','pngBrFix','pngFilenamePrefix','pngViewBoxFallback','pngFinalSize','svgContent','codeViewHtml','blockId','blockIndex','theme','panZoomMinZoom','panZoomMaxZoom','panZoomInitTryCatch','refreshEventName','modalTitle','toggleTextUpdates','refreshOnToggle','copyFeedback','menuClickOutside','menuCloseOthers','label'],
}
```

### 12 个测试点（按 P3a 文件 4 表）

| # | 测什么 | 断言 |
|---|--------|------|
| 4.1 | Mermaid baseProps：brFix=true/viewBox=g-root/filename=mermaid-diagram | mount MermaidDiagram，stub BaseDiagram → `.bd-stub` data-brfix=true data-vb='g-root-getBBox' data-filename='mermaid-diagram' |
| 4.2 | Mermaid pngBackground=#ffffff/800×600/touch=true/resize=true | data-png-bg='#ffffff' data-size='800x600' data-touch=true data-resize=true |
| 4.3 | Mermaid defineExpose 8 项 | vm.exposed 包含 zoomIn/zoomOut/resetZoom/toggleFullscreen/refreshPanZoom/getSvgElement/downloadPng/exportMermaidToPng |
| 4.4 | Mermaid 声明 5 emit | component.emits 包含 'zoom-in','zoom-out','reset','fullscreen','download-png' |
| 4.5 | PlantUml touchEnabled=false/resizeEnabled=false | data-touch=false data-resize=false |
| 4.6 | PlantUml 无 refresh/无 toggle-text/无 Copied | data-refresh-toggle=false data-txt-upd=false data-copy-fb=false |
| 4.7 | PlantUml defineExpose 8 项含 exportPlantUmlToPng | vm.exposed 含 zoomIn/zoomOut/resetZoom/toggleFullscreen/refreshPanZoom/getSvgElement/downloadPng/exportPlantUmlToPng |
| 4.8 | PlantUml 无 emit 声明 | component.emits 为空（保真 P1 I2）|
| 4.9 | Svg pngBackground=transparent/400×300/brFix=false | data-png-bg='transparent' data-size='400x300' data-brfix=false |
| 4.10 | Svg panZoomInitTryCatch=true | 检查 SvgDiagram 实现有此 prop 设置 true |
| 4.11 | Svg defineExpose 仅 3 项 | vm.exposed 含 toggleFullscreen/downloadPng/refreshPanZoom（无 zoomIn/zoomOut/resetZoom/getSvgElement/exportSvgToPng 等）|
| 4.12 | 三薄包装按 blockIndex 查 sourcesMap | mount 时 blockIndex=0 + svgContent 空字符串 → computed 调 renderer.getMermaidSvgByIndex(0) 等 |

## mount 骨架
```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MermaidDiagram from '../MermaidDiagram.vue'
import PlantUmlDiagram from '../PlantUmlDiagram.vue'
import SvgDiagram from '../SvgDiagram.vue'

const BaseDiagramStub = {
  template: '<div class="bd-stub" :data-prefix="classPrefix" :data-png-bg="pngBackground" :data-touch="touchEnabled" :data-resize="resizeEnabled" :data-brfix="pngBrFix" :data-filename="pngFilenamePrefix" :data-vb="pngViewBoxFallback" :data-size="pngFinalSize.width + \'x\' + pngFinalSize.height" :data-txt-upd="toggleTextUpdates" :data-refresh-toggle="refreshOnToggle" :data-copy-fb="copyFeedback" :data-menu-co="menuClickOutside" :data-menu-cl="menuCloseOthers" :data-label="label" :data-modal="modalTitle" :data-refresh-evt="refreshEventName" />',
  props: ['classPrefix','pngBackground','touchEnabled','resizeEnabled','pngBrFix','pngFilenamePrefix','pngViewBoxFallback','pngFinalSize','svgContent','codeViewHtml','blockId','blockIndex','theme','panZoomMinZoom','panZoomMaxZoom','panZoomInitTryCatch','refreshEventName','modalTitle','toggleTextUpdates','refreshOnToggle','copyFeedback','menuClickOutside','menuCloseOthers','label'],
}

const baseProps = { blockIndex: 0, blockId: 'm-0', svgContent: '', codeViewHtml: '', theme: 'light' as const }
function mountMermaid(overrides = {}) {
  return mount(MermaidDiagram, { props: { ...baseProps, ...overrides }, global: { stubs: { BaseDiagram: BaseDiagramStub } } })
}
function mountPlantuml(overrides = {}) {
  return mount(PlantUmlDiagram, { props: { ...baseProps, ...overrides }, global: { stubs: { BaseDiagram: BaseDiagramStub } } })
}
function mountSvg(overrides = {}) {
  return mount(SvgDiagram, { props: { ...baseProps, ...overrides }, global: { stubs: { BaseDiagram: BaseDiagramStub } } })
}
```

## 返回
只返回两行：1. 文件路径 2. 一句话摘要（12 测试点，X passed / Y failed）