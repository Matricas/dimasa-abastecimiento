import { defineConfig } from 'vitest/config'

// Config separada de vite.config.js para que los tests no carguen el plugin de SRI ni React.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    // src/lib/supabase.js exige estas variables al importarse; en tests no se conecta a nada
    env: { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 120000,
  },
})
