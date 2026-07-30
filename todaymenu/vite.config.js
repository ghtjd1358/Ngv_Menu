import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // React를 별도 청크로 분리 → React 스케줄러가 앱 코드보다 먼저 초기화 보장
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "https://menu-worker.hojjang18.workers.dev/",
        changeOrigin: true,
      },
    },
  },
})
