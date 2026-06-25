// mock/crc16.ts

// CRC16-CCITT (XMODEM) polynomial 0x1021
// This is the variant Redis uses for hash slot computation.
// Ported from Redis's crc16.c implementation.

const TABLE: number[] = (() => {
  const table = new Array<number>(256)
  for (let i = 0; i < 256; i++) {
    let crc = i << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
    table[i] = crc
  }
  return table
})()

export function crc16(input: string): number {
  let crc = 0
  for (let i = 0; i < input.length; i++) {
    crc = (crc << 8) ^ TABLE[((crc >> 8) & 0xff) ^ (input.charCodeAt(i) & 0xff)]
  }
  return crc & 0xffff
}

export function hashSlot(key: string): number {
  // Redis hash tag support: if key contains {...}, use only the substring inside {}
  const match = key.match(/\{([^}]*)\}/)
  const effective = match && match[1] ? match[1] : key
  return crc16(effective) % 16384
}
