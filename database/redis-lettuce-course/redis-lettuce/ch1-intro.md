<script setup>
import JedisPoolDemo from '../components/demos/JedisPoolDemo.vue'
import LettuceSharedConnectionDemo from '../components/demos/LettuceSharedConnectionDemo.vue'
import ThreeApiTimelineDemo from '../components/demos/ThreeApiTimelineDemo.vue'
import SyncPlayground from '../components/demos/SyncPlayground.vue'
</script>

# Ch1 Lettuce 简介：从 Jedis 到 Lettuce 的范式差异

## 1.1 为什么是 Lettuce

Lettuce 是基于 Netty 的 Redis Java 客户端，自 Spring Data Redis 2.x 起作为默认底层客户端。

它的核心特性：

- **同步 / 异步 / 响应式三套 API** 并存
- **基于 Netty**，单连接共享即可服务多线程
- **自动 pipelining**、原生 cluster / pub-sub / 客户端缓存支持

## 1.2 Jedis 模型：连接池 + 同步阻塞

Jedis 是早期主流的 Redis Java 客户端。它的连接是**阻塞式、独占式**的——一个连接同一时刻只能被一个线程使用，因此多线程场景下必须配连接池：

```java
JedisPool pool = new JedisPool("localhost", 6379);
try (Jedis jedis = pool.getResource()) {
    jedis.set("k", "v");
}
```

为什么池要这么大？看下面的演示：

<div class="demo">
  <JedisPoolDemo />
</div>

## 1.3 Lettuce 模型：单连接 + 共享 event loop

Lettuce 默认单个 `StatefulRedisConnection` 就可以**安全地被多线程共享**。所有命令进入一个内部队列，由 Netty 的 event loop 顺序处理。

```java
RedisClient client = RedisClient.create("redis://localhost:6379");
StatefulRedisConnection<String, String> conn = client.connect();
// conn 可以被多线程共享
```

为什么这样行得通：

<div class="demo">
  <LettuceSharedConnectionDemo />
</div>

## 1.4 三套 API 概览

Lettuce 提供三套 API，底层连接是同一个，只是编程模型不同：

```java
StatefulRedisConnection<String, String> conn = client.connect();

// Sync：最熟悉的同步调用
String v1 = conn.sync().get("k");

// Async：返回 CompletableFuture
CompletableFuture<String> f = conn.async().get("k");

// Reactive：返回 Mono / Flux
Mono<String> m = conn.reactive().get("k");
```

三套 API 的回调时机对比：

<div class="demo">
  <ThreeApiTimelineDemo />
</div>

## 1.5 试试看

下面是一个受限的 Sync API playground，你可以改命令、key、value，观察 Redis 数据变化：

<div class="demo">
  <SyncPlayground />
</div>

## 小结

| 维度 | Jedis | Lettuce |
|------|-------|---------|
| 连接模型 | 池 + 阻塞 | 单连接共享 |
| API | 同步为主 | 同步/异步/响应式 |
| 线程安全 | 每连接单线程 | 连接可共享 |
| 默认 pipelining | 需显式 Pipeline 对象 | 自动 |

下一章我们会进入 Lettuce 自动 pipelining 的细节——这是它最让人困惑也最强大的特性。
