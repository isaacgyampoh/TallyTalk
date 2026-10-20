import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { installCrashHandlers } from '@/lib/telemetry'

// Before anything renders: an error thrown outside React, or a rejected promise
// nobody handled, is otherwise lost. This also sends any report a previous run
// could not get out.
installCrashHandlers()

// The only worker this app wants is /sw.js, which receives Web Push and
// caches nothing. Anything else is left over from the old PWA and is what used
// to serve stale builds, so it is removed on sight — as are the caches, which
// our worker never writes to.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) =>
      regs.forEach((r) => {
        const script = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? ''
        if (!script.endsWith('/sw.js')) void r.unregister()
      }),
    )
    .catch(() => {})
}
if ('caches' in window) {
  caches
    .keys()
    .then((keys) => keys.forEach((k) => caches.delete(k)))
    .catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
