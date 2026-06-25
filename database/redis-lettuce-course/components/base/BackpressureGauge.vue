<!-- components/base/BackpressureGauge.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  upstreamRate: number
  downstreamRate: number
  bufferSize: number
  bufferFill: number
}>()

const W = 400
const H = 160
const barH = 24
const margin = { top: 24, right: 20, bottom: 24, left: 80 }

const maxRate = computed(() => Math.max(props.upstreamRate, props.downstreamRate, 1))
const fillRatio = computed(() =>
  props.bufferSize > 0 ? Math.min(1, props.bufferFill / props.bufferSize) : 0
)
const barW = W - margin.left - margin.right

// Scale value to bar width
const rateToX = (rate: number) => (rate / maxRate.value) * barW

const upstreamColor = '#16a34a'
const downstreamColor = '#2563eb'
const bufferColor = computed(() => {
  if (fillRatio.value > 0.9) return '#dc2626'
  if (fillRatio.value > 0.6) return '#d97706'
  return '#16a34a'
})
const statusLabel = computed(() => {
  if (fillRatio.value >= 1) return 'BLOCKED / DROPPING'
  if (fillRatio.value > 0.8) return 'BACKPRESSURE'
  if (fillRatio.value > 0.5) return 'FILLING'
  return 'OK'
})
</script>

<template>
  <div class="gauge">
    <div class="gauge-header">
      <span class="title">Reactive Backpressure</span>
      <span class="status" :style="{ color: bufferColor }">{{ statusLabel }}</span>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" class="gauge-svg">
      <!-- Upstream rate bar -->
      <text :x="0" :y="margin.top + barH / 2 + 4" fill="var(--vp-c-text-2)" font-size="11" font-family="monospace" text-anchor="start" dominant-baseline="middle">
        <tspan :x="margin.left - 8" text-anchor="end">upstream</tspan>
      </text>
      <rect :x="margin.left" :y="margin.top" :width="barW" :height="barH" rx="4"
        fill="var(--vp-c-bg)" stroke="var(--vp-c-border)" stroke-width="1" />
      <rect :x="margin.left" :y="margin.top" :width="rateToX(upstreamRate)" :height="barH" rx="4"
        :fill="upstreamColor" opacity="0.8" />
      <text :x="margin.left + barW + 8" :y="margin.top + barH / 2 + 4"
        fill="var(--vp-c-text-1)" font-size="11" font-family="monospace"
        dominant-baseline="middle">
        {{ upstreamRate }}/s
      </text>

      <!-- Downstream rate bar -->
      <text :x="margin.left - 8" :y="margin.top + barH + 20 + barH / 2 + 4"
        text-anchor="end" fill="var(--vp-c-text-2)" font-size="11" font-family="monospace"
        dominant-baseline="middle">
        downstream
      </text>
      <rect :x="margin.left" :y="margin.top + barH + 20" :width="barW" :height="barH" rx="4"
        fill="var(--vp-c-bg)" stroke="var(--vp-c-border)" stroke-width="1" />
      <rect :x="margin.left" :y="margin.top + barH + 20" :width="rateToX(downstreamRate)" :height="barH" rx="4"
        :fill="downstreamColor" opacity="0.8" />
      <text :x="margin.left + barW + 8" :y="margin.top + barH + 20 + barH / 2 + 4"
        fill="var(--vp-c-text-1)" font-size="11" font-family="monospace"
        dominant-baseline="middle">
        {{ downstreamRate }}/s
      </text>

      <!-- Buffer fill bar -->
      <text :x="margin.left - 8" :y="margin.top + (barH + 20) * 2 + barH / 2 + 4"
        text-anchor="end" fill="var(--vp-c-text-2)" font-size="11" font-family="monospace"
        dominant-baseline="middle">
        buffer
      </text>
      <rect :x="margin.left" :y="margin.top + (barH + 20) * 2" :width="barW" :height="barH" rx="4"
        fill="var(--vp-c-bg)" stroke="var(--vp-c-border)" stroke-width="1" />
      <rect :x="margin.left" :y="margin.top + (barH + 20) * 2"
        :width="barW * fillRatio" :height="barH" rx="4"
        :fill="bufferColor" opacity="0.8" />
      <text :x="margin.left + barW + 8" :y="margin.top + (barH + 20) * 2 + barH / 2 + 4"
        fill="var(--vp-c-text-1)" font-size="11" font-family="monospace"
        dominant-baseline="middle">
        {{ bufferFill }}/{{ bufferSize }}
      </text>
    </svg>
  </div>
</template>

<style scoped>
.gauge {
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}
.gauge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid var(--vp-c-border);
}
.title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-2);
}
.status {
  font-size: 11px;
  font-weight: 600;
  font-family: monospace;
}
.gauge-svg {
  display: block;
  width: 100%;
  height: auto;
}
</style>
