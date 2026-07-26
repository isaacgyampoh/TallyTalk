import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Shell } from '@/components/Shell'
import { AuthFlow } from '@/screens/AuthFlow'
import { ContactsScreen } from '@/screens/ContactsScreen'
import { ContactSpaceScreen } from '@/screens/ContactSpaceScreen'
import { PersonalScreen } from '@/screens/PersonalScreen'
import { GroupsScreen } from '@/screens/GroupsScreen'
import { ProfileScreen } from '@/screens/ProfileScreen'
import { APP_NAME } from '@/lib/config'
import { WandIcon } from '@/components/icons'

function Splash() {
  return (
    <div className="app-frame items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-violet">
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
  if (!ready) return <Splash />
  if (!signedIn) return <AuthFlow />

  return (
    <Routes>
      {/* The contact task space is full-screen (no bottom nav), like a chat thread. */}
      <Route path="/contacts/:id" element={<ContactSpaceScreen />} />

      <Route
        path="/*"
        element={
          <Shell>
            <Routes>
              <Route path="/contacts" element={<ContactsScreen />} />
              <Route path="/personal" element={<PersonalScreen />} />
              <Route path="/groups" element={<GroupsScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
              {/* Default landing screen — Contacts per the spec's recommendation. */}
              <Route path="*" element={<Navigate to="/contacts" replace />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
