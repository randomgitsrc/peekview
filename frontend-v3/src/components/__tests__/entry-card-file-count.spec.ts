/**
 * TPV0102 — 文件数三态显隐 + 非 owner 无可见性入口（P3 红灯基线）。
 *
 * 对应 P1-requirements.md：
 *   BDD-13  1 个文件的 entry 在卡片与列表均不显示文件数
 *   BDD-14  0 个文件的 entry 在卡片与列表均不显示文件数
 *   BDD-15  3 个文件的 entry 在卡片与列表均显示 "3 files"
 *   BDD-22  非 owner 用户看不到可见性菜单（卡片 / 列表两处；详情页在 E2E 覆盖）
 *
 * 契约来源 P2-design §1.1 C1：
 *   `v-if="entry.fileCount"` → `v-if="(entry.fileCount ?? 0) >= 2"`，文案固定 `{{ entry.fileCount }} files`
 *   → fileCount=1 时**不**渲染任何 `N files` 文本（当前实现渲染 `1 file`，故 BDD-13 必红）
 *
 * BDD-14 / BDD-15 当前实现已符合预期（`0` falsy 不渲染；`3` 渲染 `3 files`）——
 * 这两条是**正向护栏**（防 P4 改动把已正确行为改坏），不是红灯来源。
 *
 * 当前红灯原因（B 类，被测模块行为未实现）：BDD-13 断言失败。
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryCard from '@/components/EntryCard.vue'
import EntryListRow from '@/components/EntryListRow.vue'
import type { Entry } from '@/types'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    slug: 'file-count-entry',
    summary: 'File count entry',
    tags: [],
    status: 'active',
    files: [],
    fileCount: undefined as unknown as number,
    isPublic: true,
    ownerId: 7,
    username: 'alice',
    expiresAt: null,
    archivedAt: null,
    createdAt: '2026-11-10T09:43:00Z',
    teamId: null,
    team: null,
    ...overrides,
  }
}

function mountCard(entry: Entry, isOwner = true) {
  return mount(EntryCard, {
    props: { entry, isOwner, currentUsername: 'alice' },
  })
}

function mountRow(entry: Entry, isOwner = true) {
  return mount(EntryListRow, {
    props: { entry, isOwner, currentUsername: 'alice' },
  })
}

const FILE_COUNT_TEXT = /\d+ files?/

describe('BDD-13: 1 个文件不显示文件数', () => {
  it('BDD-13: 卡片对 fileCount=1 不出现 "1 file" 文本', () => {
    const wrapper = mountCard(makeEntry({ fileCount: 1 }))
    expect(wrapper.text()).not.toMatch(/1 files?/)
    expect(wrapper.text()).not.toMatch(FILE_COUNT_TEXT)
  })

  it('BDD-13: 列表行对 fileCount=1 不出现 "1 file" 文本', () => {
    const wrapper = mountRow(makeEntry({ fileCount: 1 }))
    expect(wrapper.text()).not.toMatch(/1 files?/)
    expect(wrapper.text()).not.toMatch(FILE_COUNT_TEXT)
  })
})

describe('BDD-14: 0 个文件不显示文件数', () => {
  it('BDD-14: 卡片对 fileCount=0 不出现任何 N files 文本', () => {
    const wrapper = mountCard(makeEntry({ fileCount: 0 }))
    expect(wrapper.text()).not.toMatch(FILE_COUNT_TEXT)
  })

  it('BDD-14: 列表行对 fileCount=0 不出现任何 N files 文本', () => {
    const wrapper = mountRow(makeEntry({ fileCount: 0 }))
    expect(wrapper.text()).not.toMatch(FILE_COUNT_TEXT)
  })
})

describe('BDD-15: 3 个文件显示 "3 files"', () => {
  it('BDD-15: 卡片对 fileCount=3 显示 "3 files"', () => {
    const wrapper = mountCard(makeEntry({ fileCount: 3 }))
    expect(wrapper.text()).toContain('3 files')
  })

  it('BDD-15: 列表行对 fileCount=3 显示 "3 files"', () => {
    const wrapper = mountRow(makeEntry({ fileCount: 3 }))
    expect(wrapper.text()).toContain('3 files')
  })

  it('BDD-15: 复数一律 "files"（不出现 "3 file"）', () => {
    const wrapper = mountCard(makeEntry({ fileCount: 3 }))
    expect(wrapper.text()).not.toMatch(/3 file(?!s)/)
  })
})

describe('BDD-22: 非 owner 无可见性菜单入口（卡片 + 列表）', () => {
  it('BDD-22: 卡片在 isOwner=false 时 visibility-toggle 数量为 0', () => {
    const wrapper = mountCard(makeEntry({ fileCount: 2 }), false)
    expect(wrapper.findAll('[data-testid="visibility-toggle"]')).toHaveLength(0)
  })

  it('BDD-22: 列表行在 isOwner=false 时 visibility-toggle 数量为 0', () => {
    const wrapper = mountRow(makeEntry({ fileCount: 2 }), false)
    expect(wrapper.findAll('[data-testid="visibility-toggle"]')).toHaveLength(0)
  })

  it('BDD-22: owner 时可见性入口存在（对照，防「一律不渲染」假绿）', () => {
    const card = mountCard(makeEntry({ fileCount: 2 }), true)
    const row = mountRow(makeEntry({ fileCount: 2 }), true)
    expect(card.findAll('[data-testid="visibility-toggle"]').length).toBeGreaterThan(0)
    expect(row.findAll('[data-testid="visibility-toggle"]').length).toBeGreaterThan(0)
  })

  it('BDD-22: 团队 entry 也有可见性入口（本任务翻转 TPV0095 BDD-40 的语义）', () => {
    const teamEntry = makeEntry({
      fileCount: 2,
      isPublic: false,
      teamId: 11,
      team: { slug: 'team-a', name: 'Team A' },
    })
    const card = mountCard(teamEntry, true)
    expect(card.findAll('[data-testid="visibility-toggle"]').length).toBeGreaterThan(0)
  })
})
