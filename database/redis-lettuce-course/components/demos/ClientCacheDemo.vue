<!-- components/demos/ClientCacheDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import TimeControls from '../base/TimeControls.vue'
import MockRedisPanel from '../base/MockRedisPanel.vue'
import { VirtualClock } from '../../mock/VirtualClock'
import { MockRedis } from '../../mock/MockRedis'
import type { RedisSnapshot } from '../../mock/types'

const clock = new VirtualClock()
const redis = new MockRedis()
onUnmounted(() => { clock.reset(); unsubscribe() })

const keyInput = ref('user:1')
const valueInput = ref('Alice')

// Client A cache (first client, has tracking)
const clientACache = ref<Map<string, string>>(new Map())
// Client B (second client, modifies data)
const clientBActive = ref(false)

// Tracking invalidation log
const invalidations = ref<string[]>([])

// Event log
const log = ref<string[]>([])

function pushLog(msg: string) {
  log.value.unshift(`${clock.now.toFixed(1)}ms  ${msg}`)
  if (log.value.length > 8) log.value.pop()
}

function reset() {
  clock.reset()
  clientACache.value = new Map()
  clientBActive.value = false
  invalidations.value = []
  log.value = []
}

function run() {
  reset()

  // Enable tracking for Client A
  redis.trackEnable('client-a', (key: string) => {
    invalidations.value.unshift(`INVALIDATE: ${key}`)
    if (invalidations.value.length > 6) invalidations.value.pop()
    clientACache.value.delete(key)
    clientACache.value = new Map(clientACache.value)
    pushLog(`Client A 收到失效通知: ${key} 已从缓存移除`)
  })
  pushLog('Client A 开启 tracking')

  // Step 1: Client A GET -> cache miss -> fetch from Redis
  clock.schedule({
    at: 0,
    fn: () => {
      pushLog(`Client A GET ${keyInput.value}...`)
      clock.schedule({
        at: clock.now + 1000,
        fn: () => {
          const val = redis.get(keyInput.value)
          if (val === null) {
            // Key doesn't exist, SET first
            redis.set(keyInput.value, valueInput.value)
            clientACache.value.set(keyInput.value, valueInput.value)
            clientACache.value = new Map(clientACache.value)
            pushLog(`缓存未命中，从 Redis 加载: ${keyInput.value} = ${valueInput.value}`)
          } else {
            clientACache.value.set(keyInput.value, val)
            clientACache.value = new Map(clientACache.value)
            pushLog(`缓存未命中，从 Redis 加载: ${keyInput.value} = ${val}`)
          }
        }
      })
    }
  })

  // Step 2: Client A GET again -> cache hit
  clock.schedule({
    at: 2500,
    fn: () => {
      pushLog(`Client A GET ${keyInput.value}...`)
      clock.schedule({
        at: clock.now + 500,
        fn: () => {
          if (clientACache.value.has(keyInput.value)) {
            pushLog(`缓存命中! ${keyInput.value} = ${clientACache.value.get(keyInput.value)} (无需访问 Redis)`)
          }
        }
      })
    }
  })

  // Step 3: Client B modifies the key -> invalidation flows to Client A
  clock.schedule({
    at: 4000,
    fn: () => {
      clientBActive.value = true
      pushLog(`Client B SET ${keyInput.value} Bob...`)
      clock.schedule({
        at: clock.now + 1000,
        fn: () => {
          redis.set(keyInput.value, 'Bob')
          pushLog(`Client B 修改完成: ${keyInput.value} = Bob`)
          clientBActive.value = false
        }
      })
    }
  })

  // Step 4: Client A GET -> cache miss again (was invalidated)
  clock.schedule({
    at: 6500,
    fn: () => {
      pushLog(`Client A GET ${keyInput.value}...`)
      clock.schedule({
        at: clock.now + 1000,
        fn: () => {
          const val = redis.get(keyInput.value)
          clientACache.value.set(keyInput.value, val ?? '')
          clientACache.value = new Map(clientACache.value)
          pushLog(`缓存失效后重新加载: ${keyInput.value} = ${val}`)
        }
      })
    }
  })

  clock.play()
}

const snapshot = ref<RedisSnapshot>({ strings: {}, lists: {}, hashes: {}, sets: {}, zsets: {} })
const unsubRedis = (() => {
  // Poll snapshot periodically
  let id: ReturnType<typeof setInterval>
  id = setInterval(() => {
    snapshot.value = redis._dump()
  }, 200)
  return () => clearInterval(id)
})()

const unsubscribe = clock.subscribe(() => {
  snapshot.value = redis._dump()
})
</script>

<template>
  <div class="demo">
    <h4>Client-side Caching (Tracking) 演示</h4>
    <p class="intro">
      Client A 开启了 Redis tracking。第一次 GET 从 Redis 加载并缓存。
      Client B 修改 key 后，Redis 自动发送失效通知给 Client A，缓存被清除。
    </p>

    <div class="params">
      <label>Key: <input v-model="keyInput" data-test="key" /></label>
      <label>Value: <input v-model="valueInput" data-test="value" /></label>
    </div>

    <TimeControls :clock="clock" :on-run="run" :on-reset="reset" run-label="载入并播放" />

    <!-- Three-column layout -->
    <div class="layout">
      <!-- Client A -->
      <div class="col client-a">
        <div class="col-title" :class="{ active: true }">Client A (tracking)</div>
        <div class="cache-box">
          <div class="cache-label">本地缓存</div>
          <div class="cache-items">
            <div v-for="[k, v] in clientACache" :key="k" class="cache-item">
              <span class="cache-key">{{ k }}</span>
              <span class="cache-val">= {{ v }}</span>
            </div>
            <div v-if="clientACache.size === 0" class="cache-empty">(空)</div>
          </div>
        </div>
        <div class="inval-section" v-if="invalidations.length > 0">
          <div class="cache-label">失效通知</div>
          <div v-for="(inv, i) in invalidations" :key="i" class="inval-item">{{ inv }}</div>
        </div>
      </div>

      <!-- Redis -->
      <div class="col redis-col">
        <div class="col-title">Redis Server</div>
        <MockRedisPanel :snapshot="snapshot" />
      </div>

      <!-- Client B -->
      <div class="col client-b">
        <div class="col-title" :class="{ active: clientBActive }">Client B (修改者)</div>
        <div class="client-b-box">
          <div v-if="!clientBActive" class="idle">空闲</div>
          <div v-else class="active">正在修改 {{ keyInput }}...</div>
        </div>
      </div>
    </div>

    <!-- Log -->
    <div class="section" v-if="log.length > 0">
      <div class="section-title">事件日志</div>
      <div class="log">
        <div v-for="(line, i) in log" :key="i" class="log-line">{{ line }}</div>
      </div>
    </div>

    <p class="takeaway">
      <strong>观察：</strong>
      1) Client A 首次 GET → 缓存未命中 → 从 Redis 加载并缓存。
      2) Client A 再次 GET → 缓存命中 → 无需访问 Redis。
      3) Client B 修改 key → Redis 发送 INVALIDATE → Client A 缓存被清除。
      4) Client A 再 GET → 缓存已失效 → 重新从 Redis 加载。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.intro { font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; margin-bottom: 12px; }
.params { display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px; }
.params input { width: 120px; padding: 3px 6px; border: 1px solid var(--vp-c-border); border-radius: 3px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font-family: monospace; }

.layout { display: flex; gap: 12px; margin: 12px 0; flex-wrap: wrap; }
.col { flex: 1; min-width: 200px; }
.col-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
  padding: 4px 8px; border-radius: 4px;
}
.col-title.active { color: #16a34a; background: #dcfce7; border: 1px solid #16a34a; }

.cache-box {
  border: 1px solid var(--vp-c-border); border-radius: 6px;
  padding: 8px; background: var(--vp-c-bg-soft);
}
.cache-label {
  font-size: 10px; text-transform: uppercase; color: var(--vp-c-text-3);
  margin-bottom: 4px; font-weight: 600;
}
.cache-items { font-family: monospace; font-size: 12px; }
.cache-item { padding: 2px 0; }
.cache-key { color: #d97706; }
.cache-val { color: var(--vp-c-text-1); }
.cache-empty { color: var(--vp-c-text-3); font-style: italic; font-size: 11px; }

.inval-section { margin-top: 8px; }
.inval-item {
  font-family: monospace; font-size: 11px;
  color: #dc2626; padding: 2px 0;
}

.redis-col { flex: 1.2; min-width: 220px; }

.client-b-box {
  border: 1px solid var(--vp-c-border); border-radius: 6px;
  padding: 20px 8px; text-align: center;
  background: var(--vp-c-bg-soft); font-size: 12px;
}
.idle { color: var(--vp-c-text-3); font-style: italic; }
.active { color: #2563eb; font-weight: 600; font-family: monospace; }

.section { margin: 12px 0; }
.section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
}

.log {
  background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-border);
  border-radius: 4px; padding: 8px;
  font-family: monospace; font-size: 11px;
  max-height: 120px; overflow-y: auto;
}
.log-line { color: var(--vp-c-text-2); line-height: 1.5; }

.takeaway {
  font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6;
  margin-top: 16px; padding: 10px;
  background: var(--vp-c-brand-soft); border-left: 3px solid var(--vp-c-brand-1);
  border-radius: 4px;
}
</style>
