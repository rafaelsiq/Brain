import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { TourSpotlight } from '@/components/Tour/TourSpotlight'
import {
  currentProfile,
  groupsForUser,
  songsForGroup,
} from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'
import {
  dismissTip,
  getDismissedTips,
  isTourCompleted,
  skipTour,
  startTour,
  subscribeOnboardingPrefs,
} from '@/lib/onboardingPrefs'
import {
  allTipsDismissed,
  resolveCurrentTip,
  TOUR_STEPS,
  type TourContext,
  type TourStep,
  type TourStepId,
} from '@/lib/tourSteps'

type TourApi = {
  start: () => void
}

const TourContextApi = createContext<TourApi>({ start: () => {} })

export function useTour(): TourApi {
  return useContext(TourContextApi)
}

function buildCtx(pathname: string): TourContext {
  const profile = currentProfile()
  if (!profile) {
    return {
      groupCount: 0,
      songCountInCurrentGroup: 0,
      hasAnySong: false,
      currentGroupId: null,
    }
  }
  const groups = groupsForUser(profile.id)
  const groupMatch = matchPath('/groups/:groupId/*', pathname) || matchPath('/groups/:groupId', pathname)
  const currentGroupId = groupMatch?.params.groupId ?? null
  const songsInGroup = currentGroupId ? songsForGroup(currentGroupId, profile.id) : []
  const hasAnySong = groups.some((g) => songsForGroup(g.id, profile.id).length > 0)

  return {
    groupCount: groups.length,
    songCountInCurrentGroup: songsInGroup.length,
    hasAnySong,
    currentGroupId,
  }
}

function hasAnchor(step: TourStep): boolean {
  const ids = [step.anchor, ...(step.fallbackAnchors ?? [])]
  return ids.some((id) => Boolean(document.querySelector(`[data-tour="${id}"]`)))
}

export function TourProvider({ children }: { children: ReactNode }) {
  const state = useBrainStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [dismissed, setDismissed] = useState<TourStepId[]>(() => getDismissedTips())
  const [completed, setCompleted] = useState(() => isTourCompleted())
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    return subscribeOnboardingPrefs(() => {
      setDismissed(getDismissedTips())
      setCompleted(isTourCompleted())
    })
  }, [])

  const ctx = useMemo(
    () => buildCtx(location.pathname),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.groups, state.songs, state.members, state.participants, location.pathname],
  )

  const current = useMemo(() => {
    if (completed) return null
    if (!currentProfile()) return null
    return resolveCurrentTip(location.pathname, ctx, dismissed)
  }, [completed, location.pathname, ctx, dismissed])

  useEffect(() => {
    if (!current) {
      setMissing(false)
      return
    }
    const frame = window.requestAnimationFrame(() => {
      setMissing(!hasAnchor(current.step))
    })
    const t = window.setTimeout(() => setMissing(!hasAnchor(current.step)), 160)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(t)
    }
  }, [current, location.pathname, ctx])

  // When all tips dismissed, mark complete
  useEffect(() => {
    if (!completed && allTipsDismissed(dismissed)) {
      skipTour()
    }
  }, [dismissed, completed])

  const start = useCallback(() => {
    startTour()
    setDismissed([])
    setCompleted(false)
    navigate('/groups')
  }, [navigate])

  const onDismiss = useCallback(() => {
    if (!current) return
    dismissTip(current.step.id)
  }, [current])

  const onSkip = useCallback(() => {
    skipTour()
  }, [])

  const api = useMemo(() => ({ start }), [start])
  const profile = currentProfile()

  return (
    <TourContextApi.Provider value={api}>
      {children}
      {profile && current && (
        <TourSpotlight
          step={current.step}
          stepIndex={current.index}
          stepCount={TOUR_STEPS.length}
          missing={missing}
          onNext={onDismiss}
          onSkip={onSkip}
          contextual
          remeasureKey={`${location.pathname}:${ctx.songCountInCurrentGroup}:${ctx.groupCount}`}
        />
      )}
    </TourContextApi.Provider>
  )
}
