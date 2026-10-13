/**
 * Turning an incoming link into a route.
 *
 * Two shapes arrive: `tasktally://contacts/x/t/y` from anything the app emits,
 * and `https://tally-talk.vercel.app/contacts/x/t/y` from an App Link. Both
 * should land on the same screen.
 */

const WEB_HOSTS = ['tally-talk.vercel.app', 'localhost']

/**
 * The in-app path a link refers to, or null if it names nothing we route.
 *
 * Returns a path only — never anything that could redirect off-app — because
 * this value is handed straight to the router and a link is attacker-supplied.
 */
export function routeForUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  let path: string
  if (parsed.protocol === 'tasktally:') {
    // tasktally://contacts/x parses with "contacts" as the host.
    path = `/${parsed.host}${parsed.pathname}`.replace(/\/+$/, '')
  } else if (parsed.protocol === 'https:' && WEB_HOSTS.includes(parsed.hostname)) {
    path = parsed.pathname.replace(/\/+$/, '')
  } else {
    return null
  }

  if (!path || path === '/') return null
  // Only in-app destinations. Anything else is ignored rather than followed.
  const allowed = /^\/(contacts|personal|groups|profile|legal)(\/|$)/
  return allowed.test(path) ? path + parsed.search : null
}
