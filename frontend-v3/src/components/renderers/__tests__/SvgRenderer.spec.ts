import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { nextTick } from "vue"

const { svgPanZoomMock, panZoomInstance } = vi.hoisted(() => {
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
    svgPanZoomMock: vi.fn(() => instance),
    panZoomInstance: instance,
  }
})

const { sanitizeMock } = vi.hoisted(() => ({
  sanitizeMock: vi.fn(),
}))

vi.mock("dompurify", () => ({
  default: {
    sanitize: sanitizeMock,
  },
}))

vi.mock("svg-pan-zoom", () => ({
  default: svgPanZoomMock,
}))

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({ theme: "dark" }),
}))

import SvgRenderer from "../SvgRenderer.vue"

describe("SvgRenderer", () => {
  beforeEach(() => {
    sanitizeMock.mockReset()
    sanitizeMock.mockImplementation((code: string) => code)
    svgPanZoomMock.mockClear()
    panZoomInstance.zoom.mockClear()
    panZoomInstance.destroy.mockClear()
  })

  it("mounts with required props", () => {
    const wrapper = mount(SvgRenderer, {
      props: { code: "<svg><circle/></svg>", theme: "dark" },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it("exposes openFullscreen/closeFullscreen/refresh/exportPng via defineExpose", () => {
    const wrapper = mount(SvgRenderer, {
      props: { code: "<svg><circle/></svg>", theme: "dark" },
    })
    const exposed = wrapper.vm as any
    expect(typeof exposed.openFullscreen).toBe("function")
    expect(typeof exposed.closeFullscreen).toBe("function")
    expect(typeof exposed.refresh).toBe("function")
    expect(typeof exposed.exportPng).toBe("function")
  })

  it("emits renderError when sanitize returns empty", async () => {
    sanitizeMock.mockReturnValue("")
    const wrapper = mount(SvgRenderer, {
      props: { code: "bad", theme: "dark" },
    })
    await flushPromises()
    await nextTick()
    expect(wrapper.emitted("renderError")).toBeTruthy()
  })

  it("renders SVG content after mount", async () => {
    const wrapper = mount(SvgRenderer, {
      props: { code: "<svg><circle/></svg>", theme: "dark" },
    })
    await flushPromises()
    await nextTick()
    expect(wrapper.find(".diagram-svg-container").exists()).toBe(true)
    expect(wrapper.find(".diagram-svg-container svg").exists()).toBe(true)
  })
})
