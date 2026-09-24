import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Unit tests only — these cover pure logic (parsing, mapping, time), so no
// browser environment is needed. Add `environment: 'jsdom'` when component
// tests arrive.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  define: {
    __BUILD_ID__: JSON.stringify('test'),
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
