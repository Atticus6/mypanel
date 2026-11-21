import { defineConfig } from 'vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
  server: {
    // 开发期把 /rpc 代理到 master，让浏览器始终停留在单一源上，
    // 从而避免 CORS。master 的同一个 handler 同时支持
    // Connect、gRPC 与 gRPC-Web 三种协议。
    proxy: {
      '/rpc': {
        target: 'http://127.0.0.1:8080',
        // 保持 Host 不变，便于后端按原始来源判断。
        changeOrigin: false,
      },
    },
  },
})

export default config
