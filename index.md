---
layout: home

hero:
  name: "Interactive Tutorials"
  text: "给程序员的交互式技术课程"
  tagline: 每个概念都配可视化演示器，看见"看不见的东西"——时序、并发、空间分布、数据流。

features:
  - title: 可视化时序
    details: 命令的发出 / 回调 / 完成都在时间线上一目了然
  - title: 可控时钟
    details: 1x / 0.5x / 0.1x 倍速播放，单步推进——节奏由你决定
  - title: 纯前端运行
    details: 浏览器内 Mock，无后端依赖，静态部署
  - title: 面向 Java 程序员
    details: 假设你懂 Java + Redis 命令，重点讲底层心智模型
---

<script setup>
import CourseCatalog from './.vitepress/theme/components/CourseCatalog.vue'
</script>

<div class="catalog-section">
  <h2>课程目录</h2>
  <CourseCatalog />
</div>

<style>
.catalog-section {
  max-width: 1152px;
  margin: 4rem auto 0;
  padding: 0 24px;
}
.catalog-section h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 2rem;
}
</style>
