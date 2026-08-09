import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { isNative } from '@/lib/platform'

// Service worker policy:
// - Native app: NEVER register one. A stale worker can serve an old cached shell
//   and white-screen the app after an update. Also clean up any previously
//   registered worker + caches so past installs recover.
// - Web/PWA: register in production for offline + installability.
if (isNative) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {})
  }
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => keys.forEach((k) => caches.delete(k)))
      .catch(() => {})
  }
} else if (import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
