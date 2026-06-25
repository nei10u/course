<!-- components/demos/ScriptsDemo.vue -->
<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import TimeControls from '../base/TimeControls.vue'
import MockRedisPanel from '../base/MockRedisPanel.vue'
import { VirtualClock } from '../../mock/VirtualClock'
import { MockRedis } from '../../mock/MockRedis'
import { MockLettuce } from '../../mock/MockLettuce'
import type { RedisSnapshot } from '../../mock/types'

const clock = new VirtualClock()
const redis = new MockRedis()
const lett = new MockLettuce(redis, clock)
lett.setLatency(1000)

onUnmounted(() => { clock.reset(); unsubscribe(); clearPoll() })

const scriptText = ref('return KEYS[1] .. " = " .. ARGV[1]')
const keysInput = ref('counter')
const argsInput = ref('42')

const evalResult = ref<any>(null)
const evalStatus = ref<'idle' | 'evaluating' | 'done'>('idle')
const log = ref<string[]>([])

function pushLog(msg: string) {
  log.value.unshift(`${clock.now.toFixed(1)}ms  ${msg}`)
  if (log.value.length > 8) log.value.pop()
}

function reset() {
  clock.reset()
  evalResult.value = null
  evalStatus.value = 'idle'
  log.value = []
}

function run() {
  reset()

  const t0 = 0
  evalStatus.value = 'evaluating'
  pushLog(`EVAL "${scriptText.value}"`)
  pushLog(`KEYS: [${keysInput.value}]`)
  pushLog(`ARGV: [${argsInput.value}]`)

  clock.schedule({
    at: t0,
    fn: () => {
      pushLog('发送 EVAL 到 Redis...')
      clock.schedule({
        at: clock.now + 1500,
        fn: () => {
          const result = redis.eval(
            scriptText.value,
            keysInput.value.split(',').map(k => k.trim()),
            argsInput.value.split(',').map(a => a.trim())
          )
          evalResult.value = result
          evalStatus.value = 'done'
          pushLog(`Redis 返回: ${JSON.stringify(result)}`)
        }
      })
    }
  })

  clock.play()
}

const snapshot = ref<RedisSnapshot>({ strings: {}, lists: {}, hashes: {}, sets: {}, zsets: {} })
let pollId: ReturnType<typeof setInterval> | null = null
function clearPoll() { if (pollId) { clearInterval(pollId); pollId = null } }

// Initialize polling for snapshot
pollId = setInterval(() => { snapshot.value = redis._dump() }, 200)

// Parse script to show syntax highlighting (simple)
const scriptLines = computed(() => scriptText.value.split('\n'))

const unsubscribe = clock.subscribe(() => { snapshot.value = redis._dump() })
</script>

<template>
  <div class="demo">
    <h4>Lua 脚本 (EVAL) 演示</h4>
    <p class="intro">
      在 Redis 服务端执行 Lua 脚本，保证原子性。
      脚本通过 <code>KEYS[]</code> 和 <code>ARGV[]</code> 接收参数。
    </p>

    <TimeControls :clock="clock" :on-run="run" :on-reset="reset" run-label="载入并播放" />

    <!-- Script editor -->
    <div class="section">
      <div class="section-title">Lua 脚本</div>
      <div class="script-editor">
        <div class="line-numbers">
          <div v-for="(_, i) in scriptLines" :key="i" class="line-num">{{ i + 1 }}</div>
        </div>
        <textarea v-model="scriptText" class="script-textarea" data-test="script" rows="4" spellcheck="false"></textarea>
      </div>
    </div>

    <!-- KEYS and ARGV -->
    <div class="section">
      <div class="section-title">参数</div>
      <div class="args-row">
        <label>KEYS: <input v-model="keysInput" data-test="keys" placeholder="key1,key2" /></label>
        <label>ARGV: <input v-model="argsInput" data-test="args" placeholder="arg1,arg2" /></label>
      </div>
    </div>

    <!-- Result -->
    <div class="section" v-if="evalResult !== null">
      <div class="section-title">EVAL 返回值</div>
      <div class="result-box" :class="evalStatus">
        <span class="result-label">{{ evalStatus === 'done' ? '→' : '⏳' }}</span>
        <code>{{ JSON.stringify(evalResult) }}</code>
      </div>
    </div>

    <!-- Redis state -->
    <div class="section">
      <div class="section-title">Redis 数据</div>
      <MockRedisPanel :snapshot="snapshot" />
    </div>

    <!-- Log -->
    <div class="section" v-if="log.length > 0">
      <div class="section-title">事件日志</div>
      <div class="log">
        <div v-for="(line, i) in log" :key="i" class="log-line">{{ line }}</div>
      </div>
    </div>

    <p class="takeaway">
      <strong>要点：</strong>
      EVAL 在 Redis 服务端执行 Lua 脚本，所有操作原子性完成。
      通过 KEYS 数组传递 key 名（确保正确路由），ARGV 传递参数值。
      生产环境推荐用 EVALSHA (预加载脚本，只传 SHA1) 减少带宽。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.intro { font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; margin-bottom: 12px; }
.intro code { background: var(--vp-c-bg-soft); padding: 1px 4px; border-radius: 3px; font-size: 12px; }

.section { margin: 12px 0; }
.section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
}

.script-editor {
  display: flex; border: 1px solid var(--vp-c-border);
  border-radius: 6px; overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.line-numbers {
  padding: 8px 6px; background: var(--vp-c-bg);
  border-right: 1px solid var(--vp-c-border);
  user-select: none; text-align: right;
}
.line-num {
  font-family: monospace; font-size: 12px;
  color: var(--vp-c-text-3); line-height: 1.5;
  padding-right: 8px;
}
.script-textarea {
  flex: 1; border: none; resize: vertical;
  padding: 8px 10px; font-family: 'Courier New', monospace;
  font-size: 13px; line-height: 1.5;
  background: transparent; color: var(--vp-c-text-1);
  outline: none;
}

.args-row {
  display: flex; gap: 16px; font-size: 13px; align-items: center;
}
.args-row label {
  display: flex; align-items: center; gap: 4px;
}
.args-row input {
  width: 180px; padding: 4px 8px;
  border: 1px solid var(--vp-c-border); border-radius: 4px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1);
  font-family: monospace; font-size: 12px;
}

.result-box {
  border: 1px solid var(--vp-c-border); border-radius: 6px;
  padding: 10px; font-family: monospace; font-size: 13px;
  display: flex; align-items: center; gap: 8px;
}
.result-box.done { background: #dcfce7; border-color: #16a34a; }
.result-box.evaluating { background: #fef3c7; border-color: #d97706; }
.result-label { font-weight: 700; }
.result-box code { color: var(--vp-c-text-1); }

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
