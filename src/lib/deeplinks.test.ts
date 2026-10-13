import { describe, expect, it } from 'vitest'
import { routeForUrl } from './deeplinks'

describe('routeForUrl', () => {
  it('routes the custom scheme', () => {
    expect(routeForUrl('tasktally://contacts/felicia')).toBe('/contacts/felicia')
    expect(routeForUrl('tasktally://contacts/felicia/t/abc')).toBe('/contacts/felicia/t/abc')
  })

  it('routes an App Link on the real host', () => {
    expect(routeForUrl('https://tally-talk.vercel.app/groups/g1')).toBe('/groups/g1')
  })

  it('ignores a link to another site, however it is dressed up', () => {
    // A link is attacker-supplied; following one off-app would be an open redirect.
    expect(routeForUrl('https://evil.example/contacts/felicia')).toBeNull()
    expect(routeForUrl('https://tally-talk.vercel.app.evil.example/contacts/x')).toBeNull()
  })

  it('ignores paths the app does not route', () => {
    expect(routeForUrl('tasktally://admin/secrets')).toBeNull()
    expect(routeForUrl('https://tally-talk.vercel.app/')).toBeNull()
  })

  it('does not throw on rubbish', () => {
    expect(routeForUrl('not a url')).toBeNull()
    expect(routeForUrl('')).toBeNull()
  })

  it('keeps a query string, which a share link may carry', () => {
    expect(routeForUrl('tasktally://contacts/felicia?from=sms')).toBe('/contacts/felicia?from=sms')
  })
})
