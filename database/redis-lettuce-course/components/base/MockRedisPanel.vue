<!-- components/base/MockRedisPanel.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { RedisSnapshot } from '../../mock/types'

const props = defineProps<{
  snapshot: RedisSnapshot
  filter?: string
}>()

const filtered = computed(() => {
  if (!props.filter) return props.snapshot
  const f = props.filter.toLowerCase()
  const match = (k: string) => k.toLowerCase().includes(f)
  const result: RedisSnapshot = { strings: {}, lists: {}, hashes: {}, sets: {}, zsets: {} }
  for (const [k, v] of Object.entries(props.snapshot.strings)) if (match(k)) result.strings[k] = v
  for (const [k, v] of Object.entries(props.snapshot.lists)) if (match(k)) result.lists[k] = v
  for (const [k, v] of Object.entries(props.snapshot.hashes)) if (match(k)) result.hashes[k] = v
  for (const [k, v] of Object.entries(props.snapshot.sets)) if (match(k)) result.sets[k] = v
  for (const [k, v] of Object.entries(props.snapshot.zsets)) if (match(k)) result.zsets[k] = v
  return result
})

const hasData = computed(() =>
  Object.keys(filtered.value.strings).length > 0 ||
  Object.keys(filtered.value.lists).length > 0 ||
  Object.keys(filtered.value.hashes).length > 0 ||
  Object.keys(filtered.value.sets).length > 0 ||
  Object.keys(filtered.value.zsets).length > 0
)
</script>

<template>
  <div class="redis-panel">
    <div class="panel-header">Redis</div>
    <div v-if="!hasData" class="empty">empty</div>
    <div v-else class="panel-body">
      <div v-for="(v, k) in filtered.strings" :key="`s-${k}`" class="kv">
        <span class="key">{{ k }}</span><span class="val">{{ v }}</span>
      </div>
      <div v-for="(v, k) in filtered.lists" :key="`l-${k}`" class="kv">
        <span class="key">{{ k }}</span><span class="val">[{{ v.join(', ') }}]</span>
      </div>
      <div v-for="(v, k) in filtered.hashes" :key="`h-${k}`" class="kv">
        <span class="key">{{ k }}</span>
        <span class="val">{{ JSON.stringify(v) }}</span>
      </div>
      <div v-for="(v, k) in filtered.sets" :key="`set-${k}`" class="kv">
        <span class="key">{{ k }}</span><span class="val">{{ v.join(', ') }}</span>
      </div>
      <div v-for="(v, k) in filtered.zsets" :key="`z-${k}`" class="kv">
        <span class="key">{{ k }}</span>
        <span class="val">{{ v.map(m => `${m.member}:${m.score}`).join(', ') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.redis-panel {
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  font-family: monospace;
  font-size: 12px;
}
.panel-header {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-2);
  padding: 6px 10px;
  border-bottom: 1px solid var(--vp-c-border);
}
.panel-body { padding: 6px 10px; }
.kv { display: flex; gap: 8px; padding: 2px 0; }
.key { color: #d97706; min-width: 100px; }
.val { color: var(--vp-c-text-1); }
.empty { padding: 12px; font-style: italic; color: var(--vp-c-text-3); }
</style>
