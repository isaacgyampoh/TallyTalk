// Small, safe wrapper around the Vibration API. No-op where unsupported (iOS Safari).
export function buzz(pattern: number | number[] = 12) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    /* ignore */
  }
}
