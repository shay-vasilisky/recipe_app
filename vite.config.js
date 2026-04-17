import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
