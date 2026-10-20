const UNREACHABLE = "We can't reach the server right now. Check your connection and try again."
const NO_SMS =
  "We can't send codes by text right now. This is on our side, not yours — please try again later."

/**
 * What to put in front of a person when sign-in fails.
 *
 * Two classes of message never belong on screen. A bare fetch failure, which
 * is how supabase-js reports a dead host or no network. And a message about
 * our own machinery — "Unsupported phone provider" was shown to real users on
 * the live site, and once SMS was wired up a provider refusal arrived as
 * "Unexpected status code returned from hook: 502". Both tell the person
 * nothing they can act on and read like they did something wrong. The
 * original is still logged, because the person who can act on it is us.
 *
 * Anything else is passed through: GoTrue's own messages about a wrong code or
 * waiting before asking again are clear, and rewriting them would lose detail
 * the person needs.
 */
export function readableAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)

  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return UNREACHABLE
  }
  if (
    /unsupported phone provider|phone_provider_disabled|phone provider|signups not allowed|error sending (confirmation )?sms|sms provider|returned from hook|unexpected_failure|hook failed/i.test(
      message,
    )
  ) {
    console.error('[auth] sign-in is misconfigured on the server:', message)
    return NO_SMS
  }
  return message
}
