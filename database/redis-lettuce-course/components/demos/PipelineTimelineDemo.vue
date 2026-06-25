<!-- components/demos/PipelineTimelineDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import Timeline from '../base/Timeline.vue'
import TimeControls from '../base/TimeControls.vue'
import { VirtualClock } from '../../mock/VirtualClock'
import type { TimelineEvent } from '../../mock/types'

const clock = new VirtualClock()
onUnmounted(() => { clock.reset(); unsubscribe() })

const loopCount = ref(100)
const RTT = 100
const PIPELINE_RTT = 120

const syncEvents = ref<TimelineEvent[]>([])
const asyncEvents = ref<TimelineEvent[]>([])
const syncDuration = ref(0)
const asyncDuration = ref(0)

function reset() {
  clock.reset()
  syncEvents.value = []
  asyncEvents.value = []
  syncDuration.value = 0
  asyncDuration.value = 0
}

function run() {
  reset()

  const n = loopCount.value
  syncDuration.value = n * RTT
  asyncDuration.value = PIPELINE_RTT

  // Schedule sync events progressively: each command is its own RTT
  for (let i = 0; i < n; i++) {
    const atIssue = i * RTT
    const atComplete = atIssue + RTT
    clock.schedule({
      at: atIssue,
      fn: () => syncEvents.value.push({ at: atIssue, label: `SET k${i} (issue)`, type: 'issue' })
    })
    clock.schedule({
      at: atComplete,
      fn: () => syncEvents.value.push({ at: atComplete, label: `SET k${i} (done)`, type: 'complete' })
    })
  }

  // Schedule async events: all issued ~immediately, all complete at PIPELINE_RTT
  for (let i = 0; i < n; i++) {
    const atIssue = 0.01 * i
    clock.schedule({
      at: atIssue,
      fn: () => asyncEvents.value.push({ at: atIssue, label: `SET k${i} (issue)`, type: 'issue' })
    })
  }
  for (let i = 0; i < n; i++) {
    clock.schedule({
      at: PIPELINE_RTT,
      fn: () => asyncEvents.value.push({ at: PIPELINE_RTT, label: `SET k${i} (done)`, type: 'complete' })
    })
  }

  clock.play()
}

const duration = computed(() => Math.max(syncDuration.value, asyncDuration.value, 1))
const cursor = computed(() => clock.now)

const unsubscribe = clock.subscribe(() => {
  syncEvents.value = [...syncEvents.value]
  asyncEvents.value = [...asyncEvents.value]
})
</script>

<template>
  <div class="demo">
    <h4>自动 Pipeline 时间线</h4>
    <p>
      循环数:
      <select v-model.number="loopCount" data-test="loop-count">
        <option :value="10">10</option>
        <option :value="100">100</option>
        <option :value="1000">1000</option>
      </select>
    </p>
    <TimeControls
      :clock="clock"
      :on-run="run"
      :on-reset="reset"
      run-label="载入并播放"
    />

    <div class="row" data-test="sync-timeline">
      <div class="label">Sync API</div>
      <div class="timeline-wrap">
        <Timeline :events="syncEvents" :duration="duration" :cursor="cursor" />
        <div class="metric">总耗时: {{ syncDuration }}ms ({{ loopCount }} × {{ RTT }}ms RTT)</div>
      </div>
    </div>

    <div class="row" data-test="async-timeline">
      <div class="label">Async API</div>
      <div class="timeline-wrap">
        <Timeline :events="asyncEvents" :duration="duration" :cursor="cursor" />
        <div class="metric">总耗时: {{ asyncDuration }}ms (1 个 batched RTT)</div>
      </div>
    </div>

    <p class="caption">
      Sync 路径上每条命令阻塞等 RTT；Async 路径上 Lettuce 自动 pipeline，{{ loopCount }} 个命令共享一个 RTT。
      建议切到 0.1x 慢放观察。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.row { display: flex; gap: 12px; margin: 16px 0; align-items: flex-start; }
.label { font-family: monospace; font-size: 12px; color: var(--vp-c-brand-1); min-width: 70px; padding-top: 8px; }
.timeline-wrap { flex: 1; min-width: 0; }
.metric { font-size: 12px; color: var(--vp-c-text-2); margin-top: 6px; font-family: monospace; }
.caption { font-size: 13px; color: var(--vp-c-text-2); margin-top: 12px; line-height: 1.5; }
select { padding: 4px 8px; cursor: pointer; }
</style>
