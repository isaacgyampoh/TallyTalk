import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Unit tests: pure logic (parsing, mapping, time) plus the data layer against a
// mock Supabase client. jsdom, because several modules read browser APIs at
// import time; src/test-setup.ts fills the gaps jsdom leaves.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  define: {
    __BUILD_ID__: JSON.stringify('test'),
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
