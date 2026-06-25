// mock/MockRedis.ts
import type { Message, RedisSnapshot } from './types'

type SubFn = (msg: Message) => void
type TrackFn = (key: string) => void

export class MockRedis {
  private strings = new Map<string, string>()
  private lists = new Map<string, string[]>()
  private hashes = new Map<string, Map<string, string>>()
  private sets = new Map<string, Set<string>>()
  private zsets = new Map<string, Map<string, number>>() // member -> score
  private expires = new Map<string, number>()
  private channels = new Map<string, Set<SubFn>>()
  private trackingClients = new Map<string, TrackFn>()

  // ===== String =====
  set(key: string, value: string, _opts?: { ex?: number }): 'OK' {
    this.strings.set(key, value)
    this.invalidate(key)
    return 'OK'
  }

  get(key: string): string | null {
    this.checkExpire(key)
    return this.strings.get(key) ?? null
  }

  incr(key: string): number {
    const cur = parseInt(this.strings.get(key) ?? '0', 10)
    const next = cur + 1
    this.strings.set(key, String(next))
    this.invalidate(key)
    return next
  }

  del(...keys: string[]): number {
    let count = 0
    for (const key of keys) {
      let removed = false
      if (this.strings.delete(key)) removed = true
      if (this.lists.delete(key)) removed = true
      if (this.hashes.delete(key)) removed = true
      if (this.sets.delete(key)) removed = true
      if (this.zsets.delete(key)) removed = true
      if (removed) {
        count++
        this.invalidate(key)
      }
    }
    return count
  }

  expire(key: string, seconds: number): 1 | 0 {
    if (!this.has(key)) return 0
    this.expires.set(key, seconds)
    return 1
  }

  persist(key: string): 1 | 0 {
    return this.expires.delete(key) ? 1 : 0
  }

  ttl(key: string): number {
    if (!this.has(key)) return -2
    if (!this.expires.has(key)) return -1
    return this.expires.get(key)!
  }

  // ===== Hash =====
  hset(key: string, field: string, value: string): number {
    let h = this.hashes.get(key)
    if (!h) { h = new Map(); this.hashes.set(key, h) }
    const isNew = !h.has(field)
    h.set(field, value)
    this.invalidate(key)
    return isNew ? 1 : 0
  }

  hget(key: string, field: string): string | null {
    return this.hashes.get(key)?.get(field) ?? null
  }

  hgetall(key: string): Record<string, string> {
    const h = this.hashes.get(key)
    if (!h) return {}
    const result: Record<string, string> = {}
    for (const [f, v] of h) result[f] = v
    return result
  }

  hdel(key: string, ...fields: string[]): number {
    const h = this.hashes.get(key)
    if (!h) return 0
    let count = 0
    for (const f of fields) if (h.delete(f)) count++
    return count
  }

  // ===== List =====
  rpush(key: string, ...values: string[]): number {
    let l = this.lists.get(key)
    if (!l) { l = []; this.lists.set(key, l) }
    l.push(...values)
    return l.length
  }

  lpush(key: string, ...values: string[]): number {
    let l = this.lists.get(key)
    if (!l) { l = []; this.lists.set(key, l) }
    l.unshift(...values)
    return l.length
  }

  lpop(key: string): string | null {
    const l = this.lists.get(key)
    if (!l || l.length === 0) return null
    return l.shift() ?? null
  }

  rpop(key: string): string | null {
    const l = this.lists.get(key)
    if (!l || l.length === 0) return null
    return l.pop() ?? null
  }

  lrange(key: string, start: number, stop: number): string[] {
    const l = this.lists.get(key)
    if (!l) return []
    const len = l.length
    if (start < 0) start = Math.max(0, len + start)
    if (stop < 0) stop = len + stop
    return l.slice(start, stop + 1)
  }

  // ===== Set =====
  sadd(key: string, ...members: string[]): number {
    let s = this.sets.get(key)
    if (!s) { s = new Set(); this.sets.set(key, s) }
    let count = 0
    for (const m of members) if (!s.has(m)) { s.add(m); count++ }
    return count
  }

  smembers(key: string): string[] {
    const s = this.sets.get(key)
    if (!s) return []
    return Array.from(s)
  }

  // ===== Zset =====
  zadd(key: string, score: number, member: string): number {
    let z = this.zsets.get(key)
    if (!z) { z = new Map(); this.zsets.set(key, z) }
    const isNew = !z.has(member)
    z.set(member, score)
    return isNew ? 1 : 0
  }

  zrange(key: string, start: number, stop: number): string[] {
    const z = this.zsets.get(key)
    if (!z) return []
    const sorted = Array.from(z.entries()).sort((a, b) => a[1] - b[1])
    const len = sorted.length
    if (start < 0) start = Math.max(0, len + start)
    if (stop < 0) stop = len + stop
    return sorted.slice(start, stop + 1).map(([m]) => m)
  }

  // ===== Pub/Sub =====
  subscribe(channel: string, fn: SubFn): () => void {
    let subs = this.channels.get(channel)
    if (!subs) { subs = new Set(); this.channels.set(channel, subs) }
    subs.add(fn)
    return () => { subs!.delete(fn) }
  }

  publish(channel: string, payload: string): number {
    const subs = this.channels.get(channel)
    if (!subs) return 0
    const msg: Message = { channel, payload }
    for (const fn of subs) fn(msg)
    return subs.size
  }

  // ===== Tracking (client caching) =====
  trackEnable(clientId: string, fn: TrackFn): void {
    this.trackingClients.set(clientId, fn)
  }

  trackDisable(clientId: string): void {
    this.trackingClients.delete(clientId)
  }

  invalidate(key: string): void {
    for (const fn of this.trackingClients.values()) {
      fn(key)
    }
  }

  // ===== Lua eval stub =====
  eval(script: string, _keys: string[], args: string[]): any {
    if (script.includes('return')) {
      return args.length > 0 ? args[args.length - 1] : 1
    }
    return null
  }

  // ===== Internal =====
  _dump(): RedisSnapshot {
    const snapshot: RedisSnapshot = { strings: {}, lists: {}, hashes: {}, sets: {}, zsets: {} }
    for (const [k, v] of this.strings) snapshot.strings[k] = v
    for (const [k, v] of this.lists) snapshot.lists[k] = [...v]
    for (const [k, h] of this.hashes) {
      const obj: Record<string, string> = {}
      for (const [f, v] of h) obj[f] = v
      snapshot.hashes[k] = obj
    }
    for (const [k, s] of this.sets) snapshot.sets[k] = Array.from(s)
    for (const [k, z] of this.zsets) {
      snapshot.zsets[k] = Array.from(z.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([member, score]) => ({ member, score }))
    }
    return snapshot
  }

  private has(key: string): boolean {
    return this.strings.has(key) || this.lists.has(key) ||
      this.hashes.has(key) || this.sets.has(key) || this.zsets.has(key)
  }

  private checkExpire(_key: string): void {
    // Simplified: real expire-time check omitted; tests use ttl() directly.
  }
}
