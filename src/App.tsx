import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/components/Toast'
import { AppViewport } from '@/components/AppViewport'
import { Shell } from '@/components/Shell'
import { Landing } from '@/screens/Landing'
import { AuthFlow } from '@/screens/AuthFlow'
import { ContactsScreen } from '@/screens/ContactsScreen'
import { ContactSpaceScreen } from '@/screens/ContactSpaceScreen'
import { PersonalScreen } from '@/screens/PersonalScreen'
import { ChecklistDetailScreen } from '@/screens/ChecklistDetailScreen'
import { GroupsScreen } from '@/screens/GroupsScreen'
import { GroupDetailScreen } from '@/screens/GroupDetailScreen'
import { ProfileScreen } from '@/screens/ProfileScreen'
import { TodayScreen } from '@/screens/TodayScreen'
import { APP_NAME } from '@/lib/config'
import { WandIcon } from '@/components/icons'

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

function Gate() {
  const { ready, signedIn } = useAuth()
  if (!ready) return <AppViewport><Splash /></AppViewport>

  if (!signedIn) {
    return (
      <Routes>
        <Route path="/signin" element={<AppViewport><AuthFlow /></AppViewport>} />
        <Route path="*" element={<Landing />} />
      </Routes>
    )
  }

  return (
    <AppViewport>
      <Routes>
        {/* Full-screen detail views (no bottom nav), like a chat thread. */}
        <Route path="/contacts/:id" element={<ContactSpaceScreen />} />
        <Route path="/personal/:key" element={<ChecklistDetailScreen />} />
        <Route path="/groups/:id" element={<GroupDetailScreen />} />

        <Route
          path="/*"
          element={
            <Shell>
              <Routes>
                <Route path="/today" element={<TodayScreen />} />
                <Route path="/contacts" element={<ContactsScreen />} />
                <Route path="/personal" element={<PersonalScreen />} />
                <Route path="/groups" element={<GroupsScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="*" element={<Navigate to="/today" replace />} />
              </Routes>
            </Shell>
          }
        />
      </Routes>
    </AppViewport>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Gate />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
