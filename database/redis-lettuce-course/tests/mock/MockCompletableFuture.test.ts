// tests/mock/MockCompletableFuture.test.ts
import { describe, it, expect } from 'vitest'
import { MockCompletableFuture } from '../../mock/MockCompletableFuture'

describe('MockCompletableFuture', () => {
  it('callbacks fire when complete is called', () => {
    const future = new MockCompletableFuture<string>()
    let result = ''
    future.then(v => { result = v })
    expect(result).toBe('')
    future.complete('done')
    expect(result).toBe('done')
  })

  it('thenApply chains transformations', () => {
    const future = new MockCompletableFuture<number>()
    const transformed = future.thenApply(n => n * 2)
    let result = 0
    transformed.then(v => { result = v })
    future.complete(21)
    expect(result).toBe(42)
  })

  it('callbacks registered after completion fire immediately', () => {
    const future = new MockCompletableFuture<string>()
    future.complete('already-done')
    let result = ''
    future.then(v => { result = v })
    expect(result).toBe('already-done')
  })

  it('thenApply chain across multiple steps', () => {
    const f1 = new MockCompletableFuture<number>()
    const f2 = f1.thenApply(n => n + 1)
    const f3 = f2.thenApply(n => n * 10)
    let result = 0
    f3.then(v => { result = v })
    f1.complete(5)
    expect(result).toBe(60)
  })

  it('error handling propagates', () => {
    const future = new MockCompletableFuture<string>()
    const caught: Error[] = []
    future.catchError((e: Error) => { caught.push(e) })
    future.completeError(new Error('boom'))
    expect(caught[0].message).toBe('boom')
  })
})
