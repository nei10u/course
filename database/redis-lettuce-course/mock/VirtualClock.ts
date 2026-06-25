// mock/VirtualClock.ts
import type { TimedEvent } from './types'

// performance.now() when available; falls back to Date.now().
// Both return real wall-clock ms. Tests fake performance.now() to 0.
const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

export class VirtualClock {
  private events: TimedEvent[] = []
  private _now = 0
  private _mode: 'paused' | 'playing' = 'paused'
  private _speed = 1
  private listeners = new Set<(now: number) => void>()
  private rafId: number | null = null
  private lastFrameTime = 0

  get now(): number { return this._now }
  get mode(): 'paused' | 'playing' { return this._mode }
  get speed(): number { return this._speed }
  get hasEvents(): boolean { return this.events.length > 0 }

  schedule(event: TimedEvent): void {
    this.events.push(event)
    this.events.sort((a, b) => a.at - b.at)
  }

  play(): void {
    if (this._mode === 'playing') return
    if (this.events.length === 0) return  // nothing to play
    this._mode = 'playing'
    this.lastFrameTime = now()
    const tick = (t: number) => {
      if (this._mode !== 'playing') return
      const delta = (t - this.lastFrameTime) * this._speed
      this.lastFrameTime = t
      this.advance(delta)
      if (this._mode === 'playing') {
        this.rafId = requestAnimationFrame(tick)
      }
    }
    this.rafId = requestAnimationFrame(tick)
  }

  pause(): void {
    this._mode = 'paused'
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  step(): void {
    if (this.events.length === 0) return
    const next = this.events.shift()!
    this._now = next.at
    next.fn()
    this.notify()
  }

  setSpeed(s: number): void {
    this._speed = s
    if (this._mode === 'playing') {
      this.lastFrameTime = now()
    }
  }

  reset(): void {
    this.pause()
    this.events = []
    this._now = 0
    this.notify()
  }

  subscribe(fn: (now: number) => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private advance(delta: number): void {
    const target = this._now + delta
    while (this.events.length > 0 && this.events[0].at <= target) {
      const next = this.events.shift()!
      this._now = next.at
      next.fn()
      this.notify()
    }
    this._now = target
    this.notify()
    // Auto-pause when no more events to fire (playback finished)
    if (this.events.length === 0) {
      this.pause()
    }
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this._now)
  }
}
