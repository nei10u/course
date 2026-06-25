// tests/mock/MockLettuce.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { MockRedis } from '../../mock/MockRedis'
import { MockLettuce } from '../../mock/MockLettuce'
import { VirtualClock } from '../../mock/VirtualClock'

describe('MockLettuce', () => {
  let redis: MockRedis
  let clock: VirtualClock
  let lett: MockLettuce

  beforeEach(() => {
    redis = new MockRedis()
    clock = new VirtualClock()
    lett = new MockLettuce(redis, clock)
  })

  describe('sync API', () => {
    it('returns values immediately', () => {
      const conn = lett.sync()
      conn.set('k', 'v')
      expect(conn.get('k')).toBe('v')
    })
  })

  describe('async API', () => {
    it('returns CompletableFuture that completes when clock steps', () => {
      const conn = lett.async()
      const future = conn.set('k', 'v')
      let result = ''
      future.then(v => { result = v })
      expect(result).toBe('') // not yet completed
      clock.step()
      expect(result).toBe('OK')
      // Verify the value was stored via sync API since async just completed
      expect(redis.get('k')).toBe('v')
    })

    it('thenApply chains across clock steps', () => {
      const conn = lett.async()
      const future = conn.set('k', 'v').thenApply(_ => redis.get('k'))
      let result: string | null = ''
      future.then((v: string | null) => { result = v })
      clock.step() // set completes, triggers thenApply which resolves immediately
      expect(result).toBe('v')
    })
  })

  describe('reactive API', () => {
    it('emits on subscribe when clock steps', () => {
      const conn = lett.reactive()
      let received = ''
      let completed = false
      conn.set('k', 'v').subscribe({
        onNext: v => { received = v },
        onComplete: () => { completed = true }
      })
      expect(received).toBe('')
      clock.step()
      expect(received).toBe('OK')
      expect(completed).toBe(true)
    })
  })

  describe('sync API without clock', () => {
    it('sync API works without a clock', () => {
      const redis = new MockRedis()
      const lett = new MockLettuce(redis)
      const conn = lett.sync()
      conn.set('k', 'v')
      expect(conn.get('k')).toBe('v')
    })
  })

  describe('timing', () => {
    it('latency can be configured', () => {
      lett.setLatency(50)
      const conn = lett.async()
      conn.set('k', 'v')
      clock.step() // advance to event at 50
      expect(clock.now).toBe(50)
    })
  })

  describe('cluster API', () => {
    it('slotForKey uses CRC16 correctly', () => {
      const nodes: Array<{ id: string; url: string; slots: [number, number][] }> = [
        { id: 'a', url: 'redis://a:7000', slots: [[0, 5460]] },
        { id: 'b', url: 'redis://b:7001', slots: [[5461, 10922]] },
        { id: 'c', url: 'redis://c:7002', slots: [[10923, 16383]] }
      ]
      const cluster = lett.cluster(nodes)
      // hashSlot('foo') = 12182 (from crc16 test)
      expect(cluster.slotForKey('foo')).toBe(12182)
      // hashSlot('bar') = 5061
      expect(cluster.slotForKey('bar')).toBe(5061)
    })

    it('nodeForKey returns the correct node for a key', () => {
      const nodes: Array<{ id: string; url: string; slots: [number, number][] }> = [
        { id: 'a', url: 'redis://a:7000', slots: [[0, 5460]] },
        { id: 'b', url: 'redis://b:7001', slots: [[5461, 10922]] },
        { id: 'c', url: 'redis://c:7002', slots: [[10923, 16383]] }
      ]
      const cluster = lett.cluster(nodes)
      // hashSlot('foo') = 12182 -> node c (10923-16383)
      const nodeFoo = cluster.nodeForKey('foo')
      expect(nodeFoo.id).toBe('c')
      // hashSlot('bar') = 5061 -> node a (0-5460)
      const nodeBar = cluster.nodeForKey('bar')
      expect(nodeBar.id).toBe('a')
    })

    it('cluster set/get routes to underlying redis', () => {
      const nodes: Array<{ id: string; url: string; slots: [number, number][] }> = [
        { id: 'a', url: 'redis://a:7000', slots: [[0, 16383]] }
      ]
      const cluster = lett.cluster(nodes)
      const future = cluster.set('k', 'v')
      let result: string | null = null
      future.then(() => {
        const getFut = cluster.get('k')
        getFut.then(v => { result = v })
      })
      clock.step() // set completes
      clock.step() // get completes
      expect(result).toBe('v')
    })
  })
})
