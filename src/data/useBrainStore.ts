import { useSyncExternalStore } from 'react'
import { getState, subscribe } from '@/data/store'
import type { AppState } from '@/types/domain'

export function useBrainStore(): AppState {
  return useSyncExternalStore(subscribe, getState, getState)
}
