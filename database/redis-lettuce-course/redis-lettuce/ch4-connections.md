<script setup>
import LettuceSharedConnectionDemo from '../components/demos/LettuceSharedConnectionDemo.vue'
</script>

# Ch4 连接管理：单连接共享 vs 显式池

## 4.1 默认 single-shared connection 的真相

`RedisClient.create().connect()` 返回的是一个 `StatefulRedisConnection`。大多数教程说"一个连接就够了"，但这句话需要精确理解：

```java
RedisClient client = RedisClient.create("redis://localhost:6379");
StatefulRedisConnection<String, String> conn = client.connect();

// 100 个线程同时用这个 conn —— 没问题
conn.sync().get("key");
conn.async().set("key", "value");
conn.reactive().get("key");
```

这不是"一个 TCP 连接给一个线程"——**一个 TCP 连接服务所有线程**。命令进入内部队列，由 Netty event loop 串行发到 Redis。TCP 连接本身只被一个线程（event loop）读写。

## 4.2 为什么线程安全

Jedis 不安全是因为它的 `InputStream` / `OutputStream` 被多线程同时读写会乱序。Lettuce 的做法是**命令队列 + 单 event loop 消费**：

<div class="demo">
  <LettuceSharedConnectionDemo />
</div>

内部流程：

```
Thread-1 ──→ cmd SET k1 v1 ──┐
Thread-2 ──→ cmd GET k2     ──┼──→ 队列 ──→ EventLoop ──→ TCP ──→ Redis
Thread-3 ──→ cmd SET k3 v3 ──┘
```

- 多线程往队列写（CAS 无锁）
- EventLoop 单线程从队列取、编码、发送、读响应、分发给对应 Future

这就保证了：**TCP 层面永远只有一个线程在读写，不会乱序**。

## 4.3 何时需要显式连接池

默认单连接在以下场景可能不够：

| 场景 | 单连接的问题 | 解决方案 |
|------|-------------|---------|
| 跨命令事务（MULTI/EXEC） | 事务期间其他命令被排队 | 多连接 |
| 阻塞命令（BLPOP） | 阻塞一个连接，所有命令卡住 | 专用连接 |
| 发布/订阅 | 订阅后连接不能做普通命令 | 独立连接 |
| Redis Cluster | 需要同时连多个节点 | cluster 模式自动管理 |
| 极高 QPS（>10万/s） | 单连接成为瓶颈 | 连接池 |

Lettuce 提供了 `LettucePoolingClientConfiguration`，配合 Apache Commons Pool2：

```java
LettucePoolingClientConfiguration poolConfig = LettucePoolingClientConfiguration.builder()
    .maxActive(8)
    .maxIdle(8)
    .minIdle(2)
    .build();

LettuceConnectionFactory factory = new LettuceConnectionFactory(
    new RedisStandaloneConfiguration("localhost", 6379),
    poolConfig
);
```

注意：Spring Boot 的 `spring.data.redis.lettuce.pool.*` 配置项就是控制这个。

## 4.4 连接池配置参数

| 参数 | 含义 | 建议值 |
|------|------|--------|
| `maxActive` | 最大活跃连接数 | 根据阻塞命令数量，通常 4-8 |
| `maxIdle` | 最大空闲连接数 | ≤ maxActive |
| `minIdle` | 最小空闲连接数 | 1-2，避免冷启动 |
| `maxWait` | 获取连接最大等待时间 | 500ms-2s |
| `timeBetweenEvictionRunsMillis` | 空闲检测间隔 | 30000（30s） |

配置建议：

```yaml
# application.yml
spring:
  data:
    redis:
      lettuce:
        pool:
          max-active: 8
          max-idle: 8
          min-idle: 2
          max-wait: 1s
```

大多数 Web 应用（Spring MVC + 普通 CRUD）用默认单连接就够了。只有在**使用阻塞命令**或**明确发现连接成为瓶颈**时才开池。

## 小结

- Lettuce 默认单连接，线程安全通过命令队列 + event loop 实现
- 池不是必须的——Jedis 必须池，Lettuce 不一定
- 阻塞命令（BLPOP）和 Pub/Sub 是最常见的需要多连接的场景
- 需要池时直接配 `LettucePoolingClientConfiguration` 即可

下一章我们深入异步模型：一个 async 命令从发出到返回，到底经历了什么。
