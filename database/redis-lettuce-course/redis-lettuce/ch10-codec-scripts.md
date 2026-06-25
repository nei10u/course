<script setup>
import CodecDemo from '../components/demos/CodecDemo.vue'
import ScriptsDemo from '../components/demos/ScriptsDemo.vue'
</script>

# Ch10 Codec 与 Lua Scripts

## 10.1 Codec 是什么、为什么需要

Lettuce 的连接是泛型的：`StatefulRedisConnection<K, V>`。Codec 负责**在 Java 对象和 Redis RESP 协议之间做编解码**：

```
Java Object → Codec.encode() → RESP bytes → TCP → Redis
Redis → TCP → RESP bytes → Codec.decode() → Java Object
```

Jedis 默认存 `String`，如果你要存对象就得自己序列化成 JSON 或字节。Lettuce 把这个过程抽象为 Codec 接口——换一个 Codec 实现，存储格式自动变。

```java
// String Codec —— 默认
StatefulRedisConnection<String, String> conn = client.connect();

// ByteArray Codec —— 存原始字节
StatefulRedisConnection<byte[], byte[]> conn = client.connect(
    new ByteArrayCodec());

// JSON Codec —— 存 JSON 字符串
StatefulRedisConnection<String, User> conn = client.connect(
    new JacksonCodec<>(User.class));
```

## 10.2 内置 Codec

Lettuce 自带几种 Codec：

| Codec | Key 类型 | Value 类型 | 存储格式 |
|-------|---------|-----------|---------|
| `StringCodec` | `String` | `String` | UTF-8 字符串 |
| `ByteArrayCodec` | `byte[]` | `byte[]` | 原始字节 |
| `ByteBufferCodec` | `ByteBuffer` | `ByteBuffer` | 原始字节 |
| `JacksonCodec<T>` | `String` | `T` | JSON |
| `CompressionCodec` | 委托给内部 Codec | 委托给内部 Codec | 压缩后字节 |

```java
// StringCodec —— 最常用，也是默认
RedisClient client = RedisClient.create("redis://localhost:6379");
StatefulRedisConnection<String, String> conn = client.connect();
conn.sync().set("name", "Alice");

// ByteArrayCodec —— 存二进制数据（图片 hash、压缩数据）
StatefulRedisConnection<byte[], byte[]> binConn = client.connect(
    ByteArrayCodec.INSTANCE);
binConn.sync().set("hash".getBytes(), digest);

// JacksonCodec —— 对象自动序列化为 JSON
StatefulRedisConnection<String, User> userConn = client.connect(
    new JacksonCodec<>(User.class));
userConn.sync().set("user:1", new User("Alice", 30));
// Redis 中存储：{"name":"Alice","age":30}
```

## 10.3 自定义 Codec

当内置 Codec 不满足需求时（比如 Protobuf、Avro、自定义压缩），可以自己实现 `RedisCodec<K, V>`：

<div class="demo">
  <CodecDemo />
</div>

实现 `RedisCodec` 接口：

```java
public class ProtobufCodec<K, V> implements RedisCodec<K, V> {

    private final RedisCodec<K, V> delegate;
    private final Codec<K> keyCodec;
    private final Codec<V> valueCodec;

    public ProtobufCodec(Codec<K> keyCodec, Codec<V> valueCodec) {
        this.delegate = StringCodec.UTF8;
        this.keyCodec = keyCodec;
        this.valueCodec = valueCodec;
    }

    @Override
    public K decodeKey(ByteBuffer bytes) {
        return keyCodec.decode(parseFrom(bytes));
    }

    @Override
    public V decodeValue(ByteBuffer bytes) {
        return valueCodec.decode(parseFrom(bytes));
    }

    @Override
    public ByteBuffer encodeKey(K key) {
        byte[] serialized = keyCodec.encode(key);
        return ByteBuffer.wrap(serialized);
    }

    @Override
    public ByteBuffer encodeValue(V value) {
        byte[] serialized = valueCodec.encode(value);
        return ByteBuffer.wrap(serialized);
    }
}
```

使用自定义 Codec 时注意：

- Codec 实例应该是**无状态且线程安全**的（Lettuce 会跨命令共享）
- `ByteBuffer` 是 Lettuce 传递的字节容器，注意 `position` / `limit` 语义
- Codec 影响所有通过该连接的命令——key 和 value 都会被编解码

## 10.4 Lua 脚本基础

Redis 支持服务端执行 Lua 脚本（`EVAL`），保证脚本内多条命令的原子性。Lettuce 通过 `RedisScript` 接口封装：

<div class="demo">
  <ScriptsDemo />
</div>

基本用法：

```java
RedisCommands<String, String> sync = conn.sync();

// 直接执行
String result = sync.eval(
    "return redis.call('GET', KEYS[1])",
    ScriptOutputType.VALUE,
    Collections.singletonList("mykey")
);

// 带参数
String result = sync.eval(
    "if redis.call('GET', KEYS[1]) == ARGV[1] then " +
    "  return redis.call('SET', KEYS[1], ARGV[2]) " +
    "else " +
    "  return nil " +
    "end",
    ScriptOutputType.STATUS,
    Collections.singletonList("lock"),
    "expected-value",
    "new-value"
);
```

`ScriptOutputType` 决定返回值类型：

| 类型 | 返回 | 适用场景 |
|------|------|---------|
| `VALUE` | `String` | 返回单个值 |
| `BOOLEAN` | `Boolean` | 存在性检查 |
| `INTEGER` | `Long` | 计数器 |
| `STATUS` | `String` | SET/DEL 等状态 |
| `MULTI` | `List<K,V>` | 多值返回 |
| `RAW` | 原始 RESP | 不解码 |

脚本 SHA 缓存——避免每次传输脚本文本：

```java
// 第一次执行会缓存脚本的 SHA1
String sha = sync.scriptLoad(
    "return redis.call('GET', KEYS[1])");

// 后续用 SHA 执行（不传脚本文本，减少网络传输）
String result = sync.evalsha(sha, ScriptOutputType.VALUE,
    Collections.singletonList("mykey"));
```

Lettuce 的 `RedisScript` 抽象封装了这个过程——自动计算 SHA、缓存、重试。

## 10.5 事件钩子（connected / disconnected）

Lettuce 提供 `RedisClient` 级别的连接状态监听：

```java
RedisClient client = RedisClient.create("redis://localhost:6379");

client.addListener(new RedisClientStateListener() {
    @Override
    public void onRedisConnected(RedisEndpoint endpoint) {
        System.out.println("Connected to " + endpoint);
    }

    @Override
    public void onRedisDisconnected(RedisEndpoint endpoint) {
        System.out.println("Disconnected from " + endpoint);
    }
});
```

在 Codec + Scripts 场景中，事件钩子的典型用法：

- **断连后重新注册 Lua 脚本 SHA**：连接重建后脚本缓存丢失，需要在 `onRedisConnected` 中重新 `scriptLoad`
- **Codec 依赖外部资源时的初始化**：自定义 Codec 需要 Protobuf Schema 等，在连接建立后初始化
- **监控与告警**：记录断连频率，超过阈值告警

```java
// 实战：断连后重载脚本
private volatile Map<String, String> scriptShas = new HashMap<>();

client.addListener(new RedisClientStateListener() {
    @Override
    public void onRedisConnected(RedisEndpoint endpoint) {
        StatefulRedisConnection<String, String> conn = client.connect();
        // 重载所有 Lua 脚本
        for (Map.Entry<String, String> entry : scripts.entrySet()) {
            String name = entry.getKey();
            String script = entry.getValue();
            String sha = conn.sync().scriptLoad(script);
            scriptShas.put(name, sha);
        }
    }
});
```

## 小结

- Codec 负责 Java 对象 ↔ RESP 字节的双向转换，内置 String / ByteArray / Jackson
- 自定义 Codec 实现 `RedisCodec<K, V>` 接口，注意线程安全和 ByteBuffer 语义
- Lua 脚本通过 `eval` / `evalsha` 执行，Lettuce 自动缓存 SHA
- 连接状态监听器（`RedisClientStateListener`）适合做脚本重载、资源初始化、监控
- Codec + Scripts 组合可以构建高效的自定义协议层
