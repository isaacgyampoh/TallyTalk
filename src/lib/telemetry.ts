import { supabase } from './supabase'
import { APP_VERSION, BUILD_ID } from './config'
import { platform } from './platform'

/**
 * Where a crash goes.
 *
 * The error boundary used to show a recovery screen and tell nobody, so the
 * first report of any bug was a user giving up. This sends it to our own
 * database (`client_errors`, migration 0006) rather than to a third-party
 * service: no extra processor to disclose, and no reporting SDK to download
 * over a mobile connection.
 *
 * Three rules, in order of importance:
 *
 *  1. It never makes things worse. Every path is wrapped; a failure to report
 *     is swallowed, and reporting is attempted after the recovery screen is
 *     already on-screen, never before.
 *  2. It never carries content. A message or a stack can quote a value, so both
 *     are scrubbed of anything that looks like a phone number, an email or a
 *     token before they leave the device. The route is the in-app path with
 *     ids stripped, so one person's crash cannot name another person's task.
 *  3. It says which build. A report without a build id cannot be acted on.
 */

export interface CrashReport {
  kind: 'render' | 'uncaught' | 'rejection' | 'edge'
  message: string
  stack?: string
  route?: string
}

const QUEUE_KEY = 'tt.crash-queue'
const QUEUE_MAX = 10
const MESSAGE_MAX = 500
const STACK_MAX = 4000

/** Anything that could identify a person or open an account. */
export function scrub(text: string): string {
  return (
    text
      // Ids first: a uuid is mostly digits and hyphens, so the phone pattern
      // below would eat half of one and leave the rest.
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
      .replace(/\b(ey[A-Za-z0-9_-]{10,})\b/g, '[token]')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
      .replace(/\+?\d[\d\s()-]{7,}\d/g, '[number]')
  )
}

/**
 * The shape of the screen, not the screen itself: `/contacts/<uuid>/t/<uuid>`
 * becomes `/contacts/:id/t/:id`. A crash tells us which screen broke; it does
 * not need to name whose data was on it.
 */
export function routeShape(path: string): string {
  return path
    .split('?')[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .slice(0, 200)
}

function row(report: CrashReport) {
  return {
    build_id: BUILD_ID,
    app_version: APP_VERSION,
    platform: platform === 'ios' || platform === 'android' ? platform : 'web',
    route: routeShape(report.route ?? (typeof location === 'undefined' ? '' : location.pathname)),
    kind: report.kind,
    message: scrub(report.message || 'Unknown error').slice(0, MESSAGE_MAX),
    stack: report.stack ? scrub(report.stack).slice(0, STACK_MAX) : null,
  }
}

type Row = ReturnType<typeof row>

function readQueue(): Row[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as Row[]) : []
  } catch {
    return []
  }
}

function writeQueue(rows: Row[]): void {
  try {
    // Keep the oldest: the first crash of a session usually explains the rest.
    localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(0, QUEUE_MAX)))
  } catch {
    /* storage full or blocked; a lost report is better than a second crash */
  }
}

async function send(rows: Row[]): Promise<boolean> {
  if (!supabase || rows.length === 0) return false
  try {
    const me = (await supabase.auth.getSession()).data.session?.user?.id ?? null
    const { error } = await supabase
      .from('client_errors')
      .insert(rows.map((r) => ({ ...r, user_id: me })))
    return !error
  } catch {
    return false
  }
}

/**
 * Report a crash. Resolves either way — a caller must never have to handle a
 * failure to report.
 */
export async function reportCrash(report: CrashReport): Promise<void> {
  const r = row(report)
  if (!(await send([r]))) {
    // Offline, or no backend configured: keep it for the next run. A crash
    // that only happens without a connection is exactly the kind worth having.
    writeQueue([...readQueue(), r])
  }
}

/**
 * An edge function that failed while the user was waiting for it. Reported
 * separately from a crash: the app did not break, but something they asked for
 * did not happen, and nobody would otherwise know.
 */
export async function reportEdgeFailure(fn: string, detail: string): Promise<void> {
  await reportCrash({ kind: 'edge', message: `${fn}: ${detail}` })
}

/** Send anything that was kept from an earlier run. Called once on startup. */
export async function flushCrashQueue(): Promise<void> {
  const queued = readQueue()
  if (queued.length === 0) return
  if (await send(queued)) {
    try {
      localStorage.removeItem(QUEUE_KEY)
    } catch {
      /* nothing to do */
    }
  }
}

let installed = false

/**
 * Catch what React cannot: an error thrown outside rendering, and a rejected
 * promise nobody handled. Both are reported once; neither is swallowed, so the
 * console still shows them in development.
 */
export function installCrashHandlers(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (e) => {
    void reportCrash({
      kind: 'uncaught',
      message: e.message || String(e.error),
      stack: e.error instanceof Error ? e.error.stack : undefined,
    })
  })

  window.addEventListener('unhandledrejection', (e) => {
    const reason: unknown = e.reason
    void reportCrash({
      kind: 'rejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })

  void flushCrashQueue()
}
