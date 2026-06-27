import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { nextTick } from "vue"

const { mockEnsureLoaded, mockRender, svgPanZoomMock, panZoomInstance } = vi.hoisted(() => {
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
    mockEnsureLoaded: vi.fn().mockResolvedValue(undefined),
    mockRender: vi.fn(),
    svgPanZoomMock: vi.fn(() => instance),
    panZoomInstance: instance,
  }
})

vi.mock("@/composables/usePlantUML", () => ({
  ensureLoaded: mockEnsureLoaded,
  render: mockRender,
}))

vi.mock("svg-pan-zoom", () => ({
  default: svgPanZoomMock,
}))

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({ theme: "dark" }),
}))

import PlantUmlRenderer from "../PlantUmlRenderer.vue"

describe("PlantUmlRenderer", () => {
  beforeEach(() => {
    mockRender.mockReset()
    mockRender.mockResolvedValue("<svg><circle/></svg>")
    mockEnsureLoaded.mockReset()
    mockEnsureLoaded.mockResolvedValue(undefined)
    svgPanZoomMock.mockClear()
    panZoomInstance.zoom.mockClear()
    panZoomInstance.destroy.mockClear()
  })

  it("mounts with required props", () => {
    const wrapper = mount(PlantUmlRenderer, {
      props: { code: "@startuml\nA-->B\n@enduml", theme: "dark" },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it("exposes openFullscreen/closeFullscreen/refresh/exportPng/downloadPng via defineExpose", () => {
    const wrapper = mount(PlantUmlRenderer, {
      props: { code: "@startuml\nA-->B\n@enduml", theme: "dark" },
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
    const wrapper = mount(PlantUmlRenderer, {
      props: { code: "bad code", theme: "dark" },
    })
    await flushPromises()
    await nextTick()
    await flushPromises()
    expect(wrapper.emitted("renderError")).toBeTruthy()
  })

  it("renders SVG content after mount", async () => {
    const wrapper = mount(PlantUmlRenderer, {
      props: { code: "@startuml\nA-->B\n@enduml", theme: "dark" },
    })
    await flushPromises()
    await nextTick()
    await flushPromises()
    expect(wrapper.find(".diagram-svg-container").exists()).toBe(true)
    expect(wrapper.find(".diagram-svg-container svg").exists()).toBe(true)
  })
})
