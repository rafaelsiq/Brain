const KEY = 'brain.pendingInvite'

export function setPendingInvite(code: string): void {
  const trimmed = code.trim()
  if (!trimmed) return
  try {
    sessionStorage.setItem(KEY, trimmed)
  } catch {
    // ignore quota / private mode
  }
}

export function peekPendingInvite(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function takePendingInvite(): string | null {
  const code = peekPendingInvite()
  if (!code) return null
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  return code
}

export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
