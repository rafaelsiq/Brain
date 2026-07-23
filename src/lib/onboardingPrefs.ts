import type { TourStepId } from '@/lib/tourSteps'

const KEY = 'brain.onboarding.v1'

type OnboardingPrefs = {
  installBannerDismissedAt?: string
  tourCompletedAt?: string
  /** Tips the user already acknowledged (sequential progress). */
  dismissedTips?: TourStepId[]
}

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

export function subscribeOnboardingPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function read(): OnboardingPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as OnboardingPrefs & {
      forceActivation?: boolean
      tourActive?: boolean
      tourStep?: number
    }
    const {
      forceActivation: _f,
      tourActive: _a,
      tourStep: _s,
      ...rest
    } = parsed
    return rest
  } catch {
    return {}
  }
}

function write(prefs: OnboardingPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
  notify()
}

export function isInstallBannerDismissed(): boolean {
  return Boolean(read().installBannerDismissedAt)
}

export function dismissInstallBanner(): void {
  write({ ...read(), installBannerDismissedAt: new Date().toISOString() })
}

export function isTourCompleted(): boolean {
  return Boolean(read().tourCompletedAt)
}

export function getDismissedTips(): TourStepId[] {
  return read().dismissedTips ?? []
}

export function dismissTip(id: TourStepId): void {
  const prefs = read()
  const dismissed = new Set(prefs.dismissedTips ?? [])
  dismissed.add(id)
  const next = [...dismissed]
  const allDone =
    next.includes('groups-create') &&
    next.includes('group-create-song') &&
    next.includes('song-composer') &&
    next.includes('group-invite') &&
    next.includes('profile-theme')

  write({
    ...prefs,
    dismissedTips: next,
    ...(allDone ? { tourCompletedAt: new Date().toISOString() } : {}),
  })
}

/** Replay onboarding from the beginning (Profile button). */
export function startTour(): void {
  write({
    ...read(),
    tourCompletedAt: undefined,
    dismissedTips: [],
  })
}

export function completeTour(): void {
  write({
    ...read(),
    dismissedTips: [
      'groups-create',
      'group-create-song',
      'song-composer',
      'group-invite',
      'profile-theme',
    ],
    tourCompletedAt: new Date().toISOString(),
  })
}

export function skipTour(): void {
  completeTour()
}

/** @deprecated alias */
export function activateOnboarding(): void {
  startTour()
}
