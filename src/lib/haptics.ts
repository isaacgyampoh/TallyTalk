import { isNative } from './platform'

// Native uses the Capacitor Haptics engine; web falls back to the Vibration API.
export function buzz(pattern: number | number[] = 12) {
  if (isNative) {
    import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}))
      .catch(() => {})
    return
  }
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    /* ignore */
  }
}
