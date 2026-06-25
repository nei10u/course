<!-- components/demos/ClusterRoutingDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import TimeControls from '../base/TimeControls.vue'
import SlotMap from '../base/SlotMap.vue'
import { VirtualClock } from '../../mock/VirtualClock'
import { MockRedis } from '../../mock/MockRedis'
import { MockLettuce } from '../../mock/MockLettuce'
import { hashSlot } from '../../mock/crc16'

const clock = new VirtualClock()
const redis = new MockRedis()
const lett = new MockLettuce(redis, clock)
lett.setLatency(1000)

onUnmounted(() => { clock.reset(); unsubscribe() })

const keyInput = ref('user:1001')
const valueInput = ref('hello')
const selectedSlot = ref<number | undefined>(undefined)
const routingAnim = ref<'idle' | 'computing' | 'routing' | 'done'>('idle')
const targetNode = ref<string>('')
const log = ref<string[]>([])

// 3-node cluster
const clusterNodes = [
  { id: 'Node A', color: '#f97316', slots: [[0, 5460] as [number, number]] },
  { id: 'Node B', color: '#3b82f6', slots: [[5461, 10922] as [number, number]] },
  { id: 'Node C', color: '#a855f7', slots: [[10923, 16383] as [number, number]] },
]

const slotMapNodes = computed(() => clusterNodes)

const computedSlot = computed(() => hashSlot(keyInput.value))

const nodeForSlot = (slot: number) => {
  for (const node of clusterNodes) {
    for (const [lo, hi] of node.slots) {
      if (slot >= lo && slot <= hi) return node
    }
  }
  return clusterNodes[0]
}

function pushLog(msg: string) {
  log.value.unshift(`${clock.now.toFixed(1)}ms  ${msg}`)
  if (log.value.length > 8) log.value.pop()
}

function reset() {
  clock.reset()
  selectedSlot.value = undefined
  routingAnim.value = 'idle'
  targetNode.value = ''
  log.value = []
}

function computeSlot() {
  const slot = hashSlot(keyInput.value)
  selectedSlot.value = slot
  const node = nodeForSlot(slot)
  targetNode.value = node.id
  pushLog(`CRC16("${keyInput.value}") = slot ${slot}`)
  pushLog(`路由到 ${node.id} (${node.slots[0][0]}-${node.slots[0][1]})`)
}

function runSet() {
  reset()
  computeSlot()

  routingAnim.value = 'computing'
  clock.schedule({
    at: 0,
    fn: () => {
      pushLog('计算 hash slot...')
      clock.schedule({
        at: clock.now + 500,
        fn: () => {
          routingAnim.value = 'routing'
          pushLog(`路由 SET ${keyInput.value} 到 ${targetNode.value}`)
          const cluster = lett.cluster(clusterNodes.map(n => ({
            id: n.id, url: `redis://${n.id.toLowerCase()}:6379`, slots: n.slots
          })))
          const f = cluster.set(keyInput.value, valueInput.value)
          f.then(() => {
            routingAnim.value = 'done'
            pushLog(`${targetNode.value} 返回 OK`)
          })
        }
      })
    }
  })

  clock.play()
}

const unsubscribe = clock.subscribe(() => {})
</script>

<template>
  <div class="demo">
    <h4>Cluster 路由演示</h4>
    <p class="intro">
      输入 key，观察 CRC16 计算 hash slot，然后路由到正确的集群节点。
      使用 <code>{tag}</code> hash tag 可以让多个 key 落到同一节点。
    </p>

    <div class="params">
      <label>Key: <input v-model="keyInput" placeholder="user:1001" data-test="key" /></label>
      <label>Value: <input v-model="valueInput" placeholder="hello" data-test="value" /></label>
      <button class="set-btn" data-test="set" @click="runSet">SET</button>
    </div>

    <div class="slot-info">
      <span class="slot-label">Key: <strong>{{ keyInput }}</strong></span>
      <span class="slot-label">Slot: <strong>{{ computedSlot }}</strong></span>
      <span class="slot-label">Node: <strong>{{ nodeForSlot(computedSlot).id }}</strong></span>
    </div>

    <TimeControls :clock="clock" :on-run="runSet" :on-reset="reset" run-label="载入并播放" />

    <!-- Cluster nodes -->
    <div class="section">
      <div class="section-title">集群节点</div>
      <div class="nodes">
        <div v-for="node in clusterNodes" :key="node.id"
          class="node"
          :class="{ active: routingAnim !== 'idle' && targetNode === node.id }"
        >
          <div class="node-id" :style="{ color: node.color }">{{ node.id }}</div>
          <div class="node-slots">{{ node.slots[0][0] }}-{{ node.slots[0][1] }}</div>
          <div v-if="routingAnim !== 'idle' && targetNode === node.id" class="node-badge">ROUTING</div>
        </div>
      </div>
    </div>

    <!-- Slot map -->
    <div class="section">
      <div class="section-title">Hash Slot 分布</div>
      <SlotMap :nodes="slotMapNodes" :highlight-slot="selectedSlot" />
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
      不同的 key 会路由到不同节点。试试 <code>&#123;user&#125;</code>1001 和 <code>&#123;user&#125;</code>1002，
      它们会落在同一 slot（因为 hash tag 内的字符串相同）。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.intro { font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; margin-bottom: 12px; }
.intro code { background: var(--vp-c-bg-soft); padding: 1px 4px; border-radius: 3px; font-size: 12px; }

.params { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px; }
.params input { width: 160px; padding: 4px 8px; border: 1px solid var(--vp-c-border); border-radius: 4px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font-family: monospace; }
.set-btn {
  padding: 5px 14px; cursor: pointer;
  background: var(--vp-c-brand-1); color: white;
  border: 1px solid var(--vp-c-brand-2); border-radius: 5px;
  font-size: 13px; font-weight: 600; font-family: monospace;
  transition: background 0.15s;
}
.set-btn:hover { background: var(--vp-c-brand-2); }

.slot-info {
  display: flex; gap: 16px; margin: 8px 0;
  font-family: monospace; font-size: 12px; color: var(--vp-c-text-2);
}
.slot-label strong { color: var(--vp-c-brand-1); }

.section { margin: 12px 0; }
.section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
}

.nodes { display: flex; gap: 12px; flex-wrap: wrap; }
.node {
  width: 100px; padding: 10px;
  border: 2px solid var(--vp-c-border); border-radius: 6px;
  background: var(--vp-c-bg-soft); text-align: center;
  transition: all 0.2s;
}
.node.active { border-width: 3px; box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.3); }
.node-id { font-size: 14px; font-weight: 700; font-family: monospace; }
.node-slots { font-size: 11px; color: var(--vp-c-text-3); margin-top: 4px; font-family: monospace; }
.node-badge {
  font-size: 9px; font-weight: 700; margin-top: 4px;
  color: #78350f; background: #fef3c7;
  padding: 1px 6px; border-radius: 8px;
}

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
