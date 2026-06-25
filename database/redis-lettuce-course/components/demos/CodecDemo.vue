<!-- components/demos/CodecDemo.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'

type CodecType = 'string' | 'json' | 'gzip'

const codecType = ref<CodecType>('string')
const inputValue = ref('hello')

// Simulated codec serialization
const serialized = computed(() => {
  const val = inputValue.value
  switch (codecType.value) {
    case 'string':
      return { type: 'StringCodec', bytes: new TextEncoder().encode(val), description: `直接 UTF-8 编码: ${val}` }
    case 'json': {
      const obj = { message: val, timestamp: Date.now() }
      const json = JSON.stringify(obj)
      return { type: 'JSON Codec', bytes: new TextEncoder().encode(json), description: `JSON.stringify → ${json}` }
    }
    case 'gzip': {
      // Simulated gzip (show compressed size estimate)
      const original = new TextEncoder().encode(val)
      const ratio = 0.3
      const compressed = new Uint8Array(Math.ceil(original.length * ratio))
      return { type: 'GzipCodec', bytes: compressed, description: `gzip 压缩 (约 ${(ratio * 100).toFixed(0)}% 原始大小)` }
    }
  }
})

const deserialized = ref<string | null>(null)

function simulateDeserialize() {
  switch (codecType.value) {
    case 'string':
      deserialized.value = inputValue.value
      break
    case 'json':
      deserialized.value = JSON.stringify({ message: inputValue.value, timestamp: 0 }, null, 2)
      break
    case 'gzip':
      deserialized.value = inputValue.value + ' (decompressed)'
      break
  }
}

function reset() {
  deserialized.value = null
}

// Hex dump of bytes
const hexDump = computed(() => {
  const bytes = serialized.value.bytes
  const hex: string[] = []
  const len = Math.min(bytes.length, 32) // Show first 32 bytes
  for (let i = 0; i < len; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0').toUpperCase())
  }
  if (bytes.length > 32) hex.push('...')
  return hex.join(' ')
})

const byteCount = computed(() => serialized.value.bytes.length)
</script>

<template>
  <div class="demo">
    <h4>自定义 Codec 演示</h4>
    <p class="intro">
      选择不同的 Codec 类型，观察 <code>set(myObj)</code> 如何被序列化为字节，
      以及如何从字节反序列化回对象。
    </p>

    <div class="params">
      <label>Codec:
        <select v-model="codecType" data-test="codec">
          <option value="string">StringCodec</option>
          <option value="json">JSON Codec</option>
          <option value="gzip">GzipCodec</option>
        </select>
      </label>
      <label>输入: <input v-model="inputValue" data-test="input" placeholder="hello" /></label>
    </div>

    <div class="actions">
      <button class="run-btn" data-test="run" @click="simulateDeserialize">模拟 SET (序列化)</button>
      <button class="reset-btn" data-test="reset" @click="reset">重置</button>
    </div>

    <!-- Serialization result -->
    <div class="section">
      <div class="section-title">序列化结果 (Codec: {{ serialized.type }})</div>
      <div class="codec-box">
        <div class="codec-desc">{{ serialized.description }}</div>
        <div class="bytes-info">
          <span class="byte-count">{{ byteCount }} bytes</span>
        </div>
        <div class="hex-dump">
          <div class="dump-label">Hex:</div>
          <code>{{ hexDump }}</code>
        </div>
      </div>
    </div>

    <!-- Pipeline visualization -->
    <div class="pipeline-vis">
      <div class="pipe-stage encode">
        <div class="stage-label">Java 对象</div>
        <div class="stage-content">{{ inputValue }}</div>
      </div>
      <div class="pipe-arrow">→ {{ serialized.type }}</div>
      <div class="pipe-stage bytes">
        <div class="stage-label">字节流</div>
        <div class="stage-content">{{ byteCount }} bytes</div>
      </div>
      <div class="pipe-arrow">→ Redis SET</div>
      <div class="pipe-stage redis">
        <div class="stage-label">Redis</div>
        <div class="stage-content">存储字节</div>
      </div>
    </div>

    <!-- Deserialization result -->
    <div class="section" v-if="deserialized">
      <div class="section-title">反序列化结果 (GET → decode)</div>
      <div class="codec-box result">
        <pre>{{ deserialized }}</pre>
      </div>
    </div>

    <p class="takeaway">
      <strong>要点：</strong>
      RedisCodec 是 Lettuce 的扩展点。StringCodec 直接存 UTF-8；
      JSON Codec 用 Jackson 序列化对象；GzipCodec 在序列化后压缩。
      自定义 Codec 只需实现 encode/decode 方法。
    </p>
  </div>
</template>

<style scoped>
.demo { padding: 16px; }
.intro { font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; margin-bottom: 12px; }
.intro code { background: var(--vp-c-bg-soft); padding: 1px 4px; border-radius: 3px; font-size: 12px; }

.params { display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px; flex-wrap: wrap; align-items: center; }
.params select, .params input {
  padding: 4px 8px; border: 1px solid var(--vp-c-border);
  border-radius: 4px; background: var(--vp-c-bg); color: var(--vp-c-text-1);
  font-family: monospace; font-size: 12px;
}
.params input { width: 160px; }

.actions { display: flex; gap: 8px; margin: 12px 0; }
.run-btn {
  padding: 5px 14px; cursor: pointer;
  background: var(--vp-c-brand-1); color: white;
  border: 1px solid var(--vp-c-brand-2); border-radius: 5px;
  font-size: 13px; font-weight: 600; font-family: monospace;
  transition: background 0.15s;
}
.run-btn:hover { background: var(--vp-c-brand-2); }
.reset-btn {
  padding: 5px 12px; cursor: pointer;
  background: var(--vp-c-bg-soft); color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border); border-radius: 5px; font-size: 12px;
}

.section { margin: 12px 0; }
.section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-2); margin-bottom: 6px; font-weight: 600;
}

.codec-box {
  border: 1px solid var(--vp-c-border); border-radius: 6px;
  padding: 10px; background: var(--vp-c-bg-soft);
  font-family: monospace; font-size: 12px;
}
.codec-desc { color: var(--vp-c-text-1); margin-bottom: 6px; }
.bytes-info { color: var(--vp-c-text-3); font-size: 11px; }
.byte-count { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); padding: 1px 6px; border-radius: 8px; }
.hex-dump { margin-top: 8px; }
.dump-label { color: var(--vp-c-text-3); font-size: 10px; margin-bottom: 2px; }
.hex-dump code { color: var(--vp-c-text-2); font-size: 11px; word-break: break-all; }

.codec-box.result pre {
  margin: 0; white-space: pre-wrap; color: #16a34a;
  background: #dcfce7; padding: 8px; border-radius: 4px;
}

.pipeline-vis {
  display: flex; align-items: center; gap: 8px; margin: 16px 0;
  flex-wrap: wrap; justify-content: center;
}
.pipe-stage {
  padding: 10px 14px; border: 2px solid var(--vp-c-border);
  border-radius: 6px; text-align: center; min-width: 80px;
}
.pipe-stage.encode { border-color: #d97706; background: #fef3c7; }
.pipe-stage.bytes { border-color: #2563eb; background: #dbeafe; }
.pipe-stage.redis { border-color: #dc2626; background: #fee2e2; }
.stage-label { font-size: 10px; text-transform: uppercase; color: var(--vp-c-text-3); }
.stage-content { font-size: 12px; font-family: monospace; font-weight: 600; margin-top: 4px; }
.pipe-arrow { font-size: 12px; color: var(--vp-c-text-3); font-family: monospace; }

.takeaway {
  font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6;
  margin-top: 16px; padding: 10px;
  background: var(--vp-c-brand-soft); border-left: 3px solid var(--vp-c-brand-1);
  border-radius: 4px;
}
</style>
