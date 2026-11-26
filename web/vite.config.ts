import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // 注意：不要用 6665-6669（Chrome 禁用端口，会报 ERR_UNSAFE_PORT）
    port: 7777,
    // 端口被占用时直接失败，避免 Vite 静默换端口导致访问地址与预期不符
    strictPort: true,
    proxy: {
      // 开发时把 API 请求代理到本地后端，规避 CORS
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
