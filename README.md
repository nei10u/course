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
3. 自动启动 dev server，端口 5173 自动转发并在预览中打开
4. 如果预览没自动打开，点底部面板的 **Ports** 标签 → 5173 → 跟随链接

## 本地开发

需要 Node 20+。仓库根是统一的 VitePress 站点 + npm workspaces。

```bash
# 安装所有依赖（root + 各课程子项目）
npm install

# 启动 dev server（在仓库根目录跑）
npm run dev

# 全部课程跑测试
npm run test

# 全部课程 typecheck
npm run typecheck

# 构建静态站点
npm run build
```

## 目录结构

```
course/                          # npm workspaces 根 + VitePress 站点根
├── package.json                 # workspaces + 站点级 scripts
├── index.md                     # 全局课程目录首页
├── .vitepress/                  # 统一的 VitePress 配置 / 主题
│   ├── config.ts                #   sidebar + rewrites（URL 短路径）
│   └── theme/                   #   CourseCatalog 等全局组件
├── .devcontainer/               # Codespaces 配置
└── <领域>/                       # 一个目录 = 一个分类
    └── <课程名>-course/          # 具体课程项目
        ├── package.json         #   课程级（仅含 mock/tests devDeps）
        ├── components/          #   课程专用 Vue 组件
        ├── mock/                #   纯 TS Mock 层
        ├── tests/               #   vitest 测试
        └── <课程名>/             #   章节 markdown
            ├── ch1-xxx.md
            └── ...
```

当前结构：

```
course/
├── index.md                     # 全局首页
├── .vitepress/config.ts         # rewrites: database/redis-lettuce-course/redis-lettuce/* → /redis-lettuce/*
└── database/
    └── redis-lettuce-course/
        ├── redis-lettuce/       # 章节 markdown
        ├── components/
        ├── mock/
        └── tests/
```

URL 经过 `rewrites` 处理后是干净的：
- 文件：`/database/redis-lettuce-course/redis-lettuce/ch1-intro.md`
- URL：`/redis-lettuce/ch1-intro`

## 添加新课程

1. 在匹配 workspaces 通配符的目录下建新项目（如 `messaging/kafka-course/`）
2. 在新目录下加：`package.json`（test 脚本）、`components/`、`mock/`、`tests/`、`messaging/kafka/`（章节）
3. 在根 `.vitepress/config.ts` 加 sidebar 条目 + rewrites 规则
4. 在 `.vitepress/theme/components/CourseCatalog.vue` 把新课程标为已上线
5. 跑 `npm install`（自动识别新 workspace）+ `npm run dev`

## 技术栈

站点根 + 各课程统一：
- VitePress + Vue 3 + TypeScript
- Vitest + @vue/test-utils
- 纯前端 Mock（无后端依赖）
