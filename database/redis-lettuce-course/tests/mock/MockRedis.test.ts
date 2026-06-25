// tests/mock/MockRedis.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { MockRedis } from '../../mock/MockRedis'

describe('MockRedis', () => {
  let redis: MockRedis
  beforeEach(() => { redis = new MockRedis() })

  describe('String', () => {
    it('set/get round trip', () => {
      expect(redis.set('k', 'v')).toBe('OK')
      expect(redis.get('k')).toBe('v')
    })

    it('get missing key returns null', () => {
      expect(redis.get('nope')).toBeNull()
    })

    it('incr increments integer', () => {
      expect(redis.incr('counter')).toBe(1)
      expect(redis.incr('counter')).toBe(2)
    })

    it('del removes key', () => {
      redis.set('k', 'v')
      expect(redis.del('k')).toBe(1)
      expect(redis.get('k')).toBeNull()
    })

    it('expire/ttl/persist', () => {
      redis.set('k', 'v')
      redis.expire('k', 100)
      expect(redis.ttl('k')).toBe(100)
      redis.persist('k')
      expect(redis.ttl('k')).toBe(-1)
    })
  })

  describe('Hash', () => {
    it('hset/hget/hgetall', () => {
      redis.hset('h', 'f1', 'v1')
      redis.hset('h', 'f2', 'v2')
      expect(redis.hget('h', 'f1')).toBe('v1')
      expect(redis.hgetall('h')).toEqual({ f1: 'v1', f2: 'v2' })
    })

    it('hdel', () => {
      redis.hset('h', 'f1', 'v1')
      expect(redis.hdel('h', 'f1')).toBe(1)
      expect(redis.hget('h', 'f1')).toBeNull()
    })
  })

  describe('List', () => {
    it('lpush/rpush/lrange', () => {
      redis.rpush('list', 'a')
      redis.rpush('list', 'b')
      redis.lpush('list', 'z')
      expect(redis.lrange('list', 0, -1)).toEqual(['z', 'a', 'b'])
    })

    it('lpop/rpop', () => {
      redis.rpush('list', 'a', 'b', 'c')
      expect(redis.lpop('list')).toBe('a')
      expect(redis.rpop('list')).toBe('c')
      expect(redis.lrange('list', 0, -1)).toEqual(['b'])
    })
  })

  describe('Set', () => {
    it('sadd/smembers', () => {
      redis.sadd('s', 'a', 'b', 'c')
      const members = redis.smembers('s').sort()
      expect(members).toEqual(['a', 'b', 'c'])
    })
  })

  describe('Zset', () => {
    it('zadd/zrange', () => {
      redis.zadd('z', 1, 'a')
      redis.zadd('z', 3, 'c')
      redis.zadd('z', 2, 'b')
      expect(redis.zrange('z', 0, -1)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('Pub/Sub', () => {
    it('publish delivers to subscribers', () => {
      const received: string[] = []
      redis.subscribe('chan', msg => received.push(msg.payload))
      redis.publish('chan', 'hello')
      expect(received).toEqual(['hello'])
    })

    it('unsubscribe stops delivery', () => {
      const received: string[] = []
      const unsub = redis.subscribe('chan', msg => received.push(msg.payload))
      redis.publish('chan', 'a')
      unsub()
      redis.publish('chan', 'b')
      expect(received).toEqual(['a'])
    })
  })

  describe('Tracking (client caching)', () => {
    it('trackEnable registers callback, invalidate notifies it', () => {
      const invalidated: string[] = []
      redis.trackEnable('client1', key => invalidated.push(key))
      redis.invalidate('mykey')
      expect(invalidated).toEqual(['mykey'])
    })

    it('set triggers invalidation for the modified key', () => {
      const invalidated: string[] = []
      redis.trackEnable('client1', key => invalidated.push(key))
      redis.set('mykey', 'v')
      expect(invalidated).toEqual(['mykey'])
    })

    it('del triggers invalidation for deleted keys', () => {
      const invalidated: string[] = []
      redis.trackEnable('client1', key => invalidated.push(key))
      redis.set('k1', 'v')
      redis.set('k2', 'v')
      invalidated.length = 0 // clear notifications from the two sets above
      redis.del('k1', 'k2')
      expect(invalidated).toEqual(['k1', 'k2'])
    })

    it('incr triggers invalidation', () => {
      const invalidated: string[] = []
      redis.trackEnable('client1', key => invalidated.push(key))
      redis.incr('counter')
      expect(invalidated).toEqual(['counter'])
    })

    it('hset triggers invalidation', () => {
      const invalidated: string[] = []
      redis.trackEnable('client1', key => invalidated.push(key))
      redis.hset('h', 'f', 'v')
      expect(invalidated).toEqual(['h'])
    })

    it('trackDisable stops notifications', () => {
      const invalidated: string[] = []
      redis.trackEnable('client1', key => invalidated.push(key))
      redis.trackDisable('client1')
      redis.set('mykey', 'v')
      expect(invalidated).toEqual([])
    })

    it('multiple clients each get notified', () => {
      const c1: string[] = []
      const c2: string[] = []
      redis.trackEnable('client1', key => c1.push(key))
      redis.trackEnable('client2', key => c2.push(key))
      redis.set('shared', 'v')
      expect(c1).toEqual(['shared'])
      expect(c2).toEqual(['shared'])
    })
  })

  describe('Lua eval stub', () => {
    it('eval does not throw', () => {
      expect(() => redis.eval('return 1', [], [])).not.toThrow()
    })

    it('eval with return returns last arg or 1', () => {
      expect(redis.eval('return KEYS[1]', ['mykey'], [])).toBe(1)
      expect(redis.eval('return ARGV[1]', [], ['hello'])).toBe('hello')
    })

    it('eval without return returns null', () => {
      expect(redis.eval('local x = 1', [], [])).toBeNull()
    })
  })

  describe('_dump', () => {
    it('produces snapshot of current state', () => {
      redis.set('s1', 'v1')
      redis.hset('h1', 'f', 'v')
      const snapshot = redis._dump()
      expect(snapshot.strings).toEqual({ s1: 'v1' })
      expect(snapshot.hashes).toEqual({ h1: { f: 'v' } })
    })
  })
})
