// tests/mock/MockMono.test.ts
import { describe, it, expect } from 'vitest'
import { MockMono } from '../../mock/MockMono'

describe('MockMono', () => {
  it('subscriber function runs on subscribe (cold)', () => {
    let sideEffect = 0
    const mono = new MockMono<string>(sub => {
      sideEffect++
      sub.onNext('hello')
      sub.onComplete?.()
    })
    expect(sideEffect).toBe(0) // not yet subscribed
    let received = ''
    mono.subscribe({ onNext: v => { received = v } })
    expect(sideEffect).toBe(1)
    expect(received).toBe('hello')
  })

  it('multiple subscribers each trigger the factory (cold)', () => {
    let count = 0
    const mono = new MockMono<number>(sub => {
      count++
      sub.onNext(count)
    })
    let r1 = 0, r2 = 0
    mono.subscribe({ onNext: v => { r1 = v } })
    mono.subscribe({ onNext: v => { r2 = v } })
    expect(r1).toBe(1)
    expect(r2).toBe(2)
  })

  it('map transforms emitted values', () => {
    const mono = new MockMono<number>(sub => sub.onNext(10))
    const mapped = mono.map(n => n * 3)
    let result = 0
    mapped.subscribe({ onNext: v => { result = v } })
    expect(result).toBe(30)
  })

  it('onComplete fires after onNext', () => {
    const mono = new MockMono<string>(sub => {
      sub.onNext('a')
      sub.onComplete?.()
    })
    let sequence: string[] = []
    mono.subscribe({
      onNext: v => sequence.push(`next:${v}`),
      onComplete: () => sequence.push('complete')
    })
    expect(sequence).toEqual(['next:a', 'complete'])
  })
})
