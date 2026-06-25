<!-- components/base/SlotMap.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  nodes: { id: string; color: string; slots: [number, number][] }[]
  highlightSlot?: number
}>(), {
  highlightSlot: undefined
})

const emit = defineEmits<{
  'select-slot': [slot: number]
}>()

// Grid: 128 cols x 128 rows = 16384 cells
const COLS = 128
const ROWS = 128
const CELL = 4
const W = COLS * CELL
const H = ROWS * CELL

// Build bitmap: each cell stores node index (-1 for unassigned)
const bitmap = computed(() => {
  const data = new Int8Array(COLS * ROWS).fill(-1)
  for (let ni = 0; ni < props.nodes.length; ni++) {
    for (const [lo, hi] of props.nodes[ni].slots) {
      for (let s = lo; s <= hi; s++) {
        data[s] = ni
      }
    }
  }
  return data
})

// Precompute per-row string representations of colors for <rect> batches.
// Batch consecutive cells with same owner into single wider rects.
const batches = computed(() => {
  const bm = bitmap.value
  const result: { y: number; x: number; w: number; color: string }[] = []
  for (let r = 0; r < ROWS; r++) {
    let startCol = 0
    let startOwner = bm[r * COLS]
    for (let c = 1; c <= COLS; c++) {
      const owner = c < COLS ? bm[r * COLS + c] : -2 // sentinel
      if (owner !== startOwner) {
        const color = startOwner >= 0 ? props.nodes[startOwner].color : '#e5e7eb'
        result.push({ y: r * CELL, x: startCol * CELL, w: (c - startCol) * CELL, color })
        startCol = c
        startOwner = owner
      }
    }
  }
  return result
})

const highlightX = computed(() =>
  props.highlightSlot !== undefined ? (props.highlightSlot % COLS) * CELL : -1
)
const highlightY = computed(() =>
  props.highlightSlot !== undefined ? Math.floor(props.highlightSlot / COLS) * CELL : -1
)

function onClickSvg(e: MouseEvent) {
  const svg = (e.target as HTMLElement).closest('svg')
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const scaleX = W / rect.width
  const scaleY = H / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY
  const col = Math.floor(x / CELL)
  const row = Math.floor(y / CELL)
  if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
    emit('select-slot', row * COLS + col)
  }
}
</script>

<template>
  <div class="slot-map">
    <div class="slot-map-header">
      <span class="title">Hash Slot Map (16384 slots)</span>
      <div class="legend">
        <span
          v-for="node in nodes"
          :key="node.id"
          class="legend-item"
        >
          <i class="dot" :style="{ background: node.color }"></i>
          {{ node.id }}
        </span>
      </div>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" class="slot-map-svg" @click="onClickSvg">
      <!-- Batched rects: one rect per consecutive same-owner segment per row -->
      <rect
        v-for="(b, i) in batches"
        :key="i"
        :x="b.x"
        :y="b.y"
        :width="b.w"
        :height="CELL"
        :fill="b.color"
      />
      <!-- Highlight indicator -->
      <rect
        v-if="highlightSlot !== undefined"
        :x="highlightX"
        :y="highlightY"
        :width="CELL"
        :height="CELL"
        fill="none"
        stroke="#0ea5e9"
        stroke-width="1.5"
        rx="1"
      />
      <text
        v-if="highlightSlot !== undefined"
        :x="highlightX + CELL + 4"
        :y="highlightY + CELL"
        fill="#0ea5e9"
        font-size="6"
        font-family="monospace"
      >{{ highlightSlot }}</text>
    </svg>
  </div>
</template>

<style scoped>
.slot-map {
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}
.slot-map-header {
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
.legend {
  display: flex;
  gap: 10px;
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
.slot-map-svg {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
}
</style>
