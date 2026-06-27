import { describe, it, expect } from "vitest"
import { useMarkdown } from "../useMarkdown"

describe("useMarkdown blocks structure", () => {
  const { render } = useMarkdown()

  it("pure text generates single html block", async () => {
    const result = await render("Hello world", "github-light")
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe("html")
  })

  it("mermaid code block generates diagram block", async () => {
    const md = "```mermaid\ngraph TD\nA-->B\n```"
    const result = await render(md, "github-light")
    const d = result.blocks.find(b => b.type === "diagram")
    expect(d).toBeDefined()
    if (d && d.type === "diagram") {
      expect(d.lang).toBe("mermaid")
      expect(d.code).toContain("graph TD")
      expect(d.codeViewHtml).toContain("<pre")
    }
  })

  it("plantuml code block generates diagram block", async () => {
    const md = "```plantuml\n@startuml\nA -> B\n@enduml\n```"
    const result = await render(md, "github-light")
    const d = result.blocks.find(b => b.type === "diagram")
    expect(d).toBeDefined()
    if (d && d.type === "diagram") expect(d.lang).toBe("plantuml")
  })

  it("svg code block generates diagram block with xml highlighting", async () => {
    const md = "```svg\n<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"40\"/></svg>\n```"
    const result = await render(md, "github-light")
    const d = result.blocks.find(b => b.type === "diagram")
    expect(d).toBeDefined()
    if (d && d.type === "diagram") {
      expect(d.lang).toBe("svg")
      expect(d.codeViewHtml).toContain("class=\"shiki")
    }
  })

  it("html+diagram interleaving maintains document order", async () => {
    const md = "Before\n\n```mermaid\ngraph TD\nA-->B\n```\n\nAfter"
    const result = await render(md, "github-light")
    const types = result.blocks.map(b => b.type)
    expect(types).toContain("html")
    expect(types).toContain("diagram")
  })

  it("multiple diagram blocks are independent", async () => {
    const md = "```mermaid\ngraph TD\nA-->B\n```\n\n```plantuml\n@startuml\nA -> B\n@enduml\n```"
    const result = await render(md, "github-light")
    expect(result.blocks.filter(b => b.type === "diagram")).toHaveLength(2)
  })

  it("compat fields are empty maps (removed in Task 7)", async () => {
    const md = "```mermaid\ngraph TD\nA-->B\n```"
    const result = await render(md, "github-light")
    expect((result as any).mermaidSources.size).toBe(0)
    expect((result as any).plantumlSources.size).toBe(0)
    expect((result as any).svgSources.size).toBe(0)
  })
})
