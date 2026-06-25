<script setup>
import BackpressureDemo from '../components/demos/BackpressureDemo.vue'
</script>

# Ch6 Reactive 深度：Project Reactor 与背压

## 6.1 Reactor 基础回顾

Project Reactor 是 Spring 5 引入的响应式编程库，核心类型：

| 类型 | 含义 | 类比 |
|------|------|------|
| `Mono<T>` | 0 或 1 个元素 | `CompletableFuture<T>` |
| `Flux<T>` | 0 到 N 个元素 | `Stream<T>`（异步版） |

Lettuce 的 Reactive API 直接返回这两种类型：

```java
RedisReactiveCommands<String, String> reactive = conn.reactive();

// Mono：单值操作
Mono<String> mono = reactive.get("key");

// Flux：多值操作
Flux<String> keys = reactive.keys("user:*");

// 声明式链
Mono<Long> count = reactive.keys("cache:*")
    .flatMap(key -> reactive.del(key))
    .count();
```

与 CompletableFuture 的关键区别：**Reactor 是惰性的**。`mono.get("key")` 不会发命令，直到有人 subscribe。

```java
// 这行代码不会发任何网络请求
Mono<String> mono = reactive.get("key");

// subscribe 才触发实际执行
mono.subscribe(value -> System.out.println(value));
```

## 6.2 hot vs cold publisher

理解冷热 publisher 对正确使用 Lettuce Reactive API 至关重要：

| 类型 | 行为 | 示例 |
|------|------|------|
| Cold（冷） | 每次 subscribe 重新执行 | `GET`、`SET` 等普通命令 |
| Hot（热） | subscribe 只接收之后的消息 | Pub/Sub、Key-space 通知 |

```java
// Cold —— 每次 subscribe 都会重新向 Redis 发命令
Mono<String> mono = reactive.get("key");
mono.subscribe(v -> System.out.println("A: " + v)); // 发 GET
mono.subscribe(v -> System.out.println("B: " + v)); // 再发一次 GET

// Hot —— subscribe 后只收后续消息
Flux<String> stream = reactive.pubsubChannels("news:*");
stream.subscribe(msg -> System.out.println("got: " + msg)); // 订阅，不回放历史
```

Lettuce 的普通命令（GET/SET/HSET...）都是 cold；Pub/Sub 相关的是 hot。

## 6.3 背压（Backpressure）

Reactive 编程的核心优势之一是**背压**：消费者可以告诉生产者"我一次只能处理 N 条"，生产者不会溢出消费者。

<div class="demo">
  <BackpressureDemo />
</div>

Lettuce 中最典型的场景是 `KEYS` / `SCAN` 返回大量 key：

```java
// 无背压：一口气拿 100 万个 key → OOM
Flux<String> allKeys = reactive.keys("*");

// 有背压：每次最多 100 个，处理完再拿下一批
Flux<String> allKeys = reactive.keys("*")
    .limitRate(100);  // 每次请求 100 个

// 用 buffer 分批处理
reactive.keys("user:*")
    .limitRate(50)
    .buffer(50)
    .subscribe(batch -> {
        // 每批 50 个 key，批量删除
        reactive.del(batch.toArray(new String[0])).subscribe();
    });
```

`limitRate(n)` 是最常用的背压操作符，它告诉上游"我准备好接收 n 个了"，处理完后再请求下一批。

## 6.4 Lettuce 的响应式 API

完整的映射关系：

```java
RedisReactiveCommands<String, String> reactive = conn.reactive();

// String 操作
Mono<String>    get     = reactive.get("key");
Mono<Boolean>   set     = reactive.set("key", "value");
Mono<Long>      incr    = reactive.incr("counter");

// Hash 操作
Mono<Map<String, String>> hgetall = reactive.hgetall("user:1");
Mono<String>                hget   = reactive.hget("user:1", "name");

// List 操作
Flux<String> lrange  = reactive.lrange("queue", 0, -1);
Mono<Long>   lpush   = reactive.lpush("queue", "job1", "job2");

// Set 操作
Flux<String> smembers = reactive.smembers("tags");
Mono<Long>   sadd     = reactive.sadd("tags", "java", "redis");

// SCAN —— 返回 Flux
Flux<String> scan = reactive.scan();
```

注意：`lrange` 返回 `Flux` 因为可能有多个元素；`lpush` 返回 `Mono<Long>` 因为只有一个计数。

## 6.5 与 Spring WebFlux 集成

Lettuce Reactive API 和 Spring WebFlux 天然配合：

```java
@RestController
public class UserController {

    private final RedisReactiveCommands<String, String> reactive;

    public UserController(RedisReactiveCommands<String, String> reactive) {
        this.reactive = reactive;
    }

    @GetMapping("/user/{id}")
    public Mono<User> getUser(@PathVariable String id) {
        return reactive.hgetall("user:" + id)
            .map(hash -> new User(
                hash.get("name"),
                Integer.parseInt(hash.getOrDefault("age", "0"))
            ));
    }

    @GetMapping("/users")
    public Flux<String> listUsers() {
        return reactive.keys("user:*");
    }
}
```

整个请求链——Controller → Redis → 响应——都在 event loop 线程完成，不需要额外线程池。这就是响应式全栈的核心价值。

## 小结

- `Mono` = 0/1 个结果，`Flux` = 0~N 个结果
- Reactor 是惰性的，subscribe 才触发执行
- 普通命令是 cold（每次 subscribe 重新执行），Pub/Sub 是 hot
- `limitRate(n)` 控制背压，避免一次加载过多数据
- 与 WebFlux 集成零成本——都是 Reactor 类型

下一章我们看 Redis Cluster 模式下 Lettuce 如何路由命令。
