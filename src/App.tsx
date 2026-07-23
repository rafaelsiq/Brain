import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GuestOnly, RequireAuth } from '@/components/AuthGate'
import { DeepLinkListener } from '@/components/DeepLinkListener'
import { TourProvider } from '@/components/Tour/TourProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useKeyboardInset } from '@/lib/keyboardInset'
import { GroupDetailPage } from '@/pages/GroupDetailPage'
import { GroupMembersPage } from '@/pages/GroupMembersPage'
import { GroupsPage } from '@/pages/GroupsPage'
import { JoinPage } from '@/pages/JoinPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { RecordStanzaPage } from '@/pages/RecordStanzaPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SongDetailPage } from '@/pages/SongDetailPage'
import { SongEditorPage } from '@/pages/SongEditorPage'
import { WelcomePage } from '@/pages/WelcomePage'

function AppRoutes() {
  useKeyboardInset()

  return (
    <BrowserRouter>
      <DeepLinkListener />
      <TourProvider>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route path="/join/:code" element={<JoinPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:groupId" element={<GroupDetailPage />} />
            <Route path="/groups/:groupId/members" element={<GroupMembersPage />} />
            <Route path="/groups/:groupId/songs/:songId" element={<SongDetailPage />} />
            <Route path="/groups/:groupId/songs/:songId/edit" element={<SongEditorPage />} />
            <Route
              path="/groups/:groupId/songs/:songId/stanzas/:stanzaId/record"
              element={<RecordStanzaPage />}
            />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="/" element={<Navigate to="/groups" replace />} />
          <Route path="*" element={<Navigate to="/groups" replace />} />
        </Routes>
      </TourProvider>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  )
}
