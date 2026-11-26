/**
 * TPV0104 — Markdown 标题与目录单一来源（BDD-01 ~ BDD-05 的 vitest 层）
 *
 * 取证通道（P2-design.md D1）：`useMarkdown().render()` 返回值的 `headings` 数组 ——
 * 这是「从 render 返回值到 TOC 的单一数据通路」的出口。
 * ⚠️ **不得**消费 `result.html`：`useMarkdown.ts:480` 是唯一 return 点且 `html` 恒为空串
 * （真实 HTML 全在 `blocks[]`），照字面取会退化成「断言空串」而静默失去区分力。
 * DOM 级的锚点/去重/文本断言在 E2E 层（`tpv0104-viewer-hardening.spec.ts`）。
 *
 * ⚠️ `blocks[]` 的 html 已被 DOMPurify 处理后再进入组件，故本层只断言 headings 结构。
 */

import { describe, it, expect } from 'vitest'
import { useMarkdown } from '../useMarkdown'

const THEME = 'github-light' as const

async function headingsOf(markdown: string) {
  const { render } = useMarkdown()
  const result = await render(markdown, THEME)
  return result.headings
}

describe('TPV0104 BDD-01 重复同名标题在数据源侧去重', () => {
  it('test_bdd_01_three_identical_headings_produce_distinct_ids', async () => {
    const md = '## 中文标题\n\n正文一\n\n## 中文标题\n\n正文二\n\n## 中文标题\n'
    const headings = await headingsOf(md)
    expect(headings).toHaveLength(3)
    const ids = headings.map(h => h.id)
    ids.forEach(id => expect(id.length).toBeGreaterThan(0))
    expect(new Set(ids).size).toBe(3)
  })
})

describe('TPV0104 BDD-02 围栏内标题不进目录', () => {
  it('test_bdd_02_fenced_heading_excluded_real_heading_kept', async () => {
    const md = ['## 真实标题', '', '```md', '## 示例', '```'].join('\n')
    const headings = await headingsOf(md)
    const texts = headings.map(h => h.text)
    expect(texts.some(t => t.includes('示例'))).toBe(false)
    expect(texts.some(t => t.includes('真实标题'))).toBe(true)
  })
})

describe('TPV0104 BDD-03 Setext 标题两侧都生成锚点', () => {
  it('test_bdd_03_setext_h1_has_non_empty_id', async () => {
    const md = ['Setext 标题', '===', '', '正文'].join('\n')
    const headings = await headingsOf(md)
    const h1 = headings.find(h => h.level === 1)
    expect(h1).toBeDefined()
    expect(h1!.id.length).toBeGreaterThan(0)
    expect(h1!.text).toContain('Setext')
  })
})

describe('TPV0104 BDD-04 目录层级覆盖 h1–h4 且排除 h5', () => {
  it('test_bdd_04_levels_1_to_4_kept_and_h5_excluded', async () => {
    const md = ['# 一级', '', '## 二级', '', '### 三级', '', '#### 四级', '', '##### 五级'].join('\n')
    const headings = await headingsOf(md)
    expect(headings).toHaveLength(4)
    expect(headings.map(h => h.level)).toEqual([1, 2, 3, 4])
    expect(headings.some(h => h.text.includes('五级'))).toBe(false)
  })
})

describe('TPV0104 BDD-05 标题含内联强调与链接时文本已剥离标记', () => {
  it('test_bdd_05_inline_markup_stripped_from_heading_text', async () => {
    const md = '## **粗体**与[链接](other.md)\n'
    const headings = await headingsOf(md)
    expect(headings).toHaveLength(1)
    const text = headings[0].text
    expect(text).not.toContain('**')
    expect(text).not.toContain('[')
    expect(text).not.toContain('](')
    expect(text).toContain('粗体')
    expect(text).toContain('链接')
  })

  it('test_bdd_05_heading_id_matches_stripped_text_slug', async () => {
    // id 由纯文本 slugify 得到，不含空格与 markdown 标记字符
    const md = '## **粗体**与[链接](other.md)\n'
    const headings = await headingsOf(md)
    const id = headings[0].id
    expect(id.length).toBeGreaterThan(0)
    expect(id).not.toContain(' ')
    expect(id).not.toContain('*')
    expect(id).not.toContain('[')
  })
})

/**
 * 补充修复 A — 标题 ID 全局唯一性
 *
 * 独立缺陷（非 BDD-01 的重复同名场景）：原实现按**基础 slug 的出现次数**派生 ID，
 * 无法避免与**自然**标题相撞。例：
 *   `## foo / ## foo / ## foo-1` → `foo` / `foo-1` / `foo-1`（第二与第三碰撞）
 * 修复为「逐个候选检查最终 ID 是否已用过」（全局 usedIds Set，每次 render 新建）。
 */
describe('补充修复 A：标题 ID 全局唯一', () => {
  const idsOf = (hs: { id: string }[]) => hs.map(h => h.id)
  const isUnique = (ids: string[]) => new Set(ids).size === ids.length

  it('test_a1_duplicate_heading_collides_with_natural_suffix', async () => {
    const md = '## foo\n\n## foo\n\n## foo-1\n'
    const headings = await headingsOf(md)
    expect(headings).toHaveLength(3)
    const ids = idsOf(headings)
    ids.forEach(id => expect(id.length).toBeGreaterThan(0))
    // 三者全局唯一——第三个自然标题 `foo-1` 不得被第二个重复标题占用
    expect(new Set(ids).size).toBe(3)
    expect(ids).toEqual(['foo', 'foo-1', 'foo-1-1'])
  })

  it('test_a2_natural_suffix_appears_before_duplicates', async () => {
    const md = '## foo-1\n\n## foo\n\n## foo\n'
    const headings = await headingsOf(md)
    const ids = idsOf(headings)
    expect(isUnique(ids)).toBe(true)
    expect(ids).toEqual(['foo-1', 'foo', 'foo-2'])
  })

  it('test_a3_multiple_suffix_collisions_are_stable', async () => {
    const md = '## foo\n\n## foo\n\n## foo-1\n\n## foo-2\n\n## foo\n'
    const headings = await headingsOf(md)
    const ids = idsOf(headings)
    expect(isUnique(ids)).toBe(true)
    // 稳定性：同一输入重复渲染得到同一结果
    const again = idsOf(await headingsOf(md))
    expect(again).toEqual(ids)
  })

  it('test_a4_distinct_base_slugs_that_normalize_to_same', async () => {
    // `A B` 与 `A-B` 经 slugify 都成为 `a-b`
    const md = '## A B\n\n## A-B\n\n## A B\n'
    const headings = await headingsOf(md)
    const ids = idsOf(headings)
    expect(isUnique(ids)).toBe(true)
    expect(ids).toEqual(['a-b', 'a-b-1', 'a-b-2'])
  })

  it('test_a5_id_state_is_per_document_and_stable', async () => {
    const { render } = useMarkdown()
    const docA = await render('## foo\n\n## foo\n', THEME)
    const idsA = docA.headings.map(h => h.id)
    expect(idsA).toEqual(['foo', 'foo-1'])

    // 另一篇文档不继承上一篇的分配状态
    const docB = await render('## foo\n', THEME)
    expect(docB.headings.map(h => h.id)).toEqual(['foo'])

    // 同一文档重复渲染结果稳定
    const docA2 = await render('## foo\n\n## foo\n', THEME)
    expect(docA2.headings.map(h => h.id)).toEqual(idsA)
  })

  it('test_a6_empty_heading_gets_stable_non_empty_id', async () => {
    const headings = await headingsOf('##\n\n##\n')
    const ids = idsOf(headings)
    expect(ids.every(id => id.length > 0)).toBe(true)
    expect(isUnique(ids)).toBe(true)
  })

  it('test_a7_atx_and_setext_levels_still_supported', async () => {
    // h1-h4 支持不退化：ATX + Setext
    const md = 'Setext 一级\n===\n\n## ATX 二级\n\nSetext 二级\n---\n\n### ATX 三级\n\n#### ATX 四级\n\n##### ATX 五级（应排除）\n'
    const headings = await headingsOf(md)
    expect(headings.map(h => h.level)).toEqual([1, 2, 2, 3, 4])
    expect(isUnique(idsOf(headings))).toBe(true)
  })
})
