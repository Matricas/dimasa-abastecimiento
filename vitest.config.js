import { defineConfig } from 'vitest/config'

// Config separada de vite.config.js para que los tests no carguen el plugin de SRI ni React.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 120000,
  },
})
