// esbuild service 子进程在 vitepress build 完成后不会自动退出，
// 导致 Vercel 等 CI 环境无法判定 build 结束（45 分钟超时）。
// 用编程式 API 调 build，跑完显式 process.exit(0) 强制收尾。
import { build } from 'vitepress'

await build()
process.exit(0)
