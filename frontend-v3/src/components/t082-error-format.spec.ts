import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const VIEWS_DIR = resolve(__dirname, '..', 'views')
const COMPONENTS_DIR = resolve(__dirname, '..', 'components')

// BDD-23: 拆分后主组件行数符合约束
describe('BDD-23: EntryDetailView 主组件行数 < 300', () => {
  it('EntryDetailView.vue 行数 < 300', () => {
    const path = resolve(VIEWS_DIR, 'EntryDetailView.vue')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    const lineCount = content.split('\n').length
    expect(lineCount).toBeLessThan(300)
  })
})

// BDD-24: 拆分后子组件行数符合约束
describe('BDD-24: 子组件行数 < 200', () => {
  const subComponents = [
    'EntryDetailHeader.vue',
    'EntryDetailBanners.vue',
    'EntryDetailContent.vue',
    'EntryDetailMobileBar.vue',
    'EntryDetailDialogs.vue',
  ]

  for (const name of subComponents) {
    it(`${name} 存在且行数 < 200`, () => {
      const path = resolve(COMPONENTS_DIR, name)
      expect(existsSync(path)).toBe(true)
      const content = readFileSync(path, 'utf-8')
      const lineCount = content.split('\n').length
      expect(lineCount).toBeLessThan(200)
    })
  }
})

// BDD-39: 前端正确读取统一错误格式
describe('BDD-39: 前端错误格式兼容 — .error.message', () => {
  const filesToCheck = [
    {
      path: resolve(COMPONENTS_DIR, 'ExpiresInDialog.vue'),
      name: 'ExpiresInDialog.vue',
    },
    {
      path: resolve(COMPONENTS_DIR, 'settings', 'SecurityTab.vue'),
      name: 'SecurityTab.vue',
    },
    {
      path: resolve(COMPONENTS_DIR, 'settings', 'ProfileTab.vue'),
      name: 'ProfileTab.vue',
    },
  ]

  for (const { path, name } of filesToCheck) {
    it(`${name} 读取 .error?.message 而非 .detail`, () => {
      expect(existsSync(path)).toBe(true)
      const content = readFileSync(path, 'utf-8')

      // After R7, these files should read error.message instead of detail
      // Check that .error?.message pattern exists
      expect(content).toContain('.error?.message')

      // Ensure old .detail pattern (for HTTP error responses) is gone
      // Note: LoginDialog.vue reads e.detail (DOM CustomEvent) — that's not HTTP error format
      // We only check the 3 specific files that read response.data.detail
      const detailPattern = /response\?\.data\?\.detail/
      expect(detailPattern.test(content)).toBe(false)
    })
  }
})
