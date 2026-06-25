// mock/MockMono.ts
import type { Subscriber } from './types'

type MonoFactory<T> = (subscriber: Subscriber<T>) => void

export class MockMono<T> {
  constructor(private factory: MonoFactory<T>) {}

  subscribe(subscriber: Subscriber<T>): void {
    this.factory(subscriber)
  }

  map<U>(fn: (v: T) => U): MockMono<U> {
    const parent = this.factory
    return new MockMono<U>(sub => {
      parent({
        onNext: v => sub.onNext(fn(v)),
        onComplete: () => sub.onComplete?.(),
        onError: e => sub.onError?.(e)
      })
    })
  }
}
