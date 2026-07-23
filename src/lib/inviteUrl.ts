/** Build a shareable join URL for the current origin (web/PWA) or known hosts. */
export function buildInviteUrl(inviteCode: string): string {
  const code = inviteCode.trim()
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/join/${encodeURIComponent(code)}`
  }
  return `/join/${encodeURIComponent(code)}`
}

/** Extract invite path from a deep-link URL (https or custom scheme). */
export function joinPathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    // brain://join/CODE or brain://join?code=CODE
    if (parsed.protocol === 'brain:') {
      if (parsed.hostname === 'join' || parsed.host.startsWith('join')) {
        const fromPath = parsed.pathname.replace(/^\//, '')
        if (fromPath) return `/join/${decodeURIComponent(fromPath)}`
        const q = parsed.searchParams.get('code')
        if (q) return `/join/${encodeURIComponent(q)}`
      }
    }

    const path = parsed.pathname
    const joinMatch = path.match(/\/join\/([^/]+)/i)
    if (joinMatch?.[1]) {
      return `/join/${decodeURIComponent(joinMatch[1])}`
    }
    const code = parsed.searchParams.get('code')
    if (code) return `/join/${encodeURIComponent(code)}`
    return null
  } catch {
    return null
  }
}
