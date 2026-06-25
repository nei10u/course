// tests/mock/crc16.test.ts
import { describe, it, expect } from 'vitest'
import { crc16, hashSlot } from '../../mock/crc16'

describe('crc16 (CRC16-CCITT XMODEM)', () => {
  // Canonical Redis CRC16 raw values (computed via poly 0x1021, init 0)
  it('returns 44950 for "foo"', () => {
    expect(crc16('foo')).toBe(44950)
  })

  it('returns 37829 for "bar"', () => {
    expect(crc16('bar')).toBe(37829)
  })

  it('returns 4813 for "baz"', () => {
    expect(crc16('baz')).toBe(4813)
  })

  it('returns 0 for empty string', () => {
    expect(crc16('')).toBe(0)
  })
})

describe('hashSlot', () => {
  it('computes slot = crc16 % 16384', () => {
    // 44950 % 16384 = 12182, 37829 % 16384 = 5061
    expect(hashSlot('foo')).toBe(12182)
    expect(hashSlot('bar')).toBe(5061)
  })

  it('handles hash tags {tag}', () => {
    expect(hashSlot('{foo}bar')).toBe(12182)  // uses foo only
    expect(hashSlot('bar{foo}')).toBe(12182)
  })
})
