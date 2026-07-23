import { Capacitor } from '@capacitor/core'

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return Boolean(nav.standalone)
}

export function isInstallableBrowser(): boolean {
  return !isNativePlatform() && !isStandaloneDisplay()
}
