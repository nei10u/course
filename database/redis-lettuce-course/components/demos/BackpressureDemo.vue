<!-- components/demos/BackpressureDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import TimeControls from '../base/TimeControls.vue'
import BackpressureGauge from '../base/BackpressureGauge.vue'
import { VirtualClock } from '../../mock/VirtualClock'

const clock = new VirtualClock()
onUnmounted(() => { clock.reset(); unsubClock(); clearEmitInterval() })

const upstreamRate = ref(10)
const downstreamRate = ref(5)
const bufferSize = ref(20)
const bufferFill = ref(0)
const dropped = ref(0)

const log = ref<string[]>([])
let emitInterval: ReturnType<typeof setInterval> | null = null

function pushLog(msg: string) {
  log.value.unshift(`${clock.now.toFixed(1)}ms  ${msg}`)
  if (log.value.length > 8) log.value.pop()
}

function clearEmitInterval() {
  if (emitInterval) { clearInterval(emitInterval); emitInterval = null }
}

function reset() {
  clock.reset()
  bufferFill.value = 0
  dropped.value = 0
  log.value = []
  clearEmitInterval()
}

function run() {
  reset()
  const intervalMs = 500
  let tick = 0

  emitInterval = setInterval(() => {
    if (clock.mode === 'paused') return
    tick++

    // Upstream emits
    const emitted = upstreamRate.value
    const processed = downstreamRate.value

    const newFill = bufferFill.value + emitted - processed
    if (newFill > bufferSize.value) {
      const overflow = newFill - bufferSize.value
      dropped.value += overflow
      bufferFill.value = bufferSize.value
      pushLog(`buffer full! dropped ${overflow} items (total dropped: ${dropped.value})`)
    } else if (newFill < 0) {
      bufferFill.value = 0
    } else {
      bufferFill.value = newFill
    }

    if (tick % 3 === 0) {
      pushLog(`upstream:${emitted}/s downstream:${processed}/s buffer:${bufferFill.value}/${bufferSize.value}`)
    }
  }, intervalMs)

  clock.play()
}

const fillRatio = computed(() =>
  bufferSize.value > 0 ? bufferFill.value / bufferSize.value : 0
)

const unsubClock = clock.subscribe(() => {})
</script>

<template>
  <div class="demo">
    <h4>Reactive Backpressure 演示</h4>
    <p class="intro">
      上游以 <strong>{{ upstreamRate }}/s</strong> 速率发出数据，
      下游以 <strong>{{ downstreamRate }}/s</strong> 速率处理。
      当 buffer 满时，溢出数据被丢弃（drop 策略）。
    </p>

    <div class="params">
      <label>上游速率: <input type="number" v-model.number="upstreamRate" min="1" max="50" />/s</label>
      <label>下游速率: <input type="number" v-model.number="downstreamRate" min="1" max="50" />/s</label>
      <label>Buffer 大小: <input type="number" v-model.number="bufferSize" min="5" max="100" /></label>
    </div>

    <TimeControls :clock="clock" :on-run="run" :on-reset="reset" run-label="载入并播放" />

    <!-- Gauge -->
    <div class="gauge-wrap">
      <BackpressureGauge
        :upstream-rate="upstreamRate"
        :downstream-rate="downstreamRate"
        :buffer-size="bufferSize"
        :buffer-fill="bufferFill"
      />
    </div>

    <!-- Counters -->
    <div class="counters">
      <span class="counter dropped" v-if="dropped > 0">已丢弃: {{ dropped }}</span>
      <span class="counter" :class="fillRatio > 0.8 ? 'warn' : 'ok'">
        Buffer: {{ bufferFill }}/{{ bufferSize }} ({{ (fillRatio * 100).toFixed(0) }}%)
      </span>
    </div>

    <!-- Buffer visualization -->
    <div class="section">
      <div class="section-title">Buffer 可视化</div>
      <div class="buffer-vis">
        <div
          v-for="i in bufferSize"
          :key="i"
          class="buffer-cell"
          :class="{ filled: i <= bufferFill }"
        ></div>
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
      当上游速率 > 下游速率时，buffer 会逐渐填满。
      上游 = 下游时 buffer 保持稳定。调整速率观察 buffer 变化。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.intro { font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; margin-bottom: 12px; }
.params { display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px; flex-wrap: wrap; }
.params input { width: 60px; padding: 2px 4px; margin-left: 4px; }
.gauge-wrap { margin: 12px 0; }
.counters { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
.counter {
  font-family: monospace; font-size: 12px;
  padding: 4px 10px; border-radius: 12px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft); color: var(--vp-c-text-2);
}
.counter.dropped { background: #fee2e2; color: #7f1d1d; border-color: #dc2626; }
.counter.warn { background: #fef3c7; color: #78350f; border-color: #d97706; }
.counter.ok { background: #dcfce7; color: #14532d; border-color: #16a34a; }

.section { margin: 12px 0; }
.section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
}

.buffer-vis {
  display: flex; flex-wrap: wrap; gap: 2px;
}
.buffer-cell {
  width: 12px; height: 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 2px;
  background: var(--vp-c-bg-soft);
  transition: background 0.15s;
}
.buffer-cell.filled { background: #d97706; border-color: #b45309; }

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
