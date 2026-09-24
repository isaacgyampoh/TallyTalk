// Whether the intro slides have been seen. This lives apart from the
// Onboarding screen so App can check the flag without pulling that screen into
// the initial bundle.

const KEY = 'tt.onboarded'

/** localStorage throws in some privacy modes; never let that break boot. */
export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* private mode — the slides will show again next launch */
  }
}
