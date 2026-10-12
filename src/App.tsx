import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { useAuth } from '@/context/authState'
import { registerPush, setNotificationRouter, clearNotificationRouter } from '@/lib/push'
import { isAppMode } from '@/lib/platform'
import { isOnboarded } from '@/lib/onboarding'
import { hasChosenLanguage } from '@/lib/language'
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

// Screens load on demand. The marketing landing page and the onboarding slides
// are the big win: a signed-in user never downloads them, and a visitor to the
// website never downloads the app. `screen` unwraps the named export so these
// read like the static imports they replaced.
const screen = <T extends string>(name: T, load: () => Promise<Record<T, React.ComponentType>>) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const Landing = screen('Landing', () => import('@/screens/Landing'))
const AuthFlow = screen('AuthFlow', () => import('@/screens/AuthFlow'))
const Welcome = screen('Welcome', () => import('@/screens/Welcome'))
const Onboarding = screen('Onboarding', () => import('@/screens/Onboarding'))
// `screen` is typed for prop-less screens; this one takes a callback.
const LanguageStep = lazy(() =>
  import('@/screens/LanguageStep').then((m) => ({ default: m.LanguageStep })),
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
  return (
    <div className="app-frame items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-violet-ink">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet text-white animate-wand">
          <WandIcon width={28} height={28} />
        </span>
        <span className="font-display text-lg font-bold text-ink">{APP_NAME}</span>
      </div>
    </div>
  )
}

let introPlayed = false

function Gate() {
  const { ready, signedIn, session } = useAuth()
  const [intro, setIntro] = useState(isAppMode && !introPlayed)
  const [languageChosen, setLanguageChosen] = useState(hasChosenLanguage)
  useAndroidBack()

  const nav = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (!session) return
    // Foreground arrivals are not drawn by the OS, so surface them in-app.
    void registerPush((title, body) => toast(body ? `${title} — ${body}` : title, 'info'))
    setNotificationRouter((path) => nav(path))
    return () => clearNotificationRouter()
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
          path="*"
          element={
            isAppMode ? (
              <AppViewport>
                {!languageChosen ? (
                  <LanguageStep onDone={() => setLanguageChosen(true)} />
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
    </ThemeProvider>
  )
}
