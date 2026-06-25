// mock/MockLettuce.ts
import { MockRedis } from './MockRedis'
import { VirtualClock } from './VirtualClock'
import { MockCompletableFuture } from './MockCompletableFuture'
import { MockMono } from './MockMono'
import { hashSlot } from './crc16'
import type { Subscriber } from './types'

export interface SyncAPI {
  set(k: string, v: string): 'OK'
  get(k: string): string | null
  incr(k: string): number
  hset(k: string, f: string, v: string): number
  hget(k: string, f: string): string | null
  del(...keys: string[]): number
}

export interface AsyncAPI {
  set(k: string, v: string): MockCompletableFuture<'OK'>
  get(k: string): MockCompletableFuture<string | null>
  incr(k: string): MockCompletableFuture<number>
  hset(k: string, f: string, v: string): MockCompletableFuture<number>
  hget(k: string, f: string): MockCompletableFuture<string | null>
  del(...keys: string[]): MockCompletableFuture<number>
}

export interface ReactiveAPI {
  set(k: string, v: string): MockMono<'OK'>
  get(k: string): MockMono<string | null>
  incr(k: string): MockMono<number>
}

export interface ClusterNode {
  id: string
  url: string
  slots: [number, number][]
}

export interface ClusterAPI {
  set(k: string, v: string): MockCompletableFuture<'OK'>
  get(k: string): MockCompletableFuture<string | null>
  slotForKey(k: string): number
  nodeForKey(k: string): ClusterNode
}

// No-op stub clock for sync-only usage (no scheduling needed).
// Uses VirtualClock directly so type compatibility is guaranteed.
const noopClock = new VirtualClock()

export class MockLettuce {
  private latency = 5
  private _clock: VirtualClock

  constructor(private redis: MockRedis, clock?: VirtualClock) {
    this._clock = clock ?? noopClock
  }

  setLatency(ms: number): void { this.latency = ms }
  getLatency(): number { return this.latency }

  sync(): SyncAPI {
    const r = this.redis
    return {
      set: (k, v) => r.set(k, v),
      get: (k) => r.get(k),
      incr: (k) => r.incr(k),
      hset: (k, f, v) => r.hset(k, f, v),
      hget: (k, f) => r.hget(k, f),
      del: (...keys) => r.del(...keys)
    }
  }

  async(): AsyncAPI {
    const r = this.redis
    const clock = this._clock
    const schedule = <T>(fn: () => T): MockCompletableFuture<T> => {
      const future = new MockCompletableFuture<T>()
      clock.schedule({
        at: clock.now + this.latency,
        fn: () => {
          try { future.complete(fn()) } catch (e) { future.completeError(e as Error) }
        }
      })
      return future
    }
    return {
      set: (k, v) => schedule(() => r.set(k, v) as 'OK'),
      get: (k) => schedule(() => r.get(k)),
      incr: (k) => schedule(() => r.incr(k)),
      hset: (k, f, v) => schedule(() => r.hset(k, f, v)),
      hget: (k, f) => schedule(() => r.hget(k, f)),
      del: (...keys) => schedule(() => r.del(...keys))
    }
  }

  reactive(): ReactiveAPI {
    const async = this.async()
    const wrap = <T>(f: MockCompletableFuture<T>): MockMono<T> => {
      return new MockMono<T>((sub: Subscriber<T>) => {
        f.then(v => {
          sub.onNext(v)
          sub.onComplete?.()
        })
        f.catchError(e => sub.onError?.(e))
      })
    }
    return {
      set: (k, v) => wrap(async.set(k, v)),
      get: (k) => wrap(async.get(k)),
      incr: (k) => wrap(async.incr(k))
    }
  }

  cluster(nodes: ClusterNode[]): ClusterAPI {
    const r = this.redis
    const clock = this._clock
    const schedule = <T>(fn: () => T): MockCompletableFuture<T> => {
      const future = new MockCompletableFuture<T>()
      clock.schedule({
        at: clock.now + this.latency,
        fn: () => {
          try { future.complete(fn()) } catch (e) { future.completeError(e as Error) }
        }
      })
      return future
    }

    const nodeForKey = (k: string): ClusterNode => {
      const slot = hashSlot(k)
      for (const node of nodes) {
        for (const [lo, hi] of node.slots) {
          if (slot >= lo && slot <= hi) return node
        }
      }
      return nodes[0] // fallback
    }

    return {
      set: (k, v) => schedule(() => r.set(k, v) as 'OK'),
      get: (k) => schedule(() => r.get(k)),
      slotForKey: (k) => hashSlot(k),
      nodeForKey
    }
  }
}
