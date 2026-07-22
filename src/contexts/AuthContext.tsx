import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usingFirebase } from '@/lib/firebase'
import { watchAuth } from '@/data/firebaseRepo'
import { emptyState, normalizeState } from '@/data/persist'
import {
  applyRemoteState,
  getState,
  hydrateFirebaseUser,
  subscribe,
} from '@/data/store'

type AuthContextValue = {
  ready: boolean
  usingCloud: boolean
  userId: string | null
}

const AuthContext = createContext<AuthContextValue>({
  ready: !usingFirebase,
  usingCloud: usingFirebase,
  userId: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!usingFirebase)
  const [userId, setUserId] = useState<string | null>(
    usingFirebase ? null : getState().currentUserId,
  )

  useEffect(() => {
    if (!usingFirebase) {
      setReady(true)
      setUserId(getState().currentUserId)
      return subscribe(() => setUserId(getState().currentUserId))
    }

    let cancelled = false
    const unsub = watchAuth((user) => {
      void (async () => {
        if (!user) {
          applyRemoteState({ ...emptyState(), currentUserId: null })
          if (!cancelled) {
            setUserId(null)
            setReady(true)
          }
          return
        }
        if (!cancelled) setReady(false)
        try {
          await hydrateFirebaseUser(user.uid)
          if (!cancelled) setUserId(user.uid)
        } catch (err) {
          console.error('Falha ao carregar dados do Firebase', err)
          if (!cancelled) {
            applyRemoteState(
              normalizeState({
                ...emptyState(),
                profiles: getState().profiles,
                currentUserId: user.uid,
              }),
            )
            setUserId(user.uid)
          }
        } finally {
          if (!cancelled) setReady(true)
        }
      })()
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const value = useMemo(
    () => ({ ready, usingCloud: usingFirebase, userId }),
    [ready, userId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
