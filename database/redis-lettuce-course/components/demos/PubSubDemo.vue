<!-- components/demos/PubSubDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import TimeControls from '../base/TimeControls.vue'
import { VirtualClock } from '../../mock/VirtualClock'
import { MockRedis } from '../../mock/MockRedis'
import MessageFlow from '../base/MessageFlow.vue'

const clock = new VirtualClock()
const redis = new MockRedis()
onUnmounted(() => { clock.reset(); unsubscribe(); cleanupSubs() })

const channelInput = ref('news')
const messageInput = ref('hello world')

// Publishers
const publishers = ref<string[]>(['P1', 'P2'])

// Subscribers
const subscribers = ref<{ id: string; channels: string[]; patterns: string[] }[]>([
  { id: 'S1', channels: [], patterns: [] },
  { id: 'S2', channels: [], patterns: [] },
])

// Active subscriptions in Redis (for lookup)
const activeSubs = ref<string[]>([])
const activePatternSubs = ref<string[]>([])

// Track unsub functions
const unsubFns = new Map<string, () => void>()
function cleanupSubs() {
  for (const fn of unsubFns.values()) fn()
  unsubFns.clear()
}

// Animated messages
interface AnimMsg { id: string; from: string; to: string; channel: string }
const animMessages = ref<AnimMsg[]>([])
let msgCounter = 0

const log = ref<string[]>([])
function pushLog(msg: string) {
  log.value.unshift(`${clock.now.toFixed(1)}ms  ${msg}`)
  if (log.value.length > 8) log.value.pop()
}

function subscribeChannel(subId: string, channel: string) {
  const sub = subscribers.value.find(s => s.id === subId)
  if (!sub || sub.channels.includes(channel)) return
  sub.channels.push(channel)
  activeSubs.value.push(channel)

  const unsub = redis.subscribe(channel, (msg) => {
    pushLog(`${subId} 收到 [${msg.channel}]: ${msg.payload}`)
  })
  unsubFns.set(`${subId}:${channel}`, unsub)
  pushLog(`${subId} 订阅 ${channel}`)
}

function unsubscribeChannel(subId: string, channel: string) {
  const sub = subscribers.value.find(s => s.id === subId)
  if (!sub) return
  sub.channels = sub.channels.filter(c => c !== channel)
  activeSubs.value = activeSubs.value.filter(c => c !== channel)
  const fn = unsubFns.get(`${subId}:${channel}`)
  if (fn) { fn(); unsubFns.delete(`${subId}:${channel}`) }
  pushLog(`${subId} 取消订阅 ${channel}`)
}

function publishMessage() {
  const count = redis.publish(channelInput.value, messageInput.value)
  pushLog(`PUBLISH ${channelInput.value} "${messageInput.value}" → ${count} 个订阅者`)

  // Add animated messages
  const subs = subscribers.value.filter(s => s.channels.includes(channelInput.value))
  const publisher = publishers.value[0]
  for (const sub of subs) {
    msgCounter++
    animMessages.value.push({
      id: `msg-${msgCounter}`,
      from: publisher,
      to: sub.id,
      channel: channelInput.value,
    })
  }
  // Clear animations after 2s
  setTimeout(() => {
    animMessages.value = animMessages.value.filter(m => {
      const idx = parseInt(m.id.split('-')[1])
      return idx > msgCounter - 10
    })
  }, 2000)
}

function reset() {
  clock.reset()
  cleanupSubs()
  subscribers.value = [
    { id: 'S1', channels: [], patterns: [] },
    { id: 'S2', channels: [], patterns: [] },
  ]
  activeSubs.value = []
  activePatternSubs.value = []
  animMessages.value = []
  log.value = []
}

function run() {
  reset()
  // Auto-subscribe S1 to news, S2 to sports
  subscribeChannel('S1', 'news')
  subscribeChannel('S2', 'news')
  subscribeChannel('S2', 'sports')
  clock.play()
}

const unsubscribe = clock.subscribe(() => {})

// For MessageFlow component
const flowChannels = ref(() =>
  [...new Set(activeSubs.value)].map(name => ({
    name,
    subscribers: subscribers.value.filter(s => s.channels.includes(name)).map(s => s.id),
  }))
)
</script>

<template>
  <div class="demo">
    <h4>Pub/Sub 演示</h4>
    <p class="intro">
      Publisher 发消息到 Channel，所有订阅该 Channel 的 Subscriber 都会收到。
    </p>

    <TimeControls :clock="clock" :on-run="run" :on-reset="reset" run-label="载入并播放" />

    <!-- Controls -->
    <div class="section">
      <div class="section-title">订阅管理</div>
      <div class="sub-controls">
        <div v-for="sub in subscribers" :key="sub.id" class="sub-row">
          <span class="sub-id">{{ sub.id }}</span>
          <span class="sub-channels">已订阅: {{ sub.channels.length > 0 ? sub.channels.join(', ') : '(无)' }}</span>
          <div class="sub-actions">
            <select v-model="channelInput" class="chan-select">
              <option value="news">news</option>
              <option value="sports">sports</option>
              <option value="weather">weather</option>
            </select>
            <button @click="subscribeChannel(sub.id, channelInput)" class="sub-btn">订阅</button>
            <button @click="unsubscribeChannel(sub.id, channelInput)" class="unsub-btn">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Publish -->
    <div class="section">
      <div class="section-title">发布消息</div>
      <div class="pub-controls">
        <select v-model="channelInput" class="chan-select">
          <option value="news">news</option>
          <option value="sports">sports</option>
          <option value="weather">weather</option>
        </select>
        <input v-model="messageInput" placeholder="消息内容" class="msg-input" />
        <button @click="publishMessage" class="pub-btn">PUBLISH</button>
      </div>
    </div>

    <!-- Flow visualization -->
    <div class="section" v-if="animMessages.length > 0">
      <div class="section-title">消息流</div>
      <MessageFlow
        :publishers="publishers.map(id => ({ id }))"
        :channels="[...new Set(subscribers.flatMap(s => s.channels))].map(name => ({
          name,
          subscribers: subscribers.filter(s => s.channels.includes(name)).map(s => s.id),
        }))"
        :messages="animMessages"
      />
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
      点击 "载入并播放" 自动订阅。然后手动发布消息，观察消息如何传递给所有订阅者。
      取消订阅后再发消息，该 Subscriber 不会收到。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.intro { font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; margin-bottom: 12px; }

.section { margin: 12px 0; }
.section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
}

.sub-controls { display: flex; flex-direction: column; gap: 8px; }
.sub-row {
  display: flex; align-items: center; gap: 12px;
  padding: 6px 10px; border: 1px solid var(--vp-c-border);
  border-radius: 4px; background: var(--vp-c-bg-soft);
}
.sub-id { font-family: monospace; font-weight: 700; font-size: 13px; min-width: 30px; }
.sub-channels { font-size: 12px; color: var(--vp-c-text-2); flex: 1; }
.sub-actions { display: flex; gap: 4px; align-items: center; }

.pub-controls {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
}
.chan-select {
  padding: 4px 8px; border: 1px solid var(--vp-c-border);
  border-radius: 4px; background: var(--vp-c-bg); color: var(--vp-c-text-1);
  font-size: 12px;
}
.msg-input {
  flex: 1; min-width: 120px; padding: 4px 8px;
  border: 1px solid var(--vp-c-border); border-radius: 4px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 12px;
}

.sub-btn, .unsub-btn, .pub-btn {
  padding: 4px 10px; cursor: pointer; border-radius: 4px;
  font-size: 12px; transition: background 0.15s;
}
.sub-btn {
  background: #dcfce7; color: #14532d; border: 1px solid #16a34a;
}
.sub-btn:hover { background: #bbf7d0; }
.unsub-btn {
  background: #fee2e2; color: #7f1d1d; border: 1px solid #dc2626;
}
.unsub-btn:hover { background: #fecaca; }
.pub-btn {
  background: var(--vp-c-brand-1); color: white;
  border: 1px solid var(--vp-c-brand-2); font-weight: 600;
  font-family: monospace;
}
.pub-btn:hover { background: var(--vp-c-brand-2); }

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
