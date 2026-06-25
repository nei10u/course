<script setup>
import ClientCacheDemo from '../components/demos/ClientCacheDemo.vue'
</script>

# Ch9 客户端缓存：Server-Assisted Client Caching

## 9.1 什么是 server-assisted client caching

Redis 6 引入了 **server-assisted client caching**：Redis 主动通知客户端"某个 key 变了，你的本地缓存过期了"。

传统架构：

```
Application → Redis → 返回数据
Application → Redis → 再查一次（重复请求）
```

客户端缓存后：

```
Application → Redis → 返回数据 → 存本地
Application → 本地缓存 → 直接返回（0 RTT）
Redis（key 变更）→ 通知客户端 → 删除本地缓存
Application → Redis → 重新获取最新值
```

核心收益：**减少 Redis 查询压力，降低网络延迟**。

## 9.2 tracking 模式（default vs broadcasting）

Redis 提供两种 tracking 模式：

| 模式 | 命令 | 原理 | 适用场景 |
|------|------|------|---------|
| Default | `CLIENT TRACKING on` | 服务器记录每个客户端读过的 key，变更时单独通知 | 少量客户端 |
| Broadcasting | `CLIENT TRACKING on BCAST` | 服务器广播所有 key 变更通知给订阅者 | 多客户端，缓存 key 子集 |

Default 模式：

```
Client A: GET user:1 → Redis 记录 {Client A → user:1}
Redis: SET user:1 new → 通知 Client A "user:1 失效"
```

Broadcasting 模式：

```
Client A: CLIENT TRACKING on BCAST PREFIX user:
Redis: SET user:1 new → 广播 "user:1 失效" 给所有 BCAST 订阅者
Client B: 收到通知，清除本地缓存
```

Broadcasting 模式用 `PREFIX` 限定 key 前缀，减少无效通知。

## 9.3 失效推送

Lettuce 完整实现了两种 tracking 模式。下面看失效推送的完整流程：

<div class="demo">
  <ClientCacheDemo />
</div>

观察要点：

- 客户端首次请求 key → Redis 返回值 + 开始 tracking
- Redis 中 key 被修改 → Redis 主动推送 `INVALIDATE` 消息
- 客户端收到 `INVALIDATE` → 清除本地缓存
- 下次请求 → 重新从 Redis 获取

## 9.4 Lettuce 的 ClientCache API

使用 Lettuce 内置的 `ClientCache`：

```java
// 创建带缓存功能的连接
StatefulRedisConnection<String, String> conn = client.connect();

// 基于 Caffeine 的缓存实现
Cache<String, String> cache = CaffeineCache.<String, String>builder()
    .build();

// 包装为 ClientCache
RedisCacheableCommands<String, String> cacheable =
    new RedisCacheableCommands<>(conn, cache);

// 使用 —— 自动从缓存读，miss 时查 Redis
String value = cacheable.get("user:1");
```

更底层的用法——直接配置 tracking：

```java
ClientOptions options = ClientOptions.builder()
    .autoReconnect(true)
    .build();

RedisURI uri = RedisURI.create("redis://localhost:6379");
// 启用 tracking
uri.setTrackingClientOptions(TrackingClientOptions.builder()
    .trackingMode(TrackingMode.BROADCASTING)  // 或 DEFAULT
    .prefix("user:")  // BCAST 模式的 key 前缀
    .build());

RedisClient client = RedisClient.create(uri);
StatefulRedisConnection<String, String> conn = client.connect();

// 连接就绪后，Lettuce 自动注册 tracking
conn.sync().get("user:1");  // 第一次读，进入 tracking
conn.sync().get("user:1");  // 后续读，Redis 知道这个客户端在读
```

## 9.5 实战：何时启用、性能收益

**适合启用 client caching 的场景：**

| 场景 | 收益 |
|------|------|
| 读多写少的配置数据 | 几乎所有请求命中本地缓存 |
| 用户 profile / session | 写入少，读取频繁 |
| 跨服务共享缓存 | 减少 Redis 访问，降低跨服务延迟 |

**不适合的场景：**

| 场景 | 原因 |
|------|------|
| 写频繁的 key | 失效通知太频繁，缓存命中率低 |
| 客户端数很多（>100） | 服务器 tracking 表膨胀 |
| 严格强一致性要求 | 缓存和 Redis 之间有短暂不一致窗口 |

性能收益参考：

```
无 client cache:  每次 GET → 1 RTT (0.1ms LAN)
有 client cache:  命中时 → 0 RTT (0ms，纯内存)
                  miss  → 1 RTT
命中率 90% 时，平均延迟降低 ~90%
```

**注意**：client cache 不能替代应用层缓存（如 Caffeine / Guava Cache）。它的价值在于 **Redis 主动帮你维护失效**，不需要你设 TTL 或手动清。

## 小结

- Server-assisted client caching 让 Redis 主动通知客户端缓存失效
- Default 模式跟踪每个客户端读过的 key；Broadcasting 模式广播给所有订阅者
- Lettuce 通过 `TrackingClientOptions` 配置，与 Caffeine 集成
- 读多写少场景收益最大，写频繁场景反而增加开销
- 不能替代应用层缓存，但可以作为 Redis 到应用之间的一层加速

下一章我们看 Codec（自定义序列化）和 Lua Scripts。
