import { Component, type ReactNode } from 'react'

interface State {
  hasError: boolean
}

/** Catches render errors and shows a recovery screen instead of a blank app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  handleReload = () => {
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
    }
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="app-frame items-center justify-center px-8 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Something went wrong</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            Please reopen the app. If it keeps happening, reinstall the latest version.
          </p>
          <button onClick={this.handleReload} className="btn-primary mt-6 h-12 px-8">
            Reload
          </button>
        </div>
      </div>
    )
  }
}
