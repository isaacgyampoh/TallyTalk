import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { useAuth } from '@/context/authState'
import {
  listenForDeepLinks,
  registerPush,
  setNotificationRouter,
  clearNotificationRouter,
} from '@/lib/push'
import { isAppMode } from '@/lib/platform'
import { isOnboarded } from '@/lib/onboarding'
import { shouldAskForLanguage } from '@/lib/language'
import { useMyProfile } from '@/data/hooks'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/components/Toast'
import { useToast } from '@/components/toastContext'
import { AppViewport } from '@/components/AppViewport'
import { Shell } from '@/components/Shell'
import { IntroSplash } from '@/screens/IntroSplash'
import { useAndroidBack } from '@/hooks/useSwipeBack'
import { APP_NAME } from '@/lib/config'
import { WandIcon } from '@/components/icons'
import { retryImport } from '@/lib/retryImport'
import { useOnline } from '@/hooks/useOnline'
import { I18nProvider } from '@/i18n/I18nProvider'
import { useT } from '@/i18n/useT'

// Screens load on demand. The marketing landing page and the onboarding slides
// are the big win: a signed-in user never downloads them, and a visitor to the
// website never downloads the app. `screen` unwraps the named export so these
// read like the static imports they replaced, and retries the fetch so a
// moment's loss of signal does not end the session (see lib/retryImport).
const screen = <T extends string>(name: T, load: () => Promise<Record<T, React.ComponentType>>) =>
  lazy(() => retryImport(load).then((m) => ({ default: m[name] })))

const Landing = screen('Landing', () => import('@/screens/Landing'))
const AuthFlow = screen('AuthFlow', () => import('@/screens/AuthFlow'))
const Welcome = screen('Welcome', () => import('@/screens/Welcome'))
const Onboarding = screen('Onboarding', () => import('@/screens/Onboarding'))
// `screen` is typed for prop-less screens; this one takes a callback.
const LegalScreen = screen('LegalScreen', () => import('@/screens/LegalScreen'))

// `screen` is typed for prop-less screens; this one takes a callback.
const LanguageStep = lazy(() =>
  retryImport(() => import('@/screens/LanguageStep')).then((m) => ({ default: m.LanguageStep })),
)
const ContactsScreen = screen('ContactsScreen', () => import('@/screens/ContactsScreen'))
const ContactSpaceScreen = screen(
  'ContactSpaceScreen',
  () => import('@/screens/ContactSpaceScreen'),
)
const TaskCommentsScreen = screen(
  'TaskCommentsScreen',
  () => import('@/screens/TaskCommentsScreen'),
)
const PersonalScreen = screen('PersonalScreen', () => import('@/screens/PersonalScreen'))
const ChecklistDetailScreen = screen(
  'ChecklistDetailScreen',
  () => import('@/screens/ChecklistDetailScreen'),
)
const GroupsScreen = screen('GroupsScreen', () => import('@/screens/GroupsScreen'))
const GroupDetailScreen = screen('GroupDetailScreen', () => import('@/screens/GroupDetailScreen'))
const ProfileScreen = screen('ProfileScreen', () => import('@/screens/ProfileScreen'))

function Splash() {
  // A screen that is still arriving looks identical to one that cannot arrive.
  // If the device has no connection, say so rather than holding the logo.
  const online = useOnline()
  const { t } = useT()
  return (
    <div className="app-frame items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-violet-ink">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet text-white animate-wand">
          <WandIcon width={28} height={28} />
        </span>
        <span className="font-display text-lg font-bold text-ink">{APP_NAME}</span>
        {!online && (
          <span role="status" className="text-[13px] font-semibold text-ink-soft">
            {t('offline.waiting')}
          </span>
        )}
      </div>
    </div>
  )
}

let introPlayed = false

function Gate() {
  const { ready, signedIn, session } = useAuth()
  const [intro, setIntro] = useState(isAppMode && !introPlayed)
  const [needsLanguage, setNeedsLanguage] = useState(shouldAskForLanguage)
  useAndroidBack()

  const nav = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (!session) return
    // Foreground arrivals are not drawn by the OS, so surface them in-app.
    void registerPush((title, body) => toast(body ? `${title} — ${body}` : title, 'info'))
    setNotificationRouter((path) => nav(path))

    // Links can arrive signed out too, but routing one before there is a
    // session would show a protected screen; the router handles that.
    let stop: (() => void) | undefined
    void listenForDeepLinks().then((off) => {
      stop = off
    })

    return () => {
      clearNotificationRouter()
      stop?.()
    }
  }, [session, nav, toast])

  // Where an unrecognised route lands. The profile column has been editable
  // since PB-010 but nothing read it, so the setting did nothing.
  const { data: profile } = useMyProfile()
  const landing = profile?.default_landing_screen
    ? `/${profile.default_landing_screen}`
    : '/contacts'

  if (intro) {
    return (
      <AppViewport>
        <IntroSplash
          onDone={() => {
            introPlayed = true
            setIntro(false)
          }}
        />
      </AppViewport>
    )
  }

  if (!ready)
    return (
      <AppViewport>
        <Splash />
      </AppViewport>
    )

  if (!signedIn) {
    return (
      <Routes>
        <Route
          path="/signin"
          element={
            <AppViewport>
              <AuthFlow />
            </AppViewport>
          }
        />
        <Route
          path="/legal/:doc"
          element={
            <AppViewport>
              <LegalScreen />
            </AppViewport>
          }
        />
        <Route
          path="*"
          element={
            isAppMode ? (
              <AppViewport>
                {needsLanguage ? (
                  <LanguageStep onDone={() => setNeedsLanguage(false)} />
                ) : isOnboarded() ? (
                  <Welcome />
                ) : (
                  <Onboarding />
                )}
              </AppViewport>
            ) : (
              <Landing />
            )
          }
        />
      </Routes>
    )
  }

  return (
    <AppViewport>
      <Routes>
        {/* Full-screen detail views (no bottom nav), like a chat thread. */}
        <Route path="/contacts/:id" element={<ContactSpaceScreen />} />
        <Route path="/contacts/:id/t/:taskId" element={<TaskCommentsScreen />} />
        <Route path="/legal/:doc" element={<LegalScreen />} />
        <Route path="/personal/:key" element={<ChecklistDetailScreen />} />
        <Route path="/groups/:id" element={<GroupDetailScreen />} />

        <Route
          path="/*"
          element={
            <Shell>
              <Routes>
                <Route path="/contacts" element={<ContactsScreen />} />
                <Route path="/personal" element={<PersonalScreen />} />
                <Route path="/groups" element={<GroupsScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="*" element={<Navigate to={landing} replace />} />
              </Routes>
            </Shell>
          }
        />
      </Routes>
    </AppViewport>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <Suspense
                  fallback={
                    <AppViewport>
                      <Splash />
                    </AppViewport>
                  }
                >
                  <Gate />
                </Suspense>
              </ToastProvider>
            </QueryClientProvider>
          </AuthProvider>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  )
}
