<!-- components/demos/ThreeApiTimelineDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import Timeline from '../base/Timeline.vue'
import TimeControls from '../base/TimeControls.vue'
import { VirtualClock } from '../../mock/VirtualClock'
import { MockRedis } from '../../mock/MockRedis'
import { MockLettuce } from '../../mock/MockLettuce'
import type { TimelineEvent } from '../../mock/types'

const clock = new VirtualClock()
const redis = new MockRedis()
const lett = new MockLettuce(redis, clock)
lett.setLatency(1000)

onUnmounted(() => { clock.reset(); unsubscribe() })

const syncEvents = ref<TimelineEvent[]>([])
const asyncEvents = ref<TimelineEvent[]>([])
const reactiveEvents = ref<TimelineEvent[]>([])

function reset() {
  clock.reset()
  syncEvents.value = []
  asyncEvents.value = []
  reactiveEvents.value = []
}

function run() {
  reset()

  const syncConn = lett.sync()
  const asyncConn = lett.async()
  const reactiveConn = lett.reactive()

  const t0 = clock.now

  // Sync: fires immediately on the synchronous call site, but we still
  // push to the timeline at virtual t0 for the visualization.
  syncEvents.value.push({ at: t0, label: 'SET issued', type: 'issue' })
  syncConn.set('sync', '1')
  syncEvents.value.push({ at: t0, label: 'SET done', type: 'complete' })

  // Async: scheduled via clock
  clock.schedule({
    at: t0 + 200,
    fn: () => {
      asyncEvents.value.push({ at: clock.now, label: 'SET issued', type: 'issue' })
      const f = asyncConn.set('async', '1')
      f.then(() => asyncEvents.value.push({ at: clock.now, label: 'future.complete', type: 'complete' }))
    }
  })

  // Reactive: emits on subscribe via clock
  clock.schedule({
    at: t0 + 400,
    fn: () => {
      reactiveEvents.value.push({ at: clock.now, label: 'subscribe', type: 'issue' })
      reactiveConn.set('reactive', '1').subscribe({
        onNext: () => reactiveEvents.value.push({ at: clock.now, label: 'onNext', type: 'complete' }),
        onComplete: () => reactiveEvents.value.push({ at: clock.now, label: 'onComplete', type: 'complete' })
      })
    }
  })

  clock.play()
}

const duration = computed(() => 2000)
const cursor = computed(() => clock.now)

const unsubscribe = clock.subscribe(() => {
  syncEvents.value = [...syncEvents.value]
  asyncEvents.value = [...asyncEvents.value]
  reactiveEvents.value = [...reactiveEvents.value]
})
</script>

<template>
  <div class="demo">
    <h4>三套 API 时间线对比</h4>
    <TimeControls
      :clock="clock"
      :on-run="run"
      :on-reset="reset"
      run-label="载入并播放"
    />

    <div class="row">
      <div class="label">Sync</div>
      <Timeline :events="syncEvents" :duration="duration" :cursor="cursor" />
    </div>
    <div class="row">
      <div class="label">Async</div>
      <Timeline :events="asyncEvents" :duration="duration" :cursor="cursor" />
    </div>
    <div class="row">
      <div class="label">Reactive</div>
      <Timeline :events="reactiveEvents" :duration="duration" :cursor="cursor" />
    </div>
    <p class="caption">
      Sync 立即返回 · Async 通过 CompletableFuture 异步完成 · Reactive 在 subscribe 后才触发。
      建议切到 0.1x 慢放观察回调时机。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.label { font-family: monospace; font-size: 12px; color: var(--vp-c-brand-1); min-width: 70px; }
.caption { font-size: 13px; color: var(--vp-c-text-2); margin-top: 12px; }
</style>
