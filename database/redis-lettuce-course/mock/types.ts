// Shared types for Mock layer

export type RedisString = string
export type RedisBulkString = string | null
export type RedisInteger = number
export type RedisArray = RedisValue[]
export type RedisValue = RedisString | RedisInteger | RedisBulkString | RedisArray | null

export interface RedisSnapshot {
  strings: Record<string, string>
  lists: Record<string, string[]>
  hashes: Record<string, Record<string, string>>
  sets: Record<string, string[]>
  zsets: Record<string, Array<{ member: string; score: number }>>
}

export interface TimedEvent {
  at: number
  fn: () => void
}

export type TimelineEventType = 'issue' | 'dispatch' | 'complete' | 'error'
export interface TimelineEvent {
  at: number
  label: string
  type: TimelineEventType
  color?: string
}

export interface QueueItem {
  id: string
  label: string
}

export interface Message {
  channel: string
  payload: string
}

export interface Subscriber<T> {
  onNext: (value: T) => void
  onComplete?: () => void
  onError?: (e: Error) => void
}
