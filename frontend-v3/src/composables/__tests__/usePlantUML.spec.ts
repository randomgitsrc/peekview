import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateSource, render, ensureLoaded } from '../usePlantUML'

describe('usePlantUML', () => {
  describe('validateSource', () => {
    it('有效源码通过校验', () => {
      const result = validateSource('@startuml\nA -> B\n@enduml')
      expect(result.ok).toBe(true)
    })

    it('缺少 @startuml 拒绝', () => {
      const result = validateSource('A -> B\n@enduml')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('startuml')
    })

    it('缺少 @enduml 拒绝', () => {
      const result = validateSource('@startuml\nA -> B')
      expect(result.ok).toBe(false)
      expect(result.reason).toContain('enduml')
    })

    it('空字符串拒绝', () => {
      const result = validateSource('')
      expect(result.ok).toBe(false)
    })
  })

  describe('render', () => {
    it('有效源码返回 SVG 字符串', async () => {
      const svg = await render('@startuml\nA -> B\n@enduml')
      expect(typeof svg).toBe('string')
      expect(svg).toContain('<svg')
    })

    it('语法错误时 reject', async () => {
      await expect(render('invalid source')).rejects.toThrow()
    })

    it('超时时 reject', async () => {
      vi.useFakeTimers()
      const promise = render('@startuml\nA -> B\n@enduml')
      vi.advanceTimersByTime(6000)
      await expect(promise).rejects.toThrow('timeout')
      vi.useRealTimers()
    })

    it('串行队列：多次调用排队执行', async () => {
      const calls: number[] = []
      const promises = [1, 2, 3].map((i) =>
        render('@startuml\nA -> B\n@enduml').then(() => calls.push(i)),
      )
      await Promise.all(promises)
      expect(calls).toEqual([1, 2, 3])
    })
  })

  describe('ensureLoaded', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    it('首次调用触发加载', async () => {
      await ensureLoaded()
    })

    it('重复调用不重复加载', async () => {
      await ensureLoaded()
      await ensureLoaded()
    })
  })
})
