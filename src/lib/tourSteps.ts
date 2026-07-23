export type TourStepId =
  | 'groups-create'
  | 'group-create-song'
  | 'song-composer'
  | 'group-invite'
  | 'profile-theme'

export type TourStep = {
  id: TourStepId
  anchor: string
  fallbackAnchors?: string[]
  title: string
  body: string
  missingBody: string
  /** True when the current location is the right place to show this tip. */
  matchesLocation: (pathname: string) => boolean
  /** Extra readiness beyond previous tips being done (e.g. has a group). */
  isReady: (ctx: TourContext) => boolean
}

export type TourContext = {
  groupCount: number
  songCountInCurrentGroup: number
  hasAnySong: boolean
  currentGroupId: string | null
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'groups-create',
    anchor: 'groups-create',
    fallbackAnchors: ['groups-join'],
    title: 'Crie ou entre em um grupo',
    body: 'Toque em + para criar um grupo, ou em “Entrar com código” se alguém te convidou.',
    missingBody: 'Use + ou “Entrar com código” para começar.',
    matchesLocation: (pathname) => pathname === '/groups',
    isReady: () => true,
  },
  {
    id: 'group-create-song',
    anchor: 'group-create-song',
    title: 'Crie uma música',
    body: 'Aqui no grupo, use o botão + para criar uma música e começar a compor.',
    missingBody: 'Toque em + para criar uma música neste grupo.',
    matchesLocation: (pathname) => /^\/groups\/[^/]+$/.test(pathname),
    isReady: (ctx) => ctx.groupCount > 0,
  },
  {
    id: 'song-composer',
    anchor: 'song-composer',
    title: 'Escreva o primeiro verso',
    body: 'Digite no campo embaixo e toque em Enviar — esse é o começo da música.',
    missingBody: 'Use o campo embaixo para escrever e enviar um verso.',
    matchesLocation: (pathname) => /^\/groups\/[^/]+\/songs\/[^/]+$/.test(pathname),
    isReady: (ctx) => ctx.hasAnySong,
  },
  {
    id: 'group-invite',
    anchor: 'group-settings',
    title: 'Convide alguém',
    body: 'Abra Configurar para copiar o link de convite e chamar outras pessoas.',
    missingBody: 'Em Configurar você copia o link de convite do grupo.',
    matchesLocation: (pathname) => /^\/groups\/[^/]+$/.test(pathname),
    isReady: (ctx) => ctx.groupCount > 0,
  },
  {
    id: 'profile-theme',
    anchor: 'profile-theme',
    title: 'Ajuste o tema',
    body: 'Aqui você alterna entre claro e escuro quando quiser.',
    missingBody: 'Use o seletor de tema nesta seção.',
    matchesLocation: (pathname) => pathname === '/profile',
    isReady: () => true,
  },
]

/** Next tip the user should see, or null if waiting for the right page / all done. */
export function resolveCurrentTip(
  pathname: string,
  ctx: TourContext,
  dismissed: TourStepId[],
): { step: TourStep; index: number } | null {
  for (let i = 0; i < TOUR_STEPS.length; i++) {
    const step = TOUR_STEPS[i]!
    if (dismissed.includes(step.id)) continue
    // Must complete previous tips first (sequential)
    const prevDone = TOUR_STEPS.slice(0, i).every((s) => dismissed.includes(s.id))
    if (!prevDone) return null
    if (!step.isReady(ctx)) return null
    if (!step.matchesLocation(pathname)) return null
    return { step, index: i }
  }
  return null
}

export function allTipsDismissed(dismissed: TourStepId[]): boolean {
  return TOUR_STEPS.every((s) => dismissed.includes(s.id))
}
