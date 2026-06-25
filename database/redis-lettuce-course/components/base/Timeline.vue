<!-- components/base/Timeline.vue -->
<script setup lang="ts">
import { computed, ref, watchEffect, onMounted, onUnmounted } from 'vue'
import type { TimelineEvent } from '../../mock/types'

const props = defineProps<{
  events: TimelineEvent[]
  duration: number
  cursor: number
}>()

// Internal coordinate space; SVG scales via viewBox.
const W = 720
const H = 140
const baselineY = 90
const labelThreshold = 25
const canvasThreshold = 500  // SVG up to 500 events, canvas beyond

const containerRef = ref<HTMLElement | null>(null)
const renderWidth = ref(W)  // pixel width for canvas; SVG uses viewBox

const eventsScaled = computed(() =>
  props.events.map((e, i) => ({
    ...e,
    idx: i,
    x: props.duration === 0 ? 0 : (e.at / props.duration) * W
  }))
)

const cursorX = computed(() =>
  props.duration === 0 ? 0 : (props.cursor / props.duration) * W
)

const showLabels = computed(() => eventsScaled.value.length <= labelThreshold)
const isEmpty = computed(() => eventsScaled.value.length === 0)

const ticks = computed(() => {
  const arr: { x: number; label: string }[] = []
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * W
    const label = i === 0 ? '0' : `${Math.round((i / 10) * props.duration)}`
    arr.push({ x, label: i % 2 === 0 ? label : '' })
  }
  return arr
})

const typeColor = (type: string) => {
  switch (type) {
    case 'issue': return '#d97706'
    case 'complete': return '#16a34a'
    case 'error': return '#dc2626'
    default: return '#6b7280'
  }
}

const cursorProgress = computed(() =>
  props.duration === 0 ? 0 : Math.min(100, (props.cursor / props.duration) * 100)
)

// === Responsive container measurement ===
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (!containerRef.value) return
  // Initialize from actual container width
  renderWidth.value = Math.max(320, Math.floor(containerRef.value.clientWidth))
  // Skip ResizeObserver in test env (jsdom doesn't provide it)
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      renderWidth.value = Math.max(320, Math.floor(entry.contentRect.width))
    }
  })
  resizeObserver.observe(containerRef.value)
})
onUnmounted(() => {
  resizeObserver?.disconnect()
})

// === Canvas mode (>100 events) ===
const canvasRef = ref<HTMLCanvasElement | null>(null)
watchEffect(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = renderWidth.value
  canvas.width = w * dpr
  canvas.height = H * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${H}px`
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, H)

  const xScale = (t: number) => props.duration === 0 ? 0 : (t / props.duration) * w

  // baseline
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(0, baselineY); ctx.lineTo(w, baselineY); ctx.stroke()

  // ticks
  ctx.strokeStyle = '#cbd5e1'
  ctx.fillStyle = '#94a3b8'
  ctx.font = '10px monospace'
  for (const t of ticks.value) {
    const x = (t.x / W) * w
    ctx.beginPath()
    ctx.moveTo(x, baselineY - 4)
    ctx.lineTo(x, baselineY + 4)
    ctx.stroke()
    if (t.label) ctx.fillText(t.label, x - 8, baselineY + 18)
  }

  // events
  for (const e of eventsScaled.value) {
    const x = (e.x / W) * w
    ctx.fillStyle = typeColor(e.type)
    if (e.type === 'issue') {
      ctx.fillRect(x - 2, baselineY - 24, 4, 18)
    } else {
      ctx.beginPath()
      ctx.arc(x, baselineY + 14, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // cursor
  const cx = (cursorX.value / W) * w
  ctx.strokeStyle = '#0ea5e9'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 4])
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke()
  ctx.setLineDash([])
})
</script>

<template>
  <div class="timeline" :class="{ 'is-empty': isEmpty }" ref="containerRef">
    <!-- Header: counts + legend -->
    <div class="timeline-header">
      <span class="ev-count">{{ events.length }} events</span>
      <div class="legend">
        <span class="legend-item"><i class="dot dot-issue"></i> issue</span>
        <span class="legend-item"><i class="dot dot-complete"></i> complete</span>
        <span class="legend-item"><i class="dot dot-error"></i> error</span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="isEmpty" class="canvas-wrap">
      <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet" class="timeline-svg">
        <line x1="0" :y1="baselineY" :x2="W" :y2="baselineY" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="6,4" />
        <text :x="W / 2" :y="baselineY - 14" text-anchor="middle" fill="#94a3b8" font-size="13" font-family="sans-serif">
          点击 ▶ Run 开始时间线
        </text>
      </svg>
    </div>

    <!-- SVG mode (≤500 events) -->
    <div v-else-if="events.length <= canvasThreshold" class="canvas-wrap">
      <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet" class="timeline-svg">
        <!-- baseline -->
        <line x1="0" :y1="baselineY" :x2="W" :y2="baselineY" stroke="#cbd5e1" stroke-width="1.5" />

        <!-- tick marks -->
        <g v-for="(t, i) in ticks" :key="`tick-${i}`">
          <line :x1="t.x" :y1="baselineY - 4" :x2="t.x" :y2="baselineY + 4" stroke="#cbd5e1" stroke-width="1" />
          <text v-if="t.label" :x="t.x" :y="baselineY + 18" fill="#94a3b8" font-size="10" font-family="monospace" text-anchor="middle">
            {{ t.label }}
          </text>
        </g>

        <!-- issue events (above baseline, squares) -->
        <g v-for="(e, i) in eventsScaled.filter(e => e.type === 'issue')" :key="`issue-${i}`">
          <rect
            :x="e.x - 3" :y="baselineY - 26"
            width="6" height="20"
            :fill="typeColor(e.type)"
            :stroke="typeColor(e.type)"
            stroke-width="1"
            rx="1"
            class="event-marker"
          />
          <title>{{ e.label }} @ {{ e.at }}ms</title>
          <text
            v-if="showLabels"
            :x="e.x" :y="baselineY - 32"
            text-anchor="middle"
            fill="#78350f"
            font-size="9"
            font-family="monospace"
          >{{ e.label.split(' ')[0] }}</text>
        </g>

        <!-- complete/error events (below baseline, circles) -->
        <g v-for="(e, i) in eventsScaled.filter(e => e.type !== 'issue')" :key="`comp-${i}`">
          <circle
            :cx="e.x" :cy="baselineY + 16"
            :r="5"
            :fill="typeColor(e.type)"
            :stroke="typeColor(e.type)"
            stroke-width="1.5"
            fill-opacity="0.9"
            class="event-marker"
          />
          <title>{{ e.label }} @ {{ e.at }}ms</title>
          <text
            v-if="showLabels"
            :x="e.x" :y="baselineY + 40"
            text-anchor="middle"
            :fill="e.type === 'error' ? '#7f1d1d' : '#14532d'"
            font-size="9"
            font-family="monospace"
          >{{ e.label.split(' ')[0] }}</text>
        </g>

        <!-- cursor -->
        <line
          :x1="cursorX" :y1="0"
          :x2="cursorX" :y2="H"
          stroke="#0ea5e9"
          stroke-width="2"
          stroke-dasharray="4,4"
          class="cursor-line"
        />
        <!-- cursor badge -->
        <g :transform="`translate(${Math.min(Math.max(cursorX, 30), W - 30)}, 12)`">
          <rect x="-26" y="-9" width="52" height="18" rx="9" fill="#0ea5e9" />
          <text x="0" y="4" text-anchor="middle" fill="white" font-size="10" font-family="monospace" font-weight="600">
            {{ cursor.toFixed(1) }}ms
          </text>
        </g>

        <!-- progress label -->
        <text :x="W - 4" :y="14" text-anchor="end" fill="#0ea5e9" font-size="10" font-family="monospace" font-weight="600">
          {{ cursorProgress.toFixed(0) }}%
        </text>
      </svg>
    </div>

    <!-- Canvas mode (>100 events) -->
    <div v-else class="canvas-wrap">
      <canvas ref="canvasRef"></canvas>
    </div>

    <div class="timeline-labels">
      <span>0ms</span>
      <span class="duration-label">{{ duration }}ms</span>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  border: 2px solid var(--vp-c-border);
  border-radius: 10px;
  padding: 14px 16px;
  background: linear-gradient(180deg, var(--vp-c-bg-soft) 0%, var(--vp-c-bg) 100%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
  width: 100%;
  box-sizing: border-box;
  /* behave well as flex child (used in demo rows) */
  flex: 1 1 0;
  min-width: 0;
}
.timeline.is-empty {
  border-style: dashed;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--vp-c-text-2);
}
.ev-count {
  font-family: monospace;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.legend {
  display: flex;
  gap: 12px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--vp-c-text-3);
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.dot-issue { background: #d97706; }
.dot-complete { background: #16a34a; border-radius: 50%; }
.dot-error { background: #dc2626; border-radius: 50%; }

.canvas-wrap {
  width: 100%;
  overflow: hidden;
}
.timeline-svg {
  display: block;
  width: 100%;
  height: auto;
}

.event-marker {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
  transition: transform 0.15s ease;
}
.event-marker:hover {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
}

.cursor-line {
  filter: drop-shadow(0 0 4px rgba(14, 165, 233, 0.4));
}

.timeline-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--vp-c-text-3);
  margin-top: 6px;
  font-family: monospace;
}
.duration-label {
  color: var(--vp-c-text-2);
  font-weight: 600;
}
</style>
