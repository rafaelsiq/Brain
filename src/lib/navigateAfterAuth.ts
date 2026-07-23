import type { NavigateFunction } from 'react-router-dom'
import { joinGroupByCode } from '@/data/store'
import { takePendingInvite } from '@/lib/pendingInvite'

type LocationLike = {
  pathname: string
  search?: string
  hash?: string
}

/**
 * After login/register: consume pending invite, else respect `from`, else /groups.
 */
export async function navigateAfterAuth(
  userId: string,
  navigate: NavigateFunction,
  from?: LocationLike | null,
): Promise<void> {
  const pending = takePendingInvite()
  if (pending) {
    try {
      const group = await joinGroupByCode(pending, userId)
      navigate(`/groups/${group.id}`, { replace: true })
      return
    } catch {
      navigate('/groups', { replace: true })
      return
    }
  }

  if (from?.pathname && from.pathname !== '/welcome' && from.pathname !== '/login' && from.pathname !== '/register') {
    const target = `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
    navigate(target, { replace: true })
    return
  }

  navigate('/groups', { replace: true })
}
