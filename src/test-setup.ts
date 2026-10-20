/**
 * jsdom has no matchMedia, and several modules read it at import time to work
 * out whether they are running as an installed app. Without this, importing
 * one of them into a test fails before a single assertion runs.
 *
 * It reports "no match", which is the plain-browser case; a test that cares
 * about standalone mode overrides it itself.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
