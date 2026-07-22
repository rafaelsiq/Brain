import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { currentProfile } from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'

function AuthLoading() {
  return (
    <div className="app-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
      <p className="muted">Carregando…</p>
    </div>
  )
}

export function RequireAuth() {
  useBrainStore()
  const { ready } = useAuth()
  const profile = currentProfile()
  const location = useLocation()
  if (!ready) return <AuthLoading />
  if (!profile) {
    return <Navigate to="/welcome" replace state={{ from: location }} />
  }
  return <Outlet />
}

export function GuestOnly() {
  useBrainStore()
  const { ready } = useAuth()
  const profile = currentProfile()
  if (!ready) return <AuthLoading />
  if (profile) return <Navigate to="/groups" replace />
  return <Outlet />
}
