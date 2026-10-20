import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock, type MockClient } from '@/data/supabaseMock'

const ME = 'me-uuid'
let client: MockClient | null
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return client
  },
  isSupabaseConfigured: true,
}))
vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BKxQ-test-public-key')

const {
  arrayBufferToBase64Url,
  disablePush,
  enablePush,
  pushState,
  pushSupported,
  syncSubscription,
  urlBase64ToUint8Array,
} = await import('./webpush')

/** A PushSubscription as a browser hands it over. */
function fakeSubscription(endpoint = 'https://push.example.test/sub/1') {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p256dh-value', auth: 'auth-value' } }),
    getKey: () => null,
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription
}

function installServiceWorker(sub: PushSubscription | null) {
  const registration = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(sub),
      subscribe: vi.fn().mockResolvedValue(fakeSubscription()),
    },
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    },
  })
  Object.defineProperty(window, 'PushManager', { configurable: true, value: function () {} })
  return registration
}

function setPermission(value: NotificationPermission) {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { permission: value, requestPermission: vi.fn().mockResolvedValue(value) },
  })
}

beforeEach(() => {
  client = makeSupabaseMock({ results: { push_subscriptions: { error: null } } })
  setPermission('granted')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('key encoding', () => {
  it('decodes a base64url VAPID key, padding included', () => {
    // "hi" is "aGk=" in base64; base64url drops the padding.
    expect(Array.from(urlBase64ToUint8Array('aGk'))).toEqual([104, 105])
  })

  it('round-trips bytes the browser hands back', () => {
    const bytes = new Uint8Array([251, 239, 190, 1, 2, 3])
    expect(arrayBufferToBase64Url(bytes.buffer)).toBe('----AQID')
    expect(Array.from(urlBase64ToUint8Array('----AQID'))).toEqual([...bytes])
  })

  it('treats a missing key as empty rather than crashing the subscribe', () => {
    expect(arrayBufferToBase64Url(null)).toBe('')
  })
})

describe('pushState', () => {
  it('reports a browser with no Push API as unsupported — an Android WebView, say', async () => {
    // @ts-expect-error removing the API is the point
    delete window.PushManager
    expect(pushSupported()).toBe(false)
    expect(await pushState()).toBe('unsupported')
  })

  it('reports a refusal as denied, since only the person can undo it', async () => {
    installServiceWorker(null)
    setPermission('denied')
    expect(await pushState()).toBe('denied')
  })

  it('is off when nothing is subscribed', async () => {
    installServiceWorker(null)
    expect(await pushState()).toBe('off')
  })

  it('is on when the browser holds a subscription', async () => {
    installServiceWorker(fakeSubscription())
    expect(await pushState()).toBe('on')
  })
})

describe('enablePush', () => {
  it('subscribes and records it against the signed-in account', async () => {
    const reg = installServiceWorker(null)
    expect(await enablePush()).toBe('on')
    expect(reg.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    )
    const row = client!.argFor('push_subscriptions', 'upsert') as Record<string, unknown>
    expect(row).toMatchObject({
      user_id: ME,
      endpoint: 'https://push.example.test/sub/1',
      p256dh: 'p256dh-value',
      auth: 'auth-value',
    })
  })

  it('upserts on the endpoint, so re-subscribing does not pile up rows', async () => {
    installServiceWorker(null)
    await enablePush()
    expect(client!.calls.push_subscriptions.find((c) => c.method === 'upsert')?.args[1]).toEqual({
      onConflict: 'endpoint',
    })
  })

  it('does not subscribe when permission is refused', async () => {
    const reg = installServiceWorker(null)
    setPermission('denied')
    expect(await enablePush()).toBe('denied')
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled()
    expect(client!.calls.push_subscriptions).toBeUndefined()
  })

  it('reuses a subscription the browser already has', async () => {
    const reg = installServiceWorker(fakeSubscription('https://push.example.test/existing'))
    await enablePush()
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled()
    expect(client!.argFor('push_subscriptions', 'upsert')).toMatchObject({
      endpoint: 'https://push.example.test/existing',
    })
  })

  it('never claims success when there is no session to attach it to', async () => {
    installServiceWorker(null)
    client = makeSupabaseMock({ userId: null })
    expect(await enablePush()).toBe('off')
  })
})

describe('disablePush', () => {
  it('removes the subscription from the server and from the browser', async () => {
    const sub = fakeSubscription()
    installServiceWorker(sub)
    expect(await disablePush()).toBe('off')
    expect(client!.calls.push_subscriptions.find((c) => c.method === 'delete')).toBeDefined()
    expect(client!.calls.push_subscriptions.find((c) => c.method === 'eq')?.args).toEqual([
      'endpoint',
      'https://push.example.test/sub/1',
    ])
    expect(sub.unsubscribe).toHaveBeenCalled()
  })

  it('is harmless when there is nothing subscribed', async () => {
    installServiceWorker(null)
    expect(await disablePush()).toBe('off')
    expect(client!.calls.push_subscriptions).toBeUndefined()
  })
})

describe('syncSubscription', () => {
  it('re-records a subscription the browser may have rotated', async () => {
    installServiceWorker(fakeSubscription('https://push.example.test/rotated'))
    await syncSubscription()
    expect(client!.argFor('push_subscriptions', 'upsert')).toMatchObject({
      endpoint: 'https://push.example.test/rotated',
    })
  })

  it('does nothing when the browser has none', async () => {
    installServiceWorker(null)
    await syncSubscription()
    expect(client!.calls.push_subscriptions).toBeUndefined()
  })
})
