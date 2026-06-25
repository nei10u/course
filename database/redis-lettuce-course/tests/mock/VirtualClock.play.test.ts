// tests/mock/VirtualClock.play.test.ts
// Tests play() with REAL timers (no fake) to verify raf loop runs.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VirtualClock } from '../../mock/VirtualClock'

describe('VirtualClock play (real timers)', () => {
  let originalRaf: typeof requestAnimationFrame
  let originalCancel: typeof cancelAnimationFrame
  let rafCallbacks: ((t: number) => void)[]
  let rafTime: number

  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame
    originalCancel = globalThis.cancelAnimationFrame
    rafCallbacks = []
    rafTime = 0
    // Align performance.now with raf timestamps so VirtualClock's delta math works
    vi.spyOn(performance, 'now').mockImplementation(() => rafTime)
    globalThis.requestAnimationFrame = ((cb: (t: number) => void) => {
      rafCallbacks.push(cb)
      setTimeout(() => {
        rafTime += 16
        cb(rafTime)
      }, 0)
      return rafCallbacks.length
    }) as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((id: number) => {
      rafCallbacks.splice(id - 1, 1)
    }) as typeof cancelAnimationFrame
  })

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCancel
  })

  it('play() fires scheduled events automatically over time', async () => {
    const clock = new VirtualClock()
    const fired: number[] = []
    clock.schedule({ at: 5, fn: () => fired.push(5) })
    clock.schedule({ at: 20, fn: () => fired.push(20) })
    clock.schedule({ at: 40, fn: () => fired.push(40) })

    expect(fired).toEqual([])

    clock.play()

    // Wait for raf callbacks to flush
    await new Promise(r => setTimeout(r, 50))
    await new Promise(r => setTimeout(r, 50))
    await new Promise(r => setTimeout(r, 50))

    // All events should have fired
    expect(fired).toContain(5)
    expect(fired).toContain(20)
    expect(fired).toContain(40)
  })

  it('play() auto-pauses when all events fired', async () => {
    const clock = new VirtualClock()
    clock.schedule({ at: 5, fn: () => {} })
    clock.schedule({ at: 10, fn: () => {} })

    clock.play()

    await new Promise(r => setTimeout(r, 100))

    expect(clock.mode).toBe('paused')
    expect(clock.hasEvents).toBe(false)
  })
})
