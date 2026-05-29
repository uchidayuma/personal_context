import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,  // Docker内で全インターフェースにバインド (0.0.0.0)
    proxy: {
      // Docker内ではサービス名で通信する。ローカル直実行時は localhost にフォールバック
      '/api': process.env.VITE_API_URL ?? 'http://server:3001',
    },
  },
})
