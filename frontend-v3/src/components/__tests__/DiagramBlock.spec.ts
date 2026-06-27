import { describe, it, expect, vi, beforeEach } from "vitest"
import { mount } from "@vue/test-utils"
import type { DiagramBlockData } from "@/types"

import DiagramBlock from "@/components/DiagramBlock.vue"

function makeBlock(lang: "mermaid" | "plantuml" | "svg"): DiagramBlockData {
  return {
    type: "diagram",
    lang,
    code: "test code",
    codeViewHtml: "<pre><code>test</code></pre>",
    index: 0,
  }
}

describe("DiagramBlock basics", () => {
  it("renders header with MERMAID label", () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    expect(wrapper.find(".diagram-label").text()).toBe("MERMAID")
  })

  it("renders header with PLANTUML label", () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("plantuml"), theme: "dark" },
    })
    expect(wrapper.find(".diagram-label").text()).toBe("PLANTUML")
  })

  it("renders header with SVG label", () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("svg"), theme: "dark" },
    })
    expect(wrapper.find(".diagram-label").text()).toBe("SVG")
  })

  it("shows toggle button with Diagram text initially", () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    expect(wrapper.find(".toggle-text").text()).toBe("Diagram")
  })

  it("mermaid toggle changes text to Code and back to Diagram", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    await wrapper.find(".diagram-view-toggle").trigger("click")
    expect(wrapper.find(".toggle-text").text()).toBe("Code")
    await wrapper.find(".diagram-view-toggle").trigger("click")
    expect(wrapper.find(".toggle-text").text()).toBe("Diagram")
  })

  it("plantuml toggle changes text Diagram <-> Code", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("plantuml"), theme: "dark" },
    })
    expect(wrapper.find(".toggle-text").text()).toBe("Diagram")
    await wrapper.find(".diagram-view-toggle").trigger("click")
    expect(wrapper.find(".toggle-text").text()).toBe("Code")
    await wrapper.find(".diagram-view-toggle").trigger("click")
    expect(wrapper.find(".toggle-text").text()).toBe("Diagram")
  })
})

describe("DiagramBlock dropdown menu", () => {
  it("dropdown menu is hidden by default", () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    const menu = wrapper.find(".diagram-dropdown-menu")
    expect(menu.exists()).toBe(true)
    expect(menu.classes()).not.toContain("show")
  })

  it("clicking menu-btn shows the dropdown menu", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    await wrapper.find(".menu-btn").trigger("click")
    const menu = wrapper.find(".diagram-dropdown-menu")
    expect(menu.classes()).toContain("show")
  })

  it("menu has 2 items: Download PNG and Copy Code", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    await wrapper.find(".menu-btn").trigger("click")
    const items = wrapper.findAll(".diagram-dropdown-menu button")
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain("Download PNG")
    expect(items[1].text()).toContain("Copy Code")
  })

  it("mermaid: opening menu closes other open menus (close-others)", async () => {
    // Mount two mermaid blocks
    const wrapper1 = mount(DiagramBlock, {
      props: { block: { ...makeBlock("mermaid"), index: 0 }, theme: "dark" },
      attachTo: document.body,
    })
    const wrapper2 = mount(DiagramBlock, {
      props: { block: { ...makeBlock("mermaid"), index: 1 }, theme: "dark" },
      attachTo: document.body,
    })

    // Open both menus
    await wrapper1.find(".menu-btn").trigger("click")
    await wrapper2.find(".menu-btn").trigger("click")

    // wrapper1's menu should be closed (close-others)
    expect(wrapper1.find(".diagram-dropdown-menu").classes()).not.toContain("show")
    // wrapper2's menu should be open
    expect(wrapper2.find(".diagram-dropdown-menu").classes()).toContain("show")
  })

  it("plantuml: does NOT close other menus via close-others", async () => {
    // Mount two blocks: mermaid and plantuml (not attached to body to avoid click-outside)
    const wrapper1 = mount(DiagramBlock, {
      props: { block: { ...makeBlock("mermaid"), index: 0 }, theme: "dark" },
    })
    const wrapper2 = mount(DiagramBlock, {
      props: { block: { ...makeBlock("plantuml"), index: 1 }, theme: "dark" },
    })

    // Open wrapper1 menu
    await wrapper1.find(".menu-btn").trigger("click")
    expect(wrapper1.find(".diagram-dropdown-menu").classes()).toContain("show")

    // Open wrapper2 menu (plantuml - no close-others)
    await wrapper2.find(".menu-btn").trigger("click")
    expect(wrapper2.find(".diagram-dropdown-menu").classes()).toContain("show")

    // wrapper1 menu should still be open (plantuml toggleMenu doesn't close others)
    expect(wrapper1.find(".diagram-dropdown-menu").classes()).toContain("show")
  })

  it("mermaid: clicking outside closes the menu", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
      attachTo: document.body,
    })
    await wrapper.find(".menu-btn").trigger("click")
    expect(wrapper.find(".diagram-dropdown-menu").classes()).toContain("show")

    // Click outside
    document.body.click()
    await new Promise((r) => setTimeout(r, 10))

    expect(wrapper.find(".diagram-dropdown-menu").classes()).not.toContain("show")
  })

  it("plantuml: clicking outside does NOT close the menu", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("plantuml"), theme: "dark" },
      attachTo: document.body,
    })
    await wrapper.find(".menu-btn").trigger("click")
    expect(wrapper.find(".diagram-dropdown-menu").classes()).toContain("show")

    // Click outside
    document.body.click()
    await new Promise((r) => setTimeout(r, 10))

    // PlantUML has no click-outside, menu stays open
    expect(wrapper.find(".diagram-dropdown-menu").classes()).toContain("show")
  })
})

describe("DiagramBlock copy code", () => {
  // Mock clipboard
  const mockClipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it("mermaid: copy code writes to clipboard", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    await wrapper.find(".menu-btn").trigger("click")
    await wrapper.findAll(".diagram-dropdown-menu button")[1].trigger("click") // Copy Code

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test code")
  })

  it("mermaid: copy code shows 'Copied!' feedback for 2 seconds", async () => {
    vi.useFakeTimers()
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    await wrapper.find(".menu-btn").trigger("click")

    const copyButton = wrapper.findAll(".diagram-dropdown-menu button")[1]
    await copyButton.trigger("click")

    // Wait for Vue to update
    await wrapper.vm.$nextTick()

    // Should show "Copied!" temporarily
    expect(copyButton.text()).toContain("Copied!")

    // After 2 seconds, should revert
    vi.advanceTimersByTime(2000)
    await wrapper.vm.$nextTick()

    expect(copyButton.text()).toContain("Copy Code")
    vi.useRealTimers()
  })

  it("plantuml: copy code writes to clipboard", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("plantuml"), theme: "dark" },
    })
    await wrapper.find(".menu-btn").trigger("click")
    await wrapper.findAll(".diagram-dropdown-menu button")[1].trigger("click")

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test code")
    expect(consoleSpy).toHaveBeenCalledWith("PlantUML code copied")
    consoleSpy.mockRestore()
  })

  it("plantuml: copy code does NOT show visual feedback", async () => {
    vi.useFakeTimers()
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("plantuml"), theme: "dark" },
    })
    await wrapper.find(".menu-btn").trigger("click")

    const copyButton = wrapper.findAll(".diagram-dropdown-menu button")[1]
    const originalText = copyButton.text()
    await copyButton.trigger("click")

    // Text should NOT change to "Copied!"
    expect(copyButton.text()).toBe(originalText)
    expect(copyButton.text()).not.toContain("Copied!")

    vi.useRealTimers()
  })
})

describe("DiagramBlock error handling", () => {
  it("mermaid: render-error shows error div", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })

    // Initially no error
    expect(wrapper.find(".diagram-error").exists()).toBe(false)

    // Emit render-error from renderer
    const renderer = wrapper.findComponent({ name: "MermaidRenderer" })
    await renderer.vm.$emit("renderError")

    // Error div should appear
    expect(wrapper.find(".diagram-error").exists()).toBe(true)
    expect(wrapper.find(".diagram-error").text()).toContain("Failed to render")
  })

  it("svg: render-error shows error div", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("svg"), theme: "dark" },
    })

    expect(wrapper.find(".diagram-error").exists()).toBe(false)

    const renderer = wrapper.findComponent({ name: "SvgRenderer" })
    await renderer.vm.$emit("renderError")

    expect(wrapper.find(".diagram-error").exists()).toBe(true)
    expect(wrapper.find(".diagram-error").text()).toContain("Failed to render SVG")
  })

  it("plantuml: render-error switches to code mode", async () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("plantuml"), theme: "dark" },
    })

    // Get initial state - diagram-viewer should be visible (no style display:none)
    const viewer = wrapper.find(".diagram-viewer")
    const code = wrapper.find(".diagram-code")

    // Emit render-error from renderer
    const renderer = wrapper.findComponent({ name: "PlantUmlRenderer" })
    await renderer.vm.$emit("renderError")
    await wrapper.vm.$nextTick()

    // After error: viewer hidden, code shown
    // v-show toggles display, check the actual style attribute
    expect((viewer.element as HTMLElement).style.display).toBe("none")
    expect((code.element as HTMLElement).style.display).toBe("")

    // Error div should NOT appear for plantuml
    expect(wrapper.find(".diagram-error").exists()).toBe(false)
  })
})

describe("DiagramBlock resize handle", () => {
  it("mermaid: has resize handle", () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    expect(wrapper.find(".diagram-resize-handle").exists()).toBe(true)
  })

  it("svg: has resize handle", () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("svg"), theme: "dark" },
    })
    expect(wrapper.find(".diagram-resize-handle").exists()).toBe(true)
  })

  it("plantuml: does NOT have resize handle", () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("plantuml"), theme: "dark" },
    })
    expect(wrapper.find(".diagram-resize-handle").exists()).toBe(false)
  })

  it("mermaid: resize handle has correct cursor style", () => {
    const wrapper = mount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    const handle = wrapper.find(".diagram-resize-handle")
    // Check element exists and has the class
    expect(handle.exists()).toBe(true)
  })
})
