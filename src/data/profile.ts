import { supabase } from '@/lib/supabase'

/**
 * Your own profile: who you are, and who can reach you.
 *
 * The phone number is deliberately absent from everything writable here. It is
 * the identity in this app and migration 0003 added a trigger that rejects any
 * change to it — it comes from the verified OTP sign-in and nowhere else.
 */

function db() {
  if (!supabase) throw new Error('Supabase client unavailable (running in preview mode)')
  return supabase
}

async function myId(): Promise<string> {
  const {
    data: { user },
  } = await db().auth.getUser()
  if (!user) throw new Error('Not signed in')
  return user.id
}

/** Who may do a given thing. Mirrors the privacy_scope enum in 0001. */
export type PrivacyScope = 'everyone' | 'my_contacts' | 'work_and_favorites' | 'nobody'

export interface MyProfile {
  id: string
  phone: string
  display_name: string
  photo_url: string | null
  description: string | null
  who_can_send_requests: PrivacyScope
  who_can_add_to_groups: PrivacyScope
  photo_visibility: PrivacyScope
  searchable_by_number: boolean
  default_landing_screen: 'personal' | 'contacts' | 'groups'
}

/** Everything a user may change about themselves. Note the absence of `phone`. */
export type ProfilePatch = Partial<
  Pick<
    MyProfile,
    | 'display_name'
    | 'photo_url'
    | 'description'
    | 'who_can_send_requests'
    | 'who_can_add_to_groups'
    | 'photo_visibility'
    | 'searchable_by_number'
    | 'default_landing_screen'
  >
>

export async function getMyProfile(): Promise<MyProfile> {
  const me = await myId()
  const { data, error } = await db().from('profiles').select('*').eq('id', me).single()
  if (error) throw error
  return data as MyProfile
}

export async function updateMyProfile(patch: ProfilePatch): Promise<void> {
  const me = await myId()
  const { error } = await db().from('profiles').update(patch).eq('id', me)
  if (error) throw error
}

/**
 * Upload an avatar and return its public URL.
 *
 * The path must start with the uploader's own id: 0003 scopes the avatars
 * bucket to `avatars/<user id>/…`, so anything else is refused. `upsert` lets
 * someone replace their picture rather than accumulating orphans.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const me = await myId()
  // `split('.').pop()` returns the whole name when there is no dot, which would
  // upload "photo" as the extension. Only treat it as one if a dot exists.
  const dot = file.name.lastIndexOf('.')
  const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : 'jpg'
  const path = `${me}/avatar.${ext}`

  const { error } = await db()
    .storage.from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error

  const { data } = db().storage.from('avatars').getPublicUrl(path)
  // Bust the CDN cache: the path is stable, so a replaced picture would
  // otherwise keep serving the old bytes.
  return `${data.publicUrl}?v=${Date.now()}`
}
