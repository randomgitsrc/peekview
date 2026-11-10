// ⚠️ BDD-7「clicking toggle button」子用例已被 TPV0102 有意取代（P2-design §1.1 D7/D9）：
//    原单按钮 `@click="$emit('toggleVisibility', entry)"` 被 `<VisibilityMenu>` 替换——
//    触发按钮只开菜单（testid `visibility-toggle`，不再带 `.card-action-btn` /
//    `data-action="toggle-visibility"`），选择权在菜单项上，故事件名改为
//    `changeVisibility({ entry, target })` 且需先点开菜单再点菜单项才发出。
//    覆盖点（点交互控件不触发导航）未删除。

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryListRow from '@/components/EntryListRow.vue'
import type { Entry } from '@/types'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

const mockEntry: Entry = {
  id: 1,
  slug: 'test-entry',
  summary: 'A test entry',
  tags: ['vue'],
  status: 'active',
  files: [],
  fileCount: 3,
  isPublic: true,
  ownerId: 1,
  username: 'alice',
  expiresAt: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('T031 EntryListRow', () => {
  const createWrapper = (props: Record<string, any> = {}) =>
    mount(EntryListRow, {
      props: { entry: mockEntry, ...props },
    })

  beforeEach(() => {
    pushMock.mockClear()
  })

  describe('BDD-2: native link', () => {
    it('entry-title should be an <a> with href to entry slug', () => {
      const wrapper = createWrapper()
      const title = wrapper.find('.entry-title')
      expect(title.exists()).toBe(true)
      expect(title.element.tagName.toLowerCase()).toBe('a')
      expect(title.attributes('href')).toBe('/test-entry')
    })

    it('root should be a <div> (not a link)', () => {
      const wrapper = createWrapper()
      const root = wrapper.find('.entry-list-row')
      expect(root.element.tagName.toLowerCase()).toBe('div')
      expect(root.attributes('role')).not.toBe('button')
      expect(root.attributes('tabindex')).toBeUndefined()
    })
  })

  describe('BDD-3: separator', () => {
    it('meta-dot separator exists between meta items', () => {
      const wrapper = createWrapper()
      const dots = wrapper.findAll('.meta-dot')
      expect(dots.length).toBeGreaterThan(0)
    })
  })

  describe('BDD-7: nested interactive elements', () => {
    it('username should be an <a> with href to user page', () => {
      const wrapper = createWrapper()
      const username = wrapper.find('.meta-username')
      expect(username.exists()).toBe(true)
      expect(username.element.tagName.toLowerCase()).toBe('a')
      expect(username.attributes('href')).toBe('/users/alice')
    })

    it('clicking visibility menu should NOT trigger navigation', async () => {
      const wrapper = createWrapper({ isOwner: true })
      const toggleBtn = wrapper.find('[data-testid="visibility-toggle"]')
      expect(toggleBtn.exists()).toBe(true)
      await toggleBtn.trigger('click')
      await wrapper.find('[data-testid="visibility-item-private"]').trigger('click')
      const emitted = wrapper.emitted('changeVisibility')
      expect(emitted).toBeTruthy()
      expect((emitted![0][0] as { target: { kind: string } }).target.kind).toBe('private')
      expect(pushMock).not.toHaveBeenCalled()
    })
  })
})
