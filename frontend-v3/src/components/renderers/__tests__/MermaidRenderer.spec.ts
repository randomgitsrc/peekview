import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { nextTick } from "vue"

const { mockRender, svgPanZoomMock, panZoomInstance } = vi.hoisted(() => {
  const instance = {
    zoom: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    reset: vi.fn(),
    center: vi.fn(),
    fit: vi.fn(),
    resize: vi.fn(),
    panBy: vi.fn(),
    getZoom: vi.fn(() => 1),
    destroy: vi.fn(),
  }
  return {
    mockRender: vi.fn(),
    svgPanZoomMock: vi.fn(() => instance),
    panZoomInstance: instance,
  }
})

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg><circle/></svg>" }),
  },
}))

vi.mock("@/composables/useMermaid", () => ({
  useMermaid: () => ({ render: mockRender }),
}))

vi.mock("svg-pan-zoom", () => ({
  default: svgPanZoomMock,
}))

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({ theme: "dark" }),
}))

import MermaidRenderer from "../MermaidRenderer.vue"

describe("MermaidRenderer", () => {
  beforeEach(() => {
    mockRender.mockReset()
    mockRender.mockResolvedValue("<svg><circle/></svg>")
    svgPanZoomMock.mockClear()
    panZoomInstance.zoom.mockClear()
    panZoomInstance.destroy.mockClear()
  })

  it("mounts with required props", () => {
    const wrapper = mount(MermaidRenderer, {
      props: { code: "graph TD; A-->B", theme: "dark" },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it("exposes openFullscreen/closeFullscreen/refresh/exportPng/downloadPng via defineExpose", () => {
    const wrapper = mount(MermaidRenderer, {
      props: { code: "graph TD; A-->B", theme: "dark" },
    })
    const exposed = wrapper.vm as any
    expect(typeof exposed.openFullscreen).toBe("function")
    expect(typeof exposed.closeFullscreen).toBe("function")
    expect(typeof exposed.refresh).toBe("function")
    expect(typeof exposed.exportPng).toBe("function")
    expect(typeof exposed.downloadPng).toBe("function")
  })

  it("emits renderError when render fails", async () => {
    mockRender.mockRejectedValueOnce(new Error("render failed"))
    const wrapper = mount(MermaidRenderer, {
      props: { code: "bad code", theme: "dark" },
    })
    await flushPromises()
    await nextTick()
    await flushPromises()
    expect(wrapper.emitted("renderError")).toBeTruthy()
  })

  it("renders SVG content after mount", async () => {
    const wrapper = mount(MermaidRenderer, {
      props: { code: "graph TD; A-->B", theme: "dark" },
    })
    await flushPromises()
    await nextTick()
    await flushPromises()
    expect(wrapper.find(".diagram-svg-container").exists()).toBe(true)
    expect(wrapper.find(".diagram-svg-container svg").exists()).toBe(true)
  })
})
