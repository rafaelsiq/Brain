import { getState } from '@/data/store'

/** User has written at least one verse (proposal) — definition of "activated". */
export function userHasWrittenVerse(userId: string): boolean {
  return getState().proposals.some((p) => p.authorId === userId)
}
