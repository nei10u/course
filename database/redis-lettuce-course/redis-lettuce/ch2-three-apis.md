<script setup>
import ThreeApiTimelineDemo from '../components/demos/ThreeApiTimelineDemo.vue'
</script>

# Ch2 三套 API 深度：Sync / Async / Reactive

## 2.1 三套 API 的本质区别

Lettuce 从同一个 `StatefulRedisConnection` 派生出三套命令接口，本质区别在**返回类型**和**线程模型**：

| 维度 | Sync | Async | Reactive |
|------|------|-------|----------|
| 返回类型 | `String`, `Long` ... | `RedisFuture<T>` | `Mono<T>`, `Flux<T>` |
| 编程模型 | 阻塞调用 | CompletableFuture | Reactor 流 |
| 线程 | 调用线程阻塞 | Netty event loop | 订阅者线程 / event loop |
| 适用场景 | 简单脚本、批处理 | 高并发 I/O 密集 | WebFlux / 响应式全栈 |

```java
StatefulRedisConnection<String, String> conn = client.connect();

// Sync —— 最简单，调用线程阻塞等 Redis
String v = conn.sync().get("key");

// Async —— 立即返回 Future，不阻塞
RedisFuture<String> future = conn.async().get("key");

// Reactive —— 返回 Mono，惰性求值
Mono<String> mono = conn.reactive().get("key");
```

三者共享同一个底层连接。选择哪套 API 不影响连接复用，只影响**你如何等待结果**。

## 2.2 何时用 Sync

Sync API 最接近 Jedis 的使用体验——调用即阻塞，拿到值就继续。适合：

- 命令行工具、一次性脚本
- 不需要并发的批处理
- 与遗留同步框架集成

```java
RedisCommands<String, String> sync = conn.sync();
String name = sync.get("user:1:name");
Long age = sync.get("user:1:age");
// 顺序执行，每次等 Redis 返回
```

但 Sync 有明显代价：**调用线程被阻塞**，在 I/O 等待期间无法做其他事。当并发量上升时，线程池会被占满。

看三套 API 在时间线上的差异：

<div class="demo">
  <ThreeApiTimelineDemo />
</div>

要点：Sync 路径下每个命令独占一个 RTT；Async 路径可以发出多个命令后统一等待。

## 2.3 何时用 Async

Async API 返回 `RedisFuture<T>`（继承 `CompletableFuture<T>`），适合需要**并发发出多条命令**但不打算引入 Reactor 的场景。

```java
RedisAsyncCommands<String, String> async = conn.async();

// 同时发出两条命令，不互相等待
RedisFuture<String> nameF = async.get("user:1:name");
RedisFuture<String> ageF  = async.get("user:1:age");

// 链式组合
nameF.thenApply(name -> "Hello " + name)
    .thenCombine(ageF, (greeting, age) -> greeting + ", age " + age)
    .thenAccept(System.out::println);
```

优势：

- 循环发出 1000 条 SET，不用每条等——自动 pipelining
- `thenApply` / `thenCombine` / `allOf` 组合多个异步操作
- 不引入 Reactor 依赖

注意：`RedisFuture` 可以直接 `.get()` 阻塞等待，但这样就退化成 Sync 了。

## 2.4 何时用 Reactive

Reactive API 返回 `Mono<T>` / `Flux<T>`，是 Project Reactor 的原生类型。适合：

- 项目本身使用 Spring WebFlux
- 需要背压（backpressure）控制
- 需要声明式的数据流组合

```java
RedisReactiveCommands<String, String> reactive = conn.reactive();

// 声明式：先拿 name 再拿 age
Mono<String> profile = reactive.get("user:1:name")
    .zipWith(reactive.get("user:1:age"))
    .map(tuple -> tuple.getT1() + " (" + tuple.getT2() + ")");

profile.subscribe(System.out::println);
```

Reactive API 的真正威力在**大量数据流**场景——`SCAN`、`KEYS`、Pub/Sub 消息流——这些会返回 `Flux`，可以用 `limitRate` 控制背压。

## 2.5 三者切换的代价

三套 API 共享同一个连接，**可以混用**：

```java
StatefulRedisConnection<String, String> conn = client.connect();

// 混用完全合法
String v1   = conn.sync().get("a");       // 阻塞
conn.async().set("b", "v");               // 不等
Mono<String> m = conn.reactive().get("c"); // 声明式
```

但混用要小心：

| 场景 | 风险 |
|------|------|
| Sync + Async 在同一连接 | Sync 会阻塞命令队列，Async 命令排不上 |
| Reactive subscribe 后再 Sync | subscribe 触发 Netty 写，Sync 可能读到意外响应 |
| 频繁切换三套 API | 代码风格不统一，维护成本高 |

**建议**：一个模块选定一套 API，不要在一个业务方法里混用。

## 小结

- 三套 API 共享连接，区别仅在编程模型
- Sync 简单但阻塞线程，Async 是并发 I/O 的甜点，Reactive 适合全响应式栈
- 可以混用但不建议——选定一套保持一致

下一章我们看连接管理：Lettuce 的单连接共享模型到底是怎么回事。
