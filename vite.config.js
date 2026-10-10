import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import sri from '@small-tech/vite-plugin-sri'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sri()],
})
