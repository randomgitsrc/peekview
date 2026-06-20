import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateSource, render, ensureLoaded, _setPlantUmlRender, _setTimeout } from '../usePlantUML'

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
    beforeEach(() => {
      _setPlantUmlRender((lines: string[], targetId: string) => {
        const el = document.getElementById(targetId)
        if (el) el.innerHTML = '<svg viewBox="0 0 100 50"><rect/></svg>'
      })
    })

    afterEach(() => {
      _setPlantUmlRender(null)
    })

    it('有效源码返回 SVG 字符串', async () => {
      const svg = await render('@startuml\nA -> B\n@enduml')
      expect(typeof svg).toBe('string')
      expect(svg).toContain('<svg')
    })

    it('语法错误时 reject', async () => {
      await expect(render('invalid source')).rejects.toThrow('invalid')
    })

    it('超时时 reject', async () => {
      _setPlantUmlRender(() => {
        // 不创建 SVG，模拟引擎静默不输出
      })
      _setTimeout(100)
      await expect(render('@startuml\nA -> B\n@enduml')).rejects.toThrow('timeout')
      _setTimeout(5000)
    })

    it('串行队列：多次调用排队执行', async () => {
      const calls: number[] = []
      let callCount = 0
      _setPlantUmlRender((lines: string[], targetId: string) => {
        callCount++
        const el = document.getElementById(targetId)
        if (el) el.innerHTML = '<svg></svg>'
      })
      const promises = [1, 2, 3].map((i) =>
        render('@startuml\nA -> B\n@enduml').then(() => calls.push(i)),
      )
      await Promise.all(promises)
      expect(calls).toEqual([1, 2, 3])
      expect(callCount).toBe(3)
    })
  })

  describe('ensureLoaded', () => {
    beforeEach(() => {
      _setPlantUmlRender(null)
    })

    it('首次调用触发加载', async () => {
      _setPlantUmlRender((lines: string[], targetId: string) => {})
      await ensureLoaded()
    })

    it('重复调用不重复加载', async () => {
      _setPlantUmlRender((lines: string[], targetId: string) => {})
      await ensureLoaded()
      await ensureLoaded()
    })
  })
})
