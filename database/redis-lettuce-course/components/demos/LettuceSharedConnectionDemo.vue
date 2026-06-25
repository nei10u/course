<!-- components/demos/LettuceSharedConnectionDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import TimeControls from '../base/TimeControls.vue'
import { VirtualClock } from '../../mock/VirtualClock'
import type { QueueItem } from '../../mock/types'

const clock = new VirtualClock()
onUnmounted(() => { clock.reset(); unsubscribe() })

const threadCount = ref(8)
const queue = ref<QueueItem[]>([])
const processing = ref<string | null>(null)

interface ThreadState { id: string; issued: number }
const threads = ref<ThreadState[]>([])

const log = ref<string[]>([])
let totalToProcess = 0
let processed = 0

function pushLog(msg: string) {
  log.value.unshift(`${clock.now.toFixed(1)}ms  ${msg}`)
  if (log.value.length > 6) log.value.pop()
}

function reset() {
  clock.reset()
  queue.value = []
  processing.value = null
  threads.value = []
  log.value = []
  totalToProcess = 0
  processed = 0
  loopActive = false
}

function run() {
  reset()
  threads.value = Array.from({ length: threadCount.value }, (_, i) => ({
    id: `T${i + 1}`, issued: 0
  }))
  totalToProcess = threadCount.value * 3

  threads.value.forEach((t, ti) => {
    for (let n = 0; n < 3; n++) {
      clock.schedule({
        at: ti * 50 + n * 400,
        fn: () => {
          queue.value.push({ id: `${t.id}-${n}`, label: `${t.id}:SET` })
          t.issued++
          pushLog(`${t.id} 发出 SET #${n + 1}`)
          queue.value = [...queue.value]
          maybeStartLoop()
        }
      })
    }
  })
  clock.play()
}

let loopActive = false

function maybeStartLoop() {
  if (loopActive) return
  if (queue.value.length === 0) return
  loopActive = true
  clock.schedule({ at: clock.now + 100, fn: processOne })
}

function processOne() {
  if (queue.value.length === 0) {
    loopActive = false
    return
  }
  const item = queue.value.shift()!
  queue.value = [...queue.value]
  processing.value = item.label
  processed++
  pushLog(`event loop 处理 ${item.label}`)
  clock.schedule({
    at: clock.now + 100,
    fn: () => {
      processing.value = null
      if (processed >= totalToProcess) {
        loopActive = false
        pushLog(`全部完成（${processed} 条命令）`)
      } else if (queue.value.length > 0) {
        processOne()
      } else {
        loopActive = false
      }
    }
  })
}

const totalIssued = computed(() => threads.value.reduce((s, t) => s + t.issued, 0))
const totalTarget = computed(() => threadCount.value * 3)

const unsubscribe = clock.subscribe(() => {
  threads.value = [...threads.value]
})
</script>

<template>
  <div class="demo">
    <h4>Lettuce 单连接 + 共享 event loop</h4>
    <p class="intro">
      {{ threadCount }} 个线程共享<strong>一个</strong>连接。所有命令进入同一队列，
      由单个 event loop 顺序处理。<strong>无需连接池</strong>。
    </p>

    <div class="params">
      <label>线程数: <input type="number" v-model.number="threadCount" min="1" max="20" /></label>
    </div>

    <TimeControls :clock="clock" :on-run="run" :on-reset="reset" run-label="载入并播放" />

    <!-- Counters -->
    <div class="counters">
      <span class="counter">连接数: 1</span>
      <span class="counter">命令发出: {{ totalIssued }}/{{ totalTarget }}</span>
      <span class="counter">队列长度: {{ queue.length }}</span>
      <span class="counter">已处理: {{ processed }}/{{ totalTarget }}</span>
    </div>

    <!-- Main visualization -->
    <div class="layout">
      <!-- Threads column -->
      <div class="col">
        <div class="col-title">线程（生产者）</div>
        <div class="threads">
          <div v-for="t in threads" :key="t.id" class="thread">
            <span class="t-id">{{ t.id }}</span>
            <span class="t-count">{{ t.issued }}/3</span>
          </div>
          <div v-if="threads.length === 0" class="empty-hint">(空)</div>
        </div>
      </div>

      <!-- Arrow -->
      <div class="arrow">→<div class="arrow-label">发出命令</div></div>

      <!-- Single connection -->
      <div class="connection-box">
        <div class="conn-title">⚠ 只有一个连接</div>

        <div class="queue-area">
          <div class="area-label">
            队列（{{ queue.length }}）
            <span class="hint">命令在此等待</span>
          </div>
          <div class="queue">
            <span v-for="item in queue" :key="item.id" class="q-item">{{ item.label }}</span>
            <span v-if="queue.length === 0" class="q-empty">空</span>
          </div>
        </div>

        <div class="proc-area">
          <div class="area-label">
            Event loop
            <span class="hint">单线程顺序处理</span>
          </div>
          <div class="processing">
            <span v-if="processing" class="proc-active">⚡ 处理中: {{ processing }}</span>
            <span v-else class="proc-idle">○ 空闲</span>
          </div>
        </div>
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
      <strong>对比 Jedis：</strong>
      无论线程多少，只有一个连接、一个队列、一个 event loop。
      命令在连接内排队，不会冲突，所以<strong>不需要连接池</strong>。
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
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
}

.layout {
  display: flex; gap: 16px; align-items: stretch;
  margin: 16px 0;
}

.col { flex: 0 0 auto; }
.col-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
}
.threads { display: flex; flex-direction: column; gap: 4px; }
.thread {
  display: flex; justify-content: space-between;
  width: 80px; padding: 4px 8px;
  border: 1px solid var(--vp-c-border); border-radius: 4px;
  background: var(--vp-c-bg-soft);
  font-family: monospace; font-size: 11px;
}
.t-id { font-weight: 700; }
.t-count { color: var(--vp-c-text-3); }

.arrow {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 28px; color: var(--vp-c-brand-1);
  padding: 0 8px;
}
.arrow-label { font-size: 10px; color: var(--vp-c-text-3); margin-top: 4px; }

.connection-box {
  flex: 1; min-width: 0;
  border: 2px solid #d97706; border-radius: 8px;
  background: #fef3c7; padding: 12px;
}
.conn-title {
  font-size: 12px; font-weight: 700; color: #78350f;
  margin-bottom: 10px; text-align: center;
}

.area-label {
  font-size: 11px; color: #78350f;
  margin-bottom: 4px; font-weight: 600;
  display: flex; justify-content: space-between; align-items: baseline;
}
.hint { color: #a16207; font-weight: 400; font-size: 10px; }

.queue {
  background: white; border: 1px dashed #d97706; border-radius: 4px;
  padding: 6px; min-height: 36px;
  display: flex; flex-wrap: wrap; gap: 4px;
  align-items: center;
}
.q-item {
  font-family: monospace; font-size: 10px;
  padding: 2px 5px; background: #fde68a; border-radius: 2px;
  color: #78350f;
}
.q-empty { color: #a16207; font-style: italic; font-size: 11px; padding: 4px; }

.proc-area { margin-top: 10px; }
.processing {
  background: white; border: 1px solid #d97706; border-radius: 4px;
  padding: 6px; min-height: 36px;
  display: flex; align-items: center;
}
.proc-active { font-family: monospace; font-size: 11px; color: #16a34a; font-weight: 600; }
.proc-idle { color: #a16207; font-style: italic; font-size: 11px; }

.section { margin: 16px 0; }
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

.empty-hint { color: var(--vp-c-text-3); font-style: italic; font-size: 12px; }

.takeaway {
  font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6;
  margin-top: 16px; padding: 10px;
  background: var(--vp-c-brand-soft); border-left: 3px solid var(--vp-c-brand-1);
  border-radius: 4px;
}
</style>
