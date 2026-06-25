<!-- components/base/MessageFlow.vue -->
<script setup lang="ts">
import { computed } from 'vue'

interface PublisherDef { id: string }
interface ChannelDef { name: string; subscribers: string[] }
interface MessageDef { id: string; from: string; to: string; channel: string }

const props = defineProps<{
  publishers: PublisherDef[]
  channels: ChannelDef[]
  messages: MessageDef[]
}>()

const emit = defineEmits<{
  'select-message': [msg: MessageDef]
}>()

// Layout constants
const COL_PUB_X = 80
const COL_CHAN_X = 300
const COL_SUB_X = 520
const H = 300

// Y positions for each entity
const pubPositions = computed(() => {
  const spacing = Math.min(40, (H - 40) / Math.max(props.publishers.length, 1))
  const totalH = props.publishers.length * spacing
  const startY = (H - totalH) / 2 + spacing / 2
  return props.publishers.map((p, i) => ({ ...p, y: startY + i * spacing }))
})

const chanPositions = computed(() => {
  const spacing = Math.min(40, (H - 40) / Math.max(props.channels.length, 1))
  const totalH = props.channels.length * spacing
  const startY = (H - totalH) / 2 + spacing / 2
  return props.channels.map((c, i) => ({ ...c, y: startY + i * spacing }))
})

// Collect all unique subscriber IDs and assign positions
const subIds = computed(() => {
  const ids = new Set<string>()
  for (const ch of props.channels) {
    for (const s of ch.subscribers) ids.add(s)
  }
  return Array.from(ids)
})
const subPositions = computed(() => {
  const spacing = Math.min(40, (H - 40) / Math.max(subIds.value.length, 1))
  const totalH = subIds.value.length * spacing
  const startY = (H - totalH) / 2 + spacing / 2
  return subIds.value.map((id, i) => ({ id, y: startY + i * spacing }))
})

// Compute animated message positions (x interpolation)
const activeMessages = computed(() =>
  props.messages.map((msg, i) => {
    const chanPos = chanPositions.value.find(c => c.name === msg.channel)
    const subPos = subPositions.value.find(s => s.id === msg.to)
    const pubPos = pubPositions.value.find(p => p.id === msg.from)
    // Animate: from publisher -> channel -> subscriber
    // Phase 0-0.5: pub -> chan; Phase 0.5-1: chan -> sub
    const phase = Math.min(1, i / Math.max(props.messages.length - 1, 1))
    const subPhase = phase * 2
    let x: number, y: number
    if (subPhase <= 1) {
      // Moving from publisher to channel
      x = COL_PUB_X + (COL_CHAN_X - COL_PUB_X) * subPhase
      y = (pubPos?.y ?? H / 2) + ((chanPos?.y ?? H / 2) - (pubPos?.y ?? H / 2)) * subPhase
    } else {
      // Moving from channel to subscriber
      const p2 = subPhase - 1
      x = COL_CHAN_X + (COL_SUB_X - COL_CHAN_X) * p2
      y = (chanPos?.y ?? H / 2) + ((subPos?.y ?? H / 2) - (chanPos?.y ?? H / 2)) * p2
    }
    return { ...msg, x, y }
  })
)
</script>

<template>
  <div class="message-flow">
    <div class="flow-header">
      <span class="title">Pub/Sub 消息流</span>
    </div>
    <svg :viewBox="`0 0 600 ${H}`" class="flow-svg">
      <!-- Column labels -->
      <text :x="COL_PUB_X" y="16" text-anchor="middle" fill="var(--vp-c-text-2)" font-size="10">Publishers</text>
      <text :x="COL_CHAN_X" y="16" text-anchor="middle" fill="var(--vp-c-text-2)" font-size="10">Channels</text>
      <text :x="COL_SUB_X" y="16" text-anchor="middle" fill="var(--vp-c-text-2)" font-size="10">Subscribers</text>

      <!-- Publisher boxes -->
      <g v-for="p in pubPositions" :key="p.id">
        <rect :x="COL_PUB_X - 40" :y="p.y - 12" width="80" height="24" rx="4"
          fill="#dcfce7" stroke="#16a34a" stroke-width="1" />
        <text :x="COL_PUB_X" :y="p.y + 4" text-anchor="middle" fill="#14532d" font-size="10" font-family="monospace">{{ p.id }}</text>
      </g>

      <!-- Channel boxes -->
      <g v-for="c in chanPositions" :key="c.name">
        <rect :x="COL_CHAN_X - 50" :y="c.y - 12" width="100" height="24" rx="4"
          fill="#fef3c7" stroke="#d97706" stroke-width="1" />
        <text :x="COL_CHAN_X" :y="c.y + 4" text-anchor="middle" fill="#78350f" font-size="10" font-family="monospace">{{ c.name }}</text>
      </g>

      <!-- Subscriber boxes -->
      <g v-for="s in subPositions" :key="s.id">
        <rect :x="COL_SUB_X - 40" :y="s.y - 12" width="80" height="24" rx="4"
          fill="#dbeafe" stroke="#2563eb" stroke-width="1" />
        <text :x="COL_SUB_X" :y="s.y + 4" text-anchor="middle" fill="#1e3a8a" font-size="10" font-family="monospace">{{ s.id }}</text>
      </g>

      <!-- Subscription lines (channel -> subscriber) -->
      <g v-for="ch in chanPositions" :key="`line-${ch.name}`">
        <line
          v-for="subId in ch.subscribers"
          :key="subId"
          :x1="COL_CHAN_X + 50"
          :y1="ch.y"
          :x2="COL_SUB_X - 40"
          :y2="subPositions.find(s => s.id === subId)?.y ?? 0"
          stroke="#d1d5db"
          stroke-width="1"
          stroke-dasharray="3,3"
        />
      </g>

      <!-- Animated message dots -->
      <g v-for="m in activeMessages" :key="m.id" @click="emit('select-message', m)" class="msg-dot">
        <circle :cx="m.x" :cy="m.y" r="6" fill="#f97316" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.5;0.9" dur="1s" repeatCount="indefinite" />
        </circle>
        <title>{{ m.from }} -> {{ m.channel }} -> {{ m.to }}</title>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.message-flow {
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}
.flow-header {
  padding: 6px 10px;
  border-bottom: 1px solid var(--vp-c-border);
}
.title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-2);
}
.flow-svg {
  display: block;
  width: 100%;
  height: auto;
}
.msg-dot {
  cursor: pointer;
}
</style>
