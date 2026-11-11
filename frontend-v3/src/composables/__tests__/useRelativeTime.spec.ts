/**
 * TPV0102 — 时间格式化契约（P3 红灯基线）。
 *
 * 对应 P1-requirements.md：
 *   BDD-01  主显为绝对时间且含 GMT±N 偏移标识（4 位年份、不含 ago/just now）
 *   BDD-02  悬停提示同时含相对时间 + 绝对时间（完整偏移）+ 运行时 IANA 时区名
 *   BDD-05  无效时间值不产生 NaN 文本
 *   BDD-06  未来时间的相对时间描述方向正确
 *
 * 契约来源 P2-design §3.4（B1/B2/B3）：
 *   formatRelativeTime：无效 → ''；未来 → `in ${n}m|h|d|w|mo|y`；<60s → 'just now'；其余 `${n}x ago`
 *   formatFullDate   ：toLocaleString(undefined, { ...六字段, timeZoneName: 'shortOffset' })；无效 → '—'
 *   formatTooltip    ：`${relative} · ${longOffset 墙上时间} · ${IANA 名}`；无效 → 'Invalid date'
 *   useRelativeTime  ：返回 { relative, full, absolute }
 *
 * 当前红灯原因（B 类，被测模块未实现）：`formatTooltip` 未导出、`absolute` 字段不存在、
 * `formatFullDate` 无 shortOffset、`formatRelativeTime` 对未来时间返回 'just now'。
 *
 * 注意：BDD-01 不限定 locale/时区 → 断言用形态匹配 `/GMT[+-]\d/`，**不硬编码 GMT+8**。
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
  formatRelativeTime,
  formatFullDate,
  formatTooltip,
  useRelativeTime,
} from '@/composables/useRelativeTime'

const KNOWN_UTC = '2026-11-10T09:43:00Z'

/** 相对时间形态（BDD-02 Then ①） */
const RELATIVE_SHAPE = /^(just now|\d+(m|h|d|w|mo|y) ago|in \d+(m|h|d|w|mo|y))$/
/** 完整偏移形态（BDD-02 Then ②：longOffset 的 `GMT±HH:MM`） */
const FULL_OFFSET = /GMT[+-]\d{2}:\d{2}/
/** 短偏移形态（BDD-01：`GMT±N`，shortOffset） */
const SHORT_OFFSET = /GMT[+-]\d/
/** 当前运行时 IANA 时区名（BDD-02 Then ③ 的判据；UTC 下为 "UTC"，无斜杠） */
const RUNTIME_TZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone

afterEach(() => {
  // 若某用例启用了假定时器，务必复位，避免污染同文件后续用例
  if (typeof vi !== 'undefined' && typeof vi.useRealTimers === 'function') {
    vi.useRealTimers()
  }
})

describe('BDD-01: 主显绝对时间（formatFullDate）', () => {
  it('BDD-01: formatFullDate 与五字段参考输出逐字符相等（无时区偏移、无秒）', () => {
    const FIVE = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
    const expected = new Date(KNOWN_UTC).toLocaleString(undefined, FIVE)
    expect(formatFullDate(KNOWN_UTC)).toBe(expected)
    expect(formatFullDate(KNOWN_UTC)).not.toMatch(SHORT_OFFSET)
  })

  it('BDD-01: formatFullDate 主显不是相对时间形态', () => {
    const text = formatFullDate(KNOWN_UTC)
    expect(text).not.toMatch(/ago/)
    expect(text).not.toMatch(/just now/)
  })

  it('BDD-01: formatFullDate 通过 toLocaleString 输出且无 NaN', () => {
    const text = formatFullDate(KNOWN_UTC)
    expect(text).not.toContain('NaN')
    expect(text.length).toBeGreaterThan(0)
  })
})

describe('BDD-02: tooltip 三段结构（formatTooltip）', () => {
  it('BDD-02: formatTooltip 是已导出的纯函数', () => {
    expect(typeof formatTooltip).toBe('function')
  })

  it('BDD-02: formatTooltip 三段以 " · " 分隔且各自成立', () => {
    const text = formatTooltip(KNOWN_UTC)
    const parts = text.split(' · ')
    expect(parts.length).toBe(3)

    // ① 相对时间
    expect(parts[0]).toMatch(RELATIVE_SHAPE)
    // ② 绝对时间（longOffset 完整偏移 GMT±HH:MM）
    expect(parts[1]).toMatch(FULL_OFFSET)
    // ③ IANA 时区名 === 运行时解析值（不可写「形如 Area/City」——UTC 下无斜杠）
    expect(parts[2]).toBe(RUNTIME_TZ())
  })

  it('BDD-02: 段 2 的墙上时间与段 1 的相对时间来自同一时刻', () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const parts = formatTooltip(recent).split(' · ')
    expect(parts[0]).toMatch(/^2h ago$/)
    expect(parts[1]).toMatch(FULL_OFFSET)
  })
})

describe('BDD-05: 无效时间值不产生 NaN', () => {
  it('BDD-05: formatRelativeTime 对无法解析的字符串返回空串', () => {
    expect(formatRelativeTime('not-a-date')).toBe('')
  })

  it('BDD-05: formatFullDate 对无法解析的字符串返回破折号占位', () => {
    expect(formatFullDate('not-a-date')).toBe('—')
  })

  it('BDD-05: formatTooltip 对无法解析的字符串返回 Invalid date', () => {
    expect(formatTooltip('not-a-date')).toBe('Invalid date')
  })

  it('BDD-05: 三个函数对空串/缺失输入均不产生 NaN', () => {
    for (const bad of ['', 'x', '2026-13-45T99:99:99Z']) {
      expect(formatRelativeTime(bad)).not.toContain('NaN')
      expect(formatFullDate(bad)).not.toContain('NaN')
      expect(formatTooltip(bad)).not.toContain('NaN')
    }
  })
})

describe('BDD-06: 未来时间的相对时间方向', () => {
  const inFuture = (ms: number) => new Date(Date.now() + ms).toISOString()

  it('BDD-06: 未来 24 小时显示为 in N… 而非 just now', () => {
    const text = formatRelativeTime(inFuture(24 * 60 * 60 * 1000))
    expect(text).toMatch(/^in /)
    expect(text).not.toBe('just now')
    expect(text).not.toContain('NaN')
  })

  it('BDD-06: 未来 90 分钟方向与量级正确', () => {
    expect(formatRelativeTime(inFuture(90 * 60 * 1000))).toMatch(/^in \d+h$/)
  })

  it('BDD-06: 未来 3 天方向与量级正确', () => {
    expect(formatRelativeTime(inFuture(3 * 24 * 60 * 60 * 1000))).toMatch(/^in \d+d$/)
  })

  it('BDD-06: 过去时间仍为 ago 形态（方向对照，防「一律改成 in」）', () => {
    expect(formatRelativeTime(inFuture(-2 * 60 * 60 * 1000))).toMatch(/^2h ago$/)
    expect(formatRelativeTime(inFuture(-30 * 1000))).toBe('just now')
  })

  it('BDD-06: 未来时间的 tooltip 不含 NaN', () => {
    expect(formatTooltip(inFuture(24 * 60 * 60 * 1000))).not.toContain('NaN')
  })
})

describe('BDD-02: useRelativeTime 返回 absolute 字段（P2 §1.1 B3）', () => {
  const Host = defineComponent({
    props: { dateStr: { type: String, required: true } },
    setup(props) {
      const state = useRelativeTime(ref(props.dateStr))
      return () => h('div', [state.absolute.value, '|', state.full.value])
    },
  })

  it('BDD-02: 返回值含 relative / full / absolute 三个 ref', () => {
    const state = useRelativeTime(ref(KNOWN_UTC))
    expect(state).toHaveProperty('relative')
    expect(state).toHaveProperty('full')
    expect(state).toHaveProperty('absolute')
  })

  it('BDD-02: absolute 与 formatFullDate 一致，full 与 formatTooltip 一致', () => {
    const wrapper = mount(Host, { props: { dateStr: KNOWN_UTC } })
    const [absolute, full] = (wrapper.text() || '').split('|')
    expect(absolute).toBe(formatFullDate(KNOWN_UTC))
    expect(full).toBe(formatTooltip(KNOWN_UTC))
  })
})
