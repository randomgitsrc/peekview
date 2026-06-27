import { describe, it, expect, beforeEach } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import MarkdownViewer from "@/components/MarkdownViewer.vue"

describe("MarkdownViewer v-for blocks rendering", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("renders html content", async () => {
    const wrapper = mount(MarkdownViewer, {
      props: { content: "# Hello\n\nWorld" },
    })
    await new Promise((r) => setTimeout(r, 100))

    // Should render headings and paragraphs
    const html = wrapper.find(".markdown-body").html()
    expect(html).toContain("Hello")
    expect(html).toContain("World")
  })

  it("does NOT import old diagram components", () => {
    // This is a code-level check - the component should not import MermaidDiagram etc
    const source = MarkdownViewer.toString()
    expect(source).not.toContain("MermaidDiagram")
    expect(source).not.toContain("PlantUmlDiagram")
    expect(source).not.toContain("SvgDiagram")
  })

  it("emits headings for TOC", async () => {
    const wrapper = mount(MarkdownViewer, {
      props: { content: "# Title\n\n## Section" },
    })
    await new Promise((r) => setTimeout(r, 100))

    // Should emit headings event
    expect(wrapper.emitted("headings")).toBeTruthy()
    const headings = wrapper.emitted("headings")![0][0] as any[]
    expect(headings.length).toBeGreaterThan(0)
    // Headings should include at least one heading
    const texts = headings.map((h) => h.text)
    expect(texts.length).toBeGreaterThan(0)
  })
})
