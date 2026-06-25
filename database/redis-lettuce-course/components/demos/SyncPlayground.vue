<!-- components/demos/SyncPlayground.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import MockRedisPanel from '../base/MockRedisPanel.vue'
import { MockRedis } from '../../mock/MockRedis'
import { MockLettuce } from '../../mock/MockLettuce'

const redis = new MockRedis()
const lett = new MockLettuce(redis)

const command = ref<'set' | 'get' | 'incr' | 'del'>('set')
const key = ref('mykey')
const value = ref('myvalue')
const output = ref('')
const error = ref('')
const runCount = ref(0)

function run() {
  error.value = ''
  const conn = lett.sync()
  try {
    switch (command.value) {
      case 'set': output.value = String(conn.set(key.value, value.value)); break
      case 'get': output.value = String(conn.get(key.value)); break
      case 'incr': output.value = String(conn.incr(key.value)); break
      case 'del': output.value = String(conn.del(key.value)); break
    }
    runCount.value++
  } catch (e) {
    error.value = (e as Error).message
  }
}

function reset() {
  // Re-create redis to clear all data
  ;(redis as any).constructor.prototype._dump && redis._dump()
  // Simplest reset: re-initialize the internal maps via known API
  // Since MockRedis doesn't expose flush(), we re-instantiate via a workaround:
  Object.keys(redis._dump()).forEach(k => redis.del(k))
  output.value = ''
  error.value = ''
  runCount.value = 0
}

const snapshot = computed(() => redis._dump())
</script>

<template>
  <div class="demo">
    <h4>Sync API Playground</h4>
    <p class="intro">
      受限编辑器：选命令、改 key/value，点 <strong>⚡ Run</strong> 执行。
      右侧 Redis 面板实时反映数据变化。
    </p>

    <div class="editor">
      <div class="line">
        <span class="kw">redis</span>.<select v-model="command" data-test="cmd">
          <option value="set">set</option>
          <option value="get">get</option>
          <option value="incr">incr</option>
          <option value="del">del</option>
        </select>(<input v-model="key" placeholder="key" data-test="key" />,
        <input v-if="command === 'set'" v-model="value" placeholder="value" data-test="value" />)
      </div>
      <div class="actions">
        <button class="run-btn" data-test="run" @click="run">⚡ Run</button>
        <button class="reset-btn" data-test="reset" @click="reset">↻ 清空 Redis</button>
        <span class="counter" v-if="runCount > 0">已执行 {{ runCount }} 次</span>
      </div>
    </div>

    <div class="output" v-if="output">
      <span class="result-label">→ 返回:</span>
      <span class="result">{{ output }}</span>
    </div>
    <div class="error" v-if="error">⚠ {{ error }}</div>

    <div class="section-title">Redis 数据</div>
    <MockRedisPanel :snapshot="snapshot" />
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.intro { font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; margin-bottom: 12px; }

.editor {
  background: var(--vp-c-bg-soft); padding: 12px;
  border-radius: 6px; font-family: monospace;
  border: 1px solid var(--vp-c-border);
}
.line {
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap; font-size: 13px;
  padding: 4px 0;
}
.kw { color: var(--vp-c-brand-1); font-weight: 600; }
input, select {
  font-family: monospace; padding: 3px 6px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg); color: var(--vp-c-text-1);
  border-radius: 3px;
}

.actions {
  display: flex; gap: 8px; align-items: center;
  margin-top: 10px;
}
.run-btn {
  padding: 5px 14px; cursor: pointer;
  background: var(--vp-c-brand-1);
  color: white;
  border: 1px solid var(--vp-c-brand-2);
  border-radius: 5px;
  font-size: 13px; font-weight: 600;
  transition: background 0.15s;
}
.run-btn:hover { background: var(--vp-c-brand-2); }
.reset-btn {
  padding: 5px 12px; cursor: pointer;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border);
  border-radius: 5px;
  font-size: 12px;
}
.reset-btn:hover { background: var(--vp-c-brand-soft); }
.counter {
  font-size: 11px; color: var(--vp-c-text-3);
  font-family: monospace;
  margin-left: auto;
}

.output {
  margin-top: 14px; padding: 8px 12px;
  background: #dcfce7; border-left: 3px solid #16a34a;
  border-radius: 4px;
  font-family: monospace; font-size: 13px;
  display: flex; gap: 8px; align-items: baseline;
}
.result-label { color: #14532d; font-size: 11px; text-transform: uppercase; }
.result { color: #14532d; font-weight: 600; }
.error {
  margin-top: 12px; padding: 8px 12px;
  background: #fee2e2; border-left: 3px solid #dc2626;
  border-radius: 4px;
  color: #7f1d1d; font-family: monospace; font-size: 13px;
}

.section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin: 16px 0 6px; font-weight: 600;
}
</style>
