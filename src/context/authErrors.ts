const UNREACHABLE = "We can't reach the server right now. Check your connection and try again."
const NO_SMS =
  "We can't send codes by text right now. This is on our side, not yours — please try again later."
const SERVER_SIDE = 'Something went wrong on our side. Please try again in a moment.'

/** Whichever call failed, so the message can say something useful about it. */
export type AuthStep = 'send' | 'verify'

/** supabase-js attaches the HTTP status to its auth errors. */
function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null || !('status' in err)) return undefined
  const status = (err as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

/** A message with no letters in it has nothing to tell anybody. */
function isUnreadable(message: string): boolean {
  return !/\p{L}/u.test(message)
}

/**
 * What to put in front of a person when sign-in fails.
 *
 * Three classes of message never belong on screen:
 *
 *  1. A bare fetch failure, which is how supabase-js reports a dead host or no
 *     network.
 *  2. A message about our own machinery. "Unsupported phone provider" was
 *     shown to real users on the live site, and once SMS was wired up a
 *     provider refusal arrived as "Unexpected status code returned from
 *     hook: 502".
 *  3. Anything with no words in it. supabase-js turns a 500 into an
 *     AuthRetryableFetchError whose message is the literal string "{}", which
 *     is what the live site displayed — no pattern could ever have matched it,
 *     so the status and the shape are checked rather than the words.
 *
 * The original is always logged, because the person who can act on it is us.
 * Anything else is passed through: GoTrue's own messages about a wrong code or
 * waiting before asking again are clear, and rewriting them would lose detail
 * the person needs.
 */
export function readableAuthError(err: unknown, step: AuthStep = 'send'): string {
  const message = err instanceof Error ? err.message : String(err)
  const status = statusOf(err)

  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return UNREACHABLE
  }

  const providerProblem =
    /unsupported phone provider|phone_provider_disabled|phone provider|signups not allowed|error sending (confirmation )?sms|sms provider|returned from hook|unexpected_failure|hook failed/i.test(
      message,
    )

  if (providerProblem || isUnreadable(message) || (status !== undefined && status >= 500)) {
    console.error('[auth] sign-in failed on our side:', status ?? '', message)
    // A 500 while asking for a code is the SMS path in practice; a 500 while
    // checking one is something else, so do not promise which.
    return step === 'send' ? NO_SMS : SERVER_SIDE
  }

  return message
}
