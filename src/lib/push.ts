import { isNative, platform } from './platform'
import { supabase } from './supabase'

let registered = false

/**
 * Native only: ask for notification permission, register with APNs/FCM, and
 * store the device token against the signed-in user. No-op on web and when
 * there is no real Supabase session (e.g. the sample-data demo).
 */
export async function registerPush() {
  if (!isNative || registered) return
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return

    registered = true
    await PushNotifications.register()

    await PushNotifications.addListener('registration', async (token) => {
      await saveToken(token.value)
    })
    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error', err)
    })
  } catch (err) {
    console.error('Push setup failed', err)
  }
}

async function saveToken(token: string) {
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('push_tokens')
    .upsert({ user_id: user.id, token, platform }, { onConflict: 'user_id,token' })
}
