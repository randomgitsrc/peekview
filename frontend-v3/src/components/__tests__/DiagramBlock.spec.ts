import { describe, it, expect } from "vitest"
import { shallowMount } from "@vue/test-utils"
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
    const wrapper = shallowMount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    expect(wrapper.find(".diagram-label").text()).toBe("MERMAID")
  })

  it("renders header with PLANTUML label", () => {
    const wrapper = shallowMount(DiagramBlock, {
      props: { block: makeBlock("plantuml"), theme: "dark" },
    })
    expect(wrapper.find(".diagram-label").text()).toBe("PLANTUML")
  })

  it("renders header with SVG label", () => {
    const wrapper = shallowMount(DiagramBlock, {
      props: { block: makeBlock("svg"), theme: "dark" },
    })
    expect(wrapper.find(".diagram-label").text()).toBe("SVG")
  })

  it("shows toggle button with Diagram text initially", () => {
    const wrapper = shallowMount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    expect(wrapper.find(".toggle-text").text()).toBe("Diagram")
  })

  it("mermaid toggle changes text to Code and back to Diagram", async () => {
    const wrapper = shallowMount(DiagramBlock, {
      props: { block: makeBlock("mermaid"), theme: "dark" },
    })
    await wrapper.find(".diagram-view-toggle").trigger("click")
    expect(wrapper.find(".toggle-text").text()).toBe("Code")
    await wrapper.find(".diagram-view-toggle").trigger("click")
    expect(wrapper.find(".toggle-text").text()).toBe("Diagram")
  })

  it("plantuml toggle does NOT change text", async () => {
    const wrapper = shallowMount(DiagramBlock, {
      props: { block: makeBlock("plantuml"), theme: "dark" },
    })
    await wrapper.find(".diagram-view-toggle").trigger("click")
    expect(wrapper.find(".toggle-text").text()).toBe("Diagram")
  })
})
