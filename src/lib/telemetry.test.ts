import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
let configured = true

vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return configured
      ? {
          auth: { getSession: async () => ({ data: { session: { user: { id: 'me-uuid' } } } }) },
          from: () => ({ insert }),
        }
      : null
  },
}))
vi.mock('@/lib/config', () => ({ BUILD_ID: 'build-123', APP_VERSION: '1.0.0' }))
vi.mock('@/lib/platform', () => ({ platform: 'android' }))

const { scrub, routeShape, reportCrash, flushCrashQueue } = await import('./telemetry')

beforeEach(() => {
  insert.mockReset()
  insert.mockResolvedValue({ error: null })
  configured = true
  localStorage.clear()
})

describe('scrub', () => {
  it('removes a phone number, which is the identity in this app', () => {
    expect(scrub('verifyOtp failed for +233 24 123 4567')).toBe('verifyOtp failed for [number]')
  })

  it('removes an email address', () => {
    expect(scrub('owner ama@example.com rejected')).toBe('owner [email] rejected')
  })

  it('removes anything shaped like a JWT', () => {
    expect(scrub('Bearer eyJhbGciOiJIUzI1NiJ9.abc')).toContain('[token]')
  })

  it('removes ids, so one crash cannot name another account', () => {
    expect(scrub('task 3f7a1b2c-1111-4222-8333-444455556666 missing')).toBe('task [id] missing')
  })

  it('leaves an ordinary message alone', () => {
    const m = "Cannot read properties of undefined (reading 'title')"
    expect(scrub(m)).toBe(m)
  })
})

describe('routeShape', () => {
  it('keeps the screen and drops whose data was on it', () => {
    expect(
      routeShape(
        '/contacts/3f7a1b2c-1111-4222-8333-444455556666/t/aaaa1b2c-1111-4222-8333-444455556666',
      ),
    ).toBe('/contacts/:id/t/:id')
  })

  it('drops the query string, which can carry anything', () => {
    expect(routeShape('/contacts?q=Felicia')).toBe('/contacts')
  })
})

describe('reportCrash', () => {
  it('sends the build id, because a report without one cannot be acted on', async () => {
    await reportCrash({ kind: 'render', message: 'boom', route: '/groups' })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0][0]).toMatchObject({
      build_id: 'build-123',
      app_version: '1.0.0',
      platform: 'android',
      route: '/groups',
      kind: 'render',
      message: 'boom',
    })
  })

  it('attributes the report to the signed-in user', async () => {
    await reportCrash({ kind: 'render', message: 'boom' })
    expect(insert.mock.calls[0][0][0].user_id).toBe('me-uuid')
  })

  it('scrubs the message and the stack before they leave the device', async () => {
    await reportCrash({
      kind: 'uncaught',
      message: 'failed for +233241234567',
      stack: 'at send(+233241234567)',
    })
    const row = insert.mock.calls[0][0][0]
    expect(row.message).not.toContain('233241234567')
    expect(row.stack).not.toContain('233241234567')
  })

  it('truncates a runaway message to what the column accepts', async () => {
    await reportCrash({ kind: 'render', message: 'x'.repeat(2000) })
    expect(insert.mock.calls[0][0][0].message.length).toBe(500)
  })

  it('keeps the report for next time when the send fails', async () => {
    insert.mockResolvedValue({ error: { message: 'offline' } })
    await reportCrash({ kind: 'render', message: 'boom' })
    expect(JSON.parse(localStorage.getItem('tt.crash-queue')!)).toHaveLength(1)
  })

  it('keeps it even with no backend configured at all', async () => {
    configured = false
    await reportCrash({ kind: 'render', message: 'boom' })
    expect(JSON.parse(localStorage.getItem('tt.crash-queue')!)).toHaveLength(1)
  })

  it('never throws, whatever the client does', async () => {
    insert.mockImplementation(() => {
      throw new Error('client exploded')
    })
    await expect(reportCrash({ kind: 'render', message: 'boom' })).resolves.toBeUndefined()
  })

  it('stops queueing without bound', async () => {
    insert.mockResolvedValue({ error: { message: 'offline' } })
    for (let i = 0; i < 15; i++) await reportCrash({ kind: 'render', message: `boom ${i}` })
    const queued = JSON.parse(localStorage.getItem('tt.crash-queue')!)
    expect(queued).toHaveLength(10)
    // The first crash of a session usually explains the rest, so it is the one kept.
    expect(queued[0].message).toBe('boom 0')
  })
})

describe('flushCrashQueue', () => {
  it('sends what an earlier run could not, and clears it', async () => {
    insert.mockResolvedValue({ error: { message: 'offline' } })
    await reportCrash({ kind: 'render', message: 'from yesterday' })
    insert.mockResolvedValue({ error: null })

    await flushCrashQueue()
    expect(insert).toHaveBeenCalledTimes(2)
    expect(insert.mock.calls[1][0][0].message).toBe('from yesterday')
    expect(localStorage.getItem('tt.crash-queue')).toBeNull()
  })

  it('keeps the queue when the flush fails, rather than losing the reports', async () => {
    insert.mockResolvedValue({ error: { message: 'offline' } })
    await reportCrash({ kind: 'render', message: 'still stuck' })
    await flushCrashQueue()
    expect(JSON.parse(localStorage.getItem('tt.crash-queue')!)).toHaveLength(1)
  })

  it('does nothing when there is nothing kept', async () => {
    await flushCrashQueue()
    expect(insert).not.toHaveBeenCalled()
  })
})
