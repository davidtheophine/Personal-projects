import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS is required to test the real gyroscope on a phone (iOS motion events
// only fire in a secure context). Enable it with:  HTTPS=true npm run dev -- --host
// Default dev stays on plain http so localhost verification is friction-free.
const useHttps = process.env.HTTPS === 'true'

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    host: true, // expose on LAN for phone testing (npm run dev -- --host)
  },
})
