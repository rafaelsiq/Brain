import { useEffect, useState } from 'react'
import { dismissInstallBanner, isInstallBannerDismissed } from '@/lib/onboardingPrefs'
import { isInstallableBrowser } from '@/lib/platform'
import { userHasWrittenVerse } from '@/lib/activation'
import { currentProfile } from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<() => void>()

function notifyPromptListeners() {
  for (const listener of promptListeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notifyPromptListeners()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyPromptListeners()
  })
}

export function InstallBanner() {
  useBrainStore()
  const profile = currentProfile()
  const [dismissed, setDismissed] = useState(() => isInstallBannerDismissed())
  const [canPrompt, setCanPrompt] = useState(() => Boolean(deferredPrompt))

  useEffect(() => {
    const onChange = () => setCanPrompt(Boolean(deferredPrompt))
    promptListeners.add(onChange)
    onChange()
    return () => {
      promptListeners.delete(onChange)
    }
  }, [])

  if (!profile) return null
  if (!isInstallableBrowser()) return null
  if (dismissed) return null
  if (!userHasWrittenVerse(profile.id)) return null
  if (!canPrompt) return null

  async function onInstall() {
    if (!deferredPrompt) return
    const event = deferredPrompt
    deferredPrompt = null
    setCanPrompt(false)
    await event.prompt()
    try {
      await event.userChoice
    } catch {
      // ignore
    }
    dismissInstallBanner()
    setDismissed(true)
  }

  function onDismiss() {
    dismissInstallBanner()
    setDismissed(true)
  }

  return (
    <div className="install-banner" role="region" aria-label="Instalar aplicativo">
      <div className="install-banner-copy">
        <strong>Instalar Collabrain</strong>
        <p className="muted">Acesso rápido na tela inicial, sem a barra do navegador.</p>
      </div>
      <div className="install-banner-actions">
        <button type="button" className="btn compact" onClick={() => void onInstall()}>
          Instalar
        </button>
        <button type="button" className="btn ghost compact" onClick={onDismiss}>
          Agora não
        </button>
      </div>
    </div>
  )
}
