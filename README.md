# Interactive Tutorials

给程序员的交互式技术课程。每个概念配可视化演示器，把"看不见的东西"（时序、并发、空间分布、数据流）显式化。

## 课程目录

按领域分组（npm workspaces 管理）：

| 领域 | 课程 | 状态 |
|------|------|------|
| **database/** | [Redis Lettuce 交互式可视化课程](./database/redis-lettuce-course/) | ✅ 已上线（10 章 + 12 个交互演示器） |
| messaging/ | Apache Kafka | 规划中 |
| search/ | Elasticsearch | 规划中 |
| rpc/ | gRPC + Protobuf | 规划中 |

## 在 Codespaces 中运行（推荐）

仓库已配置 `.devcontainer/devcontainer.json`，开箱即用：

1. 在 GitHub repo 页面点 **Code → Codespaces → Create codespace on main**
2. 容器构建完成后自动执行 `npm install`（在仓库根目录）
3. 自动启动默认课程（Redis Lettuce）的 dev server，端口 5173 自动转发
4. 如果预览没自动打开，点底部面板的 **Ports** 标签 → 5173 → 跟随链接

## 本地开发

需要 Node 20+。仓库根用 npm workspaces 管理所有课程项目。

```bash
# 一次性安装所有课程的依赖
npm install

# 启动默认课程（Redis Lettuce）
npm run dev

# 启动特定课程
npm run dev --workspace database/redis-lettuce-course

# 构建 / 测试 / 类型检查所有课程
npm run build
npm run test
npm run typecheck
```

## 目录结构

```
course/                          # npm workspaces 根
├── package.json                 # 根 package.json（声明 workspaces）
├── .devcontainer/               # Codespaces 配置
└── <领域>/                       # 一个目录 = 一个分类
    └── <课程名>-course/          # 具体课程项目
        ├── package.json
        ├── index.md
        ├── <课程名>/             # 章节 markdown
        ├── components/
        ├── mock/
        └── ...
```

当前结构：

```
course/
├── package.json
├── database/
│   └── redis-lettuce-course/
└── (未来) messaging/, search/, rpc/ ...
```

## 添加新课程

1. 按领域在 `<领域>/` 下建新目录（如 `messaging/kafka-course/`）
2. 在新目录下初始化 VitePress + Vue 3 + TypeScript 项目
3. 根 `package.json` 的 `workspaces` 已用通配符（如 `"messaging/*"`），无需手动注册
4. 跑 `npm install` 自动识别新课程
5. 在该课程的 `.vitepress/theme/components/CourseCatalog.vue` 把新课程标为已上线

## 技术栈

每个课程项目独立完整：
- VitePress + Vue 3 + TypeScript
- Vitest + @vue/test-utils
- 纯前端 Mock（无后端依赖）

仓库根用 npm workspaces 协调多课程，共享 Node 版本和工具链。
