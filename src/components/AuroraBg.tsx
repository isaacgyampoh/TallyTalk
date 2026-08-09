import bgLight from '@/assets/welcome-bg-light.jpg'
import bgDark from '@/assets/welcome-bg-dark.jpg'

/** Branded aurora backdrop, bundled (native-safe) and theme-aware. */
export function AuroraBg() {
  return (
    <>
      <img
        src={bgLight}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover dark:hidden"
      />
      <img
        src={bgDark}
        alt=""
        className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover dark:block"
      />
    </>
  )
}
