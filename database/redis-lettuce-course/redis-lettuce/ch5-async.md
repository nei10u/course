<script setup>
import AsyncDeepDemo from '../components/demos/AsyncDeepDemo.vue'
</script>

# Ch5 异步深度：Netty Event Loop 与 CompletableFuture

## 5.1 Netty event loop 简介

Lettuce 基于 Netty，所有网络 I/O 都由 Netty 的 **event loop** 驱动。event loop 本质是一个**单线程事件循环**：

```
while (running) {
    1. 从 TCP 通道读数据 → 解码 Redis 响应
    2. 从命令队列取待发送命令 → 编码 → 写入 TCP
    3. 处理定时任务（心跳、重连）
}
```

关键点：

- **读写都在同一个线程**，不需要锁
- 默认 event loop 线程数 = `Runtime.getRuntime().availableProcessors()`
- 你的业务代码（Future 回调）默认也在 event loop 线程执行——**不要阻塞它**

```java
// clientOptions 可以配置 event loop 线程数
ClientOptions options = ClientOptions.builder()
    .ioResources(ioResources -> ioResources
        .eventLoopGroup(new NioEventLoopGroup(4)))
    .build();

RedisClient client = RedisClient.create(
    RedisURI.create("redis://localhost:6379"));
client.setOptions(options);
```

## 5.2 一个 async 命令的完整旅程

从 `async.set("k", "v")` 到 Future 完成，经过以下步骤：

<div class="demo">
  <AsyncDeepDemo />
</div>

简化流程：

```
1. 调用线程：async.set("k","v")
   → 构造 Redis 命令对象
   → 加入命令队列（CAS，非阻塞）
   → 返回 RedisFuture（此时命令还没发出去）

2. EventLoop 线程：
   → 从队列取出命令
   → RESP 编码：*3\r\n$3\r\nSET\r\n...
   → 写入 Netty Channel（TCP 发送）

3. Redis 服务器：
   → 执行 SET k v
   → 返回 +OK

4. EventLoop 线程：
   → 从 TCP 读到 +OK
   → RESP 解码
   → 找到对应的 RedisFuture
   → future.complete("OK")  ← Future 在这里完成

5. 你的回调（如果有的话）：
   → future.thenAccept(v -> ...) 在 event loop 线程执行
```

注意：**步骤 4 和 5 在同一线程**。如果回调做了耗时操作，event loop 被阻塞，后续所有命令都会延迟。

## 5.3 CompletableFuture 链式

`RedisFuture<T>` 继承 `CompletableFuture<T>`，可以用完整的链式 API：

```java
RedisAsyncCommands<String, String> async = conn.async();

// 基本链式：set 完成后自动 get
async.set("user:1", "Alice")
    .thenCompose(s -> async.get("user:1"))
    .thenApply(name -> "Hello, " + name)
    .thenAccept(System.out::println);

// 并行 + 合并
RedisFuture<String> name = async.get("user:1:name");
RedisFuture<String> city = async.get("user:1:city");

CompletableFuture<String> profile = name
    .thenCombine(city, (n, c) -> n + " from " + c);
profile.thenAccept(System.out::println);

// 等待全部完成
List<RedisFuture<String>> futures = IntStream.range(0, 100)
    .mapToObj(i -> async.get("key:" + i))
    .collect(Collectors.toList());
CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
    .thenRun(() -> System.out.println("All done!"));
```

## 5.4 错误处理

异步代码的错误处理是痛点。`CompletableFuture` 提供了几种方式：

```java
RedisAsyncCommands<String, String> async = conn.async();

// exceptionally：类似 try-catch，返回默认值
async.get("nonexistent")
    .exceptionally(ex -> {
        if (ex instanceof RedisException) {
            return "default-value";
        }
        throw new CompletionException(ex);
    });

// handle：拿到结果或异常，做通用处理
async.incr("not-a-number")
    .handle((result, ex) -> {
        if (ex != null) {
            log.warn("INCR failed", ex);
            return 0L;
        }
        return result;
    });

// thenCompose 中抛异常会传播到后续链
async.get("config:key")
    .thenCompose(config -> {
        if (config == null) {
            throw new IllegalStateException("config missing");
        }
        return async.set("derived:key", config);
    })
    .exceptionally(ex -> {
        log.error("chain failed", ex);
        return null;
    });
```

关键：**没有 try-catch，异常在链中传播**。每个节点都可以用 `exceptionally` / `handle` 捕获。未处理的异常会被静默吞掉——建议最后加一个 `.exceptionally` 兜底。

## 5.5 线程模型：哪个线程执行回调

这是最常见的陷阱：

```java
async.get("key").thenAccept(v -> {
    // 这段代码在哪个线程执行？
    // 答案：Netty event loop 线程
    System.out.println(Thread.currentThread().getName());
    // 输出：lettuce-eventLoopGroup-1-1
});
```

**默认情况下，回调在 event loop 线程执行**。这意味着：

- 不要在回调里做阻塞操作（数据库查询、文件 I/O）
- 不要在回调里调用 `future.get()`（会死锁）

如果回调较重，切换到其他线程：

```java
async.get("key")
    .thenAcceptAsync(v -> {
        // 在 ForkJoinPool 线程执行
        heavyProcessing(v);
    }, Executors.newFixedThreadPool(4));
```

## 小结

- Async 命令 = 入队 → event loop 编码发送 → Redis 响应 → event loop 解码 → future 完成
- 回调默认在 event loop 线程，不要阻塞它
- 用 `thenApply` / `thenCompose` / `thenCombine` 组合，`exceptionally` / `handle` 处理错误
- 重回调建议用 `thenAcceptAsync` 切换线程

下一章我们看 Reactive API，它与 Async 有关联但也有本质区别。
