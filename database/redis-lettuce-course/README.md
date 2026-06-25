# Interactive Tutorials

给程序员的交互式技术课程。每个概念配可视化演示器，把"看不见的东西"（时序、并发、空间分布、数据流）显式化。

## 已上线课程

### Redis Lettuce 交互式可视化课程

面向 Java 程序员的 Redis Lettuce 心智模型课程。从 Jedis 范式迁移到 Lettuce：三套 API、自动 pipelining、连接管理、Reactor 集成、Cluster 路由、客户端缓存。

**10 章 + 12 个交互演示器**：

| Part | 章节 | 演示器 |
|------|------|--------|
| I 入门 | Ch1 Lettuce 简介 | JedisPoolDemo / LettuceSharedConnectionDemo / ThreeApiTimelineDemo / SyncPlayground |
| I 入门 | Ch2 三套 API 深度 | ThreeApiTimelineDemo |
| II 中级 | Ch3 自动 Pipeline | PipelineTimelineDemo |
| II 中级 | Ch4 连接管理 | LettuceSharedConnectionDemo |
| II 中级 | Ch5 异步深度 | AsyncDeepDemo |
| II 中级 | Ch6 Reactive 深度 | BackpressureDemo |
| III 高级 | Ch7 Cluster | ClusterRoutingDemo |
| III 高级 | Ch8 Pub/Sub | PubSubDemo |
| III 高级 | Ch9 客户端缓存 | ClientCacheDemo |
| III 高级 | Ch10 Codec/Scripts | CodecDemo / ScriptsDemo |

## 在 Codespaces 中运行（推荐）

仓库已配置 `.devcontainer/devcontainer.json`，开箱即用：

1. 在 GitHub repo 页面点 **Code → Codespaces → Create codespace on main**
2. 容器构建完成后自动执行 `npm install`
3. 自动启动 dev server，端口 5173 自动转发并在预览中打开
4. 如果预览没自动打开，点底部面板的 **Ports** 标签 → 5173 → 跟随链接

不需要本地装 Node，浏览器里就能改代码、看效果。

## 本地开发

需要 Node 20+。

```bash
npm install
npm run dev      # http://localhost:5173
```

## 测试

```bash
npm test         # vitest run
npm test:watch   # watch mode
```

## 构建

```bash
npm run build    # → .vitepress/dist/
npm run preview  # 本地预览构建产物
```

## 部署

`.github/workflows/deploy.yml` 配置了 GitHub Actions 自动部署到 GitHub Pages（push 到 main 触发）。

如果想换 base path（比如 repo 不在用户根），编辑 `.vitepress/config.ts` 加 `base: '/your-repo-name/'`。

## 技术栈

- VitePress + Vue 3 + TypeScript
- Vitest + @vue/test-utils
- 纯前端 Mock Redis / Mock Lettuce（无后端依赖）

## 项目结构

```
course/database/redis-lettuce-course/    # 课程项目（按领域分在 database/ 下）
├── index.md                    # 课程总览（catalog）
├── redis-lettuce/              # 各章节 markdown
├── components/
│   ├── base/                   # 基础可视化组件（Timeline / SlotMap / ...）
│   └── demos/                  # 各章节的 demo 组件
├── mock/                       # 纯 TS 的 Mock 层
├── tests/                      # vitest 测试
├── .vitepress/                 # VitePress 配置 + 主题
└── .github/workflows/          # CI/CD
```

## 添加新课程

参考 Redis Lettuce 课程的结构（位于 `course/database/redis-lettuce-course/`）。在父 repo 的 `course/<领域>/` 下加新项目目录，例如：
- `course/database/redis-lettuce-course/`（本课程）
- `course/messaging/kafka-course/`（未来）
- `course/search/elasticsearch-course/`（未来）

1. 在新项目下加章节 markdown（建议放 `<course-name>/` 子目录）
2. 在 `components/demos/` 加配套交互演示器
3. 在 `.vitepress/config.ts` 的 `sidebar` 添加章节链接
4. 在 `.vitepress/theme/components/CourseCatalog.vue` 把新课程标为已上线

## 路线图

- [x] Redis Lettuce（10 章）
- [ ] Apache Kafka（规划中）
- [ ] Elasticsearch（规划中）
- [ ] gRPC + Protobuf（规划中）
