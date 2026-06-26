import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MermaidDiagram from '../MermaidDiagram.vue'
import PlantUmlDiagram from '../PlantUmlDiagram.vue'
import SvgDiagram from '../SvgDiagram.vue'

const BaseDiagramStub = {
  template:
    '<div class="bd-stub" ' +
    ':data-prefix="classPrefix" ' +
    ':data-png-bg="pngBackground" ' +
    ':data-touch="touchEnabled" ' +
    ':data-resize="resizeEnabled" ' +
    ':data-brfix="pngBrFix" ' +
    ':data-filename="pngFilenamePrefix" ' +
    ':data-vb="pngViewBoxFallback" ' +
    ':data-size="pngFinalSize.width + \'x\' + pngFinalSize.height" ' +
    ':data-txt-upd="toggleTextUpdates" ' +
    ':data-refresh-toggle="refreshOnToggle" ' +
    ':data-copy-fb="copyFeedback" ' +
    ':data-menu-co="menuClickOutside" ' +
    ':data-menu-cl="menuCloseOthers" ' +
    ':data-label="label" ' +
    ':data-modal="modalTitle" ' +
    ':data-refresh-evt="refreshEventName" ' +
    ':data-pz-init-trycatch="panZoomInitTryCatch" ' +
    ':data-pz-min="panZoomMinZoom" ' +
    ':data-pz-max="panZoomMaxZoom" ' +
    ':data-svg="svgContent" ' +
    ':data-cv="codeViewHtml" ' +
    '/>',
  props: [
    'classPrefix',
    'pngBackground',
    'touchEnabled',
    'resizeEnabled',
    'pngBrFix',
    'pngFilenamePrefix',
    'pngViewBoxFallback',
    'pngFinalSize',
    'svgContent',
    'codeViewHtml',
    'blockId',
    'blockIndex',
    'theme',
    'panZoomMinZoom',
    'panZoomMaxZoom',
    'panZoomInitTryCatch',
    'refreshEventName',
    'modalTitle',
    'toggleTextUpdates',
    'refreshOnToggle',
    'copyFeedback',
    'menuClickOutside',
    'menuCloseOthers',
    'label',
  ],
}

const baseProps = { blockIndex: 0, blockId: 'm-0', svgContent: '', codeViewHtml: '', theme: 'light' as const }
function mountMermaid(overrides = {}) {
  return mount(MermaidDiagram, {
    props: { ...baseProps, ...overrides },
    global: { stubs: { BaseDiagram: BaseDiagramStub } },
  })
}
function mountPlantuml(overrides = {}) {
  return mount(PlantUmlDiagram, {
    props: { ...baseProps, ...overrides },
    global: { stubs: { BaseDiagram: BaseDiagramStub } },
  })
}
function mountSvg(overrides = {}) {
  return mount(SvgDiagram, {
    props: { ...baseProps, ...overrides },
    global: { stubs: { BaseDiagram: BaseDiagramStub } },
  })
}

describe('thin-wrappers', () => {
  describe('MermaidDiagram', () => {
    it('4.1 Mermaid baseProps: brFix=true / viewBox=g-root / filename=mermaid-diagram', () => {
      const w = mountMermaid()
      const a = w.find('.bd-stub').attributes()
      expect(a['data-brfix']).toBe('true')
      expect(a['data-vb']).toBe('g-root-getBBox')
      expect(a['data-filename']).toBe('mermaid-diagram')
    })

    it('4.2 Mermaid pngBackground=#ffffff / 800x600 / touch=true / resize=true', () => {
      const w = mountMermaid()
      const a = w.find('.bd-stub').attributes()
      expect(a['data-png-bg']).toBe('#ffffff')
      expect(a['data-size']).toBe('800x600')
      expect(a['data-touch']).toBe('true')
      expect(a['data-resize']).toBe('true')
    })

    it('4.3 Mermaid defineExpose has 8 items', () => {
      const w = mountMermaid()
      const vm: any = w.vm
      // script setup: defineExpose keys become direct properties on vm (not nested under .exposed)
      const exposedKeys = (vm.exposed && Object.keys(vm.exposed).length > 0)
        ? Object.keys(vm.exposed)
        : Object.keys(vm).filter(k => ['zoomIn','zoomOut','resetZoom','toggleFullscreen','refreshPanZoom','getSvgElement','downloadPng','exportMermaidToPng'].includes(k))
      const keys = exposedKeys.sort()
      expect(keys).toEqual(
        [
          'zoomIn',
          'zoomOut',
          'resetZoom',
          'toggleFullscreen',
          'refreshPanZoom',
          'getSvgElement',
          'downloadPng',
          'exportMermaidToPng',
        ].sort(),
      )
    })

    it('4.4 Mermaid declares 5 emits', () => {
const w = mountMermaid()
    void w
    const componentEmits = (MermaidDiagram as any).emits
      const declared = Array.isArray(componentEmits)
        ? componentEmits
        : Object.keys(componentEmits ?? {})
      const expected = ['zoom-in', 'zoom-out', 'reset', 'fullscreen', 'download-png']
      for (const e of expected) {
        expect(declared).toContain(e)
      }
    })
  })

  describe('PlantUmlDiagram', () => {
    it('4.5 PlantUml touchEnabled=false / resizeEnabled=false', () => {
      const w = mountPlantuml()
      const a = w.find('.bd-stub').attributes()
      expect(a['data-touch']).toBe('false')
      expect(a['data-resize']).toBe('false')
    })

    it('4.6 PlantUml no refresh / no toggle-text / no Copied', () => {
      const w = mountPlantuml()
      const a = w.find('.bd-stub').attributes()
      expect(a['data-refresh-toggle']).toBe('false')
      expect(a['data-txt-upd']).toBe('false')
      expect(a['data-copy-fb']).toBe('false')
    })

    it('4.7 PlantUml defineExpose has 8 items including exportPlantUmlToPng', () => {
      const w = mountPlantuml()
      const vm: any = w.vm
      const exposedKeys = (vm.exposed && Object.keys(vm.exposed).length > 0)
        ? Object.keys(vm.exposed)
        : Object.keys(vm).filter(k => ['zoomIn','zoomOut','resetZoom','toggleFullscreen','refreshPanZoom','getSvgElement','downloadPng','exportPlantUmlToPng'].includes(k))
      const keys = exposedKeys.sort()
      expect(keys).toEqual(
        [
          'zoomIn',
          'zoomOut',
          'resetZoom',
          'toggleFullscreen',
          'refreshPanZoom',
          'getSvgElement',
          'downloadPng',
          'exportPlantUmlToPng',
        ].sort(),
      )
    })

    it('4.8 PlantUml declares no emits (faithful P1 I2)', () => {
      const componentEmits = (PlantUmlDiagram as any).emits
      const declared: string[] = Array.isArray(componentEmits)
        ? componentEmits
        : Object.keys(componentEmits ?? {})
      expect(declared).toEqual([])
    })
  })

  describe('SvgDiagram', () => {
    it('4.9 Svg pngBackground=transparent / 400x300 / brFix=false', () => {
      const w = mountSvg()
      const a = w.find('.bd-stub').attributes()
      expect(a['data-png-bg']).toBe('transparent')
      expect(a['data-size']).toBe('400x300')
      expect(a['data-brfix']).toBe('false')
    })

    it('4.10 Svg panZoomInitTryCatch=true', () => {
      const w = mountSvg()
      const a = w.find('.bd-stub').attributes()
      expect(a['data-pz-init-trycatch']).toBe('true')
    })

    it('4.11 Svg defineExpose has only 3 items (no zoomIn/zoomOut/resetZoom/getSvgElement/exportSvgToPng)', () => {
      const w = mountSvg()
      const vm: any = w.vm
      const exposedKeys = (vm.exposed && Object.keys(vm.exposed).length > 0)
        ? Object.keys(vm.exposed)
        : Object.keys(vm).filter(k => ['zoomIn','zoomOut','resetZoom','toggleFullscreen','refreshPanZoom','getSvgElement','downloadPng','exportSvgToPng'].includes(k))
      const keys = exposedKeys.sort()
      expect(keys).toEqual(['toggleFullscreen', 'downloadPng', 'refreshPanZoom'].sort())
      expect(keys).not.toContain('zoomIn')
      expect(keys).not.toContain('zoomOut')
      expect(keys).not.toContain('resetZoom')
      expect(keys).not.toContain('getSvgElement')
    })
  })
})