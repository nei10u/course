<!-- components/base/EventLoop.vue -->
<script setup lang="ts">
import type { QueueItem } from '../../mock/types'

defineProps<{
  queues: { name: string; items: QueueItem[] }[]
  activeThread: string | null
}>()
</script>

<template>
  <div class="event-loop">
    <div v-for="q in queues" :key="q.name" class="queue">
      <div class="queue-name">{{ q.name }}</div>
      <div class="queue-items">
        <span
          v-for="item in q.items"
          :key="item.id"
          class="queue-item"
          :class="{ active: activeThread === item.id }"
        >{{ item.label }}</span>
        <span v-if="q.items.length === 0" class="empty">empty</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-loop {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
}
.queue { display: flex; align-items: center; gap: 8px; }
.queue-name { font-size: 12px; color: var(--vp-c-text-2); min-width: 80px; }
.queue-items { display: flex; gap: 4px; flex-wrap: wrap; }
.queue-item {
  font-family: monospace;
  font-size: 11px;
  padding: 2px 6px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 3px;
}
.queue-item.active {
  background: #fef3c7;
  border-color: #d97706;
  color: #78350f;
}
.empty { font-size: 11px; color: var(--vp-c-text-3); font-style: italic; }
</style>
