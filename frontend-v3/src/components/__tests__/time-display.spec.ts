/**
 * TPV0102 — 时间显示组件（P3 红灯基线）。
 *
 * 对应 P1-requirements.md：
 *   BDD-01  主显为绝对时间且含 GMT±N 偏移（4 位年份、不含 ago/just now）
 *   BDD-02  悬停提示同时含相对时间与绝对时间（tooltip 必须是**真实 DOM 元素**）
 *   BDD-05  无效时间值不产生 NaN 文本
 *
 * 契约来源 P2-design §3.4 `TimeDisplay.vue` + §3.8 稳定测试标识清单：
 *   根节点     `data-testid="time-display"`
 *   主显节点   `.time-display__main`（绝对时间）
 *   tooltip 节点 `role="tooltip"` + `data-testid="time-tooltip"`，默认 `visibility: hidden`
 *
 * 为什么断言「真实 DOM + role=tooltip + 不依赖 title」（P2 §2.3 决策 C2 / §8 V6 实测）：
 *   原生 `title` 属性在 Playwright 的 `getByText` 命中 **0**（不在 DOM 中）；
 *   CSS `::after` 的伪元素内容 `textContent` 取不到；只有自定义 DOM 元素 + `visibility`
 *   切换可被断言。`opacity: 0` 的隐藏元素 `isVisible()` **仍为 true** → 必须用 visibility。
 *
 * 当前红灯原因（B 类）：`@/components/TimeDisplay.vue` 尚未创建。
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TimeDisplay from '@/components/TimeDisplay.vue'

const KNOWN_UTC = '2026-11-10T09:43:00Z'
const SHORT_OFFSET = /GMT[+-]\d/
const FULL_OFFSET = /GMT[+-]\d{2}:\d{2}/
const FOUR_DIGIT_YEAR = /\d{4}/

function mountDisplay(dateStr = KNOWN_UTC) {
  return mount(TimeDisplay, {
    props: { dateStr },
    attachTo: document.body,
  })
}

describe('BDD-01: TimeDisplay 主显为绝对时间', () => {
  it('BDD-01: 根节点带 data-testid="time-display"', () => {
    const wrapper = mountDisplay()
    expect(wrapper.find('[data-testid="time-display"]').exists()).toBe(true)
  })

  it('BDD-01: 主显文本含 GMT±N 与 4 位年份', () => {
    const wrapper = mountDisplay()
    const main = wrapper.find('.time-display__main')
    expect(main.exists()).toBe(true)
    const text = main.text()
    expect(text).toMatch(SHORT_OFFSET)
    expect(text).toMatch(FOUR_DIGIT_YEAR)
  })

  it('BDD-01: 主显不含相对时间形态（不出现 ago / just now）', () => {
    const wrapper = mountDisplay()
    const root = wrapper.find('[data-testid="time-display"]').text()
    // tooltip 默认隐藏但仍在 DOM 内，故只对主显节点断言
    const main = wrapper.find('.time-display__main').text()
    expect(main).not.toMatch(/ago/)
    expect(main).not.toMatch(/just now/)
    expect(root.length).toBeGreaterThan(0)
  })
})

describe('BDD-02: tooltip 为可断言的真实 DOM 元素', () => {
  it('BDD-02: tooltip 节点存在且带 role="tooltip"', () => {
    const wrapper = mountDisplay()
    const tip = wrapper.find('[data-testid="time-tooltip"]')
    expect(tip.exists()).toBe(true)
    expect(tip.attributes('role')).toBe('tooltip')
  })

  it('BDD-02: tooltip 文本含相对时间 + 完整偏移 + IANA 时区名三段', () => {
    const wrapper = mountDisplay()
    const text = wrapper.find('[data-testid="time-tooltip"]').text()
    expect(text).toContain(' · ')
    const parts = text.split(' · ')
    expect(parts.length).toBe(3)
    expect(parts[0]).toMatch(/^(just now|\d+(m|h|d|w|mo|y) ago|in \d+(m|h|d|w|mo|y))$/)
    expect(parts[1]).toMatch(FULL_OFFSET)
    expect(parts[2]).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it('BDD-02: 时间文本不通过原生 title 属性承载 tooltip（改用 DOM 元素）', () => {
    const wrapper = mountDisplay()
    const main = wrapper.find('.time-display__main')
    // 旧实现 `<span :title="fullTime">` 的 title 属性在 Playwright 下不可断言
    expect(main.attributes('title')).toBeUndefined()
  })

  it('BDD-02: 隐藏方式不是 opacity:0（opacity:0 的 isVisible 仍为 true）', () => {
    const wrapper = mountDisplay()
    const tip = wrapper.find('[data-testid="time-tooltip"]')
    const inlineStyle = (tip.attributes('style') || '').replace(/\s/g, '')
    expect(inlineStyle).not.toContain('opacity:0')
    expect(inlineStyle).not.toContain('opacity: 0')
  })

  it('BDD-02: 根节点带 class="time-display"（hover 触发容器）', () => {
    const wrapper = mountDisplay()
    expect(wrapper.find('[data-testid="time-display"]').classes()).toContain('time-display')
  })
})

describe('BDD-05: 无效时间值不产生 NaN', () => {
  it('BDD-05: 无效 created_at 的卡片时间与 tooltip 均不含 NaN', () => {
    const wrapper = mountDisplay('not-a-date')
    expect(wrapper.text()).not.toContain('NaN')
  })

  it('BDD-05: 空字符串输入不产生 NaN', () => {
    const wrapper = mountDisplay('')
    expect(wrapper.text()).not.toContain('NaN')
  })
})
