import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Spotify now BANS http://localhost redirect URIs — must bind to the loopback
// literal 127.0.0.1 so window.location.origin matches the registered redirect URI.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  test: { environment: 'node' },
})
