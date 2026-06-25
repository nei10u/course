<script setup>
import PubSubDemo from '../components/demos/PubSubDemo.vue'
</script>

# Ch8 Pub/Sub：发布订阅

## 8.1 channel vs pattern 订阅

Redis Pub/Sub 有两种订阅方式：

| 方式 | 命令 | 匹配规则 |
|------|------|---------|
| Channel（频道） | `SUBSCRIBE news` | 精确匹配频道名 |
| Pattern（模式） | `PSUBSCRIBE news:*` | 通配符匹配 |

```java
// 频道订阅：精确匹配
SUBSCRIBE news          → 收到 "news" 频道消息
SUBSCRIBE news:sports   → 收到 "news:sports" 消息（不会收到 "news"）

// 模式订阅：通配符
PSUBSCRIBE news:*       → 收到所有 "news:xxx" 频道消息
```

`PSUBSCRIBE` 中 `*` 只匹配一层，`?` 匹配单个字符，`[ab]` 匹配集合。不支持 `**` 或正则。

## 8.2 Lettuce 的 PubSub API

Lettuce 的 Pub/Sub 需要一个**独立的连接**——订阅后这个连接不能做普通命令。

<div class="demo">
  <PubSubDemo />
</div>

基本用法：

```java
RedisClient client = RedisClient.create("redis://localhost:6379");

// 订阅端 —— 独立连接
StatefulRedisPubSubConnection<String, String> subConn = client.connectPubSub();
subConn.addListener(new RedisPubSubAdapter<String, String>() {
    @Override
    public void message(String channel, String message) {
        System.out.println(channel + ": " + message);
    }

    @Override
    public void subscribed(String channel, long count) {
        System.out.println("Subscribed to " + channel);
    }

    @Override
    public void unsubscribed(String channel, long count) {
        System.out.println("Unsubscribed from " + channel);
    }
});
RedisPubSubCommands<String, String> sub = subConn.sync();
sub.subscribe("news");

// 发布端 —— 普通连接
StatefulRedisConnection<String, String> pubConn = client.connect();
pubConn.sync().publish("news", "Breaking: Lettuce is awesome!");
```

模式订阅：

```java
subConn.addListener(new RedisPubSubAdapter<String, String>() {
    @Override
    public void pmessage(String pattern, String channel, String message) {
        System.out.println("Pattern " + pattern + ", channel " + channel + ": " + message);
    }
});
sub.psubscribe("news:*");
```

Reactive 版本：

```java
StatefulRedisPubSubConnection<String, String> subConn = client.connectPubSub();
RedisPubSubReactiveCommands<String, String> reactive = subConn.reactive();

Flux<ChannelMessage<String, String>> messages = reactive.subscribe("news")
    .flatMapMany(c -> subConn.reactive().observeChannels());
    // observeChannels 返回 Flux<ChannelMessage>，持续接收消息

messages.subscribe(msg -> {
    System.out.println(msg.getChannel() + ": " + msg.getMessage());
});
```

## 8.3 消息丢失与可靠性边界

Redis Pub/Sub 是 **fire-and-forget**，有以下限制：

| 特性 | Redis Pub/Sub | 是否可靠 |
|------|---------------|---------|
| 消息持久化 | 无 | 断连后消息丢失 |
| 消息确认 | 无 | 无法确认消费者收到 |
| 离线消息 | 无 | 下线期间消息丢失 |
| 消息回溯 | 无 | 无法重播 |

```
Publisher → Redis → Subscriber A ✓
                    → Subscriber B (断连) ✗ 消息丢失
```

这是 Redis Pub/Sub 的设计取舍——它不是消息队列。如果需要可靠投递，应该用 **Redis Streams**（`XADD` / `XREADGROUP`）。

```java
// Redis Streams —— 可靠版本（Lettuce 同样支持）
StatefulRedisConnection<String, String> conn = client.connect();
conn.sync().xadd("mystream", Collections.singletonMap("msg", "hello"));
List<StreamMessage<String, String>> msgs = conn.sync().xread(
    XReadArgs.StreamOffset.latest("mystream"));
```

## 8.4 实战场景：实时通知、缓存失效

**场景 1：实时通知**

```java
// 多个服务实例订阅配置变更通知
subConn.addListener(new RedisPubSubAdapter<String, String>() {
    @Override
    public void message(String channel, String message) {
        if ("config:updated".equals(channel)) {
            reloadConfig(message);
        }
    }
});
sub.subscribe("config:updated");
```

**场景 2：缓存失效广播**

```java
// 写服务：更新 DB 后发通知
db.update(user);
conn.sync().publish("cache:invalidate", "user:" + userId);

// 读服务：收到通知后清本地缓存
subConn.addListener(new RedisPubSubAdapter<String, String>() {
    @Override
    public void message(String channel, String message) {
        localCache.invalidate(message);
    }
});
sub.subscribe("cache:invalidate");
```

这种方式比直接 `DEL` 更灵活——每个实例自己决定何时失效、是否预热。

## 小结

- Pub/Sub 需要独立连接，订阅后不能做普通命令
- 支持 channel 精确订阅和 pattern 通配订阅
- `RedisPubSubAdapter` 提供消息、订阅、取消订阅回调
- 本质是 fire-and-forget，不保证可靠投递——可靠场景用 Streams
- 典型用途：配置变更通知、缓存失效广播

下一章我们看 server-assisted client caching——Redis 6 引入的客户端缓存特性。
