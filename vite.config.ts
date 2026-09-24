import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const BUILD_ID = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()

// package.json is the single source of the version number. The web app reads it
// from here and the Android build derives versionName from it in CI, so a
// support conversation can always pin down a build.
const APP_VERSION = createRequire(import.meta.url)('./package.json').version as string

// https://vitejs.dev/config/
// No PWA: this ships as a plain web app (browser) and a native mobile app
// (Capacitor). That keeps the two targets clean and avoids service-worker
// caching issues.
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [react()],
})
