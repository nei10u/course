<!-- components/base/TimeControls.vue -->
<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import type { VirtualClock } from '../../mock/VirtualClock'

const props = withDefaults(defineProps<{
  clock: VirtualClock
  onRun?: () => void
  onReset?: () => void
  runLabel?: string
}>(), {
  onRun: undefined,
  onReset: undefined,
  runLabel: 'Run'
})

const speedOptions = [2, 1, 0.5, 0.25, 0.1]
const selectedSpeed = ref(1)
// Apply default speed to clock immediately
props.clock.setSpeed(1)
const mode = ref(props.clock.mode)
const unsubscribe = props.clock.subscribe(() => {
  mode.value = props.clock.mode
})
onUnmounted(() => unsubscribe())

const playLabel = computed(() => mode.value === 'playing' ? '⏸ 暂停' : '▶ 播放')
const hasRun = computed(() => typeof props.onRun === 'function')

function togglePlay() {
  if (mode.value === 'playing') {
    props.clock.pause()
    return
  }
  // If playback finished (no events left), replay from start.
  if (!props.clock.hasEvents && typeof props.onRun === 'function') {
    props.onRun()  // onRun does reset + schedule + play
    return
  }
  props.clock.play()
}
function step() {
  // If nothing to step through, replay scenario then pause so user can step.
  if (!props.clock.hasEvents && typeof props.onRun === 'function') {
    props.onRun()
    props.clock.pause()
    return
  }
  props.clock.step()
}
function reset() {
  if (typeof props.onReset === 'function') props.onReset()
  else props.clock.reset()
}
function run() {
  props.onRun?.()
}
function setSpeed(e: Event) {
  const v = Number((e.target as HTMLSelectElement).value)
  selectedSpeed.value = v
  props.clock.setSpeed(v)
}
</script>

<template>
  <div class="time-controls">
    <button
      v-if="hasRun"
      data-test="run"
      class="run-btn"
      @click="run"
    >⚡ {{ runLabel }}</button>

    <div class="divider" v-if="hasRun"></div>

    <button data-test="play" @click="togglePlay">{{ playLabel }}</button>
    <button data-test="step" @click="step">⏭ 单步</button>
    <button data-test="reset" @click="reset">↻ 重置</button>

    <div class="divider"></div>

    <label class="speed">
      速度
      <select data-test="speed" :value="selectedSpeed" @change="setSpeed">
        <option v-for="s in speedOptions" :key="s" :value="s">{{ s }}x</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.time-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  flex-wrap: wrap;
}
button {
  padding: 5px 12px;
  cursor: pointer;
  border: 1px solid var(--vp-c-border);
  border-radius: 5px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  color: var(--vp-c-text-1);
  transition: background 0.15s;
}
button:hover {
  background: var(--vp-c-brand-soft);
}
.run-btn {
  background: var(--vp-c-brand-1);
  color: white;
  border-color: var(--vp-c-brand-2);
  font-weight: 600;
}
.run-btn:hover {
  background: var(--vp-c-brand-2);
}
.divider {
  width: 1px;
  height: 20px;
  background: var(--vp-c-border);
  margin: 0 4px;
}
.speed {
  font-size: 12px;
  color: var(--vp-c-text-2);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
select {
  margin-left: 4px;
  padding: 3px 6px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
</style>
