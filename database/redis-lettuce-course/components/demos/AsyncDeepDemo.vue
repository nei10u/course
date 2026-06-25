<!-- components/demos/AsyncDeepDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import TimeControls from '../base/TimeControls.vue'
import { VirtualClock } from '../../mock/VirtualClock'
import { MockRedis } from '../../mock/MockRedis'
import { MockLettuce } from '../../mock/MockLettuce'
import EventLoop from '../base/EventLoop.vue'
import type { QueueItem } from '../../mock/types'

const clock = new VirtualClock()
const redis = new MockRedis()
const lett = new MockLettuce(redis, clock)
lett.setLatency(1000)

onUnmounted(() => { clock.reset(); unsubscribe() })

interface ChainStep {
  id: string
  label: string
  status: 'pending' | 'in-flight' | 'done'
}
const chain = ref<ChainStep[]>([
  { id: 's1', label: 'SET counter 0', status: 'pending' },
  { id: 's2', label: 'thenApply(get counter)', status: 'pending' },
  { id: 's3', label: 'thenApply(incr counter)', status: 'pending' },
])

const eventQueue = ref<QueueItem[]>([])
const activeItem = ref<string | null>(null)

const log = ref<string[]>([])

function pushLog(msg: string) {
  log.value.unshift(`${clock.now.toFixed(1)}ms  ${msg}`)
  if (log.value.length > 8) log.value.pop()
}

function reset() {
  clock.reset()
  chain.value.forEach(s => s.status = 'pending')
  eventQueue.value = []
  activeItem.value = null
  log.value = []
}

function run() {
  reset()
  const api = lett.async()

  // Seed Redis
  redis.set('counter', '0')

  const t0 = 0

  // Step 1: SET counter 0
  clock.schedule({
    at: t0,
    fn: () => {
      chain.value[0].status = 'in-flight'
      eventQueue.value = [{ id: 'e1', label: 'SET issued' }, ...eventQueue.value]
      activeItem.value = 'e1'
      pushLog('issue SET counter 0')
      const f1 = api.set('counter', '0')
      chain.value = [...chain.value]
      f1.then(() => {
        chain.value[0].status = 'done'
        eventQueue.value = eventQueue.value.filter(e => e.id !== 'e1')
        pushLog('SET complete -> OK')

        // Step 2: thenApply(get)
        chain.value[1].status = 'in-flight'
        eventQueue.value = [{ id: 'e2', label: 'GET issued' }, ...eventQueue.value]
        activeItem.value = 'e2'
        pushLog('thenApply -> issue GET counter')
        chain.value = [...chain.value]

        const f2 = api.get('counter')
        f2.then((val) => {
          chain.value[1].status = 'done'
          eventQueue.value = eventQueue.value.filter(e => e.id !== 'e2')
          pushLog(`GET complete -> "${val}"`)

          // Step 3: thenApply(incr)
          chain.value[2].status = 'in-flight'
          eventQueue.value = [{ id: 'e3', label: 'INCR issued' }, ...eventQueue.value]
          activeItem.value = 'e3'
          pushLog('thenApply -> issue INCR counter')
          chain.value = [...chain.value]

          const f3 = api.incr('counter')
          f3.then((n) => {
            chain.value[2].status = 'done'
            eventQueue.value = eventQueue.value.filter(e => e.id !== 'e3')
            activeItem.value = null
            pushLog(`INCR complete -> ${n}`)
            pushLog('chain 完成')
            chain.value = [...chain.value]
          })
        })
      })
    }
  })

  clock.play()
}

const unsubscribe = clock.subscribe(() => {
  chain.value = [...chain.value]
  eventQueue.value = [...eventQueue.value]
})
</script>

<template>
  <div class="demo">
    <h4>异步链式调用 (CompletableFuture)</h4>
    <p class="intro">
      展示 <code>set → thenApply(get) → thenApply(incr)</code> 链式调用。
      每一步的回调在前一步完成后才触发，中间线程不阻塞。
    </p>

    <TimeControls :clock="clock" :on-run="run" :on-reset="reset" run-label="载入并播放" />

    <!-- Chain visualization -->
    <div class="section">
      <div class="section-title">CompletableFuture 链</div>
      <div class="chain">
        <div v-for="(step, i) in chain" :key="step.id"
          class="chain-step"
          :class="step.status"
        >
          <div class="step-label">{{ step.label }}</div>
          <div class="step-status">{{ step.status }}</div>
          <div v-if="i < chain.length - 1" class="chain-arrow">→</div>
        </div>
      </div>
    </div>

    <!-- Event loop -->
    <div class="section">
      <div class="section-title">Event Loop 队列</div>
      <EventLoop
        :queues="[{ name: 'pending', items: eventQueue }]"
        :active-thread="activeItem"
      />
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
      每个 thenApply 回调在前一个 future 完成后才被放入 event loop。
      主线程在发出第一个 SET 后立即返回——不会阻塞等待 INCR 完成。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.intro { font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; margin-bottom: 12px; }
.intro code { background: var(--vp-c-bg-soft); padding: 1px 4px; border-radius: 3px; font-size: 12px; }

.section { margin: 16px 0; }
.section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
}

.chain {
  display: flex; align-items: center; gap: 0; flex-wrap: wrap;
}
.chain-step {
  display: flex; align-items: center; gap: 0;
  padding: 8px 12px;
  border: 2px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  transition: all 0.2s;
}
.chain-step.in-flight {
  border-color: #d97706; background: #fef3c7;
}
.chain-step.done {
  border-color: #16a34a; background: #dcfce7;
}
.step-label { font-family: monospace; font-size: 12px; font-weight: 600; }
.step-status {
  font-size: 10px; color: var(--vp-c-text-3); margin-left: 8px;
  font-family: monospace;
}
.chain-step.in-flight .step-status { color: #78350f; }
.chain-step.done .step-status { color: #14532d; }
.chain-arrow {
  font-size: 18px; color: var(--vp-c-text-3); padding: 0 8px;
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
