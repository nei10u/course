<script setup>
import ClusterRoutingDemo from '../components/demos/ClusterRoutingDemo.vue'
</script>

# Ch7 Cluster：16384 Slot 与路由

## 7.1 16384 hash slot 原理

Redis Cluster 将所有 key 映射到 **16384 个 hash slot**（0 ~ 16383），每个 master 节点负责一部分 slot：

```
Node A: slot 0 ~ 5460
Node B: slot 5461 ~ 10922
Node C: slot 10923 ~ 16383
```

当客户端发送 `SET user:1 Alice`，Cluster 计算 `CRC16("user:1") % 16384`，得到 slot 编号，将命令路由到对应节点。

```java
// CRC16 计算 —— Redis 的实现
// CRC16(key) % 16384 → slot number
```

## 7.2 CRC16 计算与路由

Lettuce 自动处理路由，你不需要手动计算。但理解机制有助于排查问题：

<div class="demo">
  <ClusterRoutingDemo />
</div>

内部流程：

```
1. client.set("user:1", "Alice")
2. Lettuce 内部：CRC16("user:1") = 8923
3. 8923 % 16384 = 8923 → 属于 Node B
4. Lettuce 直接发命令到 Node B 的连接
5. Node B 返回 OK
```

Lettuce 维护一张 slot → node 的映射表，在以下时机刷新：

- 首次连接时
- 收到 `MOVED` 重定向时
- 定期拓扑刷新（默认每 5 分钟）

```java
// 连接集群 —— 自动发现拓扑
RedisClusterClient client = RedisClusterClient.create(
    RedisURI.create("redis://node-a:7000"));

// topology refresh 间隔
ClusterTopologyRefreshOptions topologyOptions = ClusterTopologyRefreshOptions.builder()
    .enablePeriodicRefresh(Duration.ofMinutes(5))
    .enableAllAdaptiveRefreshTriggers()
    .build();

client.setOptions(ClusterClientOptions.builder()
    .topologyRefreshOptions(topologyOptions)
    .build());
```

## 7.3 MOVED 重定向

当集群拓扑变化（节点迁移、故障转移），slot 可能已经被移到新节点。此时 Redis 返回 `MOVED` 错误：

```
> SET key value
-MOVED 8923 10.0.0.2:7001
```

Lettuce 自动处理 `MOVED`：

1. 收到 `MOVED` 响应
2. 更新本地 slot → node 映射
3. 自动重发命令到新节点
4. 后续同 slot 命令直接发到正确节点

对你来说，这个过程是透明的——Lettuce 的重定向是自动的，不需要你写任何重试逻辑。

## 7.4 hash tag ({tag}) 强制同 slot

某些场景需要多个 key 在同一个 slot（比如 `MGET`、事务），用 **hash tag** 实现：

```java
// 不同 key，不同 slot
// CRC16("user:1:name") % 16384 → slot A
// CRC16("user:1:age")  % 16384 → slot B

// 用 {} 包裹的部分参与 CRC 计算
// CRC16("1") % 16384 → 两个 key 同一个 slot
String key1 = "{user:1}.name";  // tag = "user:1"
String key2 = "{user:1}.age";   // tag = "user:1"

// 现在可以 MGET
conn.sync().mget(key1, key2);  // 一次请求到同一个节点
```

规则：`{` 和 `}` 之间的部分参与 hash 计算，其余部分被忽略。如果 key 没有 `{}` 或只有左括号没有右括号，整个 key 参与计算。

```java
// 更多例子
"{user}.name"   → tag = "user"
"{user}.age"    → tag = "user"
"user{1}name"   → tag = "1"
"no-brace"      → 整个 key 参与计算
"only-left{"    → 整个 key 参与计算
```

## 7.5 读副本与失效转移

Cluster 模式下，Lettuce 支持从 replica 节点读取，减轻 master 负载：

```java
ClusterClientOptions options = ClusterClientOptions.builder()
    .topologyRefreshOptions(ClusterTopologyRefreshOptions.builder()
        .enablePeriodicRefresh(Duration.ofMinutes(1))
        .build())
    .build();

// 读策略：从 replica 读
RedisClusterClient client = RedisClusterClient.create(
    RedisURI.create("redis://node-a:7000"));

// 或者用 ReadFrom 设置
StatefulRedisClusterConnection<String, String> conn = client.connect();
conn.setReadFrom(ReadFrom.REPLICA);
// 现在 GET 命令发到 replica，SET 还是发到 master
```

| ReadFrom 策略 | 行为 |
|--------------|------|
| `MASTER` | 只读 master（默认） |
| `MASTER_PREFERRED` | 优先 master，master 不可用时读 replica |
| `REPLICA` | 只读 replica |
| `REPLICA_PREFERRED` | 优先 replica，replica 不可用时读 master |
| `NEAREST` | 读延迟最低的节点 |

故障转移：当 master 宕机，Redis Cluster 自动选举 replica 为新 master。Lettuce 通过拓扑刷新感知变化，自动更新路由表。

## 小结

- 16384 slot 由 CRC16(key) % 16384 决定
- Lettuce 自动维护 slot → node 映射，自动处理 `MOVED`
- `{tag}` 强制多个 key 同 slot，实现跨 key MGET / 事务
- `ReadFrom` 控制读请求发到 master 还是 replica
- 拓扑变化后自动刷新，不需要重启客户端

下一章我们看 Pub/Sub——Lettuce 对发布订阅的封装。
