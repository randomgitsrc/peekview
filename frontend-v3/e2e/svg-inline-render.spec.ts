import { test, expect } from '@playwright/test'

// 裸内嵌 <svg> 渲染（inline 插图直渲）——固定复现样本 seed entry: dsh-architecture
// 根因回归：markdown-it html_block 碎片化 + 段落包裹 <p><text> → DOM foreign content
// breakout → DOMPurify 吞内容（章节消失 / SVG 空壳）。修复：预处理提取保护。
test.describe('inline SVG rendering（裸 HTML SVG 插图）', () => {
  test('dsh-architecture: 4 张 SVG 全渲染 + 7 章节 + 2 表格 + yaml 代码块', async ({ page }) => {
    await page.goto('/dsh-architecture')
    await page.waitForSelector('h1', { timeout: 15000 })
    await page.waitForTimeout(1000) // shiki/渲染稳定

    const doc = page.locator('.detail-content, .markdown-viewer, main').first()
    await expect(doc).toBeVisible()

    // 7 个章节标题存活（修复前正文只剩 ##1）
    const body = await page.evaluate(() => document.body.innerText)
    for (const sec of ['1. 总体架构', '2. 节点角色与服务清单', '3. 接入与权限路径', '4. 容器内 dsh 配置层', '5. 三层保活', '6. Playwright', '7. 纳管规则']) {
      expect(body).toContain(sec)
    }
    const h2Count = await page.locator('.detail-content h2, .markdown-viewer h2, main h2').count()
    expect(h2Count).toBeGreaterThanOrEqual(7)

    // 4 张内容 SVG 全渲染（有 width/viewBox 属性 + 内部图形元素非空壳）
    const svgs = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.detail-content svg, .markdown-viewer svg, main svg')]
      return els
        .filter((s) => (s.getAttribute('viewBox') || '').length > 0)
        .map((s) => ({ rect: s.querySelectorAll('rect').length, text: s.querySelectorAll('text').length }))
    })
    expect(svgs).toHaveLength(4)
    // 修复前：svg[0] 空壳（rect=0 text=0）；修复后每张都有图形元素
    for (const s of svgs) {
      expect(s.rect).toBeGreaterThan(0)
      expect(s.text).toBeGreaterThan(0)
    }

    // 表格与 yaml 代码块存活
    const tableCount = await page.locator('.detail-content table, .markdown-viewer table, main table').count()
    expect(tableCount).toBe(2)
    await expect(page.locator('.code-block-wrapper').first()).toBeVisible()

    // 视觉截图（vision 复核用）
    await page.screenshot({ path: 'test-results/svg-inline-render.png', fullPage: true })
  })
})
