# Ch3 自动 Pipeline

## 3.1 什么是 pipelining

Redis 协议（RESP）允许客户端**一次性发送多个命令**，然后批量读取响应。这样可以省掉每个命令的 RTT（round-trip time）。

```
无 pipeline:    cmd1 → resp1 → cmd2 → resp2 → ...   N × RTT
有 pipeline:    cmd1, cmd2, ... → resp1, resp2, ...   1 × RTT
```

当 N 很大时，差异非常显著。

## 3.2 Lettuce 的自动 pipelining

Lettuce 不需要你显式开 Pipeline 模式。当多个 Sync/Async 命令通过同一个 `StatefulRedisConnection` 发出时，它**自动**把命令批处理：

```java
StatefulRedisConnection<String, String> conn = client.connect();
RedisAsyncCommands<String, String> async = conn.async();

// 这 1000 个 set 不是 1000 个 RTT
for (int i = 0; i < 1000; i++) {
    async.set("k" + i, "v" + i);
}
```

为什么？因为 async API 立即返回 CompletableFuture，循环不停下来等响应；Netty 的 event loop 把这一连串命令一次性 flush 出去。

## 3.3 演示：Pipeline 时间线

下面是同一个循环（N 次 SET）在 Sync API 和 Async API 下的对比：

<script setup>
import PipelineTimelineDemo from '../components/demos/PipelineTimelineDemo.vue'
</script>

<div class="demo">
  <PipelineTimelineDemo />
</div>

观察要点：

- **Sync API 路径**：每次循环要等 Redis 返回响应才进下一次，N 次 SET = N × RTT
- **Async API 路径**：循环不停，所有命令进入队列后被一次性 flush，N 次 SET ≈ 1 × RTT

调节"循环数"为 1000，看 Sync 路径需要 10000ms，Async 路径只需要约 12ms——**接近 1000 倍差距**。

## 3.4 失效场景

自动 pipelining 在以下情况不会生效：

- **每个命令前显式 `await()`**：把异步强行变同步，循环就得逐个等
- **使用阻塞式 Sync API 嵌套循环**：Sync API 每次都阻塞，等同不批
- **跨多个连接**：每个连接是独立 pipeline，需要自己批

```java
// ❌ 不会触发 pipeline（每条都等）
for (int i = 0; i < 1000; i++) {
    String v = async.set("k" + i, "v" + i).get(1, TimeUnit.SECONDS);  // 阻塞等
}

// ✅ 正确的 pipelining（先全部发出再统一等）
List<CompletableFuture<String>> futures = new ArrayList<>();
for (int i = 0; i < 1000; i++) {
    futures.add(async.set("k" + i, "v" + i).toCompletableFuture());
}
CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
```

## 3.5 与 Jedis Pipeline 对比

| 维度 | Jedis Pipeline | Lettuce 自动 pipeline |
|------|----------------|----------------------|
| 触发方式 | 显式 `Pipeline pip = jedis.pipelined()` | 默认开启 |
| 关闭 | 自动在 `pip.sync()` 后 | 永远开（同连接内） |
| API 复杂度 | 双层（普通 / Pipeline） | 单层 |

Lettuce 的设计更符合直觉，但也意味着**新手容易踩坑**：以为循环是 pipelined 但实际不是（如 3.4 的反例）。

## 小结

- Lettuce 默认 pipelining，**前提是**命令通过同一连接异步发出
- Sync API 无法 pipelining，因为它每次阻塞
- 调节循环数、观察时间线，能直观看到差异

下一章我们会进入连接管理：默认单连接为何够用，什么时候需要池。
