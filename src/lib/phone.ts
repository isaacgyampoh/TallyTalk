/**
 * Turning what someone typed into the one phone number the app uses.
 *
 * There are three forms of the same number in play, and they have to agree or
 * people cannot find each other:
 *
 *   what a Ghanaian types    024 412 3456   (local, leading zero, spaces)
 *   what the app sends       +233244123456  (dial code, E.164)
 *   what GoTrue stores       233244123456   (E.164 digits, no plus)
 *
 * Sign-in got this right and adding a contact did not, so a real account could
 * not be found by its number at all. One function now does it for both.
 */

/** Just the digits — the form two numbers can be compared in. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Combine a dial code with a locally-typed number.
 *
 * The leading zero of a local number is a domestic prefix, not part of the
 * number: 024 412 3456 in Ghana is +233 24 412 3456, never +233 024 412 3456.
 */
export function toE164(dial: string, local: string): string {
  const code = digitsOnly(dial)
  const national = digitsOnly(local).replace(/^0+/, '')
  return `+${code}${national}`
}

/** Whether enough has been typed to be worth looking up. */
export function looksDiallable(local: string): boolean {
  return digitsOnly(local).replace(/^0+/, '').length >= 6
}

/** Do these two refer to the same number, whatever shape they arrived in? */
export function sameNumber(a: string, b: string): boolean {
  return digitsOnly(a) === digitsOnly(b) && digitsOnly(a).length > 0
}
