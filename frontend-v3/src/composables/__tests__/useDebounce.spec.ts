import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays execution by the specified delay', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)

    debounced()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('merges multiple rapid calls into a single execution', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)

    debounced()
    debounced()
    debounced()

    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('resets the timer on each call', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)

    debounced()
    vi.advanceTimersByTime(80)

    debounced()
    vi.advanceTimersByTime(80)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(20)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes arguments to the original function', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)

    debounced('hello', 42)
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledWith('hello', 42)
  })

  it('only executes with the latest arguments', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)

    debounced('first')
    debounced('second')
    debounced('third')
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('third')
  })

  it('works with different delay values', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 300)

    debounced()
    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('supports independent instances', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const d1 = useDebounce(fn1, 100)
    const d2 = useDebounce(fn2, 200)

    d1()
    d2()

    vi.advanceTimersByTime(100)
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  it('advancing timers past delay flushes pending call immediately', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 150)

    debounced('flush-test')
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(150)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('flush-test')

    debounced('flush-test-2')
    vi.advanceTimersByTime(150)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledWith('flush-test-2')
  })
})
