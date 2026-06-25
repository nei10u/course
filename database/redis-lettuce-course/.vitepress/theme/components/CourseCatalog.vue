<!-- .vitepress/theme/components/CourseCatalog.vue -->
<script setup lang="ts">
import { useRouter } from 'vitepress'

const router = useRouter()

interface Course {
  id: string
  title: string
  subtitle: string
  description: string
  status: 'published' | 'coming-soon' | 'planned'
  link?: string
  chapterCount?: number
  tags: string[]
  accent: string
  icon: string
}

const courses: Course[] = [
  {
    id: 'redis-lettuce',
    title: 'Redis Lettuce',
    subtitle: '交互式可视化课程',
    description: '从 Jedis 心智模型迁移到 Lettuce：三套 API、自动 pipelining、共享 event loop、Cluster 路由、客户端缓存。10 章 + 12 个可交互演示器。',
    status: 'published',
    link: '/redis-lettuce/ch1-intro',
    chapterCount: 10,
    tags: ['Redis', 'Lettuce', 'Netty', 'Reactor'],
    accent: '#d97706',
    icon: '🟥'
  },
  {
    id: 'kafka',
    title: 'Apache Kafka',
    subtitle: 'Coming Soon',
    description: 'Producer / Consumer / Broker 的协奏曲。ISR、副本同步、消费组再均衡，全部可视化。',
    status: 'coming-soon',
    tags: ['Kafka', '分布式', '消息队列'],
    accent: '#6366f1',
    icon: '📨'
  },
  {
    id: 'elasticsearch',
    title: 'Elasticsearch',
    subtitle: 'Planned',
    description: '倒排索引、分片、副本、相关性评分——搜索引擎的内部世界。',
    status: 'planned',
    tags: ['ES', '搜索', 'Lucene'],
    accent: '#10b981',
    icon: '🔍'
  },
  {
    id: 'grpc',
    title: 'gRPC + Protobuf',
    subtitle: 'Planned',
    description: 'HTTP/2 帧、流式调用、拦截器、负载均衡——一节课讲透 RPC。',
    status: 'planned',
    tags: ['gRPC', 'Protobuf', 'HTTP/2'],
    accent: '#3b82f6',
    icon: '🔌'
  }
]

function goTo(link?: string) {
  if (link) router.go(link)
}

const statusLabel: Record<Course['status'], string> = {
  'published': '已上线',
  'coming-soon': '即将上线',
  'planned': '规划中'
}
</script>

<template>
  <div class="catalog">
    <div
      v-for="course in courses"
      :key="course.id"
      class="card"
      :class="['status-' + course.status, { clickable: course.link }]"
      @click="goTo(course.link)"
    >
      <div class="card-header" :style="{ background: `linear-gradient(135deg, ${course.accent}22, ${course.accent}11)`, borderLeft: `4px solid ${course.accent}` }">
        <div class="card-icon">{{ course.icon }}</div>
        <div class="card-titles">
          <div class="card-title">{{ course.title }}</div>
          <div class="card-subtitle">{{ course.subtitle }}</div>
        </div>
        <div class="card-status" :class="'badge-' + course.status">
          {{ statusLabel[course.status] }}
        </div>
      </div>
      <div class="card-body">
        <p class="card-desc">{{ course.description }}</p>
        <div class="card-tags">
          <span v-for="tag in course.tags" :key="tag" class="tag">{{ tag }}</span>
          <span v-if="course.chapterCount" class="tag tag-meta">{{ course.chapterCount }} 章</span>
        </div>
        <div v-if="course.link" class="card-action">
          进入课程 →
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.card {
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
  transition: transform 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
}
.card.clickable {
  cursor: pointer;
}
.card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border-color: var(--vp-c-brand-1);
}
.card.status-published {
  border-color: var(--vp-c-brand-1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.card-icon {
  font-size: 28px;
}
.card-titles {
  flex: 1;
}
.card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.card-subtitle {
  font-size: 12px;
  color: var(--vp-c-text-2);
  margin-top: 2px;
}
.card-status {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
  font-weight: 600;
  white-space: nowrap;
}
.badge-published {
  background: var(--vp-c-brand-1);
  color: white;
}
.badge-coming-soon {
  background: #fef3c7;
  color: #78350f;
}
.badge-planned {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  border: 1px solid var(--vp-c-border);
}

.card-body {
  padding: 14px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-desc {
  font-size: 13px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
  margin: 0 0 12px;
  flex: 1;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border);
  font-family: monospace;
}
.tag-meta {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-color: transparent;
}
.card-action {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-align: right;
}
</style>
