import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on LAN so you can open it on your phone (npm run dev -- --host)
  },
})
