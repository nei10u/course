import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue() as any],
  resolve: {
    alias: {
      '@mock': resolve(__dirname, 'mock'),
      '@components': resolve(__dirname, 'components')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
