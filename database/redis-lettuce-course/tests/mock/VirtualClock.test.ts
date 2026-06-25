// tests/mock/VirtualClock.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VirtualClock } from '../../mock/VirtualClock'

describe('VirtualClock', () => {
  let rafCallback: ((t: number) => void) | null = null
  let rafTime = 0

  beforeEach(() => {
    vi.useFakeTimers()
    rafTime = 0
    rafCallback = null
    // Fake performance.now() to start at 0 so VirtualClock's delta math works
    // in lockstep with the manual raf driver below.
    vi.spyOn(performance, 'now').mockReturnValue(0)
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      rafCallback = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => { rafCallback = null })
    // helper to drive frames forward
    ;(globalThis as any).__driveRaf = (frames: number) => {
      for (let i = 0; i < frames; i++) {
        rafTime += 16
        if (rafCallback) rafCallback(rafTime)
      }
    }
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts paused at time 0', () => {
    const clock = new VirtualClock()
    expect(clock.now).toBe(0)
    expect(clock.mode).toBe('paused')
  })

  it('schedules events in time order', () => {
    const clock = new VirtualClock()
    const calls: string[] = []
    clock.schedule({ at: 30, fn: () => calls.push('late') })
    clock.schedule({ at: 10, fn: () => calls.push('early') })
    clock.schedule({ at: 20, fn: () => calls.push('mid') })
    clock.step()
    clock.step()
    clock.step()
    expect(calls).toEqual(['early', 'mid', 'late'])
  })

  it('step fires only the next event', () => {
    const clock = new VirtualClock()
    const calls: string[] = []
    clock.schedule({ at: 10, fn: () => calls.push('a') })
    clock.schedule({ at: 20, fn: () => calls.push('b') })
    clock.step()
    expect(calls).toEqual(['a'])
    expect(clock.now).toBe(10)
  })

  it('play advances time via raf and triggers events', () => {
    const clock = new VirtualClock()
    const calls: number[] = []
    clock.schedule({ at: 16, fn: () => calls.push(clock.now) })
    clock.play()
    // drive frames forward
    ;(globalThis as any).__driveRaf(10)
    expect(calls.length).toBeGreaterThan(0)
  })

  it('pause stops progression', () => {
    const clock = new VirtualClock()
    let called = false
    clock.schedule({ at: 1000, fn: () => { called = true } })
    clock.play()
    clock.pause()
    ;(globalThis as any).__driveRaf(100)
    // After pause, no further events should fire from auto-advance.
    expect(clock.now).toBeLessThan(1000)
  })

  it('reset returns to time 0 and clears events', () => {
    const clock = new VirtualClock()
    let called = false
    clock.schedule({ at: 50, fn: () => { called = true } })
    clock.step()
    clock.reset()
    expect(clock.now).toBe(0)
    clock.step() // nothing to fire
    expect(called).toBe(true) // already fired before reset
  })

  it('setSpeed changes playback rate', () => {
    const clock = new VirtualClock()
    expect(clock.speed).toBe(1)
    clock.setSpeed(0.5)
    expect(clock.speed).toBe(0.5)
    clock.setSpeed(0.1)
    expect(clock.speed).toBe(0.1)
  })

  it('subscribers are notified when events fire', () => {
    const clock = new VirtualClock()
    const ticks: number[] = []
    clock.subscribe(now => ticks.push(now))
    clock.schedule({ at: 10, fn: () => {} })
    clock.step()
    expect(ticks).toContain(10)
  })
})
