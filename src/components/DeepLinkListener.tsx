import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { joinPathFromUrl } from '@/lib/inviteUrl'

/**
 * Routes Capacitor deep links (App Links / custom scheme) into the SPA.
 */
export function DeepLinkListener() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    function go(url: string) {
      const path = joinPathFromUrl(url)
      if (path) navigate(path)
    }

    let handle: { remove: () => Promise<void> } | undefined

    void (async () => {
      try {
        const launch = await CapApp.getLaunchUrl()
        if (launch?.url) go(launch.url)
      } catch {
        // ignore
      }
      handle = await CapApp.addListener('appUrlOpen', ({ url }) => go(url))
    })()

    return () => {
      void handle?.remove()
    }
  }, [navigate])

  return null
}
