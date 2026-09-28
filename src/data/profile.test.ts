import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock, type MockClient } from './supabaseMock'

const ME = 'me-uuid'

let client: MockClient
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return client
  },
  isSupabaseConfigured: true,
}))

const { getMyProfile, updateMyProfile, uploadAvatar } = await import('./profile')

const profileRow = {
  id: ME,
  phone: '+233241234567',
  display_name: 'Isaac',
  photo_url: null,
  description: null,
  who_can_send_requests: 'my_contacts',
  who_can_add_to_groups: 'my_contacts',
  photo_visibility: 'everyone',
  searchable_by_number: true,
  default_landing_screen: 'contacts',
}

beforeEach(() => {
  client = makeSupabaseMock({ results: { profiles: { data: profileRow, error: null } } })
})

describe('getMyProfile', () => {
  it('reads my own row', async () => {
    const p = await getMyProfile()
    expect(p.display_name).toBe('Isaac')
    expect(client.calls.profiles.find((c) => c.method === 'eq')?.args).toEqual(['id', ME])
  })
})

describe('updateMyProfile', () => {
  it('scopes the update to my own row', async () => {
    client = makeSupabaseMock({ results: { profiles: { error: null } } })
    await updateMyProfile({ display_name: 'Isaac Gyampoh' })
    expect(client.argFor('profiles', 'update')).toEqual({ display_name: 'Isaac Gyampoh' })
    expect(client.calls.profiles.find((c) => c.method === 'eq')?.args).toEqual(['id', ME])
  })

  it('carries the privacy scopes', async () => {
    client = makeSupabaseMock({ results: { profiles: { error: null } } })
    await updateMyProfile({
      who_can_send_requests: 'work_and_favorites',
      searchable_by_number: false,
    })
    expect(client.argFor('profiles', 'update')).toEqual({
      who_can_send_requests: 'work_and_favorites',
      searchable_by_number: false,
    })
  })

  it('has no way to change the phone number', () => {
    // 0003 added a trigger that rejects any change to `phone` — it comes from
    // the verified sign-in. The patch type must not offer it in the first place.
    const patch: Parameters<typeof updateMyProfile>[0] = { display_name: 'x' }
    expect('phone' in patch).toBe(false)
  })

  it('throws when the update is refused', async () => {
    client = makeSupabaseMock({ results: { profiles: { error: { message: 'rls' } } } })
    await expect(updateMyProfile({ display_name: 'x' })).rejects.toMatchObject({ message: 'rls' })
  })
})

describe('uploadAvatar', () => {
  const file = { name: 'me.PNG', type: 'image/png' } as unknown as File

  it('uploads inside my own folder, which is what the storage policy requires', async () => {
    await uploadAvatar(file)
    expect(client.uploads).toHaveLength(1)
    expect(client.uploads[0].bucket).toBe('avatars')
    expect(client.uploads[0].path).toBe(`${ME}/avatar.png`)
  })

  it('replaces rather than accumulating orphans', async () => {
    await uploadAvatar(file)
    expect(client.uploads[0].opts).toMatchObject({ upsert: true, contentType: 'image/png' })
  })

  it('returns a cache-busted URL, so a replaced picture actually changes', async () => {
    const url = await uploadAvatar(file)
    expect(url).toContain(`/avatars/${ME}/avatar.png`)
    expect(url).toMatch(/\?v=\d+$/)
  })

  it('falls back to jpg when the file has no extension', async () => {
    await uploadAvatar({ name: 'photo', type: 'image/jpeg' } as unknown as File)
    expect(client.uploads[0].path).toBe(`${ME}/avatar.jpg`)
  })

  it('throws when the upload is refused', async () => {
    client = makeSupabaseMock({ uploadError: { message: 'denied' } })
    await expect(uploadAvatar(file)).rejects.toMatchObject({ message: 'denied' })
  })
})
