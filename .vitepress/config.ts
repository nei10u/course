// .vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Interactive Tutorials',
  description: '给程序员的交互式技术课程',
  lang: 'zh-CN',
  // 把子项目里的 markdown 路径重写为干净的 URL
  // database/redis-lettuce-course/redis-lettuce/ch1-intro.md → /redis-lettuce/ch1-intro
  // 注意：目标路径不能带前导 /，VitePress 内部会自动补
  rewrites: {
    'database/redis-lettuce-course/redis-lettuce/:path': 'redis-lettuce/:path'
  },
  themeConfig: {
    siteTitle: 'Interactive Tutorials',
    sidebar: [
      {
        text: 'Part I 入门',
        items: [
          { text: 'Ch1 Lettuce 简介', link: '/redis-lettuce/ch1-intro' },
          { text: 'Ch2 三套 API 深度', link: '/redis-lettuce/ch2-three-apis' }
        ]
      },
      {
        text: 'Part II 中级',
        items: [
          { text: 'Ch3 自动 Pipeline', link: '/redis-lettuce/ch3-pipeline' },
          { text: 'Ch4 连接管理', link: '/redis-lettuce/ch4-connections' },
          { text: 'Ch5 异步深度', link: '/redis-lettuce/ch5-async' },
          { text: 'Ch6 Reactive 深度', link: '/redis-lettuce/ch6-reactive' }
        ]
      },
      {
        text: 'Part III 高级',
        items: [
          { text: 'Ch7 Cluster', link: '/redis-lettuce/ch7-cluster' },
          { text: 'Ch8 Pub/Sub', link: '/redis-lettuce/ch8-pubsub' },
          { text: 'Ch9 客户端缓存', link: '/redis-lettuce/ch9-client-cache' },
          { text: 'Ch10 Codec 与 Scripts', link: '/redis-lettuce/ch10-codec-scripts' }
        ]
      }
    ],
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一节', next: '下一节' },
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: { noResultsText: '无结果' }
        }
      }
    }
  }
})
