<!-- components/demos/JedisPoolDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import TimeControls from '../base/TimeControls.vue'
import { VirtualClock } from '../../mock/VirtualClock'

const clock = new VirtualClock()
onUnmounted(() => { clock.reset(); unsubscribe() })

const poolSize = ref(3)
const threadCount = ref(8)

interface ThreadState { id: string; status: 'idle' | 'waiting' | 'busy'; heldConn?: string }
const threads = ref<ThreadState[]>([])

interface PoolConn { id: string; borrowed: boolean; borrowedBy?: string }
const pool = ref<PoolConn[]>([])

const log = ref<string[]>([])

function pushLog(msg: string) {
  log.value.unshift(`${clock.now.toFixed(1)}ms  ${msg}`)
  if (log.value.length > 6) log.value.pop()
}

function reset() {
  clock.reset()
  threads.value = []
  pool.value = []
  log.value = []
}

function run() {
  reset()
  threads.value = Array.from({ length: threadCount.value }, (_, i) => ({
    id: `T${i + 1}`, status: 'idle' as const
  }))
  pool.value = Array.from({ length: poolSize.value }, (_, i) => ({
    id: `C${i + 1}`, borrowed: false
  }))
  threads.value.forEach((t, i) => {
    clock.schedule({
      at: i * 200,
      fn: () => borrowOrWait(t)
    })
  })
  clock.play()
}

function borrowOrWait(t: ThreadState) {
  const conn = pool.value.find(c => !c.borrowed)
  if (conn) {
    conn.borrowed = true
    conn.borrowedBy = t.id
    t.status = 'busy'
    t.heldConn = conn.id
    pushLog(`${t.id} ← ${conn.id}（借出）`)
    clock.schedule({
      at: clock.now + 1000,
      fn: () => {
        conn.borrowed = false
        conn.borrowedBy = undefined
        t.status = 'idle'
        t.heldConn = undefined
        pushLog(`${t.id} → ${conn.id}（归还）`)
      }
    })
  } else {
    t.status = 'waiting'
    pushLog(`${t.id} 等待中（池满）`)
    clock.schedule({
      at: clock.now + 300,
      fn: () => {
        if (t.status === 'waiting') borrowOrWait(t)
      }
    })
  }
}

const counts = computed(() => ({
  busy: threads.value.filter(t => t.status === 'busy').length,
  waiting: threads.value.filter(t => t.status === 'waiting').length,
  idle: threads.value.filter(t => t.status === 'idle').length,
  poolInUse: pool.value.filter(c => c.borrowed).length
}))

const statusLabel = (s: ThreadState['status']) =>
  s === 'busy' ? '⚡ 使用中' : s === 'waiting' ? '⏸ 等待' : '○ 空闲'

const unsubscribe = clock.subscribe(() => {
  threads.value = [...threads.value]
  pool.value = [...pool.value]
})
</script>

<template>
  <div class="demo">
    <h4>Jedis 连接池模型</h4>
    <p class="intro">
      {{ threadCount }} 个线程并发访问 Redis，但连接池只有 {{ poolSize }} 个连接。
      池满时，新线程必须<strong>等待</strong>其他线程归还连接。
    </p>

    <div class="params">
      <label>池大小: <input type="number" v-model.number="poolSize" min="1" max="20" /></label>
      <label>线程数: <input type="number" v-model.number="threadCount" min="1" max="20" /></label>
    </div>

    <TimeControls :clock="clock" :on-run="run" :on-reset="reset" run-label="载入并播放" />

    <!-- Counters -->
    <div class="counters">
      <span class="counter busy">⚡ 池使用 {{ counts.poolInUse }}/{{ poolSize }}</span>
      <span class="counter busy-t">⚡ 线程 busy {{ counts.busy }}</span>
      <span class="counter waiting">⏸ 线程 waiting {{ counts.waiting }}</span>
      <span class="counter idle">○ 线程 idle {{ counts.idle }}</span>
    </div>

    <!-- Pool visualization -->
    <div class="section">
      <div class="section-title">连接池（{{ poolSize }} 个连接）</div>
      <div class="pool">
        <div
          v-for="conn in pool"
          :key="conn.id"
          class="connection"
          :class="{ borrowed: conn.borrowed }"
        >
          <div class="conn-id">{{ conn.id }}</div>
          <div v-if="conn.borrowedBy" class="conn-holder">← {{ conn.borrowedBy }}</div>
          <div v-else class="conn-holder free">空闲</div>
        </div>
        <div v-if="pool.length === 0" class="empty-hint">(点击 载入并播放)</div>
      </div>
    </div>

    <!-- Threads grid -->
    <div class="section">
      <div class="section-title">线程（{{ threadCount }} 个）</div>
      <div class="threads">
        <div
          v-for="t in threads"
          :key="t.id"
          class="thread"
          :class="'status-' + t.status"
        >
          <div class="thread-id">{{ t.id }}</div>
          <div class="thread-status">{{ statusLabel(t.status) }}</div>
          <div v-if="t.heldConn" class="thread-held">holds {{ t.heldConn }}</div>
        </div>
        <div v-if="threads.length === 0" class="empty-hint">(点击 载入并播放)</div>
      </div>
    </div>

    <!-- Event log -->
    <div class="section" v-if="log.length > 0">
      <div class="section-title">事件日志</div>
      <div class="log">
        <div v-for="(line, i) in log" :key="i" class="log-line">{{ line }}</div>
      </div>
    </div>

    <p class="takeaway">
      <strong>观察：</strong>
      池满（pool 使用 = 池大小）时，新线程进入"等待"。调小池大小（如 1）会看到大量线程等待；调大到线程数（如 8）则无需等待。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.intro { font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; margin-bottom: 12px; }
.params { display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px; }
.params input { width: 60px; padding: 2px 4px; margin-left: 4px; }

.counters {
  display: flex; gap: 8px; flex-wrap: wrap;
  margin: 12px 0;
}
.counter {
  font-family: monospace; font-size: 12px;
  padding: 4px 10px; border-radius: 12px;
  border: 1px solid var(--vp-c-border);
}
.counter.busy { background: #fef3c7; color: #78350f; border-color: #d97706; }
.counter.busy-t { background: #dcfce7; color: #14532d; border-color: #16a34a; }
.counter.waiting { background: #fee2e2; color: #7f1d1d; border-color: #dc2626; }
.counter.idle { background: var(--vp-c-bg-soft); color: var(--vp-c-text-2); }

.section { margin: 16px 0; }
.section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
}

.pool { display: flex; gap: 8px; flex-wrap: wrap; }
.connection {
  width: 80px; padding: 8px;
  border: 2px solid var(--vp-c-border); border-radius: 6px;
  background: var(--vp-c-bg-soft); text-align: center;
  transition: all 0.2s;
}
.connection.borrowed {
  border-color: #d97706; background: #fef3c7;
  box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.2);
}
.conn-id { font-family: monospace; font-size: 13px; font-weight: 700; color: var(--vp-c-text-1); }
.conn-holder { font-size: 11px; margin-top: 4px; color: #78350f; font-weight: 600; }
.conn-holder.free { color: var(--vp-c-text-3); font-weight: 400; }

.threads { display: flex; gap: 6px; flex-wrap: wrap; }
.thread {
  width: 70px; padding: 6px;
  border: 2px solid var(--vp-c-border); border-radius: 6px;
  background: var(--vp-c-bg-soft); text-align: center;
  transition: all 0.2s;
}
.thread.status-busy { border-color: #16a34a; background: #dcfce7; }
.thread.status-waiting { border-color: #dc2626; background: #fee2e2; }
.thread.status-idle { border-color: var(--vp-c-border); }
.thread-id { font-family: monospace; font-size: 12px; font-weight: 700; }
.thread-status { font-size: 10px; margin-top: 2px; color: var(--vp-c-text-2); }
.thread-held { font-size: 9px; margin-top: 2px; color: var(--vp-c-text-3); font-family: monospace; }

.log {
  background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-border);
  border-radius: 4px; padding: 8px;
  font-family: monospace; font-size: 11px;
  max-height: 120px; overflow-y: auto;
}
.log-line { color: var(--vp-c-text-2); line-height: 1.5; }

.empty-hint { color: var(--vp-c-text-3); font-style: italic; font-size: 12px; }

.takeaway {
  font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6;
  margin-top: 16px; padding: 10px;
  background: var(--vp-c-brand-soft); border-left: 3px solid var(--vp-c-brand-1);
  border-radius: 4px;
}
</style>
